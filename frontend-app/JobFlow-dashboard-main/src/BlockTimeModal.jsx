import React, { useState, useEffect, useMemo } from "react";

const TIME_OPTIONS = (() => {
  const opts = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 15, 30, 45]) {
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 || 12;
      opts.push({ value: `${hh}:${mm}`, label: `${h12}:${mm} ${ampm}` });
    }
  }
  return opts;
})();

export default function BlockTimeModal({ isOpen, onClose, onSave, onDelete, initialDate, initialBlock }) {
  const [name, setName] = useState("");
  const [appliesTo, setAppliesTo] = useState("appointment");
  const [allDay, setAllDay] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isEditing = !!initialBlock;

  useEffect(() => {
    if (!isOpen) return;
    if (initialBlock) {
      setName(initialBlock.name || "");
      setAppliesTo(initialBlock.applies_to || "appointment");
      setAllDay(initialBlock.all_day || false);
      setStartTime(initialBlock.start_time ? initialBlock.start_time.slice(0, 5) : "");
      setEndTime(initialBlock.end_time ? initialBlock.end_time.slice(0, 5) : "");
    } else {
      setName("");
      setAppliesTo("appointment");
      setAllDay(false);
      setStartTime("");
      setEndTime("");
    }
  }, [isOpen, initialBlock]);

  // Install and Both always force all-day
  const effectiveAllDay = appliesTo !== "appointment" ? true : allDay;
  const showAllDayToggle = appliesTo === "appointment";
  const showTimePickers = appliesTo === "appointment" && !allDay;

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric", year: "numeric",
    });
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave(
        {
          name: name.trim(),
          applies_to: appliesTo,
          date: initialDate,
          all_day: effectiveAllDay,
          start_time: showTimePickers ? startTime || null : null,
          end_time: showTimePickers ? endTime || null : null,
        },
        initialBlock?.id
      );
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!initialBlock) return;
    setDeleting(true);
    try {
      await onDelete(initialBlock.id);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm">
        {/* Header */}
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-800">
              {isEditing ? "Edit Block" : "Block Time"}
            </h2>
            {initialDate && (
              <p className="text-xs text-gray-500 mt-0.5">{formatDateDisplay(initialDate)}</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Vacation, Doctor, Other job..."
              autoFocus
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>

          {/* Applies To */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Applies To</label>
            <div className="flex rounded border border-gray-300 overflow-hidden">
              {[
                { value: "appointment", label: "Appointment" },
                { value: "install", label: "Install" },
                { value: "both", label: "Both" },
              ].map((opt, i) => (
                <button
                  key={opt.value}
                  onClick={() => setAppliesTo(opt.value)}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    appliesTo === opt.value
                      ? "bg-slate-600 text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50"
                  } ${i > 0 ? "border-l border-gray-300" : ""}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* All Day toggle — only for Appointment */}
          {showAllDayToggle && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">All Day</span>
              <button
                onClick={() => setAllDay(!allDay)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  allDay ? "bg-slate-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${
                    allDay ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          )}

          {/* Auto all-day notice for Install / Both */}
          {!showAllDayToggle && (
            <p className="text-xs text-gray-500 italic">
              {appliesTo === "install"
                ? "Install blocks are always full day."
                : "Blocks on both calendars are always full day."}
            </p>
          )}

          {/* Time pickers */}
          {showTimePickers && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                <select
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white"
                >
                  <option value="">— select —</option>
                  {TIME_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                <select
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white"
                >
                  <option value="">— select —</option>
                  {TIME_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t flex items-center justify-between gap-2">
          {isEditing ? (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-sm text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim() || saving}
              className="px-4 py-2 text-sm rounded bg-slate-600 text-white font-medium hover:bg-slate-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
