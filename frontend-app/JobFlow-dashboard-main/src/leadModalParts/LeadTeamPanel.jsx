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

function fmtTime(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

export default function LeadTeamPanel({ lead, companyId, currentUser, onClose }) {
  const leadId = lead?.id;
  const canClockIn = currentUser?.role === "admin" || currentUser?.role === "master";
  const cq = companyId ? `?company_id=${companyId}` : "";

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

  // Clock-in sub-modal state
  const [clockInModal, setClockInModal] = useState(null); // null | crew group object
  const [clockInChecked, setClockInChecked] = useState(new Set());
  const [clockingIn, setClockingIn] = useState(false);
  const [clockInResults, setClockInResults] = useState(null);
  // Active entries: userId → { id, lead_name, clock_in }
  const [activeEntries, setActiveEntries] = useState(new Map());
  const [activeEntriesLoading, setActiveEntriesLoading] = useState(false);
  // Switch job: Set of userIds being switched, Set of userIds already switched
  const [switchingUsers, setSwitchingUsers] = useState(new Set());
  const [switchedUsers, setSwitchedUsers] = useState(new Set());
  // Users explicitly kept on their current job (dismissed from this clock-in)
  const [keptUsers, setKeptUsers] = useState(new Set());
  // Currently clocked-in users for this specific job
  const [activeForLead, setActiveForLead] = useState([]);
  const [clockingOutUser, setClockingOutUser] = useState(null);

  useEffect(() => {
    loadAll();
  }, [leadId, companyId]);

  const loadAll = async () => {
    try {
      setLoading(true);
      const fetches = [
        LeadAssignmentsAPI.getAll(leadId),
        CrewsAPI.getAll(companyId),
        UsersAPI.getAll(companyId),
        canClockIn ? apiRequest(`/api/time/active${cq}`) : Promise.resolve({ active: [] }),
      ];
      const [assignRes, crewRes, userRes, activeRes] = await Promise.all(fetches);
      setAssignments(assignRes.assignments || []);
      setCrews((crewRes.crews || []).filter((c) => c.is_active));
      setAllUsers(
        (userRes.users || []).filter(
          (u) => u.isActive !== false && u.is_active !== false
        )
      );
      setActiveForLead((activeRes.active || []).filter((e) => e.lead_id === leadId));
    } catch (err) {
      setError(err.message || "Failed to load team data");
    } finally {
      setLoading(false);
    }
  };

  const loadActiveForLead = async () => {
    if (!canClockIn) return;
    try {
      const data = await apiRequest(`/api/time/active${cq}`);
      setActiveForLead((data.active || []).filter((e) => e.lead_id === leadId));
    } catch {}
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

  // ── Clock-in sub-modal handlers ──────────────────────────────────────────

  const handleClockInOpen = async (group) => {
    setClockInModal(group);
    setClockInResults(null);
    setError("");
    setActiveEntries(new Map());
    setActiveEntriesLoading(true);

    // Fetch who is currently clocked in across the whole company
    try {
      const data = await apiRequest(`/api/time/active${cq}`);
      const map = new Map();
      (data.active || []).forEach((e) => {
        map.set(e.user_id, { id: e.id, lead_name: e.lead_name, clock_in: e.clock_in });
      });
      setActiveEntries(map);
      // Pre-select only members NOT currently clocked in
      setClockInChecked(
        new Set(group.members.map((m) => m.userId).filter((uid) => !map.has(uid)))
      );
    } catch {
      // Non-fatal: default to all selected
      setClockInChecked(new Set(group.members.map((m) => m.userId)));
    } finally {
      setActiveEntriesLoading(false);
    }
  };

  const handleClockInClose = () => {
    setClockInModal(null);
    setClockInResults(null);
    setActiveEntries(new Map());
    setSwitchedUsers(new Set());
    setKeptUsers(new Set());
    setError("");
    loadActiveForLead();
  };

  const handleClockInToggle = (userId) => {
    setClockInChecked((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleClockInSubmit = async () => {
    if (!clockInChecked.size || clockingIn) return;
    setClockingIn(true);
    setError("");
    try {
      const data = await apiRequest(`/api/time/crew-clock-in${cq}`, {
        method: "POST",
        body: JSON.stringify({ lead_id: leadId, user_ids: [...clockInChecked] }),
      });
      setClockInResults(data.results || []);
    } catch (err) {
      setError(err.message || "Failed to clock in crew");
    } finally {
      setClockingIn(false);
    }
  };

  const handleClockOutIndividual = async (entryId, userId) => {
    setClockingOutUser(userId);
    setError("");
    try {
      await apiRequest(`/api/time/clock-out/${entryId}${cq}`, {
        method: "PUT",
        body: JSON.stringify({}),
      });
      setActiveForLead((prev) => prev.filter((e) => e.id !== entryId));
    } catch (err) {
      setError(err.message || "Failed to clock out");
    } finally {
      setClockingOutUser(null);
    }
  };

  // Atomically clock a user out of their current job and into this job
  const handleSwitchJob = async (userId) => {
    setSwitchingUsers((prev) => new Set([...prev, userId]));
    setError("");
    try {
      await apiRequest(`/api/time/switch-job${cq}`, {
        method: "POST",
        body: JSON.stringify({ user_id: userId, lead_id: leadId }),
      });
      setSwitchedUsers((prev) => new Set([...prev, userId]));
      setActiveEntries((prev) => {
        const next = new Map(prev);
        next.delete(userId);
        return next;
      });
    } catch (err) {
      setError(err.message || "Failed to switch job");
    } finally {
      setSwitchingUsers((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const totalCount = crewGroups.length + individuals.length;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black/60 backdrop-blur-sm">
      <div className="flex flex-col bg-white w-full h-full max-w-lg mx-auto shadow-2xl md:rounded-2xl md:my-8 md:h-auto md:max-h-[90vh]">

        {/* HEADER */}
        <div className="bg-blue-700 text-white px-6 py-4 flex items-center justify-between shrink-0 md:rounded-t-2xl">
          <div>
            <h2 className="text-lg font-bold">Manage Labor</h2>
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

          {/* Currently clocked in for this job */}
          {activeForLead.length > 0 && (
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-2">
                Clocked In Now ({activeForLead.length})
              </div>
              <div className="space-y-2">
                {activeForLead.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-200"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900">{e.user_name}</div>
                      <div className="text-xs text-emerald-700">Since {fmtTime(e.clock_in)}</div>
                    </div>
                    {canClockIn && (
                      <button
                        onClick={() => handleClockOutIndividual(e.id, e.user_id)}
                        disabled={clockingOutUser === e.user_id}
                        className="text-xs font-semibold text-red-600 bg-red-100 hover:bg-red-200 disabled:opacity-50 px-2 py-1 rounded-md transition shrink-0"
                      >
                        {clockingOutUser === e.user_id ? "…" : "Clock Out"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
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
                {/* Crew blocks */}
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
                      <div className="flex items-center gap-2 shrink-0">
                        {canClockIn && (
                          <button
                            onClick={() => handleClockInOpen(group)}
                            className="text-xs font-semibold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-2 py-1 rounded-md transition"
                          >
                            Clock In
                          </button>
                        )}
                        <button
                          onClick={() => handleRemoveCrew(group.crewId)}
                          className="text-xs text-red-400 hover:text-red-600 font-medium px-1"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Individual assignments */}
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

                    {canClockIn && (
                      <button
                        onClick={() =>
                          handleClockInOpen({
                            crewId: null,
                            crewName: a.userName,
                            crewColor: null,
                            members: [{ userId: a.userId, userName: a.userName }],
                          })
                        }
                        className="text-xs font-semibold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-2 py-1 rounded-md transition shrink-0"
                      >
                        Clock In
                      </button>
                    )}
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
        <div className="border-t px-6 py-4 bg-gray-50 shrink-0 md:rounded-b-2xl">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-gray-200 text-gray-700 rounded-lg font-semibold text-sm hover:bg-gray-300 transition"
          >
            Done
          </button>
        </div>
      </div>

      {/* CLOCK IN / OUT SUB-MODAL */}
      {clockInModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">

            <div className="bg-emerald-700 text-white px-5 py-4 flex items-center justify-between">
              <div>
                <div className="font-bold text-base">Clock In / Out</div>
                <div className="text-emerald-200 text-sm mt-0.5">{clockInModal.crewName}</div>
              </div>
              <button
                onClick={handleClockInClose}
                className="text-emerald-200 hover:text-white text-2xl leading-none px-1"
              >
                ×
              </button>
            </div>

            <div className="p-5 space-y-2">
              {activeEntriesLoading ? (
                <div className="text-center py-6 text-gray-400 text-sm">Checking clock-in status…</div>
              ) : (
                clockInModal.members.map((m) => {
                  const active = activeEntries.get(m.userId);
                  const isChecked = clockInChecked.has(m.userId);
                  const result = clockInResults?.find((r) => r.user_id === m.userId);

                  if (switchedUsers.has(m.userId)) {
                    // Already switched to this job
                    return (
                      <div
                        key={m.userId}
                        className="flex items-center gap-3 p-3 rounded-xl border-2 border-emerald-400 bg-emerald-50"
                      >
                        <span className="text-emerald-600 font-bold text-base shrink-0">✓</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-900">{m.userName}</div>
                          <div className="text-xs text-emerald-700">Switched to this job</div>
                        </div>
                      </div>
                    );
                  }

                  if (keptUsers.has(m.userId)) {
                    // Foreman chose to keep them on current job
                    return (
                      <div
                        key={m.userId}
                        className="flex items-center gap-3 p-3 rounded-xl border-2 border-gray-200 bg-gray-50 opacity-60"
                      >
                        <span className="text-gray-400 text-base shrink-0">–</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-600">{m.userName}</div>
                          <div className="text-xs text-gray-400">Staying on: {active?.lead_name || "current job"}</div>
                        </div>
                      </div>
                    );
                  }

                  if (active && !result) {
                    // Already clocked in on a different job — show explicit choice
                    return (
                      <div
                        key={m.userId}
                        className="p-3 rounded-xl border-2 border-amber-300 bg-amber-50 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-semibold text-gray-900 text-sm">{m.userName}</div>
                          <span className="text-xs text-amber-700 font-bold shrink-0">Already Clocked In</span>
                        </div>
                        <div className="text-xs text-amber-900">
                          Currently on: <span className="font-semibold">{active.lead_name || "Non-Job Work"}</span>
                          <span className="text-amber-700"> · since {fmtTime(active.clock_in)}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button
                            onClick={() => setKeptUsers((prev) => new Set([...prev, m.userId]))}
                            disabled={switchingUsers.has(m.userId)}
                            className="py-2 text-xs font-bold text-gray-700 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 rounded-lg transition"
                          >
                            No, Keep Current
                          </button>
                          <button
                            onClick={() => handleSwitchJob(m.userId)}
                            disabled={switchingUsers.has(m.userId)}
                            className="py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-lg transition"
                          >
                            {switchingUsers.has(m.userId) ? "Switching…" : "Yes, Switch Job"}
                          </button>
                        </div>
                      </div>
                    );
                  }

                  // Not clocked in (or just clocked out) — show checkbox
                  return (
                    <label
                      key={m.userId}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition ${
                        result?.status === "clocked_in"
                          ? "border-emerald-400 bg-emerald-50 cursor-default"
                          : result?.status === "already_clocked_in"
                          ? "border-gray-200 bg-gray-50 cursor-default opacity-60"
                          : isChecked
                          ? "border-emerald-500 bg-emerald-50"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={!!isChecked}
                        disabled={!!result}
                        onChange={() => !result && handleClockInToggle(m.userId)}
                        className="w-4 h-4 rounded accent-emerald-600"
                      />
                      <span className="text-sm font-semibold text-gray-900 flex-1">
                        {m.userName}
                      </span>
                      {result?.status === "clocked_in" && (
                        <span className="text-xs text-emerald-600 font-semibold">Clocked In</span>
                      )}
                      {result?.status === "already_clocked_in" && (
                        <span className="text-xs text-gray-400">Already In</span>
                      )}
                    </label>
                  );
                })
              )}
            </div>

            {error && (
              <div className="mx-5 mb-3 bg-red-50 border-l-4 border-red-500 p-3 text-red-800 text-sm rounded">
                {error}
              </div>
            )}

            <div className="px-5 pb-5">
              {clockInChecked.size > 0 && !clockInResults ? (
                <button
                  onClick={handleClockInSubmit}
                  disabled={clockingIn || activeEntriesLoading}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition"
                >
                  {clockingIn
                    ? "Clocking In…"
                    : `Clock In ${clockInChecked.size} Member${clockInChecked.size !== 1 ? "s" : ""}`}
                </button>
              ) : (
                <button
                  onClick={handleClockInClose}
                  className="w-full py-3 bg-gray-200 text-gray-700 hover:bg-gray-300 font-bold rounded-xl text-sm transition"
                >
                  {clockInResults ? "Done" : "Close"}
                </button>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
