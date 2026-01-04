// ============================================================================
// File: services/ghlClient.js
// Version: v1.0.8
// Change:
// - Fixed template literal syntax bug in PUT requests (backticks → parentheses)
// - This was preventing tags from being applied and updates from working
// ============================================================================

const axios = require("axios");

function createGhlClient({ ghl_api_key, ghl_location_id }) {
  if (!ghl_api_key || !ghl_location_id) {
    throw new Error("GHL_CONFIG_MISSING");
  }

  const client = axios.create({
    baseURL: "https://services.leadconnectorhq.com",
    headers: {
      Authorization: `Bearer ${ghl_api_key}`,
      Version: "2021-07-28",
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    timeout: 10000,
  });

  // ---------------------------------------------------------------------------
  // CONTACT UPSERT (CREATE OR UPDATE – SAFE)
  // ---------------------------------------------------------------------------
  async function createContact(payload) {
    const res = await client.post("/contacts/upsert", {
      locationId: ghl_location_id,
      ...payload,
    });
    return res.data?.contact || null;
  }

  async function updateContact(contactId, payload) {
    if (!contactId) throw new Error("CONTACT_ID_REQUIRED");
    const res = await client.put(`/contacts/${contactId}`, payload);
    return res.data?.contact || null;
  }

  // ---------------------------------------------------------------------------
  // TAGS (ADD-ONLY)
  // ---------------------------------------------------------------------------
  async function addTag(contactId, tagName) {
    if (!contactId || !tagName) return;
    await client.post(`/contacts/${contactId}/tags`, {
      tags: [tagName],
    });
  }

  // ---------------------------------------------------------------------------
  // CALENDAR EVENTS
  // ---------------------------------------------------------------------------
  async function createCalendarEvent({
    calendarId,
    contactId,
    startTime,
    title,
    metadata = {},
  }) {
    if (!calendarId || !contactId || !startTime) {
      throw new Error("CALENDAR_EVENT_DATA_MISSING");
    }

    const res = await client.post("/calendars/events", {
      locationId: ghl_location_id,
      calendarId,
      contactId,
      startTime,
      title,
      ...metadata,
    });

    return res.data?.event || null;
  }

  async function updateCalendarEvent(eventId, updates) {
    if (!eventId) throw new Error("EVENT_ID_REQUIRED");
    const res = await client.put(`/calendars/events/${eventId}`, updates);
    return res.data?.event || null;
  }

  return {
    createContact,
    updateContact,
    addTag,
    createCalendarEvent,
    updateCalendarEvent,
  };
}

module.exports = {
  createGhlClient,
};