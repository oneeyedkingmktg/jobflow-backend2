// ============================================================================
// File: src/users/PermissionRolesManager.jsx
// Manage company permission role presets (create / edit / delete)
// ============================================================================

import React, { useEffect, useState } from "react";
import { PermissionRolesAPI } from "../api";

const LEVELS = ["hide", "view", "edit"];

const CALENDAR_PERMS = [
  { key: "calendar_mine", label: "My Calendar", description: "Own appointments and installs I'm assigned to" },
  { key: "calendar_appointment", label: "Appointments", description: "All appointment events for the company" },
  { key: "calendar_install", label: "Installs", description: "All install events for the company" },
  { key: "calendar_service_call", label: "Service Calls", description: "Service call events" },
  { key: "calendar_other_crews", label: "Other Crews", description: "Jobs assigned to other crews" },
];

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
];

function getVisibleCategories(company) {
  if (!company) return CATEGORIES;
  return CATEGORIES.filter((cat) => {
    if (!cat.flag) return true;
    // handle both snake_case and camelCase from API
    const snake = cat.flag;
    const camel = snake.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    return company[snake] || company[camel];
  });
}

const BLANK_FORM = { name: "", is_custom: false, permissions: {} };

export default function PermissionRolesManager({ company, companyId, onClose }) {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | "new" | role object
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const visibleCategories = getVisibleCategories(company);

  useEffect(() => {
    loadRoles();
  }, [companyId]);

  const loadRoles = async () => {
    try {
      setLoading(true);
      const res = await PermissionRolesAPI.getAll(companyId);
      setRoles(res.roles || []);
    } catch (err) {
      setError(err.message || "Failed to load roles");
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    setForm(BLANK_FORM);
    setEditing("new");
    setError("");
  };

  const openEdit = (role) => {
    setForm({
      name: role.name,
      is_custom: role.is_custom || false,
      permissions: role.permissions || {},
    });
    setEditing(role);
    setError("");
  };

  const setLevel = (key, level) => {
    setForm((prev) => ({
      ...prev,
      permissions: { ...prev.permissions, [key]: level },
    }));
  };

  const setBool = (key, val) => {
    setForm((prev) => ({
      ...prev,
      permissions: { ...prev.permissions, [key]: val },
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError("Role name is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: form.name.trim(),
        is_custom: form.is_custom,
        permissions: form.is_custom ? {} : form.permissions,
        company_id: companyId,
      };

      if (editing === "new") {
        const res = await PermissionRolesAPI.create(payload);
        setRoles((prev) => [...prev, res.role]);
      } else {
        const res = await PermissionRolesAPI.update(editing.id, payload);
        setRoles((prev) =>
          prev.map((r) => (r.id === editing.id ? res.role : r))
        );
      }
      setEditing(null);
    } catch (err) {
      setError(err.message || "Failed to save role");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editing || editing === "new") return;
    if (!window.confirm(`Delete the "${editing.name}" role?`)) return;
    setDeleting(true);
    setError("");
    try {
      await PermissionRolesAPI.delete(editing.id);
      setRoles((prev) => prev.filter((r) => r.id !== editing.id));
      setEditing(null);
    } catch (err) {
      setError(err.message || "Failed to delete role");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1050] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">

        {/* HEADER */}
        <div className="bg-emerald-600 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-bold">Permission Roles</h2>
            <p className="text-emerald-100 text-sm mt-0.5">
              Define reusable permission presets for your team
            </p>
          </div>
          {editing && (
            <button
              onClick={() => { setEditing(null); setError(""); }}
              className="text-emerald-100 hover:text-white text-sm font-semibold"
            >
              ← Back
            </button>
          )}
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-600 p-3 text-red-800 text-sm rounded">
              {error}
            </div>
          )}

          {/* ── ROLE LIST ── */}
          {!editing && (
            <>
              <button
                onClick={openNew}
                className="w-full py-3 border-2 border-dashed border-emerald-400 rounded-xl text-emerald-600 font-semibold hover:bg-emerald-50 transition"
              >
                + New Role
              </button>

              {loading ? (
                <div className="text-center text-gray-500 py-8">Loading roles…</div>
              ) : roles.length === 0 ? (
                <div className="text-center text-gray-400 py-8 text-sm">
                  No roles yet. Create your first role above.
                </div>
              ) : (
                <div className="space-y-2">
                  {roles.map((role) => (
                    <div
                      key={role.id}
                      onClick={() => openEdit(role)}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-emerald-400 hover:bg-emerald-50 cursor-pointer transition"
                    >
                      <div>
                        <div className="font-semibold text-gray-900">{role.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {role.is_custom
                            ? "Custom — individual permissions per user"
                            : `${Object.keys(role.permissions || {}).length} permission(s) set`}
                        </div>
                      </div>
                      <span className="text-gray-400 text-sm">Edit →</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-2 text-xs text-gray-400 text-center">
                Assign roles to users from their Permissions tab
              </div>
            </>
          )}

          {/* ── ROLE EDITOR ── */}
          {editing && (
            <div className="space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Role Name
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full rounded-lg border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="e.g. Installer, Salesperson, Office Staff"
                />
              </div>

              {/* Custom toggle */}
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl">
                <div>
                  <div className="font-semibold text-gray-800 text-sm">
                    Custom (individual permissions)
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Admin sets every permission individually per user
                  </div>
                </div>
                <div
                  onClick={() =>
                    setForm((p) => ({ ...p, is_custom: !p.is_custom }))
                  }
                  className={`relative w-11 h-6 rounded-full cursor-pointer transition-colors ${
                    form.is_custom ? "bg-emerald-600" : "bg-gray-300"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      form.is_custom ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </div>
              </div>

              {/* Permission matrix — hidden when is_custom */}
              {!form.is_custom && (
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-gray-700">
                    Permissions for this role
                  </div>
                  {visibleCategories.map((cat) => {
                    const current = form.permissions[cat.key] ?? "hide";
                    return (
                      <div
                        key={cat.key}
                        className="border border-gray-200 rounded-xl p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-900 text-sm">
                              {cat.label}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {cat.description}
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            {LEVELS.map((level) => (
                              <button
                                key={level}
                                onClick={() => setLevel(cat.key, level)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                                  current === level
                                    ? "bg-emerald-600 text-white shadow-sm"
                                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                }`}
                              >
                                {level}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Calendar access — checkboxes, defaults all ON */}
                  <div className="text-sm font-semibold text-gray-700 pt-2">
                    Calendar Access
                  </div>
                  <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                    {CALENDAR_PERMS.map((cp) => {
                      const val = form.permissions[cp.key] !== false;
                      return (
                        <label key={cp.key} className="flex items-center justify-between gap-3 cursor-pointer select-none">
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-900 text-sm">{cp.label}</div>
                            <div className="text-xs text-gray-500">{cp.description}</div>
                          </div>
                          <input
                            type="checkbox"
                            checked={val}
                            onChange={() => setBool(cp.key, !val)}
                            className="w-4 h-4 accent-emerald-600 shrink-0"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="border-t px-6 py-4 bg-gray-50 flex items-center justify-between shrink-0">
          {!editing ? (
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 font-semibold hover:text-gray-800"
            >
              Close
            </button>
          ) : (
            <>
              <div className="flex gap-3">
                <button
                  onClick={() => { setEditing(null); setError(""); }}
                  className="px-4 py-2 text-gray-600 font-semibold hover:text-gray-800"
                >
                  Cancel
                </button>
                {editing !== "new" && (
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-4 py-2 text-red-600 font-semibold hover:text-red-700 disabled:opacity-50"
                  >
                    {deleting ? "Deleting…" : "Delete"}
                  </button>
                )}
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? "Saving…" : editing === "new" ? "Create Role" : "Save Role"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
