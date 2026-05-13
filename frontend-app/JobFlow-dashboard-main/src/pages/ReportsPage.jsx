import React, { useEffect, useState } from "react";
import { apiRequest } from "../api";
import { useCompany } from "../CompanyContext";

// ─── shared components ───────────────────────────────────────────────────────

function MetricRow({ label, value, sub }) {
  return (
    <div className="flex justify-between items-start py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="text-right">
        <span className="text-sm font-semibold text-gray-900">{value}</span>
        {sub && <div className="text-xs text-gray-400">{sub}</div>}
      </div>
    </div>
  );
}

function SectionCard({ title, children }) {
  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-3">
      <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{title}</div>
      {children}
    </div>
  );
}

function NoData() {
  return <p className="text-sm text-gray-400 italic py-1">No data yet</p>;
}

// ─── report modal contents ───────────────────────────────────────────────────

function ActivityContent({ companyId }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const url = companyId
      ? `/api/reports/activity?company_id=${companyId}`
      : "/api/reports/activity";
    apiRequest(url)
      .then((r) => { setMetrics(r.metrics); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [companyId]);

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;

  const render = (data, title) => (
    <SectionCard title={title}>
      {!data ? <NoData /> : (
        <>
          <MetricRow label="New Leads" value={data.newLeads} />
          <MetricRow label="Appointments Set" value={data.apptsSet} />
          <MetricRow label="Jobs Sold" value={data.jobsSold} />
        </>
      )}
    </SectionCard>
  );

  return (
    <div>
      <p className="text-xs text-gray-500 mb-4">Counts of events in the last 30 days. Junk leads excluded.</p>
      {render(metrics?.non_estimator, "Regular Leads")}
      {render(metrics?.estimator, "Estimator Leads")}
    </div>
  );
}

function ConversionsContent({ companyId }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const url = companyId
      ? `/api/reports/conversions?company_id=${companyId}`
      : "/api/reports/conversions";
    apiRequest(url)
      .then((r) => { setMetrics(r.metrics); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [companyId]);

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;

  const render = (data, title) => (
    <SectionCard title={title}>
      {!data || data.totalLeads === 0 ? <NoData /> : (
        <>
          <MetricRow label="Leads in this report" value={data.totalLeads} sub="created 30–60 days ago" />
          <MetricRow
            label="Lead → Appointment"
            value={`${data.leadsToAppt} (${data.leadToApptPct}%)`}
          />
          <MetricRow
            label="Appointment → Sold"
            value={`${data.apptToSold} (${data.apptToSoldPct}%)`}
          />
          <MetricRow
            label="Lead → Sold (total)"
            value={`${data.leadsToSold} (${data.leadToSoldPct}%)`}
          />
        </>
      )}
    </SectionCard>
  );

  return (
    <div>
      <p className="text-xs text-gray-500 mb-4">
        Conversion rates for leads created 30–60 days ago. Appt and sold dates recorded from first status change.
        Leads without appt_set_at data (set before this feature deployed) are excluded from sold conversion counts.
      </p>
      {render(metrics?.non_estimator, "Regular Leads")}
      {render(metrics?.estimator, "Estimator Leads")}
    </div>
  );
}

// ─── report modal wrapper ────────────────────────────────────────────────────

const REPORT_CONTENT = {
  recent_activity: ActivityContent,
  conversions: ConversionsContent,
};

function ReportModal({ report, companyId, onClose }) {
  const Content = REPORT_CONTENT[report.key];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-16 px-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl max-h-[75vh] flex flex-col">
        {/* header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{report.name}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{report.description}</p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>
        {/* scrollable body */}
        <div className="overflow-y-auto px-5 py-4 flex-1">
          {Content ? (
            <Content companyId={companyId} />
          ) : (
            <p className="text-sm text-gray-500">Report not available.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── small helpers ───────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex justify-center py-10">
      <div className="animate-spin rounded-full h-7 w-7 border-4 border-blue-500 border-t-transparent" />
    </div>
  );
}

function ErrorMsg({ msg }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
      {msg}
    </div>
  );
}

// ─── main page ───────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { currentCompany } = useCompany();
  const [definitions, setDefinitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openReport, setOpenReport] = useState(null);

  useEffect(() => {
    apiRequest("/api/reports/definitions")
      .then((r) => { setDefinitions(r.reports); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-xl font-bold text-gray-900">Reports</h1>
        {currentCompany && (
          <p className="text-xs text-gray-500 mt-0.5">{currentCompany.name || currentCompany.company_name}</p>
        )}
      </div>

      <div className="px-4">
        {loading && <Spinner />}
        {error && <ErrorMsg msg={error} />}
        {!loading && !error && definitions.length === 0 && (
          <p className="text-sm text-gray-500 py-10 text-center">No reports available.</p>
        )}
        {!loading && !error && definitions.map((report) => (
          <button
            key={report.key}
            onClick={() => setOpenReport(report)}
            className="w-full text-left bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 mb-3 active:bg-gray-50"
          >
            <div className="text-base font-semibold text-gray-900">{report.name}</div>
            <div className="text-sm text-gray-500 mt-0.5">{report.description}</div>
            <div className="text-xs text-blue-600 mt-2 font-medium">View report →</div>
          </button>
        ))}
      </div>

      {openReport && (
        <ReportModal
          report={openReport}
          companyId={currentCompany?.id}
          onClose={() => setOpenReport(null)}
        />
      )}
    </div>
  );
}
