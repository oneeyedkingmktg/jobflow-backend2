// ============================================================================
// File: sync/dbToGhlSync.js
// Version: v2.2.0
// Purpose:
// - Prevent sync hangs by enforcing a hard timeout
// - Guarantee sync never blocks the app indefinitely
// ============================================================================

const { syncLeadToGHL } = require("../controllers/ghlAPI");

const GHL_SYNC_TIMEOUT_MS = 15000; // 15 seconds hard stop

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => {
        reject(new Error("GHL sync timed out"));
      }, timeoutMs)
    ),
  ]);
}

async function syncLeadToGhl({
  lead,
  previousLead = null,
  company,
  previousInstallTentative = null,
}) {
  if (!lead || !company) return;

  try {
    await withTimeout(
      syncLeadToGHL(lead, company, previousInstallTentative),
      GHL_SYNC_TIMEOUT_MS
    );
  } catch (error) {
    console.error("GHL sync failed:", error.message);
    throw error;
  }
}

module.exports = {
  syncLeadToGhl,
};
