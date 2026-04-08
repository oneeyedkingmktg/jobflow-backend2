// ============================================================================
// File: src/leadModalParts/LeadFooter.jsx
// ============================================================================

import React from "react";
import { useAuth } from "../AuthContext";

export default function LeadFooter({
  isEditing,
  onSave,
  onEdit,
  onExit,
  onExitWithoutSaving,
  onPause,
  deleteConfirm,
  setDeleteConfirm,
  onDelete,
  onJunk,
  isJunk,
  onReinstate,
  saving = false,
}) {
  const { user } = useAuth();
  const isEstimatorOnly = user?.planType === 'estimator_only';

  return (
    <div className="pt-6 border-t border-gray-200">

      {/* TOP ROW: Save & Exit | Exit Without Saving | Edit/Save */}
      <div className="flex items-center justify-between w-full gap-3">

        {/* SAVE & EXIT */}
        <button
          type="button"
          onClick={onExit}
          disabled={saving}
          className="flex-1 py-3 bg-gray-300 text-gray-900 rounded-xl font-semibold text-sm hover:bg-gray-400 transition disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save & Exit"}
        </button>

        {/* EXIT WITHOUT SAVING */}
        <button
          type="button"
          onClick={onExitWithoutSaving}
          disabled={saving}
          className="flex-1 py-3 bg-orange-100 text-orange-800 rounded-xl font-semibold text-sm hover:bg-orange-200 transition disabled:opacity-50"
        >
          Exit
        </button>

        {/* EDIT / SAVE */}
        {!isEditing ? (
          <button
            type="button"
            onClick={onEdit}
            className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm shadow hover:bg-blue-700 transition"
          >
            Edit
          </button>
        ) : (
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="flex-1 py-3 bg-green-600 text-white rounded-xl font-semibold text-sm shadow hover:bg-green-700 transition disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        )}
      </div>

      {/* BOTTOM ROW: Pause | Junk | Delete (or Reinstate) */}
      <div className="mt-4 flex justify-center">
        {onReinstate ? (
          <button
            type="button"
            onClick={onReinstate}
            disabled={saving}
            className="px-6 py-3 bg-green-600 text-white rounded-xl font-semibold text-sm shadow hover:bg-green-700 transition disabled:opacity-50"
          >
            Reinstate Contact
          </button>
        ) : deleteConfirm ? (
          <div className="flex flex-col items-center gap-2">
            <div className="text-sm text-gray-700 text-center">
              Deleting this contact will permanently remove them from JobFlow
              and all connected systems, including GHL.
            </div>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setDeleteConfirm(false)}
                className="px-3 py-2 text-sm bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="px-3 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-6 flex-wrap justify-center">
            {!isEstimatorOnly && onPause && (
              <button
                type="button"
                onClick={onPause}
                disabled={saving}
                className="text-sm text-yellow-600 hover:text-yellow-800 underline disabled:opacity-50"
              >
                ⏸ Pause
              </button>
            )}
            {!isJunk && onJunk && (
              <button
                type="button"
                onClick={onJunk}
                disabled={saving}
                className="text-sm text-orange-500 hover:text-orange-700 underline disabled:opacity-50"
              >
                Mark as Junk
              </button>
            )}
            <button
              type="button"
              onClick={() => setDeleteConfirm(true)}
              disabled={saving}
              className="text-sm text-red-600 hover:text-red-800 underline disabled:opacity-50"
            >
              Delete Contact
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
