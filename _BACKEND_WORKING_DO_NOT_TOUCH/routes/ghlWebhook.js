// FILE: ghlWebhook.js (FINAL – referral_source locking + correct INSERT order)
// ============================================================================
// GHL Webhook Receiver + TEST ROUTE + Full Upsert Logic
// ============================================================================

// NOTE:
// This file handles GHL automation webhooks (workflow-triggered).
// It is NOT used for system-level reverse sync.
// See ghlWebhooks.js for controlled GHL → DB syncing.


const express = require("express");
const router = express.Router();
const db = require("../config/database");

// ============================================================================
// TEMP TEST ENDPOINT
// ============================================================================
router.get("/test", (req, res) => {
  return res.json({ ok: true, route: "webhooks/ghl working" });
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

// ============================================================================
// ALWAYS overwrite fields EXCEPT: lead_source & referral_source
// locked once set
// ============================================================================
async function updateLeadIfNeeded(existing, updates) {
  const fields = [];
  const values = [];
  let idx = 1;

  const pushField = (dbField, newVal) => {
    fields.push(`${dbField} = $${idx}`);
    values.push(newVal);
    idx++;
  };

  pushField("name", updates.name);
  pushField("first_name", updates.first_name);
  pushField("last_name", updates.last_name);
  pushField("full_name", updates.full_name);
  pushField("phone", updates.phone);
  pushField("email", updates.email);
  pushField("address", updates.address);
  pushField("city", updates.city);
  pushField("state", updates.state);
  pushField("zip", updates.zip);
  pushField("buyer_type", updates.buyer_type);
  pushField("company_name", updates.company_name);
  pushField("project_type", updates.project_type);

  if (!existing.lead_source || existing.lead_source.trim() === "") {
    pushField("lead_source", updates.lead_source);
  }

  if (!existing.referral_source || existing.referral_source.trim() === "") {
    pushField("referral_source", updates.referral_source);
  }

  pushField("preferred_contact", updates.preferred_contact);
  pushField("notes", updates.notes);
  pushField("ghl_contact_id", updates.ghl_contact_id);

  fields.push(`ghl_last_synced = NOW()`);
  fields.push(`ghl_sync_status = 'webhook'`);
  fields.push(`needs_sync = false`);
  fields.push(`updated_at = NOW()`);

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
// ============================================================================
router.post("/:companyId", express.json({ limit: "2mb" }), async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId, 10);
    const body = req.body || {};

    const phone =
      body.phone ||
      body.phoneNumber ||
      (body.contact && body.contact.phone) ||
      null;

    if (!phone) {
      return res.status(200).json({ received: true, skipped: "missing_phone" });
    }

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

    const referralSource =
      (body.contact && body.contact.referral_source) ||
      (body.customData && body.customData.referral_source) ||
      "CRM Lead";

    const notes = body.notes || null;

    const nameParts = fullName.split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    const existing = await findExistingLead(
      companyId,
      ghlContactId,
      phone,
      email
    );

    let saved;

    if (existing) {
      saved = await updateLeadIfNeeded(existing, {
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
        referral_source: referralSource,
        preferred_contact: email ? "Email" : "Phone",
        notes,
        ghl_contact_id: ghlContactId,
      });
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
          referral_source,
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
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
          'lead',NULL,NULL,NULL,$17,$18,$19,NOW(),'webhook',false
        )
        RETURNING *;
        `,
        [
          companyId,
          fullName,
          firstName,
          lastName,
          fullName,
          phone,
          email,
          address,
          city,
          state,
          zip,
          null,
          null,
          null,
          leadSource,
          referralSource,
          email ? "Email" : "Phone",
          notes,
          ghlContactId,
        ]
      );
      saved = insert.rows[0];
    }

    return res.status(200).json({ received: true, lead_id: saved.id });
  } catch (err) {
    console.error("Webhook Error:", err);
    return res.status(500).json({ error: "Webhook processing error" });
  }
});

module.exports = router;
