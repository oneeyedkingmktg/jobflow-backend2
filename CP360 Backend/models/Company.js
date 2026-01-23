// ============================================================================
// File: models/Company.js
// Purpose: Company field mapping
// ============================================================================

module.exports = {
  tableName: "companies",

  fields: {
    id: "id",
    companyName: "company_name",
    phone: "phone",
    email: "email",
    website: "website",
    address: "address",
    city: "city",
    state: "state",
    zip: "zip",
    timezone: "timezone",
    suspended: "suspended",

    // 🔑 Google Drive
    googleDriveBaseFolderId: "google_drive_base_folder_id",

    // GHL
    ghlApiKey: "ghl_api_key",
    ghlLocationId: "ghl_location_id",
    ghlInstallCalendar: "ghl_install_calendar",
    ghlApptCalendar: "ghl_appt_calendar",
    ghlApptAssignedUser: "ghl_appt_assigned_user",
    ghlInstallAssignedUser: "ghl_install_assigned_user",

    createdAt: "created_at",
    updatedAt: "updated_at",
    deletedAt: "deleted_at",
  },
};
