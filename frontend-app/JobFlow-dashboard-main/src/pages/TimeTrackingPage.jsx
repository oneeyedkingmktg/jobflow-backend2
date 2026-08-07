// File: src/pages/TimeTrackingPage.jsx
// Employee time tracking — clock in/out per job

import React, { useState, useEffect, useRef, useCallback } from "react";
import { apiRequest, TimeAPI } from "../api";
import { useCompany } from "../CompanyContext";
import { useAuth } from "../AuthContext";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDuration(minutes) {
  if (minutes == null || minutes < 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function fmtTime(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function fmtDate(dateStr) {
  if (!dateStr) return "";
  const d = String(dateStr).slice(0, 10);
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtDay(ts) {
  return new Date(ts).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function liveDuration(clockInTs) {
  const mins = Math.floor((Date.now() - new Date(clockInTs).getTime()) / 60000);
  return fmtDuration(mins);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TimeTrackingPage({ onBack }) {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "master";
  // Appends ?company_id=X when present — needed for master who has no company_id on their JWT
  const cq = currentCompany?.id ? `company_id=${currentCompany.id}` : "";
  const withCq = (url) => cq ? `${url}${url.includes("?") ? "&" : "?"}${cq}` : url;

  const [jobs, setJobs] = useState([]);
  const [serviceCalls, setServiceCalls] = useState([]);
  const [todayEntries, setTodayEntries] = useState([]);
  const [weekData, setWeekData] = useState(null);
  const [selected, setSelected] = useState(null); // { type, leadId, serviceCallId, label }
  const [searchMode, setSearchMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showWeek, setShowWeek] = useState(false);
  const [showActive, setShowActive] = useState(false);
  const [activeRoster, setActiveRoster] = useState([]);
  const [activeLoading, setActiveLoading] = useState(false);
  const [clockingOutId, setClockingOutId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clockLoading, setClockLoading] = useState(false);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [editHours, setEditHours] = useState("");
  const [editMinutes, setEditMinutes] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const searchTimer = useRef(null);

  const activeEntry = todayEntries.find((e) => !e.clock_out) || null;

  // ── Data loading ─────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [jobsRes, todayRes] = await Promise.all([
          apiRequest(withCq("/api/time/jobs")),
          apiRequest(withCq("/api/time/today")),
        ]);
        setJobs(jobsRes.jobs || []);
        setServiceCalls(jobsRes.serviceCalls || []);
        setTodayEntries(todayRes.entries || []);
      } catch {
        setError("Failed to load time tracking data");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Live elapsed clock — ticks every 30s while clocked in
  useEffect(() => {
    if (!activeEntry) return;
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, [activeEntry?.id]);

  // ── Search ────────────────────────────────────────────────────────────────

  const handleSearch = useCallback((term) => {
    setSearchTerm(term);
    clearTimeout(searchTimer.current);
    if (!term.trim()) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      try {
        const data = await apiRequest(withCq(`/api/time/jobs?search=${encodeURIComponent(term.trim())}`));
        setSearchResults(data.jobs || []);
      } catch {}
    }, 350);
  }, []);

  // ── Clock actions ─────────────────────────────────────────────────────────

  const handleClockIn = async () => {
    if (!selected || clockLoading) return;
    setClockLoading(true);
    setError("");
    try {
      const body = {
        work_type: selected.type,
        ...(selected.leadId ? { lead_id: selected.leadId } : {}),
        ...(selected.serviceCallId ? { service_call_id: selected.serviceCallId } : {}),
      };
      const data = await apiRequest(withCq("/api/time/clock-in"), {
        method: "POST",
        body: JSON.stringify(body),
      });
      const entry = { ...data.entry, lead_name: selected.label };
      setTodayEntries((prev) => [...prev, entry]);
      setSelected(null);
    } catch (err) {
      setError(err.message || "Failed to clock in");
    } finally {
      setClockLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!activeEntry || clockLoading) return;
    setClockLoading(true);
    setError("");
    try {
      const data = await apiRequest(withCq(`/api/time/clock-out/${activeEntry.id}`), {
        method: "PUT",
        body: JSON.stringify({}),
      });
      setTodayEntries((prev) =>
        prev.map((e) => (e.id === activeEntry.id ? { ...e, ...data.entry } : e))
      );
    } catch (err) {
      setError(err.message || "Failed to clock out");
    } finally {
      setClockLoading(false);
    }
  };

  const loadWeek = async () => {
    try {
      const data = await apiRequest(withCq("/api/time/week"));
      setWeekData(data);
      setShowWeek(true);
    } catch {}
  };

  const loadActiveRoster = async () => {
    setActiveLoading(true);
    try {
      const data = await apiRequest(withCq("/api/time/active"));
      setActiveRoster(data.active || []);
    } catch {
      setActiveRoster([]);
    } finally {
      setActiveLoading(false);
    }
  };

  const handleAdminClockOut = async (entryId) => {
    if (clockingOutId) return;
    setClockingOutId(entryId);
    try {
      await apiRequest(withCq(`/api/time/clock-out/${entryId}`), {
        method: "PUT",
        body: JSON.stringify({}),
      });
      setActiveRoster((prev) => prev.filter((e) => e.id !== entryId));
    } catch {}
    finally {
      setClockingOutId(null);
    }
  };

  // ── Entry edit ───────────────────────────────────────────────────────────

  const startEditEntry = (e) => {
    const totalMin = e.duration_minutes || 0;
    setEditingEntryId(e.id);
    setEditHours(String(Math.floor(totalMin / 60)));
    setEditMinutes(String(totalMin % 60));
  };

  const handleSaveEdit = async (entryId) => {
    const h = parseInt(editHours, 10) || 0;
    const m = parseInt(editMinutes, 10) || 0;
    if (h + m === 0) { setError("Duration must be greater than 0."); return; }
    setSavingEdit(true);
    try {
      const res = await TimeAPI.updateEntry(entryId, { hours: h, minutes: m });
      setTodayEntries((prev) =>
        prev.map((e) => (e.id === entryId ? { ...e, duration_minutes: res.entry.duration_minutes } : e))
      );
      setEditingEntryId(null);
    } catch (err) {
      setError(err.message || "Failed to save entry");
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Selection helpers ─────────────────────────────────────────────────────

  const pick = (type, leadId, label, serviceCallId = null) => {
    setSelected({ type, leadId, label, serviceCallId });
    setSearchMode(false);
    setSearchTerm("");
    setSearchResults([]);
  };

  const isSelected = (type, scId, leadId) => {
    if (!selected) return false;
    if (type === "non_job") return selected.type === "non_job";
    if (type === "service_call") return selected.type === "service_call" && selected.serviceCallId === scId;
    return selected.type === "job" && selected.leadId === leadId;
  };

  // ── Render helpers ────────────────────────────────────────────────────────

  const JobRow = ({ label, sub, onSelect, active }) => (
    <button
      onClick={onSelect}
      className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-colors ${
        active
          ? "border-blue-600 bg-blue-50"
          : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      <span
        className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
          active ? "border-blue-600 bg-blue-600" : "border-gray-400 bg-white"
        }`}
      />
      <div className="min-w-0">
        <div className={`text-sm font-semibold truncate ${active ? "text-blue-700" : "text-gray-900"}`}>
          {label}
        </div>
        {sub && <div className="text-xs text-gray-500 truncate">{sub}</div>}
      </div>
    </button>
  );

  const SectionLabel = ({ children }) => (
    <div className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1 pt-4 pb-1">
      {children}
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col md:items-center md:justify-center md:bg-black/50 md:p-6">
        <div className="flex-1 md:flex-none bg-gray-50 flex items-center justify-center md:max-w-2xl md:w-full md:max-h-[90vh] md:rounded-2xl md:shadow-2xl">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col md:items-center md:justify-center md:bg-black/50 md:p-6">
      <div className="flex-1 md:flex-none bg-gray-50 flex flex-col overflow-hidden md:max-w-2xl md:w-full md:max-h-[90vh] md:rounded-2xl md:shadow-2xl">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-700 p-1">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-gray-900">Time Tracking</h1>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <button
              onClick={() => { setShowActive(true); loadActiveRoster(); }}
              className="text-sm font-semibold text-emerald-600 hover:text-emerald-700"
            >
              Team
            </button>
          )}
          <button
            onClick={loadWeek}
            className="text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            This Week
          </button>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 pb-28">

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded-lg text-red-800 text-sm">
            {error}
          </div>
        )}

        {/* ── CLOCKED IN STATE ──────────────────────────────────────── */}
        {activeEntry && (
          <div className="bg-green-50 border-2 border-green-500 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-bold text-green-700 uppercase tracking-wide">Clocked In</span>
            </div>
            <div className="text-gray-900 font-bold text-base leading-tight">
              {activeEntry.lead_name ||
                (activeEntry.work_type === "non_job" ? "Non-Job Work" : "Job")}
            </div>
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Started {fmtTime(activeEntry.clock_in)}</span>
              <span className="font-mono font-bold text-green-700">
                {liveDuration(activeEntry.clock_in)}
              </span>
            </div>
            <button
              onClick={handleClockOut}
              disabled={clockLoading}
              className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-xl transition-colors"
            >
              {clockLoading ? "Clocking Out…" : "Clock Out"}
            </button>
          </div>
        )}

        {/* ── JOB SELECTOR (only shown when not clocked in) ─────────── */}
        {!activeEntry && (
          <div className="space-y-1">
            <div className="text-sm font-bold text-gray-700 mb-2">Select a Job to Clock In</div>

            {/* Search mode */}
            {searchMode ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={searchTerm}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="Search by name or address…"
                    className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={() => { setSearchMode(false); setSearchTerm(""); setSearchResults([]); }}
                    className="text-sm text-gray-500 px-2 py-3"
                  >
                    Cancel
                  </button>
                </div>
                {searchResults.map((j) => (
                  <JobRow
                    key={j.id}
                    label={j.name}
                    sub={[j.address, j.city].filter(Boolean).join(", ")}
                    active={isSelected("job", null, j.id)}
                    onSelect={() => pick("job", j.id, j.name)}
                  />
                ))}
                {searchTerm && searchResults.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">No jobs found</p>
                )}
              </div>
            ) : (
              <>
                {/* Jobs on Schedule */}
                {jobs.length > 0 && (
                  <>
                    <SectionLabel>Jobs on Your Schedule</SectionLabel>
                    {jobs.map((j) => {
                      const datePart = j.install_date ? `Install ${fmtDate(j.install_date)}` : "";
                      return (
                        <JobRow
                          key={j.id}
                          label={j.name}
                          sub={[datePart, j.city].filter(Boolean).join(" · ")}
                          active={isSelected("job", null, j.id)}
                          onSelect={() => pick("job", j.id, j.name)}
                        />
                      );
                    })}
                  </>
                )}

                {/* Service Calls */}
                {serviceCalls.length > 0 && (
                  <>
                    <SectionLabel>Service Calls</SectionLabel>
                    {serviceCalls.map((sc) => (
                      <JobRow
                        key={sc.id}
                        label={sc.lead_name || sc.title || "Service Call"}
                        sub={[`SC ${fmtDate(sc.scheduled_date)}`, sc.city].filter(Boolean).join(" · ")}
                        active={isSelected("service_call", sc.id, null)}
                        onSelect={() => pick("service_call", sc.lead_id, sc.lead_name || "Service Call", sc.id)}
                      />
                    ))}
                  </>
                )}

                {/* Non-Job Work */}
                <SectionLabel>Non-Job Work</SectionLabel>
                <JobRow
                  label="Non-Job Work"
                  sub="Shop, equipment, training, drive time, etc."
                  active={isSelected("non_job", null, null)}
                  onSelect={() => pick("non_job", null, "Non-Job Work")}
                />

                {/* Search All link */}
                <button
                  onClick={() => setSearchMode(true)}
                  className="w-full text-center text-sm text-blue-600 font-semibold py-3 hover:underline"
                >
                  Search All Jobs
                </button>
              </>
            )}

            {/* Clock In button */}
            <button
              onClick={handleClockIn}
              disabled={!selected || clockLoading}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold rounded-xl transition-colors text-base mt-2"
            >
              {clockLoading ? "Clocking In…" : selected ? `Clock In — ${selected.label}` : "Select a Job to Clock In"}
            </button>
          </div>
        )}

        {/* ── TODAY'S LOG ───────────────────────────────────────────── */}
        {todayEntries.length > 0 && (
          <div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1 pt-4 pb-2">
              Today's Log
            </div>
            <div className="space-y-2">
              {todayEntries.map((e) => (
                <div
                  key={e.id}
                  className="bg-white border border-gray-200 rounded-xl px-4 py-3"
                >
                  {editingEntryId === e.id ? (
                    <div className="space-y-2">
                      <div className="text-sm font-semibold text-gray-900 truncate">
                        {e.lead_name || (e.work_type === "non_job" ? "Non-Job Work" : "Job")}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            value={editHours}
                            onChange={(ev) => setEditHours(ev.target.value)}
                            className="w-16 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-center"
                            placeholder="0"
                          />
                          <span className="text-xs text-gray-500">hrs</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            max="59"
                            value={editMinutes}
                            onChange={(ev) => setEditMinutes(ev.target.value)}
                            className="w-16 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-center"
                            placeholder="0"
                          />
                          <span className="text-xs text-gray-500">min</span>
                        </div>
                        <button
                          onClick={() => handleSaveEdit(e.id)}
                          disabled={savingEdit}
                          className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50"
                        >
                          {savingEdit ? "…" : "Save"}
                        </button>
                        <button
                          onClick={() => setEditingEntryId(null)}
                          className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 mr-3">
                        <div className="text-sm font-semibold text-gray-900 truncate">
                          {e.lead_name || (e.work_type === "non_job" ? "Non-Job Work" : "Job")}
                        </div>
                        <div className="text-xs text-gray-500">
                          {fmtTime(e.clock_in)} → {e.clock_out ? fmtTime(e.clock_out) : "In progress…"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {e.clock_out ? (
                          <>
                            <span className="text-sm font-bold text-gray-700">{fmtDuration(e.duration_minutes)}</span>
                            <button
                              onClick={() => startEditEntry(e)}
                              className="text-xs text-blue-500 hover:text-blue-700 font-medium"
                            >
                              Edit
                            </button>
                          </>
                        ) : (
                          <span className="text-sm font-bold text-green-600">{liveDuration(e.clock_in)}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {todayEntries.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-400 text-sm">
            No entries today yet
          </div>
        )}
      </div>

      {/* ── Active Roster Modal (admin/master) ───────────────────────── */}
      {showActive && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 md:p-6">
          <div className="w-full bg-white rounded-2xl max-h-[85vh] md:max-w-lg flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Who's Clocked In</h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={loadActiveRoster}
                  disabled={activeLoading}
                  className="text-sm text-blue-600 font-semibold disabled:opacity-40"
                >
                  {activeLoading ? "Refreshing…" : "Refresh"}
                </button>
                <button onClick={() => setShowActive(false)} className="text-gray-500 hover:text-gray-700">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-3">
              {activeLoading && activeRoster.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">Loading…</div>
              ) : activeRoster.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">Nobody is clocked in right now</div>
              ) : (
                activeRoster.map((e) => {
                  const elapsedMins = Math.floor((Date.now() - new Date(e.clock_in).getTime()) / 60000);
                  return (
                    <div
                      key={e.id}
                      className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200"
                    >
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 text-sm">{e.user_name}</div>
                        <div className="text-xs text-gray-500 truncate">
                          {e.lead_name || "Non-Job Work"} · since {fmtTime(e.clock_in)}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold text-emerald-700 font-mono">
                          {fmtDuration(elapsedMins)}
                        </div>
                        <button
                          onClick={() => handleAdminClockOut(e.id)}
                          disabled={clockingOutId === e.id}
                          className="text-xs text-red-500 hover:text-red-700 font-semibold mt-0.5 disabled:opacity-40"
                        >
                          {clockingOutId === e.id ? "…" : "Clock Out"}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="px-6 py-3 border-t border-gray-100 text-xs text-gray-400 text-center">
              {activeRoster.length > 0 && `${activeRoster.length} employee${activeRoster.length !== 1 ? "s" : ""} currently clocked in`}
            </div>
          </div>
        </div>
      )}

      {/* ── Week Modal ────────────────────────────────────────────────── */}
      {showWeek && weekData && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 md:p-6">
          <div className="w-full bg-white rounded-2xl max-h-[80vh] md:max-w-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">This Week</h2>
              <button onClick={() => setShowWeek(false)} className="text-gray-500 hover:text-gray-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-3 space-y-2">
              {weekData.entries.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">No entries this week</p>
              ) : (
                <>
                  {weekData.entries.map((e) => (
                    <div key={e.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <div className="min-w-0 mr-3">
                        <div className="text-sm font-semibold text-gray-900 truncate">
                          {e.lead_name || (e.work_type === "non_job" ? "Non-Job Work" : "Job")}
                        </div>
                        <div className="text-xs text-gray-500">{fmtDay(e.clock_in)}</div>
                      </div>
                      <div className="text-sm font-bold text-gray-700 flex-shrink-0">
                        {fmtDuration(e.duration_minutes)}
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between py-3 border-t-2 border-gray-200 mt-1">
                    <span className="text-sm font-bold text-gray-900">Total This Week</span>
                    <span className="text-base font-bold text-blue-700">
                      {fmtDuration(weekData.total_minutes)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
