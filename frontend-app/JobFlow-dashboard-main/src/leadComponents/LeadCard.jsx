// File: src/leadComponents/LeadCard.jsx
// Version: v1.3 – Fixed appointment time display to match modal

import React from "react";
import { STATUS_COLORS } from "../leadModalParts/statusConfig.js";
import { getStatusBarText } from "./leadHelpers.js";
import { formatDate, formatTime } from "../utils/formatting.js";





function formatProjectType(type) {
  if (!type) return null;
  if (type.startsWith("garage_")) {
    const carCount = type.split("_")[1];
    return `${carCount} Car Garage`;
  }
  if (type === "patio") return "Patio";
  if (type === "basement") return "Basement";
  if (type === "commercial") return "Commercial";
  if (type === "custom") return "Custom Project";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export default function LeadCard({ lead, onClick, onReinstate }) {
  const headerColor = lead.deletedAt ? "#6b7280" : STATUS_COLORS[lead.status] || STATUS_COLORS.lead;
  const cityState = [lead.city, lead.state].filter(Boolean).join(", ");

  let statusText = getStatusBarText(lead);

if (lead.status === "appointment_set") {
  // ✅ Only format if we have a valid date (not null, undefined, or empty string)
  if (lead.appointmentDate && lead.appointmentDate !== "") {
    const dateStr = formatDate(lead.appointmentDate);
    const timeStr = lead.appointmentTime ? formatTime(lead.appointmentTime) : "";
    const apptDisplay = timeStr ? `${dateStr} ${timeStr}` : dateStr;
    
    if (apptDisplay) {
      statusText = `Appointment Set — ${apptDisplay}`;
    }
  }
}


if (lead.status === "install_scheduled") {
  if (lead.installDate && lead.installDate !== "") {
    const tentative = lead.installTentative ? " (Tentative)" : "";
    if (lead.installEndDate && lead.installEndDate !== lead.installDate) {
      const start = new Date(lead.installDate + "T12:00:00");
      const end = new Date(lead.installEndDate + "T12:00:00");
      const days = Math.max(1, Math.round((end - start) / 86400000) + 1);
      statusText = `Install — ${formatDate(lead.installDate)} – ${formatDate(lead.installEndDate)} (${days}d)${tentative}`;
    } else {
      statusText = `Install — ${formatDate(lead.installDate)}${tentative}`;
    }
  }
}


  return (
    <div
      className="bg-white rounded-xl shadow cursor-pointer hover:shadow-lg transition border overflow-hidden"
      onClick={onClick}
    >
{/* STATUS BAR */}
      <div
        className="px-4 py-2 text-xs font-semibold text-white uppercase tracking-wide flex items-center justify-between"
        style={{ backgroundColor: headerColor }}
      >
        <span>{statusText}</span>
        <div className="flex items-center gap-2">
          {lead.pauseStatus === "Paused" && (
            <span style={{ fontSize: "1.2em", color: "#000", fontWeight: "900" }}>⏸</span>
          )}
          {lead.hasEstimate === true && (
            <span style={{ fontSize: "1em" }}>📐</span>
          )}
        </div>
      </div>

{/* CARD BODY */}
      <div className="p-4 space-y-2">
        <h3 className="text-base font-bold text-gray-900 truncate">
          {lead.name || "Unnamed Lead"}
        </h3>
        {lead.deletedAt && onReinstate && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReinstate(lead);
            }}
            className="w-full mt-2 px-4 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition"
          >
            Reinstate Contact
          </button>
        )}

        {(lead.buyerType || lead.projectType) && (
          <div className="flex items-center gap-2 text-xs mt-1">
            {lead.buyerType && (
              <span className="px-2 py-1 bg-blue-100 rounded-full text-blue-700 font-semibold">
                {lead.buyerType}
              </span>
            )}

            {lead.projectType && (
              <span className="text-gray-700">
                Project:{" "}
                <span className="font-semibold">
                  {formatProjectType(lead.projectType)}
                </span>
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