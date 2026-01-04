// File: src/users/UserCard.jsx

import React from "react";

export default function UserCard({ user, currentUser, onEdit, onDelete }) {
  const isSelf = currentUser && currentUser.id === user.id;
  const isActive = user.is_active !== false;

  const roleLabel = user.role ? user.role.toUpperCase() : "USER";

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-gray-900">
              {user.name || "(No name)"}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">{user.email}</div>
          </div>
          <span
            className={`text-[11px] font-semibold px-2 py-1 rounded-full ${
              isActive
                ? "bg-green-100 text-green-700"
                : "bg-gray-200 text-gray-600"
            }`}
          >
            {isActive ? "ACTIVE" : "INACTIVE"}
          </span>
        </div>

        <div className="mt-3 text-xs text-gray-600 space-y-1">
          <div>
            <span className="font-semibold">Role:</span> {roleLabel}
          </div>
          {user.phone && (
            <div>
              <span className="font-semibold">Phone:</span> {user.phone}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button
          onClick={onEdit}
          className="px-3 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition"
        >
          Edit
        </button>

        {!isSelf && (
          <button
            onClick={onDelete}
            className="px-3 py-2 rounded-lg text-xs font-semibold border border-red-200 text-red-600 hover:bg-red-50 transition"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
