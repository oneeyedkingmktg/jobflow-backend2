// ============================================================================
// controllers/ghlAPI.js (v4.1) – Multi-Company GHL Integration
// ============================================================================

const fetch = require("node-fetch");
const db = require("../config/database");
const CryptoJS = require("crypto-js");

// Load encryption key (same key used in companies.js)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "change-this-encryption-key";

// ----------------------------------------------------------------------------
// DECRYPT COMPANY API KEY
// ----------------------------------------------------------------------------
function decryptApiKey(encryptedKey) {
  if (!encryptedKey) return null;
  const bytes = CryptoJS.AES.decrypt(encryptedKey, ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
}

const GHL_BASE_URL = "https://rest.gohighlevel.com/v1";

// ----------------------------------------------------------------------------
// PHONE NORMALIZATION
// ----------------------------------------------------------------------------
function normalizePhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, "");

  if (!digits) return null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (!digits.startsWith("+")) return `+${digits}`;
  return digits;
}

// ----------------------------------------------------------------------------
// LOW-LEVEL GHL REQUEST WRAPPER
// ----------------------------------------------------------------------------
async function ghlRequest(company, endpoint, options = {}) {
  const encryptedApiKey = company.ghl_api_key;
  const locationId = company.ghl_location_id;

  if (!encryptedApiKey) throw new Error("Company missing encrypted GHL API key");
  if (!locationId) throw new Error("Company missing GHL location ID");

  const apiKey = decryptApiKey(encryptedApiKey);

  const url = new URL(`${GHL_BASE_URL}${endpoint}`);

  const params = options.params || {};
  if (!params.locationId) params.locationId = locationId;

  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.append(k, v);
    }
  });

  const fetchOptions = {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  };

  if (options.body) fetchOptions.body = JSON.stringify(options.body);

  const res = await fetch(url.toString(), fetchOptions);
  const raw = await res.text();

  let data;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw;
  }

  if (!res.ok) {
    console.error("GHL API ERROR", {
      status: res.status,
      endpoint: url.toString(),
      response: data,
    });
    throw new Error(`GHL API error ${res.status}`);
  }

  return data;
}

// ----------------------------------------------------------------------------
// STATUS MAP
// ----------------------------------------------------------------------------
const STATUS_TAGS = {
  lead: "status - lead",
  appointment_set: "status - appointment set",
  sold: "status - sold",
  not_sold: "status - not sold",
  completed: "status - complete",
};

// ----------------------------------------------------------------------------
// APPLY STATUS TAGS
// ----------------------------------------------------------------------------
async function applyStatusTags(contactId, newStatusTag, existingTags, company) {
  const allStatusTags = Object.values(STATUS_TAGS);
  const toRemove = existingTags.filter((t) => allStatusTags.includes(t));

  for (const tag of toRemove) {
    await ghlRequest(
      company,
      `/contacts/${contactId}/tags/${encodeURIComponent(tag)}`,
      { method: "DELETE" }
    );
  }

  if (newStatusTag) {
    await ghlRequest(company, `/contacts/${contactId}/tags/`, {
      method: "POST",
      body: { tags: [newStatusTag] },
    });
  }
}

// ----------------------------------------------------------------------------
// UPSERT CONTACT FROM LEAD
// ----------------------------------------------------------------------------
async function upsertContactFromLead(lead, company) {
  const phone = normalizePhone(lead.phone);
  const email = lead.email;

  let existing = null;

  // Search by phone
  if (phone) {
    try {
      const result = await ghlRequest(company, "/contacts/", {
        method: "GET",
        params: { query: phone },
      });
      if (Array.isArray(result.contacts) && result.contacts.length > 0) {
        existing = result.contacts[0];
      }
    } catch {}
  }

  // Search by email
  if (!existing && email) {
    try {
      const result = await ghlRequest(company, "/contacts/", {
        method: "GET",
        params: { query: email },
      });
      if (Array.isArray(result.contacts) && result.contacts.length > 0) {
        existing = result.contacts[0];
      }
    } catch {}
  }

  const payload = {
    firstName: lead.first_name || "",
    lastName: lead.last_name || "",
    email: email || "",
    phone: phone || "",
    source: "JobFlow",
  };

  let contact;

  if (existing?.id) {
    contact = await ghlRequest(company, `/contacts/${existing.id}`, {
      method: "PUT",
      body: payload,
    });
  } else {
    contact = await ghlRequest(company, "/contacts/", {
      method: "POST",
      body: payload,
    });
  }

  const contactId = contact.id;
  const existingTags = Array.isArray(contact.tags) ? contact.tags : [];

  const status = lead.status;
  const tagToAssign = STATUS_TAGS[status] || null;

  await applyStatusTags(contactId, tagToAssign, existingTags, company);

  return contact;
}

// ----------------------------------------------------------------------------
// MODULE EXPORTS
// ----------------------------------------------------------------------------
module.exports = {
  syncLeadToGHL: async function (lead, company) {
    try {
      const contact = await upsertContactFromLead(lead, company);

      await db.query(
        `UPDATE leads
         SET ghl_sync_status = 'success',
             ghl_last_synced = NOW()
         WHERE id = $1`,
        [lead.id]
      );

      return contact;
    } catch (err) {
      await db.query(
        `UPDATE leads
         SET ghl_sync_status = 'error',
             ghl_last_synced = NOW()
         WHERE id = $1`,
        [lead.id]
      );
      throw err;
    }
  },

  searchGHLContactByPhone: async function (phone, company) {
    const normalized = normalizePhone(phone);
    if (!normalized) return null;

    return await ghlRequest(company, "/contacts/", {
      method: "GET",
      params: { query: normalized },
    });
  },

  fetchGHLContact: async function (contactId, company) {
    if (!contactId) return null;

    return await ghlRequest(company, `/contacts/${contactId}`, {
      method: "GET",
    });
  },
};
