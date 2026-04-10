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

const MODAL_GAP_PX = 8;
const MODAL_COLS = 7;
const MODAL_TOTAL_GAP_PX = (MODAL_COLS - 1) * MODAL_GAP_PX;

function modalBarLeftCalc(colStart) {
  if (colStart === 0) return "0px";
  return `calc(${colStart} * ((100% - ${MODAL_TOTAL_GAP_PX}px) / ${MODAL_COLS} + ${MODAL_GAP_PX}px))`;
}

function modalBarWidthCalc(colSpan) {
  return `calc(${colSpan} * (100% - ${MODAL_TOTAL_GAP_PX}px) / ${MODAL_COLS} + ${Math.max(colSpan - 1, 0)} * ${MODAL_GAP_PX}px)`;
}

export default function DateModal({
  initialDate,
  initialEndDate = null,
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

  const [startDate, setStartDate] = useState(isValidDateStr(initialDate) ? initialDate : null);

  const computedInitialEnd = isValidDateStr(initialDate) && initialDurationDays > 1
    ? addDays(initialDate, initialDurationDays - 1)
    : null;
  const [endDate, setEndDate] = useState(
    isValidDateStr(initialEndDate) ? initialEndDate : computedInitialEnd
  );

  const [dayViewDate, setDayViewDate] = useState(null);
  const [dots, setDots] = useState([]);
  const [scDots, setScDots] = useState([]);

  // Landscape detection
  const [isLandscape, setIsLandscape] = useState(
    () => typeof window !== "undefined" && window.innerWidth > window.innerHeight
  );

  useEffect(() => {
    const handleResize = () => setIsLandscape(window.innerWidth > window.innerHeight);
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  useEffect(() => {
    if (isValidDateStr(initialDate)) setStartDate(initialDate);
    if (initialTentative !== undefined) setTentative(initialTentative);
  }, [initialDate, initialTentative]);

  useEffect(() => {
    if (!company?.id) return;
    LeadsAPI.getCalendarDots(company.id)
      .then((res) => setDots(res.leads || []))
      .catch(() => {});
    LeadsAPI.getServiceCallsCalendar(company.id)
      .then((res) => setScDots(res.serviceCalls || []))
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
        const startStr = lead.installDate.split("T")[0];
        const endStr = lead.installEndDate ? lead.installEndDate.split("T")[0] : startStr;
        const start = new Date(startStr + "T12:00:00");
        const end = new Date(endStr + "T12:00:00");
        const days = Math.max(1, Math.round((end - start) / 86400000) + 1);
        for (let d = 0; d < days; d++) {
          const date = new Date(startStr + "T12:00:00");
          date.setDate(date.getDate() + d);
          const key = date.toISOString().split("T")[0];
          if (!map[key]) map[key] = { install: [], sc: [] };
          map[key].install.push({ ...lead, _barStart: d === 0, _barEnd: d === days - 1 });
        }
      }
    });
    scDots.forEach((sc) => {
      if (!sc.scheduled_date) return;
      const key = sc.scheduled_date.split("T")[0];
      if (!map[key]) map[key] = { install: [], sc: [] };
      map[key].sc.push(sc);
    });
    return map;
  }, [dots, scDots]);

  const weeks = useMemo(() => {
    const result = [];
    let week = Array(monthDays[0].getDay()).fill(null);
    monthDays.forEach((day) => {
      week.push(day);
      if (week.length === 7) { result.push([...week]); week = []; }
    });
    if (week.length > 0) {
      while (week.length < 7) week.push(null);
      result.push(week);
    }
    return result;
  }, [monthDays]);

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
      const startEntry = groupedByDate[formatDateKey(week[colStart])]?.install.find(l => l.id === leadEntry.id);
      const endEntry = groupedByDate[formatDateKey(week[colEnd])]?.install.find(l => l.id === leadEntry.id);
      return {
        id: leadEntry.id,
        lead: leadEntry,
        colStart, colEnd,
        colSpan: colEnd - colStart + 1,
        roundLeft: startEntry?._barStart || false,
        roundRight: endEntry?._barEnd || false,
      };
    });
    bars.sort((a, b) => a.colStart - b.colStart);
    const rowEndCols = [];
    bars.forEach((bar) => {
      let rowIdx = rowEndCols.findIndex(e => e < bar.colStart);
      if (rowIdx === -1) rowIdx = rowEndCols.length;
      rowEndCols[rowIdx] = bar.colEnd;
      bar.rowIdx = rowIdx;
    });
    return bars;
  };

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
      setStartDate(key);
      setDayViewDate(key);
      return;
    }
    if (!startDate || (startDate && endDate)) {
      setStartDate(key);
      setEndDate(null);
      setDayViewDate(key);
    } else {
      if (key < startDate) {
        setStartDate(key);
        setEndDate(null);
      } else if (key === startDate) {
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
    const finalEnd = allowTentative ? (endDate || startDate) : null;
    const duration = allowTentative && finalEnd ? daysBetween(finalStart, finalEnd) : 1;
    onConfirm(finalStart, tentative, Math.max(1, duration), finalEnd);
    onClose();
  };

  const handleRemove = () => {
    if (onRemove) onRemove();
    onClose();
  };

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

  // ── Shared JSX pieces ────────────────────────────────────────────────────

  const headerBlock = (
    <>
      <h2 className="text-lg font-semibold mb-3 text-gray-800 text-center pr-6">{label}</h2>

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

      <div className="text-center text-sm font-semibold text-blue-700 mb-2 min-h-[20px]">
        {displayText}
      </div>
    </>
  );

  const calendarBlock = (
    <>
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
      <div className="text-xs">
        {weeks.map((week, wIdx) => {
          const weekBars = getWeekBars(week);
          const barRowCount = weekBars.length > 0 ? Math.max(...weekBars.map(b => b.rowIdx)) + 1 : 0;
          const barAreaHeight = barRowCount * 28;
          return (
            <div key={wIdx} className="mb-0.5">
              <div className="grid grid-cols-7 gap-x-2 text-center">
                {week.map((day, dIdx) => {
                  if (!day) return <div key={`e-${wIdx}-${dIdx}`} className="min-h-[32px]" />;
                  const key = formatDateKey(day);
                  const isToday = key === formatDateKey(today);
                  const isStart = key === startDate;
                  const isEnd = allowTentative && key === endDate;
                  const inRange = allowTentative && startDate && endDate && key > startDate && key < endDate;
                  let cellClass = "rounded cursor-pointer py-1 flex items-center justify-center min-h-[32px] font-medium transition-colors ";
                  if (isStart || isEnd) cellClass += "bg-green-700 text-white";
                  else if (inRange) cellClass += "bg-green-100 text-green-900";
                  else if (isToday) cellClass += "bg-blue-100 text-blue-800";
                  else cellClass += "hover:bg-gray-100 text-gray-800";
                  const hasSc = (groupedByDate[key]?.sc || []).length > 0;
                  return (
                    <div key={key} onClick={() => handleDayClick(key)} className={`${cellClass} relative flex-col gap-0`}>
                      {day.getDate()}
                      {hasSc && (
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-400 absolute bottom-0.5" />
                      )}
                    </div>
                  );
                })}
              </div>
              {barAreaHeight > 0 && (
                <div className="relative grid grid-cols-7 gap-x-2 mt-0.5" style={{ height: `${barAreaHeight}px` }}>
                  {weekBars.map((bar) => {
                    const roundClass = bar.roundLeft && bar.roundRight ? "rounded" : bar.roundLeft ? "rounded-l" : bar.roundRight ? "rounded-r" : "";
                    const bgColor = bar.lead.installTentative ? "bg-green-700" : "bg-green-500";
                    return (
                      <div
                        key={bar.id}
                        onClick={() => setDayViewDate(formatDateKey(week[bar.colStart]))}
                        className={`absolute h-6 ${bgColor} ${roundClass} cursor-pointer hover:opacity-80 overflow-hidden flex items-center px-1`}
                        style={{ left: modalBarLeftCalc(bar.colStart), width: modalBarWidthCalc(bar.colSpan), top: `${bar.rowIdx * 28}px` }}
                      >
                        <span className="text-white text-xs font-semibold truncate leading-none">{bar.lead.name}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );

  const dayDetailBlock = dayViewDate && (
    (groupedByDate[dayViewDate]?.install?.length > 0 || groupedByDate[dayViewDate]?.sc?.length > 0)
  ) && (
    <div className="mt-3 border-t pt-2">
      <div className="text-xs font-semibold text-gray-600 mb-1">{formatDisplayDate(dayViewDate)}</div>
      <div className="space-y-1 max-h-28 overflow-y-auto">
        {(groupedByDate[dayViewDate].install || [])
          .filter((l, i, arr) => arr.findIndex(x => x.id === l.id) === i)
          .map((lead, i) => (
            <div key={`di-${i}`} className="flex items-center gap-1 text-xs text-gray-700">
              <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
              <span>Install{lead.installTentative ? " (Tentative)" : ""} — {lead.name}</span>
            </div>
          ))}
        {(groupedByDate[dayViewDate].sc || []).map((sc, i) => (
          <div key={`sc-${i}`} className="flex items-center gap-1 text-xs text-gray-700">
            <span className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0" />
            <span>SC — {sc.lead_name}{sc.title ? ` · ${sc.title}` : ""}{sc.scheduled_time ? ` @ ${formatTime12h(sc.scheduled_time)}` : ""}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const buttonBlock = (
    <div className="flex justify-between mt-4 gap-2">
      <button
        onClick={handleRemove}
        className="px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
      >
        Clear Date
      </button>
      <div className="flex gap-2">
        <button onClick={onClose} className="px-3 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-sm">
          Exit
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
  );

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 overflow-y-auto"
      onClick={onClose}
    >
      <div className={`flex min-h-full items-center justify-center ${isLandscape ? "p-2" : "p-4"}`}>
      <div
        className={`bg-white rounded-lg shadow-xl w-full relative ${
          isLandscape ? "max-w-5xl flex flex-row" : "max-w-3xl"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* X close button */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 text-gray-500 hover:text-gray-800 text-2xl font-bold leading-none"
        >
          ×
        </button>

        {isLandscape ? (
          <>
            {/* LEFT column: calendar */}
            <div className="flex-1 min-w-0 p-4 border-r border-gray-200">
              {calendarBlock}
            </div>
            {/* RIGHT column: header + date info + day detail + buttons */}
            <div className="w-64 flex-shrink-0 p-4 flex flex-col justify-between">
              <div>
                {headerBlock}
                {dayDetailBlock}
              </div>
              {buttonBlock}
            </div>
          </>
        ) : (
          /* Portrait: title → tentative → date display → calendar → day detail → buttons */
          <div className="p-5">
            {headerBlock}
            {calendarBlock}
            {dayDetailBlock}
            {buttonBlock}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
