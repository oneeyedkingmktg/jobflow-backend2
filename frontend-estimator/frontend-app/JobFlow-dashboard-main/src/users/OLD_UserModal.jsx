// File: src/users/UserModal.jsx

import React, { useEffect, useState } from "react";

export default function UserModal({
  isCreate,
  user,
  currentUser,
  onClose,
  onSave,
  onDelete,
}) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "user",
    password: "",
    confirmPassword: "",
    isActive: true,
  });

  const [error, setError] = useState("");

  useEffect(() => {
    if (!isCreate && user) {
      setForm({
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
        role: user.role || "user",
        password: "",
        confirmPassword: "",
        isActive: user.is_active !== false,
      });
    } else {
      setForm({
        name: "",
        email: "",
        phone: "",
        role: "user",
        password: "",
        confirmPassword: "",
        isActive: true,
      });
    }
  }, [isCreate, user]);

  const isSelf = user && currentUser && user.id === currentUser.id;
  const currentRole = currentUser?.role || "user";

  const availableRoles =
    currentRole === "master" ? ["master", "admin", "user"] : ["user"];

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    setError("");

    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }

    if (!form.email.trim()) {
      setError("Email is required");
      return;
    }

    if (isCreate) {
      if (!form.password) {
        setError("Password is required for new users");
        return;
      }
      if (form.password !== form.confirmPassword) {
        setError("Passwords do not match");
        return;
      }
    }

    onSave(form);
  };

  const handleDeleteClick = () => {
    if (user && !isSelf) {
      onDelete(user);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-400">
              {isCreate ? "New User" : "Edit User"}
            </div>
            <div className="text-lg font-semibold text-gray-900">
              {isCreate ? "Create User" : user?.name || user?.email}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 text-red-700 px-3 py-2 text-xs">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Name
              </label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Email
              </label>
              <input
                type="email"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                value={form.email}
                disabled={!isCreate}
                onChange={(e) => handleChange("email", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Phone
              </label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
              />
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Role
                </label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  value={form.role}
                  disabled={isSelf && currentRole !== "master"}
                  onChange={(e) => handleChange("role", e.target.value)}
                >
                  {availableRoles.map((r) => (
                    <option key={r} value={r}>
                      {r.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              {!isCreate && (
                <div className="flex items-end">
                  <label className="inline-flex items-center mt-5 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      className="mr-2"
                      checked={form.isActive}
                      onChange={(e) =>
                        handleChange("isActive", e.target.checked)
                      }
                    />
                    Active
                  </label>
                </div>
              )}
            </div>

            {/* Password fields always shown per spec */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  {isCreate ? "Password" : "Password (new, optional)"}
                </label>
                <input
                  type="password"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.password}
                  onChange={(e) => handleChange("password", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.confirmPassword}
                  onChange={(e) =>
                    handleChange("confirmPassword", e.target.value)
                  }
                />
              </div>
            </div>

            {!isCreate && (
              <p className="text-[11px] text-gray-500">
                For now, password fields are only used when creating a new user.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>

            {!isCreate && !isSelf && (
              <button
                onClick={handleDeleteClick}
                className="px-4 py-2 rounded-lg text-xs font-semibold border border-red-200 text-red-600 hover:bg-red-50"
              >
                Delete User
              </button>
            )}
          </div>

          <button
            onClick={handleSubmit}
            className="px-5 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
          >
            {isCreate ? "Create User" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
