// ============================================================================
// File: src/EstimateModal.jsx
// Version: v1.6 – Fixed garage display formatting (1-4 car garage)
// ============================================================================

import React, { useState, useEffect } from "react";
import { formatDate, formatTime } from "./utils/formatting.js";

export default function EstimateModal({ estimate, onClose }) {
  if (!estimate) return null;

  const [customLabels, setCustomLabels] = useState({
    projectLabel: "Custom",
    finishLabel: "Custom"
  });

  useEffect(() => {
    async function loadCustomLabels() {
      try {
        const { apiRequest } = await import("./api.js");
        const config = await apiRequest(`/estimator/config?company_id=${estimate.company_id}`);
        setCustomLabels({
          projectLabel: config.custom_project_label || "Custom",
          finishLabel: config.custom_finish_label || "Custom"
        });
      } catch (err) {
        console.error("Failed to load custom labels:", err);
      }
    }
    if (estimate?.company_id) loadCustomLabels();
  }, [estimate?.company_id]);

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    
    // Use company timezone if available, otherwise default to America/New_York
    const timezone = estimate.timezone || "America/New_York";
    
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: timezone,
    });
  };

  const formatPrice = (min, max) => {
    if (!min || !max) return "N/A";
    return `$${Number(min).toLocaleString()} - $${Number(max).toLocaleString()}`;
  };

// Format project type: garage_1 -> "1 Car Garage", garage_2 -> "2 Car Garage", etc.
  const formatProjectType = (type) => {
    if (!type) return "N/A";
    
    // Handle garage_1, garage_2, garage_3, garage_4
    if (type.startsWith("garage_")) {
      const carCount = type.split("_")[1];
      return `${carCount} Car Garage`;
    }
    
    // Handle custom with custom label
    if (type === "custom") {
      return customLabels.projectLabel;
    }
    
    // For other types (patio, basement, commercial), capitalize first letter
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  // Parse all_price_ranges JSON
  let priceRanges = {};
  try {
    if (estimate.all_price_ranges) {
      priceRanges = typeof estimate.all_price_ranges === 'string' 
        ? JSON.parse(estimate.all_price_ranges)
        : estimate.all_price_ranges;
    }
  } catch (e) {
    console.error("Error parsing price ranges:", e);
  }

// Extract individual price ranges - correct field names from DB
  const solidColor = priceRanges.solid || {};
  const flake = priceRanges.flake || {};
  const metallics = priceRanges.metallic || {};
  const custom = priceRanges.custom || {};

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 rounded-t-2xl">
          <h2 className="text-2xl font-bold">Estimate Details</h2>
          <p className="text-sm text-blue-100 mt-1">
            Submitted: {formatDate(estimate.created_at)}
          </p>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {/* Project Info */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-500 uppercase">Project Type</div>
                <div className="font-semibold text-gray-900">
                  {formatProjectType(estimate.project_type)}
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-500 uppercase">Total Square Feet</div>
                <div className="font-semibold text-gray-900">
                  {estimate.calculated_sf ? `${Number(estimate.calculated_sf).toLocaleString()} sq ft` : "N/A"}
                </div>
              </div>
<div>
  <div className="text-xs text-gray-500 uppercase">Concrete Condition</div>
  <div className="font-semibold text-gray-900">
    {estimate.condition === "none" ? "Good" : 
     estimate.condition === "minor" ? "A Few Cracks" : 
     estimate.condition === "major" ? "A Lot of Cracks" : 
     "N/A"}
  </div>
</div>

              <div>
                <div className="text-xs text-gray-500 uppercase">Existing Coating</div>
                <div className={`font-semibold ${estimate.existing_coating ? 'text-orange-600' : 'text-green-600'}`}>
                  {estimate.existing_coating ? "Yes" : "No"}
                </div>
              </div>
            </div>

            {/* Lead Source */}
            {estimate.referral_source && (
              <div className="pt-2 border-t mt-3">
                <div className="text-xs text-gray-500 uppercase">Lead Source</div>
                <div className="font-semibold text-gray-900">
                  {estimate.referral_source}
                </div>
              </div>
            )}

            {estimate.minimum_job_applied && (
              <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2">
                ⚠️ Minimum job pricing applied
              </div>
            )}
          </div>

          {/* Pricing */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <h3 className="font-bold text-gray-900 text-lg pb-2">
              Prices Shown
            </h3>

            <div className="space-y-3">
              {/* Solid Color */}
              <div className="flex justify-between items-center border-b pb-2">
                <div className="font-semibold text-gray-900">Solid Color</div>
                <div className="font-bold text-gray-900">
                  {solidColor.min && solidColor.max
                    ? formatPrice(solidColor.min, solidColor.max)
                    : "N/A"}
                </div>
              </div>

              {/* Flake */}
              <div className="flex justify-between items-center border-b pb-2">
                <div className="font-semibold text-gray-900">Flake</div>
                <div className="font-bold text-gray-900">
                  {flake.min && flake.max
                    ? formatPrice(flake.min, flake.max)
                    : "N/A"}
                </div>
              </div>

{/* Metallics */}
              <div className="flex justify-between items-center border-b pb-2">
                <div className="font-semibold text-gray-900">Metallics</div>
                <div className="font-bold text-gray-900">
                  {metallics.min && metallics.max
                    ? formatPrice(metallics.min, metallics.max)
                    : "N/A"}
                </div>
              </div>

              {/* Custom Finish */}
              <div className="flex justify-between items-center">
                <div className="font-semibold text-gray-900">{customLabels.finishLabel}</div>
                <div className="font-bold text-gray-900">
                  {custom.min && custom.max
                    ? formatPrice(custom.min, custom.max)
                    : "N/A"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 rounded-b-2xl border-t">
          <button
            onClick={onClose}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
}