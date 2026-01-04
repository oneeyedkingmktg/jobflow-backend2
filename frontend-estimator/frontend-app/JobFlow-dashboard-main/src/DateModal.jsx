// File: src/DateModal.jsx - updated 2025-12-10

import React, { useState, useEffect } from "react";

export default function DateModal({
  initialDate,
  initialTentative = false,
  onConfirm,
  onClose,
  onRemove,
  label = "Select Date",
  allowTentative = false,
}) {
  const [date, setDate] = useState(initialDate || "");
  const [tentative, setTentative] = useState(initialTentative || false);

  useEffect(() => {
    if (initialDate) setDate(initialDate);
    if (initialTentative !== undefined) setTentative(initialTentative);
  }, [initialDate, initialTentative]);

  const handleSave = () => {
    if (!date) return;
    // date is already "YYYY-MM-DD" from the input; strip any time just in case
    const normalized = date.split(" ")[0];
    onConfirm(normalized, tentative);
    onClose();
  };

  const handleRemove = () => {
    if (onRemove) onRemove();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex justify-center items-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-xs p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-3 text-gray-800 text-center">
          {label}
        </h2>

        {/* Date Picker */}
        <div className="mb-4 cursor-pointer" onClick={(e) => e.stopPropagation()}>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Date
          </label>
          <div className="w-full border border-gray-300 rounded px-2 py-1 text-sm hover:bg-gray-50">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-transparent outline-none"
            />
          </div>
        </div>

        {/* Tentative / Week Of Checkbox */}
        {allowTentative && (
          <div className="mb-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={tentative}
                onChange={(e) => setTentative(e.target.checked)}
                className="mr-2 w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 font-medium">
                Week of (tentative)
              </span>
            </label>
          </div>
        )}

        {/* Buttons */}
        <div className="flex justify-between mt-4 gap-2">
          <button
            onClick={handleRemove}
            className="px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
          >
            Remove
          </button>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
