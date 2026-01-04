// ============================================================================
// File: routes/leads.js
// Version: v1.5.0
// Change:
// - ADD missing GET /leads route (company-scoped)
// ============================================================================

const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const { authenticateToken } = require("../middleware/auth");

// NEW: GHL sync
const { syncLeadToGhl } = require("../sync/dbToGhlSync");

// Apply authentication to all routes
router.use(authenticateToken);

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
  if (!lead.name) return "Name is required.";
  if (!lead.phone) return "Phone is required.";
  return null;
};

// ============================================================================
// GET LEADS  ✅ (MISSING BEFORE)
// ============================================================================
router.get("/", async (req, res) => {
  try {
    const companyId =
      req.user.role === "master"
        ? req.query.company_id || req.user.company_id
        : req.user.company_id;

    const result = await pool.query(
      `SELECT *
       FROM leads
       WHERE company_id = $1
         AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [companyId]
    );

    res.json({
      leads: result.rows.map(toCamel),
    });
  } catch (error) {
    console.error("Error loading leads:", error);
    res.status(500).json({ error: "Failed to load leads." });
  }
});

// ============================================================================
// CREATE LEAD
// ============================================================================
router.post("/", async (req, res) => {
  try {
    const userId = req.user.id;

    const companyId =
      req.user.role === "master"
        ? req.body.company_id || req.user.company_id
        : req.user.company_id;

    const lead = req.body;
    const error = validateLead(lead);
    if (error) return res.status(400).json({ error });

    const { first, last, full } = parseName(lead.name || lead.full_name);

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
      [
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
        clean(lead.lead_source),
        clean(lead.referral_source),
        lead.status || "lead",
        clean(lead.not_sold_reason),
        clean(lead.notes),
        clean(lead.contract_price),
        clean(lead.appointment_date),
        clean(lead.appointment_time),
        clean(lead.install_date),
        lead.install_tentative || false,
      ]
    );

    const newLead = result.rows[0];

    const company = (
      await pool.query(`SELECT * FROM companies WHERE id = $1`, [companyId])
    ).rows[0];

    await syncLeadToGhl({ lead: newLead, company });

    res.status(201).json({ lead: toCamel(newLead) });
  } catch (error) {
    console.error("Error creating lead:", error);
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

    const company = (
      await pool.query(
        `SELECT * FROM companies WHERE id = $1`,
        [updatedLead.company_id]
      )
    ).rows[0];

    await syncLeadToGhl({
      lead: updatedLead,
      previousLead,
      company,
    });

    res.json({ lead: toCamel(updatedLead) });
  } catch (error) {
    console.error("Error updating lead:", error);
    res.status(500).json({ error: "Failed to update lead." });
  }
});

module.exports = router;
