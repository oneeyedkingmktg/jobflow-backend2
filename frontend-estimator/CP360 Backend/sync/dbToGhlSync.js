// ============================================================================
// File: sync/dbToGhlSync.js
// Version: v1.1.8
// Change:
// - Always pass initial status tag in contact upsert payload
// - Keep addTag() for status changes after creation
// - This guarantees first-contact tagging in GHL
// ============================================================================

const pool = require("../config/database");
const { createGhlClient } = require("../services/ghlClient");

// STATUS → GHL TAG MAP
const STATUS_TAG_MAP = {
  lead: "status - lead",
  appointment_set: "status - appointment set",
  sold: "status - sold",
  not_sold: "status - not sold",
  complete: "status - complete",
};

function normalizeStatus(status) {
  if (!status) return "lead";
  return status
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

async function syncLeadToGhl({ lead, previousLead = null, company }) {
  if (!lead || !company) return;

  await pool.query(
    `UPDATE leads
     SET ghl_sync_status = 'attempted',
         ghl_last_synced = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [lead.id]
  );

  const ghl = createGhlClient({
    ghl_api_key: company.ghl_api_key,
    ghl_location_id: company.ghl_location_id,
  });

  // ---------------------------------------------------------------------------
  // RESOLVE STATUS + TAG
  // ---------------------------------------------------------------------------
  const normalizedStatus = normalizeStatus(lead.status);
  const tagName = STATUS_TAG_MAP[normalizedStatus];

  // ---------------------------------------------------------------------------
  // CONTACT UPSERT (INCLUDE TAG ON FIRST CREATE)
  // ---------------------------------------------------------------------------
  if (!lead.ghl_contact_id) {
    const contact = await ghl.createContact({
      phone: lead.phone,
      firstName: lead.first_name || "",
      lastName: lead.last_name || "",
      email: lead.email || undefined,
      tags: tagName ? [tagName] : [],
    });

    if (!contact?.id) return;

    await pool.query(
      `UPDATE leads
       SET ghl_contact_id = $1
       WHERE id = $2`,
      [contact.id, lead.id]
    );
  }

  // ---------------------------------------------------------------------------
  // STATUS CHANGE → ADD TAG ONLY
  // ---------------------------------------------------------------------------
  if (
    tagName &&
    previousLead &&
    normalizeStatus(previousLead.status) !== normalizedStatus
  ) {
    await ghl.addTag(lead.ghl_contact_id, tagName);
  }

  // ---------------------------------------------------------------------------
  // FINAL MARK
  // ---------------------------------------------------------------------------
  await pool.query(
    `UPDATE leads
     SET ghl_sync_status = 'ghl',
         ghl_last_synced = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [lead.id]
  );
}

module.exports = {
  syncLeadToGhl,
};
