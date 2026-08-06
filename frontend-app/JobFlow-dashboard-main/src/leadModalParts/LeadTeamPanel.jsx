// ============================================================================
// File: src/leadModalParts/LeadTeamPanel.jsx
// Assign employees and/or crews to a job (lead)
// Crew assignments show as a single block — only whole crew can be removed.
// Individual assignments can be removed one-by-one.
// ============================================================================

import React, { useEffect, useState, useMemo } from "react";
import { LeadAssignmentsAPI, CrewsAPI, UsersAPI, apiRequest } from "../api";

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

export default function LeadTeamPanel({ lead, companyId, currentUser, onClose }) {
  const leadId = lead?.id;
  const isJob = lead?.status === "job";
  const canClockIn = currentUser?.role === "admin" || currentUser?.role === "master";

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

  // Clock-in crew state
  const [clockInSelected, setClockInSelected] = useState(new Set());
  const [clockingIn, setClockingIn] = useState(false);
  const [clockInResults, setClockInResults] = useState(null);

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

  // Split assignments into crew groups and individuals
  const { crewGroups, individuals } = useMemo(() => {
    const groups = {};
    const indivs = [];
    for (const a of assignments) {
      if (a.crewId) {
        if (!groups[a.crewId]) {
          groups[a.crewId] = {
            crewId: a.crewId,
            crewName: a.crewName,
            crewColor: a.crewColor,
            members: [],
          };
        }
        groups[a.crewId].members.push(a);
      } else {
        indivs.push(a);
      }
    }
    return { crewGroups: Object.values(groups), individuals: indivs };
  }, [assignments]);

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

  const handleRemoveCrew = async (crewId) => {
    try {
      const res = await LeadAssignmentsAPI.removeCrew(leadId, crewId);
      setAssignments(res.assignments || []);
    } catch (err) {
      setError(err.message || "Failed to remove crew");
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

  const handleRemoveIndividual = async (assignment) => {
    try {
      await LeadAssignmentsAPI.remove(leadId, assignment.userId);
      setAssignments((prev) => prev.filter((a) => a.userId !== assignment.userId));
    } catch (err) {
      setError(err.message || "Failed to remove assignment");
    }
  };

  // All assigned user IDs (from crews and individuals)
  const allAssignedUserIds = useMemo(() => {
    const ids = new Set();
    assignments.forEach((a) => ids.add(a.userId));
    return ids;
  }, [assignments]);

  const allAssignedUsers = useMemo(() => {
    return allUsers.filter((u) => allAssignedUserIds.has(u.id));
  }, [allUsers, allAssignedUserIds]);

  const toggleClockInUser = (userId) => {
    setClockInSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  };

  const toggleClockInAll = () => {
    if (clockInSelected.size === allAssignedUsers.length) {
      setClockInSelected(new Set());
    } else {
      setClockInSelected(new Set(allAssignedUsers.map((u) => u.id)));
    }
  };

  const handleCrewClockIn = async () => {
    if (!clockInSelected.size || clockingIn) return;
    setClockingIn(true);
    setClockInResults(null);
    setError("");
    try {
      const cq = companyId ? `?company_id=${companyId}` : "";
      const data = await apiRequest(`/api/time/crew-clock-in${cq}`, {
        method: "POST",
        body: JSON.stringify({ lead_id: leadId, user_ids: [...clockInSelected] }),
      });
      setClockInResults(data.results || []);
    } catch (err) {
      setError(err.message || "Failed to clock in crew");
    } finally {
      setClockingIn(false);
    }
  };

  const totalCount = crewGroups.length + individuals.length;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black/60 backdrop-blur-sm">
      <div className="flex flex-col bg-white w-full h-full max-w-lg mx-auto shadow-2xl md:rounded-2xl md:my-8 md:h-auto md:max-h-[90vh]">

        {/* HEADER */}
        <div className="bg-blue-700 text-white px-6 py-4 flex items-center justify-between shrink-0 md:rounded-t-2xl">
          <div>
            <h2 className="text-lg font-bold">Assign Crew</h2>
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
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-3 text-red-800 text-sm rounded">
              {error}
            </div>
          )}

          {/* Current team */}
          <div>
            <div className="text-sm font-semibold text-gray-700 mb-2">
              Assigned Team {totalCount > 0 && `(${totalCount})`}
            </div>

            {loading ? (
              <div className="text-sm text-gray-400 text-center py-6">Loading…</div>
            ) : totalCount === 0 ? (
              <div className="text-sm text-gray-400 text-center py-6 border border-dashed border-gray-200 rounded-xl">
                No one assigned yet
              </div>
            ) : (
              <div className="space-y-2">
                {/* Crew blocks — one block per crew, no individual remove buttons */}
                {crewGroups.map((group) => (
                  <div
                    key={`crew-${group.crewId}`}
                    className="p-3 bg-blue-50 rounded-xl border border-blue-100"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: group.crewColor || "#6366f1" }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 text-sm">
                          {group.crewName}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5 truncate">
                          {group.members.map((m) => m.userName).join(", ")}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveCrew(group.crewId)}
                        className="text-xs text-red-400 hover:text-red-600 font-medium shrink-0 px-1"
                      >
                        Remove crew
                      </button>
                    </div>
                  </div>
                ))}

                {/* Individual assignments — with role selector and individual remove button */}
                {individuals.map((a) => (
                  <div
                    key={a.userId}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 text-sm truncate">
                        {a.userName}
                      </div>
                    </div>

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
                      onClick={() => handleRemoveIndividual(a)}
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
                <p className="text-xs text-gray-500">
                  Add individuals when partial crew shows up — first remove the crew, then add the people who showed up.
                </p>
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

        {/* CLOCK IN CREW — only when lead is in "job" status and user is admin/master */}
        {isJob && canClockIn && allAssignedUsers.length > 0 && (
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-1">
              <div className="text-sm font-bold text-gray-700">Clock In Crew</div>
              <span className="text-xs text-gray-400 italic">Tap a crew member to select</span>
            </div>

            {/* Clock All toggle */}
            <label className="flex items-center gap-2 mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={clockInSelected.size === allAssignedUsers.length && allAssignedUsers.length > 0}
                onChange={toggleClockInAll}
                className="w-4 h-4 rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm font-semibold text-gray-700">Clock All In</span>
            </label>

            {/* Individual crew members */}
            <div className="space-y-2">
              {allAssignedUsers.map((u) => {
                const isSelected = clockInSelected.has(u.id);
                const result = clockInResults?.find((r) => r.user_id === u.id);
                return (
                  <button
                    key={u.id}
                    onClick={() => !result && toggleClockInUser(u.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-colors text-left ${
                      result?.status === "clocked_in"
                        ? "border-green-400 bg-green-50 cursor-default"
                        : result?.status === "already_clocked_in"
                        ? "border-gray-200 bg-gray-50 cursor-default opacity-60"
                        : isSelected
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                      result?.status === "clocked_in" ? "border-green-500 bg-green-500"
                      : isSelected ? "border-blue-600 bg-blue-600" : "border-gray-400"
                    }`} />
                    <span className="text-sm font-semibold text-gray-900 flex-1">{u.name || u.email}</span>
                    {result?.status === "clocked_in" && <span className="text-xs text-green-600 font-semibold">Clocked In</span>}
                    {result?.status === "already_clocked_in" && <span className="text-xs text-gray-400">Already In</span>}
                  </button>
                );
              })}
            </div>

            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-3 text-red-800 text-sm rounded mt-2">
                {error}
              </div>
            )}

            <button
              onClick={handleCrewClockIn}
              disabled={!clockInSelected.size || clockingIn}
              className="w-full mt-3 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold rounded-xl transition-colors text-sm"
            >
              {clockingIn ? "Clocking In…" : clockInSelected.size > 0 ? `Clock In ${clockInSelected.size} Member${clockInSelected.size > 1 ? "s" : ""}` : "Select Members to Clock In"}
            </button>
          </div>
        )}

        {/* FOOTER */}
        <div className="border-t px-6 py-4 bg-gray-50 shrink-0 md:rounded-b-2xl">
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
