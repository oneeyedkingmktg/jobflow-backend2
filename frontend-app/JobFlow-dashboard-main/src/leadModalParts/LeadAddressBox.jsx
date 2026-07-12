// ============================================================================
// File: src/leadModalParts/LeadAddressBox.jsx
// Version: v1.1 – Removed duplicate Call/Text buttons
// ============================================================================

import React, { useState, useEffect } from "react";
import { apiRequest } from "../api";

export default function LeadAddressBox({ form, onOpenMaps }) {
  const line2 = [form.city, form.state, form.zip].filter(Boolean).join(", ");

  const [driveTimeMinutes, setDriveTimeMinutes] = useState(form?.driveTimeMinutes ?? null);

  useEffect(() => {
    if (!form?.id || !form?.zip) return;
    if (form.driveTimeMinutes != null) {
      setDriveTimeMinutes(form.driveTimeMinutes);
      return;
    }
    apiRequest(`/leads/${form.id}/drive-time`)
      .then((data) => setDriveTimeMinutes(data?.driveTimeMinutes ?? null))
      .catch(() => {});
  }, [form?.id, form?.zip]);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 px-4 py-4 shadow-sm space-y-3">
      {/* Address section - clickable */}
      <div
        onClick={onOpenMaps}
        className="cursor-pointer hover:bg-gray-50 rounded-lg p-2 -m-2 transition"
      >
        <div className="text-blue-700 font-semibold text-base leading-tight mb-1">
          {form.name || ""}
        </div>
        <div className="text-gray-700 text-sm leading-tight">
          {form.address || "Address not set"}
        </div>
        <div className="text-gray-700 text-sm leading-tight">
          {line2 || "City, State ZIP"}
        </div>
      </div>

      {driveTimeMinutes != null && (
        <div className="text-sm text-gray-600 px-2">
          Jobsite is approximately <span className="font-semibold">{driveTimeMinutes} minutes</span> away
        </div>
      )}

      {/* Phone display */}
      <div className="pt-2 border-t">
        <div className="text-gray-800 text-sm font-semibold">
          {form.phone || "No phone"}
        </div>
      </div>
    </div>
  );
}