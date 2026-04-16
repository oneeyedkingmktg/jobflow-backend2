// ============================================================================
// File: routes/googleDrive.js
// Purpose: API routes for Google Drive — OAuth setup, folder, file management
// ============================================================================

console.log("🔥 googleDrive routes file loaded");

const express = require("express");
const multer = require("multer");
const db = require("../config/database");
const {
  getOAuthClient,
  findFolder,
  getOrCreateFolder,
  listFilesInFolder,
  uploadFileToFolder,
} = require("../controllers/googleDrive");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB per file
});

// ------------------------------------------------------------------
// Helper: resolve lead folder for a given leadId.
// create=true  → get or create the folder (used on upload)
// create=false → find only, return null if folder doesn't exist yet (used on list)
// ------------------------------------------------------------------
async function resolveLeadFolder(leadId, { create = true } = {}) {
  const leadResult = await db.query(
    `SELECT id, name, company_id FROM leads WHERE id = $1 AND deleted_at IS NULL`,
    [leadId]
  );
  if (!leadResult.rows.length)
    throw Object.assign(new Error("Lead not found"), { status: 404 });

  const lead = leadResult.rows[0];

  const companyResult = await db.query(
    `SELECT id, google_drive_base_folder_id FROM companies WHERE id = $1 AND deleted_at IS NULL`,
    [lead.company_id]
  );
  if (!companyResult.rows.length)
    throw Object.assign(new Error("Company not found"), { status: 404 });

  const company = companyResult.rows[0];
  if (!company.google_drive_base_folder_id) {
    throw Object.assign(
      new Error("Google Drive base folder not configured for this company"),
      { status: 400 }
    );
  }

  if (create) {
    return getOrCreateFolder(lead.name || "Lead", company.google_drive_base_folder_id);
  }
  return findFolder(lead.name || "Lead", company.google_drive_base_folder_id);
}

// ============================================================================
// OAUTH SETUP ROUTES (one-time, Becky runs these once)
// ============================================================================

// ------------------------------------------------------------------
// GET /google-drive/auth?secret=GOOGLE_OAUTH_SETUP_SECRET
// Redirects to Google consent screen
// ------------------------------------------------------------------
router.get("/auth", (req, res) => {
  const secret = req.query.secret;
  if (!secret || secret !== process.env.GOOGLE_OAUTH_SETUP_SECRET) {
    return res.status(403).send("Forbidden");
  }

  const oauth2Client = getOAuthClient();
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // forces refresh_token to be returned every time
    scope: ["https://www.googleapis.com/auth/drive"],
  });

  return res.redirect(url);
});

// ------------------------------------------------------------------
// GET /google-drive/auth/callback
// Google redirects here after consent — stores refresh token in DB
// ------------------------------------------------------------------
router.get("/auth/callback", async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    console.error("❌ OAuth error:", error);
    return res.status(400).send(`Google OAuth error: ${error}`);
  }

  if (!code) {
    return res.status(400).send("Missing authorization code");
  }

  try {
    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      return res.status(400).send(
        "No refresh token returned. If you have authorized this app before, " +
        "go to <a href='https://myaccount.google.com/permissions'>Google Account Permissions</a>, " +
        "revoke access for this app, then try again."
      );
    }

    // Store refresh token in platform_settings
    await db.query(
      `INSERT INTO platform_settings (key, value, updated_at)
       VALUES ('google_oauth_refresh_token', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [tokens.refresh_token]
    );

    console.log("✅ Google OAuth refresh token stored successfully");
    return res.send(
      "<h2 style='font-family:sans-serif;color:green'>✅ Google Drive connected successfully!</h2>" +
      "<p style='font-family:sans-serif'>You can close this tab. File uploads will now use your Google account.</p>"
    );
  } catch (err) {
    console.error("❌ OAuth callback error:", err);
    return res.status(500).send(`OAuth setup failed: ${err.message}`);
  }
});

// ------------------------------------------------------------------
// GET /google-drive/auth/status
// Check whether OAuth is connected (master use only in app)
// ------------------------------------------------------------------
router.get("/auth/status", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT updated_at FROM platform_settings WHERE key = 'google_oauth_refresh_token' LIMIT 1`
    );
    const connected = result.rows.length > 0;
    return res.json({
      connected,
      connectedAt: connected ? result.rows[0].updated_at : null,
    });
  } catch (err) {
    return res.json({ connected: false });
  }
});

// ============================================================================
// DRIVE OPERATION ROUTES
// ============================================================================

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

    // find-only: don't create the folder just to list files
    const folder = await resolveLeadFolder(leadId, { create: false });
    if (!folder) return res.json({ ok: true, files: [] });

    const files = await listFilesInFolder(folder.id);
    return res.json({ ok: true, files });
  } catch (err) {
    console.error("❌ LIST FILES ERROR", err);
    const isDriveAuthError =
      err.message?.includes("invalid_grant") ||
      err.message?.includes("storage quota") ||
      err.message?.includes("insufficientPermissions") ||
      err.code === 401 || err.code === 403;
    if (isDriveAuthError) {
      return res.status(503).json({
        ok: false,
        error: "Google Drive is not connected. Please reconnect Google Drive in platform settings.",
        needsReauth: true,
      });
    }
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
    console.error("❌ UPLOAD FILE ERROR", err?.message || err);
    // Surface the actual Google error message so it's visible in the UI
    const googleMessage =
      err?.response?.data?.error?.message ||
      err?.errors?.[0]?.message ||
      err?.message ||
      "Upload failed";
    return res.status(err.status || 500).json({ ok: false, error: googleMessage });
  }
});

module.exports = router;
