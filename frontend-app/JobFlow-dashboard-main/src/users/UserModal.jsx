// ============================================================================
// File: src/users/UserModal.jsx
// Version: v2.0.0 - Complete rewrite for proper user management
// ============================================================================

import React, { useEffect, useState } from "react";
import { useCompany } from "../CompanyContext";

const formatPhoneNumber = (value) => {
  if (!value) return "";
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

export default function UserModal({
  mode, // "view" | "edit" | "create"
  user,
  currentUser,
  defaultCompanyId,
  onEdit,
  onClose,
  onSave,
  onDelete,
}) {
  const { companies } = useCompany();
  const [viewMode, setViewMode] = useState(mode === "create" ? "edit" : "view");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "user",
    company_id: defaultCompanyId || null,
    is_active: true,
    password: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode === "create") {
      setViewMode("edit");
      setForm({
        name: "",
        email: "",
        phone: "",
        role: "user",
        company_id: defaultCompanyId || null,
        is_active: true,
        password: "",
      });
    } else if (user) {
      setViewMode("view");
      setForm({
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
        role: user.role || "user",
        company_id: user.companyId || user.company_id || null,
        is_active: user.isActive ?? user.is_active ?? true,
        password: "",
      });
    }
  }, [mode, user, defaultCompanyId]);

  const handleChange = (field, value) => {
    if (field === "phone") {
      setForm((prev) => ({ ...prev, [field]: formatPhoneNumber(value) }));
    } else {
      setForm((prev) => ({ ...prev, [field]: value }));
    }
    setError("");
  };

  const handleSave = async () => {
    // Validation
    if (!form.name || !form.email) {
      setError("Name and email are required");
      return;
    }

    if (mode === "create" && !form.password) {
      setError("Password is required for new users");
      return;
    }

    if (saving) return;

    try {
      setSaving(true);
      setError("");
      await onSave(form);
      if (mode !== "create") {
        setViewMode("view");
      }
    } catch (err) {
      setError(err.message || "Failed to save user");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!user) return;
    if (currentUser && user.id === currentUser.id) {
      setError("You cannot delete your own account");
      return;
    }
    if (window.confirm(`Are you sure you want to delete ${user.name}?`)) {
      onDelete(user);
    }
  };

  const handleEdit = () => {
    setViewMode("edit");
    if (onEdit) onEdit();
  };

  const isCreate = mode === "create";
  const isSelf = user && currentUser && user.id === currentUser.id;
  const isMaster = currentUser?.role === "master";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1000] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* HEADER */}
        <div className="bg-blue-600 text-white p-6">
          <h2 className="text-xl font-bold">
            {isCreate ? "Add New User" : viewMode === "edit" ? "Edit User" : "User Details"}
          </h2>
        </div>

        {/* BODY */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-600 p-3 text-red-800 text-sm">
              {error}
            </div>
          )}

          {/* NAME */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Name *
            </label>
            <input
              disabled={viewMode === "view"}
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              className="w-full rounded-lg border px-4 py-3 disabled:bg-gray-50 disabled:text-gray-700"
              placeholder="John Doe"
            />
          </div>

          {/* EMAIL */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Email *
            </label>
            <input
              type="email"
              disabled={viewMode === "view"}
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
              className="w-full rounded-lg border px-4 py-3 disabled:bg-gray-50 disabled:text-gray-700"
              placeholder="john@example.com"
            />
          </div>

          {/* PHONE */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Phone
            </label>
            <input
              type="tel"
              disabled={viewMode === "view"}
              value={form.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
              className="w-full rounded-lg border px-4 py-3 disabled:bg-gray-50 disabled:text-gray-700"
              placeholder="(555) 123-4567"
            />
          </div>

          {/* ROLE */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Role
            </label>
            <select
              disabled={viewMode === "view" || isSelf}
              value={form.role}
              onChange={(e) => handleChange("role", e.target.value)}
              className="w-full rounded-lg border px-4 py-3 disabled:bg-gray-50 disabled:text-gray-700"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
              {isMaster && <option value="master">Master</option>}
            </select>
            {isSelf && (
              <p className="text-xs text-gray-500 mt-1">Cannot change your own role</p>
            )}
          </div>

          {/* COMPANY (Master only) */}
          {isMaster && companies && companies.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Company
              </label>
              <select
                disabled={viewMode === "view"}
                value={form.company_id || ""}
                onChange={(e) => handleChange("company_id", parseInt(e.target.value))}
                className="w-full rounded-lg border px-4 py-3 disabled:bg-gray-50 disabled:text-gray-700"
              >
                <option value="">Select Company</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.companyName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* STATUS */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-sm font-semibold text-gray-700">Status</span>
            {viewMode === "view" ? (
              <span className="font-medium text-gray-700">
                {form.is_active ? "Active" : "Inactive"}
              </span>
            ) : (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => handleChange("is_active", e.target.checked)}
                  disabled={isSelf}
                  className="w-5 h-5"
                />
                <span className="text-sm text-gray-600">Active</span>
              </label>
            )}
          </div>

          {/* PASSWORD */}
          {viewMode === "edit" && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                {isCreate ? "Password *" : "New Password"}
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => handleChange("password", e.target.value)}
                className="w-full rounded-lg border px-4 py-3"
                placeholder={isCreate ? "Set password" : "Leave blank to keep current"}
              />
              {!isCreate && (
                <p className="text-xs text-gray-500 mt-1">
                  Only enter if changing password
                </p>
              )}
            </div>
          )}

          {/* META INFO (view mode only) */}
          {viewMode === "view" && user && (
            <div className="pt-4 border-t space-y-2">
              <div className="text-sm text-gray-500 flex justify-between">
                <span>User ID</span>
                <span className="font-medium text-gray-700">{user.id}</span>
              </div>
              {user.created_at && (
                <div className="text-sm text-gray-500 flex justify-between">
                  <span>Created</span>
                  <span className="font-medium text-gray-700">
                    {new Date(user.created_at).toLocaleDateString()}
                  </span>
                </div>
              )}
              {user.last_login && (
                <div className="text-sm text-gray-500 flex justify-between">
                  <span>Last Login</span>
                  <span className="font-medium text-gray-700">
                    {new Date(user.last_login).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="border-t px-6 py-4 bg-gray-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 font-semibold hover:text-gray-800"
          >
            {isCreate || viewMode === "edit" ? "Cancel" : "Close"}
          </button>

          <div className="flex items-center gap-3">
            {viewMode === "view" && !isCreate && !isSelf && (
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-red-600 font-semibold hover:text-red-700"
              >
                Delete
              </button>
            )}

            {viewMode === "view" && !isCreate ? (
              <button
                onClick={handleEdit}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
              >
                Edit
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : isCreate ? "Create User" : "Save"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
