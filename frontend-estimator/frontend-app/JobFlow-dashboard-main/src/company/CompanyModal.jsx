// ============================================================================
// File: src/company/CompanyModal.jsx
// Version: v1.8.6 - Add API key status indicator
// ============================================================================

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
  const { user, isMaster } = useAuth();
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
      });
      setSuspendedTouched(false);
      setPrevCompanyId(null);
      return;
    }

    if (company) {
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

      setGhlForm({
        ghlApiKey: company.ghlApikey || "",
        ghlLocationId: company.ghlLocationId || "",
        ghlInstallCalendar: company.ghlInstallCalendar || "",
        ghlApptCalendar: company.ghlApptCalendar || "",
      });

      setSuspendedTouched(false);
      setPrevCompanyId(company.id);
    }
  }, [isCreate, company]);

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
        ghl_api_key: ghlForm.ghlApiKey || null,
        ghl_location_id: ghlForm.ghlLocationId || null,
        ghl_install_calendar: ghlForm.ghlInstallCalendar || null,
        ghl_appt_calendar: ghlForm.ghlApptCalendar || null,
      };

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

        <div>
          <div className={viewLabel}>INSTALL CALENDAR ID</div>
          <input
            className={editBox}
            value={ghlForm.ghlInstallCalendar}
            onChange={(e) => handleGhlChange("ghlInstallCalendar", e.target.value)}
            placeholder="Calendar ID for installation appointments"
          />
        </div>

        <div>
          <div className={viewLabel}>APPOINTMENT CALENDAR ID</div>
          <input
            className={editBox}
            value={ghlForm.ghlApptCalendar}
            onChange={(e) => handleGhlChange("ghlApptCalendar", e.target.value)}
            placeholder="Calendar ID for sales appointments"
          />
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

            {isMasterUser && (
              <button
                className={sectionBtn(false)}
                onClick={() => setShowEstimatorMaster(true)}
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