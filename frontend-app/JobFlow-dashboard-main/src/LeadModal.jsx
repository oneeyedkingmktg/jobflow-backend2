// ============================================================================
// File: src/LeadModal.jsx
// Version: v1.4 – Exit without saving + dirty check
// ============================================================================

import React, { useState, useRef } from "react";
import { useCompany } from "./CompanyContext";
import { formatPhoneNumber } from "./utils/formatting";
import { LeadsAPI } from "./api";

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

export default function LeadModal({
  lead,
  onSave,
  onSaveAndExit,
  onDelete,
  onClose,
}) {
  const { currentCompany } = useCompany();

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


  const isDirty =
    JSON.stringify(form) !== initialFormRef.current;

  // ------------------------------------------------------------------
  // Exit without saving
  // ------------------------------------------------------------------
const handleExitWithoutSave = () => {
  if (isEditing && isDirty) {
    setShowDiscardModal(true);
    return;
  }
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
    window.location.href = `tel:${form.phone.replace(/\D/g, "")}`;
  };

  const handleText = () => {
    if (!form.phone) return;
    window.location.href = `sms:${form.phone.replace(/\D/g, "")}`;
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
// Upload photos (placeholder – Drive logic comes later)
// ------------------------------------------------------------------
const handleUploadPhotos = async () => {
  try {
    if (!form?.id) {
      alert("Lead must be saved before uploading photos.");
      return;
    }

    const res = await fetch(
      `${import.meta.env.VITE_API_URL}/google-drive/lead-folder`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          leadId: form.id,
        }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "Upload failed");
    }

    const data = await res.json();

    if (!data?.url) {
      throw new Error("No Drive URL returned");
    }

    window.open(data.url, "_blank");
  } catch (err) {
    console.error("Upload error:", err);
    alert("Failed to open Google Drive.");
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
  onUploadPhotos={handleUploadPhotos}
/>

            )}

            <LeadFooter
              isEditing={isEditing}
              onSave={handleSave}
              onExit={handleSaveAndExit}
              onEdit={() => setIsEditing(true)}
              onDelete={() => onDelete(form)}
              deleteConfirm={deleteConfirm}
              setDeleteConfirm={setDeleteConfirm}
              saving={saving}
            />
          </div>
        </div>
      </div>

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
    {/* Backdrop */}
    <div
      className="absolute inset-0 bg-black/40"
      onClick={cancelDiscardChanges}
    />

    {/* Modal */}
    <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        Discard changes?
      </h3>

      <p className="text-sm text-gray-600 mb-6">
        You have unsaved changes. If you exit now, they will be lost.
      </p>

      <div className="flex justify-end gap-3">
        <button
          onClick={cancelDiscardChanges}
          className="px-4 py-2 rounded-xl bg-gray-100 text-gray-800 hover:bg-gray-200"
        >
          Cancel
        </button>

        <button
          onClick={confirmDiscardChanges}
          className="px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700"
        >
          Discard
        </button>
      </div>
    </div>
  </div>
)}

    </>
  );
}
