// File: src/ServiceCallsModal.jsx
// Service Calls — list and edit modal for per-lead additional install/visit dates

import React, { useState, useEffect } from "react";
import DateModal from "./DateModal";
import { apiRequest } from "./api";

function formatDateDisplay(dateStr) {
  if (!dateStr) return "No date set";
  const d = new Date(dateStr.split("T")[0] + "T00:00:00");
  if (isNaN(d.getTime())) return "No date set";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatTimeDisplay(timeStr) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":");
  let hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${m} ${ampm}`;
}

export default function ServiceCallsModal({ leadId, onClose, onCountChange }) {
  const [serviceCalls, setServiceCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("list"); // "list" | "edit"
  const [editing, setEditing] = useState(null); // null = new, object = existing

  // Edit form state
  const [date, setDate] = useState(null);
  const [time, setTime] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);

  useEffect(() => {
    loadServiceCalls();
  }, [leadId]);

  const loadServiceCalls = async () => {
    setLoading(true);
    try {
      const data = await apiRequest(`/leads/${leadId}/service-calls`);
      const calls = data.serviceCalls || [];
      setServiceCalls(calls);
      if (onCountChange) onCountChange(calls.length);
    } catch (err) {
      console.error("Failed to load service calls:", err);
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    setEditing(null);
    setDate(null);
    setTime("");
    setTitle("");
    setNotes("");
    setDirty(false);
    setView("edit");
  };

  const openEdit = (sc) => {
    setEditing(sc);
    setDate(sc.scheduled_date ? sc.scheduled_date.split("T")[0] : null);
    setTime(sc.scheduled_time ? sc.scheduled_time.substring(0, 5) : "");
    setTitle(sc.title || "");
    setNotes(sc.notes || "");
    setDirty(false);
    setView("edit");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        scheduled_date: date || null,
        scheduled_time: time || null,
        title: title || null,
        notes: notes || null,
      };
      if (editing) {
        await apiRequest(`/leads/${leadId}/service-calls/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest(`/leads/${leadId}/service-calls`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      await loadServiceCalls();
      setView("list");
    } catch (err) {
      console.error("Failed to save service call:", err);
      alert("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    setDeleting(true);
    try {
      await apiRequest(`/leads/${leadId}/service-calls/${editing.id}`, {
        method: "DELETE",
      });
      await loadServiceCalls();
      setView("list");
    } catch (err) {
      console.error("Failed to delete service call:", err);
      alert("Failed to delete. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const handleExitEdit = () => {
    if (dirty) {
      setConfirmExit(true);
    } else {
      setView("list");
    }
  };

  // ── LIST VIEW ─────────────────────────────────────────────────────────────
  if (view === "list") {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="relative w-full max-w-lg bg-white rounded-t-2xl shadow-xl p-5 max-h-[85vh] flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Service Calls</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none w-8 h-8 flex items-center justify-center"
            >
              ×
            </button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto space-y-3">
            {loading ? (
              <div className="text-sm text-gray-500 py-6 text-center">Loading...</div>
            ) : serviceCalls.length === 0 ? (
              <p className="text-sm text-gray-400 italic text-center py-6">No service calls yet</p>
            ) : (
              serviceCalls.map((sc) => (
                <div
                  key={sc.id}
                  onClick={() => openEdit(sc)}
                  className="bg-gray-50 rounded-xl p-4 border border-gray-200 cursor-pointer hover:border-blue-400 transition"
                >
                  <div className="font-semibold text-gray-900 text-sm">
                    {sc.title || "Untitled"}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {formatDateDisplay(sc.scheduled_date)}
                    {sc.scheduled_time && ` · ${formatTimeDisplay(sc.scheduled_time)}`}
                  </div>
                  {sc.notes && (
                    <div className="text-xs text-gray-500 mt-1 line-clamp-2">{sc.notes}</div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Add button */}
          <button
            onClick={openNew}
            className="mt-4 w-full bg-blue-600 text-white rounded-xl py-3 font-semibold text-sm hover:bg-blue-700 transition"
          >
            + Add Service Call
          </button>
        </div>
      </div>
    );
  }

  // ── EDIT VIEW ─────────────────────────────────────────────────────────────
  return (
    <>
      {/* Date picker overlay */}
      {showDatePicker && (
        <DateModal
          initialDate={date}
          label="Service Call Date"
          allowTentative={false}
          onConfirm={(selectedDate) => {
            setDate(selectedDate);
            setDirty(true);
            setShowDatePicker(false);
          }}
          onClose={() => setShowDatePicker(false)}
        />
      )}

      {/* Exit-without-saving confirmation */}
      {confirmExit && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-2xl p-6 mx-4 w-full max-w-sm shadow-xl text-center">
            <p className="text-gray-800 font-semibold mb-1">Exit without saving?</p>
            <p className="text-gray-500 text-sm mb-5">Your changes will be lost.</p>
            <div className="flex gap-3">
              <button
                onClick={() => { setConfirmExit(false); setView("list"); }}
                className="flex-1 bg-red-100 text-red-700 rounded-xl py-2.5 font-semibold text-sm hover:bg-red-200 transition"
              >
                Exit Without Saving
              </button>
              <button
                onClick={() => setConfirmExit(false)}
                className="flex-1 bg-gray-100 text-gray-700 rounded-xl py-2.5 font-semibold text-sm hover:bg-gray-200 transition"
              >
                Stay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit form */}
      <div className="fixed inset-0 z-50 flex items-end justify-center">
        <div className="absolute inset-0 bg-black/40" onClick={handleExitEdit} />
        <div className="relative w-full max-w-lg bg-white rounded-t-2xl shadow-xl p-5 max-h-[90vh] flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">
              {editing ? "Edit Service Call" : "New Service Call"}
            </h2>
            <button
              onClick={handleExitEdit}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none w-8 h-8 flex items-center justify-center"
            >
              ×
            </button>
          </div>

          {/* Form fields */}
          <div className="flex-1 overflow-y-auto space-y-4">

            {/* Date */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block font-medium">Date</label>
              <button
                type="button"
                onClick={() => setShowDatePicker(true)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-left text-sm font-semibold text-gray-800 hover:border-blue-400 transition"
              >
                {date ? formatDateDisplay(date) : <span className="text-gray-400 font-normal">Tap to set date</span>}
              </button>
            </div>

            {/* Time */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block font-medium">Time</label>
              <input
                type="time"
                value={time}
                onChange={(e) => { setTime(e.target.value); setDirty(true); }}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:border-blue-400 transition"
              />
            </div>

            {/* Title */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block font-medium">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
                placeholder="e.g. Final coat, Touch-up visit..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:border-blue-400 transition"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block font-medium">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => { setNotes(e.target.value); setDirty(true); }}
                placeholder="Any notes for this visit..."
                rows={3}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:border-blue-400 transition resize-none"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-4 space-y-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold text-sm hover:bg-blue-700 transition disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save & Exit"}
            </button>
            <button
              onClick={handleExitEdit}
              className="w-full bg-gray-100 text-gray-700 rounded-xl py-3 font-semibold text-sm hover:bg-gray-200 transition"
            >
              Exit Without Saving
            </button>
            {editing && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="w-full bg-red-100 text-red-700 rounded-xl py-3 font-semibold text-sm hover:bg-red-200 transition disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
