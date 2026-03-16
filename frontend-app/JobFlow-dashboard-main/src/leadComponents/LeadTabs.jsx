// LeadTabs.jsx – FIXED so non-status tabs do NOT require counts
import React, { useState } from "react";
import { useAuth } from "../AuthContext";
import UpgradeModal from "../components/UpgradeModal";

export default function LeadTabs({
  activeTab,
  setActiveTab,
  counts,
  onAddLead,
  onRefresh,
  isMasterAdmin,
}) {
  const { user } = useAuth();
  const isEstimatorOnly = user?.planType === 'estimator_only';
  const [showUpgrade, setShowUpgrade] = useState(false);

  const tabs = [
    "Pre-Leads",
    "Leads",
    "Booked Appt",
    "Sold",
    "Not Sold",
    "Completed",
    "All",
    ...(isMasterAdmin ? ["Deleted"] : []),
    "+ Pre-Lead",
    "Calendar",
    "Sync Contacts",
  ];

  const lockedTabs = ["Leads", "Booked Appt", "Sold", "Not Sold", "Completed", "All", "Calendar", "Sync Contacts", "Deleted"];

  const isStatusTab = (t) =>
    [
      "Pre-Leads",
      "Leads",
      "Booked Appt",
      "Sold",
      "Not Sold",
      "Completed",
      "All",
      "Deleted",
    ].includes(t);

  const handleClick = (t) => {
    if (isEstimatorOnly && lockedTabs.includes(t)) {
      setShowUpgrade(true);
      return;
    }

    if (t === "+ Pre-Lead") {
      onAddLead();
      return;
    }

    if (t === "Sync Contacts") {
      onRefresh();
      return;
    }

    setActiveTab(t);
  };

  return (
    <>
      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
      <div className="grid grid-cols-2 md:flex md:flex-wrap gap-3 max-w-7xl mx-auto px-4 py-4">
        {tabs.map((t) => {
          const isActive = activeTab === t;
          const isLocked = isEstimatorOnly && lockedTabs.includes(t);

          return (
            <button
              key={t}
              onClick={() => handleClick(t)}
              className={`rounded-xl px-4 py-3 shadow font-semibold text-center w-full md:w-auto
                ${isLocked
                  ? "bg-gray-100 text-gray-400 border border-gray-200 cursor-pointer"
                  : isActive
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-800 border"
                }`}
            >
              {isLocked ? "🔒 " : ""}{t}

              {/* print count ONLY for status tabs */}
              {isStatusTab(t) && counts && counts[t] !== undefined && !isLocked && (
                <span className="ml-1 opacity-80">({counts[t]})</span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}
