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
  buildLeadFolderName,
  findFolder,
  findFolderByPrefix,
  renameFolder,
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
//
// Folder name is "Name - Project Type" when a project type exists
// (e.g. "John Smith - 2 Car Garage"), otherwise just "Name".
//
// Search always tries the full name first, then falls back to the base
// name so that existing folders and type changes never cause a second
// folder to be created.
// ------------------------------------------------------------------
async function resolveLeadFolder(leadId, { create = true } = {}) {
  const leadResult = await db.query(
    `SELECT id, name, project_type, company_id FROM leads WHERE id = $1 AND deleted_at IS NULL`,
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

  const fullName = buildLeadFolderName(lead.name, lead.project_type);
  const baseName = lead.name || "Lead";
  const parentId = company.google_drive_base_folder_id;

  // 1. Exact match on the current expected name — nothing to do.
  const exactMatch = await findFolder(fullName, parentId);
  if (exactMatch) return exactMatch;

  // 2. Look for any folder that starts with the lead's base name
  //    (handles name-only folders and folders with an old project type).
  const existingFolder = await findFolderByPrefix(baseName, parentId);

  if (existingFolder) {
    // Rename to the current expected name so it stays in sync.
    if (existingFolder.name !== fullName) {
      await renameFolder(existingFolder.id, fullName);
      existingFolder.name = fullName;
    }
    return existingFolder;
  }

  // 3. No folder found at all — create one (write path only).
  if (create) {
    return getOrCreateFolder(fullName, parentId);
  }

  return null;
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
    return res.status(err.status || 500).json({ ok: false, error: err.message, needsReauth: err.needsReauth || false });
  }
});

// ------------------------------------------------------------------
// GET /google-drive/lead-folder-init?leadId=X
// Get or create the lead's root folder plus Before and After subfolders.
// Returns { root, before, after } each with { id, name }.
// Called when the folder picker modal opens.
// ------------------------------------------------------------------
router.get("/lead-folder-init", async (req, res) => {
  try {
    const { leadId, projectType } = req.query;
    if (!leadId) return res.status(400).json({ error: "Missing leadId" });

    // If the caller passes the current form value for projectType, persist it
    // to the DB now (project_type field only) so the folder name stays in sync
    // even before the user explicitly saves the full lead form.
    if (projectType !== undefined) {
      const newValue = projectType.trim() || null;
      await db.query(
        `UPDATE leads SET project_type = $1 WHERE id = $2 AND project_type IS DISTINCT FROM $1`,
        [newValue, leadId]
      );
    }

    const root = await resolveLeadFolder(leadId, { create: true });
    const [before, after] = await Promise.all([
      getOrCreateFolder("Before", root.id),
      getOrCreateFolder("After", root.id),
    ]);

    return res.json({ ok: true, root, before, after });
  } catch (err) {
    console.error("❌ LEAD FOLDER INIT ERROR", err);
    return res.status(err.status || 500).json({ ok: false, error: err.message, needsReauth: err.needsReauth || false });
  }
});

// ------------------------------------------------------------------
// GET /google-drive/folder-contents?folderId=X
// List files inside any folder by its Drive ID (used for subfolder navigation)
// ------------------------------------------------------------------
router.get("/folder-contents", async (req, res) => {
  try {
    const { folderId } = req.query;
    if (!folderId) return res.status(400).json({ error: "Missing folderId" });

    const files = await listFilesInFolder(folderId);
    return res.json({ ok: true, files });
  } catch (err) {
    console.error("❌ FOLDER CONTENTS ERROR", err);
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
    const { leadId, folderId } = req.body;
    if (!leadId && !folderId) return res.status(400).json({ error: "Missing leadId or folderId" });
    if (!req.file) return res.status(400).json({ error: "No file provided" });

    // If a specific subfolder ID is provided, upload there directly;
    // otherwise resolve the lead's root folder (creating it if needed).
    let targetFolderId;
    if (folderId) {
      targetFolderId = folderId;
    } else {
      const folder = await resolveLeadFolder(leadId);
      targetFolderId = folder.id;
    }

    const uploaded = await uploadFileToFolder(
      targetFolderId,
      req.file.originalname,
      req.file.mimetype,
      req.file.buffer
    );

    return res.json({ ok: true, file: uploaded });
  } catch (err) {
    console.error("❌ UPLOAD FILE ERROR", err?.message || err);
    const googleMessage =
      err?.response?.data?.error?.message ||
      err?.errors?.[0]?.message ||
      err?.message ||
      "Upload failed";
    return res.status(err.status || 500).json({ ok: false, error: googleMessage, needsReauth: err.needsReauth || false });
  }
});

module.exports = router;
