// File: src/users/UserCard.jsx
import React from "react";
import { useAuth } from "../AuthContext";

function formatLastActive(ts) {
  if (!ts) return "Never";
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

export default function UserCard({ user, onClick }) {
  const { user: currentUser } = useAuth();
  const isMaster = currentUser?.role === "master";

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

        <div className="flex items-center gap-2 mt-1">
          <p className="text-xs text-gray-500">
            Role: <span className="font-semibold">{user.role}</span>
          </p>
          {(user.isSalesman || user.is_salesman) && (
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
              style={{ backgroundColor: user.salesmanColor || user.salesman_color || "#6366f1" }}
            >
              Salesman
            </span>
          )}
        </div>

        {user.is_active === false && (
          <p className="text-xs text-red-600 font-semibold mt-1">
            Inactive
          </p>
        )}

        {isMaster && (
          <p className="text-xs text-gray-400 mt-1">
            Last active: {formatLastActive(user.lastActivity)}
          </p>
        )}
      </div>
    </div>
  );
}
