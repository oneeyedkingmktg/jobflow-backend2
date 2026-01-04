import React from "react";

export default function LeadAddressBox({ form, onOpenMaps }) {
  const line2 = [form.city, form.state, form.zip].filter(Boolean).join(", ");

  return (
    <div
      onClick={onOpenMaps}
      className="bg-white rounded-xl border border-gray-200 px-4 py-4 shadow-sm cursor-pointer hover:border-blue-500 transition"
    >
      {/* Tap to open */}
      <div className="text-xs text-gray-500 mb-1">📍 Tap to open in Maps</div>

      {/* Address */}
      <div className="text-blue-700 font-semibold text-base leading-tight">
        {form.address || "Address not set"}
      </div>

      {/* City / State / Zip */}
      <div className="text-gray-700 text-sm leading-tight">
        {line2 || "City, State ZIP"}
      </div>

      {/* Phone number — moved inside box */}
      <div className="text-gray-800 text-sm font-semibold mt-2">
        {form.phone || "No phone"}
      </div>
    </div>
  );
}
