// ============================================================================
// File: controllers/googleDrive.js
// Purpose: Google Drive operations using OAuth2 (Becky's account) with
//          service account fallback for read-only operations
// ============================================================================

const { google } = require("googleapis");
const { Readable } = require("stream");
const db = require("../config/database");

// ------------------------------------------------------------------
// Build an authenticated Drive client
// Prefers OAuth2 (Becky's account) → falls back to service account
// ------------------------------------------------------------------
async function getDriveClient() {
  // Try stored OAuth refresh token first
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
      return google.drive({ version: "v3", auth: oauth2Client });
    }
  } catch (err) {
    console.warn("⚠️  Could not load OAuth token from DB, falling back to service account:", err.message);
  }

  // Fall back to service account (read-only operations still work)
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
// Get or create a folder by name under a parent folder
// ------------------------------------------------------------------
async function getOrCreateFolder(folderName, parentFolderId) {
  const drive = await getDriveClient();

  // Escape single quotes in folder name to prevent query injection
  const safeName = folderName.replace(/'/g, "\\'");

  const searchRes = await drive.files.list({
    q: `mimeType = 'application/vnd.google-apps.folder' and name = '${safeName}' and '${parentFolderId}' in parents and trashed = false`,
    fields: "files(id, name, webViewLink)",
  });

  if (searchRes.data.files.length > 0) {
    return searchRes.data.files[0];
  }

  const createRes = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentFolderId],
    },
    fields: "id, name, webViewLink",
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
  });

  return res.data.files || [];
}

// ------------------------------------------------------------------
// Upload a file buffer to a folder
// ------------------------------------------------------------------
async function uploadFileToFolder(folderId, fileName, mimeType, buffer) {
  const drive = await getDriveClient();
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
  });

  return res.data;
}

module.exports = {
  getDriveClient,
  getOAuthClient,
  getOrCreateFolder,
  listFilesInFolder,
  uploadFileToFolder,
};
