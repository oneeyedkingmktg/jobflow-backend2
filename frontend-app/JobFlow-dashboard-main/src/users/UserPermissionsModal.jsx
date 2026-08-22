// ============================================================================
// File: src/users/UserPermissionsModal.jsx
// Phase 2 — Role-based permissions with custom fallback.
// Shows role selector; if Custom, individual sliders appear.
// Categories filtered by company feature flags.
// ============================================================================

import React, { useEffect, useState } from "react";
import { UsersAPI, PermissionRolesAPI } from "../api";

const LEVELS = ["hide", "view", "edit"];

const CATEGORIES = [
  {
    key: "financial_information",
    label: "Financial Information",
    description: "Contract price, bid totals, payment schedule, Create Documents",
    flag: null,
  },
  {
    key: "lead_management",
    label: "Lead Management",
    description: "Status changes, pause, mark as junk, delete contact",
    flag: null,
  },
  {
    key: "bidder",
    label: "Bidder",
    description: "View and edit bids",
    flag: "bidder_enabled",
  },
  {
    key: "contact_editing",
    label: "Contact Editing",
    description: "Edit contact fields, photos, files",
    flag: null,
  },
  {
    key: "customer_communications",
    label: "Customer Communications",
    description: "Message history and sending",
    flag: "show_conversations",
  },
  {
    key: "calendar",
    label: "Calendar",
    description: "View and edit appointments and installs",
    flag: null,
  },
  {
    key: "service_calls",
    label: "Service Calls",
    description: "View and manage service calls",
    flag: "service_calls_enabled",
  },
  {
    key: "reports",
    label: "Reports",
    description: "Access to the Reports tab",
    flag: "reports_enabled",
  },
  {
    key: "manage_labor",
    label: "Manage Labor",
    description: "Assign crew, add individuals, and clock team in/out from a job",
    flag: null,
  },
  {
    key: "job_report",
    label: "Job Report",
    description: "Job cost reports: labor hours, materials, profit margin",
    flag: "job_reports_enabled",
  },
  {
    key: "visualizer",
    label: "Floor Visualizer",
    description: "Build and apply floor chip blends on contact records",
    flag: "visualizer_enabled",
  },
];

function getVisibleCategories(company) {
  if (!company) return CATEGORIES;
  return CATEGORIES.filter((cat) => {
    if (!cat.flag) return true;
    const snake = cat.flag;
    const camel = snake.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    return company[snake] || company[camel];
  });
}

export default function UserPermissionsModal({ user, company, companyId, onClose, onSaved }) {
  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(true);

  // selectedRoleId: null = custom/individual, number = a role id
  const [selectedRoleId, setSelectedRoleId] = useState(
    user.permissionRoleId ?? user.permission_role_id ?? null
  );
  const [permissions, setPermissions] = useState(user.permissions || {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const visibleCategories = getVisibleCategories(company);

  // The permissions to display in read-only preview when a role is selected
  const selectedRole = roles.find((r) => r.id === selectedRoleId) || null;
  const isCustom = selectedRoleId === null;

  useEffect(() => {
    loadRoles();
  }, [companyId]);

  const loadRoles = async () => {
    try {
      setRolesLoading(true);
      const res = await PermissionRolesAPI.getAll(companyId);
      setRoles(res.roles || []);
    } catch {
      // silently fail — role selector just won't show roles
    } finally {
      setRolesLoading(false);
    }
  };

  const handleRoleChange = (val) => {
    setSelectedRoleId(val === "custom" ? null : parseInt(val, 10));
    setError("");
  };

  const setLevel = (key, level) =>
    setPermissions((prev) => ({ ...prev, [key]: level }));

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      // Always update the role assignment on the user record
      await UsersAPI.update(user.id, { permissionRoleId: selectedRoleId });

      // If custom, also save individual permissions
      if (isCustom) {
        await UsersAPI.updatePermissions(user.id, permissions);
      }

      onSaved(isCustom ? permissions : (selectedRole?.permissions || {}), selectedRoleId);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save permissions");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="bg-blue-600 text-white px-6 py-4 shrink-0">
          <h2 className="text-xl font-bold">Permissions</h2>
          <p className="text-blue-200 text-sm mt-0.5">{user.name || user.email}</p>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-600 p-3 text-red-800 text-sm rounded">
              {error}
            </div>
          )}

          {/* Role selector */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Permission Role
            </label>
            {rolesLoading ? (
              <div className="text-sm text-gray-400">Loading roles…</div>
            ) : (
              <select
                value={selectedRoleId === null ? "custom" : selectedRoleId}
                onChange={(e) => handleRoleChange(e.target.value)}
                className="w-full rounded-lg border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="custom">Custom (individual permissions)</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}{r.is_custom ? " (custom)" : ""}
                  </option>
                ))}
              </select>
            )}
            {!isCustom && selectedRole && (
              <p className="text-xs text-gray-500 mt-1">
                Permissions below reflect the <strong>{selectedRole.name}</strong> role and are read-only.
                Select "Custom" to set permissions individually.
              </p>
            )}
            {roles.length === 0 && !rolesLoading && (
              <p className="text-xs text-gray-400 mt-1">
                No roles created yet. Use "Permission Roles" in the Users header to create some.
              </p>
            )}
          </div>

          {/* Permission matrix */}
          <div className="space-y-2">
            {visibleCategories.map((cat) => {
              const rolePerms = selectedRole?.permissions || {};
              const current = isCustom
                ? (permissions[cat.key] ?? "hide")
                : (rolePerms[cat.key] ?? "hide");

              return (
                <div
                  key={cat.key}
                  className={`border rounded-xl p-4 ${!isCustom ? "opacity-60" : "border-gray-200"}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 text-sm">{cat.label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{cat.description}</div>
                    </div>

                    <div className="flex gap-1 shrink-0">
                      {LEVELS.map((level) => (
                        <button
                          key={level}
                          onClick={() => isCustom && setLevel(cat.key, level)}
                          disabled={!isCustom}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                            current === level
                              ? "bg-blue-600 text-white shadow-sm"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:hover:bg-gray-100"
                          } disabled:cursor-default`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 bg-gray-50 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 font-semibold hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Permissions"}
          </button>
        </div>
      </div>
    </div>
  );
}
