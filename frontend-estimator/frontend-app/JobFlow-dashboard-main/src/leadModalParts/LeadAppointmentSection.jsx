// ============================================================================
// File: src/leadModalParts/LeadAppointmentSection.jsx
// Version: v1.0 – Fixed field names (appointmentDate/appointmentTime)
// ============================================================================

import React from "react";

export default function LeadAppointmentSection({
  form,
  setShowApptModal,
  setShowDateModal,
}) {
  // =====================================================
  // SAFE DATE FORMATTER – NO TIMEZONE SHIFTING
  // Handles:
  //   "YYYY-MM-DD"
  //   "YYYY-MM-DD HH:mm:ss"
  //   "YYYY-MM-DDTHH:mm:ss.sssZ"
  //   "DD-MM-YY" / "DD-MM-YYYY"
  // =====================================================
  const formatDate = (d) => {
    if (!d) return "Not Set";

    const raw = String(d).trim();

    // Strip off any time / timezone chunk
    const base = raw.split("T")[0].split(" ")[0]; // e.g. "2025-12-12"

    const parts = base.split("-");
    if (parts.length === 3) {
      let [a, b, c] = parts;

      // Case: YYYY-MM-DD
      if (a.length === 4) {
        return `${b}/${c}/${a}`;
      }

      // Case: DD-MM-YYYY
      if (c.length === 4) {
        return `${b}/${a}/${c}`;
      }

      // Case: DD-MM-YY (25-12-16) → assume 20YY
      if (a.length === 2 && c.length === 2) {
        const year = `20${c}`;
        return `${b}/${a}/${year}`;
      }
    }

    // Fallback: show the cleaned base
    return base;
  };

  // =====================================================
  // TIME FORMATTER for display (HH:mm → h:mm AM/PM)
  // =====================================================
  const formatTime = (t) => {
    if (!t) return "";
    let [h, m] = String(t).split(":");
    h = parseInt(h, 10);

    if (Number.isNaN(h)) return t;

    const ampm = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;

    return `${hour12}:${m} ${ampm}`;
  };

  // =====================================================
  // Build display strings
  // =====================================================
  const apptDateDisplay = formatDate(form.appointmentDate);
  const apptTimeDisplay = form.appointmentTime ? formatTime(form.appointmentTime) : "";

  const installDateDisplay = form.installDate
    ? formatDate(form.installDate) +
      (form.installTentative ? " (Tentative)" : "")
    : "Not Set";

  return (
    <div className="w-full">
      <div className="grid grid-cols-2 gap-3">
        {/* APPOINTMENT BOX */}
        <button
          type="button"
          onClick={() => setShowApptModal(true)}
          className="bg-[#f5f6f7] rounded-xl border border-gray-200 px-3 py-3
                     text-left shadow-sm flex flex-col"
        >
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Appointment
          </div>

          {/* DATE */}
          <div className="mt-1 text-gray-900 text-sm font-semibold">
            {apptDateDisplay}
          </div>

          {/* TIME (optional) */}
          {apptTimeDisplay && (
            <div className="text-gray-700 text-sm">{apptTimeDisplay}</div>
          )}
        </button>

        {/* INSTALL BOX */}
        <button
          type="button"
          onClick={() => setShowDateModal("installDate")}
          className="bg-[#f5f6f7] rounded-xl border border-gray-200 px-3 py-3
                     text-left shadow-sm flex flex-col"
        >
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Install Date
          </div>

          <div className="mt-1 text-gray-900 text-sm font-semibold">
            {installDateDisplay}
          </div>
        </button>
      </div>
    </div>
  );
}