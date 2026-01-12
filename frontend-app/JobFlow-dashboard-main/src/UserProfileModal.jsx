// ============================================================================
// File: src/UserProfileModal.jsx
// Version: v1.3 – Fixed self-update to exclude role/is_active
// ============================================================================

import React, { useEffect, useState } from "react";
import { UsersAPI, CompaniesAPI } from "./api";
import { useCompany } from "./CompanyContext";
import { formatDate, formatTime } from "./utils/formatting.js";

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
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

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
    });
    
    // Reset password form when user changes
    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setPasswordError("");
    setPasswordSuccess(false);
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

  const handlePasswordChange = (field, value) => {
    setPasswordForm((prev) => ({ ...prev, [field]: value }));
    setPasswordError("");
    setPasswordSuccess(false);
  };

  const handleChangePassword = async () => {
    const { currentPassword, newPassword, confirmPassword } = passwordForm;

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("All password fields are required");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters");
      return;
    }

    try {
      setPasswordError("");
      
      // Call the password change API
      const response = await UsersAPI.changePassword({
        currentPassword,
        newPassword,
      });

      setPasswordSuccess(true);
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      // Hide success message after 3 seconds
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err) {
      setPasswordError(err.message || "Failed to change password");
    }
  };

  const handleSave = () => {
    if (!form.name || !form.email) {
      setError("Name and email are required");
      return;
    }

    // Build payload - exclude role/is_active when updating self, exclude password always
    const payload = {
      name: form.name,
      email: form.email,
      phone: form.phone,
    };

    // Only include role/is_active if editing another user
    if (!isMyProfile) {
      payload.role = form.role;
      payload.is_active = form.is_active;
    }

    // NOTE: Password should NOT be sent here - need separate password change flow
    // Using /users/me/password endpoint with current + new password

    onSave && onSave(payload);
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
              disabled={mode === "view" || isMyProfile}
              value={form.role}
              onChange={(e) => handleChange("role", e.target.value)}
              className="w-full rounded-xl border px-4 py-3 disabled:bg-gray-50 disabled:cursor-not-allowed"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
              {currentUser?.role === "master" && (
                <option value="master">Master</option>
              )}
            </select>
          </div>

{/* ACTIVE TOGGLE - Only show when admin/master viewing other users */}
          {!isMyProfile && (
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
          
          )}

          {/* PASSWORD CHANGE - Only for self in edit mode */}
          {mode === "edit" && isMyProfile && (
            <div className="pt-4 border-t">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Change Password</h3>
              
              {passwordError && (
                <div className="bg-red-50 border-l-4 border-red-600 p-3 text-red-800 text-sm mb-3">
                  {passwordError}
                </div>
              )}

              {passwordSuccess && (
                <div className="bg-green-50 border-l-4 border-green-600 p-3 text-green-800 text-sm mb-3">
                  Password changed successfully!
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => handlePasswordChange("currentPassword", e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    placeholder="Enter current password"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => handlePasswordChange("newPassword", e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    placeholder="Enter new password"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => handlePasswordChange("confirmPassword", e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    placeholder="Confirm new password"
                  />
                </div>

                <button
                  onClick={handleChangePassword}
                  className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 text-sm"
                >
                  Change Password
                </button>
              </div>
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