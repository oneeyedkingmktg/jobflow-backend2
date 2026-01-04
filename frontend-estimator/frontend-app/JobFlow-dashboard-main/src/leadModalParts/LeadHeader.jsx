import React from "react";
import { STATUS_COLORS } from "./statusConfig";

export default function LeadHeader({ name, status, phone, onCall, onText, onMap }) {
  const bgColor = STATUS_COLORS[status] || "#59687d"; // fallback color

  return (
    <div className="w-full">
      {/* TOP HEADER WITH NAME */}
      <div
        className="px-6 py-4"
        style={{ backgroundColor: bgColor }}
      >
        <h2 className="text-xl font-bold text-white">
          {name || "New Lead"}
        </h2>
      </div>

      {/* ACTION BUTTONS ON SAME COLOR BACKGROUND */}
      <div
        className="px-6 py-4 flex gap-3 w-full"
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
