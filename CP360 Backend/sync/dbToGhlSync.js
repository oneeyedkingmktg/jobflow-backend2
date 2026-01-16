// ============================================================================
// File: sync/dbToGhlSync.js
// Version: v2.3.0
// Purpose:
// - Prevent sync hangs by enforcing a hard timeout
// - Guarantee sync never blocks the app indefinitely
// - ADD: Delete GHL contact when lead is deleted in JF
// ============================================================================

const { syncLeadToGHL, fetchGHLContact } = require("../controllers/ghlAPI");
const pool = require("../config/database");

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

// ============================================================
// DELETE CONTACT IN GHL WHEN LEAD IS DELETED IN JF
// ============================================================
async function deleteGHLContact(ghlContactId, companyId) {
  if (!ghlContactId || !companyId) return;

  const companyResult = await pool.query(
    `SELECT * FROM companies WHERE id = $1`,
    [companyId]
  );

  if (companyResult.rows.length === 0) return;

  const company = companyResult.rows[0];

  try {
    await fetchGHLContact(ghlContactId, company); // ensures contact exists
    await require("../controllers/ghlAPI").ghlRequest(
      company,
      `/contacts/${ghlContactId}`,
      { method: "DELETE" }
    );
  } catch (err) {
    console.error("Failed to delete GHL contact:", err.message);
  }
}

module.exports = {
  syncLeadToGhl,
  deleteGHLContact,
};
