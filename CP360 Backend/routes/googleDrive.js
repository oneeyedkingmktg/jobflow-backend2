// ============================================================================
// File: routes/googleDrive.js
// Purpose: API route to get or create Google Drive folder for a lead
// ============================================================================

console.log("🔥 googleDrive routes file loaded");

const express = require("express");
const db = require("../config/database");
const { getOrCreateFolder } = require("../controllers/googleDrive");

const router = express.Router();

// ------------------------------------------------------------------
// Get or create Drive folder for a lead
// ------------------------------------------------------------------
router.post("/lead-folder", async (req, res) => {
  console.log("🔥 /google-drive/lead-folder HIT");
  console.log("📦 Request body:", req.body);

  try {
    const { leadId } = req.body;

    if (!leadId) {
      return res.status(400).json({
        error: "Missing leadId",
      });
    }

    // ------------------------------------------------------------------
    // Fetch lead
    // ------------------------------------------------------------------
    const leadResult = await db.query(
      `
      SELECT id, name, company_id
      FROM leads
      WHERE id = $1 AND deleted_at IS NULL
      `,
      [leadId]
    );

    if (!leadResult.rows.length) {
      return res.status(404).json({
        error: "Lead not found",
      });
    }

    const lead = leadResult.rows[0];
    console.log("🧾 Lead found:", lead);

    // ------------------------------------------------------------------
    // Fetch company
    // ------------------------------------------------------------------
    const companyResult = await db.query(
      `
      SELECT id, google_drive_base_folder_id
      FROM companies
      WHERE id = $1 AND deleted_at IS NULL
      `,
      [lead.company_id]
    );

    if (!companyResult.rows.length) {
      return res.status(404).json({
        error: "Company not found",
      });
    }

    const company = companyResult.rows[0];
    console.log("🏢 Company found:", company);

    if (!company.google_drive_base_folder_id) {
      return res.status(400).json({
        error: "Google Drive base folder not configured for this company",
      });
    }

    // ------------------------------------------------------------------
    // Create / find folder
    // ------------------------------------------------------------------
    const folderName = `${lead.name || "Lead"}`;
    console.log("📁 Folder name:", folderName);
    console.log("📁 Base folder ID:", company.google_drive_base_folder_id);

    const folder = await getOrCreateFolder(
      folderName,
      company.google_drive_base_folder_id
    );

    console.log("✅ Folder result:", folder);

    return res.status(200).json({
      ok: true,
      url: folder.webViewLink,
      folderId: folder.id,
    });
  } catch (err) {
    console.error("❌ GOOGLE DRIVE ERROR");
    console.error(err);

    return res.status(500).json({
      ok: false,
      error: "Google Drive error",
      details: err?.message || String(err),
    });
  }
});

module.exports = router;
