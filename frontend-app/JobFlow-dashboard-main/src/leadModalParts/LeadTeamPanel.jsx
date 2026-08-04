// ============================================================================
// File: src/leadModalParts/LeadTeamPanel.jsx
// Assign employees and/or crews to a job (lead)
// ============================================================================

import React, { useEffect, useState, useMemo } from "react";
import { LeadAssignmentsAPI, CrewsAPI, UsersAPI } from "../api";

const ROLES = ["installer", "lead", "helper", "subcontractor"];

const ROLE_LABELS = {
  installer: "Installer",
  lead: "Crew Lead",
  helper: "Helper",
  subcontractor: "Subcontractor",
};

const ROLE_COLORS = {
  lead: "bg-blue-100 text-blue-700",
  installer: "bg-emerald-100 text-emerald-700",
  helper: "bg-amber-100 text-amber-700",
  subcontractor: "bg-gray-100 text-gray-600",
};

export default function LeadTeamPanel({ lead, companyId, onClose }) {
  const leadId = lead?.id;

  const [assignments, setAssignments] = useState([]);
  const [crews, setCrews] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Add employee controls
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState("installer");
  const [addingEmployee, setAddingEmployee] = useState(false);

  // Add crew controls
  const [selectedCrewId, setSelectedCrewId] = useState("");
  const [addingCrew, setAddingCrew] = useState(false);

  // Which tab: "employee" | "crew"
  const [addTab, setAddTab] = useState("crew");

  useEffect(() => {
    loadAll();
  }, [leadId, companyId]);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [assignRes, crewRes, userRes] = await Promise.all([
        LeadAssignmentsAPI.getAll(leadId),
        CrewsAPI.getAll(companyId),
        UsersAPI.getAll(companyId),
      ]);
      setAssignments(assignRes.assignments || []);
      setCrews((crewRes.crews || []).filter((c) => c.is_active));
      setAllUsers(
        (userRes.users || []).filter(
          (u) => u.isActive !== false && u.is_active !== false
        )
      );
    } catch (err) {
      setError(err.message || "Failed to load team data");
    } finally {
      setLoading(false);
    }
  };

  const assignedUserIds = useMemo(
    () => new Set(assignments.map((a) => a.userId)),
    [assignments]
  );

  const availableUsers = useMemo(
    () => allUsers.filter((u) => !assignedUserIds.has(u.id)),
    [allUsers, assignedUserIds]
  );

  const handleAddEmployee = async () => {
    if (!selectedUserId) return;
    setAddingEmployee(true);
    setError("");
    try {
      const res = await LeadAssignmentsAPI.addEmployee(
        leadId,
        parseInt(selectedUserId, 10),
        selectedRole
      );
      setAssignments(res.assignments || []);
      setSelectedUserId("");
    } catch (err) {
      setError(err.message || "Failed to add employee");
    } finally {
      setAddingEmployee(false);
    }
  };

  const handleAddCrew = async () => {
    if (!selectedCrewId) return;
    setAddingCrew(true);
    setError("");
    try {
      const res = await LeadAssignmentsAPI.addCrew(
        leadId,
        parseInt(selectedCrewId, 10),
        "installer"
      );
      setAssignments(res.assignments || []);
      setSelectedCrewId("");
    } catch (err) {
      setError(err.message || "Failed to add crew");
    } finally {
      setAddingCrew(false);
    }
  };

  const handleChangeRole = async (assignment, newRole) => {
    try {
      await LeadAssignmentsAPI.updateRole(leadId, assignment.userId, newRole);
      setAssignments((prev) =>
        prev.map((a) => (a.userId === assignment.userId ? { ...a, role: newRole } : a))
      );
    } catch (err) {
      setError(err.message || "Failed to update role");
    }
  };

  const handleRemove = async (assignment) => {
    try {
      await LeadAssignmentsAPI.remove(leadId, assignment.userId);
      setAssignments((prev) => prev.filter((a) => a.userId !== assignment.userId));
    } catch (err) {
      setError(err.message || "Failed to remove assignment");
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black/60 backdrop-blur-sm">
      <div className="flex flex-col bg-white w-full h-full max-w-lg mx-auto shadow-2xl md:rounded-2xl md:my-8 md:h-auto md:max-h-[90vh]">

        {/* HEADER */}
        <div className="bg-blue-700 text-white px-5 py-4 flex items-center justify-between shrink-0 md:rounded-t-2xl">
          <div>
            <h2 className="text-lg font-bold">Assign Team</h2>
            <p className="text-blue-200 text-sm mt-0.5 truncate">{lead?.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-blue-200 hover:text-white text-2xl leading-none px-2"
          >
            ×
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-3 text-red-800 text-sm rounded">
              {error}
            </div>
          )}

          {/* Current team */}
          <div>
            <div className="text-sm font-semibold text-gray-700 mb-2">
              Assigned Team {assignments.length > 0 && `(${assignments.length})`}
            </div>

            {loading ? (
              <div className="text-sm text-gray-400 text-center py-6">Loading…</div>
            ) : assignments.length === 0 ? (
              <div className="text-sm text-gray-400 text-center py-6 border border-dashed border-gray-200 rounded-xl">
                No one assigned yet
              </div>
            ) : (
              <div className="space-y-2">
                {assignments.map((a) => (
                  <div
                    key={a.userId}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100"
                  >
                    {/* Crew color dot */}
                    {a.crewColor && (
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: a.crewColor }}
                        title={a.crewName || ""}
                      />
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 text-sm truncate">
                        {a.userName}
                      </div>
                      {a.crewName && (
                        <div className="text-xs text-gray-400">{a.crewName}</div>
                      )}
                    </div>

                    {/* Role selector */}
                    <select
                      value={a.role}
                      onChange={(e) => handleChangeRole(a, e.target.value)}
                      className={`text-xs font-semibold rounded-md px-2 py-1 border-0 focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                        ROLE_COLORS[a.role] || ROLE_COLORS.installer
                      }`}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => handleRemove(a)}
                      className="text-gray-300 hover:text-red-500 text-xl leading-none px-1 shrink-0"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ADD SECTION */}
          <div>
            <div className="text-sm font-semibold text-gray-700 mb-2">Add to Team</div>

            {/* Tab switcher */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-3">
              {["crew", "employee"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setAddTab(tab)}
                  className={`flex-1 py-1.5 rounded-md text-sm font-semibold transition ${
                    addTab === tab
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab === "crew" ? "By Crew" : "Individual"}
                </button>
              ))}
            </div>

            {/* Add by crew */}
            {addTab === "crew" && (
              <div className="space-y-3">
                {crews.length === 0 ? (
                  <div className="text-sm text-gray-400 text-center py-3">
                    No crews set up yet. Create crews in the Users section.
                  </div>
                ) : (
                  <>
                    <select
                      value={selectedCrewId}
                      onChange={(e) => setSelectedCrewId(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select a crew…</option>
                      {crews.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({(c.members || []).length} members)
                        </option>
                      ))}
                    </select>

                    {selectedCrewId && (() => {
                      const crew = crews.find((c) => c.id === parseInt(selectedCrewId, 10));
                      const newMembers = (crew?.members || []).filter(
                        (m) => !assignedUserIds.has(m.userId)
                      );
                      const alreadyIn = (crew?.members || []).length - newMembers.length;
                      return (
                        <div className="text-xs text-gray-500 px-1">
                          {newMembers.length} new member{newMembers.length !== 1 ? "s" : ""} will be added
                          {alreadyIn > 0 && ` (${alreadyIn} already assigned)`}
                        </div>
                      );
                    })()}

                    <button
                      onClick={handleAddCrew}
                      disabled={!selectedCrewId || addingCrew}
                      className="w-full py-2.5 bg-blue-700 text-white rounded-lg font-semibold text-sm hover:bg-blue-800 disabled:opacity-50 transition"
                    >
                      {addingCrew ? "Adding crew…" : "Add Crew"}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Add individual employee */}
            {addTab === "employee" && (
              <div className="space-y-3">
                {availableUsers.length === 0 ? (
                  <div className="text-sm text-gray-400 text-center py-3">
                    All active employees are already assigned
                  </div>
                ) : (
                  <>
                    <select
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select employee…</option>
                      {availableUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name || u.email}
                        </option>
                      ))}
                    </select>

                    <select
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={handleAddEmployee}
                      disabled={!selectedUserId || addingEmployee}
                      className="w-full py-2.5 bg-blue-700 text-white rounded-lg font-semibold text-sm hover:bg-blue-800 disabled:opacity-50 transition"
                    >
                      {addingEmployee ? "Adding…" : "Add Employee"}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div className="border-t px-5 py-4 bg-gray-50 shrink-0 md:rounded-b-2xl">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-gray-200 text-gray-700 rounded-lg font-semibold text-sm hover:bg-gray-300 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
