// === CHANGELOG vNext ===
// ✅ In List View: added "Install" or "Appointment" before the date in the colored tab
// ✅ Maintains all layout and prior logic exactly

import React, { useState, useMemo } from "react";
import { formatDate, formatTime } from "./utils/formatting.js";

export default function CalendarView({ leads, onSelectLead }) {
  const [viewMode, setViewMode] = useState("month");
  const [selectedDate, setSelectedDate] = useState(null);
  
  // Add state for navigating months
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

  // Navigation functions
  const goToPreviousMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const getMonthName = () => {
    const date = new Date(currentYear, currentMonth, 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  const formatDateKey = (date) => date.toISOString().split("T")[0];
  const formatDisplayDate = (d) => {
    if (!d) return "";
    // Treat date as yyyy-mm-dd at local midnight to avoid timezone shift
    const date = new Date(d + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime12h = (time) => {
    if (!time) return "";
    const [h, m] = time.split(":");
    let hour = parseInt(h, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12;
    return `${hour}:${m} ${ampm}`;
  };

const groupedByDate = useMemo(() => {
  const map = {};
  leads.forEach((lead) => {
    const apptKey = lead.appointmentDate;
    const installKey = lead.installDate;
    if (apptKey) {
      if (!map[apptKey]) map[apptKey] = { appt: [], install: [] };
      map[apptKey].appt.push(lead);
    }
    if (installKey) {
      if (!map[installKey]) map[installKey] = { appt: [], install: [] };
      map[installKey].install.push(lead);
    }
  });
  return map;
}, [leads]);

 const futureLeads = useMemo(() => {
  const now = new Date();
  const allLeads = [];
  
  // Collect all appointments
  leads.forEach((l) => {
    if (l.appointmentDate && new Date(l.appointmentDate) >= now) {
      allLeads.push({
        ...l,
        displayDate: l.appointmentDate,
        displayType: 'appointment'
      });
    }
  });
    
    // Collect all installs
    leads.forEach((l) => {
      if (l.installDate && new Date(l.installDate) >= now) {
        allLeads.push({
          ...l,
          displayDate: l.installDate,
          displayType: 'install'
        });
      }
    });
    
    // Sort chronologically by displayDate
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
            viewMode === "month"
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
          }`}
        >
          Month View
        </button>
        <button
          onClick={() => setViewMode("list")}
          className={`px-3 py-2 rounded font-medium border w-full sm:w-auto ${
            viewMode === "list"
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
          }`}
        >
          List View
        </button>
      </div>

      {/* Compact Month Navigation */}
      <div className="flex items-center justify-between mb-3 bg-white rounded border border-gray-300 px-2 py-2">
        <button
          onClick={goToPreviousMonth}
          className="p-1 hover:bg-gray-100 rounded transition-colors active:scale-95 text-gray-700"
          aria-label="Previous month"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <span className="text-sm font-medium text-gray-700">{getMonthName()}</span>
        
        <button
          onClick={goToNextMonth}
          className="p-1 hover:bg-gray-100 rounded transition-colors active:scale-95 text-gray-700"
          aria-label="Next month"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2 text-center text-xs sm:text-sm">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="font-semibold">
            {d}
          </div>
        ))}
      </div>

<div className="grid grid-cols-7 gap-2 text-center text-xs sm:text-sm mt-1">
  {/* Add empty cells for days before the 1st */}
  {Array(monthDays[0].getDay())
    .fill(null)
    .map((_, i) => (
      <div key={`empty-${i}`} className="min-h-[70px]" />
    ))}
  
  {monthDays.map((day) => {
    const key = formatDateKey(day);
    const data = groupedByDate[key] || { appt: [], install: [] };
    const apptCount = data.appt.length;
    const installCount = data.install.length;
    const isToday = key === formatDateKey(today);

    return (
      <div
        key={key}
        onClick={() => handleDayClick(key)}
        className={`border rounded-md p-2 min-h-[70px] cursor-pointer hover:bg-blue-50 flex flex-col items-center justify-between ${
          isToday ? "border-blue-500 bg-blue-100" : "border-gray-300"
        }`}
      >
              <div className="font-semibold">{day.getDate()}</div>
              <div className="flex flex-col items-center mt-1">
                {apptCount > 0 && (
                  <div className="flex gap-1">
                    {Array(apptCount)
                      .fill(0)
                      .map((_, i) => (
                        <div
                          key={`a-${i}`}
                          className="w-2 h-2 bg-blue-500 rounded-full"
                        />
                      ))}
                  </div>
                )}
                {installCount > 0 && (
                  <div className="flex gap-1 mt-1">
                    {Array(installCount)
                      .fill(0)
                      .map((_, i) => (
                        <div
                          key={`i-${i}`}
                          className="w-2 h-2 bg-green-500 rounded-full"
                        />
                      ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ========= List View =========
  const ListView = () => (
    <div>
      <div className="grid grid-cols-2 gap-2 mb-3 sm:flex sm:gap-4">
        <button
          onClick={() => setViewMode("month")}
          className={`px-3 py-2 rounded font-medium border w-full sm:w-auto ${
            viewMode === "month"
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
          }`}
        >
          Month View
        </button>
        <button
          onClick={() => setViewMode("list")}
          className={`px-3 py-2 rounded font-medium border w-full sm:w-auto ${
            viewMode === "list"
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
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
            const isInstall = lead.displayType === 'install';
            const isAppt = lead.displayType === 'appointment';
            const barColor = isInstall ? "bg-green-500" : "bg-blue-500";
            const labelType = isInstall ? "Install" : "Appointment";
            const labelDate = formatDisplayDate(lead.displayDate);

            return (
              <div
                key={idx}
                onClick={() => handleLeadClick(lead, "list")}
                className="border rounded-md hover:bg-gray-50 cursor-pointer overflow-hidden"
              >
                {/* color-coded top bar with label + date */}
                <div
                  className={`${barColor} text-white text-sm font-semibold h-8 flex items-center justify-center rounded-t-md`}
                >
                  {`${labelType} — ${labelDate}`}
                </div>

                <div className="px-3 pb-3 pt-2 text-sm">
                  <div className="flex justify-between flex-wrap">
                    <div className="flex-1">
                      <span className="font-semibold">
                        {lead.name}
                        {lead.projectType ? ` — ${lead.projectType}` : ""}
                      </span>
                      {lead.buyerType && lead.buyerType !== "Residential" && lead.companyName && (
                        <div className="text-xs text-gray-700 font-semibold mt-0.5">
                          {lead.companyName}
                        </div>
                      )}
                    </div>
                    <span className="text-gray-600">
                      {lead.city}, {lead.state}
                    </span>
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

    return (
      <div>
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => {
              setSelectedDate(null);
              setViewMode("month");
            }}
            className="px-2 py-1 bg-gray-200 text-sm rounded hover:bg-gray-300"
          >
            ← Back
          </button>
          <div className="text-lg font-semibold">
            {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </div>
        </div>

        {!hasAny && <p className="text-gray-500 italic">No events for this day.</p>}

        <div className="space-y-3">
          {[...data.install, ...data.appt].map((lead, i) => {
const isInstall = !!lead.installDate && lead.installDate === selectedDate;
const isAppt = !!lead.appointmentDate && lead.appointmentDate === selectedDate;
            const barColor = isInstall ? "bg-green-500" : isAppt ? "bg-blue-500" : "bg-gray-300";
            const label = isInstall ? "Install" : isAppt ? "Appointment" : "";

            return (
              <div
                key={i}
                onClick={() => handleLeadClick(lead, "day", selectedDate)}
                className="border rounded-md hover:bg-gray-50 cursor-pointer overflow-hidden"
              >
                <div
                  className={`${barColor} text-white text-sm font-semibold h-8 flex items-center justify-center rounded-t-md`}
                >
                  {label}
                </div>

                <div className="px-3 pb-3 pt-2 flex justify-between text-sm">
                  <div className="flex-1">
                    <span className="font-semibold">
                      {lead.name}
                      {lead.projectType ? ` — ${lead.projectType}` : ""}
                    </span>
                    {lead.buyerType && lead.buyerType !== "Residential" && lead.companyName && (
                      <div className="text-xs text-gray-700 font-semibold mt-0.5">
                        {lead.companyName}
                      </div>
                    )}
                  </div>
                  <span className="text-gray-600">
                    {lead.city}, {lead.state}
                  </span>
                </div>

{!isInstall && isAppt && lead.appointmentTime && (
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