// LeadTabs.jsx – FIXED so non-status tabs do NOT require counts

import React from "react";

export default function LeadTabs({ activeTab, setActiveTab, counts, onAddLead }) {

  const tabs = [
    "Leads",
    "Booked Appt",
    "Sold",
    "Not Sold",
    "Completed",
    "All",
    "+ New Lead",
    "Calendar",
  ];

  const isStatusTab = (t) =>
    ["Leads", "Booked Appt", "Sold", "Not Sold", "Completed", "All"].includes(t);

  const handleClick = (t) => {
    if (t === "+ New Lead") {
      onAddLead();
      return;
    }
    setActiveTab(t);
  };

  return (
    <div className="grid grid-cols-2 md:flex md:flex-wrap gap-3 max-w-7xl mx-auto px-4 py-4">

      {tabs.map((t) => {
        const isActive = activeTab === t;

        return (
          <button
            key={t}
            onClick={() => handleClick(t)}
            className={`rounded-xl px-4 py-3 shadow font-semibold text-center w-full md:w-auto
              ${isActive ? "bg-blue-600 text-white" : "bg-white text-gray-800 border"} 
            `}
          >
            {t}

            {/* print count ONLY for status tabs */}
            {isStatusTab(t) && counts && counts[t] !== undefined && (
              <span className="ml-1 opacity-80">
                ({counts[t]})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
