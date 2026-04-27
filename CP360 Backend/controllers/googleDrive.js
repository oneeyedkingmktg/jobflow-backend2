// ============================================================================
// File: controllers/googleDrive.js
// Purpose: Google Drive operations using OAuth2 (Becky's account) with
//          service account fallback for read-only operations
// ============================================================================

const { google } = require("googleapis");
const { Readable } = require("stream");
const db = require("../config/database");

// ------------------------------------------------------------------
// Build a service account Drive client
// ------------------------------------------------------------------
function getServiceAccountDriveClient() {
  let auth;
  if (process.env.GOOGLE_DRIVE_CREDENTIALS) {
    const credentials = JSON.parse(process.env.GOOGLE_DRIVE_CREDENTIALS);
    auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/drive"],
    });
  } else {
    auth = new google.auth.GoogleAuth({
      keyFile: "./keys/google-drive.json",
      scopes: ["https://www.googleapis.com/auth/drive"],
    });
  }
  return google.drive({ version: "v3", auth });
}

// ------------------------------------------------------------------
// Build an authenticated Drive client
// Prefers OAuth2 (stored refresh token) → falls back to service account.
// Service account fallback is only safe for READ operations on Shared Drives.
// For writes, use requireOAuthDriveClient() instead.
// ------------------------------------------------------------------
async function getDriveClient() {
  try {
    const result = await db.query(
      `SELECT value FROM platform_settings WHERE key = 'google_oauth_refresh_token' LIMIT 1`
    );

    if (result.rows.length && result.rows[0].value) {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_OAUTH_CLIENT_ID,
        process.env.GOOGLE_OAUTH_CLIENT_SECRET,
        process.env.GOOGLE_OAUTH_REDIRECT_URI
      );
      oauth2Client.setCredentials({ refresh_token: result.rows[0].value });

      try {
        await oauth2Client.getAccessToken();
        return google.drive({ version: "v3", auth: oauth2Client });
      } catch (tokenErr) {
        console.warn("⚠️  [DRIVE] OAuth token refresh failed, falling back to service account:", tokenErr.message);
      }
    }
  } catch (err) {
    console.warn("⚠️  [DRIVE] Could not load OAuth token from DB, falling back to service account:", err.message);
  }

  return getServiceAccountDriveClient();
}

// ------------------------------------------------------------------
// Like getDriveClient() but throws if OAuth isn't available.
// Use this for WRITE operations (upload, create folder) — service accounts
// cannot upload to personal My Drive folders (no storage quota).
// ------------------------------------------------------------------
async function requireOAuthDriveClient() {
  try {
    const result = await db.query(
      `SELECT value FROM platform_settings WHERE key = 'google_oauth_refresh_token' LIMIT 1`
    );

    if (result.rows.length && result.rows[0].value) {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_OAUTH_CLIENT_ID,
        process.env.GOOGLE_OAUTH_CLIENT_SECRET,
        process.env.GOOGLE_OAUTH_REDIRECT_URI
      );
      oauth2Client.setCredentials({ refresh_token: result.rows[0].value });

      try {
        await oauth2Client.getAccessToken();
        return google.drive({ version: "v3", auth: oauth2Client });
      } catch (tokenErr) {
        console.warn("⚠️  [DRIVE] OAuth token refresh failed:", tokenErr.message);
        const err = new Error("Google Drive authorization has expired. Please reconnect Google Drive in platform settings.");
        err.status = 503;
        err.needsReauth = true;
        throw err;
      }
    }
  } catch (err) {
    if (err.needsReauth) throw err;
    console.warn("⚠️  [DRIVE] Could not load OAuth token from DB:", err.message);
  }

  const err = new Error("Google Drive is not connected. Please connect Google Drive in platform settings.");
  err.status = 503;
  err.needsReauth = true;
  throw err;
}

// ------------------------------------------------------------------
// Build OAuth2 client for auth flow
// ------------------------------------------------------------------
function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI
  );
}

// ------------------------------------------------------------------
// Search for a folder by name under a parent — returns null if not found.
// supportsAllDrives + includeItemsFromAllDrives are required for
// Shared Drives; they are harmless on personal My Drive folders.
// ------------------------------------------------------------------
async function findFolder(folderName, parentFolderId) {
  const drive = await getDriveClient();
  const safeName = folderName.replace(/'/g, "\\'");

  const searchRes = await drive.files.list({
    q: `mimeType = 'application/vnd.google-apps.folder' and name = '${safeName}' and '${parentFolderId}' in parents and trashed = false`,
    fields: "files(id, name, webViewLink)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  return searchRes.data.files[0] || null;
}

// ------------------------------------------------------------------
// Get or create a folder by name under a parent folder.
// ------------------------------------------------------------------
async function getOrCreateFolder(folderName, parentFolderId) {
  const existing = await findFolder(folderName, parentFolderId);
  if (existing) return existing;

  const drive = await requireOAuthDriveClient();
  const createRes = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentFolderId],
    },
    fields: "id, name, webViewLink",
    supportsAllDrives: true,
  });

  return createRes.data;
}

// ------------------------------------------------------------------
// List files in a folder
// ------------------------------------------------------------------
async function listFilesInFolder(folderId) {
  const drive = await getDriveClient();

  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id, name, mimeType, webViewLink, thumbnailLink, createdTime, size)",
    orderBy: "createdTime desc",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  return res.data.files || [];
}

// ------------------------------------------------------------------
// Upload a file buffer to a folder
// ------------------------------------------------------------------
async function uploadFileToFolder(folderId, fileName, mimeType, buffer) {
  const drive = await requireOAuthDriveClient();
  const stream = Readable.from(buffer);

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: stream,
    },
    fields: "id, name, webViewLink, mimeType",
    supportsAllDrives: true,
  });

  return res.data;
}

module.exports = {
  getDriveClient,
  requireOAuthDriveClient,
  getOAuthClient,
  findFolder,
  getOrCreateFolder,
  listFilesInFolder,
  uploadFileToFolder,
};
