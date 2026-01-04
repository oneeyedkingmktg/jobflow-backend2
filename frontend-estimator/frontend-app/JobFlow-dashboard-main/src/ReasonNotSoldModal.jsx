import React from "react";

const REASONS = [
  "Price Too High",
  "Went With Competitor",
  "Not Ready Yet",
  "No Show / No Response",
  "Project Cancelled",
  "Other",
];

export default function ReasonNotSoldModal({ onSelect, onCancel }) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex justify-center items-center z-50 p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-xs p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4 text-gray-800 text-center">
          Reason Not Sold
        </h2>

        <div className="space-y-2">
          {REASONS.map((reason) => (
            <button
              key={reason}
              onClick={() => onSelect(reason)}
              className="w-full text-left px-4 py-2 border rounded-lg hover:bg-gray-100 text-sm font-medium text-gray-700"
            >
              {reason}
            </button>
          ))}
        </div>

        <button
          onClick={onCancel}
          className="mt-4 w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 text-sm font-semibold"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
