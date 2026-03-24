// ============================================================================
// File: controllers/googleDrive.js
// Purpose: Google Drive folder creation + file listing + file upload
// ============================================================================

const { google } = require("googleapis");
const { Readable } = require("stream");

// Load credentials from environment variable or local file
let auth;
if (process.env.GOOGLE_DRIVE_CREDENTIALS) {
  const credentials = JSON.parse(process.env.GOOGLE_DRIVE_CREDENTIALS);
  auth = new google.auth.GoogleAuth({
    credentials: credentials,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
} else {
  auth = new google.auth.GoogleAuth({
    keyFile: "./keys/google-drive.json",
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
}

const drive = google.drive({
  version: "v3",
  auth,
});

// ------------------------------------------------------------------
// Get or create a folder by name under a parent folder
// ------------------------------------------------------------------
async function getOrCreateFolder(folderName, parentFolderId) {
  const searchRes = await drive.files.list({
    q: `
      mimeType = 'application/vnd.google-apps.folder'
      and name = '${folderName}'
      and '${parentFolderId}' in parents
      and trashed = false
    `,
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
  getOrCreateFolder,
  listFilesInFolder,
  uploadFileToFolder,
};
