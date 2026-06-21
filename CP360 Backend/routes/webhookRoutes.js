const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');
const calendarWebhookController = require('../controllers/calendarWebhookController');
const { pool, query } = require('../config/database');
const { sendPushToCompany } = require('../services/pushNotificationService');
const verifyGHLWebhook = require('../middleware/verifyGHLWebhook');
const { calculateEstimate } = require('../estimator/calculateEstimate');

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

// Estimator price calculation — called by GHL automations
router.post('/estimate', async (req, res) => {
  try {
    const payload = req.body.customData || req.body;
    const { locationId, floor_type, garage_size, condition } = payload;
    const square_feet = payload.square_feet;
    const length = payload.length;
    const width = payload.width;

    console.log('📐 estimate webhook:', { locationId, floor_type, garage_size, condition, square_feet, length, width });

    // ── Validate required fields ──────────────────────────────────────────────
    const isGarage = floor_type === 'garage';
    const hasSqFt = Number(square_feet) > 0;
    const hasDimensions = Number(length) > 0 && Number(width) > 0;

    let missing = false;
    if (!locationId || !floor_type || !condition) {
      missing = true;
    } else if (isGarage && !garage_size) {
      missing = true;
    } else if (!isGarage && !hasSqFt && !hasDimensions) {
      missing = true;
    }

    if (missing) {
      console.log('📐 estimate webhook: missing required fields — returning manual_review_required');
      return res.json({ status: 'manual_review_required', message: 'Manual review required' });
    }

    // ── Company lookup ────────────────────────────────────────────────────────
    const companyResult = await pool.query(
      'SELECT id FROM companies WHERE ghl_location_id = $1',
      [locationId]
    );
    if (companyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }
    const companyId = companyResult.rows[0].id;

    // ── Load estimator config ─────────────────────────────────────────────────
    const configResult = await query(
      'SELECT * FROM estimator_configs WHERE company_id = $1 LIMIT 1',
      [companyId]
    );
    if (configResult.rows.length === 0) {
      return res.json({ status: 'manual_review_required', message: 'Manual review required' });
    }
    const config = configResult.rows[0];

    // ── Build project type + space type ───────────────────────────────────────
    const projectType = isGarage ? `garage_${garage_size}` : floor_type;
    const spaceType = isGarage ? 'garage' : floor_type;

    // ── Load per-finish pricing ───────────────────────────────────────────────
    const pricingResult = await query(
      `SELECT finish_type, min_price_per_sf, max_price_per_sf
       FROM estimator_pricing_configs
       WHERE company_id = $1 AND space_type = $2 AND enabled = true
       ORDER BY finish_type`,
      [companyId, spaceType]
    );

    const pricingByFinish = {};
    pricingResult.rows.forEach(row => {
      pricingByFinish[row.finish_type] = { min: row.min_price_per_sf, max: row.max_price_per_sf };
    });

    if (Object.keys(pricingByFinish).length === 0) {
      return res.json({ status: 'manual_review_required', message: 'Manual review required' });
    }

    // ── Build engine input ────────────────────────────────────────────────────
    const selectedQuality = Object.keys(pricingByFinish)[0];
    const input = {
      project: { type: projectType, condition },
      selectedQuality,
    };
    if (hasSqFt) input.squareFeet = Number(square_feet);
    if (hasDimensions && !hasSqFt) { input.length = Number(length); input.width = Number(width); }

    // ── Calculate ─────────────────────────────────────────────────────────────
    const estimate = calculateEstimate(config, input, pricingByFinish);
    console.log('📐 estimate webhook result:', estimate);

    res.json(estimate);
  } catch (error) {
    console.error('Estimate webhook error:', error);
    res.status(500).json({ error: 'Failed to calculate estimate' });
  }
});

module.exports = router;