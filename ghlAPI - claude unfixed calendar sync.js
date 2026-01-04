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
// TEMPLATE PROCESSING
// ----------------------------------------------------------------------------
function processTemplate(template, dataObject) {
  if (!template) return '';
  
  // Replace {{field_name}} and {{nested.field_name}} with actual values
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, fieldPath) => {
    const keys = fieldPath.split('.');
    let value = dataObject;
    
    for (const key of keys) {
      value = value?.[key];
      if (value === undefined || value === null) return '';
    }
    
    return String(value);
  });
}

// ----------------------------------------------------------------------------
// FETCH LEAD WITH ESTIMATOR DATA
// ----------------------------------------------------------------------------
async function fetchLeadWithEstimator(leadId) {
  const result = await db.query(
    `SELECT 
      leads.*,
      estimator_leads.calculated_sf,
      estimator_leads.selected_quality,
      estimator_leads.display_price_min,
      estimator_leads.display_price_max,
      estimator_leads.all_price_ranges,
      estimator_leads.project_type,
      estimator_leads.length_ft,
      estimator_leads.width_ft,
      estimator_leads.condition,
      estimator_leads.existing_coating
    FROM leads
    LEFT JOIN estimator_leads ON leads.id = estimator_leads.lead_id
    WHERE leads.id = $1`,
    [leadId]
  );

  if (result.rows.length === 0) {
    throw new Error(`Lead ${leadId} not found`);
  }

  const row = result.rows[0];
  
  // Build nested structure with actual column names
  const leadData = {
    ...row,
    estimator_leads: {
      calculated_sf: row.calculated_sf,
      square_footage: row.calculated_sf, // Alias for templates
      selected_quality: row.selected_quality,
      finish_type: row.selected_quality, // Alias for templates
      display_price_min: row.display_price_min,
      display_price_max: row.display_price_max,
      price: row.display_price_max, // Use max as default price
      all_price_ranges: row.all_price_ranges,
      project_type: row.project_type,
      length_ft: row.length_ft,
      width_ft: row.width_ft,
      condition: row.condition,
      existing_coating: row.existing_coating,
    }
  };

  // Remove duplicated fields from top level
  delete leadData.calculated_sf;
  delete leadData.selected_quality;
  delete leadData.display_price_min;
  delete leadData.display_price_max;
  delete leadData.all_price_ranges;
  delete leadData.project_type;
  delete leadData.length_ft;
  delete leadData.width_ft;
  delete leadData.condition;
  delete leadData.existing_coating;

  return leadData;
}

// ----------------------------------------------------------------------------
// CHANGE DETECTION
// ----------------------------------------------------------------------------
function detectAppointmentChange(currentLead, lastSyncedDate, lastSyncedTime) {
  const hasAppointment = currentLead.appointment_date && currentLead.appointment_time;
  const hadAppointment = lastSyncedDate && lastSyncedTime;
  const hasEventId = currentLead.appointment_calendar_event_id;

  if (!hasAppointment && hasEventId) {
    return 'cancelled'; // Appointment removed
  }

  if (!hasAppointment) {
    return 'none'; // No appointment
  }

  if (!hasEventId) {
    return 'new'; // First time scheduling
  }

  // Compare dates and times
  const currentDate = new Date(currentLead.appointment_date).toISOString().split('T')[0];
  const currentTime = normalizeTimeTo24h(currentLead.appointment_time);
  
  const lastDate = lastSyncedDate ? new Date(lastSyncedDate).toISOString().split('T')[0] : null;
  const lastTime = lastSyncedTime ? normalizeTimeTo24h(lastSyncedTime) : null;

  if (currentDate !== lastDate || currentTime !== lastTime) {
    return 'changed'; // Date or time changed
  }

  return 'unchanged'; // No changes
}

function detectInstallChange(currentLead, lastSyncedDate) {
  const hasInstall = currentLead.install_date && !currentLead.install_tentative;
  const hadInstall = lastSyncedDate;
  const hasEventId = currentLead.install_calendar_event_id;

  if (!hasInstall && hasEventId) {
    return 'cancelled'; // Install removed
  }

  if (!currentLead.install_date) {
    return 'none'; // No install
  }

  if (!hasEventId) {
    return 'new'; // First time scheduling
  }

  // Compare dates
  const currentDate = new Date(currentLead.install_date).toISOString().split('T')[0];
  const lastDate = lastSyncedDate ? new Date(lastSyncedDate).toISOString().split('T')[0] : null;

  if (currentDate !== lastDate) {
    return 'changed'; // Date changed
  }

  return 'unchanged'; // No changes
}

function detectInstallConfirmation(previousTentative, currentTentative) {
  // Returns true if install moved from tentative to confirmed
  return previousTentative === true && currentTentative === false;
}

// ----------------------------------------------------------------------------
// ERROR LOGGING
// ----------------------------------------------------------------------------
async function logSyncError(leadId, companyId, errorType, errorMessage, payload) {
  try {
    await db.query(
      `INSERT INTO error_logs (lead_id, company_id, error_type, error_message, payload)
       VALUES ($1, $2, $3, $4, $5)`,
      [leadId, companyId, errorType, errorMessage, JSON.stringify(payload)]
    );
  } catch (err) {
    console.error('Failed to log sync error:', err);
  }
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
// UPDATE CALENDAR EVENT
// ----------------------------------------------------------------------------
async function updateCalendarEvent(company, eventId, payload) {
  if (!eventId) throw new Error("EVENT_ID_REQUIRED");
  
  console.log("🔄 [CALENDAR] Updating event:", eventId);
  
  const updated = await ghlRequest(
    company,
    `/calendars/events/appointments/${eventId}`,
    {
      method: "PUT",
      body: payload,
    }
  );
  
  console.log("✅ [CALENDAR] Event updated successfully");
  return updated;
}

// ----------------------------------------------------------------------------
// DELETE CALENDAR EVENT
// ----------------------------------------------------------------------------
async function deleteCalendarEvent(company, eventId) {
  if (!eventId) throw new Error("EVENT_ID_REQUIRED");
  
  console.log("🗑️ [CALENDAR] Deleting event:", eventId);
  
  await ghlRequest(
    company,
    `/calendars/events/appointments/${eventId}`,
    {
      method: "DELETE",
    }
  );
  
  console.log("✅ [CALENDAR] Event deleted successfully");
  return true;
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
      console.log("🔍 [CONTACT UPDATE] Payload:", JSON.stringify(updatePayload, null, 2));
      
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
// CREATE OR UPDATE OR DELETE GHL CALENDAR EVENT
// ----------------------------------------------------------------------------
async function syncLeadCalendarEvent(lead, company, changeType) {
  console.log("[CALENDAR SYNC] Lead ID:", lead.id, "| Change:", changeType);

  // Fetch lead with estimator data for template processing
  const leadData = await fetchLeadWithEstimator(lead.id);

  const hasAppointment =
    lead.appointment_date &&
    lead.appointment_time &&
    company.ghl_appt_calendar;

  const hasInstall =
    lead.install_date &&
    company.ghl_install_calendar;

  if (!hasAppointment && !hasInstall) {
    console.log("⛔ [CALENDAR SYNC] No calendar data to sync");
    return null;
  }

  let calendarId;
  let assignedUserId;
  let titleTemplate;
  let descriptionTemplate;
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
    assignedUserId = company.ghl_appt_assigned_user;
    titleTemplate = company.ghl_appt_title_template || "{{full_name}} - Appointment";
    descriptionTemplate = company.ghl_appt_description_template || "";
    existingEventId = lead.appointment_calendar_event_id;

    title = processTemplate(titleTemplate, leadData);

    const dateOnly = new Date(lead.appointment_date)
      .toISOString()
      .split("T")[0];

    const time24 = normalizeTimeTo24h(lead.appointment_time);
    if (!time24) {
      console.log("⛔ Invalid appointment time:", lead.appointment_time);
      return null;
    }

    startDateTime = new Date(`${dateOnly}T${time24}:00`);
    endDateTime = new Date(startDateTime.getTime() + 60 * 60000); // 1 hour
  }

  // -------------------------------
  // INSTALL
  // -------------------------------
  else if (hasInstall) {
    type = "install";
    calendarId = company.ghl_install_calendar;
    assignedUserId = company.ghl_install_assigned_user;
    titleTemplate = company.ghl_install_title_template || "{{full_name}} - Install";
    descriptionTemplate = company.ghl_install_description_template || "";
    existingEventId = lead.install_calendar_event_id;

    title = processTemplate(titleTemplate, leadData);

    const dateOnly = new Date(lead.install_date)
      .toISOString()
      .split("T")[0];

    // Handle tentative installs with staggered times
    if (lead.install_tentative) {
      // Count tentative installs for this week to stagger times
      const weekStart = new Date(lead.install_date);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week (Sunday)
      
      const result = await db.query(
        `SELECT COUNT(*) as count
         FROM leads
         WHERE company_id = $1
           AND install_date >= $2
           AND install_date < $2::date + INTERVAL '7 days'
           AND install_tentative = true
           AND id < $3`,
        [lead.company_id, weekStart.toISOString().split('T')[0], lead.id]
      );
      
      const offset = parseInt(result.rows[0].count) || 0;
      const hours = 8 + Math.floor(offset / 2); // Start at 8 AM, increment by 30 min
      const minutes = (offset % 2) * 30;
      
      startDateTime = new Date(`${dateOnly}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`);
      endDateTime = new Date(startDateTime.getTime() + 8 * 60 * 60000); // 8 hours
    } else {
      // Confirmed install - full day
      startDateTime = new Date(`${dateOnly}T08:00:00`);
      endDateTime = new Date(startDateTime.getTime() + 8 * 60 * 60000); // 8 hours
    }
  }

  if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
    console.log("⛔ Invalid calendar date/time");
    return null;
  }

  const description = processTemplate(descriptionTemplate, leadData);
  const address = `${lead.address || ''}, ${lead.city || ''}, ${lead.state || ''} ${lead.zip || ''}`.trim();

  const payload = {
    locationId: company.ghl_location_id,
    calendarId: calendarId,
    contactId: lead.ghl_contact_id,
    title,
    startTime: startDateTime.toISOString(),
    endTime: endDateTime.toISOString(),
    appoinmentDescription: description,
    address: address,
  };

  // Add assignedUserId if provided
  if (assignedUserId) {
    payload.assignedUserId = assignedUserId;
  }

  console.log("[CALENDAR SYNC] Payload:", JSON.stringify(payload, null, 2));

  // -------------------------------
  // HANDLE BASED ON CHANGE TYPE
  // -------------------------------
  if (changeType === 'cancelled') {
    // DELETE
    if (existingEventId) {
      await deleteCalendarEvent(company, existingEventId);
      return { type, action: 'deleted', calendarEventId: null };
    }
    return null;
  }

  if (changeType === 'changed' && existingEventId) {
    // UPDATE
    await updateCalendarEvent(company, existingEventId, payload);
    return { type, action: 'updated', calendarEventId: existingEventId };
  }

  if (changeType === 'unchanged' && existingEventId) {
    // SKIP
    console.log("⏭️ [CALENDAR] No changes, skipping sync");
    return { type, action: 'skipped', calendarEventId: existingEventId };
  }

  // CREATE NEW
  const created = await ghlRequest(
    company,
    "/calendars/events/appointments",
    {
      method: "POST",
      body: payload,
    }
  );

  console.log("[CALENDAR CREATE SUCCESS] Event ID:", created?.id);

  return {
    type,
    action: 'created',
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
      // ==========================================
      // 1️⃣ FETCH LEAD WITH ESTIMATOR DATA
      // ==========================================
      const leadData = await fetchLeadWithEstimator(lead.id);

      // ==========================================
      // 2️⃣ CREATE/UPDATE CONTACT
      // ==========================================
      
      
      const contact = await upsertContactFromLead(lead, company);
      const contactId = contact?.id || contact?.contact?.id;

      if (!contactId) {
        throw new Error("Failed to get contact ID from GHL");
      }

      // Save GHL contact ID to database
      await db.query(
        `UPDATE leads
         SET ghl_contact_id = $1
         WHERE id = $2`,
        [contactId, lead.id]
      );

      // Update lead object in memory
      lead.ghl_contact_id = contactId;

      // ==========================================
      // 3️⃣ CHECK FOR ESTIMATOR DATA & TAG
      // ==========================================
      const hasEstimatorData = leadData.estimator_leads?.square_footage || 
                                leadData.estimator_leads?.finish_type ||
                                leadData.estimator_leads?.price;
      
      if (hasEstimatorData) {
        await applyStatusTags(contactId, "estimator_lead", company);
      }

      // ==========================================
      // 4️⃣ APPOINTMENT CALENDAR SYNC
      // ==========================================
      if (lead.appointment_date && lead.appointment_time) {
        try {
          // Detect what changed
          const changeType = detectAppointmentChange(
            lead,
            lead.last_synced_appointment_date,
            lead.last_synced_appointment_time
          );

          console.log("📅 [APPOINTMENT] Change detected:", changeType);

          if (changeType !== 'none' && changeType !== 'unchanged') {
            const result = await syncLeadCalendarEvent(lead, company, changeType);

            if (result) {
              // Apply lifecycle tags
              if (result.action === 'created') {
                await applyStatusTags(contactId, "appt_date_set", company);
              } else if (result.action === 'updated') {
                await applyStatusTags(contactId, "appt_date_updated", company);
              } else if (result.action === 'deleted') {
                await applyStatusTags(contactId, "appt_date_cancelled", company);
              }

              // Update event ID if created
              if (result.calendarEventId) {
                await db.query(
                  `UPDATE leads
                   SET appointment_calendar_event_id = $1
                   WHERE id = $2`,
                  [result.calendarEventId, lead.id]
                );
              } else if (result.action === 'deleted') {
                // Clear event ID if deleted
                await db.query(
                  `UPDATE leads
                   SET appointment_calendar_event_id = NULL
                   WHERE id = $2`,
                  [lead.id]
                );
              }

              // Update last_synced fields
              await db.query(
                `UPDATE leads
                 SET last_synced_appointment_date = $1,
                     last_synced_appointment_time = $2
                 WHERE id = $3`,
                [lead.appointment_date, lead.appointment_time, lead.id]
              );
            }
          }
        } catch (calendarErr) {
          console.error("⚠️ [APPOINTMENT SYNC] Failed:", calendarErr.message);
          await applyStatusTags(contactId, "appt_sync_fail", company);
          await logSyncError(lead.id, company.id, 'appt_sync_fail', calendarErr.message, {
            appointment_date: lead.appointment_date,
            appointment_time: lead.appointment_time
          });
        }
      } else if (lead.appointment_calendar_event_id) {
        // Appointment was cancelled (date removed but event exists)
        try {
          await syncLeadCalendarEvent(lead, company, 'cancelled');
          await applyStatusTags(contactId, "appt_date_cancelled", company);
          
          await db.query(
            `UPDATE leads
             SET appointment_calendar_event_id = NULL,
                 last_synced_appointment_date = NULL,
                 last_synced_appointment_time = NULL
             WHERE id = $1`,
            [lead.id]
          );
        } catch (calendarErr) {
          console.error("⚠️ [APPOINTMENT CANCEL] Failed:", calendarErr.message);
          await applyStatusTags(contactId, "appt_sync_fail", company);
        }
      }

      // ==========================================
      // 5️⃣ INSTALL CALENDAR SYNC
      // ==========================================
      if (lead.install_date) {
        try {
          // Detect what changed
          const changeType = detectInstallChange(
            lead,
            lead.last_synced_install_date
          );

          console.log("🔧 [INSTALL] Change detected:", changeType);

          // Check for tentative → confirmed transition
          const previousTentative = lead.last_synced_install_date ? 
            (await db.query('SELECT install_tentative FROM leads WHERE id = $1', [lead.id])).rows[0]?.install_tentative : 
            null;
          
          const confirmedTransition = detectInstallConfirmation(previousTentative, lead.install_tentative);

          if (changeType !== 'none' && changeType !== 'unchanged') {
            const result = await syncLeadCalendarEvent(lead, company, changeType);

            if (result) {
              // Apply lifecycle tags
              if (result.action === 'created') {
                await applyStatusTags(contactId, "install_date_set", company);
                if (lead.install_tentative) {
                  await applyStatusTags(contactId, "install_tentative", company);
                }
              } else if (result.action === 'updated') {
                await applyStatusTags(contactId, "install_date_updated", company);
              } else if (result.action === 'deleted') {
                await applyStatusTags(contactId, "install_date_cancelled", company);
              }

              // Handle tentative → confirmed transition
              if (confirmedTransition) {
                await applyStatusTags(contactId, "install_date_final", company);
              }

              // Handle confirmed → tentative (re-apply tentative tag)
              if (!previousTentative && lead.install_tentative) {
                await applyStatusTags(contactId, "install_tentative", company);
              }

              // Update event ID if created
              if (result.calendarEventId) {
                await db.query(
                  `UPDATE leads
                   SET install_calendar_event_id = $1
                   WHERE id = $2`,
                  [result.calendarEventId, lead.id]
                );
              } else if (result.action === 'deleted') {
                // Clear event ID if deleted
                await db.query(
                  `UPDATE leads
                   SET install_calendar_event_id = NULL
                   WHERE id = $2`,
                  [lead.id]
                );
              }

              // Update last_synced fields
              await db.query(
                `UPDATE leads
                 SET last_synced_install_date = $1
                 WHERE id = $2`,
                [lead.install_date, lead.id]
              );
            }
          }
        } catch (calendarErr) {
          console.error("⚠️ [INSTALL SYNC] Failed:", calendarErr.message);
          await applyStatusTags(contactId, "install_sync_fail", company);
          await logSyncError(lead.id, company.id, 'install_sync_fail', calendarErr.message, {
            install_date: lead.install_date,
            install_tentative: lead.install_tentative
          });
        }
      } else if (lead.install_calendar_event_id) {
        // Install was cancelled (date removed but event exists)
        try {
          await syncLeadCalendarEvent(lead, company, 'cancelled');
          await applyStatusTags(contactId, "install_date_cancelled", company);
          
          await db.query(
            `UPDATE leads
             SET install_calendar_event_id = NULL,
                 last_synced_install_date = NULL
             WHERE id = $1`,
            [lead.id]
          );
        } catch (calendarErr) {
          console.error("⚠️ [INSTALL CANCEL] Failed:", calendarErr.message);
          await applyStatusTags(contactId, "install_sync_fail", company);
        }
      }

      // ==========================================
      // 6️⃣ MARK SYNC AS SUCCESSFUL
      // ==========================================
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
      
      // Log error to database
      await logSyncError(lead.id, lead.company_id, 'general_sync_fail', err.message, {
        lead_id: lead.id,
        company_id: lead.company_id
      });
      
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

  

  fetchGHLContact: async function (contactId, company) {
    if (!contactId || typeof contactId !== "string" || !contactId.trim()) {
      return null;
    }

    return await ghlRequest(company, `/contacts/${contactId.trim()}`, {
      method: "GET",
    });
  },
};