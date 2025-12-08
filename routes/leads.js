// ============================================================================
// Leads Routes - Full DB Integration (No GHL, No MailerLite)
// ============================================================================

const express = require("express");
const router = express.Router();
const pool = require("../config/database");

// Convert DB row (snake_case) → API response (camelCase)
const toCamel = (row) => ({
  id: row.id,
  companyId: row.company_id,
  createdByUserId: row.created_by_user_id,
  name: row.name,
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
  status: row.status,
  notSoldReason: row.not_sold_reason,
  contractPrice: row.contract_price,
  appointmentDate: row.appointment_date,
  preferredContact: row.preferred_contact,
  notes: row.notes,
  installDate: row.install_date,
  installTentative: row.install_tentative,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// Validate required fields
const validateLead = (lead) => {
  if (!lead.name) return "Name is required.";
  if (!lead.phone) return "Phone is required.";
  return null;
};

// ============================================================================
// GET ALL LEADS
// ============================================================================
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM leads ORDER BY created_at DESC`
    );
    res.json({ leads: result.rows.map(toCamel) });
  } catch (error) {
    console.error("Error fetching leads:", error);
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
    console.error("Error fetching lead:", error);
    res.status(500).json({ error: "Failed to fetch lead." });
  }
});

// ============================================================================
// CREATE LEAD
// ============================================================================
router.post("/", async (req, res) => {
  try {
    const data = req.body;

    const validationError = validateLead(data);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const result = await pool.query(
      `
      INSERT INTO leads (
        name, phone, email, address, city, state, zip,
        buyer_type, company_name, project_type, lead_source,
        referral_source, status, not_sold_reason, contract_price,
        appointment_date, preferred_contact, notes,
        install_date, install_tentative
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11,
        $12, $13, $14, $15,
        $16, $17, $18,
        $19, $20
      )
      RETURNING *
      `,
      [
        data.name,
        data.phone,
        data.email,
        data.address,
        data.city,
        data.state,
        data.zip,
        data.buyer_type,
        data.company_name,
        data.project_type,
        data.lead_source,
        data.referral_source,
        data.status,
        data.not_sold_reason,
        data.contract_price,
        data.appointment_date,
        data.preferred_contact,
        data.notes,
        data.install_date,
        data.install_tentative,
      ]
    );

    res.json({ lead: toCamel(result.rows[0]) });
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
    const data = req.body;
    const id = req.params.id;

    const validationError = validateLead(data);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const result = await pool.query(
      `
      UPDATE leads
      SET
        name = $1,
        phone = $2,
        email = $3,
        address = $4,
        city = $5,
        state = $6,
        zip = $7,
        buyer_type = $8,
        company_name = $9,
        project_type = $10,
        lead_source = $11,
        referral_source = $12,
        status = $13,
        not_sold_reason = $14,
        contract_price = $15,
        appointment_date = $16,
        preferred_contact = $17,
        notes = $18,
        install_date = $19,
        install_tentative = $20,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $21
      RETURNING *
      `,
      [
        data.name,
        data.phone,
        data.email,
        data.address,
        data.city,
        data.state,
        data.zip,
        data.buyer_type,
        data.company_name,
        data.project_type,
        data.lead_source,
        data.referral_source,
        data.status,
        data.not_sold_reason,
        data.contract_price,
        data.appointment_date,
        data.preferred_contact,
        data.notes,
        data.install_date,
        data.install_tentative,
        id,
      ]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ error: "Lead not found" });

    res.json({ lead: toCamel(result.rows[0]) });
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
    const result = await pool.query(
      `DELETE FROM leads WHERE id = $1 RETURNING id`,
      [req.params.id]
    );

    if (result.rowCount === 0)
      return res.status(404).json({ error: "Lead not found" });

    res.json({ success: true, deletedId: req.params.id });
  } catch (error) {
    console.error("Error deleting lead:", error);
    res.status(500).json({ error: "Failed to delete lead." });
  }
});

module.exports = router;
