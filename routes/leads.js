// ============================================================================
// Leads Routes - FULL camelCase ↔ snake_case MAPPING
// Matches your frontend exactly
// ============================================================================

const express = require("express");
const router = express.Router();
const pool = require("../config/database");

// Convert DB snake_case → camelCase
const toCamel = (row) => ({
  id: row.id,
  companyId: row.company_id,
  createdByUserId: row.created_by_user_id,

  name: row.full_name || row.name || "",
  firstName: row.first_name,
  lastName: row.last_name,
  fullName: row.full_name,

  phone: row.phone,
  email: row.email,

  address: row.address,
  city: row.city,
  state: row.state,
  zip: row.zip,

  buyerType: row.buyer_type,
  companyName: row.company_name,
  projectType: row.project_type,

  leadSource: row.lead_source,
  referralSource: row.referral_source,

  preferredContact: row.preferred_contact,
  notes: row.notes,

  status: row.status,
  notSoldReason: row.not_sold_reason,
  contractPrice: row.contract_price,

  apptDate: row.appointment_date,
  apptTime: row.appointment_time,

  installDate: row.install_date,
  installTentative: row.install_tentative,

  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// Convert camelCase → DB snake_case
const toSnake = (data) => ({
  name: data.name || "",
  first_name: data.firstName || "",
  last_name: data.lastName || "",
  full_name: data.name || "",

  phone: data.phone || "",
  email: data.email || "",

  address: data.address || "",
  city: data.city || "",
  state: data.state || "",
  zip: data.zip || "",

  buyer_type: data.buyerType || "",
  company_name: data.companyName || "",
  project_type: data.projectType || "",

  lead_source: data.leadSource || "",
  referral_source: data.referralSource || "",

  preferred_contact: data.preferredContact || "",
  notes: data.notes || "",

  status: data.status || "lead",
  not_sold_reason: data.notSoldReason || "",
  contract_price: data.contractPrice || null,

  appointment_date: data.apptDate || null,
  appointment_time: data.apptTime || null,

  install_date: data.installDate || null,
  install_tentative: data.installTentative || false,
});

// Required fields
const validateLead = (lead) => {
  if (!lead.name || lead.name.trim() === "") return "Name is required.";
  return null;
};

// ============================================================================
// GET ALL LEADS
// ============================================================================
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM leads ORDER BY created_at DESC
    `);
    res.json({ leads: result.rows.map(toCamel) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch leads." });
  }
});

// ============================================================================
// GET SINGLE LEAD
// ============================================================================
router.get("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM leads WHERE id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ error: "Lead not found" });

    res.json({ lead: toCamel(result.rows[0]) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch lead." });
  }
});

// ============================================================================
// CREATE LEAD
// ============================================================================
router.post("/", async (req, res) => {
  try {
    const validationError = validateLead(req.body);
    if (validationError) return res.status(400).json({ error: validationError });

    const d = toSnake(req.body);

    const result = await pool.query(
      `
      INSERT INTO leads (
        name, first_name, last_name, full_name,
        phone, email, address, city, state, zip,
        buyer_type, company_name, project_type,
        lead_source, referral_source,
        preferred_contact, notes,
        status, not_sold_reason, contract_price,
        appointment_date, appointment_time,
        install_date, install_tentative,
        created_at, updated_at
      )
      VALUES (
        $1,$2,$3,$4,
        $5,$6,$7,$8,$9,$10,
        $11,$12,$13,
        $14,$15,
        $16,$17,
        $18,$19,$20,
        $21,$22,
        $23,$24,
        NOW(), NOW()
      )
      RETURNING *
      `,
      [
        d.name, d.first_name, d.last_name, d.full_name,

        d.phone, d.email, d.address, d.city, d.state, d.zip,

        d.buyer_type, d.company_name, d.project_type,

        d.lead_source, d.referral_source,

        d.preferred_contact, d.notes,

        d.status, d.not_sold_reason, d.contract_price,

        d.appointment_date, d.appointment_time,

        d.install_date, d.install_tentative,
      ]
    );

    res.json({ lead: toCamel(result.rows[0]) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create lead." });
  }
});

// ============================================================================
// UPDATE LEAD
// ============================================================================
router.put("/:id", async (req, res) => {
  try {
    const validationError = validateLead(req.body);
    if (validationError) return res.status(400).json({ error: validationError });

    const d = toSnake(req.body);

    const result = await pool.query(
      `
      UPDATE leads SET
        name=$1, first_name=$2, last_name=$3, full_name=$4,
        phone=$5, email=$6, address=$7, city=$8, state=$9, zip=$10,
        buyer_type=$11, company_name=$12, project_type=$13,
        lead_source=$14, referral_source=$15,
        preferred_contact=$16, notes=$17,
        status=$18, not_sold_reason=$19, contract_price=$20,
        appointment_date=$21, appointment_time=$22,
        install_date=$23, install_tentative=$24,
        updated_at = NOW()
      WHERE id=$25
      RETURNING *
      `,
      [
        d.name, d.first_name, d.last_name, d.full_name,

        d.phone, d.email, d.address, d.city, d.state, d.zip,

        d.buyer_type, d.company_name, d.project_type,

        d.lead_source, d.referral_source,

        d.preferred_contact, d.notes,

        d.status, d.not_sold_reason, d.contract_price,

        d.appointment_date, d.appointment_time,

        d.install_date, d.install_tentative,

        req.params.id,
      ]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ error: "Lead not found" });

    res.json({ lead: toCamel(result.rows[0]) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update lead." });
  }
});

// ============================================================================
// DELETE LEAD
// ============================================================================
router.delete("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM leads WHERE id=$1 RETURNING id`,
      [req.params.id]
    );

    if (result.rowCount === 0)
      return res.status(404).json({ error: "Lead not found" });

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete lead." });
  }
});

module.exports = router;
