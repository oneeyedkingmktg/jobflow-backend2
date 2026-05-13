import React, { useEffect, useState } from "react";
import { apiRequest } from "../api";

function MetricRow({ label, value }) {
  return (
    <div className="flex justify-between items-center py-3 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-semibold text-gray-900">{value}</span>
    </div>
  );
}

function CategoryCard({ title, data }) {
  if (!data) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-4">
        <h3 className="text-base font-bold text-gray-800 mb-3">{title}</h3>
        <p className="text-sm text-gray-400 italic">No data yet</p>
      </div>
    );
  }

  const fmtDays = (val) => (val != null ? `${val} days` : "—");
  const fmtPct = (val) => `${val}%`;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-4">
      <h3 className="text-base font-bold text-gray-800 mb-1">{title}</h3>
      <div className="mt-2">
        <MetricRow label="Total Leads" value={data.totalLeads} />
        <MetricRow
          label="Appointments Booked"
          value={`${data.leadsWithAppt} (${fmtPct(data.leadToApptRate)})`}
        />
        <MetricRow
          label="Avg Days: Lead to Appointment"
          value={fmtDays(data.avgLeadToApptDays)}
        />
        <MetricRow
          label="Jobs Sold from Appointments"
          value={`${data.soldLeads} (${fmtPct(data.apptToSoldRate)})`}
        />
        <MetricRow
          label="Avg Days: Appointment to Sold"
          value={fmtDays(data.avgApptToSoldDays)}
        />
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiRequest("/api/reports/lifecycle")
      .then((res) => {
        setMetrics(res.metrics);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-xl font-bold text-gray-900">Reports</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Lifecycle timing and close rates — junk leads excluded
        </p>
      </div>

      <div className="px-4">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent" />
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            Failed to load report data: {error}
          </div>
        )}

        {!loading && !error && (
          <>
            <CategoryCard title="Estimator Leads" data={metrics?.estimator} />
            <CategoryCard title="Non-Estimator Leads" data={metrics?.non_estimator} />
          </>
        )}
      </div>
    </div>
  );
}
