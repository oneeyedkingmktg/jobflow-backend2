// ============================================================================
// File: src/leadModalParts/LeadDetailsView.jsx
// Version: v1.5 – Estimate + Upload buttons aligned
// ============================================================================

import React, { useState } from "react";
import EstimateModal from "../EstimateModal.jsx";

export default function LeadDetailsView({
  form,
  onEdit,
  onUploadPhotos,
}) {
  const hasEstimate = form?.hasEstimate === true;
  const [showEstimateModal, setShowEstimateModal] = useState(false);
  const [estimateData, setEstimateData] = useState(null);

  const loadEstimate = async () => {
    try {
      const { apiRequest } = await import("../api.js");
      const data = await apiRequest(`/leads/estimator/${form.id}`);
      setEstimateData(data);
      setShowEstimateModal(true);
    } catch (err) {
      console.error("Failed to load estimate:", err);
      alert("Could not load estimate details");
    }
  };

  const formatProjectType = (type) => {
    if (!type) return "Not Set";
    if (type.startsWith("garage_")) {
      const carCount = type.split("_")[1];
      return `${carCount} Car Garage`;
    }
    if (type === "patio") return "Patio";
    if (type === "basement") return "Basement";
    if (type === "commercial") return "Commercial";
    if (type === "custom") return "Custom Project";
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <>
      {/* MAIN DETAILS CARD */}
      <div
        className="bg-[#f5f6f7] rounded-2xl border border-gray-200 px-5 py-5 
                   shadow-sm text-sm text-gray-800 space-y-4 cursor-pointer 
                   hover:shadow-md transition-shadow"
        onClick={onEdit}
      >
        <div>
          <span className="text-gray-500 block">Email</span>
          <span className="font-semibold break-words">
            {form.email || "Not Set"}
          </span>
        </div>

        <div>
          <span className="text-gray-500 block">Buyer Type</span>
          <span className="font-semibold break-words">
            {form.buyerType || "Not Set"}
          </span>
        </div>

        {form.companyName && (
          <div>
            <span className="text-gray-500 block">Company</span>
            <span className="font-semibold break-words">
              {form.companyName}
            </span>
          </div>
        )}

        <div>
          <span className="text-gray-500 block">Project Type</span>
          <span className="font-semibold break-words">
            {formatProjectType(form.projectType)}
          </span>
        </div>

        <div>
          <span className="text-gray-500 block">Contract Price</span>
          <span className="font-semibold break-words">
            {form.contractPrice
              ? `$${Number(form.contractPrice).toLocaleString()}`
              : "Not Set"}
          </span>
        </div>

        <div>
          <span className="text-gray-500 block">Notes</span>
          <p className="font-semibold whitespace-pre-line mt-1 break-words">
            {form.notes?.trim() ? form.notes : "No notes added"}
          </p>
        </div>

        <div>
          <span className="text-gray-500 block">Lead Source</span>
          <span className="font-semibold break-words">
            {form.referralSource || "Not Set"}
          </span>
        </div>
      </div>

      {/* ONLINE ESTIMATE BUTTON */}
      {hasEstimate && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            loadEstimate();
          }}
          className="w-full mt-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white 
                     rounded-xl px-5 py-4 shadow-sm hover:from-blue-700 hover:to-blue-800 
                     transition font-bold"
        >
          Online Estimate Exists for this Lead
        </button>
      )}

      {/* UPLOAD PHOTOS BUTTON */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onUploadPhotos?.();
        }}
        className="w-full mt-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white 
                   rounded-xl px-5 py-4 shadow-sm hover:from-blue-700 hover:to-blue-800 
                   transition font-bold"
      >
        Upload Photos
      </button>

      {/* ESTIMATE MODAL */}
      {showEstimateModal && estimateData && (
        <EstimateModal
          estimate={estimateData}
          onClose={() => setShowEstimateModal(false)}
        />
      )}
    </>
  );
}
