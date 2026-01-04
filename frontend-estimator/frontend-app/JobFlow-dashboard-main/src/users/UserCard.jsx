// File: src/users/UserCard.jsx
import React from "react";

export default function UserCard({ user, onClick }) {
  return (
    <div
      onClick={onClick}
      className="p-4 bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl border border-gray-200 hover:shadow-md transition-all cursor-pointer"
    >
      <div>
        <h4 className="font-bold text-gray-900">{user.name}</h4>
        <p className="text-sm text-gray-600">{user.email}</p>

        {user.phone && (
          <p className="text-xs text-gray-500 mt-1">
            Phone: {user.phone}
          </p>
        )}

        <p className="text-xs text-gray-500 mt-1">
          Role: <span className="font-semibold">{user.role}</span>
        </p>

        {user.is_active === false && (
          <p className="text-xs text-red-600 font-semibold mt-1">
            Inactive
          </p>
        )}

        {user.last_login && (
          <p className="text-xs text-gray-400 mt-1">
            Last login: {user.last_login}
          </p>
        )}
      </div>
    </div>
  );
}
