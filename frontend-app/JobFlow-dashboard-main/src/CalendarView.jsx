// === CHANGELOG ===
// ✅ Multi-day install bars with continuous rendering across days
// ✅ Week-by-week layout with absolutely positioned bars (no gaps between bar segments)
// ✅ Up to 2 simultaneous installs supported (stacked bar rows)
// ✅ List view shows date range for multi-day installs
// ✅ Day view handles multi-day install entries

import React, { useState, useMemo } from "react";
import { formatDate, formatTime } from "./utils/formatting.js";

const GAP_PX = 8; // gap-x-2 = 0.5rem = 8px
const COLS = 7;
const TOTAL_GAP_PX = (COLS - 1) * GAP_PX; // 48px

function barLeftCalc(colStart) {
  if (colStart === 0) return "0px";
  return `calc(${colStart} * ((100% - ${TOTAL_GAP_PX}px) / ${COLS} + ${GAP_PX}px))`;
}

function barWidthCalc(colSpan) {
  return `calc(${colSpan} * (100% - ${TOTAL_GAP_PX}px) / ${COLS} + ${Math.max(colSpan - 1, 0)} * ${GAP_PX}px)`;
}

export default function CalendarView({ leads, onSelectLead }) {
  const [viewMode, setViewMode] = useState("month");
  const [selectedDate, setSelectedDate] = useState(null);

  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());

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

  const goToPreviousMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(currentYear - 1); }
    else setCurrentMonth(currentMonth - 1);
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(currentYear + 1); }
    else setCurrentMonth(currentMonth + 1);
  };

  const getMonthName = () =>
    new Date(currentYear, currentMonth, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const formatDateKey = (date) => date.toISOString().split("T")[0];

  const formatDisplayDate = (d) => {
    if (!d) return "";
    const date = new Date(d + "T00:00:00");
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const formatTime12h = (time) => {
    if (!time) return "";
    const [h, m] = time.split(":");
    let hour = parseInt(h, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12;
    return `${hour}:${m} ${ampm}`;
  };

  // Expand installs across all days of their duration
  const groupedByDate = useMemo(() => {
    const map = {};
    leads.forEach((lead) => {
      if (lead.appointmentDate) {
        if (!map[lead.appointmentDate]) map[lead.appointmentDate] = { appt: [], install: [] };
        map[lead.appointmentDate].appt.push(lead);
      }
      if (lead.installDate) {
        const endDateStr = lead.installEndDate || lead.installDate;
        const start = new Date(lead.installDate + "T12:00:00");
        const end = new Date(endDateStr + "T12:00:00");
        const duration = Math.max(1, Math.round((end - start) / 86400000) + 1);
        for (let d = 0; d < duration; d++) {
          const date = new Date(lead.installDate + "T12:00:00");
          date.setDate(date.getDate() + d);
          const key = date.toISOString().split("T")[0];
          if (!map[key]) map[key] = { appt: [], install: [] };
          map[key].install.push({
            ...lead,
            _barStart: d === 0,
            _barEnd: d === duration - 1,
          });
        }
      }
    });
    return map;
  }, [leads]);

  // Group monthDays into weeks (arrays of 7, nulls for padding)
  const weeks = useMemo(() => {
    const result = [];
    let week = Array(monthDays[0].getDay()).fill(null);
    monthDays.forEach((day) => {
      week.push(day);
      if (week.length === 7) {
        result.push([...week]);
        week = [];
      }
    });
    if (week.length > 0) {
      while (week.length < 7) week.push(null);
      result.push(week);
    }
    return result;
  }, [monthDays]);

  // Compute install bar segments for a given week
  const getWeekBars = (week) => {
    const installsByLead = {};
    week.forEach((day, colIdx) => {
      if (!day) return;
      const key = formatDateKey(day);
      (groupedByDate[key]?.install || []).forEach((leadEntry) => {
        const id = leadEntry.id;
        if (!installsByLead[id]) installsByLead[id] = { leadEntry, cols: [] };
        installsByLead[id].cols.push(colIdx);
      });
    });

    const bars = Object.values(installsByLead).map(({ leadEntry, cols }) => {
      const colStart = Math.min(...cols);
      const colEnd = Math.max(...cols);
      const startKey = formatDateKey(week[colStart]);
      const endKey = formatDateKey(week[colEnd]);
      const startEntry = groupedByDate[startKey]?.install.find((l) => l.id === leadEntry.id);
      const endEntry = groupedByDate[endKey]?.install.find((l) => l.id === leadEntry.id);
      return {
        id: leadEntry.id,
        lead: leadEntry,
        colStart,
        colEnd,
        colSpan: colEnd - colStart + 1,
        roundLeft: startEntry?._barStart || false,
        roundRight: endEntry?._barEnd || false,
      };
    });

    // Assign row indices using greedy interval scheduling
    bars.sort((a, b) => a.colStart - b.colStart);
    const rowEndCols = [];
    bars.forEach((bar) => {
      let rowIdx = rowEndCols.findIndex((endCol) => endCol < bar.colStart);
      if (rowIdx === -1) rowIdx = rowEndCols.length;
      rowEndCols[rowIdx] = bar.colEnd;
      bar.rowIdx = rowIdx;
    });

    return bars;
  };

  const futureLeads = useMemo(() => {
    const now = new Date();
    const allLeads = [];
    leads.forEach((l) => {
      if (l.appointmentDate && new Date(l.appointmentDate) >= now) {
        allLeads.push({ ...l, displayDate: l.appointmentDate, displayType: "appointment" });
      }
    });
    leads.forEach((l) => {
      if (l.installDate && new Date(l.installDate) >= now) {
        allLeads.push({ ...l, displayDate: l.installDate, displayType: "install" });
      }
    });
    return allLeads.sort((a, b) => new Date(a.displayDate) - new Date(b.displayDate));
  }, [leads]);

  const handleDayClick = (date) => {
    setSelectedDate(date);
    setViewMode("day");
  };

  const handleLeadClick = (lead, subView, date = null) => {
    onSelectLead(lead, subView, date);
  };

  // ========= Month View =========
  const MonthView = () => (
    <div>
      <div className="grid grid-cols-2 gap-2 mb-3 sm:flex sm:gap-4">
        <button
          onClick={() => setViewMode("month")}
          className={`px-3 py-2 rounded font-medium border w-full sm:w-auto ${
            viewMode === "month" ? "bg-blue-600 text-white border-blue-600" : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
          }`}
        >
          Month View
        </button>
        <button
          onClick={() => setViewMode("list")}
          className={`px-3 py-2 rounded font-medium border w-full sm:w-auto ${
            viewMode === "list" ? "bg-blue-600 text-white border-blue-600" : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
          }`}
        >
          List View
        </button>
      </div>

      <div className="flex items-center justify-between mb-3 bg-white rounded border border-gray-300 px-2 py-2">
        <button onClick={goToPreviousMonth} className="p-1 hover:bg-gray-100 rounded transition-colors active:scale-95 text-gray-700" aria-label="Previous month">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm font-medium text-gray-700">{getMonthName()}</span>
        <button onClick={goToNextMonth} className="p-1 hover:bg-gray-100 rounded transition-colors active:scale-95 text-gray-700" aria-label="Next month">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Day of week headers */}
      <div className="grid grid-cols-7 gap-x-2 text-center text-xs sm:text-sm mb-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="font-semibold">{d}</div>
        ))}
      </div>

      {/* Weeks */}
      {weeks.map((week, wIdx) => {
        const weekBars = getWeekBars(week);
        const barRowCount = weekBars.length > 0 ? Math.max(...weekBars.map((b) => b.rowIdx)) + 1 : 0;
        const barAreaHeight = barRowCount * 16; // 12px bar + 4px gap per row

        return (
          <div key={wIdx} className="mb-1">
            {/* Day cells */}
            <div className="grid grid-cols-7 gap-x-2">
              {week.map((day, dIdx) => {
                if (!day) return <div key={`e-${wIdx}-${dIdx}`} className="min-h-[60px]" />;
                const key = formatDateKey(day);
                const data = groupedByDate[key] || { appt: [], install: [] };
                const apptCount = data.appt.length;
                const isToday = key === formatDateKey(today);

                return (
                  <div
                    key={key}
                    onClick={() => handleDayClick(key)}
                    className={`border rounded-md p-1 min-h-[60px] cursor-pointer hover:bg-blue-50 flex flex-col items-center ${
                      isToday ? "border-blue-500 bg-blue-100" : "border-gray-300"
                    }`}
                  >
                    <div className="font-semibold text-xs sm:text-sm">{day.getDate()}</div>
                    {apptCount > 0 && (
                      <div className="flex gap-0.5 flex-wrap justify-center mt-1">
                        {Array(apptCount).fill(0).map((_, i) => (
                          <div key={`a-${i}`} className="w-2.5 h-2.5 bg-blue-500 rounded-full" />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Install bar overlay — absolutely positioned, same gap as day cells */}
            {barAreaHeight > 0 && (
              <div className="relative grid grid-cols-7 gap-x-2 mt-0.5" style={{ height: `${barAreaHeight}px` }}>
                {weekBars.map((bar) => {
                  const roundClass =
                    bar.roundLeft && bar.roundRight ? "rounded-full"
                    : bar.roundLeft ? "rounded-l-full"
                    : bar.roundRight ? "rounded-r-full"
                    : "";
                  const bgColor = bar.lead.installTentative ? "bg-green-700" : "bg-green-500";
                  return (
                    <div
                      key={bar.id}
                      onClick={() => handleDayClick(formatDateKey(week[bar.colStart]))}
                      className={`absolute h-3 ${bgColor} ${roundClass} cursor-pointer hover:opacity-80`}
                      style={{
                        left: barLeftCalc(bar.colStart),
                        width: barWidthCalc(bar.colSpan),
                        top: `${bar.rowIdx * 16}px`,
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // ========= List View =========
  const ListView = () => (
    <div>
      <div className="grid grid-cols-2 gap-2 mb-3 sm:flex sm:gap-4">
        <button
          onClick={() => setViewMode("month")}
          className={`px-3 py-2 rounded font-medium border w-full sm:w-auto ${
            viewMode === "month" ? "bg-blue-600 text-white border-blue-600" : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
          }`}
        >
          Month View
        </button>
        <button
          onClick={() => setViewMode("list")}
          className={`px-3 py-2 rounded font-medium border w-full sm:w-auto ${
            viewMode === "list" ? "bg-blue-600 text-white border-blue-600" : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
          }`}
        >
          List View
        </button>
      </div>

      {futureLeads.length === 0 ? (
        <p className="text-gray-500 italic">No upcoming appointments or installs.</p>
      ) : (
        <div className="space-y-3">
          {futureLeads.map((lead, idx) => {
            const isInstall = lead.displayType === "install";
            const isAppt = lead.displayType === "appointment";
            const barColor = isInstall ? "bg-green-500" : "bg-blue-500";
            const labelType = isInstall ? "Install" : "Appointment";

            let labelDate = formatDisplayDate(lead.displayDate);
            if (isInstall && lead.installEndDate && lead.installEndDate !== lead.installDate) {
              labelDate = `${formatDisplayDate(lead.installDate)} – ${formatDisplayDate(lead.installEndDate)}`;
            }

            return (
              <div
                key={idx}
                onClick={() => handleLeadClick(lead, "list")}
                className="border rounded-md hover:bg-gray-50 cursor-pointer overflow-hidden"
              >
                <div className={`${barColor} text-white text-sm font-semibold h-8 flex items-center justify-center rounded-t-md`}>
                  {`${labelType} — ${labelDate}`}
                </div>
                <div className="px-3 pb-3 pt-2 text-sm">
                  <div className="flex justify-between flex-wrap">
                    <div className="flex-1">
                      <span className="font-semibold">
                        {lead.name}{lead.projectType ? ` — ${lead.projectType}` : ""}
                      </span>
                      {lead.buyerType && lead.buyerType !== "Residential" && lead.companyName && (
                        <div className="text-xs text-gray-700 font-semibold mt-0.5">{lead.companyName}</div>
                      )}
                    </div>
                    <span className="text-gray-600">{lead.city}, {lead.state}</span>
                  </div>
                  {isAppt && lead.apptTime && (
                    <div className="text-xs text-gray-700 mt-1">
                      <strong>Time:</strong> {formatTime12h(lead.apptTime)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ========= Day View =========
  const DayView = () => {
    const data = groupedByDate[selectedDate] || { appt: [], install: [] };
    const hasAny = data.appt.length + data.install.length > 0;

    // Deduplicate installs (same lead may appear multiple times if multi-day)
    const uniqueInstalls = [];
    const seenIds = new Set();
    data.install.forEach((lead) => {
      if (!seenIds.has(lead.id)) {
        seenIds.add(lead.id);
        uniqueInstalls.push(lead);
      }
    });

    return (
      <div>
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => { setSelectedDate(null); setViewMode("month"); }}
            className="px-2 py-1 bg-gray-200 text-sm rounded hover:bg-gray-300"
          >
            ← Back
          </button>
          <div className="text-lg font-semibold">
            {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </div>
        </div>

        {!hasAny && <p className="text-gray-500 italic">No events for this day.</p>}

        <div className="space-y-3">
          {[...uniqueInstalls, ...data.appt].map((lead, i) => {
            const isInstall = uniqueInstalls.includes(lead);
            const isAppt = !isInstall;
            const barColor = isInstall ? "bg-green-500" : "bg-blue-500";
            const label = isInstall ? "Install" : "Appointment";

            let sublabel = "";
            if (isInstall && (lead.installDurationDays || 1) > 1) {
              const endDate = new Date(lead.installDate + "T12:00:00");
              endDate.setDate(endDate.getDate() + (lead.installDurationDays - 1));
              sublabel = ` (${lead.installDurationDays} days, ends ${endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })})`;
            }

            return (
              <div
                key={i}
                onClick={() => handleLeadClick(lead, "day", selectedDate)}
                className="border rounded-md hover:bg-gray-50 cursor-pointer overflow-hidden"
              >
                <div className={`${barColor} text-white text-sm font-semibold h-8 flex items-center justify-center rounded-t-md`}>
                  {label}{sublabel}
                </div>
                <div className="px-3 pb-3 pt-2 flex justify-between text-sm">
                  <div className="flex-1">
                    <span className="font-semibold">
                      {lead.name}{lead.projectType ? ` — ${lead.projectType}` : ""}
                    </span>
                    {lead.buyerType && lead.buyerType !== "Residential" && lead.companyName && (
                      <div className="text-xs text-gray-700 font-semibold mt-0.5">{lead.companyName}</div>
                    )}
                  </div>
                  <span className="text-gray-600">{lead.city}, {lead.state}</span>
                </div>
                {isAppt && lead.appointmentTime && (
                  <div className="text-xs text-gray-700 px-3 pb-3">
                    <strong>Time:</strong> {formatTime12h(lead.appointmentTime)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (viewMode === "day") return <DayView />;
  if (viewMode === "list") return <ListView />;
  return <MonthView />;
}
