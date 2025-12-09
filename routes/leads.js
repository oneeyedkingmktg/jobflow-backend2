// ============================================================================
// Leads Routes - Full DB Integration (Name Parsing + All Fields Mapped)
// ============================================================================

const express = require("express");
const router = express.Router();
const pool = require("../config/database");

// Convert DB row → frontend camelCase
const toCamel = (row) => ({
  id: row.id,
  companyId: row.company_id,
  createdByUserId: row.created_by_user_id,

  // names
  name: row.name,
  fullName: row.full_name,
  firstName: row.first_name,
  lastName: row.last_name,

  // contact
  phone: row.phone,
  email: row.email,
  preferredContact: row.preferred_contact,

  // address
  address: row.address,
  city: row.city,
  state: row.state,
  zip: row.zip,

  // business
  buyerType: row.buyer_type,
  companyName: row.company_name,
  projectType: row.project_type,

  // lead sources
  leadSource: row.lead_source,
  referralSource: row.referral_source,

  status: row.status,
  notSoldReason: row.not_sold_reason,
  notes: row.notes,
  contractPrice: row.contract_price,

  // dates
  apptDate: row.appointment_date,
  apptTime: row.appointment_time,
  installDate: row.install_date,
  installTentative: row.install_tentative,

  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// Parse full name
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

// Required fields
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
    const result = await pool.query(`SELECT * FROM leads ORDER BY created_at DESC`);
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
    const result = await pool.query(`SELECT * FROM leads WHERE id = $1`, [
      req.params.id,
    ]);

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
    if (validationError) return res.status(400).json({ error: validationError });

    // name parsing
    const parsed = parseName(data.name);

    const result = await pool.query(
      `
      INSERT INTO leads (
        name, full_name, first_name, last_name,
        phone, email, address, city, state, zip,
        buyer_type, company_name, project_type,
        lead_source, referral_source,
        status, not_sold_reason, contract_price,
        appointment_date, appointment_time,
        preferred_contact, notes,
        install_date, install_tentative,
        created_at, updated_at
      )
      VALUES (
        $1,$2,$3,$4,
        $5,$6,$7,$8,$9,$10,
        $11,$12,$13,
        $14,$15,
        $16,$17,$18,
        $19,$20,
        $21,$22,
        $23,$24,
        NOW(),NOW()
      )
      RETURNING *
      `,
      [
        data.name,
        parsed.full,
        parsed.first,
        parsed.last,

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
        data.appointment_time,

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
    if (validationError) return res.status(400).json({ error: validationError });

    const parsed = parseName(data.name);

    const result = await pool.query(
      `
      UPDATE leads
      SET
        name = $1,
        full_name = $2,
        first_name = $3,
        last_name = $4,
        phone = $5,
        email = $6,
        address = $7,
        city = $8,
        state = $9,
        zip = $10,
        buyer_type = $11,
        company_name = $12,
        project_type = $13,
        lead_source = $14,
        referral_source = $15,
        status = $16,
        not_sold_reason = $17,
        contract_price = $18,
        appointment_date = $19,
        appointment_time = $20,
        preferred_contact = $21,
        notes = $22,
        install_date = $23,
        install_tentative = $24,
        updated_at = NOW()
      WHERE id = $25
      RETURNING *
      `,
      [
        data.name,
        parsed.full,
        parsed.first,
        parsed.last,

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
        data.appointment_time,

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
