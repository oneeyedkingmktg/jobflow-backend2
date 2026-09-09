// LeadTabs.jsx — section-grouped scrollable tabs, mobile-first
import React, { useState } from "react";
import { useAuth } from "../AuthContext";
import { usePermission } from "../utils/usePermission";
import UpgradeModal from "../components/UpgradeModal";

export default function LeadTabs({
  activeTab,
  setActiveTab,
  counts,
  onAddLead,
  onRefresh,
  onJobReports,
  isMasterAdmin,
  jobsEnabled,
}) {
  const { user } = useAuth();
  const isEstimatorOnly = user?.planType === 'estimator_only';
  const jobReportPerm = usePermission('job_report');
  const [showUpgrade, setShowUpgrade] = useState(false);

  const lockedSet = new Set([
    "Leads", "Customers", "Pending", "Booked Appt", "Sold",
    "Not Sold", "Completed", "All", "Calendar", "Sync Contacts", "Deleted",
  ]);

  const handleClick = (t) => {
    if (isEstimatorOnly && lockedSet.has(t)) { setShowUpgrade(true); return; }
    if (t === "+ Pre-Lead") { onAddLead(); return; }
    if (t === "Sync Contacts") { onRefresh(); return; }
    if (t === "Job Reports") { onJobReports?.(); return; }
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

  const actionTabs = [
    "+ Pre-Lead",
    "Calendar",
    "Sync Contacts",
    ...(jobReportPerm !== "hide" ? ["Job Reports"] : []),
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
            tabs={["Pre-Leads", "Leads", "Customers", "All"]}
          />
          <ScrollRow
            label="Projects"
            labelColor="text-indigo-500"
            tabs={["Pending", "Booked Appt", "Sold", "Not Sold", "Completed"]}
          />
          <ScrollRow tabs={actionTabs} />
        </div>
      </>
    );
  }

  // Non-jobs mode: single scrollable row
  return (
    <>
      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {[
            "Pre-Leads", "Leads", "Booked Appt", "Sold", "Not Sold", "Completed", "All",
            ...actionTabs,
          ].map((t) => <Tab key={t} t={t} />)}
        </div>
      </div>
    </>
  );
}
