// File: backend/routes/leads.js - fully corrected parameter order

const express = require("express");
const router = express.Router();
const pool = require("../config/database");

const clean = (v) => (v === "" || v === " " || v === undefined ? null : v);

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
  if (parts.length === 1) return { first: parts[0], last: "", full: parts[0] };
  return { first: parts[0], last: parts.slice(1).join(" "), full };
}

const validateLead = (lead) => {
  if (!lead.name) return "Name is required.";
  if (!lead.phone) return "Phone is required.";
  return null;
};

// ============================================================================
// UPDATE LEAD — FIXED PARAMETER COUNT
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

module.exports = router;
