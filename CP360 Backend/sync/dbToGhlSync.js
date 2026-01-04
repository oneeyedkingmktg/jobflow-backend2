// ============================================================================
// File: sync/dbToGhlSync.js
// Version: v2.1.0
// Purpose:
// - Thin wrapper that delegates all GHL logic to controllers/ghlAPI.js
// - syncLeadToGHL now handles contacts, tags, AND calendar events
// ============================================================================

const { syncLeadToGHL } = require("../controllers/ghlAPI");

async function syncLeadToGhl({ lead, previousLead = null, company, previousInstallTentative = null }) {
  if (!lead || !company) return;

  try {
    // syncLeadToGHL handles everything:
    // - Contact create/update
    // - Status tags
    // - Estimator tags
    // - Appointment calendar sync
    // - Install calendar sync
    // - All lifecycle tags
    await syncLeadToGHL(lead, company, previousInstallTentative);
  } catch (error) {
    console.error("GHL sync failed:", error.message);
    throw error;
  }
}

module.exports = {
  syncLeadToGhl,
};