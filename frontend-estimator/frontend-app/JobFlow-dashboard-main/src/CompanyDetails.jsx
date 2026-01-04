// File: src/CompanyDetails.jsx
import React, { useState, useEffect } from "react";

export default function CompanyDetails({ company, onBack, onSave, saving }) {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    timezone: "",
    sales_calendar: "",
    install_calendar: "",
    ghl_api_key: "",
    ghl_location_id: "",
    suspended: false,
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!company) return;

    setFormData({
      name: company.company_name || company.name || "",
      phone: company.phone || "",
      email: company.email || "",
      address: company.address || "",
      timezone: company.timezone || "",
      sales_calendar: company.sales_calendar || "",
      install_calendar: company.install_calendar || "",
      ghl_api_key: company.ghl_api_key || "",
      ghl_location_id: company.ghl_location_id || "",
      suspended: !!company.suspended,
    });
    setError("");
    setSuccess("");
  }, [company]);

  const handleChange = (field, value) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleCheckbox = (field) =>
    setFormData((prev) => ({ ...prev, [field]: !prev[field] }));

  const handleSave = async () => {
    setError("");
    setSuccess("");

    try {
      const payload = {
        ...formData,
        company_name: formData.name,
        name: formData.name,
      };

      await onSave(company.id, payload);

      setSuccess("Company updated successfully.");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.message || "Failed to save company.");
    }
  };

  const isSuspended = !!formData.suspended;

  if (!company) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          No company selected
        </h2>
        <p className="text-gray-600 mb-4">
          Go back to the list and choose a company to edit.
        </p>
        <button
          onClick={onBack}
          className="px-6 py-3 bg-gray-700 text-white rounded-lg font-bold"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <>
      {/* HEADER */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-2xl p-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">
            {formData.name || "Company Details"}
          </h2>
          <p className="text-blue-100 text-sm mt-1">Edit this company</p>
        </div>

        <button
          onClick={onBack}
          className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black"
        >
          Back
        </button>
      </div>

      {/* BODY */}
      <div className="p-6 space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border-l-4 border-red-600 rounded text-red-800">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 bg-green-50 border-l-4 border-green-600 rounded text-green-800">
            {success}
          </div>
        )}

        {/* STATUS */}
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                isSuspended
                  ? "bg-red-100 text-red-700"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {isSuspended ? "Suspended" : "Active"}
            </span>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formData.suspended}
                onChange={() => handleCheckbox("suspended")}
              />
              Suspended
            </label>
          </div>

          {saving && <p className="text-xs text-gray-500">Saving…</p>}
        </div>

        {/* BASIC INFO */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="font-semibold">Company Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              className="w-full px-4 py-3 border rounded-lg"
              placeholder="ProShield Floors"
            />
          </div>

          <div>
            <label className="font-semibold">Phone</label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
              className="w-full px-4 py-3 border rounded-lg"
              placeholder="555-123-4567"
            />
          </div>

          <div>
            <label className="font-semibold">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleChange("email", e.target.value)}
              className="w-full px-4 py-3 border rounded-lg"
              placeholder="owner@email.com"
            />
          </div>

          <div>
            <label className="font-semibold">Timezone</label>
            <input
              type="text"
              value={formData.timezone}
              onChange={(e) => handleChange("timezone", e.target.value)}
              className="w-full px-4 py-3 border rounded-lg"
              placeholder="America/Chicago"
            />
          </div>
        </div>

        {/* ADDRESS */}
        <div>
          <label className="font-semibold">Address</label>
          <textarea
            value={formData.address}
            onChange={(e) => handleChange("address", e.target.value)}
            className="w-full px-4 py-3 border rounded-lg h-24"
          />
        </div>

        {/* CALENDARS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="font-semibold">Sales Calendar</label>
            <input
              type="text"
              value={formData.sales_calendar}
              onChange={(e) => handleChange("sales_calendar", e.target.value)}
              className="w-full px-4 py-3 border rounded-lg"
            />
          </div>

          <div>
            <label className="font-semibold">Install Calendar</label>
            <input
              type="text"
              value={formData.install_calendar}
              onChange={(e) =>
                handleChange("install_calendar", e.target.value)
              }
              className="w-full px-4 py-3 border rounded-lg"
            />
          </div>
        </div>

        {/* GHL */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
          <div>
            <label className="font-semibold">
              Company GHL Location Code (ghl_api_key)
            </label>
            <input
              type="text"
              value={formData.ghl_api_key}
              onChange={(e) => handleChange("ghl_api_key", e.target.value)}
              className="w-full px-4 py-3 border rounded-lg font-mono text-sm"
            />
          </div>

          <div>
            <label className="font-semibold">GHL Location ID</label>
            <input
              type="text"
              value={formData.ghl_location_id}
              onChange={(e) =>
                handleChange("ghl_location_id", e.target.value)
              }
              className="w-full px-4 py-3 border rounded-lg font-mono text-sm"
            />
          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex justify-between pt-4 border-t">
          <button
            onClick={onBack}
            className="px-8 py-3 bg-gray-600 text-white rounded-lg font-bold"
          >
            Back
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold disabled:bg-blue-300"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </>
  );
}
