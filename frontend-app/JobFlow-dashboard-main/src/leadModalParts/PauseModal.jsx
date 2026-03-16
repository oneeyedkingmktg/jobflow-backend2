// File: src/leadModalParts/PauseModal.jsx
import React, { useState } from "react";

export default function PauseModal({ form, onSave, onClose }) {
  const isPaused = form.pauseStatus === "Paused";

  const [toggleOn, setToggleOn] = useState(isPaused);
  const [pauseMode, setPauseMode] = useState(form.pauseUntil ? "date" : "indefinite");
  const [pauseUntil, setPauseUntil] = useState(form.pauseUntil || "");
  const [resumeAction, setResumeAction] = useState(form.resumeAction || "Notify Only");
  const [pauseNotes, setPauseNotes] = useState(form.pauseNotes || "");
  const [showUnpauseChoice, setShowUnpauseChoice] = useState(false);

  const handleSave = () => {
    if (toggleOn && pauseMode === "date" && !pauseUntil) {
      alert("Please select a date or choose 'Until Unpaused'.");
      return;
    }
    if (toggleOn) {
      onSave({
        pauseStatus: "Paused",
        pauseUntil: pauseMode === "date" ? pauseUntil : null,
        resumeAction,
        pauseNotes,
      });
      onClose();
    } else {
      // Show the unpause choice modal instead of saving immediately
      setShowUnpauseChoice(true);
    }
  };

  const handleUnpauseWithAction = (action) => {
    onSave({
      pauseStatus: "Unpaused",
      pauseUntil: null,
      resumeAction: action,
      pauseNotes: form.pauseNotes,
    });
    onClose();
  };

  // ── UNPAUSE CHOICE SCREEN ──────────────────────────────────────────
  if (showUnpauseChoice) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-5">
          <h3 className="text-lg font-semibold text-gray-900">Unpause — What should happen?</h3>
          <p className="text-sm text-gray-600">
            Choose what happens now that this lead is being unpaused.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => handleUnpauseWithAction("Notify Only")}
              className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition"
            >
              Notify Only
            </button>
            <button
              onClick={() => handleUnpauseWithAction("Notify & Restart Messages")}
              className="w-full py-3 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 transition"
            >
              Notify &amp; Restart Messages
            </button>
            <button
              onClick={() => setShowUnpauseChoice(false)}
              className="w-full py-2 rounded-xl bg-gray-100 text-gray-700 text-sm hover:bg-gray-200 transition"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── MAIN PAUSE SCREEN ─────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-5">
        <h3 className="text-lg font-semibold text-gray-900">Pause Lead</h3>

        {/* TOGGLE */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Paused</span>
          <button
            onClick={() => setToggleOn((v) => !v)}
            className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${
              toggleOn ? "bg-yellow-500" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                toggleOn ? "translate-x-8" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {toggleOn && (
          <>
            <p className="text-xs text-gray-500">
              Lead will not get any further messages until unpaused or the selected date.
            </p>

            {/* PAUSE DURATION */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pause Duration
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="pauseMode"
                    value="indefinite"
                    checked={pauseMode === "indefinite"}
                    onChange={() => setPauseMode("indefinite")}
                  />
                  Until Unpaused
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="pauseMode"
                    value="date"
                    checked={pauseMode === "date"}
                    onChange={() => setPauseMode("date")}
                  />
                  Until a specific date
                </label>
              </div>
            </div>

            {/* DATE */}
            {pauseMode === "date" && (
              <div>
                <input
                  type="date"
                  value={pauseUntil}
                  onChange={(e) => setPauseUntil(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 text-sm ${!pauseUntil ? "border-red-400 bg-red-50" : "border-gray-300"}`}
                />
                {!pauseUntil && (
                  <p className="text-xs text-red-500 mt-1">Required</p>
                )}
              </div>
            )}

            {/* RESUME ACTION */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Resume Behavior
              </label>
              <div className="space-y-2">
                {["Notify Only", "Notify & Restart Messages"].map((opt) => (
                  <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="resumeAction"
                      value={opt}
                      checked={resumeAction === opt}
                      onChange={() => setResumeAction(opt)}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </div>

            {/* NOTES */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={pauseNotes}
                onChange={(e) => setPauseNotes(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
                placeholder="Optional notes..."
              />
            </div>
          </>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-gray-100 text-gray-800 hover:bg-gray-200 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={toggleOn && pauseMode === "date" && !pauseUntil}
            className="px-4 py-2 rounded-xl bg-yellow-500 text-white hover:bg-yellow-600 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
