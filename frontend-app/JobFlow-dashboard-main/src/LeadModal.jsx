// ============================================================================
// File: src/LeadModal.jsx
// Version: v1.2 – Fixed save and exit functionality
// ============================================================================

import React, { useState } from "react";
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

export default function LeadModal({ lead, onSave, onSaveAndExit, onDelete, onClose }) {

  const { currentCompany } = useCompany();

const [form, setForm] = useState({
  ...lead,
  phone: formatPhoneNumber(lead?.phone || ""),
  hasEstimate: lead?.hasEstimate === true,
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

const handleSave = async () => {
  if (saving) return;
  setSaving(true);
  try {
    const updated = await onSave(form);
    if (updated) {
      setForm(p => ({ ...p, ...updated }));
    }
  } catch (error) {
    console.error("Save error:", error);
  } finally {
    setSaving(false);
  }
};


const handleSaveAndExit = async () => {
  console.log("🔥 handleSaveAndExit CALLED");
  if (saving) return;
  setSaving(true);
  try {
    console.log("💾 About to save:", form);
    const result = await onSaveAndExit(form);
    console.log("✅ Save completed:", result);
    
    console.log("🚪 About to call onClose");
    if (onClose) {
      onClose();
      console.log("✅ onClose called");
    } else {
      console.log("❌ onClose is undefined!");
    }
  } catch (error) {
    console.error("❌ Save and exit error:", error);
    alert("Error saving: " + error.message);
  } finally {
    setSaving(false);
    console.log("🏁 handleSaveAndExit finished, saving:", saving);
  }
};





  const handleNotSoldSelect = (reason) => {
    setForm(p => ({
      ...p,
      status: "not_sold",
      notSoldReason: reason
    }));
  };

  const handleOpenMaps = () => {
    const address = [form.address, form.city, form.state, form.zip]
      .filter(Boolean)
      .join(", ");
    if (address) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, "_blank");
    }
  };

  const handleOpenEstimate = async () => {
    if (!form.id || !form.hasEstimate) return;
    
    setLoadingEstimate(true);
    try {
      const res = await LeadsAPI.getEstimate(form.id);
      setEstimateData(res.estimate);
      setShowEstimateModal(true);
    } catch (error) {
      console.error("Error loading estimate:", error);
      alert("Failed to load estimate details");
    } finally {
      setLoadingEstimate(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40 pointer-events-none" />

      <div className="fixed inset-0 z-50 flex justify-center items-start p-4 overflow-auto pointer-events-auto">
        <div className="bg-[#f5f6f7] rounded-3xl shadow-2xl w-full max-w-3xl my-6">
          <LeadHeader
            name={form.name}
            status={form.status}
            phone={form.phone}
          />

          <div className="px-6 py-6 space-y-5">
<LeadStatusBar 
  form={form} 
  setForm={setForm}
  onOpenNotSold={() => setShowNotSoldModal(true)}
  onOpenApptModal={() => setShowApptModal(true)}
  onOpenInstallModal={() => setShowDateModal("install")}
 />


            <LeadAddressBox 
              form={form}
              onOpenMaps={handleOpenMaps}
            />
            
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
                  setForm(p => ({ ...p, [k]: v }))
                }
                onPhoneChange={(v) =>
                  setForm(p => ({
                    ...p,
                    phone: formatPhoneNumber(v),
                  }))
                }
              />
            ) : (
              <LeadDetailsView
                form={form}
                onEdit={() => setIsEditing(true)}
                onOpenEstimate={handleOpenEstimate}
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
        onNotSoldSelect={handleNotSoldSelect}
      />
    </>
  );
}