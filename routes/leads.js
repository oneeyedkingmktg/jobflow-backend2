// File: backend/routes/leads.js

const express = require("express");
const router = express.Router();
const pool = require("../config/database");

const clean = (v) => (v === "" || v === undefined ? null : v);
const fallbackCompany = (v) => (v ? v : 1);

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

// GET ALL
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

// GET ONE
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

// CREATE
router.post("/", async (req, res) => {
  try {
    const data = req.body;
    const validationError = validateLead(data);
    if (validationError) return res.status(400).json({ error: validationError });

    const parsed = parseName(data.name);
    const companyId = fallbackCompany(data.company_id);

    const result = await pool.query(
      `
      INSERT INTO leads (
        company_id, created_by_user_id,
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
        $1, $2,
        $3,$4,$5,$6,
        $7,$8,$9,$10,$11,$12,
        $13,$14,$15,
        $16,$17,
        $18,$19,$20,
        $21,$22,
        $23,$24,
        $25,$26,
        NOW(),NOW()
      )
      RETURNING *
      `,
      [
        companyId,
        data.created_by_user_id || 1,

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
        clean(data.contract_price),

        clean(data.appointment_date),
        clean(data.appointment_time),

        data.preferred_contact,
        data.notes,

        clean(data.install_date),
        data.install_tentative,
      ]
    );

    res.json({ lead: toCamel(result.rows[0]) });
  } catch (error) {
    console.error("Error creating lead:", error);
    res.status(500).json({ error: "Failed to create lead." });
  }
});

// UPDATE
router.put("/:id", async (req, res) => {
  try {
    const data = req.body;
    const id = req.params.id;

    const validationError = validateLead(data);
    if (validationError) return res.status(400).json({ error: validationError });

    const parsed = parseName(data.name);
    const companyId = fallbackCompany(data.company_id);

    const result = await pool.query(
      `
      UPDATE leads
      SET
        company_id = $1,
        name = $2,
        full_name = $3,
        first_name = $4,
        last_name = $5,
        phone = $6,
        email = $7,
        address = $8,
        city = $9,
        state = $10,
        zip = $11,
        buyer_type = $12,
        company_name = $13,
        project_type = $14,
        lead_source = $15,
        referral_source = $16,
        status = $17,
        not_sold_reason = $18,
        contract_price = $19,
        appointment_date = $20,
        appointment_time = $21,
        preferred_contact = $22,
        notes = $23,
        install_date = $24,
        install_tentative = $25,
        updated_at = NOW()
      WHERE id = $26
      RETURNING *
      `,
      [
        companyId,

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
        clean(data.contract_price),

        clean(data.appointment_date),
        clean(data.appointment_time),

        data.preferred_contact,
        data.notes,

        clean(data.install_date),
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

// DELETE
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
