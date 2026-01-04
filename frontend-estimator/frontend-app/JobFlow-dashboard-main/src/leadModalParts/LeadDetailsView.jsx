// ============================================================================
// File: src/leadModalParts/LeadDetailsView.jsx
// Version: v1.2 – Added Lead Source display
// ============================================================================

import React from "react";

export default function LeadDetailsView({
  form,
  onEdit,
  onOpenEstimate,
}) {
  const hasEstimate = form?.hasEstimate === true;

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
            {form.projectType || "Not Set"}
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

      {/* SINGLE ESTIMATE BUTTON (BELOW DETAILS) */}
      {hasEstimate && (
        <button
          type="button"
          onClick={onOpenEstimate}
          className="w-full mt-4 bg-white border border-gray-200 rounded-2xl px-5 py-4
                     shadow-sm hover:border-blue-500 transition text-left"
        >
          <div className="text-xs text-gray-500">Estimate</div>
          <div className="font-bold text-gray-900">
            View Estimate Details
          </div>
        </button>
      )}
    </>
  );
}