// File: src/ServiceCallsModal.jsx
// Service Calls — list and edit modal with inline calendar, start+end time, title and notes

import React, { useState, useEffect, useMemo } from "react";
import { apiRequest, LeadsAPI } from "./api";
import { useCompany } from "./CompanyContext";

function formatDateKey(date) {
  return date.toISOString().split("T")[0];
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return "No date set";
  const d = new Date(dateStr.split("T")[0] + "T00:00:00");
  if (isNaN(d.getTime())) return "No date set";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatTimeDisplay(timeStr) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":");
  let hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${m} ${ampm}`;
}

function parseTime(t) {
  if (!t) return { hour: "8", minute: "00", ampm: "AM" };
  const [h, m] = t.split(":").map((v) => parseInt(v, 10));
  const ampm = h >= 12 ? "PM" : "AM";
  let hour12 = h % 12;
  if (hour12 === 0) hour12 = 12;
  return { hour: String(hour12), minute: (m || 0).toString().padStart(2, "0"), ampm };
}

function to24Hour(hour, minute, ampm) {
  let h = parseInt(hour, 10);
  if (ampm === "PM" && h < 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return `${h.toString().padStart(2, "0")}:${minute}`;
}

function shiftDate(dateStr, days) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function TimeSelects({ label, hour, minute, ampm, onHour, onMinute, onAmpm }) {
  return (
    <div>
      <label className="text-xs text-gray-500 mb-1 block font-medium">{label}</label>
      <div className="grid grid-cols-3 gap-2">
        <select
          value={hour}
          onChange={(e) => onHour(e.target.value)}
          className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-blue-400"
        >
          {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((h) => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>
        <select
          value={minute}
          onChange={(e) => onMinute(e.target.value)}
          className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-blue-400"
        >
          {["00", "15", "30", "45"].map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select
          value={ampm}
          onChange={(e) => onAmpm(e.target.value)}
          className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-blue-400"
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </div>
  );
}

export default function ServiceCallsModal({ leadId, initialScId, canEdit = true, onClose, onCountChange, onServiceCallsChange }) {
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id;

  const [serviceCalls, setServiceCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("list"); // "list" | "edit"
  const [editing, setEditing] = useState(null);

  // Edit form state
  const [title, setTitle] = useState("");
  const [scType, setScType] = useState("");
  const [date, setDate] = useState(null);
  const [startHour, setStartHour] = useState("8");
  const [startMinute, setStartMinute] = useState("00");
  const [startAmpm, setStartAmpm] = useState("AM");
  const [endHour, setEndHour] = useState("9");
  const [endMinute, setEndMinute] = useState("00");
  const [endAmpm, setEndAmpm] = useState("AM");
  const [notes, setNotes] = useState("");

  // Calendar state
  const today = new Date();
  const [calExpanded, setCalExpanded] = useState(true); // true = calendar+times visible
  const [calViewMode, setCalViewMode] = useState("calendar"); // "calendar" | "day"
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [dayDate, setDayDate] = useState(null);
  const [dots, setDots] = useState([]);
  const [scDots, setScDots] = useState([]);
  const [dotsLoading, setDotsLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Landscape detection
  const [isLandscape, setIsLandscape] = useState(
    () => typeof window !== "undefined" && window.innerWidth > window.innerHeight
  );
  useEffect(() => {
    const handler = () => setIsLandscape(window.innerWidth > window.innerHeight);
    window.addEventListener("resize", handler);
    window.addEventListener("orientationchange", handler);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("orientationchange", handler);
    };
  }, []);

  useEffect(() => {
    loadServiceCalls(initialScId);
  }, [leadId]);

  // Load calendar dots when entering edit view
  useEffect(() => {
    if (view !== "edit" || !companyId) return;
    setDotsLoading(true);
    Promise.all([
      LeadsAPI.getCalendarDots(companyId),
      LeadsAPI.getServiceCallsCalendar(companyId),
    ])
      .then(([leadsRes, scRes]) => {
        setDots(leadsRes.dots || []);
        setScDots(scRes.serviceCalls || []);
      })
      .catch((err) => console.error("[SC Modal] Failed to load calendar data:", err))
      .finally(() => setDotsLoading(false));
  }, [view, companyId]);

  const loadServiceCalls = async (jumpToScId) => {
    setLoading(true);
    try {
      const data = await apiRequest(`/leads/${leadId}/service-calls`);
      const calls = data.serviceCalls || [];
      setServiceCalls(calls);
      if (onCountChange) onCountChange(calls.length);
      if (jumpToScId) {
        const target = calls.find((sc) => sc.id === jumpToScId);
        if (target) openEdit(target);
      }
    } catch (err) {
      console.error("Failed to load service calls:", err);
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    setEditing(null);
    setTitle("");
    setScType("");
    setDate(null);
    setStartHour("8"); setStartMinute("00"); setStartAmpm("AM");
    setEndHour("9"); setEndMinute("00"); setEndAmpm("AM");
    setNotes("");
    setDirty(false);
    setSaveError("");
    setCalExpanded(true); // always open calendar for new SC
    setCalViewMode("calendar");
    setDayDate(null);
    setView("edit");
  };

  const openEdit = (sc) => {
    setEditing(sc);
    setTitle(sc.title || "");
    setScType(sc.sc_type || "");
    setDate(sc.scheduled_date ? sc.scheduled_date.split("T")[0] : null);
    const parsedStart = parseTime(sc.scheduled_time);
    setStartHour(parsedStart.hour); setStartMinute(parsedStart.minute); setStartAmpm(parsedStart.ampm);
    const parsedEnd = parseTime(sc.scheduled_end_time);
    setEndHour(parsedEnd.hour); setEndMinute(parsedEnd.minute); setEndAmpm(parsedEnd.ampm);
    setNotes(sc.notes || "");
    setDirty(false);
    setSaveError("");
    // Collapse calendar if date already set; expand if no date
    setCalExpanded(!sc.scheduled_date);
    setCalViewMode("calendar");
    setDayDate(null);
    setView("edit");
  };

  const handleSave = async () => {
    // Validate required fields
    if (!title.trim()) { setSaveError("Title is required."); return; }
    if (!scType) { setSaveError("Service Call Type is required."); return; }
    setSaveError("");
    setSaving(true);
    try {
      const payload = {
        scheduled_date: date || null,
        scheduled_end_date: null,
        scheduled_time: to24Hour(startHour, startMinute, startAmpm),
        scheduled_end_time: to24Hour(endHour, endMinute, endAmpm),
        sc_type: scType,
        title: title.trim(),
        notes: notes || null,
      };
      if (editing) {
        await apiRequest(`/leads/${leadId}/service-calls/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest(`/leads/${leadId}/service-calls`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      await loadServiceCalls(null);
      setView("list");
      onServiceCallsChange?.();
      window.dispatchEvent(new CustomEvent('serviceCallsChanged'));
    } catch (err) {
      console.error("Failed to save service call:", err);
      alert("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!editing) return;
    setDeleting(true);
    setConfirmDelete(false);
    try {
      await apiRequest(`/leads/${leadId}/service-calls/${editing.id}`, { method: "DELETE" });
      await loadServiceCalls(null);
      setView("list");
      onServiceCallsChange?.();
      window.dispatchEvent(new CustomEvent('serviceCallsChanged'));
    } catch (err) {
      console.error("Failed to delete service call:", err);
      alert("Failed to delete. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const handleExitEdit = () => {
    if (dirty) setConfirmExit(true);
    else setView("list");
  };

  // ── Calendar helpers ──────────────────────────────────────────────────────

  const getDaysInMonth = (year, month) => {
    const d = new Date(year, month, 1);
    const days = [];
    while (d.getMonth() === month) { days.push(new Date(d)); d.setDate(d.getDate() + 1); }
    return days;
  };

  const monthDays = useMemo(() => getDaysInMonth(calYear, calMonth), [calYear, calMonth]);

  const weeks = useMemo(() => {
    const result = [];
    let week = Array(monthDays[0].getDay()).fill(null);
    monthDays.forEach((day) => {
      week.push(day);
      if (week.length === 7) { result.push([...week]); week = []; }
    });
    if (week.length > 0) { while (week.length < 7) week.push(null); result.push(week); }
    return result;
  }, [monthDays]);

  const getMonthName = () =>
    new Date(calYear, calMonth, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const goToPrevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); }
    else setCalMonth(calMonth - 1);
  };

  const goToNextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); }
    else setCalMonth(calMonth + 1);
  };

  // Build per-day event map — use .split("T")[0] on all dates for safety
  const groupedByDate = useMemo(() => {
    const map = {};
    dots.forEach((lead) => {
      if (lead.appointment_date) {
        const key = lead.appointment_date.split("T")[0];
        if (!map[key]) map[key] = { appt: [], install: [], sc: [] };
        map[key].appt.push(lead);
      }
      if (lead.install_date) {
        const installStart = lead.install_date.split("T")[0];
        const installEnd = lead.install_end_date
          ? lead.install_end_date.split("T")[0]
          : installStart;
        const start = new Date(installStart + "T12:00:00");
        const end = new Date(installEnd + "T12:00:00");
        const duration = Math.max(1, Math.round((end - start) / 86400000) + 1);
        for (let d = 0; d < duration; d++) {
          const dt = new Date(installStart + "T12:00:00");
          dt.setDate(dt.getDate() + d);
          const key = dt.toISOString().split("T")[0];
          if (!map[key]) map[key] = { appt: [], install: [], sc: [] };
          map[key].install.push(lead);
        }
      }
    });
    scDots.forEach((sc) => {
      if (!sc.scheduled_date) return;
      const key = sc.scheduled_date.split("T")[0];
      if (!map[key]) map[key] = { appt: [], install: [], sc: [] };
      map[key].sc.push(sc);
    });
    return map;
  }, [dots, scDots]);

  // Click a calendar cell → select date, go to day view
  const handleCalendarDayClick = (key) => {
    setDate(key);
    setDirty(true);
    setDayDate(key);
    setCalViewMode("day");
  };

  // Called from day view prev/next — updates selected date too
  const handleDayNav = (key) => {
    setDayDate(key);
    setDate(key);
    setDirty(true);
  };

  // "Set Date" from day view — collapses calendar
  const handleConfirmDate = () => {
    setCalExpanded(false);
  };

  const dayAppts = dayDate ? (groupedByDate[dayDate]?.appt || []) : [];
  const dayInstalls = dayDate ? (groupedByDate[dayDate]?.install || []) : [];
  const dayScs = dayDate ? (groupedByDate[dayDate]?.sc || []) : [];

  // Pill label
  const pillLabel = date
    ? `${formatDateDisplay(date)}  ·  ${formatTimeDisplay(to24Hour(startHour, startMinute, startAmpm))} – ${formatTimeDisplay(to24Hour(endHour, endMinute, endAmpm))}`
    : null;

  // ── Calendar block ────────────────────────────────────────────────────────

  const calendarBlock = (
    <>
      <div className="flex items-center justify-between mb-1.5 bg-gray-50 rounded border border-gray-200 px-2 py-1">
        <button onClick={goToPrevMonth} className="p-1 hover:bg-gray-200 rounded text-gray-600" aria-label="Previous month">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-xs font-medium text-gray-700">{getMonthName()}</span>
        <button onClick={goToNextMonth} className="p-1 hover:bg-gray-200 rounded text-gray-600" aria-label="Next month">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 text-center text-xs font-semibold text-gray-500 mb-1">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => <div key={d}>{d}</div>)}
      </div>

      {dotsLoading && <p className="text-xs text-gray-400 italic text-center mb-1">Loading schedule...</p>}

      <div className="text-xs">
        {weeks.map((week, wIdx) => (
          <div key={wIdx} className="mb-0.5">
            <div className="grid grid-cols-7 gap-x-1">
              {week.map((day, dIdx) => {
                if (!day) return <div key={`e-${wIdx}-${dIdx}`} className="min-h-[44px]" />;
                const key = formatDateKey(day);
                const dayData = groupedByDate[key] || { appt: [], install: [], sc: [] };
                const isToday = key === formatDateKey(today);
                const isSelected = key === date;
                return (
                  <div
                    key={key}
                    onClick={() => handleCalendarDayClick(key)}
                    className={`rounded cursor-pointer py-1 px-0.5 flex flex-col items-start min-h-[44px] w-full transition-colors
                      ${isSelected ? "bg-blue-600 text-white" : isToday ? "bg-blue-100 text-blue-800" : "hover:bg-gray-100 text-gray-800"}`}
                  >
                    <span className="font-medium leading-none w-full text-center">{day.getDate()}</span>
                    {dayData.appt.map((lead, i) => (
                      <div key={`a-${i}`} className="w-full h-4 bg-blue-500 rounded-sm flex items-center px-0.5 overflow-hidden mt-0.5">
                        <span className="text-white text-xs font-semibold truncate leading-none">{lead.name}</span>
                      </div>
                    ))}
                    {dayData.install.map((lead, i) => (
                      <div key={`i-${i}`} className="w-full h-4 bg-green-500 rounded-sm flex items-center px-0.5 overflow-hidden mt-0.5">
                        <span className="text-white text-xs font-semibold truncate leading-none">{lead.name}</span>
                      </div>
                    ))}
                    {dayData.sc.map((sc, i) => (
                      <div key={`sc-${i}`} className="w-full h-4 bg-orange-400 rounded-sm flex items-center px-0.5 overflow-hidden mt-0.5">
                        <span className="text-white text-xs font-semibold truncate leading-none">{sc.lead_name}{sc.title ? ` · ${sc.title}` : ""}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex gap-3 mt-1 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-2.5 rounded-sm bg-blue-500 inline-block" />Appt</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2.5 rounded-sm bg-green-500 inline-block" />Install</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2.5 rounded-sm bg-orange-400 inline-block" />Service Call</span>
      </div>
    </>
  );

  // ── Day view block ────────────────────────────────────────────────────────

  const dayViewBlock = (
    <div>
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setCalViewMode("calendar")}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Calendar
        </button>
        <span className="text-xs font-semibold text-gray-700 flex-1 text-center px-1">
          {dayDate ? new Date(dayDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : ""}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleDayNav(shiftDate(dayDate, -1))}
            className="p-1 hover:bg-gray-200 rounded text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => handleDayNav(shiftDate(dayDate, 1))}
            className="p-1 hover:bg-gray-200 rounded text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Events for this day */}
      <div className="border rounded-lg bg-white p-2 mb-3 min-h-[50px] max-h-[110px] overflow-y-auto space-y-1">
        {dotsLoading ? (
          <p className="text-xs text-gray-400 italic text-center mt-1">Loading...</p>
        ) : (dayAppts.length + dayInstalls.length + dayScs.length === 0) ? (
          <p className="text-xs text-gray-400 italic text-center mt-1">Nothing scheduled this day</p>
        ) : (
          <>
            {dayAppts.map((l, i) => (
              <div key={`a-${i}`} className="flex items-center gap-2 text-xs text-gray-700">
                <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                <span className="font-medium w-14 flex-shrink-0">{l.appointment_time ? formatTimeDisplay(l.appointment_time) : "—"}</span>
                <span className="truncate">{l.name}</span>
                <span className="text-gray-400 flex-shrink-0 text-xs">Appt</span>
              </div>
            ))}
            {dayInstalls.map((l, i) => (
              <div key={`i-${i}`} className="flex items-center gap-2 text-xs text-gray-700">
                <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                <span className="font-medium w-14 flex-shrink-0">Install</span>
                <span className="truncate">{l.name}</span>
              </div>
            ))}
            {dayScs.map((sc, i) => (
              <div key={`sc-${i}`} className="flex items-center gap-2 text-xs text-gray-700">
                <span className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0" />
                <span className="font-medium w-14 flex-shrink-0">{sc.scheduled_time ? formatTimeDisplay(sc.scheduled_time) : "SC"}</span>
                <span className="truncate">{sc.lead_name}</span>
                {sc.title && <span className="text-gray-400 flex-shrink-0 truncate text-xs">· {sc.title}</span>}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Time pickers — set times before confirming */}
      <div className="space-y-3 border-t border-gray-200 pt-3 mt-1">
        <TimeSelects
          label="Start Time"
          hour={startHour} minute={startMinute} ampm={startAmpm}
          onHour={(v) => { setStartHour(v); setDirty(true); }}
          onMinute={(v) => { setStartMinute(v); setDirty(true); }}
          onAmpm={(v) => { setStartAmpm(v); setDirty(true); }}
        />
        <TimeSelects
          label="End Time"
          hour={endHour} minute={endMinute} ampm={endAmpm}
          onHour={(v) => { setEndHour(v); setDirty(true); }}
          onMinute={(v) => { setEndMinute(v); setDirty(true); }}
          onAmpm={(v) => { setEndAmpm(v); setDirty(true); }}
        />
      </div>

      {/* Confirm button — shows date + start time */}
      <button
        onClick={handleConfirmDate}
        className="w-full mt-3 bg-blue-600 text-white rounded-xl py-2 text-sm font-semibold hover:bg-blue-700 transition"
      >
        {dayDate
          ? `Set ${new Date(dayDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${formatTimeDisplay(to24Hour(startHour, startMinute, startAmpm))}`
          : "Set Date"}
      </button>
    </div>
  );

  // ── LIST VIEW ─────────────────────────────────────────────────────────────

  if (view === "list") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl p-5 max-h-[85vh] flex flex-col mx-4">

          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Service Calls</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none w-8 h-8 flex items-center justify-center"
            >
              ×
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3">
            {loading ? (
              <div className="text-sm text-gray-500 py-6 text-center">Loading...</div>
            ) : serviceCalls.length === 0 ? (
              <p className="text-sm text-gray-400 italic text-center py-6">No service calls yet</p>
            ) : (
              serviceCalls.map((sc) => (
                <div
                  key={sc.id}
                  onClick={() => openEdit(sc)}
                  className="bg-gray-50 rounded-xl p-4 border border-gray-200 cursor-pointer hover:border-blue-400 transition"
                >
                  <div className="font-semibold text-gray-900 text-sm">
                    {sc.title || "Untitled"}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {formatDateDisplay(sc.scheduled_date)}
                    {sc.scheduled_time && ` · ${formatTimeDisplay(sc.scheduled_time)}`}
                    {sc.scheduled_end_time && ` – ${formatTimeDisplay(sc.scheduled_end_time)}`}
                  </div>
                  {sc.sc_type && (
                    <div className="mt-1">
                      <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${sc.sc_type === "follow_up_install" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                        {sc.sc_type === "follow_up_install" ? "Follow Up Install" : "Service Call"}
                      </span>
                    </div>
                  )}
                  {sc.notes && (
                    <div className="text-xs text-gray-500 mt-1 line-clamp-2">{sc.notes}</div>
                  )}
                </div>
              ))
            )}
          </div>

          {canEdit && (
            <button
              onClick={openNew}
              className="mt-4 w-full bg-blue-600 text-white rounded-xl py-3 font-semibold text-sm hover:bg-blue-700 transition"
            >
              + Add Service Call
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── READ-ONLY DETAIL VIEW (view permission) ──────────────────────────────

  if (view === "edit" && !canEdit) {
    const typeLabel = scType === "follow_up_install" ? "Follow Up Install"
      : scType === "service_call" ? "All Other Service Calls"
      : "—";
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl mx-4" onClick={(e) => e.stopPropagation()}>
          <div className="p-5">
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => setView("list")}
                className="text-blue-600 hover:text-blue-800 font-medium text-sm flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              <h2 className="text-base font-bold text-gray-900 flex-1 text-center pr-8">Service Call</h2>
            </div>

            {/* Date / time pill */}
            {pillLabel ? (
              <div className="text-center mb-4">
                <span className="inline-block bg-orange-50 border border-orange-300 text-orange-800 text-sm font-semibold px-5 py-2 rounded-full">
                  {pillLabel}
                </span>
              </div>
            ) : (
              <p className="text-center text-xs text-gray-400 mb-4">No date set</p>
            )}

            {/* Title */}
            <div className="mb-3">
              <div className="text-xs text-gray-500 mb-1 font-medium">Title</div>
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800">
                {title || "—"}
              </div>
            </div>

            {/* Type */}
            <div className="mb-3">
              <div className="text-xs text-gray-500 mb-1 font-medium">Service Call Type</div>
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800">
                {typeLabel}
              </div>
            </div>

            {/* Notes */}
            <div className="mb-5">
              <div className="text-xs text-gray-500 mb-1 font-medium">Notes</div>
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 min-h-[72px] whitespace-pre-wrap">
                {notes || "—"}
              </div>
            </div>

            <button
              onClick={() => setView("list")}
              className="w-full bg-gray-100 text-gray-700 rounded-xl py-3 font-semibold text-sm hover:bg-gray-200 transition"
            >
              Back to List
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── EDIT VIEW ─────────────────────────────────────────────────────────────

  const calendarSection = (
    <div className="border border-gray-200 rounded-xl p-3 bg-gray-50 mb-4">
      {calViewMode === "calendar" ? calendarBlock : dayViewBlock}
    </div>
  );

  const detailFields = (
    <div className="space-y-4">
      {/* Title — required */}
      <div>
        <label className="text-xs text-gray-500 mb-1 block font-medium">
          Title <span className="text-orange-500">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => { setTitle(e.target.value); setDirty(true); if (saveError) setSaveError(""); }}
          placeholder="e.g. Final coat, Touch-up visit..."
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:border-blue-400 transition"
        />
      </div>

      {/* Service Call Type — required */}
      <div>
        <label className="text-xs text-gray-500 mb-1 block font-medium">
          Service Call Type <span className="text-orange-500">*</span>
        </label>
        <select
          value={scType}
          onChange={(e) => { setScType(e.target.value); setDirty(true); if (saveError) setSaveError(""); }}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:border-blue-400 transition"
        >
          <option value="">— Select type —</option>
          <option value="follow_up_install">Follow Up Install</option>
          <option value="service_call">All Other Service Calls</option>
        </select>
      </div>

      {/* Notes */}
      <div>
        <label className="text-xs text-gray-500 mb-1 block font-medium">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => { setNotes(e.target.value); setDirty(true); }}
          placeholder="Any notes for this visit..."
          rows={3}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:border-blue-400 transition resize-none"
        />
      </div>
    </div>
  );

  const actionButtons = (
    <div className="mt-4 space-y-2">
      {saveError && (
        <p className="text-xs text-orange-600 font-medium text-center pb-1">{saveError}</p>
      )}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold text-sm hover:bg-blue-700 transition disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save & Exit"}
      </button>
      <button
        onClick={handleExitEdit}
        className="w-full bg-gray-100 text-gray-700 rounded-xl py-3 font-semibold text-sm hover:bg-gray-200 transition"
      >
        Exit Without Saving
      </button>
      {editing && (
        <button
          onClick={() => setConfirmDelete(true)}
          disabled={deleting}
          className="w-full bg-gray-600 text-white rounded-xl py-3 font-semibold text-sm hover:bg-gray-700 transition disabled:opacity-50"
        >
          {deleting ? "Deleting..." : "Delete Service Call"}
        </button>
      )}
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto" onClick={onClose}>
        <div className={`flex min-h-full items-center justify-center ${isLandscape ? "p-2" : "p-4"}`}>
          <div
            className={`bg-white rounded-2xl shadow-xl w-full relative ${isLandscape ? "max-w-5xl flex flex-row" : "max-w-lg"}`}
            onClick={(e) => e.stopPropagation()}
          >
            {isLandscape ? (
              <>
                {/* LEFT: calendar always visible in landscape */}
                <div className="flex-1 min-w-0 p-4 border-r border-gray-200 overflow-y-auto max-h-[90vh]">
                  {/* Heading centered */}
                  <h2 className="text-base font-bold text-gray-900 text-center mb-1">
                    {editing ? "Edit Service Call" : "New Service Call"}
                  </h2>
                  {/* Date pill */}
                  {pillLabel && (
                    <div className="text-center mb-3">
                      <span className="inline-block bg-orange-50 border border-orange-300 text-orange-800 text-xs font-semibold px-4 py-1.5 rounded-full">
                        {pillLabel}
                      </span>
                    </div>
                  )}
                  {calViewMode === "calendar" ? calendarBlock : dayViewBlock}
                </div>
                {/* RIGHT: title, notes, buttons */}
                <div className="w-72 flex-shrink-0 p-4 flex flex-col overflow-y-auto max-h-[90vh]">
                  {detailFields}
                  {actionButtons}
                </div>
              </>
            ) : (
              /* ── Portrait layout ── */
              <div className="p-5">
                {/* Heading — centered */}
                <h2 className="text-lg font-bold text-gray-900 text-center mb-1">
                  {editing ? "Edit Service Call" : "New Service Call"}
                </h2>

                {/* Date/time pill — centered below heading */}
                {pillLabel ? (
                  <div className="text-center mb-4">
                    <button
                      onClick={() => { setCalExpanded(true); setCalViewMode("calendar"); }}
                      className="inline-block bg-orange-50 border border-orange-300 text-orange-800 text-sm font-semibold px-5 py-2 rounded-full hover:bg-orange-100 transition"
                    >
                      {pillLabel}
                    </button>
                  </div>
                ) : (
                  <p className="text-center text-xs text-gray-400 mb-4">Select a date on the calendar below</p>
                )}

                {/* Collapsible calendar + times */}
                {calExpanded && calendarSection}

                {/* Title + Notes */}
                {detailFields}

                {actionButtons}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Exit-without-saving confirmation */}
      {confirmExit && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-2xl p-6 mx-4 w-full max-w-sm shadow-xl text-center">
            <p className="text-gray-800 font-semibold mb-1">Exit without saving?</p>
            <p className="text-gray-500 text-sm mb-5">Your changes will be lost.</p>
            <div className="flex gap-3">
              <button
                onClick={() => { setConfirmExit(false); setView("list"); }}
                className="flex-1 bg-red-100 text-red-700 rounded-xl py-2.5 font-semibold text-sm hover:bg-red-200 transition"
              >
                Exit Without Saving
              </button>
              <button
                onClick={() => setConfirmExit(false)}
                className="flex-1 bg-gray-100 text-gray-700 rounded-xl py-2.5 font-semibold text-sm hover:bg-gray-200 transition"
              >
                Stay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-2xl p-6 mx-4 w-full max-w-sm shadow-xl text-center">
            <p className="text-gray-800 font-semibold mb-1">Delete this service call?</p>
            <p className="text-gray-500 text-sm mb-5">
              {editing?.title ? `"${editing.title}" will be permanently removed.` : "This cannot be undone."}
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDeleteConfirmed}
                className="flex-1 bg-gray-700 text-white rounded-xl py-2.5 font-semibold text-sm hover:bg-gray-800 transition"
              >
                Yes, Delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 bg-gray-100 text-gray-700 rounded-xl py-2.5 font-semibold text-sm hover:bg-gray-200 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
