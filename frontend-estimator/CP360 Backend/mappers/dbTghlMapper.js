// ============================================================================
// DB → GHL Mapper
// File: mappers/dbToGhlMapper.js
// Version: v1.0.0
// Purpose:
//   Central mapping layer for DB → GoHighLevel payloads.
//   This prevents drift (field names, tag names, titles) across companies.
//
//   What lives here:
//   - Status → tag mapping (add-only tags)
//   - Custom field keys used in GHL
//   - Calendar event titles
//   - Contact payload builder
//   - Calendar event payload builders
//
// Changelog:
// v1.0.0
// - Initial production version
// - Status tag mapping
// - Contact payload mapping
// - Appointment/install event payload mapping
// ============================================================================

// -----------------------------------------------------------------------------
// Canonical status tags (DB status -> GHL tag name)
// NOTE: DB will ADD the tag only. GHL automations clean up conflicting tags.
// -----------------------------------------------------------------------------
const STATUS_TAGS = Object.freeze({
  lead: "lead",
  appt_booked: "appt_booked",
  sold: "sold",
  lost: "lost",
});

// -----------------------------------------------------------------------------
// GHL Custom Field Keys (these must match the keys configured in each location)
// IMPORTANT: Keep these stable across snapshots/sub-accounts.
// -----------------------------------------------------------------------------
const CUSTOM_FIELDS = Object.freeze({
  lead_origin: "lead_origin",
  buyer_type: "buyer_type",
  entered_by_user: "entered_by_user", // optional
  project_type: "project_type",
  estimate_low: "estimate_low",
  estimate_high: "estimate_high",
  estimate_mid: "estimate_mid", // optional
  contract_price: "contract_price", // optional
});

// -----------------------------------------------------------------------------
// Calendar event titles
// -----------------------------------------------------------------------------
const EVENT_TITLES = Object.freeze({
  sales: "Sales Appointment",
  install: "Install",
});

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
function getStatusTag(status) {
  if (!status) return null;
  return STATUS_TAGS[status] || null;
}

function buildCustomFieldsObject(lead) {
  const cf = {};

  if (lead.lead_origin) cf[CUSTOM_FIELDS.lead_origin] = lead.lead_origin;
  if (lead.buyer_type) cf[CUSTOM_FIELDS.buyer_type] = lead.buyer_type;

  // For manual entry (optional)
  if (lead.entered_by_user_name) {
    cf[CUSTOM_FIELDS.entered_by_user] = lead.entered_by_user_name;
  }

  // Estimator / project summary (optional)
  if (lead.project_type) cf[CUSTOM_FIELDS.project_type] = lead.project_type;

  if (lead.estimate_low != null) cf[CUSTOM_FIELDS.estimate_low] = lead.estimate_low;
  if (lead.estimate_high != null) cf[CUSTOM_FIELDS.estimate_high] = lead.estimate_high;
  if (lead.estimate_mid != null) cf[CUSTOM_FIELDS.estimate_mid] = lead.estimate_mid;

  // Contract price (optional, usually post-sale)
  if (lead.contract_price != null) cf[CUSTOM_FIELDS.contract_price] = lead.contract_price;

  return Object.keys(cf).length ? cf : null;
}

// -----------------------------------------------------------------------------
// CONTACT PAYLOAD
// -----------------------------------------------------------------------------
function buildGhlContactPayload(lead) {
  // Keep minimal and deterministic.
  // Phone is the key identifier in your system.
  const payload = {
    phone: lead.phone,
    firstName: lead.first_name || "",
    lastName: lead.last_name || "",
  };

  if (lead.email) payload.email = lead.email;

  const customFields = buildCustomFieldsObject(lead);
  if (customFields) payload.customFields = customFields;

  return payload;
}

// -----------------------------------------------------------------------------
// CALENDAR EVENT PAYLOADS
// NOTE: dbToGhlSync decides whether to create/update; this only builds payloads.
// -----------------------------------------------------------------------------
function buildSalesEventCreatePayload({ lead, company }) {
  return {
    calendarId: company.sales_calendar,
    contactId: lead.ghl_contact_id,
    startTime: lead.sales_appt_at,
    title: EVENT_TITLES.sales,
  };
}

function buildSalesEventUpdatePayload({ lead }) {
  return {
    startTime: lead.sales_appt_at,
  };
}

function buildInstallEventCreatePayload({ lead, company }) {
  // Contract price is safe to pass here if you want it visible in GHL.
  // We keep it in metadata and/or custom fields depending on your GHL setup.
  const metadata = {};
  if (lead.contract_price != null) {
    metadata[CUSTOM_FIELDS.contract_price] = lead.contract_price;
  }

  return {
    calendarId: company.install_calendar,
    contactId: lead.ghl_contact_id,
    startTime: lead.install_at,
    title: EVENT_TITLES.install,
    metadata,
  };
}

function buildInstallEventUpdatePayload({ lead }) {
  return {
    startTime: lead.install_at,
  };
}

module.exports = {
  STATUS_TAGS,
  CUSTOM_FIELDS,
  EVENT_TITLES,
  getStatusTag,
  buildGhlContactPayload,
  buildSalesEventCreatePayload,
  buildSalesEventUpdatePayload,
  buildInstallEventCreatePayload,
  buildInstallEventUpdatePayload,
};
