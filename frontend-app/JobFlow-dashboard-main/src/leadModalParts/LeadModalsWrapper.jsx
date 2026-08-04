// ============================================================================
// File: src/leadModalParts/LeadModalsWrapper.jsx
// Version: v1.0 – Fixed field names (appointmentDate/appointmentTime)
// ============================================================================

import React from "react";
import DateModal from "../DateModal.jsx";
import ApptDateTimeModal from "../ApptDateTimeModal.jsx";

export default function LeadModalsWrapper({
  form,
  setForm,
  showDateModal,
  setShowDateModal,
  showApptModal,
  setShowApptModal,
  showNotSoldModal,
  setShowNotSoldModal,
  onNotSoldSelect,
}) {
  return (
    <>
      {/* DATE MODAL (Install / Appointment Date) */}
      {showDateModal && (
        <DateModal
          initialDate={form[showDateModal]}
          initialTentative={
            showDateModal === "installDate" ? form.installTentative : false
          }
          initialEndDate={
            showDateModal === "installDate" ? (form.installEndDate || null) : null
          }
          initialDurationDays={
            showDateModal === "installDate" ? (form.installDurationDays || 1) : 1
          }
          allowTentative={showDateModal === "installDate"}
          label={
            showDateModal === "installDate"
              ? "Set Install Date"
              : "Select Date"
          }
          onConfirm={(date, tentative, durationDays, endDate) => {
            setForm((prev) => ({
              ...prev,
              [showDateModal]: date,
              installTentative: tentative || false,
              ...(showDateModal === "installDate" ? {
                installDurationDays: durationDays || 1,
                installEndDate: endDate || null,
              } : {}),
            }));
            setShowDateModal(null);
          }}
          onRemove={() => {
            setForm((prev) => ({
              ...prev,
              [showDateModal]: "",
              installTentative: false,
              ...(showDateModal === "installDate" ? { installEndDate: null, installDurationDays: 1 } : {}),
            }));
            setShowDateModal(null);
          }}
          onClose={() => setShowDateModal(null)}
        />
      )}

      {/* APPOINTMENT DATE/TIME MODAL */}
      {showApptModal && (
        <ApptDateTimeModal
          apptDate={form.appointmentDate}
          apptTime={form.appointmentTime}
          salesmanId={form.appointmentSalesmanId || null}
          companyId={form.companyId}
          excludeLeadId={form.id || null}
          onConfirm={(date, time, salesmanId) => {
            setForm((prev) => ({
              ...prev,
              appointmentDate: date,
              appointmentTime: time,
              appointmentSalesmanId: salesmanId || null,
            }));
            setShowApptModal(false);
          }}
          onRemove={() => {
            setForm((prev) => ({
              ...prev,
              appointmentDate: "",
              appointmentTime: "",
              appointmentSalesmanId: null,
            }));
            setShowApptModal(false);
          }}
          onClose={() => setShowApptModal(false)}
        />
      )}

    </>
  );
}