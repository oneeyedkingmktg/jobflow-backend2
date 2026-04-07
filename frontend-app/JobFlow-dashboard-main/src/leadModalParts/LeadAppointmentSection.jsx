// ============================================================================
// File: src/leadModalParts/LeadAppointmentSection.jsx
// Version: v1.0 – Fixed field names (appointmentDate/appointmentTime)
// ============================================================================

import React from "react";
import { formatInCompanyTimezone } from "../utils/timezone";
import { formatDate, formatTime } from "../utils/formatting.js";
import { useAuth } from "../AuthContext";


export default function LeadAppointmentSection({
  form,
  isEditing,
  setShowApptModal,
  setShowDateModal,
}) {
  const { user } = useAuth();
  const isEstimatorOnly = user?.planType === 'estimator_only';



  // =====================================================
  // Build display strings
  // =====================================================
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

  // Show warning when appointment is set but hasn't synced to GHL calendar
  const apptNotSynced = !isEditing &&
    form.appointmentDate &&
    !form.appointmentCalendarEventId &&
    form.appointmentDate !== form.lastSyncedAppointmentDate;

  return (
    <div className="w-full">
      {apptNotSynced && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 mb-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <span className="text-xs text-amber-700 font-medium">Appointment not synced to GHL calendar — tap to fix</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {/* APPOINTMENT BOX */}
        <button
          type="button"
          onClick={() => setShowApptModal(true)}
          className={`rounded-xl border px-3 py-3 text-left shadow-sm flex flex-col ${
            apptNotSynced
              ? 'bg-amber-50 border-amber-300'
              : 'bg-[#f5f6f7] border-gray-200'
          }`}
        >
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
            Appointment
            {apptNotSynced && (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            )}
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