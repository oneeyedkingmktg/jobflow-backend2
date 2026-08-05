// ============================================================================
// File: src/users/UserModal.jsx
// Version: v2.0.0 - Complete rewrite for proper user management
// ============================================================================

import React, { useEffect, useState } from "react";
import { useCompany } from "../CompanyContext";
import UserPermissionsModal from "./UserPermissionsModal";

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

  // Resolve the active company object for feature-flag filtering in permissions
  const userCompanyId = user?.companyId || user?.company_id || defaultCompanyId;
  const activeCompany = companies?.find(
    (c) => c.id === userCompanyId || c.companyId === userCompanyId
  ) || null;
  const SALESMAN_COLORS = [
    "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#3b82f6",
    "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#64748b",
  ];

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "user",
    company_id: defaultCompanyId || null,
    is_active: true,
    password: "",
    sip_username: "",
    sip_password: "",
    sip_incoming_enabled: false,
    is_salesman: false,
    salesman_color: "#6366f1",
    hourly_cost: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
  const [localPermissions, setLocalPermissions] = useState(user?.permissions || {});
  const [localPermissionRoleId, setLocalPermissionRoleId] = useState(
    user?.permissionRoleId ?? user?.permission_role_id ?? null
  );

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
        sip_username: user.sip_username || user.sipUsername || "",
        sip_password: "",  // never pre-fill password
        sip_incoming_enabled: user.sip_incoming_enabled ?? user.sipIncomingEnabled ?? false,
        service_calls_enabled: user.service_calls_enabled ?? user.serviceCallsEnabled ?? false,
        is_salesman: user.is_salesman ?? user.isSalesman ?? false,
        salesman_color: user.salesman_color || user.salesmanColor || "#6366f1",
        hourly_cost: user.hourly_cost ?? user.hourlyCost ?? "",
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
  const isAdminOrMaster = currentUser?.role === "master" || currentUser?.role === "admin";
  const canManagePermissions = isAdminOrMaster && !isCreate && !isSelf;

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

          {/* SALESMAN TYPE */}
          {isAdminOrMaster && !isCreate && !isSelf && viewMode === "view" && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm font-semibold text-gray-700">Salesman</span>
              <div className="flex items-center gap-2">
                {form.is_salesman && form.salesman_color && (
                  <span className="inline-block w-4 h-4 rounded-full border border-gray-300" style={{ backgroundColor: form.salesman_color }} />
                )}
                <span className="font-medium text-gray-700">{form.is_salesman ? "Yes" : "No"}</span>
              </div>
            </div>
          )}
          {isAdminOrMaster && !isSelf && viewMode === "edit" && (
            <div className="pt-2 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Salesman</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_salesman}
                    onChange={(e) => handleChange("is_salesman", e.target.checked)}
                    className="w-5 h-5"
                  />
                  <span className="text-sm text-gray-600">Is a salesman</span>
                </label>
              </div>
              {form.is_salesman && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Salesman Color</label>
                  <div className="flex gap-2 flex-wrap">
                    {SALESMAN_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => handleChange("salesman_color", c)}
                        className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
                        style={{
                          backgroundColor: c,
                          borderColor: form.salesman_color === c ? "#111" : "transparent",
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* HOURLY COST (admin/master only, not self) — for job costing only */}
          {isAdminOrMaster && !isSelf && !isCreate && viewMode === "view" && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm font-semibold text-gray-700">Hourly Cost Rate</span>
              <span className="font-medium text-gray-700">
                {form.hourly_cost ? `$${parseFloat(form.hourly_cost).toFixed(2)}/hr` : "Not set"}
              </span>
            </div>
          )}
          {isAdminOrMaster && !isSelf && viewMode === "edit" && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Hourly Cost Rate
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.hourly_cost}
                  onChange={(e) => handleChange("hourly_cost", e.target.value)}
                  className="w-full rounded-lg border px-4 py-3 pl-7"
                  placeholder="0.00"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Internal only — used for job cost calculations. Not visible to this user.</p>
            </div>
          )}

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

          {/* LAST ACTIVITY - master only */}
          {currentUser?.role === "master" && viewMode === "view" && user?.last_activity && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm font-semibold text-gray-700">Last Activity</span>
              <span className="font-medium text-gray-700 text-sm">
                {new Date(user.last_activity).toLocaleString("en-US", {
                  month: "short", day: "numeric", year: "numeric",
                  hour: "numeric", minute: "2-digit", hour12: true,
                })}
              </span>
            </div>
          )}


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

          {/* SIP CREDENTIALS — master edit only */}
          {isMaster && viewMode === "edit" && (
            <div className="pt-4 border-t space-y-3">
              <div className="text-sm font-bold text-gray-700">SIP Softphone Credentials</div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">SIP Username</label>
                <input
                  value={form.sip_username}
                  onChange={(e) => handleChange("sip_username", e.target.value)}
                  className="w-full rounded-lg border px-4 py-3"
                  placeholder="e.g. john.doe"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">SIP Password</label>
                <input
                  type="password"
                  value={form.sip_password}
                  onChange={(e) => handleChange("sip_password", e.target.value)}
                  className="w-full rounded-lg border px-4 py-3"
                  placeholder={user?.sip_username || user?.sipUsername ? "Leave blank to keep existing" : "Set SIP password"}
                />
              </div>

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

            {canManagePermissions && viewMode === "view" && (
              <button
                onClick={() => setShowPermissions(true)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200"
              >
                Permissions
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

      {showPermissions && user && (
        <UserPermissionsModal
          user={{ ...user, permissions: localPermissions, permissionRoleId: localPermissionRoleId }}
          company={activeCompany}
          companyId={userCompanyId}
          onClose={() => setShowPermissions(false)}
          onSaved={(perms, roleId) => {
            setLocalPermissions(perms);
            setLocalPermissionRoleId(roleId ?? null);
          }}
        />
      )}
    </div>
  );
}
