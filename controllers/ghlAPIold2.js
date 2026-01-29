// ============================================================================
// controllers/ghlAPI.js (v4.3) – Multi-Company GHL Integration (LeadConnector v2)
// Changes:
// - Fixed applyStatusTags to properly decrypt API key before using ghlClient
// - Fixed tag application to work for both new AND existing contacts
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

  try {
    const bytes = CryptoJS.AES.decrypt(encryptedKey, ENCRYPTION_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);

    if (decrypted && decrypted.trim().length >= 20) {
      return decrypted.trim();
    }

    return null;
  } catch (err) {
    return null;
  }
}

// ----------------------------------------------------------------------------
// RESOLVE API KEY (supports raw OR encrypted during stabilization)
// ----------------------------------------------------------------------------
function resolveApiKey(storedValue) {
  if (!storedValue) return null;

  // Try decrypting first (normal expected state)
  const decrypted = decryptApiKey(storedValue);

  if (decrypted && typeof decrypted === "string" && decrypted.trim().length >= 20) {
    return decrypted.trim();
  }

  // If decrypt fails, assume it's a raw key stored directly
  if (typeof storedValue === "string" && storedValue.trim().length >= 20) {
    return storedValue.trim();
  }

  return null;
}

// ✅ LeadConnector v2 base URL
const GHL_BASE_URL = "https://services.leadconnectorhq.com";
// ✅ Required header for LC API
const GHL_API_VERSION = "2021-07-28";

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

function normalizeTimeTo24h(time) {
  if (!time) return null;

  // Handle Postgres TIME like "14:00:00"
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(time)) {
    return time.slice(0, 5);
  }

  // Handle 24-hour "HH:MM"
  if (/^\d{1,2}:\d{2}$/.test(time)) {
    return time;
  }

  // Handle "2 pm", "2:00 PM", etc
  const match = time.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (!match) return null;

  let hour = parseInt(match[1], 10);
  const minute = match[2] || "00";
  const meridian = match[3].toLowerCase();

  if (meridian === "pm" && hour !== 12) hour += 12;
  if (meridian === "am" && hour === 12) hour = 0;

  return `${hour.toString().padStart(2, "0")}:${minute}`;
}



// ----------------------------------------------------------------------------
// LOW-LEVEL GHL REQUEST WRAPPER
// ----------------------------------------------------------------------------
async function ghlRequest(company, endpoint, options = {}) {
  const encryptedApiKey = company.ghl_api_key;
  const locationId = company.ghl_location_id;

  if (!encryptedApiKey) throw new Error("Company missing encrypted GHL API key");
  if (!locationId) throw new Error("Company missing GHL location ID");

  const apiKey = resolveApiKey(encryptedApiKey);

  // ✅ Fail loudly if decrypt is broken
  if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length < 20) {
    throw new Error(
      "GHL API key decrypt failed (check ENCRYPTION_KEY matches the key used to encrypt stored API keys)"
    );
  }

  const url = new URL(`${GHL_BASE_URL}${endpoint}`);

  const params = options.params || {};

  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.append(k, v);
    }
  });

  const fetchOptions = {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Version: String(GHL_API_VERSION).trim(),
      "Content-Type": "application/json",
      Accept: "application/json"
    },
  };

  if (options.body) fetchOptions.body = JSON.stringify(options.body);

  console.log("GHL REQUEST DEBUG", {
    url: url.toString(),
    method: fetchOptions.method,
  });

  const res = await fetch(url.toString(), fetchOptions);
  const raw = await res.text();

  let data;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw;
  }

  if (!res.ok) {
    const error = new Error(`GHL API error ${res.status}`);
    error.status = res.status;
    error.response = data;
    throw error;
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
// APPLY STATUS TAGS (FIXED - NOW USES ghlRequest INSTEAD OF ghlClient)
// ----------------------------------------------------------------------------
async function applyStatusTags(contactId, newStatusTag, company) {
  if (!contactId || !newStatusTag) return;

  console.log("🏷️  [GHL TAG] Applying tag:", newStatusTag, "to contact:", contactId);

  try {
    await ghlRequest(company, `/contacts/${contactId}/tags`, {
      method: "POST",
      body: {
        tags: [newStatusTag],
      },
    });
    console.log("✅ [GHL TAG] Successfully applied:", newStatusTag);
  } catch (err) {
    console.error("❌ [GHL TAG] Failed to apply tag:", err.message);
    console.error("   Status:", err.status);
    console.error("   Response:", err.response);
  }
}

// ----------------------------------------------------------------------------
// UPSERT CONTACT FROM LEAD (FIXED - TAGS NOW APPLIED IN ALL CASES)
// ----------------------------------------------------------------------------
async function upsertContactFromLead(lead, company) {
  const phone = normalizePhone(lead.phone);
  const email = lead.email;

const createPayload = {
  locationId: company.ghl_location_id,
  ...(lead.first_name ? { firstName: lead.first_name } : {}),
  ...(lead.last_name ? { lastName: lead.last_name } : {}),
  ...(email ? { email } : {}),
  ...(phone ? { phone } : {}),
  source: "JobFlow",
};

const updatePayload = {
  ...(lead.first_name ? { firstName: lead.first_name } : {}),
  ...(lead.last_name ? { lastName: lead.last_name } : {}),
  ...(email ? { email } : {}),
  ...(phone ? { phone } : {}),
};





  let contact;
  let contactId;

  try {
    // Try creating new contact
const response = await ghlRequest(company, "/contacts/", {
  method: "POST",
  body: createPayload,
});

    
    contact = response.contact || response;
    contactId = contact.id;
    console.log("✅ [CONTACT] Created new contact:", contactId);

  } catch (err) {
    // Check if duplicate contact
    const meta = err?.response?.meta || err?.meta;

    if (meta?.contactId) {
      // Contact already exists - update it
      contactId = meta.contactId;
      console.log("ℹ️  [CONTACT] Already exists, updating:", contactId);
      
const updateResponse = await ghlRequest(
  company,
  `/contacts/${contactId}`,
  {
    method: "PUT",
    body: updatePayload,
  }
);

      
      contact = updateResponse.contact || updateResponse;
    } else {
      throw err;
    }
  }

  // ------------------------------------------------------------
  // APPLY STATUS TAG (WORKS FOR BOTH NEW AND EXISTING CONTACTS)
  // ------------------------------------------------------------
  if (contactId) {
    const status = String(lead.status || "").trim().toLowerCase();
    console.log("🔍 [STATUS] Lead status:", status);

    const tagToAssign = STATUS_TAGS[status] || null;

    if (tagToAssign) {
      await applyStatusTags(contactId, tagToAssign, company);
    } else {
      console.log("⚠️  [STATUS] No tag mapping for status:", status);
    }
  }

  return contact;
}

// ----------------------------------------------------------------------------
// CREATE OR UPDATE GHL CALENDAR EVENT (PHASE 1 – EXACT DATES ONLY)
// ----------------------------------------------------------------------------
async function syncLeadCalendarEvent(lead, company) {
  console.log("[CALENDAR SYNC] Lead ID:", lead.id);

  const hasAppointment =
    lead.appointment_date &&
    lead.appointment_time &&
    company.ghl_appt_calendar;

  const hasInstall =
    lead.install_date &&
    !lead.install_tentative &&
    company.ghl_install_calendar;

  if (!hasAppointment && !hasInstall) {
    console.log("⛔ [CALENDAR SYNC] Missing required calendar data");
    return null;
  }

  let calendarId;
  let title;
  let startDateTime;
  let endDateTime;
  let existingEventId;
  let type;

  // -------------------------------
  // APPOINTMENT
  // -------------------------------
if (hasAppointment) {
    type = "appointment";
    calendarId = company.ghl_appt_calendar;
    existingEventId = lead.appointment_calendar_event_id;
    
    // ✅ ADD THIS LOGGING
    console.log("🔍 [DEBUG] existingEventId:", existingEventId);
    console.log("🔍 [DEBUG] existingEventId type:", typeof existingEventId);
    console.log("🔍 [DEBUG] Will skip?", existingEventId && typeof existingEventId === "string" && existingEventId !== "null");

    title = `${lead.full_name || "Lead"} – Appointment`;

    const dateOnly = new Date(lead.appointment_date)
      .toISOString()
      .split("T")[0];

    const time24 = normalizeTimeTo24h(lead.appointment_time);
    if (!time24) {
      console.log("⛔ Invalid appointment time:", lead.appointment_time);
      return null;
    }

    startDateTime = new Date(`${dateOnly}T${time24}:00`);
    endDateTime = new Date(startDateTime.getTime() + 60 * 60000);
  }

  // -------------------------------
  // INSTALL
  // -------------------------------
  else {
    type = "install";
    calendarId = company.ghl_install_calendar;
    existingEventId = lead.install_calendar_event_id;

    title = `${lead.full_name || "Lead"} – Install`;

    const dateOnly = new Date(lead.install_date)
      .toISOString()
      .split("T")[0];

    startDateTime = new Date(`${dateOnly}T08:00:00`);
    endDateTime = new Date(startDateTime.getTime() + 8 * 60 * 60000);
  }

  if (
    isNaN(startDateTime.getTime()) ||
    isNaN(endDateTime.getTime())
  ) {
    console.log("⛔ Invalid calendar date/time");
    return null;
  }

  const description = `
Lead: ${lead.full_name || ""}
Phone: ${lead.phone || ""}
Email: ${lead.email || ""}

Address:
${lead.address || ""}
${lead.city || ""}, ${lead.state || ""} ${lead.zip || ""}
`.trim();

const payload = {
    locationId: company.ghl_location_id,
    calendarId: calendarId,  // Use the variable, not hardcoded
    assignedUserId: "bmDDWa6C4oAea8QJuTDM",
    contactId: lead.ghl_contact_id,
    title,
    startTime: startDateTime.toISOString(),
    endTime: endDateTime.toISOString(),
    meetingLocationType: "address",
    //meetingLocation: "On-site estimate",
    /* meetingLocationAddress: {
    addressLine1: "123 Main St",
    city: "Goshen",
    state: "IN",
    postalCode: "46526",
    country: "US" 
  }, */
    notes: description,
  };

  console.log("[CALENDAR SYNC] Payload:", JSON.stringify(payload, null, 2));

  
// -------------------------------
// -------------------------------
// UPDATE EXISTING - SKIP FOR NOW
// -------------------------------
if (
  existingEventId &&
  typeof existingEventId === "string" &&
  existingEventId !== "null"
) {
  console.log("⏭️ [CALENDAR] Event already exists, skipping update:", existingEventId);
  return { type, calendarEventId: existingEventId };
}

console.log("🔍 [DEBUG] calendarId:", calendarId);
console.log("🔍 [DEBUG] locationId:", company.ghl_location_id);
console.log("🔍 [DEBUG] contactId:", lead.ghl_contact_id);

// -------------------------------
// -------------------------------
// CREATE NEW
const created = await ghlRequest(
  company,
  "/calendars/events/appointments",  // ← Try this endpoint
  {
    method: "POST",
    body: payload,
  }
);

console.log("[CALENDAR CREATE SUCCESS] Event ID:", created?.id);

return {
    type,
    calendarEventId: created?.id || null,
  };
}


// ----------------------------------------------------------------------------
// MODULE EXPORTS
// ----------------------------------------------------------------------------
module.exports = {
  syncLeadCalendarEvent,
syncLeadToGHL: async function (lead, company) {
    try {
      // 1️⃣ Create/update contact
      const contact = await upsertContactFromLead(lead, company);
      const contactId = contact?.id || contact?.contact?.id;

      if (!contactId) {
        throw new Error("Failed to get contact ID from GHL");
      }

      // ✅ SAVE GHL CONTACT ID TO DATABASE
      await db.query(
        `UPDATE leads
         SET ghl_contact_id = $1
         WHERE id = $2`,
        [contactId, lead.id]
      );

      // ✅ UPDATE LEAD OBJECT SO CALENDAR SYNC CAN USE IT
      lead.ghl_contact_id = contactId;

// 2️⃣ Sync calendar event (now with valid contactId)
      if (
        lead.appointment_date &&
        lead.appointment_time &&
        typeof lead.appointment_time === "string" &&
        (lead.appointment_time.includes(":") || /am|pm/i.test(lead.appointment_time))
      ) {
        try {
          const result = await syncLeadCalendarEvent(lead, company);

if (result?.type === "appointment" && result.calendarEventId) {
          await db.query(
            `UPDATE leads
             SET appointment_calendar_event_id = $1
             WHERE id = $2`,
            [result.calendarEventId, lead.id]
          );
          
          // ✅ Update lead object in memory too
          lead.appointment_calendar_event_id = result.calendarEventId;
        }
        } catch (calendarErr) {
          // ✅ Don't fail entire sync if calendar sync fails
          console.error("⚠️ [CALENDAR SYNC] Failed but continuing:", calendarErr.message);
        }
      }

      // 3️⃣ Mark sync as successful
      await db.query(
        `UPDATE leads
         SET ghl_sync_status = 'success',
             ghl_last_synced = NOW()
         WHERE id = $1`,
        [lead.id]
      );

      return contact;
    } catch (err) {
      console.error("❌ [SYNC ERROR]", err.message);
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
    if (!contactId || typeof contactId !== "string" || !contactId.trim()) {
      return null;
    }

    return await ghlRequest(company, `/contacts/${contactId.trim()}`, {
      method: "GET",
    });
  },
};