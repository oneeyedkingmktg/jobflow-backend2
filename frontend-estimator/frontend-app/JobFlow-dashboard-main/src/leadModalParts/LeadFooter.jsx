// ============================================================================
// File: src/leadModalParts/LeadFooter.jsx
// Version: v1.0 – Save & Exit button in view mode
// ============================================================================

import React from "react";

export default function LeadFooter({
  isEditing,
  onSave,
  onEdit,
  onExit,
  deleteConfirm,
  setDeleteConfirm,
  onDelete,
  saving = false,
}) {
  return (
    <div className="pt-6 border-t border-gray-200">
      <div className="flex items-center justify-between w-full">
        {/* LEFT BUTTON */}
        {isEditing ? (
          <button
            onClick={onExit}
            disabled={saving}
            className="px-4 py-3 bg-gray-300 text-gray-900 rounded-xl font-semibold text-sm hover:bg-gray-400 transition disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save & Exit"}
          </button>
        ) : (
          <button
            onClick={onExit}
            disabled={saving}
            className="px-4 py-3 bg-gray-300 text-gray-900 rounded-xl font-semibold text-sm hover:bg-gray-400 transition disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save & Exit"}
          </button>
        )}

        {/* RIGHT BUTTON */}
        {!isEditing ? (
          <button
            onClick={onEdit}
            className="px-5 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm shadow hover:bg-blue-700 transition"
          >
            Edit
          </button>
        ) : (
          <button
            onClick={onSave}
            disabled={saving}
            className="px-5 py-3 bg-green-600 text-white rounded-xl font-semibold text-sm shadow hover:bg-green-700 transition disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        )}
      </div>

      {/* DELETE */}
      <div className="mt-4 flex justify-center">
        {!deleteConfirm ? (
          <button
            onClick={() => setDeleteConfirm(true)}
            disabled={saving}
            className="text-sm text-red-600 hover:text-red-800 underline disabled:opacity-50"
          >
            Delete Contact
          </button>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="text-sm text-gray-700">
              Are you sure you want to delete?
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => setDeleteConfirm(false)}
                className="px-3 py-2 text-sm bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={onDelete}
                className="px-3 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}