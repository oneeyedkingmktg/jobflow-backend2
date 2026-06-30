const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');
const calendarWebhookController = require('../controllers/calendarWebhookController');
const { pool, query } = require('../config/database');
const { sendPushToCompany } = require('../services/pushNotificationService');
const verifyGHLWebhook = require('../middleware/verifyGHLWebhook');
const { calculateEstimate } = require('../estimator/calculateEstimate');
const { applyStatusTags, updateContactCustomFields } = require('../controllers/ghlAPI');

function formatProjectTypeForPush(type) {
  if (!type) return 'Unknown';
  if (type.startsWith('garage_')) return `${type.split('_')[1]} Car Garage`;
  if (type === 'patio') return 'Patio';
  if (type === 'basement') return 'Basement';
  if (type === 'commercial') return 'Commercial';
  if (type === 'custom') return 'Custom Project';
  return type.charAt(0).toUpperCase() + type.slice(1);
}

// GHL Contact webhook - single endpoint for all companies
router.post('/ghl/contact', verifyGHLWebhook, webhookController.handleGHLContact);
router.post('/ghl/calendar', verifyGHLWebhook, calendarWebhookController.handleGHLCalendar);

// Message-arrived — called by GHL automation on any inbound message
router.post('/message-arrived', async (req, res) => {
  try {
    const raw = req.body || {};
    const payload = raw.customData || raw;
    const locationId = payload.locationId || payload.location_id;
    const contactId = payload.contactId || payload.contact_id;

    console.log('📨 message-arrived webhook:', { locationId, contactId, keys: Object.keys(payload) });

    if (!locationId || !contactId) {
      console.warn('📨 message-arrived: missing fields, full body:', JSON.stringify(raw));
      return res.status(400).json({ error: 'Missing locationId or contactId' });
    }

    const result = await pool.query(
      'SELECT id FROM companies WHERE ghl_location_id = $1',
      [locationId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const companyId = result.rows[0].id;
    await pool.query(
      `INSERT INTO conversation_updates (contact_id, company_id, last_message_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (contact_id)
       DO UPDATE SET last_message_at = NOW(), company_id = EXCLUDED.company_id`,
      [contactId, companyId]
    );

    console.log('📨 message-arrived: stored update for contact', contactId, 'company', companyId);
    res.json({ success: true });
  } catch (error) {
    console.error('Message-arrived webhook error:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

// Push notification trigger — called by GHL automations
router.post('/push', async (req, res) => {
  try {
    console.log('🔔 Push webhook received:', JSON.stringify(req.body));
    const payload = req.body.customData || req.body;
    const { type, locationId, title, contactId } = payload;
    // GHL sends contact_id (snake_case) at the root level of the webhook body
    const ghlContactId = contactId || req.body.contact_id;
    const contactName = req.body.full_name || req.body.contact?.full_name || '';
    const body = contactName
      ? `${contactName} ${payload.body || ''}`.trim()
      : payload.body || '';
    console.log('🔔 Parsed payload:', { type, locationId, title, body, ghlContactId });

    if (!type || !locationId) {
      return res.status(400).json({ error: 'Missing type or locationId' });
    }

    // Look up company by GHL location ID
    console.log('🔔 Looking up company for locationId:', locationId);
    const result = await pool.query(
      'SELECT id FROM companies WHERE ghl_location_id = $1',
      [locationId]
    );
    console.log('🔔 Company lookup result:', result.rows);

    if (result.rows.length === 0) {
      console.log(`No company found for location_id: ${locationId}`);
      return res.status(404).json({ error: 'Company not found' });
    }

    const companyId = result.rows[0].id;
    console.log('🔔 Sending push for companyId:', companyId);

    const data = { type };
    if (ghlContactId) data.contactId = String(ghlContactId);

    await sendPushToCompany(companyId, { type, title, body, data });

    // If this is a new message event, stamp conversation_updates so open threads refresh
    if (ghlContactId && type === 'new_message') {
      await pool.query(
        `INSERT INTO conversation_updates (contact_id, company_id, last_message_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (contact_id)
         DO UPDATE SET last_message_at = NOW(), company_id = EXCLUDED.company_id`,
        [ghlContactId, companyId]
      );
      console.log('📨 conversation_updates stamped for contact', ghlContactId);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Push webhook error:', error);
    res.status(500).json({ error: 'Failed to send push notification' });
  }
});

// Estimator price calculation — called by GHL automations (Facebook ad leads)
// Full routine: calculate → find/create CP lead → save estimate → GHL tags + fields → push
router.post('/estimate', async (req, res) => {
  try {
    const payload = req.body.customData || req.body;
    const { locationId, floor_type, condition } = payload;
    const garage_size = payload.garage_size;
    const square_feet = payload.square_feet;
    const length = payload.length;
    const width = payload.width;

    // Contact identity from GHL
    const ghlContactId = payload.contactId || payload.contact_id;
    const phone = payload.phone;
    const email = payload.email;
    const firstName = payload.first_name || payload.firstName;
    const lastName = payload.last_name || payload.lastName;
    const fullName = payload.full_name || payload.fullName || [firstName, lastName].filter(Boolean).join(' ');
    const address = payload.address;
    const city = payload.city;
    const state = payload.state;
    const zip = payload.zip || payload.postal_code || payload.postalCode;
    const leadSource = payload.lead_source || 'facebook';
    const utmSource = payload.utm_source || payload.utmSource || null;
    const utmMedium = payload.utm_medium || payload.utmMedium || null;
    const referralSource = payload.referral_source || payload.referralSource || null;

    console.log('📐 estimate webhook:', { locationId, floor_type, garage_size, condition, square_feet, ghlContactId, phone, email, utmSource, utmMedium, referralSource });

    // ── Validate required fields ──────────────────────────────────────────────
    const isGarage = floor_type === 'garage';
    const hasSqFt = Number(square_feet) > 0;
    const hasDimensions = Number(length) > 0 && Number(width) > 0;

    let missing = false;
    if (!locationId || !floor_type || !condition) missing = true;
    else if (isGarage && !garage_size) missing = true;
    else if (!isGarage && !hasSqFt && !hasDimensions) missing = true;

    if (missing || (!ghlContactId && !phone && !email)) {
      console.log('📐 estimate webhook: missing required fields — manual_review_required');
      return res.json({ status: 'manual_review_required', message: 'Manual review required' });
    }

    // ── Company lookup ────────────────────────────────────────────────────────
    const companyResult = await pool.query(
      'SELECT * FROM companies WHERE ghl_location_id = $1',
      [locationId]
    );
    if (companyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }
    const company = companyResult.rows[0];
    const companyId = company.id;

    // ── Load estimator config + pricing ───────────────────────────────────────
    const configResult = await query('SELECT * FROM estimator_configs WHERE company_id = $1 LIMIT 1', [companyId]);
    if (configResult.rows.length === 0) {
      return res.json({ status: 'manual_review_required', message: 'Manual review required' });
    }
    const config = configResult.rows[0];

    const projectType = isGarage ? `garage_${garage_size}` : floor_type;
    const spaceType = isGarage ? 'garage' : floor_type;

    const pricingResult = await query(
      `SELECT finish_type, min_price_per_sf, max_price_per_sf
       FROM estimator_pricing_configs
       WHERE company_id = $1 AND space_type = $2 AND enabled = true ORDER BY finish_type`,
      [companyId, spaceType]
    );
    const pricingByFinish = {};
    pricingResult.rows.forEach(r => { pricingByFinish[r.finish_type] = { min: r.min_price_per_sf, max: r.max_price_per_sf }; });

    if (Object.keys(pricingByFinish).length === 0) {
      return res.json({ status: 'manual_review_required', message: 'Manual review required' });
    }

    // ── Calculate estimate ────────────────────────────────────────────────────
    const selectedQuality = Object.keys(pricingByFinish)[0];
    const engineInput = { project: { type: projectType, condition }, selectedQuality };
    if (hasSqFt) engineInput.squareFeet = Number(square_feet);
    if (hasDimensions && !hasSqFt) { engineInput.length = Number(length); engineInput.width = Number(width); }

    const estimate = calculateEstimate(config, engineInput, pricingByFinish);
    console.log('📐 estimate webhook calculated:', estimate);

    // ── Service area zip check (mirrors iframe logic) ─────────────────────────
    if (zip && Array.isArray(company.service_area_zips) && company.service_area_zips.length > 0) {
      const isOutsideArea = !company.service_area_zips.map(String).includes(zip.trim());
      if (isOutsideArea) {
        if (!config.out_of_area_enabled) {
          console.log('📐 estimate webhook: zip', zip, 'outside service area — manual_review_required');
          return res.json({ status: 'manual_review_required', message: 'Manual review required' });
        }
        const threshold = Number(config.out_of_area_large_job_threshold) || 0;
        const flakeMin = estimate.allPriceRanges?.flake?.min || estimate.displayPriceMin || 0;
        if (threshold > 0 && flakeMin < threshold) {
          console.log('📐 estimate webhook: zip', zip, 'outside area, below threshold — manual_review_required');
          return res.json({ status: 'manual_review_required', message: 'Manual review required' });
        }
        console.log('📐 estimate webhook: zip', zip, 'outside area but large job — proceeding');
      }
    }

    // ── Find or create CP lead ────────────────────────────────────────────────
    let cpLead = null;

    if (ghlContactId) {
      const r = await pool.query(
        `SELECT * FROM leads WHERE company_id = $1 AND ghl_contact_id = $2 AND deleted_at IS NULL LIMIT 1`,
        [companyId, ghlContactId]
      );
      cpLead = r.rows[0] || null;
    }
    if (!cpLead && phone) {
      const norm = phone.replace(/\D/g, '');
      const r = await pool.query(
        `SELECT * FROM leads WHERE company_id = $1
         AND replace(replace(replace(replace(phone,'(',''),')',''),'-',''),' ','') = $2
         AND deleted_at IS NULL LIMIT 1`,
        [companyId, norm]
      );
      cpLead = r.rows[0] || null;
    }
    if (!cpLead && email) {
      const r = await pool.query(
        `SELECT * FROM leads WHERE company_id = $1 AND email = $2 AND deleted_at IS NULL LIMIT 1`,
        [companyId, email]
      );
      cpLead = r.rows[0] || null;
    }

    let isNewLead = false;

    if (!cpLead) {
      // Contact exists in GHL — create CP lead with ghl_contact_id already set (no GHL sync needed)
      const first = firstName || (fullName ? fullName.trim().split(' ')[0] : '');
      const last = lastName || (fullName ? fullName.trim().split(' ').slice(1).join(' ') : '');
      const full = fullName || [first, last].filter(Boolean).join(' ') || 'Unknown';

      const ins = await pool.query(
        `INSERT INTO leads (
          company_id, name, full_name, first_name, last_name,
          phone, email, address, city, state, zip,
          lead_source, referral_source, utm_source, utm_medium,
          status, ghl_contact_id, project_type, proceed_with_automation
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
        [
          companyId, full, full, first, last,
          phone || null, email || null,
          address || null, city || null, state || null, zip || null,
          leadSource, referralSource, utmSource, utmMedium,
          'status_pre_lead', ghlContactId || null, projectType, true,
        ]
      );
      cpLead = ins.rows[0];
      isNewLead = true;
      console.log('📐 estimate webhook: created new CP lead', cpLead.id);
    } else {
      // Stamp ghl_contact_id if we found the lead by phone/email and it wasn't linked yet
      if (!cpLead.ghl_contact_id && ghlContactId) {
        await pool.query(`UPDATE leads SET ghl_contact_id = $1 WHERE id = $2`, [ghlContactId, cpLead.id]);
        cpLead.ghl_contact_id = ghlContactId;
      }
      // Write-once: only fill in source fields if currently blank
      const sourceUpdates = [];
      const sourceValues = [];
      let p = 1;
      if (!cpLead.lead_source && leadSource) { sourceUpdates.push(`lead_source = $${p++}`); sourceValues.push(leadSource); }
      if (!cpLead.referral_source && referralSource) { sourceUpdates.push(`referral_source = $${p++}`); sourceValues.push(referralSource); }
      if (!cpLead.utm_source && utmSource) { sourceUpdates.push(`utm_source = $${p++}`); sourceValues.push(utmSource); }
      if (!cpLead.utm_medium && utmMedium) { sourceUpdates.push(`utm_medium = $${p++}`); sourceValues.push(utmMedium); }
      if (sourceUpdates.length) {
        sourceValues.push(cpLead.id);
        await pool.query(`UPDATE leads SET ${sourceUpdates.join(', ')} WHERE id = $${p}`, sourceValues);
      }
      console.log('📐 estimate webhook: found existing CP lead', cpLead.id);
    }

    // ── Save estimate (up to 2 per lead, same rule as iframe) ─────────────────
    const existingEstimatesResult = await pool.query(
      `SELECT * FROM estimator_leads WHERE lead_id = $1 ORDER BY estimate_number ASC`,
      [cpLead.id]
    );
    const estimateCount = existingEstimatesResult.rows.length;

    if (estimateCount >= 2) {
      console.log('📐 estimate webhook: 2 estimates already exist for lead', cpLead.id, '— skipping save');
      return res.json(estimate);
    }

    await pool.query(
      `INSERT INTO estimator_leads (
        lead_id, company_id, estimate_number, project_type,
        calculated_sf, condition, selected_quality,
        display_price_min, display_price_max, all_price_ranges, minimum_job_applied
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        cpLead.id, companyId, estimateCount + 1, projectType,
        estimate.calculatedSf, condition, estimate.selectedQuality,
        estimate.displayPriceMin, estimate.displayPriceMax,
        JSON.stringify(estimate.allPriceRanges), estimate.minimumJobApplied || false,
      ]
    );
    await pool.query(`UPDATE leads SET has_estimate = true WHERE id = $1`, [cpLead.id]);

    // ── GHL: apply tags + update custom fields ─────────────────────────────────
    const ghlId = cpLead.ghl_contact_id;
    if (company.ghl_api_key && ghlId) {
      // Tags
      try {
        if (isNewLead) await applyStatusTags(ghlId, 'estimator_lead', company);
        await applyStatusTags(ghlId, 'submitted_estimate', company);
      } catch (e) {
        console.error('📐 estimate webhook: GHL tag error:', e.message);
      }

      // Custom fields
      try {
        const ranges = estimate.allPriceRanges || {};
        const fmtRange = (r) => r ? (r.min === r.max ? `$${r.min.toLocaleString()}` : `$${r.min.toLocaleString()} – $${r.max.toLocaleString()}`) : '';
        const conditionLabel = condition === 'minor' ? 'A Few Cracks' : condition === 'major' ? 'A Lot of Cracks' : 'Good';

        let fields;
        if (estimateCount === 0) {
          // EST1 fields — same keys as iframe first estimate
          fields = {
            est_project_type: projectType,
            est_square_footage: estimate.calculatedSf ? `${Number(estimate.calculatedSf).toLocaleString()} sq ft` : '',
            est_floor_condition: conditionLabel,
            est_solid_price_range: fmtRange(ranges.solid),
            est_flake_price_range: fmtRange(ranges.flake),
            est_metallic_price_range: fmtRange(ranges.metallic),
            est_custom_finish_range: fmtRange(ranges.custom),
          };
        } else {
          // EST2 fields — same keys as iframe second estimate
          fields = {
            est2_square_footage: estimate.calculatedSf ? String(estimate.calculatedSf) : '',
            est2_floor_condition: conditionLabel,
            est2_solid_price_range: fmtRange(ranges.solid),
            est2_flake_price_range: fmtRange(ranges.flake),
            est2_metallic_price_range: fmtRange(ranges.metallic),
            est2_custom_finish_range: fmtRange(ranges.custom),
          };
        }
        await updateContactCustomFields(ghlId, fields, company);
      } catch (e) {
        console.error('📐 estimate webhook: GHL custom fields error:', e.message);
      }
    }

    // ── Push notification (new leads only) ────────────────────────────────────
    if (isNewLead) {
      try {
        const name = cpLead.first_name || cpLead.full_name || 'Someone';
        const project = formatProjectTypeForPush(projectType);
        const title = company.est_push_title || 'New Estimator Lead';
        const bodyTemplate = company.est_push_body || '{{name}} just submitted an estimator request for a {{project}} project. Click to open lead.';
        const body = bodyTemplate.replace('{{name}}', name).replace('{{project}}', project);
        sendPushToCompany(companyId, {
          type: 'new_estimator_lead',
          title,
          body,
          data: { type: 'new_estimator_lead', leadId: String(cpLead.id) },
        }).catch(e => console.error('📐 estimate webhook push error:', e.message));
      } catch (e) {
        console.error('📐 estimate webhook push build error:', e.message);
      }
    }

    res.json(estimate);
  } catch (error) {
    console.error('Estimate webhook error:', error);
    res.status(500).json({ error: 'Failed to calculate estimate' });
  }
});

module.exports = router;