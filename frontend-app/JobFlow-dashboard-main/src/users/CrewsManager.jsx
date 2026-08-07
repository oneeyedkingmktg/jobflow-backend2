// ============================================================================
// File: src/users/CrewsManager.jsx
// Manage company crews — create/edit/delete crews, add/remove members
// ============================================================================

import React, { useEffect, useState, useMemo } from "react";
import { CrewsAPI, UsersAPI } from "../api";

const PRESET_COLORS = [
  "#6366f1", // indigo
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
  "#64748b", // slate
];

const BLANK_FORM = { name: "", color: "#6366f1", is_active: true, has_calendar: false };

export default function CrewsManager({ companyId, onClose }) {
  const [crews, setCrews] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | "new" | crew object
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  // For adding a member
  const [addingMember, setAddingMember] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");

  useEffect(() => {
    loadAll();
  }, [companyId]);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [crewsRes, usersRes] = await Promise.all([
        CrewsAPI.getAll(companyId),
        UsersAPI.getAll(companyId),
      ]);
      setCrews(crewsRes.crews || []);
      setAllUsers((usersRes.users || []).filter((u) => u.isActive !== false && u.is_active !== false));
    } catch (err) {
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    setForm(BLANK_FORM);
    setEditing("new");
    setError("");
    setSelectedUserId("");
  };

  const openEdit = (crew) => {
    setForm({ name: crew.name, color: crew.color || "#6366f1", is_active: crew.is_active, has_calendar: crew.has_calendar || false });
    setEditing(crew);
    setError("");
    setSelectedUserId("");
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError("Crew name is required"); return; }
    setSaving(true);
    setError("");
    try {
      if (editing === "new") {
        const res = await CrewsAPI.create({ ...form, company_id: companyId });
        setCrews((prev) => [...prev, res.crew]);
        setEditing(res.crew); // stay in editor to add members
      } else {
        const res = await CrewsAPI.update(editing.id, form);
        // Merge updated fields but keep local members list
        setCrews((prev) =>
          prev.map((c) => (c.id === editing.id ? { ...c, ...res.crew, members: c.members } : c))
        );
        setEditing((prev) => ({ ...prev, ...res.crew }));
      }
    } catch (err) {
      setError(err.message || "Failed to save crew");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editing || editing === "new") return;
    if (!window.confirm(`Delete the "${editing.name}" crew? Members will be unassigned.`)) return;
    setDeleting(true);
    setError("");
    try {
      await CrewsAPI.delete(editing.id);
      setCrews((prev) => prev.filter((c) => c.id !== editing.id));
      setEditing(null);
    } catch (err) {
      setError(err.message || "Failed to delete crew");
    } finally {
      setDeleting(false);
    }
  };

  const handleAddMember = async () => {
    if (!selectedUserId || editing === "new") return;
    setAddingMember(true);
    setError("");
    try {
      await CrewsAPI.addMember(editing.id, parseInt(selectedUserId, 10), false);
      const user = allUsers.find((u) => u.id === parseInt(selectedUserId, 10));
      const newMember = {
        userId: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isActive: true,
        isLead: false,
      };
      setCrews((prev) =>
        prev.map((c) =>
          c.id === editing.id ? { ...c, members: [...(c.members || []), newMember] } : c
        )
      );
      setEditing((prev) => ({ ...prev, members: [...(prev.members || []), newMember] }));
      setSelectedUserId("");
    } catch (err) {
      setError(err.message || "Failed to add member");
    } finally {
      setAddingMember(false);
    }
  };

  const handleToggleLead = async (member, newIsLead) => {
    if (editing === "new") return;
    try {
      await CrewsAPI.updateMember(editing.id, member.userId, newIsLead);
      const updateMembers = (members) =>
        members.map((m) => (m.userId === member.userId ? { ...m, isLead: newIsLead } : m));
      setCrews((prev) =>
        prev.map((c) => (c.id === editing.id ? { ...c, members: updateMembers(c.members || []) } : c))
      );
      setEditing((prev) => ({ ...prev, members: updateMembers(prev.members || []) }));
    } catch (err) {
      setError(err.message || "Failed to update member");
    }
  };

  const handleRemoveMember = async (member) => {
    if (editing === "new") return;
    try {
      await CrewsAPI.removeMember(editing.id, member.userId);
      const filterMembers = (members) => members.filter((m) => m.userId !== member.userId);
      setCrews((prev) =>
        prev.map((c) => (c.id === editing.id ? { ...c, members: filterMembers(c.members || []) } : c))
      );
      setEditing((prev) => ({ ...prev, members: filterMembers(prev.members || []) }));
    } catch (err) {
      setError(err.message || "Failed to remove member");
    }
  };

  // Users not already in this crew
  const currentMembers = editing && editing !== "new" ? (editing.members || []) : [];
  const currentMemberIds = new Set(currentMembers.map((m) => m.userId));
  const availableUsers = useMemo(
    () => allUsers.filter((u) => !currentMemberIds.has(u.id)),
    [allUsers, currentMemberIds]
  );

  const isNewUnsaved = editing === "new";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1050] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">

        {/* HEADER */}
        <div className="bg-blue-700 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-bold">Crews</h2>
            <p className="text-blue-200 text-sm mt-0.5">Organize your team into reusable crews</p>
          </div>
          {editing && (
            <button
              onClick={() => { setEditing(null); setError(""); }}
              className="text-blue-200 hover:text-white text-sm font-semibold"
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

          {/* ── CREW LIST ── */}
          {!editing && (
            <>
              <button
                onClick={openNew}
                className="w-full py-3 border-2 border-dashed border-blue-400 rounded-xl text-blue-600 font-semibold hover:bg-blue-50 transition"
              >
                + New Crew
              </button>

              {loading ? (
                <div className="text-center text-gray-500 py-8">Loading crews…</div>
              ) : crews.length === 0 ? (
                <div className="text-center text-gray-400 py-8 text-sm">
                  No crews yet. Create your first crew above.
                </div>
              ) : (
                <div className="space-y-2">
                  {crews.map((crew) => (
                    <div
                      key={crew.id}
                      onClick={() => openEdit(crew)}
                      className="flex items-center gap-4 p-4 border border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition"
                    >
                      {/* Color swatch */}
                      <div
                        className="w-4 h-10 rounded-full shrink-0"
                        style={{ backgroundColor: crew.color || "#6366f1" }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 flex items-center gap-2">
                          {crew.name}
                          {!crew.is_active && (
                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                              Inactive
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {(crew.members || []).length} member{(crew.members || []).length !== 1 ? "s" : ""}
                          {(crew.members || []).some((m) => m.isLead) && (
                            <span className="ml-2 text-blue-600 font-medium">· has crew lead</span>
                          )}
                        </div>
                      </div>
                      <span className="text-gray-400 text-sm shrink-0">Edit →</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── CREW EDITOR ── */}
          {editing && (
            <div className="space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Crew Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full rounded-lg border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Crew A, Install Team 1"
                />
              </div>

              {/* Color */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Color</label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setForm((p) => ({ ...p, color: c }))}
                      className="w-8 h-8 rounded-full border-2 transition"
                      style={{
                        backgroundColor: c,
                        borderColor: form.color === c ? "#1e40af" : "transparent",
                        outline: form.color === c ? "2px solid #93c5fd" : "none",
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Active toggle */}
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl">
                <div className="font-semibold text-gray-800 text-sm">Active</div>
                <div
                  onClick={() => setForm((p) => ({ ...p, is_active: !p.is_active }))}
                  className={`relative w-11 h-6 rounded-full cursor-pointer transition-colors ${
                    form.is_active ? "bg-blue-600" : "bg-gray-300"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      form.is_active ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </div>
              </div>

              {/* Has Calendar toggle */}
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl">
                <div>
                  <div className="font-semibold text-gray-800 text-sm">Has a Calendar</div>
                  <div className="text-xs text-gray-500 mt-0.5">Show this crew's installs in the scheduling calendar</div>
                </div>
                <div
                  onClick={() => setForm((p) => ({ ...p, has_calendar: !p.has_calendar }))}
                  className={`relative w-11 h-6 rounded-full cursor-pointer transition-colors ${
                    form.has_calendar ? "bg-blue-600" : "bg-gray-300"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      form.has_calendar ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </div>
              </div>

              {/* Save crew first prompt for new */}
              {isNewUnsaved && (
                <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3 text-center">
                  Save the crew first, then you can add members.
                </div>
              )}

              {/* Members section — only for existing crews */}
              {!isNewUnsaved && (
                <div>
                  <div className="text-sm font-semibold text-gray-700 mb-2">Members</div>

                  {/* Current members */}
                  {currentMembers.length === 0 ? (
                    <div className="text-sm text-gray-400 text-center py-3">No members yet</div>
                  ) : (
                    <div className="space-y-2 mb-3">
                      {currentMembers.map((m) => (
                        <div
                          key={m.userId}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100"
                        >
                          <div>
                            <div className="font-medium text-gray-900 text-sm">{m.name}</div>
                            {m.email && (
                              <div className="text-xs text-gray-500">{m.email}</div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <select
                              value={m.isLead ? "lead" : "member"}
                              onChange={(e) => handleToggleLead(m, e.target.value === "lead")}
                              className="text-xs font-semibold rounded-md px-2 py-1 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white text-gray-700"
                            >
                              <option value="lead">Crew Lead</option>
                              <option value="member">Member</option>
                            </select>
                            <button
                              onClick={() => handleRemoveMember(m)}
                              className="text-red-400 hover:text-red-600 text-lg leading-none px-1"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add member */}
                  {availableUsers.length > 0 && (
                    <div className="flex gap-2">
                      <select
                        value={selectedUserId}
                        onChange={(e) => setSelectedUserId(e.target.value)}
                        className="flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select employee to add…</option>
                        {availableUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name || u.email}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={handleAddMember}
                        disabled={!selectedUserId || addingMember}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                      >
                        {addingMember ? "Adding…" : "Add"}
                      </button>
                    </div>
                  )}
                  {availableUsers.length === 0 && currentMembers.length > 0 && (
                    <div className="text-xs text-gray-400 text-center">All active employees are in this crew</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="border-t px-6 py-4 bg-gray-50 flex items-center justify-between shrink-0">
          {!editing ? (
            <button onClick={onClose} className="px-4 py-2 text-gray-600 font-semibold hover:text-gray-800">
              Close
            </button>
          ) : (
            <>
              <div className="flex gap-3">
                <button
                  onClick={() => { setEditing(null); setError(""); }}
                  className="px-4 py-2 text-gray-600 font-semibold hover:text-gray-800"
                >
                  {isNewUnsaved ? "Cancel" : "Done"}
                </button>
                {!isNewUnsaved && (
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-4 py-2 text-red-600 font-semibold hover:text-red-700 disabled:opacity-50"
                  >
                    {deleting ? "Deleting…" : "Delete Crew"}
                  </button>
                )}
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-blue-700 text-white rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50"
              >
                {saving ? "Saving…" : isNewUnsaved ? "Create Crew" : "Save Changes"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
