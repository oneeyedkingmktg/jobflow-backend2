// File: src/leadComponents/LeadCard.jsx
// Version: v1.3 – Fixed appointment time display to match modal

import React from "react";
import { STATUS_COLORS } from "../leadModalParts/statusConfig.js";
import { getStatusBarText, formatShortDate } from "./leadHelpers.js";
import { formatDate, formatTime } from "../utils/formatting.js";





function SourceIcon({ utmSource }) {
  if (!utmSource) return null;
  const src = utmSource.toLowerCase().trim();

  if (src === "facebook" || src === "fb" || src.includes("facebook")) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="12" fill="#1877F2" />
        <path fill="white" d="M13.397 20.997v-8.196h2.765l.411-3.209h-3.176V7.548c0-.926.258-1.56 1.587-1.56h1.684V3.127A22.336 22.336 0 0014.201 3c-2.444 0-4.122 1.492-4.122 4.231v2.355H7.332v3.209h2.753v8.202h3.312z" />
      </svg>
    );
  }

  if (src.includes("google")) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="12" fill="white" />
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
    );
  }

  if (src.includes("bing") || src.includes("microsoft")) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="12" fill="#008272" />
        <path fill="white" d="M8 4v16l2-.5 7.5-4.3-3.5-2.2-2-1V4H8zm4 8.5 3.5 2.2L12 17v-4.5z" />
      </svg>
    );
  }

  return null;
}

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
      statusText = `INSTALL  •  ${formatShortDate(lead.installDate)} - ${formatShortDate(lead.installEndDate)}${tentative}`;
    } else {
      statusText = `INSTALL  •  ${formatShortDate(lead.installDate)}${tentative}`;
    }
  }
}

if (lead.status === "complete") {
  const dc = lead.dateCompleted || lead.date_completed;
  if (dc) {
    statusText = `Completed  •  ${formatShortDate(dc)}`;
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
          <SourceIcon utmSource={lead.utmSource} />
          {lead.hasEstimate === true && (
            <span style={{ fontSize: "1em" }}>📐</span>
          )}
          {lead.outOfAreaLargeJob === true && (
            <span style={{ fontSize: "1em" }}>🧭</span>
          )}
        </div>
      </div>

{/* CARD BODY */}
      <div className="p-4 flex flex-col gap-2">
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

        <div className="mt-auto pt-1">
          {cityState && (
            <div className="text-xs text-gray-500">{cityState}</div>
          )}
          {(lead.createdAt || lead.created_at) && (
            <div className="text-xs text-gray-500">
              Added {formatShortDate(lead.createdAt || lead.created_at)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}