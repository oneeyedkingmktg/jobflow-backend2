import React, { useState } from "react";

export default function TimeModal({ field, onConfirm, onClose }) {
  const [time, setTime] = useState("");

  const handleSave = () => {
    onConfirm(field, time);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-xs">
        <h3 className="text-lg font-semibold mb-4">Set Appointment Time</h3>

        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="w-full border border-gray-300 rounded px-2 py-2 mb-4 text-gray-800"
        />

        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
