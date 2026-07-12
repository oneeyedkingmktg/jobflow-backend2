// === CHANGELOG ===
// ✅ Multi-day install bars with continuous rendering across days
// ✅ Week-by-week layout with absolutely positioned bars (no gaps between bar segments)
// ✅ Up to 2 simultaneous installs supported (stacked bar rows)
// ✅ List view shows date range for multi-day installs
// ✅ Day view handles multi-day install entries

import React, { useState, useMemo } from "react";
import { formatDate, formatTime } from "./utils/formatting.js";
import BlockTimeModal from "./BlockTimeModal.jsx";

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

export default function CalendarView({ leads, serviceCalls = [], holidays = [], onSelectLead, blockedTimes = [], currentUser, onBlockSave, onBlockDelete }) {
  const [viewMode, setViewMode] = useState("month");
  const [selectedDate, setSelectedDate] = useState(null);
  const [blockModal, setBlockModal] = useState({ open: false, date: null, block: null });

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
        if (!map[lead.appointmentDate]) map[lead.appointmentDate] = { appt: [], install: [], sc: [] };
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
          if (!map[key]) map[key] = { appt: [], install: [], sc: [] };
          map[key].install.push({
            ...lead,
            _barStart: d === 0,
            _barEnd: d === duration - 1,
          });
        }
      }
    });
    serviceCalls.forEach((sc) => {
      if (!sc.scheduled_date) return;
      const startDateStr = sc.scheduled_date.split("T")[0];
      const endDateStr = sc.scheduled_end_date ? sc.scheduled_end_date.split("T")[0] : startDateStr;
      const start = new Date(startDateStr + "T12:00:00");
      const end = new Date(endDateStr + "T12:00:00");
      const duration = Math.max(1, Math.round((end - start) / 86400000) + 1);
      for (let d = 0; d < duration; d++) {
        const date = new Date(startDateStr + "T12:00:00");
        date.setDate(date.getDate() + d);
        const key = date.toISOString().split("T")[0];
        if (!map[key]) map[key] = { appt: [], install: [], sc: [] };
        map[key].sc.push({
          ...sc,
          _barStart: d === 0,
          _barEnd: d === duration - 1,
          _multiDay: duration > 1,
        });
      }
    });
    return map;
  }, [leads, serviceCalls]);

  const blocksByDate = useMemo(() => {
    const map = {};
    blockedTimes.forEach((b) => {
      const key = String(b.date).split("T")[0];
      if (!map[key]) map[key] = [];
      map[key].push(b);
    });
    return map;
  }, [blockedTimes]);

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

  // Compute SC bar segments for a given week (same logic as install bars)
  const getWeekScBars = (week) => {
    const scById = {};
    week.forEach((day, colIdx) => {
      if (!day) return;
      const key = formatDateKey(day);
      (groupedByDate[key]?.sc || []).filter((sc) => sc._multiDay).forEach((scEntry) => {
        const id = scEntry.id;
        if (!scById[id]) scById[id] = { scEntry, cols: [] };
        scById[id].cols.push(colIdx);
      });
    });

    const bars = Object.values(scById).map(({ scEntry, cols }) => {
      const colStart = Math.min(...cols);
      const colEnd = Math.max(...cols);
      const startKey = formatDateKey(week[colStart]);
      const endKey = formatDateKey(week[colEnd]);
      const startEntry = groupedByDate[startKey]?.sc.find((s) => s.id === scEntry.id);
      const endEntry = groupedByDate[endKey]?.sc.find((s) => s.id === scEntry.id);
      return {
        id: scEntry.id,
        sc: scEntry,
        colStart,
        colEnd,
        colSpan: colEnd - colStart + 1,
        roundLeft: startEntry?._barStart || false,
        roundRight: endEntry?._barEnd || false,
      };
    });

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

  // Build { "2026-07-04": "Independence Day", ... } for O(1) lookup
  const holidayMap = useMemo(() => {
    const map = {};
    holidays.forEach((h) => { map[h.date] = h.name; });
    return map;
  }, [holidays]);

  const futureLeads = useMemo(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const allLeads = [];
    leads.forEach((l) => {
      if (l.appointmentDate && l.appointmentDate.slice(0, 10) >= todayStr) {
        allLeads.push({ ...l, displayDate: l.appointmentDate, displayType: "appointment" });
      }
    });
    leads.forEach((l) => {
      if (l.installDate && l.installDate.slice(0, 10) >= todayStr) {
        allLeads.push({ ...l, displayDate: l.installDate, displayType: "install" });
      }
    });
    serviceCalls.forEach((sc) => {
      if (sc.scheduled_date && sc.scheduled_date.slice(0, 10) >= todayStr) {
        allLeads.push({ ...sc, displayDate: sc.scheduled_date, displayType: "serviceCall", name: sc.lead_name });
      }
    });
    return allLeads.sort((a, b) => new Date(a.displayDate) - new Date(b.displayDate));
  }, [leads, serviceCalls]);

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
        const barAreaHeight = barRowCount * 28;

        const weekScBars = getWeekScBars(week);
        const scBarRowCount = weekScBars.length > 0 ? Math.max(...weekScBars.map((b) => b.rowIdx)) + 1 : 0;
        const scBarAreaHeight = scBarRowCount * 28;

        return (
          <div key={wIdx} className="mb-1">
            {/* Day cells */}
            <div className="grid grid-cols-7 gap-x-2">
              {week.map((day, dIdx) => {
                if (!day) return <div key={`e-${wIdx}-${dIdx}`} className="min-h-[60px]" />;
                const key = formatDateKey(day);
                const data = groupedByDate[key] || { appt: [], install: [], sc: [] };
                const isToday = key === formatDateKey(today);
                // Only show single-day SCs inline in the cell; multi-day ones render as bars below
                const singleDayScs = data.sc.filter((sc) => !sc._multiDay);
                const holidayName = holidayMap[key];

                return (
                  <div
                    key={key}
                    onClick={() => handleDayClick(key)}
                    className={`border rounded-md p-1 min-h-[60px] cursor-pointer hover:bg-blue-50 flex flex-col items-center ${
                      isToday ? "border-blue-500 bg-blue-100" : holidayName ? "border-amber-300 bg-amber-50" : "border-gray-300"
                    }`}
                  >
                    <div className="font-semibold text-xs sm:text-sm">{day.getDate()}</div>
                    {holidayName && (
                      <div className="text-xs text-amber-700 font-medium truncate w-full text-center leading-tight mt-0.5" title={holidayName}>
                        {holidayName}
                      </div>
                    )}
                    {data.appt.length > 0 && (
                      <div className="flex flex-col gap-0.5 w-full mt-1">
                        {data.appt.map((apptLead, i) => (
                          <div key={`a-${i}`} className="w-full h-6 bg-blue-500 rounded-sm overflow-hidden flex items-center px-1">
                            <span className="text-white text-xs font-semibold truncate leading-none">{apptLead.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {singleDayScs.length > 0 && (
                      <div className="flex flex-col gap-0.5 w-full mt-0.5">
                        {singleDayScs.map((sc, i) => (
                          <div key={`sc-${i}`} className="w-full h-6 bg-orange-400 rounded-sm overflow-hidden flex items-center px-1">
                            <span className="text-white text-xs font-semibold truncate leading-none">
                              {sc.lead_name}{sc.title ? ` - ${sc.title}` : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {(blocksByDate[key] || []).length > 0 && (
                      <div className="flex flex-col gap-0.5 w-full mt-0.5">
                        {(blocksByDate[key] || []).map((blk, i) => (
                          <div key={`blk-${i}`} className="w-full h-6 bg-slate-400 rounded-sm overflow-hidden flex items-center px-1">
                            <span className="text-white text-xs font-semibold truncate leading-none">🔒 {blk.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Install bar overlay */}
            {barAreaHeight > 0 && (
              <div className="relative grid grid-cols-7 gap-x-2 mt-0.5" style={{ height: `${barAreaHeight}px` }}>
                {weekBars.map((bar) => {
                  const roundClass =
                    bar.roundLeft && bar.roundRight ? "rounded"
                    : bar.roundLeft ? "rounded-l"
                    : bar.roundRight ? "rounded-r"
                    : "";
                  const bgColor = bar.lead.installTentative ? "bg-green-700" : "bg-green-500";
                  return (
                    <div
                      key={bar.id}
                      onClick={() => handleDayClick(formatDateKey(week[bar.colStart]))}
                      className={`absolute h-6 ${bgColor} ${roundClass} cursor-pointer hover:opacity-80 overflow-hidden flex items-center px-1`}
                      style={{
                        left: barLeftCalc(bar.colStart),
                        width: barWidthCalc(bar.colSpan),
                        top: `${bar.rowIdx * 28}px`,
                      }}
                    >
                      <span className="text-white text-xs font-semibold truncate leading-none">{bar.lead.name}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Service call bar overlay (multi-day SCs) */}
            {scBarAreaHeight > 0 && (
              <div className="relative grid grid-cols-7 gap-x-2 mt-0.5" style={{ height: `${scBarAreaHeight}px` }}>
                {weekScBars.map((bar) => {
                  const roundClass =
                    bar.roundLeft && bar.roundRight ? "rounded"
                    : bar.roundLeft ? "rounded-l"
                    : bar.roundRight ? "rounded-r"
                    : "";
                  return (
                    <div
                      key={`sc-bar-${bar.id}-${wIdx}`}
                      onClick={() => handleDayClick(formatDateKey(week[bar.colStart]))}
                      className={`absolute h-6 bg-orange-400 ${roundClass} cursor-pointer hover:opacity-80 overflow-hidden flex items-center px-1`}
                      style={{
                        left: barLeftCalc(bar.colStart),
                        width: barWidthCalc(bar.colSpan),
                        top: `${bar.rowIdx * 28}px`,
                      }}
                    >
                      <span className="text-white text-xs font-semibold truncate leading-none">
                        {bar.sc.lead_name}{bar.sc.title ? ` - ${bar.sc.title}` : ""}
                      </span>
                    </div>
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
            const isSC = lead.displayType === "serviceCall";
            const barColor = isInstall ? "bg-green-500" : isSC ? "bg-orange-400" : "bg-blue-500";
            const labelType = isInstall ? "Install" : isSC ? "Service Call" : "Appointment";

            let labelDate = formatDisplayDate(lead.displayDate);
            if (isInstall && lead.installEndDate && lead.installEndDate !== lead.installDate) {
              labelDate = `${formatDisplayDate(lead.installDate)} – ${formatDisplayDate(lead.installEndDate)}`;
            }
            if (isAppt && lead.appointmentTime) {
              labelDate = `${labelDate} @ ${formatTime12h(lead.appointmentTime)}`;
            }
            if (isSC && lead.scheduled_time) {
              labelDate = `${labelDate} @ ${formatTime12h(lead.scheduled_time)}`;
            }

            return (
              <div
                key={idx}
                className="border rounded-md overflow-hidden"
              >
                <div className={`${barColor} text-white text-sm font-semibold h-8 flex items-center justify-center rounded-t-md`}>
                  {isSC
                    ? `${lead.name}${lead.title ? ` - ${lead.title}` : ""} — ${labelDate}`
                    : `${labelType} — ${labelDate}`}
                </div>
                <div className="px-3 pb-3 pt-2 text-sm">
                  <div className="flex justify-between flex-wrap">
                    <div className="flex-1">
                      <span className="font-semibold">
                        {lead.name}{!isSC && lead.projectType ? ` — ${lead.projectType}` : ""}
                      </span>
                      {isSC && lead.title && (
                        <div className="text-xs text-gray-600 mt-0.5">{lead.title}</div>
                      )}
                      {!isSC && lead.buyerType && lead.buyerType !== "Residential" && lead.companyName && (
                        <div className="text-xs text-gray-700 font-semibold mt-0.5">{lead.companyName}</div>
                      )}
                    </div>
                    {!isSC && <span className="text-gray-600">{lead.city}, {lead.state}</span>}
                  </div>
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
    const data = groupedByDate[selectedDate] || { appt: [], install: [], sc: [] };
    const dayBlocks = blocksByDate[selectedDate] || [];
    const hasAny = data.appt.length + data.install.length + data.sc.length + dayBlocks.length > 0;

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
          <div className="text-lg font-semibold flex-1">
            {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </div>
          <button
            onClick={() => setBlockModal({ open: true, date: selectedDate, block: null })}
            className="px-3 py-1 text-sm bg-slate-600 text-white rounded hover:bg-slate-700 whitespace-nowrap"
          >
            + Block Time
          </button>
        </div>

        {!hasAny && <p className="text-gray-500 italic">No events for this day.</p>}

        <div className="space-y-3">
          {dayBlocks.map((blk, i) => {
            const appliesToLabel =
              blk.applies_to === "appointment" ? "Appointment Calendar"
              : blk.applies_to === "install" ? "Install Calendar"
              : "All Calendars";
            return (
              <div
                key={`blk-${i}`}
                onClick={() => setBlockModal({ open: true, date: selectedDate, block: blk })}
                className="border rounded-md hover:bg-gray-50 cursor-pointer overflow-hidden"
              >
                <div className="bg-slate-500 text-white text-sm font-semibold h-8 flex items-center justify-center rounded-t-md gap-1">
                  🔒 Blocked — {appliesToLabel}
                </div>
                <div className="px-3 pb-3 pt-2 text-sm">
                  <span className="font-semibold">{blk.name}</span>
                  {currentUser?.role !== "user" && blk.user_name && (
                    <div className="text-xs text-gray-500 mt-0.5">{blk.user_name}</div>
                  )}
                  {blk.all_day && <div className="text-xs text-gray-400 mt-0.5">All day</div>}
                  {!blk.all_day && blk.start_time && (
                    <div className="text-xs text-gray-600 mt-0.5">
                      {formatTime12h(blk.start_time)}{blk.end_time ? ` – ${formatTime12h(blk.end_time)}` : ""}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

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
                {lead.driveTimeMinutes != null && (
                  <div className="text-xs text-gray-500 px-3 pb-3">
                    Approx {lead.driveTimeMinutes} min away
                  </div>
                )}
              </div>
            );
          })}
          {data.sc.map((sc, i) => {
            const scLead = leads.find((l) => l.id === sc.lead_id);
            return (
              <div
                key={`sc-${i}`}
                onClick={() => {
                  if (!scLead) return;
                  window.__pendingOpenServiceCalls = { leadId: sc.lead_id, scId: sc.id };
                  handleLeadClick(scLead, "day", selectedDate);
                }}
                className={`border rounded-md overflow-hidden ${scLead ? "cursor-pointer hover:bg-gray-50" : ""}`}
              >
                <div className="bg-orange-400 text-white text-sm font-semibold h-8 flex items-center justify-center rounded-t-md">
                  {sc.lead_name}{sc.title ? ` - ${sc.title}` : ""}{sc.scheduled_time ? ` @ ${formatTime12h(sc.scheduled_time)}` : ""}
                </div>
                <div className="px-3 pb-3 pt-2 text-sm">
                  <span className="font-semibold">{sc.lead_name}</span>
                  {sc.title && <div className="text-xs text-gray-600 mt-0.5">{sc.title}</div>}
                  {sc.notes && <div className="text-xs text-gray-500 mt-0.5">{sc.notes}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      {viewMode === "day" ? <DayView /> : viewMode === "list" ? <ListView /> : <MonthView />}
      <BlockTimeModal
        isOpen={blockModal.open}
        onClose={() => setBlockModal({ open: false, date: null, block: null })}
        onSave={async (data, id) => { await onBlockSave(data, id); }}
        onDelete={async (id) => { await onBlockDelete(id); }}
        initialDate={blockModal.date}
        initialBlock={blockModal.block}
      />
    </>
  );
}
