// ============================================================================
// File: src/company/CompanyModal.jsx
// Version: v1.8.6 - Add API key status indicator
// ============================================================================

console.log("📂 CompanyModal.jsx file loaded");

import React, { useEffect, useState } from "react";
import { useAuth } from "../AuthContext";
import UsersHome from "../users/UsersHome";
import EstimatorPricingModal from "./EstimatorPricingModal";
import EstimatorMasterModal from "./EstimatorMasterModal";

// Phone formatter utility
const formatPhoneNumber = (value) => {
  if (!value) return "";
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

export default function CompanyModal({
  mode, // "view" | "edit" | "create"
  company,
  onEdit,
  onClose,
  onSave,
}) {
  console.log("🎨 CompanyModal component rendering");
  console.log("🎨 Mode:", mode);
  console.log("🎨 Received company:", company);
  
  const { user, isMaster } = useAuth();
  // ... rest of code
  const isCreate = mode === "create";
  const isMasterUser = isMaster();
  const isAdminUser = user?.role === "admin";

  // ------------------------------------------------------------
  // SECTION STATE
  // ------------------------------------------------------------
  const [activeSection, setActiveSection] = useState("info");
  const [sectionMode, setSectionMode] = useState("view");

  const [form, setForm] = useState(null);
  const [ghlForm, setGhlForm] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // MODAL STATE
  const [showEstimatorPricing, setShowEstimatorPricing] = useState(false);
  const [showEstimatorMaster, setShowEstimatorMaster] = useState(false);

  // Track checkbox interaction
  const [suspendedTouched, setSuspendedTouched] = useState(false);

  // ------------------------------------------------------------
  // INIT FORM
  // ------------------------------------------------------------
  const [prevCompanyId, setPrevCompanyId] = useState(null);

 useEffect(() => {
  console.log("🔍 useEffect triggered");
  console.log("🔍 isCreate:", isCreate);
  console.log("🔍 company:", company);
  
  
  if (isCreate) {
    setActiveSection("info");
    setSectionMode("edit");
    setForm({
      name: "",
      phone: "",
      email: "",
      website: "",
      address: "",
      city: "",
      state: "",
      zip: "",
      suspended: false,
    });
setGhlForm({
  ghlApiKey: "",
  ghlLocationId: "",
  ghlInstallCalendar: "",
  ghlApptCalendar: "",
  ghlApptAssignedUser: "",
  ghlInstallAssignedUser: "",
  ghlApptTitleTemplate: "",
  ghlInstallTitleTemplate: "",
  ghlApptDescriptionTemplate: "",
  ghlInstallDescriptionTemplate: "",
});

    setSuspendedTouched(false);
    setPrevCompanyId(null);
    return;
  }

  if (company) {
    console.log("🔍 Company exists, setting form data");
    console.log("🔍 company.ghl_appt_calendar:", company.ghl_appt_calendar);
    console.log("🔍 company.ghl_install_calendar:", company.ghl_install_calendar);
    console.log("🔍 company.ghl_appt_assigned_user:", company.ghl_appt_assigned_user);
    console.log("🔍 company.ghl_install_assigned_user:", company.ghl_install_assigned_user);
      console.log("🔍 Company exists, setting form data");
  console.log("🔍 company.ghlApptTitleTemplate:", company.ghlApptTitleTemplate);
  console.log("🔍 company.ghlInstallTitleTemplate:", company.ghlInstallTitleTemplate);
  console.log("🔍 company.ghlApptDescriptionTemplate:", company.ghlApptDescriptionTemplate?.substring(0, 50));
  console.log("🔍 FULL COMPANY OBJECT:", company);

    setActiveSection("info");
    setSectionMode("view");

    setForm({
      name: company.name || "",
      phone: company.phone || "",
      email: company.email || "",
      website: company.website || "",
      address: company.address || "",
      city: company.city || "",
      state: company.state || "",
      zip: company.zip || "",
      suspended: company.suspended === true,
    });
console.log("🧠 Initializing GHL form from company:", {
  ghl_location_id: company.ghl_location_id,
  ghl_appt_calendar: company.ghl_appt_calendar,
  ghl_install_calendar: company.ghl_install_calendar,
});

    setGhlForm({
      ghlApiKey: company.ghl_api_key || "",
      ghlLocationId: company.ghl_location_id || "",
      ghlInstallCalendar: company.ghl_install_calendar || "",
      ghlApptCalendar: company.ghl_appt_calendar || "",
      ghlApptAssignedUser: company.ghl_appt_assigned_user || "",
      ghlInstallAssignedUser: company.ghl_install_assigned_user || "",
      ghlApptTitleTemplate: company.ghl_appt_title_template ?? "",
      ghlInstallTitleTemplate: company.ghl_install_title_template ?? "",

     ghlApptDescriptionTemplate: company.ghl_appt_description_template ?? "",
ghlInstallDescriptionTemplate: company.ghl_install_description_template ?? "",
    });
    
    console.log("🔍 setGhlForm called with data");

    setSuspendedTouched(false);
    setPrevCompanyId(company.id);
  }
}, [isCreate, company, company?.id, company?.updatedAt]);

if (!form) return null;
  // ------------------------------------------------------------
  // HANDLERS
  // ------------------------------------------------------------
  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError("");
    if (field === "suspended") {
      setSuspendedTouched(true);
    }
  };

  const handleGhlChange = (field, value) => {
    setGhlForm((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  const handleSave = async () => {
    if (!form.name) {
      setError("Company name is required");
      return;
    }

    if (saving) return;

    try {
      setSaving(true);
      setError("");

      const payload = {
        name: form.name,
        phone: form.phone || null,
        email: form.email || null,
        website: form.website || null,
        address: form.address || null,
        city: form.city || null,
        state: form.state || null,
        zip: form.zip || null,
        suspended: form.suspended,
      };

      await onSave(payload);
      setSectionMode("view");
    } catch (err) {
      console.error("Save company info error:", err);
      setError(err.message || "Failed to save company");
    } finally {
      setSaving(false);
    }
  };

const handleSaveGHLKeys = async () => {
  if (saving) return;

  try {
    setSaving(true);
    setError("");

    const payload = {
      name: form.name,
      phone: form.phone || null,
      email: form.email || null,
      website: form.website || null,
      address: form.address || null,
      city: form.city || null,
      state: form.state || null,
      zip: form.zip || null,
      suspended: form.suspended,
    };

    // Only include GHL fields if they have values (don't overwrite with null)
    if (ghlForm.ghlApiKey) {
      payload.ghl_api_key = ghlForm.ghlApiKey;
    }
    if (ghlForm.ghlLocationId) {
      payload.ghl_location_id = ghlForm.ghlLocationId;
    }
    if (ghlForm.ghlInstallCalendar) {
      payload.ghl_install_calendar = ghlForm.ghlInstallCalendar;
    }
    if (ghlForm.ghlApptCalendar) {
      payload.ghl_appt_calendar = ghlForm.ghlApptCalendar;
    }
    if (ghlForm.ghlApptAssignedUser) {
      payload.ghl_appt_assigned_user = ghlForm.ghlApptAssignedUser;
    }
    if (ghlForm.ghlInstallAssignedUser) {
      payload.ghl_install_assigned_user = ghlForm.ghlInstallAssignedUser;
    }
    if (ghlForm.ghlApptTitleTemplate) {
      payload.ghl_appt_title_template = ghlForm.ghlApptTitleTemplate;
    }
    if (ghlForm.ghlInstallTitleTemplate) {
      payload.ghl_install_title_template = ghlForm.ghlInstallTitleTemplate;
    }
    if (ghlForm.ghlApptDescriptionTemplate) {
      payload.ghl_appt_description_template = ghlForm.ghlApptDescriptionTemplate;
    }
    if (ghlForm.ghlInstallDescriptionTemplate) {
      payload.ghl_install_description_template = ghlForm.ghlInstallDescriptionTemplate;
    }

    await onSave(payload);
    setError("");
  } catch (err) {
    console.error("GHL save error:", err);
    setError(err.message || "Failed to save GHL keys");
  } finally {
    setSaving(false);
  }
};

  // ------------------------------------------------------------
  // UI HELPERS
  // ------------------------------------------------------------
  const sectionBtn = (active) =>
    `px-4 py-2 rounded-lg font-semibold text-sm transition ${
      active
        ? "bg-blue-600 text-white"
        : "bg-white text-gray-700 border border-gray-200 hover:border-blue-300 hover:bg-blue-50"
    }`;

  const viewLabel = "text-xs uppercase text-gray-500 font-semibold mb-1";
  const viewValue = "text-gray-900 font-medium mb-3";
  const editBox = "w-full px-3 py-2 border rounded-lg text-sm";

  // ------------------------------------------------------------
  // RENDER SECTIONS
  // ------------------------------------------------------------
  const renderCompanyInfo = () => {
    const isEditing = sectionMode === "edit";

    return (
      <div className="space-y-4">
        {error && (
          <div className="bg-red-50 border-l-4 border-red-600 p-3 text-red-800 text-sm">
            {error}
          </div>
        )}

        <div>
          <div className={viewLabel}>COMPANY NAME</div>
          {isEditing ? (
            <input
              className={editBox}
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
            />
          ) : (
            <div className={viewValue}>{form.name || "—"}</div>
          )}
        </div>

        <div>
          <div className={viewLabel}>PHONE</div>
          {isEditing ? (
            <input
              className={editBox}
              value={form.phone}
              onChange={(e) =>
                handleChange("phone", formatPhoneNumber(e.target.value))
              }
            />
          ) : (
            <div className={viewValue}>{form.phone || "—"}</div>
          )}
        </div>

        <div>
          <div className={viewLabel}>EMAIL</div>
          {isEditing ? (
            <input
              className={editBox}
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
            />
          ) : (
            <div className={viewValue}>{form.email || "—"}</div>
          )}
        </div>

        <div>
          <div className={viewLabel}>WEBSITE</div>
          {isEditing ? (
            <input
              className={editBox}
              value={form.website}
              onChange={(e) => handleChange("website", e.target.value)}
            />
          ) : (
            <div className={viewValue}>{form.website || "—"}</div>
          )}
        </div>

        <div>
          <div className={viewLabel}>ADDRESS</div>
          {isEditing ? (
            <input
              className={editBox}
              value={form.address}
              onChange={(e) => handleChange("address", e.target.value)}
            />
          ) : (
            <div className={viewValue}>{form.address || "—"}</div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className={viewLabel}>CITY</div>
            {isEditing ? (
              <input
                className={editBox}
                value={form.city}
                onChange={(e) => handleChange("city", e.target.value)}
              />
            ) : (
              <div className={viewValue}>{form.city || "—"}</div>
            )}
          </div>

          <div>
            <div className={viewLabel}>STATE</div>
            {isEditing ? (
              <input
                className={editBox}
                value={form.state}
                onChange={(e) => handleChange("state", e.target.value)}
              />
            ) : (
              <div className={viewValue}>{form.state || "—"}</div>
            )}
          </div>

          <div>
            <div className={viewLabel}>ZIP</div>
            {isEditing ? (
              <input
                className={editBox}
                value={form.zip}
                onChange={(e) => handleChange("zip", e.target.value)}
              />
            ) : (
              <div className={viewValue}>{form.zip || "—"}</div>
            )}
          </div>
        </div>

        {isMasterUser && sectionMode === "edit" && (
          <div className="pt-4 border-t">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.suspended}
                onChange={(e) => handleChange("suspended", e.target.checked)}
                className="w-5 h-5 text-blue-600 rounded"
              />
              <div>
                <div className="font-semibold text-gray-900">
                  Suspend Account
                </div>
                <div className="text-sm text-gray-600">
                  Prevent all users from this company from logging in
                </div>
              </div>
            </label>
          </div>
        )}
      </div>
    );
  };

const renderGHLKeys = () => {
    const hasApiKey = company?.ghl_api_key || company?.ghlApikey;

    return (
      <div className="space-y-4">
        {error && (
          <div className="bg-red-50 border-l-4 border-red-600 p-3 text-red-800 text-sm">
            {error}
          </div>
        )}

        <div className="bg-blue-50 border-l-4 border-blue-600 p-3 text-blue-800 text-sm mb-4">
          <strong>GoHighLevel Integration Settings</strong>
          <p className="mt-1">
            Enter your GHL API credentials to enable lead syncing and calendar integration.
          </p>
        </div>

        {/* API Credentials */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className={viewLabel}>GHL API KEY</div>
            {hasApiKey && (
              <div className="flex items-center gap-2 text-green-600 text-sm font-semibold">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                API Key Configured
              </div>
            )}
          </div>
          <input
            type="password"
            className={editBox}
            value={ghlForm.ghlApiKey}
            onChange={(e) => handleGhlChange("ghlApiKey", e.target.value)}
            placeholder={hasApiKey ? "Enter new key to replace existing" : "Enter your GoHighLevel API key"}
          />
          {hasApiKey && (
            <p className="text-xs text-gray-500 mt-1">
              Leave blank to keep existing key
            </p>
          )}
        </div>

        <div>
          <div className={viewLabel}>GHL LOCATION ID</div>
          <input
            className={editBox}
            value={ghlForm.ghlLocationId}
            onChange={(e) => handleGhlChange("ghlLocationId", e.target.value)}
            placeholder="Enter your GoHighLevel location ID"
          />
        </div>

        {/* Appointment Calendar Section */}
        <div className="border-t pt-4 mt-4">
          <h4 className="font-bold text-gray-700 mb-3">Appointment Calendar</h4>

          <div>
            <div className={viewLabel}>CALENDAR ID</div>
            <input
              className={editBox}
              value={ghlForm.ghlApptCalendar}
              onChange={(e) => handleGhlChange("ghlApptCalendar", e.target.value)}
              placeholder="Calendar ID for sales appointments"
            />
          </div>

          <div className="mt-3">
            <div className={viewLabel}>ASSIGNED USER ID</div>
            <input
              className={editBox}
              value={ghlForm.ghlApptAssignedUser}
              onChange={(e) => handleGhlChange("ghlApptAssignedUser", e.target.value)}
              placeholder="GHL User ID for appointment bookings"
            />
          </div>

          <div className="mt-3">
            <div className={viewLabel}>TITLE TEMPLATE</div>
            <input
              className={editBox}
              value={ghlForm.ghlApptTitleTemplate}
              onChange={(e) => handleGhlChange("ghlApptTitleTemplate", e.target.value)}
              placeholder="{{full_name}} - Appointment"
            />
          </div>

          <div className="mt-3">
            <div className={viewLabel}>DESCRIPTION TEMPLATE</div>
            <textarea
              className={`${editBox} font-mono text-xs`}
              rows="8"
              value={ghlForm.ghlApptDescriptionTemplate}
              onChange={(e) => handleGhlChange("ghlApptDescriptionTemplate", e.target.value)}
              placeholder="Customer: {{full_name}}&#10;Phone: {{phone}}&#10;Email: {{email}}&#10;&#10;Service Address:&#10;{{address}}&#10;{{city}}, {{state}} {{zip}}"
            />
            <p className="text-xs text-gray-500 mt-1">
              Available fields: {`{{full_name}}, {{phone}}, {{email}}, {{address}}, {{city}}, {{state}}, {{zip}}, {{square_footage}}, {{finish_type}}, {{notes}}`}
            </p>
          </div>
        </div>

        {/* Install Calendar Section */}
        <div className="border-t pt-4 mt-4">
          <h4 className="font-bold text-gray-700 mb-3">Install Calendar</h4>

          <div>
            <div className={viewLabel}>CALENDAR ID</div>
            <input
              className={editBox}
              value={ghlForm.ghlInstallCalendar}
              onChange={(e) => handleGhlChange("ghlInstallCalendar", e.target.value)}
              placeholder="Calendar ID for installation appointments"
            />
          </div>

          <div className="mt-3">
            <div className={viewLabel}>ASSIGNED USER ID</div>
            <input
              className={editBox}
              value={ghlForm.ghlInstallAssignedUser}
              onChange={(e) => handleGhlChange("ghlInstallAssignedUser", e.target.value)}
              placeholder="GHL User ID for install bookings"
            />
          </div>

          <div className="mt-3">
            <div className={viewLabel}>TITLE TEMPLATE</div>
            <input
              className={editBox}
              value={ghlForm.ghlInstallTitleTemplate}
              onChange={(e) => handleGhlChange("ghlInstallTitleTemplate", e.target.value)}
              placeholder="{{full_name}} - Install"
            />
          </div>

          <div className="mt-3">
            <div className={viewLabel}>DESCRIPTION TEMPLATE</div>
            <textarea
              className={`${editBox} font-mono text-xs`}
              rows="8"
              value={ghlForm.ghlInstallDescriptionTemplate}
              onChange={(e) => handleGhlChange("ghlInstallDescriptionTemplate", e.target.value)}
              placeholder="Customer: {{full_name}}&#10;Phone: {{phone}}&#10;Email: {{email}}&#10;&#10;Service Address:&#10;{{address}}&#10;{{city}}, {{state}} {{zip}}"
            />
            <p className="text-xs text-gray-500 mt-1">
              Available fields: {`{{full_name}}, {{phone}}, {{email}}, {{address}}, {{city}}, {{state}}, {{zip}}, {{square_footage}}, {{finish_type}}, {{notes}}`}
            </p>
          </div>
        </div>
      </div>
    );
  };

  // ------------------------------------------------------------
  // MODAL
  // ------------------------------------------------------------
  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
          <div className="bg-blue-600 text-white px-6 py-4 rounded-t-2xl">
            <h2 className="text-xl font-bold">
              {isCreate ? "Add Company" : form.name}
            </h2>
          </div>

          <div className="px-6 py-4 flex flex-wrap gap-2 border-b">
            <button
              className={sectionBtn(activeSection === "info")}
              onClick={() => {
                setActiveSection("info");
                setSectionMode("view");
              }}
            >
              Company Info
            </button>

            {isMasterUser && (
              <button
                className={sectionBtn(activeSection === "ghl")}
onClick={() => {
  setActiveSection("ghl");
  setSectionMode("edit");

  setGhlForm({
    ghlApiKey: company.ghlApiKey || "",
    ghlLocationId: company.ghlLocationId || "",
    ghlInstallCalendar: company.ghlInstallCalendar || "",
    ghlApptCalendar: company.ghlApptCalendar || "",
    ghlApptAssignedUser: company.ghlApptAssignedUser || "",
    ghlInstallAssignedUser: company.ghlInstallAssignedUser || "",
    ghlApptTitleTemplate: company.ghlApptTitleTemplate ?? "",
    ghlInstallTitleTemplate: company.ghlInstallTitleTemplate ?? "",
    ghlApptDescriptionTemplate: company.ghlApptDescriptionTemplate ?? "",
    ghlInstallDescriptionTemplate: company.ghlInstallDescriptionTemplate ?? "",
  });
}}


              >
                GHL Keys
              </button>
            )}

            {(isMasterUser || (isAdminUser && company?.estimatorEnabled)) && (
              <button
                className={sectionBtn(false)}
                onClick={() => setShowEstimatorPricing(true)}
              >
                Estimator
              </button>
            )}

{(isMasterUser || isAdminUser) && (
              <button
                className={sectionBtn(activeSection === "estimator")}
                onClick={() => {
                  setActiveSection("estimator");
                  setSectionMode("view");
                }}
              >
                Estimator Admin
              </button>
            )}

            {(isMasterUser || isAdminUser) && !isCreate && (
              <button
                className={sectionBtn(activeSection === "users")}
                onClick={() => {
                  setActiveSection("users");
                  setSectionMode("view");
                }}
              >
                Users
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {activeSection === "info" && renderCompanyInfo()}
            {activeSection === "ghl" && renderGHLKeys()}
            {activeSection === "users" && (
              <UsersHome scopedCompany={company} />
            )}
            {activeSection === "estimator" && (
              <div className="p-4">
                <button
                  onClick={() => setShowEstimatorPricing(true)}
                  className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl"
                >
                  Open Estimator Pricing Config
                </button>
                
                {isMasterUser && (
                  <button
                    onClick={() => setShowEstimatorMaster(true)}
                    className="w-full mt-3 px-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl"
                  >
                    Open Estimator Styling Config
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="border-t px-6 py-4 bg-white rounded-b-2xl flex justify-between">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 font-semibold"
            >
              Close
            </button>

            {activeSection === "info" && (
              <button
                onClick={() => {
                  if (sectionMode === "view") {
                    setSectionMode("edit");
                    if (onEdit) onEdit();
                  } else {
                    handleSave();
                  }
                }}
                className="px-6 py-2 rounded-lg bg-blue-600 text-white font-semibold"
                disabled={saving}
              >
                {sectionMode === "view"
                  ? "Edit Company Info"
                  : saving
                  ? "Saving…"
                  : "Save"}
              </button>
            )}

            {activeSection === "ghl" && (
              <button
                onClick={handleSaveGHLKeys}
                className="px-6 py-2 rounded-lg bg-blue-600 text-white font-semibold"
                disabled={saving}
              >
                {saving ? "Saving…" : "Save GHL Keys"}
              </button>
            )}
          </div>
        </div>
      </div>

      {showEstimatorPricing && (
        <EstimatorPricingModal
          company={company}
          onSave={onSave}
          onClose={() => setShowEstimatorPricing(false)}
        />
      )}

      {showEstimatorMaster && (
        <EstimatorMasterModal
          company={company}
          onSave={onSave}
          onClose={() => setShowEstimatorMaster(false)}
        />
      )}
    </>
  );
}