// db/leads.js
// Full CRUD-access layer for all lead fields

const pool = require("../config/database");

// Convert DB → camelCase for API
function mapLead(row) {
  if (!row) return null;

  return {
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

    appointmentDate: row.appointment_date,
    appointmentTime: row.appointment_time,
    installDate: row.install_date,
    installTentative: row.install_tentative,

    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ===============================
// GET ALL LEADS
// ===============================
async function getAllLeads() {
  const result = await pool.query(`
    SELECT
      id,
      company_id,
      created_by_user_id,

      name,
      first_name,
      last_name,
      full_name,

      phone,
      email,
      address,
      city,
      state,
      zip,

      buyer_type,
      company_name,
      project_type,

      lead_source,
      referral_source,

      preferred_contact,
      notes,

      status,
      not_sold_reason,
      contract_price,

      appointment_date,
      appointment_time,
      install_date,
      install_tentative,

      created_at,
      updated_at
    FROM leads
    ORDER BY created_at DESC
  `);

  return result.rows.map(mapLead);
}

// ===============================
// GET ONE LEAD
// ===============================
async function getLead(id) {
  const result = await pool.query(
    `
    SELECT * FROM leads WHERE id = $1
    `,
    [id]
  );

  return mapLead(result.rows[0]);
}

// ===============================
// CREATE LEAD
// ===============================
async function createLead(data) {
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
    RETURNING *;
  `,
    [
      data.name,
      data.first_name,
      data.last_name,
      data.full_name,

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

      data.preferred_contact,
      data.notes,

      data.status,
      data.not_sold_reason,
      data.contract_price,

      data.appointment_date,
      data.appointment_time,

      data.install_date,
      data.install_tentative,
    ]
  );

  return mapLead(result.rows[0]);
}

// ===============================
// UPDATE LEAD
// ===============================
async function updateLead(id, data) {
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
    WHERE id = $25
    RETURNING *;
  `,
    [
      data.name,
      data.first_name,
      data.last_name,
      data.full_name,

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

      data.preferred_contact,
      data.notes,

      data.status,
      data.not_sold_reason,
      data.contract_price,

      data.appointment_date,
      data.appointment_time,
      data.install_date,
      data.install_tentative,

      id,
    ]
  );

  return mapLead(result.rows[0]);
}

// ===============================
// DELETE LEAD
// ===============================
async function deleteLead(id) {
  await pool.query(`DELETE FROM leads WHERE id=$1`, [id]);
  return true;
}

module.exports = {
  getAllLeads,
  getLead,
  createLead,
  updateLead,
  deleteLead,
};
