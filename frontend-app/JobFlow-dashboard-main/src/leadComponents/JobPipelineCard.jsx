// File: src/leadComponents/JobPipelineCard.jsx
// Job card for the pipeline view when jobs_enabled is ON

import React from "react";
import { formatShortDate } from "./leadHelpers.js";
import { formatTime } from "../utils/formatting.js";

const STATUS_COLORS = {
  pending:   "#7c3aed", // purple
  appt_set:  "#2563eb", // blue
  sold:      "#16a34a", // green
  not_sold:  "#6b7280", // gray
  complete:  "#374151", // dark gray
};

const STATUS_LABELS = {
  pending:  "Pending",
  appt_set: "Booked Appt",
  sold:     "Sold",
  not_sold: "Not Sold",
  complete: "Completed",
};

function formatProjectType(type) {
  if (!type) return null;
  if (type.startsWith("garage_")) return `${type.split("_")[1]} Car Garage`;
  if (type === "patio") return "Patio";
  if (type === "basement") return "Basement";
  if (type === "commercial") return "Commercial";
  if (type === "custom") return "Custom Project";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function statusText(job) {
  if (job.status === "appt_set" && job.appointmentDate) {
    const date = formatShortDate(job.appointmentDate);
    const time = job.appointmentTime ? ` ${formatTime(job.appointmentTime)}` : "";
    return `Appt  •  ${date}${time}`;
  }
  if ((job.status === "sold" || job.status === "complete") && job.installDate) {
    const tentative = job.installTentative ? " (Tentative)" : "";
    if (job.installEndDate && job.installEndDate !== job.installDate) {
      return `Install  •  ${formatShortDate(job.installDate)} – ${formatShortDate(job.installEndDate)}${tentative}`;
    }
    return `Install  •  ${formatShortDate(job.installDate)}${tentative}`;
  }
  return STATUS_LABELS[job.status] || job.status;
}

export default function JobPipelineCard({ job, onClick }) {
  const headerColor = STATUS_COLORS[job.status] || "#6b7280";
  const cityState = [job.contactCity, job.contactState].filter(Boolean).join(", ");
  const projectLabel = formatProjectType(job.projectType);

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
        {statusText(job)}
      </div>

      {/* CARD BODY */}
      <div className="p-4 flex flex-col gap-2">
        <h3 className="text-base font-bold text-gray-900 truncate">
          {job.contactName || "Unnamed Contact"}
        </h3>

        <div className="text-sm text-gray-600 font-medium truncate">
          {job.jobName}
        </div>

        {projectLabel && (
          <div className="text-xs text-gray-500">
            Project: <span className="font-semibold text-gray-700">{projectLabel}</span>
          </div>
        )}

        {job.contractPrice && (
          <div className="text-xs text-emerald-700 font-semibold">
            ${Math.round(Number(job.contractPrice)).toLocaleString()}
          </div>
        )}

        <div className="mt-auto pt-1">
          {cityState && (
            <div className="text-xs text-gray-500">{cityState}</div>
          )}
          {job.contactPhone && (
            <div className="text-xs text-gray-400">{job.contactPhone}</div>
          )}
        </div>
      </div>
    </div>
  );
}
