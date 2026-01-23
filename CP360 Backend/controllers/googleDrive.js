// ============================================================================
// File: controllers/googleDrive.js
// Purpose: Google Drive folder creation + reuse for lead uploads
// ============================================================================

const { google } = require("googleapis");

// Create Drive auth from environment variable or local file
let credentials;
if (process.env.GOOGLE_DRIVE_CREDENTIALS) {
  // Production: Use environment variable
  credentials = JSON.parse(process.env.GOOGLE_DRIVE_CREDENTIALS);
} else {
  // Local development: Use file
  credentials = require("../keys/google-drive.json");
}

const auth = new google.auth.GoogleAuth({
  credentials: credentials,
  scopes: ["https://www.googleapis.com/auth/drive"],
});

const drive = google.drive({
  version: "v3",
  auth,
});

// ------------------------------------------------------------------
// Get or create a folder by name under a parent folder
// ------------------------------------------------------------------
async function getOrCreateFolder(folderName, parentFolderId) {
  // Look for existing folder
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

  // Create folder if not found
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

module.exports = {
  getOrCreateFolder,
};
