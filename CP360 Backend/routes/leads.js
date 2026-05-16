// ============================================================================
// File: routes/leads.js
// Version: v1.6.1 - FIXED: GET route uses query params + saves estimates
// ============================================================================

const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const { authenticateToken } = require("../middleware/auth");
const { syncLeadToGhl } = require("../sync/dbToGhlSync");
const { deleteGhlContact, applyStatusTags, removeStatusTags, updateContactCustomFields } = require("../controllers/ghlAPI");
const { sendPushToCompany } = require("../services/pushNotificationService");

function formatProjectTypeForPush(type) {
  if (!type) return 'Unknown';
  if (type.startsWith('garage_')) return `${type.split('_')[1]} Car Garage`;
  if (type === 'patio') return 'Patio';
  if (type === 'basement') return 'Basement';
  if (type === 'commercial') return 'Commercial';
  if (type === 'custom') return 'Custom Project';
  return type.charAt(0).toUpperCase() + type.slice(1);
}


// Normalize phone to digits only for matching
function normalizePhone(phone) {
  if (!phone) return null;
  return phone.replace(/\D/g, '');
}



// NEW: GHL sync





// Apply authentication to all routes
// Allow public estimator POSTs, protect everything else
router.use((req, res, next) => {
  if (req.method === "POST" && req.path === "/") {
    return next(); // public estimator lead submit
  }
  if (req.method === "POST" && /^\/\d+\/second-estimate$/.test(req.path)) {
    return next(); // public second estimate submit (no contact info collected)
  }
  return authenticateToken(req, res, next);
});


const clean = (v) => (v === "" || v === undefined ? null : v);

const toCamel = (row) => ({
  id: row.id,
  companyId: row.company_id,
  createdByUserId: row.created_by_user_id,

  name: row.name,
  fullName: row.full_name,
  firstName: row.first_name,
  lastName: row.last_name,

  phone: row.phone,
  email: row.email,
  preferredContact: row.preferred_contact,

  address: row.address,
  city: row.city,
  state: row.state,
  zip: row.zip,

  buyerType: row.buyer_type,
  companyName: row.company_name,
  projectType: row.project_type,

  leadSource: row.lead_source,
  referralSource: row.referral_source,

  status: row.status,
  notSoldReason: row.not_sold_reason,
  notes: row.notes,
  contractPrice: row.contract_price,

  appointmentDate: row.appointment_date,
  appointmentTime: row.appointment_time,
  appointmentCalendarEventId: row.appointment_calendar_event_id || null,
  lastSyncedAppointmentDate: row.last_synced_appointment_date || null,
  installDate: row.install_date,
  installTentative: row.install_tentative,
  installDurationDays: row.install_duration_days || 1,
  installEndDate: row.install_end_date || null,
  installCalendarEventId: row.install_calendar_event_id || null,

  createdAt: row.created_at,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at,
  hasEstimate: row.has_estimate === true,

  pauseStatus: row.pause_status,
  pauseUntil: row.pause_until,
  resumeAction: row.resume_action,
  pauseNotes: row.pause_notes,

  proceedWithAutomation: row.proceed_with_automation,

  ghlContactId: row.ghl_contact_id,
  outOfAreaLargeJob: row.out_of_area_large_job === true,
});

function parseName(full) {
  if (!full || !full.trim()) return { first: "", last: "", full: "" };
  const parts = full.trim().split(" ");
  if (parts.length === 1)
    return { first: parts[0], last: "", full: parts[0] };
  return {
    first: parts[0],
    last: parts.slice(1).join(" "),
    full,
  };
}

const validateLead = (lead) => {
  if (!lead.name && !lead.full_name) return "Name is required.";
  if (!lead.phone) return "Phone is required.";
  return null;
};

// ============================================================================
// GET CALENDAR DOTS DATA (for date picker mini-calendar) - MOVED TO TOP
// ============================================================================
router.get("/calendar-dots", async (req, res) => {
  try {
    const { company_id } = req.query;
    if (!company_id) return res.status(400).json({ error: "company_id required" });

    const result = await pool.query(
      `SELECT id, name, install_date, install_tentative, install_duration_days, install_end_date, appointment_date, appointment_time
       FROM leads
       WHERE company_id = $1
         AND deleted_at IS NULL
         AND status != 'status_junk'
         AND (install_date IS NOT NULL OR appointment_date IS NOT NULL)`,
      [company_id]
    );

    res.json({ dots: result.rows });
  } catch (error) {
    console.error("Error fetching calendar dots:", error);
    res.status(500).json({ error: "Failed to fetch calendar dots." });
  }
});

// ============================================================================
// GET SERVICE CALLS CALENDAR DATA
// ============================================================================
router.get("/service-calls-calendar", async (req, res) => {
  try {
    const { company_id } = req.query;
    if (!company_id) return res.status(400).json({ error: "company_id required" });

    const result = await pool.query(
      `SELECT sc.id, sc.lead_id, sc.scheduled_date::text, sc.scheduled_time::text,
              sc.scheduled_end_time::text, sc.title, l.name AS lead_name
       FROM service_calls sc
       JOIN leads l ON l.id = sc.lead_id
       WHERE sc.company_id = $1
         AND sc.scheduled_date IS NOT NULL
         AND l.deleted_at IS NULL
       ORDER BY sc.scheduled_date ASC`,
      [company_id]
    );

    res.json({ serviceCalls: result.rows });
  } catch (err) {
    console.error("Error fetching service calls calendar:", err);
    res.status(500).json({ error: "Failed to fetch service calls calendar." });
  }
});

// ============================================================================
// CHECK APPOINTMENT SLOT (hard block collision check) - MOVED TO TOP
// ============================================================================
router.get("/appt-slot-check", async (req, res) => {
  try {
    const { company_id, date, time, exclude_lead_id } = req.query;
    if (!company_id || !date || !time) {
      return res.status(400).json({ error: "company_id, date, and time required" });
    }

    let query = `
      SELECT id, name FROM leads
      WHERE company_id = $1
        AND appointment_date = $2
        AND appointment_time = $3
        AND deleted_at IS NULL
        AND status != 'status_junk'
    `;
    const params = [company_id, date, time];

    if (exclude_lead_id) {
      query += ` AND id != $4`;
      params.push(exclude_lead_id);
    }

    const result = await pool.query(query, params);
    res.json({ taken: result.rows.length > 0, conflict: result.rows[0] || null });
  } catch (error) {
    console.error("Error checking appointment slot:", error);
    res.status(500).json({ error: "Failed to check appointment slot." });
  }
});

// ============================================================================
// GET LEADS - FIXED: Use req.query not req.body
// ============================================================================
router.get("/", async (req, res) => {
  console.log("\n═══════════════════════════════════");
  console.log("🔍 GET /leads");
  console.log("📦 Query params:", req.query);
  console.log("═══════════════════════════════════\n");
  try {
    // ✅ FIX: GET requests use query params, not body
    const companyId = req.query.company_id;
    const includeDeleted = req.query.include_deleted === 'true';
    console.log("✅ Company ID from query:", companyId);
    console.log("✅ Include deleted:", includeDeleted);
    if (!companyId) {
      console.log("❌ Missing company_id in query");
      return res.status(400).json({ error: "company_id required" });
    }
const deletedFilter = includeDeleted ? '' : 'AND l.deleted_at IS NULL';
const includeJunk = req.query.include_junk === 'true';
const junkFilter = includeJunk ? '' : "AND l.status != 'status_junk'";
const result = await pool.query(
  `
  SELECT
    l.*,
    c.timezone AS timezone
  FROM leads l
  JOIN companies c ON c.id = l.company_id
  WHERE l.company_id = $1
    ${deletedFilter}
    ${junkFilter}
  ORDER BY l.created_at DESC
  `,
  [companyId]
);



    console.log(`✅ Found ${result.rows.length} leads for company ${companyId}`);

    res.json({
      leads: result.rows.map(toCamel),
    });
  } catch (error) {
    console.error("💥 Error loading leads:", error);
    res.status(500).json({ error: "Failed to load leads." });
  }
});

// ============================================================================
// CREATE LEAD (+ ESTIMATOR DATA)
// ============================================================================

router.post("/", async (req, res) => {
  console.log("\n═══════════════════════════════════");
  console.log("🎯 /leads POST RECEIVED");
  console.log("📦 Request Body:", JSON.stringify(req.body, null, 2));
  console.log("═══════════════════════════════════\n");

  try {
const userId = req.user?.id || null;
    let companyId = req.body.company_id;

    console.log("✅ Company ID (raw):", companyId);
    console.log("✅ User ID:", userId);

    if (!companyId) {
      console.log("❌ Missing company_id");
      return res.status(400).json({ error: "company_id required" });
    }

    // Resolve estimator_code to numeric company_id if needed
    if (isNaN(companyId)) {
      const codeResult = await pool.query(
        `SELECT id FROM companies WHERE estimator_code = $1 AND deleted_at IS NULL LIMIT 1`,
        [companyId]
      );
      if (codeResult.rows.length === 0) {
        return res.status(404).json({ error: "Company not found" });
      }
      companyId = codeResult.rows[0].id;
      console.log("✅ Resolved estimator_code to company_id:", companyId);
    }

    const lead = req.body;
    const estimate = req.body.estimate;

    const error = validateLead(lead);
    if (error) {
      console.log("❌ Validation failed:", error);
      return res.status(400).json({ error });
    }

    // 🔍 CHECK FOR EXISTING LEAD BY PHONE
    const normalizedPhone = normalizePhone(lead.phone);
    console.log("🔍 Checking for existing lead with phone:", normalizedPhone);

const existingLeadResult = await pool.query(
      `SELECT * FROM leads 
       WHERE company_id = $1 
       AND replace(replace(replace(replace(phone, '(', ''), ')', ''), '-', ''), ' ', '') = $2
       AND deleted_at IS NULL
       LIMIT 1`,
      [companyId, normalizedPhone]
    );

const existingLead = existingLeadResult.rows[0];
    if (existingLead) {
      console.log("✅ EXISTING LEAD FOUND - ID:", existingLead.id);

      // Check how many estimates already exist for this lead
      const existingEstimatesResult = await pool.query(
        `SELECT * FROM estimator_leads WHERE lead_id = $1 ORDER BY estimate_number ASC`,
        [existingLead.id]
      );
      const existingEstimates = existingEstimatesResult.rows;
      const estimateCount = existingEstimates.length;

      // If 2 estimates already exist — block and return them for display
      if (estimateCount >= 2) {
        console.log("🚫 Two estimates already exist for lead:", existingLead.id);
        return res.status(200).json({
          lead: toCamel(existingLead),
          existingLead: true,
          twoEstimatesExist: true,
          estimates: existingEstimates,
          message: "Two estimates already exist"
        });
      }

      // Save estimate data if provided
      if (estimate) {
        console.log("💰 Saving estimate data for existing lead:", existingLead.id, "as estimate #", estimateCount + 1);
        const displayProjectType =
          estimate.length_ft && estimate.width_ft && estimate.project_type
            ? `${estimate.length_ft}' x ${estimate.width_ft}' ${estimate.project_type.charAt(0).toUpperCase() + estimate.project_type.slice(1)}`
            : estimate.project_type;
        const nextEstimateNumber = estimateCount + 1;
        try {
          await pool.query(
            `INSERT INTO estimator_leads (
              lead_id, company_id, estimate_number, project_type,
              length_ft, width_ft, calculated_sf,
              condition, existing_coating, selected_quality,
              display_price_min, display_price_max,
              all_price_ranges, minimum_job_applied
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
            [
              existingLead.id,
              companyId,
              nextEstimateNumber,
              displayProjectType,
              estimate.length_ft,
              estimate.width_ft,
              estimate.calculated_sf,
              estimate.condition,
              estimate.existing_coating || false,
              estimate.selected_quality,
              estimate.display_price_min,
              estimate.display_price_max,
              JSON.stringify(estimate.all_price_ranges),
              estimate.minimum_job_applied || false
            ]
          );
          console.log("✅ ESTIMATE INSERT SUCCESSFUL as #", nextEstimateNumber);
          await pool.query(
            `UPDATE leads SET has_estimate = true WHERE id = $1`,
            [existingLead.id]
          );

          // Add GHL tag
          const company = (
            await pool.query(`SELECT * FROM companies WHERE id = $1`, [companyId])
          ).rows[0];
          if (company.ghl_api_key && existingLead.ghl_contact_id) {
            try {
              await applyStatusTags(existingLead.ghl_contact_id, "submitted_estimate", company);
            } catch (tagError) {
              console.error("❌ Failed to apply estimator_lead tag:", tagError.message);
            }
            // If returning customer is submitting their 2nd estimate, update EST2 GHL fields
            if (estimateCount === 1) {
              try {
                const conditionLabel = estimate.condition === "minor" ? "A Few Cracks" : estimate.condition === "major" ? "A Lot of Cracks" : "Good";
                const ranges = typeof estimate.all_price_ranges === "string" ? JSON.parse(estimate.all_price_ranges) : (estimate.all_price_ranges || {});
                const fmtRange = (r) => r ? (r.min === r.max ? `$${r.min.toLocaleString()}` : `$${r.min.toLocaleString()} – $${r.max.toLocaleString()}`) : "";
                await updateContactCustomFields(existingLead.ghl_contact_id, {
                  est2_square_footage: estimate.calculated_sf ? String(estimate.calculated_sf) : "",
                  est2_floor_condition: conditionLabel,
                  est2_solid_price_range: fmtRange(ranges.solid),
                  est2_flake_price_range: fmtRange(ranges.flake),
                  est2_metallic_price_range: fmtRange(ranges.metallic),
                  est2_custom_finish_range: fmtRange(ranges.custom),
                }, company);
              } catch (fieldErr) {
                console.error("❌ GHL EST2 custom fields failed (returning customer):", fieldErr.message);
              }
            }
          }

          // If this was a second estimate (returning customer had 1), return both
          if (estimateCount === 1) {
            const allEstimatesResult = await pool.query(
              `SELECT * FROM estimator_leads WHERE lead_id = $1 ORDER BY estimate_number ASC`,
              [existingLead.id]
            );
            return res.status(200).json({
              lead: toCamel(existingLead),
              existingLead: true,
              hasExistingEstimate: true,
              estimates: allEstimatesResult.rows,
              message: "Second estimate added for returning customer"
            });
          }
        } catch (estimateError) {
          console.error("❌ ESTIMATE INSERT FAILED:", estimateError);
        }
      }

      return res.status(200).json({
        lead: toCamel(existingLead),
        existingLead: true,
        message: "Estimate appended to existing lead"
      });
    }

    // 🆕 NO EXISTING LEAD - CREATE NEW ONE
    console.log("➕ No existing lead found - creating new lead");

    const { first, last, full } = parseName(lead.name || lead.full_name);
    console.log("📝 Parsed name:", { first, last, full });

const insertValues = [
      companyId,
      userId,
      full,
      full,
      first,
      last,
      clean(lead.phone),
      clean(lead.email),
      clean(lead.preferred_contact),
      clean(lead.address),
      clean(lead.city),
      clean(lead.state),
      clean(lead.zip),
      clean(lead.buyer_type),
      clean(lead.company_name),
      clean(lead.project_type),
      clean(lead.lead_source || "estimator"),
      clean(lead.referral_source),
      lead.status || "status_pre_lead",
      clean(lead.not_sold_reason),
      clean(lead.notes),
      clean(lead.contract_price),
      clean(lead.appointment_date),
      clean(lead.appointment_time),
      clean(lead.install_date),
      lead.install_tentative || false,
      lead.utm_source || null,
      lead.utm_medium || null,
      lead.utm_campaign || null,
      lead.utm_content || null,
      lead.proceed_with_automation ?? true,
      lead.out_of_area_large_job || false,
    ];

    console.log("💾 INSERT LEAD VALUES:", insertValues);

    const result = await pool.query(
`INSERT INTO leads (
        company_id, created_by_user_id,
        name, full_name, first_name, last_name,
        phone, email, preferred_contact,
        address, city, state, zip,
        buyer_type, company_name, project_type,
        lead_source, referral_source,
        status, not_sold_reason, notes, contract_price,
        appointment_date, appointment_time,
        install_date, install_tentative,
        utm_source, utm_medium, utm_campaign, utm_content,
        proceed_with_automation, out_of_area_large_job
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
        $14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,
        $27,$28,$29,$30,$31,$32
      )
      RETURNING *`,
      insertValues
    );

    const newLead = result.rows[0];
    console.log("✅ LEAD INSERT SUCCESSFUL - Lead ID:", newLead.id);

    // Save estimate data if provided
    if (estimate) {
      console.log("💰 Saving estimate data for lead:", newLead.id);

      const displayProjectType =
        estimate.length_ft && estimate.width_ft && estimate.project_type
          ? `${estimate.length_ft}' x ${estimate.width_ft}' ${estimate.project_type.charAt(0).toUpperCase() + estimate.project_type.slice(1)}`
          : estimate.project_type;

      try {
        await pool.query(
          `INSERT INTO estimator_leads (
            lead_id, company_id, project_type,
            length_ft, width_ft, calculated_sf,
            condition, existing_coating, selected_quality,
            display_price_min, display_price_max,
            all_price_ranges, minimum_job_applied
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            newLead.id,
            companyId,
            displayProjectType,
            estimate.length_ft,
            estimate.width_ft,
            estimate.calculated_sf,
            estimate.condition,
            estimate.existing_coating || false,
            estimate.selected_quality,
            estimate.display_price_min,
            estimate.display_price_max,
            JSON.stringify(estimate.all_price_ranges),
            estimate.minimum_job_applied || false
          ]
        );
        console.log("✅ ESTIMATE INSERT SUCCESSFUL");

        await pool.query(
          `UPDATE leads SET has_estimate = true WHERE id = $1`,
          [newLead.id]
        );
        console.log("✅ UPDATED has_estimate flag");
      } catch (estimateError) {
        console.error("❌ ESTIMATE INSERT FAILED:", estimateError);
      }
    }

    const company = (
      await pool.query(`SELECT * FROM companies WHERE id = $1`, [companyId])
    ).rows[0];

    // Check if user has bypass flag
    let shouldBypassSync = false;
    if (userId) {
      const userResult = await pool.query(
        `SELECT bypass_duplicate_check FROM users WHERE id = $1`,
        [userId]
      );
      if (userResult.rows.length > 0) {
        shouldBypassSync = userResult.rows[0].bypass_duplicate_check === true;
      }
    }

    let ghlSynced = false;
    if (company.ghl_api_key && !shouldBypassSync) {
      try {
        await syncLeadToGhl({ lead: newLead, company });
        ghlSynced = true;
      } catch (syncError) {
        console.log('GHL sync failed for new lead:', syncError.message);
      }
    } else if (shouldBypassSync) {
      console.log('🔓 GHL sync bypassed for testing (master admin bypass enabled)');
    }

    // Tag out-of-area large job leads in GHL
    if (lead.out_of_area_large_job && company.ghl_api_key && newLead.ghl_contact_id) {
      try {
        await applyStatusTags(newLead.ghl_contact_id, "Est out of area large job", company);
      } catch (tagErr) {
        console.error("❌ Failed to apply out-of-area tag:", tagErr.message);
      }
    }

    // Fire push notification for estimator_only companies
    if (company.plan_type === 'estimator_only') {
      try {
        const name = newLead.first_name || newLead.full_name || 'Someone';
        const project = formatProjectTypeForPush(newLead.project_type);
        const title = company.est_push_title || 'New Estimator Lead';
        const bodyTemplate = company.est_push_body || '{{name}} just submitted an estimator request for a {{project}} project. Click to open lead.';
        const body = bodyTemplate.replace('{{name}}', name).replace('{{project}}', project);
        sendPushToCompany(companyId, {
          type: 'new_estimator_lead',
          title,
          body,
          data: { type: 'new_estimator_lead', leadId: String(newLead.id) },
        }).catch((e) => console.error('Push send error:', e.message));
      } catch (pushErr) {
        console.error('Push build error:', pushErr.message);
      }
    }

    res.status(201).json({ lead: toCamel(newLead), ghlSynced });
  } catch (error) {
    console.error("💥 ERROR CREATING LEAD:");
    console.error("Message:", error.message);
    console.error("Stack:", error.stack);
    console.error("Detail:", error.detail);
    console.error("Code:", error.code);
    res.status(500).json({ error: "Failed to create lead." });
  }
});

// ============================================================================
// UPDATE LEAD
// ============================================================================
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const lead = req.body;

    console.log(`[PUT /leads/${id}] appointment_date received:`, lead.appointment_date, '| appointment_time:', lead.appointment_time);

    const prevResult = await pool.query(
      `SELECT * FROM leads WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (prevResult.rows.length === 0) {
      return res.status(404).json({ error: "Lead not found." });
    }

    const previousLead = prevResult.rows[0];
    const previousInstallTentative = previousLead.install_tentative;

    // Snap tentative install date to Monday of selected week
    if (lead.install_tentative && lead.install_date) {
      const d = new Date(lead.install_date + "T12:00:00");
      const day = d.getDay(); // 0=Sun, 1=Mon ... 6=Sat
      if (day !== 1) {
        const offsetDays = day === 0 ? 1 : -(day - 1);
        d.setDate(d.getDate() + offsetDays);
        lead.install_date = d.toISOString().split("T")[0];
      }
    }

    if (
      req.user.role !== "master" &&
      previousLead.company_id !== req.user.company_id
    ) {
      return res.status(403).json({ error: "Access denied to this lead." });
    }

    const { first, last, full } = parseName(lead.name || lead.full_name);

const result = await pool.query(
  `UPDATE leads SET
    name = COALESCE($1, name),
    full_name = COALESCE($2, full_name),
    first_name = COALESCE($3, first_name),
    last_name = COALESCE($4, last_name),
    phone = COALESCE($5, phone),
    email = $6,
    preferred_contact = $7,
    address = $8,
    city = $9,
    state = $10,
    zip = $11,
    buyer_type = $12,
    company_name = $13,
    project_type = $14,
    lead_source = $15,
    referral_source = $16,
    status = COALESCE($17, status),
    not_sold_reason = $18,
    notes = $19,
    contract_price = $20,
    appointment_date = $21,
    appointment_time = $22,
    install_date = $23,
    install_tentative = COALESCE($24, install_tentative),
    install_duration_days = COALESCE($25, install_duration_days),
    install_end_date = $26,
    pause_status = $27,
    pause_until = $28,
    resume_action = $29,
    pause_notes = $30,
    proceed_with_automation = COALESCE($31, proceed_with_automation),
    sold_at = CASE WHEN $17 = 'sold' AND sold_at IS NULL THEN CURRENT_TIMESTAMP ELSE sold_at END,
    appt_set_at = CASE WHEN $17 = 'appt_booked' AND appt_set_at IS NULL THEN CURRENT_TIMESTAMP ELSE appt_set_at END,

    -- 🔒 PRESERVE GHL EVENT IDS (DO NOT CLEAR HERE)
    appointment_calendar_event_id = appointment_calendar_event_id,
    install_calendar_event_id = install_calendar_event_id,

    updated_at = CURRENT_TIMESTAMP
  WHERE id = $32
  RETURNING *`,

      [
        full || null,
        full || null,
        first || null,
        last || null,
        clean(lead.phone),
        clean(lead.email),
        clean(lead.preferred_contact),
        clean(lead.address),
        clean(lead.city),
        clean(lead.state),
        clean(lead.zip),
        clean(lead.buyer_type),
        clean(lead.company_name),
        clean(lead.project_type),
        clean(lead.lead_source),
        clean(lead.referral_source),
        lead.status,
        clean(lead.not_sold_reason),
        clean(lead.notes),
        clean(lead.contract_price),
        clean(lead.appointment_date),
        clean(lead.appointment_time),
        clean(lead.install_date),
        lead.install_tentative,
        lead.install_duration_days || null,
        lead.install_end_date || null,
        clean(lead.pause_status),
        clean(lead.pause_until),
        clean(lead.resume_action),
        clean(lead.pause_notes),
        lead.proceed_with_automation ?? null,
        id,
      ]
    );

let updatedLead = result.rows[0];

// Record status change in event log (drives automation recovery report)
if (lead.status && lead.status !== previousLead.status) {
  pool.query(
    `INSERT INTO status_events (lead_id, company_id, from_status, to_status) VALUES ($1, $2, $3, $4)`,
    [updatedLead.id, updatedLead.company_id, previousLead.status, updatedLead.status]
  ).catch(e => console.error('[status_events insert]', e.message));
}

if (updatedLead.project_type) {
  await pool.query(
    `UPDATE estimator_leads
     SET project_type = $1
     WHERE lead_id = $2`,
    [updatedLead.project_type, updatedLead.id]
  );
}

    const company = (
      await pool.query(
        `SELECT * FROM companies WHERE id = $1`,
        [updatedLead.company_id]
      )
    ).rows[0];

let ghlSynced = false;
    let calendarConflict = null;
    if (company.ghl_api_key) {
      try {
await syncLeadToGhl({
  lead: updatedLead,
  previousLead,
  company,
  previousInstallTentative,
});
        ghlSynced = true;
      } catch (syncError) {
        console.log('GHL sync failed for updated lead:', syncError.message);
        if (syncError.calendarConflict) {
          calendarConflict = {
            type: syncError.calendarType,
            message: syncError.calendarType === 'install'
              ? 'Install date saved in CP but could not sync to GHL calendar. Check GHL calendar availability.'
              : 'Appointment saved in CP but could not sync to GHL calendar. Check GHL calendar availability.',
          };
        }
      }

      // Always re-fetch so response reflects current appointment_calendar_event_id
      // (GHL sync updates it in a separate DB query after the main UPDATE)
      const freshResult = await pool.query('SELECT * FROM leads WHERE id = $1', [updatedLead.id]);
      if (freshResult.rows.length > 0) updatedLead = freshResult.rows[0];

      // If unjunking: remove the junk tag from GHL
      if (previousLead.status === 'status_junk' && updatedLead.status !== 'status_junk' && updatedLead.ghl_contact_id) {
        try {
          await removeStatusTags(updatedLead.ghl_contact_id, 'status - junk', company);
        } catch (err) {
          console.error('Failed to remove GHL junk tag:', err.message);
        }
      }
    }

    res.json({ lead: toCamel(updatedLead), ghlSynced, calendarConflict });
  } catch (error) {
    console.error("Error updating lead:", error);
    res.status(500).json({ error: "Failed to update lead." });
  }
});

// ============================================================================
// DELETE LEAD
// ============================================================================
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT * FROM leads WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Lead not found." });
    }

    const lead = result.rows[0];

    if (
      req.user.role !== "master" &&
      lead.company_id !== req.user.company_id
    ) {
      return res.status(403).json({ error: "Access denied to this lead." });
    }

// mark deleted in JF
await pool.query(
  `UPDATE leads SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1`,
  [id]
);
if (lead.ghl_contact_id) {
  try {
    await deleteGhlContact(lead.ghl_contact_id, lead.company_id);
  } catch (err) {
    console.error("Failed to delete GHL contact:", err.message);
  }
}

res.json({
  message: "Lead deleted successfully. Deleting this contact removes them from all systems."
});



  } catch (error) {
    console.error("Error deleting lead:", error);
    res.status(500).json({ error: "Failed to delete lead." });
  }
});
// ============================================================================
// GET ESTIMATE FOR A LEAD
// ============================================================================
router.get("/estimator/:leadId", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM estimator_leads WHERE lead_id = $1 ORDER BY estimate_number ASC`,
      [req.params.leadId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "No estimate found" });
    }

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching estimate:", error);
    res.status(500).json({ error: "Failed to fetch estimate" });
  }
});

// ============================================================================
// POST SECOND ESTIMATE FOR A LEAD
// ============================================================================
router.post("/:id/second-estimate", async (req, res) => {
  try {
    const leadId = parseInt(req.params.id);
    const { project_type, condition, length_ft, width_ft, calculated_sf, existing_coating, selected_quality, display_price_min, display_price_max, all_price_ranges, minimum_job_applied } = req.body;

    // Load lead + company
    const leadResult = await pool.query(
      `SELECT l.*, c.ghl_api_key, c.ghl_location_id FROM leads l JOIN companies c ON l.company_id = c.id WHERE l.id = $1 AND l.deleted_at IS NULL`,
      [leadId]
    );
    if (leadResult.rows.length === 0) return res.status(404).json({ error: "Lead not found" });
    const lead = leadResult.rows[0];

    // Check there's already estimate #1 and no #2 yet
    const existing = await pool.query(
      `SELECT estimate_number FROM estimator_leads WHERE lead_id = $1 ORDER BY estimate_number ASC`,
      [leadId]
    );
    if (existing.rows.length === 0) return res.status(400).json({ error: "No first estimate found" });
    if (existing.rows.some(r => r.estimate_number === 2)) return res.status(400).json({ error: "Only 2 estimate requests are allowed, please contact us for more estimates" });

    const displayProjectType = length_ft && width_ft && project_type
      ? `${length_ft}' x ${width_ft}' ${project_type.charAt(0).toUpperCase() + project_type.slice(1)}`
      : project_type;

    await pool.query(
      `INSERT INTO estimator_leads (
        lead_id, company_id, estimate_number, project_type,
        length_ft, width_ft, calculated_sf,
        condition, existing_coating, selected_quality,
        display_price_min, display_price_max,
        all_price_ranges, minimum_job_applied
      ) VALUES ($1, $2, 2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        leadId, lead.company_id, displayProjectType,
        length_ft, width_ft, calculated_sf,
        condition, existing_coating || false, selected_quality,
        display_price_min, display_price_max,
        JSON.stringify(all_price_ranges), minimum_job_applied || false
      ]
    );

    // Apply GHL tag + custom fields for second estimate
    if (lead.ghl_api_key && lead.ghl_contact_id) {
      try {
        await applyStatusTags(lead.ghl_contact_id, "submitted_second_estimate", lead);
      } catch (ghlErr) {
        console.error("❌ GHL tag failed for second estimate:", ghlErr.message);
      }
      try {
        const conditionLabel = condition === "minor" ? "A Few Cracks" : condition === "major" ? "A Lot of Cracks" : "Good";
        const ranges = typeof all_price_ranges === "string" ? JSON.parse(all_price_ranges) : (all_price_ranges || {});
        const fmtRange = (r) => r ? (r.min === r.max ? `$${r.min.toLocaleString()}` : `$${r.min.toLocaleString()} – $${r.max.toLocaleString()}`) : "";
        await updateContactCustomFields(lead.ghl_contact_id, {
          est2_square_footage: calculated_sf ? String(calculated_sf) : "",
          est2_floor_condition: conditionLabel,
          est2_solid_price_range: fmtRange(ranges.solid),
          est2_flake_price_range: fmtRange(ranges.flake),
          est2_metallic_price_range: fmtRange(ranges.metallic),
          est2_custom_finish_range: fmtRange(ranges.custom),
        }, lead);
      } catch (fieldErr) {
        console.error("❌ GHL EST2 custom fields failed:", fieldErr.message);
      }
    }

    const allRows = await pool.query(
      `SELECT * FROM estimator_leads WHERE lead_id = $1 ORDER BY estimate_number ASC`,
      [leadId]
    );
    res.json({ success: true, estimates: allRows.rows });
  } catch (error) {
    console.error("Error saving second estimate:", error);
    res.status(500).json({ error: "Failed to save second estimate" });
  }
});
// ============================================================================
// GET CONVERSATIONS FOR A LEAD
// ============================================================================
router.get("/:id/conversations", authenticateToken, async (req, res) => {
  try {
    const leadId = req.params.id;
    const limit = parseInt(req.query.limit) || 10;
    
    // Get lead with company info
    const leadResult = await pool.query(
      `SELECT l.*, c.ghl_location_id, c.ghl_api_key 
       FROM leads l 
       JOIN companies c ON l.company_id = c.id 
       WHERE l.id = $1 AND l.deleted_at IS NULL`,
      [leadId]
    );
    
    if (leadResult.rows.length === 0) {
      return res.status(404).json({ error: "Lead not found" });
    }
    
    const lead = leadResult.rows[0];
    
    // Verify user has access
    if (req.user.role !== "master" && lead.company_id !== req.user.company_id) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    if (!lead.ghl_contact_id) {
      return res.json({ messages: [] });
    }
    
const { getConversationMessages } = require("../controllers/ghlAPI");
    const result = await getConversationMessages(lead.ghl_contact_id, lead, limit);

    res.json({
      messages: result.messages || result, // backwards compat if result is plain array
      conversationId: result.conversationId || null,
      contactId: lead.ghl_contact_id,
    });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

// ============================================================================
// REINSTATE DELETED LEAD (Master Admin Only)
// ============================================================================
router.post("/:id/reinstate", async (req, res) => {
  console.log("\n═══════════════════════════════════");
  console.log("🔄 POST /leads/:id/reinstate");
  console.log("═══════════════════════════════════\n");
  
  try {
    const leadId = req.params.id;
    
    // Verify user is master admin
    if (req.user.role !== "master") {
      return res.status(403).json({ error: "Only master admin can reinstate contacts" });
    }
    
    // Get the deleted lead
    const leadResult = await pool.query(
      `SELECT l.*, c.ghl_location_id, c.ghl_api_key
       FROM leads l
       JOIN companies c ON l.company_id = c.id
       WHERE l.id = $1 AND l.deleted_at IS NOT NULL`,
      [leadId]
    );
    
    if (leadResult.rows.length === 0) {
      return res.status(404).json({ error: "Deleted lead not found" });
    }
    
    const lead = leadResult.rows[0];
    
// Step 1: Try to restore in GHL if we have GHL ID and API key
    let ghlRestored = false;
    if (lead.ghl_contact_id && lead.ghl_api_key) {
      const { restoreGhlContact } = require("../controllers/ghlAPI");
      const company = {
        ghl_api_key: lead.ghl_api_key,
        ghl_location_id: lead.ghl_location_id
      };
      const result = await restoreGhlContact(lead.ghl_contact_id, company);
      if (result) {
        ghlRestored = true;
      } else {
        console.log("⚠️ Contact not found in GHL, clearing ghl_contact_id");
        // Clear invalid GHL ID so next sync creates new contact
        await pool.query(
          `UPDATE leads SET ghl_contact_id = NULL WHERE id = $1`,
          [leadId]
        );
      }
    }
    
    // Step 2: Remove deleted_at from database
    await pool.query(
      `UPDATE leads SET deleted_at = NULL WHERE id = $1`,
      [leadId]
    );
    
    console.log("✅ Lead reinstated:", leadId);
    const message = ghlRestored 
      ? "Contact reinstated successfully in JobFlow and GoHighLevel"
      : "Contact reinstated in JobFlow (will sync to GoHighLevel on next update)";
    res.json({ success: true, message });
    
  } catch (error) {
    console.error("❌ Reinstate error:", error);
    res.status(500).json({ error: "Failed to reinstate contact" });
  }
});

// ============================================================================
// ACCEPT OUT-OF-AREA LARGE JOB
// ============================================================================
router.put("/:id/accept-out-of-area", async (req, res) => {
  try {
    const { id } = req.params;
    const leadResult = await pool.query(
      `SELECT * FROM leads WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [id]
    );
    if (leadResult.rows.length === 0) return res.status(404).json({ error: "Lead not found." });
    const lead = leadResult.rows[0];

    await pool.query(
      `UPDATE leads SET out_of_area_large_job = false, updated_at = NOW() WHERE id = $1`,
      [id]
    );

    // Remove the out-of-area tag in GHL
    const company = (await pool.query(`SELECT * FROM companies WHERE id = $1`, [lead.company_id])).rows[0];
    if (company?.ghl_api_key && lead.ghl_contact_id) {
      try {
        await removeStatusTags(lead.ghl_contact_id, "Est out of area large job", company);
      } catch (tagErr) {
        console.error("❌ Failed to remove out-of-area tag:", tagErr.message);
      }
    }

    const updated = (await pool.query(`SELECT * FROM leads WHERE id = $1`, [id])).rows[0];
    res.json({ success: true, lead: toCamel(updated) });
  } catch (error) {
    console.error("❌ Accept out-of-area error:", error);
    res.status(500).json({ error: "Failed to accept out-of-area lead." });
  }
});

module.exports = router;