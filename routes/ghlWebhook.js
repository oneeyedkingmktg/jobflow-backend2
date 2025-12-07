// ============================================================================
// GHL Webhook Receiver + TEMP TEST ROUTE
// ============================================================================

const express = require("express");
const router = express.Router();
const db = require("../config/database");

// ============================================================================
// RAW BODY CAPTURE (required for GHL webhooks)
// ============================================================================

router.use(
  express.raw({ type: "*/*", limit: "2mb" }),
  (req, res, next) => {
    try {
      const raw = req.body?.toString() || "";
      console.log("\n================ RAW WEBHOOK ===================");
      console.log(raw);
      console.log("================================================\n");

      if (raw && raw.length > 0) {
        try {
          req.jsonBody = JSON.parse(raw);
        } catch (err) {
          console.error("JSON parse failed:", err);
          req.jsonBody = {};
        }
      } else {
        req.jsonBody = {};
      }
    } catch (e) {
      console.error("Raw body capture error:", e);
      req.jsonBody = {};
    }
    next();
  }
);

// ============================================================================
// TEMP TEST ENDPOINT
// GET /webhooks/ghl/test
// ============================================================================
router.get("/test", (req, res) => {
  return res.json({
    ok: true,
    route: "webhooks/ghl working",
  });
});

// ============================================================================
// Helpers
// ============================================================================
function normalizePhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, "");
  return digits || null;
}

async function findExistingLead(companyId, ghlContactId, phone, email) {
  if (ghlContactId) {
    const byGhl = await db.query(
      `SELECT * FROM leads WHERE company_id = $1 AND ghl_contact_id = $2 LIMIT 1`,
      [companyId, ghlContactId]
    );
    if (byGhl.rows.length > 0) return byGhl.rows[0];
  }

  if (phone) {
    const normalized = normalizePhone(phone);
    const byPhone = await db.query(
      `SELECT * FROM leads 
       WHERE company_id = $1 
       AND regexp_replace(phone, '\\D', '', 'g') = $2
       LIMIT 1`,
      [companyId, normalized]
    );
    if (byPhone.rows.length > 0) return byPhone.rows[0];
  }

  if (email) {
    const byEmail = await db.query(
      `SELECT * FROM leads 
       WHERE company_id = $1 AND lower(email) = lower($2)
       LIMIT 1`,
      [companyId, email]
    );
    if (byEmail.rows.length > 0) return byEmail.rows[0];
  }

  return null;
}

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
router.post("/:companyId", async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId, 10);

    if (!companyId || Number.isNaN(companyId)) {
      console.error("Webhook invalid companyId");
      return res.status(400).json({ error: "Invalid companyId" });
    }

    const body =
      req.jsonBody ||
      req.body ||
      {};

    console.log("\n========= PARSED WEBHOOK JSON =========");
    console.log(JSON.stringify(body, null, 2));
    console.log("=======================================\n");

    const contact =
      body.contact ||
      (body.payload && body.payload.contact) ||
      body;

    if (!contact || typeof contact !== "object") {
      console.error("Webhook missing contact");
      return res.status(200).json({ received: true, skipped: "no_contact" });
    }

    // EXPANDED PHONE DETECTION
    const phone =
      contact.phone ||
      contact.phoneNumber ||
      contact.phone_number ||
      contact.primaryPhone ||
      contact.mobilePhone ||
      (contact.phones && contact.phones[0] && contact.phones[0].phone) ||
      null;

    const email =
      contact.email ||
      contact.emailAddress ||
      null;

    const firstName = contact.firstName || "";
    const lastName = contact.lastName || "";

    const fullName =
      contact.name ||
      `${firstName} ${lastName}`.trim() ||
      "Unknown";

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

    const preferredContact =
      email ? "Email" :
      phone ? "Phone" :
      null;

    const ghlContactId = contact.id || contact.contactId || null;

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
      status: "lead",
      not_sold_reason: null,
      contract_price: null,
      appointment_date: null,
      preferred_contact: preferredContact,
      notes,
      ghl_contact_id: ghlContactId,
    };

    // Find existing
    const existing = await findExistingLead(
      companyId,
      ghlContactId,
      phone,
      email
    );

    let saved;

    if (existing) {
      saved = await updateLeadIfNeeded(existing, upsertPayload);
      console.log("Updated existing lead:", saved.id);
    } else {
      const insert = await db.query(
        `
        INSERT INTO leads (
          company_id, name, phone, email, address, city, state, zip,
          buyer_type, company_name, project_type, lead_source,
          status, not_sold_reason, contract_price, appointment_date,
          preferred_contact, notes, ghl_contact_id,
          ghl_last_synced, ghl_sync_status, needs_sync
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,
          $9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,
          NOW(),'webhook',false
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

      saved = insert.rows[0];
      console.log("Created new lead:", saved.id);
    }

    return res.json({
      received: true,
      lead_id: saved.id,
    });

  } catch (error) {
    console.error("Webhook Error:", error);
    return res.status(500).json({ error: "Webhook processing error" });
  }
});

module.exports = router;
