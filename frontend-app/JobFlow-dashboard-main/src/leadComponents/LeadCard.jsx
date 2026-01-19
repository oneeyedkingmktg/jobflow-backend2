// File: src/leadComponents/LeadCard.jsx
// Version: v1.2 – Added estimator lead indicator

import React from "react";
import { STATUS_COLORS } from "../leadModalParts/statusConfig.js";
import { getStatusBarText } from "./leadHelpers.js";
import { formatInCompanyTimezone } from "../utils/timezone";





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

export default function LeadCard({ lead, onClick }) {
  const headerColor = STATUS_COLORS[lead.status] || STATUS_COLORS.lead;
  const cityState = [lead.city, lead.state].filter(Boolean).join(", ");

  let statusText = getStatusBarText(lead);

if (lead.status === "appointment_set") {
  // ✅ Only format if we have a valid date (not null, undefined, or empty string)
  if (lead.appointmentDate && lead.appointmentDate !== "") {
    const apptDisplay = formatInCompanyTimezone({
      utcDate: lead.appointmentDate,
      utcTime: lead.appointmentTime,
      timezone: lead.timezone,
      format: "datetime",
    });

    if (apptDisplay) {
      statusText = `Appointment Set — ${apptDisplay}`;
    }
  }
}


if (lead.status === "install_scheduled") {
  // ✅ Only format if we have a valid date (not null, undefined, or empty string)
  if (lead.installDate && lead.installDate !== "") {
    const installDisplay = formatInCompanyTimezone({
      utcDate: lead.installDate,
      timezone: lead.timezone,
      format: "date",
    });

    const tentative = lead.installTentative ? " (tentative)" : "";

    if (installDisplay) {
      statusText = `Install — ${installDisplay}${tentative}`;
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
        className="relative px-4 py-2 text-xs font-semibold text-white uppercase tracking-wide"
        style={{ backgroundColor: headerColor }}
      >
        {statusText}

        {lead.hasEstimate === true && (
          <span
            className="absolute right-2 top-1/2 -translate-y-1/2 opacity-80"
            style={{ fontSize: "0.9em" }}
          >
            📐
          </span>
        )}
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
