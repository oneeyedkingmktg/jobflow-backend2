// ============================================================================
// File: src/leadModalParts/LeadAppointmentSection.jsx
// Version: v1.0 – Fixed field names (appointmentDate/appointmentTime)
// ============================================================================

import React from "react";
import { formatInCompanyTimezone } from "../utils/timezone";


export default function LeadAppointmentSection({
  form,
  setShowApptModal,
  setShowDateModal,
}) {



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