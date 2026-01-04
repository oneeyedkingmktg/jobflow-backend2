import React, { useState, useEffect } from "react";
import { UsersAPI } from "./api";
import { useCompany } from "./CompanyContext";
import { useAuth } from "./AuthContext";

export default function UserManagement({ onBack }) {
  const { currentCompany } = useCompany();
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedUser, setSelectedUser] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);

  const loadUsers = async () => {
    if (!currentCompany) return;
    const res = await UsersAPI.getAll();
    setUsers(res.users || []);
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, [currentCompany]);

  const openUser = (user) => {
    setSelectedUser(user);
    setIsEditing(false);
    setEditForm({
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      role: user.role,
      is_active: user.is_active,
      newPassword: "",
    });
  };

  const handleSave = async () => {
    await UsersAPI.update(selectedUser.id, {
      name: editForm.name,
      email: editForm.email,
      phone: editForm.phone,
      role: editForm.role,
      is_active: editForm.is_active,
      ...(editForm.newPassword ? { password: editForm.newPassword } : {}),
    });

    setSelectedUser(null);
    setIsEditing(false);
    loadUsers();
  };

  const handleSaveAndExit = async () => {
    if (isEditing) {
      await handleSave();
    }
    setSelectedUser(null);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this user?")) return;
    await UsersAPI.delete(selectedUser.id);
    setSelectedUser(null);
    loadUsers();
  };

  /* ========================= */
  /* LIST VIEW */
  /* ========================= */
  if (!selectedUser) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-6">User Management</h2>

        {loading ? (
          <div>Loading…</div>
        ) : (
          <div className="space-y-3">
            {users.map((u) => (
              <div
                key={u.id}
                onClick={() => openUser(u)}
                className="p-4 border rounded-lg cursor-pointer hover:bg-gray-50"
              >
                <div className="font-bold">{u.name}</div>
                <div className="text-sm text-gray-600">{u.email}</div>
                <div className="text-xs text-gray-500 flex gap-2 mt-1">
                  <span>Role: {u.role}</span>
                  <span>•</span>
                  <span>{u.is_active ? "Active" : "Inactive"}</span>
                  {u.last_login && (
                    <>
                      <span>•</span>
                      <span>Last login: {u.last_login}</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <button onClick={onBack} className="btn btn-secondary mt-8">
          Back
        </button>
      </div>
    );
  }

  /* ========================= */
  /* DETAIL VIEW */
  /* ========================= */
  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">
        {isEditing ? "Edit User" : "User Details"}
      </h2>

      <div className="space-y-4 mb-20">
        {/* Name */}
        <div>
          <label className="form-label">Name</label>
          {isEditing ? (
            <input
              className="input"
              value={editForm.name}
              onChange={(e) =>
                setEditForm({ ...editForm, name: e.target.value })
              }
            />
          ) : (
            <div>{selectedUser.name}</div>
          )}
        </div>

        {/* Email */}
        <div>
          <label className="form-label">Email</label>
          {isEditing ? (
            <input
              className="input"
              value={editForm.email}
              onChange={(e) =>
                setEditForm({ ...editForm, email: e.target.value })
              }
            />
          ) : (
            <div>{selectedUser.email}</div>
          )}
        </div>

        {/* Phone */}
        <div>
          <label className="form-label">Phone</label>
          {isEditing ? (
            <input
              className="input"
              value={editForm.phone}
              onChange={(e) =>
                setEditForm({ ...editForm, phone: e.target.value })
              }
            />
          ) : (
            <div>{selectedUser.phone || "—"}</div>
          )}
        </div>

        {/* Role */}
        <div>
          <label className="form-label">Role</label>
          {isEditing ? (
            <select
              className="input"
              value={editForm.role}
              onChange={(e) =>
                setEditForm({ ...editForm, role: e.target.value })
              }
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
              {currentUser.role === "master" && (
                <option value="master">Master</option>
              )}
            </select>
          ) : (
            <div>{selectedUser.role}</div>
          )}
        </div>

        {/* Active Toggle */}
        <div>
          <label className="form-label">Status</label>
          {isEditing ? (
            <select
              className="input"
              value={editForm.is_active ? "active" : "inactive"}
              onChange={(e) =>
                setEditForm({
                  ...editForm,
                  is_active: e.target.value === "active",
                })
              }
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          ) : (
            <div>{selectedUser.is_active ? "Active" : "Inactive"}</div>
          )}
        </div>

        {/* Password */}
        {isEditing && (
          <div>
            <label className="form-label">Set New Password</label>
            <input
              className="input"
              type="password"
              value={editForm.newPassword}
              onChange={(e) =>
                setEditForm({ ...editForm, newPassword: e.target.value })
              }
              placeholder="Leave blank to keep current password"
            />
          </div>
        )}

        {/* Meta */}
        <div className="text-sm text-gray-500 pt-4 border-t">
          <div>User ID: {selectedUser.id}</div>
          {selectedUser.created_at && (
            <div>Created: {selectedUser.created_at}</div>
          )}
          {selectedUser.updated_at && (
            <div>Updated: {selectedUser.updated_at}</div>
          )}
          {selectedUser.last_login && (
            <div>Last Login: {selectedUser.last_login}</div>
          )}
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 flex justify-between items-center">
        <button
          onClick={handleSaveAndExit}
          className="btn btn-secondary"
        >
          Save & Exit
        </button>

        <button
          onClick={handleDelete}
          className="text-red-600 text-sm"
        >
          Delete User
        </button>

        <button
          onClick={() => {
            if (isEditing) {
              handleSave();
            } else {
              setIsEditing(true);
            }
          }}
          className="btn btn-primary"
        >
          {isEditing ? "Save" : "Edit"}
        </button>
      </div>
    </div>
  );
}
