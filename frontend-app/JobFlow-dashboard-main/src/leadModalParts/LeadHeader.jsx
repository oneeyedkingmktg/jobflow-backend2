import React from "react";
import { STATUS_COLORS } from "./statusConfig";

function formatPauseDate(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.slice(0, 10).split("-");
  return `${parseInt(m)}-${parseInt(d)}-${y.slice(2)}`;
}

function formatCompletedDate(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.slice(0, 10).split("-");
  const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function LeadHeader({
  name,
  status,
  phone,
  onCall,
  onText,
  onMap,
  onUploadPhotos,
  isPaused,
  pauseUntil,
  proceedWithAutomation,
  dateCompleted,
}) {
  const bgColor = STATUS_COLORS[status] || "#59687d";

  const showFollowupSkipped =
    status === "complete" && proceedWithAutomation === false;

  return (
    <div className="w-full">
      {/* TOP HEADER WITH NAME */}
      <div
        className="px-6 py-4 flex items-center gap-3"
        style={{ backgroundColor: bgColor }}
      >
        <h2 className="text-xl font-bold text-white">
          {name || "New Lead"}
        </h2>

        {isPaused && (
          <span className="flex items-center gap-1 bg-yellow-400 text-gray-900 text-xs font-bold px-2 py-1 rounded-full">
            ⏸ {pauseUntil ? `PAUSED Until ${formatPauseDate(pauseUntil)}` : "PAUSED"}
          </span>
        )}

        {status === "complete" && dateCompleted && (
          <span className="flex items-center gap-1 bg-black/30 text-white text-xs font-bold px-2 py-1 rounded-full">
            Completed {formatCompletedDate(dateCompleted)}
          </span>
        )}

        {showFollowupSkipped && (
          <span className="flex items-center gap-1 bg-black/30 text-white text-xs font-bold px-2 py-1 rounded-full">
            * Follow up Skipped
          </span>
        )}
      </div>

      {/* ACTION BUTTONS */}
      <div
        className="px-6 py-4 grid grid-cols-3 gap-3 w-full"
        style={{ backgroundColor: bgColor }}
      >
        <button
          onClick={onCall}
          className="flex-1 bg-white text-gray-800 py-2 rounded-lg shadow font-semibold text-sm hover:bg-gray-100"
        >
          Call
        </button>

        <button
          onClick={onText}
          className="flex-1 bg-white text-gray-800 py-2 rounded-lg shadow font-semibold text-sm hover:bg-gray-100"
        >
          Text
        </button>

        <button
          onClick={onMap}
          className="flex-1 bg-white text-gray-800 py-2 rounded-lg shadow font-semibold text-sm hover:bg-gray-100"
        >
          Maps
        </button>
      </div>
    </div>
  );
}