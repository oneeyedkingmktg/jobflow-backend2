// ============================================================================
// File: src/leadModalParts/LeadAppointmentSection.jsx
// Version: v1.0 – Fixed field names (appointmentDate/appointmentTime)
// ============================================================================

import React from "react";
import { formatDate, formatTime } from "../utils/formatting.js";
import { useAuth } from "../AuthContext";


export default function LeadAppointmentSection({
  form,
  setShowApptModal,
  setShowDateModal,
}) {
  const { user } = useAuth();
  const isEstimatorOnly = user?.planType === 'estimator_only';

  const apptDateDisplay = formatDate(form.appointmentDate);
  const apptTimeDisplay = form.appointmentTime ? formatTime(form.appointmentTime) : "";

  const installDateDisplay = form.installDate
    ? (form.installEndDate && form.installEndDate !== form.installDate
        ? `${formatDate(form.installDate)} – ${formatDate(form.installEndDate)}`
        : formatDate(form.installDate)) +
      (form.installTentative ? " (Tentative)" : "")
    : "Not Set";

  if (isEstimatorOnly) {
    return (
      <div className="w-full">
        <div className="grid grid-cols-2 gap-3">
          {["Appointment", "Install Date"].map((label) => (
            <div
              key={label}
              className="bg-gray-100 rounded-xl border border-gray-200 px-3 py-3 flex flex-col opacity-60 cursor-not-allowed"
            >
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</div>
              <div className="mt-1 text-gray-400 text-xs font-medium">Upgrade to Pro for scheduling</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-2 gap-3">
        {/* APPOINTMENT BOX */}
        <button
          type="button"
          onClick={() => setShowApptModal(true)}
          className="bg-[#f5f6f7] rounded-xl border border-gray-200 px-3 py-3 text-left shadow-sm flex flex-col"
        >
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Appointment
          </div>

          <div className="mt-1 text-gray-900 text-sm font-semibold">
            {apptDateDisplay}
          </div>

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
