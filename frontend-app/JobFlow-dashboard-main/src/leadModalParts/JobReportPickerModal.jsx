import React, { useState, useEffect, useMemo } from "react";
import { JobReportsAPI } from "../api";
import JobReportsPanel from "./JobReportsPanel";

function fmtHours(minutes) {
  if (!minutes) return "0h";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function timeSince(ts) {
  if (!ts) return "";
  const diff = Date.now() - new Date(ts).getTime();
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  return "just now";
}

export default function JobReportPickerModal({ companyId, onClose }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedLead, setSelectedLead] = useState(null);

  useEffect(() => {
    JobReportsAPI.getJobsWithLabor(companyId)
      .then((data) => setJobs(data.jobs || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [companyId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return jobs;
    const q = search.toLowerCase();
    return jobs.filter(
      (j) =>
        j.name?.toLowerCase().includes(q) ||
        j.address?.toLowerCase().includes(q) ||
        j.city?.toLowerCase().includes(q)
    );
  }, [jobs, search]);

  if (selectedLead) {
    return (
      <JobReportsPanel
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: "85vh" }}
      >
        {/* Header */}
        <div className="bg-[#1a2e5a] text-white px-5 py-4 flex items-center justify-between rounded-t-2xl shrink-0">
          <div>
            <div className="font-bold text-base">Job Reports</div>
            <div className="text-white/60 text-xs mt-0.5">Ordered by most recent labor</div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white text-2xl leading-none px-1"
          >
            ×
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pt-4 pb-2 shrink-0">
          <input
            type="text"
            placeholder="Search jobs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-gray-400 text-sm py-10">
              {search ? "No matching jobs" : "No jobs with labor recorded yet"}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">{job.name}</div>
                    <div className="text-xs text-gray-500 truncate mt-0.5">
                      {job.address}{job.city ? `, ${job.city}` : ""}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {fmtHours(job.total_minutes)} logged · {timeSince(job.last_labor_at)}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedLead(job)}
                    className="shrink-0 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition"
                  >
                    Get Report
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
