// File: src/ApptDateTimeModal.jsx - updated 2025-12-10

import React, { useState, useEffect } from "react";

export default function ApptDateTimeModal({
  apptDate,
  apptTime,
  onConfirm,
  onClose,
  onRemove,
}) {
  const [date, setDate] = useState(apptDate || "");

  // -------------------------------
  // Convert DB 24-hour "HH:mm" → dropdown values
  // -------------------------------
  const parseTime = (t) => {
    if (!t) return { hour: "1", minute: "00", ampm: "AM" };

    let [h, m] = t.split(":").map((v) => parseInt(v, 10));

    const ampm = h >= 12 ? "PM" : "AM";
    let hour12 = h % 12;
    if (hour12 === 0) hour12 = 12;

    return {
      hour: String(hour12),
      minute: m.toString().padStart(2, "0"),
      ampm,
    };
  };

  const initial = parseTime(apptTime);

  const [hour, setHour] = useState(initial.hour);
  const [minute, setMinute] = useState(initial.minute);
  const [ampm, setAmPm] = useState(initial.ampm);

  useEffect(() => {
    if (apptDate) setDate(apptDate || "");
    const parsed = parseTime(apptTime);
    setHour(parsed.hour);
    setMinute(parsed.minute);
    setAmPm(parsed.ampm);
  }, [apptDate, apptTime]);

  // -------------------------------
  // Convert dropdown values → 24-hour DB time "HH:mm"
  // -------------------------------
  const to24Hour = () => {
    let h = parseInt(hour, 10);

    if (ampm === "PM" && h < 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;

    return `${h.toString().padStart(2, "0")}:${minute}`;
  };

  const handleSave = () => {
    if (!date) return;

    const finalTime24 = to24Hour();
    // date is already "YYYY-MM-DD" from the input
    const normalizedDate = date.split(" ")[0];
    onConfirm(normalizedDate, finalTime24);
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
          Set Appointment
        </h2>

        {/* DATE */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Appointment Date
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

        {/* TIME */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Appointment Time
          </label>

          <div className="grid grid-cols-3 gap-2">
            {/* HOUR */}
            <select
              value={hour}
              onChange={(e) => setHour(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm"
            >
              {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>

            {/* MINUTE */}
            <select
              value={minute}
              onChange={(e) => setMinute(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm"
            >
              {["00", "15", "30", "45"].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            {/* AM/PM */}
            <select
              value={ampm}
              onChange={(e) => setAmPm(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm"
            >
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </div>
        </div>

        {/* BUTTONS */}
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
