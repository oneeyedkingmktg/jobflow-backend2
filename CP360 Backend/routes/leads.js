// ============================================================================
// File: routes/leads.js
// Version: v1.6.1 - FIXED: GET route uses query params + saves estimates
// ============================================================================

const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const { authenticateToken } = require("../middleware/auth");
const { syncLeadToGhl, deleteGhlContact } = require("../sync/dbToGhlSync");

// NEW: GHL sync





// Apply authentication to all routes
// Allow public estimator POSTs, protect everything else
router.use((req, res, next) => {
  if (req.method === "POST" && req.path === "/") {
    return next(); // public estimator lead submit
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
  installDate: row.install_date,
  installTentative: row.install_tentative,

  createdAt: row.created_at,
  updatedAt: row.updated_at,

  hasEstimate: row.has_estimate === true,
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

    console.log("✅ Company ID from query:", companyId);

    if (!companyId) {
      console.log("❌ Missing company_id in query");
      return res.status(400).json({ error: "company_id required" });
    }

const result = await pool.query(
  `
  SELECT
    l.*,
    c.timezone AS timezone
  FROM leads l
  JOIN companies c ON c.id = l.company_id
  WHERE l.company_id = $1
    AND l.deleted_at IS NULL
    AND l.status != 'status_junk'
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
    const companyId = req.body.company_id;

    console.log("✅ Company ID:", companyId);
    console.log("✅ User ID:", userId);

    if (!companyId) {
      console.log("❌ Missing company_id");
      return res.status(400).json({ error: "company_id required" });
    }

    const lead = req.body;
    const estimate = req.body.estimate;
    let displayProjectType = null;

    const error = validateLead(lead);
    if (error) {
      console.log("❌ Validation failed:", error);
      return res.status(400).json({ error });
    }

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
        install_date, install_tentative
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
        $14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26
      )
      RETURNING *`,
      insertValues
    );

    const newLead = result.rows[0];
    if (displayProjectType) {
      await pool.query(
        `UPDATE leads SET project_type = $1 WHERE id = $2`,
        [displayProjectType, newLead.id]
      );
    }

    console.log("✅ LEAD INSERT SUCCESSFUL - Lead ID:", newLead.id);

    // 🆕 SAVE ESTIMATE DATA if provided
    if (estimate) {
      console.log("💰 Saving estimate data for lead:", newLead.id);
      console.log("📊 Estimate data:", estimate);

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
    } else {
      console.log("ℹ️  No estimate data provided (non-estimator lead)");
    }

    const company = (
      await pool.query(`SELECT * FROM companies WHERE id = $1`, [companyId])
    ).rows[0];

    // 🆕 CHECK IF USER HAS BYPASS FLAG
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

    const prevResult = await pool.query(
      `SELECT * FROM leads WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (prevResult.rows.length === 0) {
      return res.status(404).json({ error: "Lead not found." });
    }

    const previousLead = prevResult.rows[0];
    const previousInstallTentative = previousLead.install_tentative;

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

    -- 🔒 PRESERVE GHL EVENT IDS (DO NOT CLEAR HERE)
    appointment_calendar_event_id = appointment_calendar_event_id,
    install_calendar_event_id = install_calendar_event_id,

    updated_at = CURRENT_TIMESTAMP
  WHERE id = $25
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
        id,
      ]
    );

const updatedLead = result.rows[0];

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
      }
    }

    res.json({ lead: toCamel(updatedLead), ghlSynced });
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

// 🔥 ALSO DELETE FROM GHL
if (lead.ghl_contact_id) {
  try {
    await deleteGhlContact(lead.ghl_contact_id, lead.company_id);
  } catch (err) {
    console.error("Failed to delete GHL contact:", err.message);
  }
}

res.json({ message: "Lead deleted successfully." });



// ALSO delete in GHL if contact exists
if (lead.ghl_contact_id) {
  try {
    const { deleteGhlContact } = require("../controllers/ghlAPI");
    await deleteGhlContact(lead.ghl_contact_id, lead.company_id);
  } catch (err) {
    console.error("GHL contact delete failed:", err.message);
  }
}


    if (lead.ghl_contact_id) {
  await deleteGHLContact(lead.ghl_contact_id, lead.company_id);
}


    // DELETE CONTACT IN GHL IF IT EXISTS
if (lead.ghl_contact_id) {
  try {
    await deleteGHLContact(lead.ghl_contact_id, lead.company_id);
  } catch (err) {
    console.error("Failed to delete GHL contact:", err.message);
  }
}


res.json({ message: "Lead deleted successfully. Deleting this contact removes them from all systems." });

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
      `SELECT * FROM estimator_leads WHERE lead_id = $1`,
      [req.params.leadId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "No estimate found" });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching estimate:", error);
    res.status(500).json({ error: "Failed to fetch estimate" });
  }
});
module.exports = router;