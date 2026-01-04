// File: src/leadComponents/LeadCard.jsx

import React from "react";
import { STATUS_COLORS } from "../leadModalParts/statusConfig.js";
import { getStatusBarText } from "./leadHelpers.js";

export default function LeadCard({ lead, onClick }) {
  const headerColor = STATUS_COLORS[lead.status] || STATUS_COLORS.lead;
  const cityState = [lead.city, lead.state].filter(Boolean).join(", ");

  return (
    <div
      className="bg-white rounded-xl shadow cursor-pointer hover:shadow-lg transition border overflow-hidden"
      onClick={onClick}
    >
      {/* STATUS BAR */}
      <div
        className="px-4 py-2 text-xs font-semibold text-white uppercase tracking-wide"
        style={{ backgroundColor: headerColor }}
      >
        {getStatusBarText(lead)}
      </div>

      {/* CARD BODY */}
      <div className="p-4 space-y-2">
        <h3 className="text-base font-bold text-gray-900 truncate">
          {lead.name || "Unnamed Lead"}
        </h3>

        {(lead.buyerType || lead.projectType) && (
          <div className="flex items-center gap-2 text-xs mt-1">
            {lead.buyerType && (
              <span className="px-2 py-1 bg-blue-100 rounded-full text-blue-700 font-semibold">
                {lead.buyerType}
              </span>
            )}

            {lead.projectType && (
              <span className="text-gray-700">
                Project: <span className="font-semibold">{lead.projectType}</span>
              </span>
            )}
          </div>
        )}

        {cityState && (
          <div className="pt-2 text-xs text-gray-500">{cityState}</div>
        )}
      </div>
    </div>
  );
}
