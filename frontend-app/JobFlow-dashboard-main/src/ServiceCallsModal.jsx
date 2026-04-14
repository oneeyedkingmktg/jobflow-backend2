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

function TimeSelects({ hour, minute, ampm, onHour, onMinute, onAmpm }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <select
        value={hour}
        onChange={(e) => onHour(e.target.value)}
        className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-blue-400"
      >
        {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
      <select
        value={minute}
        onChange={(e) => onMinute(e.target.value)}
        className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-blue-400"
      >
        {["00", "15", "30", "45"].map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
      <select
        value={ampm}
        onChange={(e) => onAmpm(e.target.value)}
        className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-blue-400"
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}

export default function ServiceCallsModal({ leadId, initialScId, onClose, onCountChange, onServiceCallsChange }) {
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id;

  const [serviceCalls, setServiceCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("list"); // "list" | "edit"
  const [editing, setEditing] = useState(null);

  // Edit form state
  const [title, setTitle] = useState("");
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

  // Landscape
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

  // Load calendar dots whenever we enter edit view
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
    setDate(null);
    setStartHour("8"); setStartMinute("00"); setStartAmpm("AM");
    setEndHour("9"); setEndMinute("00"); setEndAmpm("AM");
    setNotes("");
    setDirty(false);
    setCalViewMode("calendar");
    setDayDate(null);
    setView("edit");
  };

  const openEdit = (sc) => {
    setEditing(sc);
    setTitle(sc.title || "");
    setDate(sc.scheduled_date ? sc.scheduled_date.split("T")[0] : null);
    const parsedStart = parseTime(sc.scheduled_time);
    setStartHour(parsedStart.hour); setStartMinute(parsedStart.minute); setStartAmpm(parsedStart.ampm);
    const parsedEnd = parseTime(sc.scheduled_end_time);
    setEndHour(parsedEnd.hour); setEndMinute(parsedEnd.minute); setEndAmpm(parsedEnd.ampm);
    setNotes(sc.notes || "");
    setDirty(false);
    setCalViewMode("calendar");
    setDayDate(null);
    setView("edit");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        scheduled_date: date || null,
        scheduled_end_date: null,
        scheduled_time: to24Hour(startHour, startMinute, startAmpm),
        scheduled_end_time: to24Hour(endHour, endMinute, endAmpm),
        title: title || null,
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

  const handleDelete = async () => {
    if (!editing) return;
    setDeleting(true);
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

  // Build per-day event map from dots + scDots
  const groupedByDate = useMemo(() => {
    const map = {};
    dots.forEach((lead) => {
      if (lead.appointment_date) {
        const key = lead.appointment_date.split("T")[0];
        if (!map[key]) map[key] = { appt: [], install: [], sc: [] };
        map[key].appt.push(lead);
      }
      if (lead.install_date) {
        const endDateStr = lead.install_end_date || lead.install_date;
        const start = new Date(lead.install_date + "T12:00:00");
        const end = new Date(endDateStr + "T12:00:00");
        const duration = Math.max(1, Math.round((end - start) / 86400000) + 1);
        for (let d = 0; d < duration; d++) {
          const dt = new Date(lead.install_date + "T12:00:00");
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

  const handleDayClick = (key) => {
    setDate(key);
    setDirty(true);
    setDayDate(key);
    setCalViewMode("day");
  };

  const dayAppts = dayDate ? (groupedByDate[dayDate]?.appt || []) : [];
  const dayInstalls = dayDate ? (groupedByDate[dayDate]?.install || []) : [];
  const dayScs = dayDate ? (groupedByDate[dayDate]?.sc || []) : [];

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
            <div className="grid grid-cols-7 gap-x-1 text-center">
              {week.map((day, dIdx) => {
                if (!day) return <div key={`e-${wIdx}-${dIdx}`} className="min-h-[36px]" />;
                const key = formatDateKey(day);
                const dayData = groupedByDate[key] || { appt: [], install: [], sc: [] };
                const isToday = key === formatDateKey(today);
                const isSelected = key === date;
                return (
                  <div
                    key={key}
                    onClick={() => handleDayClick(key)}
                    className={`rounded cursor-pointer py-1 flex flex-col items-start w-full px-0.5 min-h-[44px] transition-colors
                      ${isSelected ? "bg-blue-600 text-white" : isToday ? "bg-blue-100 text-blue-800" : "hover:bg-gray-100 text-gray-800"}`}
                  >
                    <span className="font-medium leading-none w-full text-center">{day.getDate()}</span>
                    {/* Appointment bars */}
                    {dayData.appt.map((lead, i) => (
                      <div key={`a-${i}`} className="w-full h-4 bg-blue-500 rounded-sm flex items-center px-0.5 overflow-hidden mt-0.5">
                        <span className="text-white text-xs font-semibold truncate leading-none">{lead.name}</span>
                      </div>
                    ))}
                    {/* Install bars */}
                    {dayData.install.map((lead, i) => (
                      <div key={`i-${i}`} className="w-full h-4 bg-green-500 rounded-sm flex items-center px-0.5 overflow-hidden mt-0.5">
                        <span className="text-white text-xs font-semibold truncate leading-none">{lead.name}</span>
                      </div>
                    ))}
                    {/* Service call bars */}
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
        <span className="text-xs font-semibold text-gray-700 flex-1 text-center px-2">
          {dayDate ? new Date(dayDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : ""}
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => { const d = shiftDate(dayDate, -1); setDayDate(d); setDate(d); setDirty(true); }}
            className="p-1 hover:bg-gray-200 rounded text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => { const d = shiftDate(dayDate, 1); setDayDate(d); setDate(d); setDirty(true); }}
            className="p-1 hover:bg-gray-200 rounded text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <div className="border rounded-lg bg-gray-50 p-2 mb-2 min-h-[60px] max-h-[130px] overflow-y-auto space-y-1">
        {dotsLoading ? (
          <p className="text-xs text-gray-400 italic text-center mt-2">Loading...</p>
        ) : (dayAppts.length + dayInstalls.length + dayScs.length === 0) ? (
          <p className="text-xs text-gray-400 italic text-center mt-2">Nothing scheduled this day</p>
        ) : (
          <>
            {dayAppts.map((l, i) => (
              <div key={`a-${i}`} className="flex items-center gap-2 text-xs text-gray-700">
                <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                <span className="font-medium w-16 flex-shrink-0">
                  {l.appointment_time ? formatTimeDisplay(l.appointment_time) : "—"}
                </span>
                <span className="truncate text-gray-600">{l.name}</span>
                <span className="text-gray-400 flex-shrink-0">Appt</span>
              </div>
            ))}
            {dayInstalls.map((l, i) => (
              <div key={`i-${i}`} className="flex items-center gap-2 text-xs text-gray-700">
                <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                <span className="font-medium w-16 flex-shrink-0">Install</span>
                <span className="truncate text-gray-600">{l.name}</span>
              </div>
            ))}
            {dayScs.map((sc, i) => (
              <div key={`sc-${i}`} className="flex items-center gap-2 text-xs text-gray-700">
                <span className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0" />
                <span className="font-medium w-16 flex-shrink-0">
                  {sc.scheduled_time ? formatTimeDisplay(sc.scheduled_time) : "SC"}
                </span>
                <span className="truncate text-gray-600">{sc.lead_name}</span>
                {sc.title && <span className="text-gray-400 flex-shrink-0 truncate">· {sc.title}</span>}
              </div>
            ))}
          </>
        )}
      </div>
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
                  {sc.notes && (
                    <div className="text-xs text-gray-500 mt-1 line-clamp-2">{sc.notes}</div>
                  )}
                </div>
              ))
            )}
          </div>

          <button
            onClick={openNew}
            className="mt-4 w-full bg-blue-600 text-white rounded-xl py-3 font-semibold text-sm hover:bg-blue-700 transition"
          >
            + Add Service Call
          </button>
        </div>
      </div>
    );
  }

  // ── EDIT VIEW ─────────────────────────────────────────────────────────────

  const formFields = (
    <div className="space-y-4">
      {/* Title */}
      <div>
        <label className="text-xs text-gray-500 mb-1 block font-medium">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
          placeholder="e.g. Final coat, Touch-up visit..."
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:border-blue-400 transition"
        />
      </div>

      {/* Selected date display */}
      <div>
        <label className="text-xs text-gray-500 mb-1 block font-medium">Date</label>
        <div className={`text-sm font-semibold px-4 py-2.5 rounded-xl border ${date ? "bg-blue-50 border-blue-300 text-blue-800" : "bg-gray-50 border-gray-200 text-gray-400"}`}>
          {date
            ? new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
            : "Select a date on the calendar"}
        </div>
      </div>

      {/* Start Time */}
      <div>
        <label className="text-xs text-gray-500 mb-1 block font-medium">Start Time</label>
        <TimeSelects
          hour={startHour} minute={startMinute} ampm={startAmpm}
          onHour={(v) => { setStartHour(v); setDirty(true); }}
          onMinute={(v) => { setStartMinute(v); setDirty(true); }}
          onAmpm={(v) => { setStartAmpm(v); setDirty(true); }}
        />
      </div>

      {/* End Time */}
      <div>
        <label className="text-xs text-gray-500 mb-1 block font-medium">End Time</label>
        <TimeSelects
          hour={endHour} minute={endMinute} ampm={endAmpm}
          onHour={(v) => { setEndHour(v); setDirty(true); }}
          onMinute={(v) => { setEndMinute(v); setDirty(true); }}
          onAmpm={(v) => { setEndAmpm(v); setDirty(true); }}
        />
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
          onClick={handleDelete}
          disabled={deleting}
          className="w-full bg-red-100 text-red-700 rounded-xl py-3 font-semibold text-sm hover:bg-red-200 transition disabled:opacity-50"
        >
          {deleting ? "Deleting..." : "Delete"}
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
            {/* X close */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 z-10 text-gray-400 hover:text-gray-600 text-2xl font-bold leading-none w-8 h-8 flex items-center justify-center"
            >
              ×
            </button>

            {isLandscape ? (
              <>
                {/* LEFT: calendar */}
                <div className="flex-1 min-w-0 p-4 border-r border-gray-200">
                  <h2 className="text-base font-bold text-gray-900 mb-3">
                    {editing ? "Edit Service Call" : "New Service Call"}
                  </h2>
                  {calViewMode === "calendar" ? calendarBlock : dayViewBlock}
                </div>
                {/* RIGHT: form + buttons */}
                <div className="w-72 flex-shrink-0 p-4 flex flex-col overflow-y-auto max-h-[90vh]">
                  {formFields}
                  {actionButtons}
                </div>
              </>
            ) : (
              <div className="p-5">
                <h2 className="text-lg font-bold text-gray-900 mb-4 pr-8">
                  {editing ? "Edit Service Call" : "New Service Call"}
                </h2>

                {/* Calendar section */}
                <div className="mb-4 border border-gray-200 rounded-xl p-3 bg-gray-50">
                  {calViewMode === "calendar" ? calendarBlock : dayViewBlock}
                </div>

                {formFields}
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
    </>
  );
}
