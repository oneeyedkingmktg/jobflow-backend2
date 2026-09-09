// LeadTabs.jsx — section-grouped tabs, mobile-first
import React, { useState } from "react";
import { useAuth } from "../AuthContext";
import UpgradeModal from "../components/UpgradeModal";

export default function LeadTabs({
  activeTab,
  setActiveTab,
  counts,
  onAddLead,
  isMasterAdmin,
  jobsEnabled,
}) {
  const { user } = useAuth();
  const isEstimatorOnly = user?.planType === 'estimator_only';
  const [showUpgrade, setShowUpgrade] = useState(false);

  const lockedSet = new Set([
    "Leads", "Customers", "Pending", "Booked Appt", "Sold",
    "Not Sold", "Completed", "Calendar", "Deleted",
  ]);

  const handleClick = (t) => {
    if (isEstimatorOnly && lockedSet.has(t)) { setShowUpgrade(true); return; }
    if (t === "+ Pre-Lead") { onAddLead(); return; }
    setActiveTab(t);
  };

  const Tab = ({ t }) => {
    const isActive = activeTab === t;
    const isLocked = isEstimatorOnly && lockedSet.has(t);
    const count = counts?.[t];
    return (
      <button
        onClick={() => handleClick(t)}
        className={`rounded-xl px-4 py-2.5 text-sm font-semibold shadow transition
          ${isLocked
            ? "bg-gray-100 text-gray-400 border border-gray-200"
            : isActive
            ? "bg-blue-600 text-white"
            : "bg-white text-gray-800 border border-gray-200 hover:border-blue-300"
          }`}
      >
        {isLocked ? "🔒 " : ""}{t}
        {!isLocked && count !== undefined && (
          <span className={`ml-1.5 text-xs font-bold px-1.5 py-0.5 rounded-full ${
            isActive ? "bg-white/25 text-white" : "bg-gray-100 text-gray-600"
          }`}>
            {count}
          </span>
        )}
      </button>
    );
  };

  const ScrollRow = ({ label, tabs, labelColor = "text-gray-400" }) => (
    <div>
      {label && (
        <div className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 px-0.5 ${labelColor}`}>
          {label}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => <Tab key={t} t={t} />)}
      </div>
    </div>
  );

  const utilityTabs = [
    "Calendar",
    ...(isMasterAdmin ? ["Deleted"] : []),
  ];

  if (jobsEnabled) {
    return (
      <>
        {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
        <div className="max-w-7xl mx-auto px-4 py-3 space-y-3">
          <ScrollRow
            label="Contacts"
            labelColor="text-teal-600"
            tabs={["Pre-Leads", "Leads", "Customers", "+ Pre-Lead"]}
          />
          <ScrollRow
            label="Projects"
            labelColor="text-indigo-500"
            tabs={["Pending", "Booked Appt", "Sold", "Not Sold", "Completed"]}
          />
          <ScrollRow tabs={utilityTabs} />
        </div>
      </>
    );
  }

  // Non-jobs mode: single row
  return (
    <>
      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {[
            "Pre-Leads", "Leads", "+ Pre-Lead",
            "Booked Appt", "Sold", "Not Sold", "Completed",
            "Calendar",
            ...(isMasterAdmin ? ["Deleted"] : []),
          ].map((t) => <Tab key={t} t={t} />)}
        </div>
      </div>
    </>
  );
}
