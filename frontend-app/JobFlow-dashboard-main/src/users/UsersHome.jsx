// ============================================================================
// File: src/users/UsersHome.jsx
// Version: v1.5.1 - Remove duplicate "+ Add User" button from header
// ============================================================================

import React, { useEffect, useState, useMemo } from "react";
import { UsersAPI } from "../api";
import { useAuth } from "../AuthContext";
import { useCompany } from "../CompanyContext";
import UserCard from "./UserCard.jsx";
import UserModal from "./UserModal.jsx";

export default function UsersHome({ onBack, scopedCompany, showAllUsers = false }) {
  const { user, isAuthenticated } = useAuth();
  const { currentCompany } = useCompany();

  // Use scopedCompany if provided (from modal), otherwise use currentCompany (from global context)
  const activeCompany = scopedCompany || currentCompany;

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [modalMode, setModalMode] = useState("view"); // view | edit | create

  // For "All Users" mode, only require master role
  // For scoped mode, require master role AND a company
const canManage = showAllUsers
  ? isAuthenticated && user?.role === "master"
  : isAuthenticated && ["master", "admin"].includes(user?.role) && !!activeCompany;


  const isEmbedded = !onBack;

  useEffect(() => {
    if (!canManage) {
      setLoading(false);
      return;
    }
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage, activeCompany?.id, showAllUsers]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError("");
      
      if (showAllUsers) {
        // Get ALL users from all companies (no filtering)
        const res = await UsersAPI.getAll();
        console.log("ALL USERS (unfiltered):", res.users);
        setUsers(res.users || []);
      } else {
        // Get users for specific company
        const res = await UsersAPI.getAll(activeCompany.id);
        console.log("USERS FROM API:", res.users);
        console.log("ACTIVE COMPANY:", activeCompany);
        setUsers(res.users || []);
      }
    } catch (err) {
      setError(err.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const openViewUser = (u) => {
    setSelectedUser(u);
    setModalMode("view");
    setShowModal(true);
  };

  const openCreateUser = () => {
    setSelectedUser(null);
    setModalMode("create");
    setShowModal(true);
  };

  const handleSaveUser = async (form) => {
    try {
      setError("");

      if (modalMode === "create") {
        const payload = {
          name: form.name,
          email: form.email,
          phone: form.phone,
          role: form.role,
          password: form.password,
          is_active: form.is_active,
          // Always pass company_id from form (user can select different company)
          company_id: form.company_id || (showAllUsers ? null : activeCompany?.id),
        };

        console.log("Creating user with payload:", payload);

        const res = await UsersAPI.create(payload);
        const created = res.user || res;
        
        // Add to list if showAllUsers OR if user belongs to active company
        if (showAllUsers || created.companyId === activeCompany?.id) {
          setUsers((prev) => [created, ...prev]);
        }
      }

      if (modalMode === "edit" && selectedUser) {
        const payload = {
          name: form.name,
          email: form.email,
          phone: form.phone,
          role: form.role,
          is_active: form.is_active,
          company_id: form.company_id,
          ...(form.password ? { password: form.password } : {}),
        };

        console.log("Updating user with payload:", payload);

        const res = await UsersAPI.update(selectedUser.id, payload);
        const updated = res.user || res;

        // If in scoped mode and user was moved to different company, remove from list
        if (!showAllUsers && updated.companyId !== activeCompany?.id) {
          setUsers((prev) => prev.filter((u) => u.id !== updated.id));
        } else {
          // Otherwise update in place
          setUsers((prev) =>
            prev.map((u) => (u.id === updated.id ? updated : u))
          );
        }
      }

      setShowModal(false);
      setSelectedUser(null);
      setModalMode("view");
    } catch (err) {
      console.error("Save user error:", err);
      setError(err.message || "Failed to save user");
    }
  };

  const handleDeleteUser = async (u) => {
    try {
      await UsersAPI.delete(u.id);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      setShowModal(false);
      setSelectedUser(null);
      setModalMode("view");
    } catch (err) {
      setError(err.message || "Failed to delete user");
    }
  };

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const term = search.toLowerCase();
    return users.filter((u) => {
      return (
        (u.name || "").toLowerCase().includes(term) ||
        (u.email || "").toLowerCase().includes(term) ||
        (u.phone || "").toLowerCase().includes(term)
      );
    });
  }, [search, users]);

  if (!canManage) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-600 mb-4">
          Only the master account can manage users.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-800">
          {showAllUsers 
            ? "All System Users" 
            : activeCompany 
              ? `${activeCompany.name || activeCompany.companyName || 'Company'} Users`
              : "Users"
          }
        </h1>
      </div>

      {/* SEARCH */}
      <div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users..."
          className="w-full px-4 py-3 text-lg border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-gray-500">Loading users…</div>
      ) : filteredUsers.length === 0 && search ? (
        <div className="py-10 text-center text-gray-500">
          No users found matching "{search}"
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="py-10 text-center">
          <div className="text-gray-500 mb-4">
            {showAllUsers 
              ? "No users in system yet" 
              : "No users in this company yet"
            }
          </div>
          <button
            onClick={openCreateUser}
            className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition"
          >
            + Add First User
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <button
            onClick={openCreateUser}
            className="h-[90px] flex flex-col items-center justify-center rounded-xl border-2 border-emerald-500 bg-emerald-50 hover:bg-emerald-100 transition"
          >
            <div className="text-emerald-600 text-2xl font-bold">+</div>
            <div className="text-emerald-700 font-semibold mt-1">
              New User
            </div>
          </button>

          {filteredUsers.map((u) => (
            <UserCard
              key={u.id}
              user={u}
              onClick={() => openViewUser(u)}
            />
          ))}
        </div>
      )}

      {showModal && (
        <UserModal
          mode={modalMode}
          user={selectedUser}
          currentUser={user}
          defaultCompanyId={showAllUsers ? null : activeCompany?.id}
          onEdit={() => setModalMode("edit")}
          onClose={() => {
            setShowModal(false);
            setSelectedUser(null);
            setModalMode("view");
          }}
          onSave={handleSaveUser}
          onDelete={handleDeleteUser}
        />
      )}
    </div>
  );
}
