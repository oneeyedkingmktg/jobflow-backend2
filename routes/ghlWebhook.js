// ============================================================================
// GHL Webhook Receiver - Contact Upsert
// ============================================================================
const express = require("express");
const router = express.Router();
const db = require("../config/database");

// Normalize phone to digits only for matching
function normalizePhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, "");
  return digits || null;
}

// Find existing lead for this company by GHL contact id, phone, or email
async function findExistingLead(companyId, ghlContactId, phone, email) {
  // 1) Match by GHL contact id
  if (ghlContactId) {
    const byGhl = await db.query(
      `SELECT * FROM leads WHERE company_id = $1 AND ghl_contact_id = $2 LIMIT 1`,
      [companyId, ghlContactId]
    );
    if (byGhl.rows.length > 0) return byGhl.rows[0];
  }

  // 2) Match by phone
  if (phone) {
    const normalized = normalizePhone(phone);
    const byPhone = await db.query(
      `SELECT * FROM leads WHERE company_id = $1 AND regexp_replace(phone, '\\D', '', 'g') = $2 LIMIT 1`,
      [companyId, normalized]
    );
    if (byPhone.rows.length > 0) return byPhone.rows[0];
  }

  // 3) Match by email
  if (email) {
    const byEmail = await db.query(
      `SELECT * FROM leads WHERE company_id = $1 AND lower(email) = lower($2) LIMIT 1`,
      [companyId, email]
    );
    if (byEmail.rows.length > 0) return byEmail.rows[0];
  }

  return null;
}

// Safely build update statement that only fills missing fields
async function updateLeadIfNeeded(existing, updates) {
  const fields = [];
  const values = [];
  let idx = 1;

  const pushIfNew = (column, newVal) => {
    if (newVal === undefined || newVal === null || newVal === "") return;
    const currentVal = existing[column];
    if (currentVal !== null && currentVal !== "" && currentVal !== undefined) return;
    fields.push(`${column} = $${idx}`);
    values.push(newVal);
    idx++;
  };

  pushIfNew("name", updates.name);
  pushIfNew("phone", updates.phone);
  pushIfNew("email", updates.email);
  pushIfNew("address", updates.address);
  pushIfNew("city", updates.city);
  pushIfNew("state", updates.state);
  pushIfNew("zip", updates.zip);
  pushIfNew("buyer_type", updates.buyer_type);
  pushIfNew("company_name", updates.company_name);
  pushIfNew("project_type", updates.project_type);
  pushIfNew("lead_source", updates.lead_source);
  pushIfNew("preferred_contact", updates.preferred_contact);
  pushIfNew("notes", updates.notes);
  pushIfNew("ghl_contact_id", updates.ghl_contact_id);

  // Always update sync fields when webhook hits
  fields.push(`ghl_last_synced = NOW()`);
  fields.push(`ghl_sync_status = 'webhook'`);
  fields.push(`needs_sync = false`);
  fields.push(`updated_at = NOW()`);

  if (fields.length === 0) {
    return existing;
  }

  const sql = `
    UPDATE leads
    SET ${fields.join(", ")}
    WHERE id = $${idx}
    RETURNING *;
  `;

  values.push(existing.id);

  const result = await db.query(sql, values);
  return result.rows[0];
}

// Main webhook handler
router.post("/:companyId", async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId, 10);

    if (!companyId || Number.isNaN(companyId)) {
      console.error("Webhook missing/invalid companyId param");
      return res.status(400).json({ error: "Invalid companyId in URL" });
    }

    // GHL can send various payload shapes; be defensive:
    const body = req.body || {};
    const contact =
      body.contact ||
      (body.payload && body.payload.contact) ||
      body;

    if (!contact || typeof contact !== "object") {
      console.error("Webhook payload has no contact object:", body);
      return res.status(200).json({ received: true, skipped: "no_contact" });
    }

    const ghlContactId = contact.id || contact.contactId || null;

    const firstName = contact.firstName || "";
    const lastName = contact.lastName || "";
    const fullName =
      contact.name ||
      `${firstName} ${lastName}`.trim() ||
      "Unknown";

    const phoneRaw = contact.phone || contact.phoneNumber || null;
    const phone = phoneRaw || null;

    const email = contact.email || null;

    const address =
      contact.address1 ||
      contact.address ||
      contact.street ||
      null;

    const city = contact.city || null;
    const state = contact.state || contact.province || null;
    const zip = contact.postalCode || contact.zip || null;

    const leadSource =
      contact.source ||
      (Array.isArray(contact.tags) && contact.tags.join(", ")) ||
      "GHL Webhook";

    const notes =
      contact.notes ||
      contact.additionalInfo ||
      null;

    const preferredContact = email ? "Email" : phone ? "Phone" : null;

    const status = "lead";

    const upsertPayload = {
      company_id: companyId,
      name: fullName,
      phone,
      email,
      address,
      city,
      state,
      zip,
      buyer_type: null,
      company_name: null,
      project_type: null,
      lead_source: leadSource,
      status,
      not_sold_reason: null,
      contract_price: null,
      appointment_date: null,
      preferred_contact: preferredContact,
      notes,
      ghl_contact_id: ghlContactId,
    };

    const existing = await findExistingLead(
      companyId,
      ghlContactId,
      phone,
      email
    );

    let saved;

    if (existing) {
      saved = await updateLeadIfNeeded(existing, upsertPayload);
      console.log("Updated existing lead from GHL webhook:", saved.id);
    } else {
      const insertResult = await db.query(
        `
        INSERT INTO leads (
          company_id,
          name,
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
          status,
          not_sold_reason,
          contract_price,
          appointment_date,
          preferred_contact,
          notes,
          ghl_contact_id,
          ghl_last_synced,
          ghl_sync_status,
          needs_sync
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,
          $9,$10,$11,$12,$13,
          $14,$15,$16,$17,$18,
          $19,$20,NOW(),'webhook',false
        )
        RETURNING *;
        `,
        [
          upsertPayload.company_id,
          upsertPayload.name,
          upsertPayload.phone,
          upsertPayload.email,
          upsertPayload.address,
          upsertPayload.city,
          upsertPayload.state,
          upsertPayload.zip,
          upsertPayload.buyer_type,
          upsertPayload.company_name,
          upsertPayload.project_type,
          upsertPayload.lead_source,
          upsertPayload.status,
          upsertPayload.not_sold_reason,
          upsertPayload.contract_price,
          upsertPayload.appointment_date,
          upsertPayload.preferred_contact,
          upsertPayload.notes,
          upsertPayload.ghl_contact_id,
        ]
      );

      saved = insertResult.rows[0];
      console.log("Created new lead from GHL webhook:", saved.id);
    }

    return res.status(200).json({
      received: true,
      lead_id: saved.id,
    });
  } catch (error) {
    console.error("Webhook Error:", error);
    return res.status(500).json({ error: "Webhook processing error" });
  }
});

module.exports = router;
