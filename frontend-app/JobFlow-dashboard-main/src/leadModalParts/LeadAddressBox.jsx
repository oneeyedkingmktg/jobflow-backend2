import React from "react";

export default function LeadAddressBox({ form, onOpenMaps }) {
  const line2 = [form.city, form.state, form.zip].filter(Boolean).join(", ");

  const handleCall = (e) => {
    e.stopPropagation();
    if (form.phone) {
      const cleanPhone = form.phone.replace(/\D/g, '');
      window.location.href = `tel:${cleanPhone}`;
    }
  };

  const handleText = (e) => {
    e.stopPropagation();
    if (form.phone) {
      const cleanPhone = form.phone.replace(/\D/g, '');
      window.location.href = `sms:${cleanPhone}`;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 px-4 py-4 shadow-sm space-y-3">
      {/* Address section - clickable */}
      <div
        onClick={onOpenMaps}
        className="cursor-pointer hover:bg-gray-50 rounded-lg p-2 -m-2 transition"
      >
        <div className="text-xs text-gray-500 mb-1">📍 Tap to open in Maps</div>
        <div className="text-blue-700 font-semibold text-base leading-tight">
          {form.address || "Address not set"}
        </div>
        <div className="text-gray-700 text-sm leading-tight">
          {line2 || "City, State ZIP"}
        </div>
      </div>

      {/* Phone with action buttons */}
      <div className="flex items-center justify-between gap-3 pt-2 border-t">
        <div className="text-gray-800 text-sm font-semibold">
          {form.phone || "No phone"}
        </div>
        
        {form.phone && (
          <div className="flex gap-2">
            <button
              onClick={handleCall}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition"
            >
              Call
            </button>
            <button
              onClick={handleText}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition"
            >
              Text
            </button>
          </div>
        )}
      </div>
    </div>
  );
}