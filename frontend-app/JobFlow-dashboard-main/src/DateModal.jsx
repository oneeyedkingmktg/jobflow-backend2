// File: src/DateModal.jsx

import React, { useState, useEffect, useMemo } from "react";
import { LeadsAPI } from "./api";
import { useCompany } from "./CompanyContext";

function getMondayOfWeek(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay();
  if (day === 1) return dateStr;
  const offset = day === 0 ? 1 : -(day - 1);
  d.setDate(d.getDate() + offset);
  return d.toISOString().split("T")[0];
}

function formatDateKey(date) {
  return date.toISOString().split("T")[0];
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr + "T00:00:00");
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatTime12h(time) {
  if (!time) return "";
  const [h, m] = time.split(":");
  let hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${m} ${ampm}`;
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function daysBetween(startStr, endStr) {
  const start = new Date(startStr + "T12:00:00");
  const end = new Date(endStr + "T12:00:00");
  return Math.round((end - start) / 86400000) + 1;
}

function isValidDateStr(d) {
  return d && !isNaN(new Date(d + "T00:00:00").getTime());
}

export default function DateModal({
  initialDate,
  initialTentative = false,
  initialDurationDays = 1,
  onConfirm,
  onClose,
  onRemove,
  label = "Select Date",
  allowTentative = false,
}) {
  const { currentCompany: company } = useCompany();
  const today = new Date();

  const [tentative, setTentative] = useState(initialTentative || false);
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());

  // Start date (always used)
  const [startDate, setStartDate] = useState(isValidDateStr(initialDate) ? initialDate : null);

  // End date — only for install dates (allowTentative). Computed from initialDate + initialDurationDays.
  const computedInitialEnd = isValidDateStr(initialDate) && initialDurationDays > 1
    ? addDays(initialDate, initialDurationDays - 1)
    : null;
  const [endDate, setEndDate] = useState(computedInitialEnd);

  const [dayViewDate, setDayViewDate] = useState(null);
  const [dots, setDots] = useState([]);

  useEffect(() => {
    if (isValidDateStr(initialDate)) setStartDate(initialDate);
    if (initialTentative !== undefined) setTentative(initialTentative);
  }, [initialDate, initialTentative]);

  useEffect(() => {
    if (!company?.id) return;
    LeadsAPI.getCalendarDots(company.id)
      .then((res) => setDots(res.leads || []))
      .catch(() => {});
  }, [company?.id]);

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
      if (lead.installDate) {
        const key = lead.installDate.split("T")[0];
        if (!map[key]) map[key] = { appt: [], install: [] };
        map[key].install.push(lead);
      }
      if (lead.appointmentDate) {
        const key = lead.appointmentDate.split("T")[0];
        if (!map[key]) map[key] = { appt: [], install: [] };
        map[key].appt.push(lead);
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
    if (!allowTentative) {
      // Non-install dates: single date selection
      setStartDate(key);
      setDayViewDate(key);
      return;
    }

    // Install dates: range selection
    if (!startDate || (startDate && endDate)) {
      // No start yet, or both already set — start fresh
      setStartDate(key);
      setEndDate(null);
      setDayViewDate(key);
    } else {
      // Start set, no end — pick end date
      if (key < startDate) {
        // Clicked before start — reset with new start
        setStartDate(key);
        setEndDate(null);
      } else if (key === startDate) {
        // Same day = single day install
        setEndDate(key);
        setDayViewDate(key);
      } else {
        setEndDate(key);
        setDayViewDate(key);
      }
    }
  };

  const handleSave = () => {
    if (!startDate) return;
    const finalStart = tentative ? getMondayOfWeek(startDate) : startDate;
    const duration = allowTentative && endDate ? daysBetween(finalStart, endDate) : 1;
    onConfirm(finalStart, tentative, Math.max(1, duration));
    onClose();
  };

  const handleRemove = () => {
    if (onRemove) onRemove();
    onClose();
  };

  // Display text
  const displayText = (() => {
    if (!startDate) return allowTentative ? "Tap start date" : "No date selected";
    if (allowTentative) {
      if (!endDate || endDate === startDate) {
        return endDate
          ? `${formatDisplayDate(startDate)} (1 day)`
          : `Start: ${formatDisplayDate(startDate)} — tap end date`;
      }
      const days = daysBetween(startDate, endDate);
      return `${formatDisplayDate(startDate)} – ${formatDisplayDate(endDate)} (${days} days)`;
    }
    return tentative
      ? `Week of ${formatDisplayDate(getMondayOfWeek(startDate))}`
      : formatDisplayDate(startDate);
  })();

  const canSave = startDate && (!allowTentative || endDate);

  return (
    <div
      className="fixed inset-0 bg-black/40 flex justify-center items-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-sm p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-3 text-gray-800 text-center">{label}</h2>

        {/* Tentative checkbox */}
        {allowTentative && (
          <div className="mb-3">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={tentative}
                onChange={(e) => setTentative(e.target.checked)}
                className="mr-2 w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 font-medium">Week of (tentative)</span>
            </label>
            {tentative && (
              <p className="text-xs text-blue-600 mt-1 ml-6">Date will be set to Monday of the selected week</p>
            )}
          </div>
        )}

        {/* Date range display */}
        <div className="text-center text-sm font-semibold text-blue-700 mb-2 min-h-[20px]">
          {displayText}
        </div>

        {/* Month navigation */}
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
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-px text-center text-xs">
          {Array(monthDays[0].getDay()).fill(null).map((_, i) => (
            <div key={`e-${i}`} />
          ))}
          {monthDays.map((day) => {
            const key = formatDateKey(day);
            const data = groupedByDate[key] || { appt: [], install: [] };
            const isToday = key === formatDateKey(today);
            const isStart = key === startDate;
            const isEnd = allowTentative && key === endDate;
            const inRange = allowTentative && startDate && endDate && key > startDate && key < endDate;

            let cellClass = "rounded cursor-pointer py-1 flex flex-col items-center min-h-[36px] transition-colors ";
            if (isStart) cellClass += "bg-blue-600 text-white";
            else if (isEnd) cellClass += "bg-green-600 text-white";
            else if (inRange) cellClass += "bg-green-100 text-green-900";
            else if (isToday) cellClass += "bg-blue-100 text-blue-800";
            else cellClass += "hover:bg-gray-100 text-gray-800";

            const dotWhite = isStart || isEnd;

            return (
              <div key={key} onClick={() => handleDayClick(key)} className={cellClass}>
                <span className="font-medium leading-none">{day.getDate()}</span>
                <div className="flex gap-px mt-0.5 flex-wrap justify-center">
                  {data.appt.map((_, i) => (
                    <div key={`a-${i}`} className="w-2 h-2 bg-blue-400 rounded-full" style={dotWhite ? { backgroundColor: "white" } : {}} />
                  ))}
                  {data.install.map((lead, i) => (
                    <div
                      key={`i-${i}`}
                      className="w-2 h-2 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: dotWhite ? "white" : (lead.installTentative ? "#16a34a" : "#22c55e") }}
                    >
                      {lead.installTentative && (
                        <span style={{ fontSize: "6px", color: dotWhite ? "#1d4ed8" : "white", fontWeight: "bold", lineHeight: 1 }}>T</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Day detail list */}
        {dayViewDate && groupedByDate[dayViewDate] && (
          <div className="mt-3 border-t pt-2">
            <div className="text-xs font-semibold text-gray-600 mb-1">{formatDisplayDate(dayViewDate)}</div>
            <div className="space-y-1 max-h-28 overflow-y-auto">
              {groupedByDate[dayViewDate].install.map((lead, i) => (
                <div key={`di-${i}`} className="flex items-center gap-1 text-xs text-gray-700">
                  <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                  <span>Install{lead.installTentative ? " (Tentative)" : ""} — {lead.name}</span>
                </div>
              ))}
              {groupedByDate[dayViewDate].appt.map((lead, i) => (
                <div key={`da-${i}`} className="flex items-center gap-1 text-xs text-gray-700">
                  <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  <span>Appt{lead.appointmentTime ? ` at ${formatTime12h(lead.appointmentTime)}` : ""} — {lead.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="flex justify-between mt-4 gap-2">
          <button
            onClick={handleRemove}
            className="px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
          >
            Remove
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-sm">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
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
