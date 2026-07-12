// ============================================================================
// File: src/LeadModal.jsx
// Version: v1.4 – Exit without saving + dirty check
// ============================================================================

import React, { useState, useRef } from "react";
import { useCompany } from "./CompanyContext";
import { formatPhoneNumber } from "./utils/formatting";
import { LeadsAPI } from "./api";
import { useSoftphone } from "./hooks/useSoftphone.js";
import { isNativeApp } from "./utils/platform";
import ConversationModal from "./leadModalParts/ConversationModal.jsx";
import SoftphoneWidget from "./components/SoftphoneWidget.jsx";

import LeadHeader from "./leadModalParts/LeadHeader.jsx";
import LeadAddressBox from "./leadModalParts/LeadAddressBox.jsx";
import LeadContactSection from "./leadModalParts/LeadContactSection.jsx";
import LeadAppointmentSection from "./leadModalParts/LeadAppointmentSection.jsx";
import LeadDetailsEdit from "./leadModalParts/LeadDetailsEdit.jsx";
import LeadDetailsView from "./leadModalParts/LeadDetailsView.jsx";
import LeadFooter from "./leadModalParts/LeadFooter.jsx";
import LeadModalsWrapper from "./leadModalParts/LeadModalsWrapper.jsx";
import LeadStatusBar from "./leadModalParts/LeadStatusBar.jsx";
import EstimateModal from "./EstimateModal.jsx";
import PauseModal from "./leadModalParts/PauseModal.jsx";

export default function LeadModal({
  lead,
  onSave,
  onSaveAndExit,
  onDelete,
  onJunk,
  onReinstate,
  onClose,
  onServiceCallsChange,
}) {
  const { currentCompany } = useCompany();
  const softphone = useSoftphone();

  const initialFormRef = useRef(null);

  const [form, setForm] = useState(() => {
    const f = {
      ...lead,
      phone: formatPhoneNumber(lead?.phone || ""),
      hasEstimate: lead?.hasEstimate === true,
    };
    initialFormRef.current = JSON.stringify(f);
    return f;
  });

  const [isEditing, setIsEditing] = useState(!lead?.id);
  const [saving, setSaving] = useState(false);

  const [showEstimateModal, setShowEstimateModal] = useState(false);
  const [estimateData, setEstimateData] = useState(null);
  const [loadingEstimate, setLoadingEstimate] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [showDateModal, setShowDateModal] = useState(null);
  const [showApptModal, setShowApptModal] = useState(false);
  const [showNotSoldModal, setShowNotSoldModal] = useState(false);
const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [showConversationModal, setShowConversationModal] = useState(false);
  const [pendingCall, setPendingCall] = useState(null);


  const isDirty =
    JSON.stringify(form) !== initialFormRef.current;

  // ------------------------------------------------------------------
  // Exit without saving
  // ------------------------------------------------------------------
// X button always shows the save-or-discard choice modal
const handleExitWithoutSave = () => {
  setShowDiscardModal(true);
};

// Footer "Exit" button — close immediately without saving
const handleExitNoSave = () => {
  onClose?.();
};


  // ------------------------------------------------------------------
  // Save handlers
  // ------------------------------------------------------------------
  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const updated = await onSave(form);
      if (updated) {
        const merged = { ...form, ...updated };
        setForm(merged);
        initialFormRef.current = JSON.stringify(merged);
      }
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const confirmDiscardChanges = () => {
  setShowDiscardModal(false);
  onClose?.();
};

const cancelDiscardChanges = () => {
  setShowDiscardModal(false);
};


  const handleSaveAndExit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const updated = await onSaveAndExit(form);
      if (updated) {
        initialFormRef.current = JSON.stringify(updated);
      }
      onClose?.();
    } finally {
      setSaving(false);
    }
  };

  // ------------------------------------------------------------------
  // Utility handlers
  // ------------------------------------------------------------------
  const handleCall = () => {
    if (!form.phone) return;
    if (isNativeApp()) {
      setPendingCall({ phone: form.phone.replace(/\D/g, ""), name: form.name || form.full_name || "" });
    } else {
      window.location.href = `tel:${form.phone.replace(/\D/g, "")}`;
    }
  };

  const handleText = () => {
    if (!form.phone) return;
    if (isNativeApp()) {
      setShowConversationModal(true);
    } else {
      window.location.href = `sms:${form.phone.replace(/\D/g, "")}`;
    }
  };

  const handleOpenMaps = () => {
    const address = [form.address, form.city, form.state, form.zip]
      .filter(Boolean)
      .join(", ");
    if (address) {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          address
        )}`,
        "_blank"
      );
    }
  };

const handlePauseSave = (pauseFields) => {
    setForm((prev) => ({ ...prev, ...pauseFields }));
  };

  const handleOpenEstimate = async () => {
    if (!form.id || !form.hasEstimate) return;
    setLoadingEstimate(true);
    try {
      const res = await LeadsAPI.getEstimate(form.id);
      setEstimateData(res.estimate);
      setShowEstimateModal(true);
    } finally {
      setLoadingEstimate(false);
    }
  };






  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" />

      <div className="fixed inset-0 z-50 flex justify-center items-start p-4 overflow-auto">
        <div className="bg-[#f5f6f7] rounded-3xl shadow-2xl w-full max-w-3xl my-6 relative">

          {/* ✕ CLOSE */}
<button
  onClick={handleExitWithoutSave}
  aria-label="Close"
  className="
    absolute top-4 right-4
    text-4xl font-bold
    text-black
    leading-none
    drop-shadow-[0_0_1px_white]
    hover:opacity-80
  "
>
  ×
</button>


<LeadHeader
  name={form.name}
  status={form.status}
  phone={form.phone}
  onCall={handleCall}
  onText={handleText}
  onMap={handleOpenMaps}
  isPaused={form.pauseStatus === "Paused"}
  pauseUntil={form.pauseUntil || null}
  isOutOfArea={form.outOfArea === true}
  proceedWithAutomation={form.proceedWithAutomation}
  dateCompleted={form.dateCompleted || form.date_completed || null}
/>



          <div className="px-6 py-6 space-y-5">
            <LeadStatusBar
              form={form}
              setForm={setForm}
              onOpenNotSold={() => setShowNotSoldModal(true)}
              onOpenApptModal={() => setShowApptModal(true)}
              onOpenInstallModal={() => setShowDateModal("installDate")}
            />

            <LeadAddressBox form={form} onOpenMaps={handleOpenMaps} />

            <LeadContactSection form={form} />

            <LeadAppointmentSection
              form={form}
              setShowApptModal={setShowApptModal}
              setShowDateModal={setShowDateModal}
              onServiceCallsChange={onServiceCallsChange}
            />

            {isEditing ? (
              <LeadDetailsEdit
                form={form}
                onChange={(k, v) =>
                  setForm((p) => ({ ...p, [k]: v }))
                }
                onPhoneChange={(v) =>
                  setForm((p) => ({
                    ...p,
                    phone: formatPhoneNumber(v),
                  }))
                }
              />
            ) : (
<LeadDetailsView
  form={form}
  onEdit={() => setIsEditing(true)}
  showConversations={currentCompany?.showConversations || false}
/>

            )}

<LeadFooter
              isEditing={isEditing}
              onSave={handleSave}
              onExit={handleSaveAndExit}
              onExitWithoutSaving={handleExitNoSave}
              onEdit={() => setIsEditing(true)}
              onDelete={() => onDelete(form)}
              onJunk={onJunk ? () => onJunk(form) : null}
              isJunk={form?.status === 'status_junk'}
              onReinstate={onReinstate ? () => onReinstate(form) : null}
              onPause={() => setShowPauseModal(true)}
              deleteConfirm={deleteConfirm}
              setDeleteConfirm={setDeleteConfirm}
              saving={saving}
            />
          </div>
        </div>
      </div>

      {showPauseModal && (
        <PauseModal
          form={form}
          onSave={handlePauseSave}
          onClose={() => setShowPauseModal(false)}
        />
      )}

      {showConversationModal && (
        <ConversationModal
          lead={form}
          onClose={() => setShowConversationModal(false)}
        />
      )}

      <SoftphoneWidget
        callState={softphone.callState}
        callerNumber={softphone.callerNumber}
        callerName={softphone.callerName}
        formattedTime={softphone.formattedTime}
        isMuted={softphone.isMuted}
        isSpeaker={softphone.isSpeaker}
        isConnected={softphone.isConnected}
        isDialing={softphone.isDialing}
        isIncoming={softphone.isIncoming}
        onHangup={softphone.hangup}
        onAnswer={softphone.answerCall}
        onDecline={softphone.declineCall}
        onToggleMute={softphone.toggleMute}
        onToggleSpeaker={softphone.toggleSpeaker}
        onSendDtmf={softphone.sendDtmf}
        pendingCall={pendingCall}
        onConfirmCall={() => {
          setPendingCall(null);
          softphone.makeCall(pendingCall.phone, pendingCall.name).catch((err) => {
            console.error('[makeCall failed]', err);
            alert('Call failed: ' + (err?.message || 'Unknown error'));
          });
        }}
        onCancelCall={() => setPendingCall(null)}
      />

      {showEstimateModal && estimateData && (
        <EstimateModal
          estimate={estimateData}
          onClose={() => {
            setShowEstimateModal(false);
            setEstimateData(null);
          }}
        />
      )}

      <LeadModalsWrapper
        form={form}
        setForm={setForm}
        showDateModal={showDateModal}
        setShowDateModal={setShowDateModal}
        showApptModal={showApptModal}
        setShowApptModal={setShowApptModal}
        showNotSoldModal={showNotSoldModal}
        setShowNotSoldModal={setShowNotSoldModal}
      />
      {showDiscardModal && (
  <div className="fixed inset-0 z-[60] flex items-center justify-center">
    <div className="absolute inset-0 bg-black/50" onClick={cancelDiscardChanges} />
    <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-1 text-center">
        Exit this record?
      </h3>
      <p className="text-sm text-gray-500 mb-6 text-center">
        Choose how you'd like to leave.
      </p>

      <div className="flex flex-col gap-3">
        <button
          onClick={async () => {
            setShowDiscardModal(false);
            await handleSaveAndExit();
          }}
          disabled={saving}
          className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold text-sm hover:bg-green-700 transition disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save & Exit"}
        </button>
        <button
          onClick={confirmDiscardChanges}
          className="w-full py-3 bg-gray-100 text-gray-800 rounded-xl font-semibold text-sm hover:bg-gray-200 transition"
        >
          Exit Without Saving
        </button>
        <button
          onClick={cancelDiscardChanges}
          className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition"
        >
          Cancel — keep editing
        </button>
      </div>
    </div>
  </div>
)}

    </>
  );
}
