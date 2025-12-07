// db/leads.js
// Uses PostgreSQL via config/database.js

const pool = require("../config/database");

// Helper
function buildFullName(first, last) {
  const f = (first || "").trim();
  const l = (last || "").trim();
  if (!f && !l) return "";
  return `${f} ${l}`.trim();
}

// Get all leads
async function getAllLeads() {
  const result = await pool.query(
    `SELECT
        id,
        ghl_contact_id AS "ghlContactId",
        first_name AS "firstName",
        last_name AS "lastName",
        full_name AS "fullName",
        phone,
        email,
        status,
        source,
        note,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
     FROM leads
     ORDER BY created_at DESC`
  );
  return result.rows;
}

// Upsert from GHL webhook
async function upsertLeadFromGhl(payload) {
  const {
    ghlContactId,
    firstName,
    lastName,
    phone,
    email,
    status,
    source,
    note
  } = payload;

  const fullName = buildFullName(firstName, lastName);
  const effectiveStatus = status || "Lead";

  // Try: match by ghlContactId
  let existing = null;
  if (ghlContactId) {
    const res = await pool.query(
      `SELECT * FROM leads WHERE ghl_contact_id = $1`,
      [ghlContactId]
    );
    existing = res.rows[0] || null;
  }

  // Try: match by phone+email if no GHL ID match
  if (!existing && phone && email) {
    const res = await pool.query(
      `SELECT * FROM leads WHERE phone = $1 AND email = $2`,
      [phone, email]
    );
    existing = res.rows[0] || null;
  }

  // UPDATE
  if (existing) {
    const res = await pool.query(
      `UPDATE leads
       SET
         ghl_contact_id = COALESCE($1, ghl_contact_id),
         first_name    = COALESCE($2, first_name),
         last_name     = COALESCE($3, last_name),
         full_name     = COALESCE($4, full_name),
         phone         = COALESCE($5, phone),
         email         = COALESCE($6, email),
         status        = COALESCE($7, status),
         source        = COALESCE($8, source),
         note          = COALESCE($9, note),
         updated_at    = NOW()
       WHERE id = $10
       RETURNING
         id,
         ghl_contact_id AS "ghlContactId",
         first_name AS "firstName",
         last_name AS "lastName",
         full_name AS "fullName",
         phone,
         email,
         status,
         source,
         note,
         created_at AS "createdAt",
         updated_at AS "updatedAt"
      `,
      [
        ghlContactId,
        firstName,
        lastName,
        fullName,
        phone,
        email,
        effectiveStatus,
        source,
        note,
        existing.id
      ]
    );

    return res.rows[0];
  }

  // INSERT
  const res = await pool.query(
    `INSERT INTO leads (
        ghl_contact_id,
        first_name,
        last_name,
        full_name,
        phone,
        email,
        status,
        source,
        note,
        created_at,
        updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())
     RETURNING
       id,
       ghl_contact_id AS "ghlContactId",
       first_name AS "firstName",
       last_name AS "lastName",
       full_name AS "fullName",
       phone,
       email,
       status,
       source,
       note,
       created_at AS "createdAt",
       updated_at AS "updatedAt"
    `,
    [
      ghlContactId || null,
      firstName || null,
      lastName || null,
      fullName || "",
      phone || null,
      email || null,
      effectiveStatus,
      source || "GHL",
      note || null
    ]
  );

  return res.rows[0];
}

module.exports = {
  getAllLeads,
  upsertLeadFromGhl
};
