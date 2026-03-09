// File: src/ApptDateTimeModal.jsx

import React, { useState, useEffect, useMemo } from "react";
import { LeadsAPI } from "./api";
import { useCompany } from "./CompanyContext";

function formatDateKey(date) {
  return date.toISOString().split("T")[0];
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function formatTime12h(time) {
  if (!time) return "";
  const [h, m] = time.split(":");
  let hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${m} ${ampm}`;
}

function shiftDate(dateStr, days) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export default function ApptDateTimeModal({
  apptDate,
  apptTime,
  onConfirm,
  onClose,
  onRemove,
  companyId = null,
  excludeLeadId = null,
}) {
  const { currentCompany } = useCompany();
  const fetchCompanyId = currentCompany?.id || companyId;
  const today = new Date();

  const parseTime = (t) => {
    if (!t) return { hour: "1", minute: "00", ampm: "AM" };
    let [h, m] = t.split(":").map((v) => parseInt(v, 10));
    const ampm = h >= 12 ? "PM" : "AM";
    let hour12 = h % 12;
    if (hour12 === 0) hour12 = 12;
    return { hour: String(hour12), minute: m.toString().padStart(2, "0"), ampm };
  };

  const initial = parseTime(apptTime);

  const [hour, setHour] = useState(initial.hour);
  const [minute, setMinute] = useState(initial.minute);
  const [ampm, setAmPm] = useState(initial.ampm);
  const [selectedDate, setSelectedDate] = useState(apptDate || null);
  const [viewMode, setViewMode] = useState("calendar"); // "calendar" | "day"
  const [dayDate, setDayDate] = useState(null);
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [dots, setDots] = useState([]);
  const [dotsLoading, setDotsLoading] = useState(true);
  const [slotError, setSlotError] = useState(null);

  useEffect(() => {
    if (apptDate) setSelectedDate(apptDate);
    const parsed = parseTime(apptTime);
    setHour(parsed.hour);
    setMinute(parsed.minute);
    setAmPm(parsed.ampm);
  }, [apptDate, apptTime]);

  useEffect(() => {
    if (!fetchCompanyId) return;
    setDotsLoading(true);
    console.log("[ApptModal] Fetching dots for companyId:", fetchCompanyId);
    LeadsAPI.getCalendarDots(fetchCompanyId)
      .then((res) => {
        // /leads returns camelCase leads array
        const leads = res.leads || [];
        console.log("[ApptModal] Leads loaded for dots:", leads.length);
        setDots(leads);
      })
      .catch((err) => console.error("[ApptModal] Failed to load calendar dots:", err))
      .finally(() => setDotsLoading(false));
  }, [fetchCompanyId]);

  const to24Hour = () => {
    let h = parseInt(hour, 10);
    if (ampm === "PM" && h < 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    return `${h.toString().padStart(2, "0")}:${minute}`;
  };

  const getDaysInMonth = (year, month) => {
    const date = new Date(year, month, 1);
    const days = [];
    while (date.getMonth() === month) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    return days;
  };

  const monthDays = useMemo(() => getDaysInMonth(currentYear, currentMonth), [currentYear, currentMonth]);

  const groupedByDate = useMemo(() => {
    const map = {};
    dots.forEach((lead) => {
      if (lead.appointmentDate) {
        const key = lead.appointmentDate.split("T")[0];
        if (!map[key]) map[key] = [];
        map[key].push(lead);
      }
    });
    return map;
  }, [dots]);

  const getMonthName = () =>
    new Date(currentYear, currentMonth, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const goToPrevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(currentYear - 1); }
    else setCurrentMonth(currentMonth - 1);
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(currentYear + 1); }
    else setCurrentMonth(currentMonth + 1);
  };

  const handleDayClick = (key) => {
    console.log("[ApptModal] Day clicked:", key);
    console.log("[ApptModal] groupedByDate keys:", Object.keys(groupedByDate));
    console.log("[ApptModal] Appointments for this day:", groupedByDate[key]);
    setSelectedDate(key);
    setDayDate(key);
    setViewMode("day");
  };

  const handleSave = async () => {
    if (!selectedDate) return;
    const finalTime24 = to24Hour();

    if (fetchCompanyId) {
      try {
        const check = await LeadsAPI.checkApptSlot(fetchCompanyId, selectedDate, finalTime24, excludeLeadId);
        if (check.taken) {
          setSlotError(`Already booked (${check.conflict?.name || "another lead"}). Choose a different time or date.`);
          return;
        }
      } catch { /* allow save on check failure */ }
    }

    setSlotError(null);
    onConfirm(selectedDate, finalTime24);
    onClose();
  };

  const handleRemove = () => {
    if (onRemove) onRemove();
    onClose();
  };

  // ─── Calendar view ───────────────────────────────────────────────────────────
  const CalendarView = (
    <>
      {/* Month nav */}
      <div className="flex items-center justify-between mb-2 bg-gray-50 rounded border border-gray-200 px-2 py-1">
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

      {/* Day headers */}
      <div className="grid grid-cols-7 text-center text-xs font-semibold text-gray-500 mb-1">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => <div key={d}>{d}</div>)}
      </div>

      {/* Grid */}
      {dotsLoading && <p className="text-xs text-gray-400 italic text-center mb-1">Loading schedule...</p>}
      <div className="grid grid-cols-7 gap-px text-center text-xs">
        {Array(monthDays[0].getDay()).fill(null).map((_, i) => <div key={`e-${i}`} />)}
        {monthDays.map((day) => {
          const key = formatDateKey(day);
          const appts = groupedByDate[key] || [];
          const isToday = key === formatDateKey(today);
          const isSelected = key === selectedDate;

          return (
            <div
              key={key}
              onClick={() => handleDayClick(key)}
              className={`rounded cursor-pointer py-1 flex flex-col items-center min-h-[36px] transition-colors
                ${isSelected ? "bg-blue-600 text-white" : isToday ? "bg-blue-100 text-blue-800" : "hover:bg-gray-100 text-gray-800"}`}
            >
              <span className="font-medium leading-none">{day.getDate()}</span>
              <div className="flex gap-px mt-0.5 flex-wrap justify-center">
                {appts.map((_, i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: isSelected ? "white" : "#3b82f6" }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );

  // ─── Day view ─────────────────────────────────────────────────────────────────
  const apptsList = dayDate ? (groupedByDate[dayDate] || []) : [];

  const DayView = (
    <div>
      {/* Header: back + prev/next arrows */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setViewMode("calendar")}
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
            onClick={() => { const d = shiftDate(dayDate, -1); setDayDate(d); setSelectedDate(d); }}
            className="p-1 hover:bg-gray-200 rounded text-gray-600"
            aria-label="Previous day"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => { const d = shiftDate(dayDate, 1); setDayDate(d); setSelectedDate(d); }}
            className="p-1 hover:bg-gray-200 rounded text-gray-600"
            aria-label="Next day"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Appointment list for this day */}
      <div className="border rounded-md bg-gray-50 p-2 mb-3 min-h-[60px] max-h-[120px] overflow-y-auto">
        {dotsLoading ? (
          <p className="text-xs text-gray-400 italic text-center mt-2">Loading...</p>
        ) : apptsList.length === 0 ? (
          <p className="text-xs text-gray-400 italic text-center mt-2">No appointments this day</p>
        ) : (
          <div className="space-y-1">
            {apptsList
              .slice()
              .sort((a, b) => (a.appointmentTime || "").localeCompare(b.appointmentTime || ""))
              .map((lead, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-gray-700">
                  <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  <span className="font-medium w-16 flex-shrink-0">
                    {lead.appointmentTime ? formatTime12h(lead.appointmentTime) : "—"}
                  </span>
                  <span className="truncate">{lead.name}</span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 bg-black/40 flex justify-center items-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-sm p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-3 text-gray-800 text-center">Set Appointment</h2>

        {/* Selected date display */}
        <div className="text-center text-sm font-semibold text-blue-700 mb-2 min-h-[20px]">
          {selectedDate ? new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "No date selected"}
        </div>

        {/* Calendar or Day view */}
        {viewMode === "calendar" ? CalendarView : DayView}

        {/* TIME PICKER — always visible */}
        <div className="mt-3 mb-2">
          <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
            Appointment Time
          </label>
          <div className="grid grid-cols-3 gap-2">
            <select value={hour} onChange={(e) => setHour(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm">
              {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
            <select value={minute} onChange={(e) => setMinute(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm">
              {["00", "15", "30", "45"].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select value={ampm} onChange={(e) => setAmPm(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm">
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </div>
        </div>

        {/* Slot error */}
        {slotError && (
          <div className="mb-2 px-3 py-2 bg-red-50 border border-red-300 rounded text-xs text-red-700">
            {slotError}
          </div>
        )}

        {/* Buttons */}
        <div className="flex justify-between mt-3 gap-2">
          <button onClick={handleRemove} className="px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm">
            Remove
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-sm">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!selectedDate}
              className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
