// ============================================================================
// File: routes/googleDrive.js
// Purpose: API routes for Google Drive folder + file management
// ============================================================================

console.log("🔥 googleDrive routes file loaded");

const express = require("express");
const multer = require("multer");
const db = require("../config/database");
const { getOrCreateFolder, listFilesInFolder, uploadFileToFolder } = require("../controllers/googleDrive");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// ------------------------------------------------------------------
// Helper: resolve lead folder ID (get or create)
// ------------------------------------------------------------------
async function resolveLeadFolder(leadId) {
  const leadResult = await db.query(
    `SELECT id, name, company_id FROM leads WHERE id = $1 AND deleted_at IS NULL`,
    [leadId]
  );
  if (!leadResult.rows.length) throw Object.assign(new Error("Lead not found"), { status: 404 });

  const lead = leadResult.rows[0];

  const companyResult = await db.query(
    `SELECT id, google_drive_base_folder_id FROM companies WHERE id = $1 AND deleted_at IS NULL`,
    [lead.company_id]
  );
  if (!companyResult.rows.length) throw Object.assign(new Error("Company not found"), { status: 404 });

  const company = companyResult.rows[0];
  if (!company.google_drive_base_folder_id) {
    throw Object.assign(new Error("Google Drive base folder not configured for this company"), { status: 400 });
  }

  const folder = await getOrCreateFolder(lead.name || "Lead", company.google_drive_base_folder_id);
  return folder;
}

// ------------------------------------------------------------------
// POST /google-drive/lead-folder
// Get or create Drive folder for a lead (returns URL + folderId)
// ------------------------------------------------------------------
router.post("/lead-folder", async (req, res) => {
  console.log("🔥 /google-drive/lead-folder HIT");
  try {
    const { leadId } = req.body;
    if (!leadId) return res.status(400).json({ error: "Missing leadId" });

    const folder = await resolveLeadFolder(leadId);
    return res.json({ ok: true, url: folder.webViewLink, folderId: folder.id });
  } catch (err) {
    console.error("❌ GOOGLE DRIVE ERROR", err);
    return res.status(err.status || 500).json({ ok: false, error: err.message });
  }
});

// ------------------------------------------------------------------
// GET /google-drive/lead-files?leadId=X
// List files in a lead's Drive folder
// ------------------------------------------------------------------
router.get("/lead-files", async (req, res) => {
  try {
    const { leadId } = req.query;
    if (!leadId) return res.status(400).json({ error: "Missing leadId" });

    const folder = await resolveLeadFolder(leadId);
    const files = await listFilesInFolder(folder.id);

    return res.json({ ok: true, files });
  } catch (err) {
    console.error("❌ LIST FILES ERROR", err);
    return res.status(err.status || 500).json({ ok: false, error: err.message });
  }
});

// ------------------------------------------------------------------
// POST /google-drive/upload-file
// Upload a file to a lead's Drive folder
// ------------------------------------------------------------------
router.post("/upload-file", upload.single("file"), async (req, res) => {
  try {
    const { leadId } = req.body;
    if (!leadId) return res.status(400).json({ error: "Missing leadId" });
    if (!req.file) return res.status(400).json({ error: "No file provided" });

    const folder = await resolveLeadFolder(leadId);
    const uploaded = await uploadFileToFolder(
      folder.id,
      req.file.originalname,
      req.file.mimetype,
      req.file.buffer
    );

    return res.json({ ok: true, file: uploaded });
  } catch (err) {
    console.error("❌ UPLOAD FILE ERROR", err);
    return res.status(err.status || 500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
