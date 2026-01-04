// ============================================================================
// File: src/UserProfileModal.jsx
// Version: v1.2 – Show meta fields only for master/admin viewing other users
// ============================================================================

import React, { useEffect, useState } from "react";
import { UsersAPI, CompaniesAPI } from "./api";
import { useCompany } from "./CompanyContext";

export default function UserProfileModal({
  user,
  currentUser,
  onClose,
  onSave,
  onDelete,
}) {
  const { companies } = useCompany();

  // ✅ resolve user for self-profile
  const resolvedUser = user || currentUser;
  
  // Check if this is "My Profile" (editing self)
  const isMyProfile = !user || user.id === currentUser?.id;
  
  // Check if current user can see meta fields
  const canSeeMetaFields = 
    !isMyProfile && 
    (currentUser?.role === "master" || currentUser?.role === "admin");

  const [mode, setMode] = useState("view"); // view | edit
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "user",
    is_active: true,
    password: "",
  });
  const [error, setError] = useState("");

  // 🔒 resolved company for THIS user (not currentCompany)
  const [resolvedCompany, setResolvedCompany] = useState(null);

  useEffect(() => {
    if (!resolvedUser) return;

    setForm({
      name: resolvedUser.name || "",
      email: resolvedUser.email || "",
      phone: resolvedUser.phone || "",
      role: resolvedUser.role || "user",
      is_active: resolvedUser.is_active !== false,
      password: "",
    });
  }, [resolvedUser]);

  // Resolve the user's company deterministically
  useEffect(() => {
    let alive = true;

    const run = async () => {
      const companyId =
        resolvedUser?.companyId ?? resolvedUser?.company_id ?? null;

      if (!companyId) {
        if (alive) setResolvedCompany(null);
        return;
      }

      // 1) try context first
      const fromContext = Array.isArray(companies)
        ? companies.find((c) => c.id === companyId)
        : null;

      if (fromContext) {
        if (alive) setResolvedCompany(fromContext);
        return;
      }

      // 2) API fallback
      try {
        const res = await CompaniesAPI.get(companyId);
        if (alive) setResolvedCompany(res?.company || null);
      } catch {
        if (alive) setResolvedCompany(null);
      }
    };

    run();

    return () => {
      alive = false;
    };
  }, [resolvedUser, companies]);

  if (!resolvedUser) return null;

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  const handleSave = () => {
    if (!form.name || !form.email) {
      setError("Name and email are required");
      return;
    }

    onSave &&
      onSave({
        name: form.name,
        email: form.email,
        phone: form.phone,
        role: form.role,
        is_active: form.is_active,
        ...(form.password ? { password: form.password } : {}),
      });

    setMode("view");
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const metaRow = (label, value) => (
    <div className="text-sm text-gray-500 flex justify-between">
      <span>{label}</span>
      <span className="font-medium text-gray-700">{value || "—"}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1000] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* HEADER */}
        <div className="bg-blue-600 text-white p-6">
          <h2 className="text-xl font-bold">
            {isMyProfile ? "My Profile" : mode === "view" ? "User Details" : "Edit User"}
          </h2>
        </div>

        {/* BODY */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-600 p-3 text-red-800">
              {error}
            </div>
          )}

          {/* NAME */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Name
            </label>
            <input
              disabled={mode === "view"}
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              className="w-full rounded-xl border px-4 py-3 disabled:bg-gray-50"
            />
          </div>

          {/* EMAIL */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Email
            </label>
            <input
              disabled={mode === "view"}
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
              className="w-full rounded-xl border px-4 py-3 disabled:bg-gray-50"
            />
          </div>

          {/* PHONE */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Phone
            </label>
            <input
              disabled={mode === "view"}
              value={form.phone || ""}
              onChange={(e) => handleChange("phone", e.target.value)}
              className="w-full rounded-xl border px-4 py-3 disabled:bg-gray-50"
            />
          </div>

          {/* ROLE */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Role
            </label>
            <select
              disabled={mode === "view"}
              value={form.role}
              onChange={(e) => handleChange("role", e.target.value)}
              className="w-full rounded-xl border px-4 py-3 disabled:bg-gray-50"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
              {currentUser?.role === "master" && (
                <option value="master">Master</option>
              )}
            </select>
          </div>

          {/* ACTIVE TOGGLE */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-sm font-semibold text-gray-700">Status</span>
            {mode === "view" ? (
              <span className="font-medium">
                {form.is_active ? "Active" : "Inactive"}
              </span>
            ) : (
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => handleChange("is_active", e.target.checked)}
              />
            )}
          </div>

          {/* PASSWORD */}
          {mode === "edit" && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Set New Password
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => handleChange("password", e.target.value)}
                placeholder="Leave blank to keep current"
                className="w-full rounded-xl border px-4 py-3"
              />
            </div>
          )}

          {/* META (VIEW ONLY - Master/Admin viewing other users) */}
          {mode === "view" && canSeeMetaFields && (
            <div className="pt-4 border-t space-y-2">
              {metaRow("Company", resolvedCompany?.company_name || resolvedCompany?.name)}
              {metaRow("Created", formatDate(resolvedUser.created_at))}
              {metaRow("Last Updated", formatDate(resolvedUser.updated_at))}
              {metaRow("Last Login", formatDate(resolvedUser.last_login))}
              {metaRow("User ID", resolvedUser.id)}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="flex items-center justify-between px-6 py-4 border-t">
          <button onClick={onClose} className="text-gray-600 font-semibold">
            {mode === "edit" ? "Cancel" : "Close"}
          </button>

          {!isMyProfile && (
            <button
              onClick={() => onDelete && onDelete(resolvedUser)}
              className="text-red-600 font-semibold"
            >
              Delete User
            </button>
          )}

          {mode === "view" ? (
            <button
              onClick={() => setMode("edit")}
              className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold"
            >
              Edit
            </button>
          ) : (
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold"
            >
              Save
            </button>
          )}
        </div>
      </div>
    </div>
  );
}