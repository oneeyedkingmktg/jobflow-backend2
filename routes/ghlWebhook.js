// ============================================================================
// GHL Webhook Receiver + TEST ROUTE + Full Upsert Logic
// ============================================================================

const express = require("express");
const router = express.Router();
const db = require("../config/database");

// ============================================================================
// TEMP TEST ENDPOINT (GET)
// Visit: /webhooks/ghl/test
// ============================================================================
router.get("/test", (req, res) => {
  return res.json({
    ok: true,
    route: "webhooks/ghl working",
  });
});

// ============================================================================
// HELPERS
// ============================================================================
function normalizePhone(phone) {
  if (!phone) return null;
  return String(phone).replace(/\D/g, "") || null;
}

async function findExistingLead(companyId, ghlId, phone, email) {
  if (ghlId) {
    const r = await db.query(
      `SELECT * FROM leads WHERE company_id = $1 AND ghl_contact_id = $2 LIMIT 1`,
      [companyId, ghlId]
    );
    if (r.rows.length > 0) return r.rows[0];
  }

  if (phone) {
    const digits = normalizePhone(phone);
    const r = await db.query(
      `SELECT * FROM leads
       WHERE company_id = $1
       AND regexp_replace(phone, '\\D', '', 'g') = $2
       LIMIT 1`,
      [companyId, digits]
    );
    if (r.rows.length > 0) return r.rows[0];
  }

  if (email) {
    const r = await db.query(
      `SELECT * FROM leads
       WHERE company_id = $1 AND lower(email) = lower($2)
       LIMIT 1`,
      [companyId, email]
    );
    if (r.rows.length > 0) return r.rows[0];
  }

  return null;
}

async function updateLeadIfNeeded(existing, updates) {
  const fields = [];
  const values = [];
  let idx = 1;

  const pushIfNew = (dbField, newVal) => {
    if (newVal === undefined || newVal === null || newVal === "") return;
    const current = existing[dbField];
    if (current !== null && current !== "" && current !== undefined) return;
    fields.push(`${dbField} = $${idx}`);
    values.push(newVal);
    idx++;
  };

  pushIfNew("name", updates.name);
  pushIfNew("first_name", updates.first_name);
  pushIfNew("last_name", updates.last_name);
  pushIfNew("full_name", updates.full_name);

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

  fields.push(`ghl_last_synced = NOW()`);
  fields.push(`ghl_sync_status = 'webhook'`);
  fields.push(`needs_sync = false`);
  fields.push(`updated_at = NOW()`);

  if (fields.length === 0) return existing;

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

// ============================================================================
// MAIN WEBHOOK ENDPOINT
// POST /webhooks/ghl/:companyId
// ============================================================================
router.post("/:companyId", express.json({ limit: "2mb" }), async (req, res) => {
  console.log("===== GHL WEBHOOK RECEIVED =====");

  try {
    const companyId = parseInt(req.params.companyId, 10);
    if (!companyId) {
      console.log("ERROR: Missing companyId");
      return res.status(400).json({ error: "Invalid companyId" });
    }

    const body = req.body || {};

    console.log("Raw Body:", JSON.stringify(body, null, 2));

    // ========================================================================
    // EXTRACT REAL CONTACT DATA (GHL-style)
    // ============================================================================
    const phone =
      body.phone ||
      body.phoneNumber ||
      (body.contact && body.contact.phone) ||
      null;

    const email =
      body.email ||
      (body.contact && body.contact.email) ||
      null;

    const fullName =
      body.full_name ||
      `${body.first_name || ""} ${body.last_name || ""}`.trim() ||
      "Unknown";

    const ghlContactId =
      body.contact_id ||
      (body.contact && body.contact.id) ||
      null;

    const address = body.address || body.full_address || null;

    const city = body.city || (body.location && body.location.city) || null;
    const state = body.state || (body.location && body.location.state) || null;
    const zip =
      body.postalCode || (body.location && body.location.postalCode) || null;

    const leadSource =
      body.tags && typeof body.tags === "string" && body.tags.length > 0
        ? body.tags
        : "GHL Webhook";

    const notes = body.notes || null;

    // Split first/last for dashboard compatibility
    const nameParts = fullName.split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    console.log("EXTRACTED FIELDS:", {
      ghlContactId,
      fullName,
      firstName,
      lastName,
      phone,
      email,
      city,
      state,
      zip,
      leadSource,
    });

    if (!phone) {
      return res.status(200).json({
        received: true,
        skipped: "missing_phone",
      });
    }

    // ========================================================================
    // UPSERT PAYLOAD
    // ============================================================================
    const upsertPayload = {
      company_id: companyId,
      name: fullName,
      first_name: firstName,
      last_name: lastName,
      full_name: fullName,

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
      status: "lead",
      not_sold_reason: null,
      contract_price: null,
      appointment_date: null,
      preferred_contact: email ? "Email" : "Phone",
      notes,
      ghl_contact_id: ghlContactId,
    };

    // ========================================================================
    // FIND EXISTING
    // ============================================================================
    const existing = await findExistingLead(
      companyId,
      ghlContactId,
      phone,
      email
    );

    let saved;

    if (existing) {
      saved = await updateLeadIfNeeded(existing, upsertPayload);
    } else {
      const insert = await db.query(
        `
        INSERT INTO leads (
          company_id,
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
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,NOW(),'webhook',false
        )
        RETURNING *;
        `,
        [
          upsertPayload.company_id,
          upsertPayload.name,
          upsertPayload.first_name,
          upsertPayload.last_name,
          upsertPayload.full_name,
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
      saved = insert.rows[0];
    }

    return res.status(200).json({
      received: true,
      lead_id: saved.id,
    });
  } catch (err) {
    console.error("Webhook Error:", err);
    return res.status(500).json({ error: "Webhook processing error" });
  }
});

module.exports = router;
