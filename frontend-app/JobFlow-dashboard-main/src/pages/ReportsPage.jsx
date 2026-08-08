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

function AutomationRecoveryContent({ companyId }) {
  const [range, setRange] = useState("30");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  function load(r, start, end) {
    setLoading(true);
    setError(null);
    let url = `/api/reports/automation-recovery?range=${r}`;
    if (companyId) url += `&company_id=${companyId}`;
    if (r === "custom" && start && end) url += `&start=${start}&end=${end}`;
    apiRequest(url)
      .then((r) => { setData(r); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }

  useEffect(() => { load("30"); }, [companyId]);

  function handleRangeClick(r) {
    setRange(r);
    if (r !== "custom") load(r);
  }

  function handleCustomApply() {
    if (customStart && customEnd) load("custom", customStart, customEnd);
  }

  const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString() : "—";
  const fmtMoney = (v) => v == null ? "—" : `$${parseFloat(v).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const RANGES = [
    { key: "30", label: "30 Days" },
    { key: "90", label: "90 Days" },
    { key: "ytd", label: "YTD" },
    { key: "custom", label: "Custom" },
  ];

  const m = data?.metrics;

  return (
    <div>
      <p className="text-xs text-gray-500 mb-3">
        <strong>Period Summary</strong> shows leads that came in and jobs that closed during the selected window. Leads received uses the date the lead entered the system; everything else is filtered by sold date. <strong>Not Sold Recoveries</strong> counts leads that were marked Not Sold at some point but later came back and closed — these are included in the closed totals above.
      </p>

      {/* Range selector */}
      <div className="flex gap-1.5 mb-3 flex-wrap">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => handleRangeClick(r.key)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              range === r.key
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
      {range === "custom" && (
        <div className="flex gap-2 items-center mb-3 flex-wrap">
          <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
            className="border border-gray-300 rounded-lg px-2 py-1 text-xs" />
          <span className="text-xs text-gray-500">to</span>
          <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
            className="border border-gray-300 rounded-lg px-2 py-1 text-xs" />
          <button onClick={handleCustomApply}
            className="px-3 py-1 bg-blue-600 text-white rounded-full text-xs font-medium">
            Apply
          </button>
        </div>
      )}

      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}

      {!loading && !error && m && (
        <>
          {/* Period Summary */}
          <SectionCard title="Period Summary">
            <MetricRow label="Leads Received" value={m.leadsReceived} />
            <MetricRow label="Jobs Closed" value={m.totalSold} />
            <MetricRow
              label="Revenue Closed"
              value={fmtMoney(m.totalRevenue)}
              sub={m.avgDaysToClose != null ? `Avg ${m.avgDaysToClose} days lead to close` : undefined}
            />
          </SectionCard>

          {/* Not Sold Recoveries */}
          <SectionCard title="Not Sold Recoveries">
            <MetricRow
              label="Recovered &amp; Closed"
              value={m.recoveryTotal}
              sub={m.avgDaysRecovery != null ? `Avg ${m.avgDaysRecovery} days from Not Sold to close` : undefined}
            />
            <MetricRow label="Revenue Recovered" value={m.recoveryRevenue > 0 ? fmtMoney(m.recoveryRevenue) : "—"} />
          </SectionCard>

          {/* Closed jobs detail */}
          <div className="mb-3">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Closed Jobs Detail</div>
            {data.soldLeads.length === 0 ? (
              <p className="text-sm text-gray-400 italic py-1">No closed jobs in this range.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">Contact</th>
                      <th className="text-left px-3 py-2 font-semibold">Source</th>
                      <th className="text-left px-3 py-2 font-semibold">Lead Date</th>
                      <th className="text-left px-3 py-2 font-semibold">Sold Date</th>
                      <th className="text-right px-3 py-2 font-semibold">Days</th>
                      <th className="text-right px-3 py-2 font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.soldLeads.map((r, i) => (
                      <tr key={i} className="bg-white">
                        <td className="px-3 py-2 font-medium text-gray-800">{r.fullName || "—"}</td>
                        <td className="px-3 py-2 text-gray-500">{r.leadSource || "—"}</td>
                        <td className="px-3 py-2 text-gray-500">{fmtDate(r.enteredLeadAt)}</td>
                        <td className="px-3 py-2 text-gray-500">{fmtDate(r.soldAt)}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{r.daysToSold ?? "—"}</td>
                        <td className="px-3 py-2 text-right font-medium text-green-700">
                          {r.contractPrice != null ? fmtMoney(r.contractPrice) : <span className="text-gray-400">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recovery detail */}
          <div className="mb-3">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Not Sold Recovery Detail</div>
            {data.recoveredLeads.length === 0 ? (
              <p className="text-sm text-gray-400 italic py-1">No Not Sold recoveries in this range.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">Contact</th>
                      <th className="text-left px-3 py-2 font-semibold">Source</th>
                      <th className="text-left px-3 py-2 font-semibold">Entered Not Sold</th>
                      <th className="text-left px-3 py-2 font-semibold">Sold Date</th>
                      <th className="text-right px-3 py-2 font-semibold">Days</th>
                      <th className="text-right px-3 py-2 font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.recoveredLeads.map((r, i) => (
                      <tr key={i} className="bg-white">
                        <td className="px-3 py-2 font-medium text-gray-800">{r.fullName || "—"}</td>
                        <td className="px-3 py-2 text-gray-500">{r.leadSource || "—"}</td>
                        <td className="px-3 py-2 text-gray-500">{fmtDate(r.enteredNotSoldAt)}</td>
                        <td className="px-3 py-2 text-gray-500">{fmtDate(r.soldAt)}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{r.daysToSold ?? "—"}</td>
                        <td className="px-3 py-2 text-right font-medium text-green-700">
                          {r.contractPrice != null ? fmtMoney(r.contractPrice) : <span className="text-gray-400">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ConversionsBySourceContent({ companyId }) {
  const [range, setRange] = useState("90");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  function load(r, start, end) {
    setLoading(true);
    setError(null);
    let url = `/api/reports/conversions-by-source?range=${r}`;
    if (companyId) url += `&company_id=${companyId}`;
    if (r === "custom" && start && end) url += `&start=${start}&end=${end}`;
    apiRequest(url)
      .then((r) => { setData(r); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }

  useEffect(() => { load("90"); }, [companyId]);

  function handleRangeClick(r) {
    setRange(r);
    if (r !== "custom") load(r);
  }

  function handleCustomApply() {
    if (customStart && customEnd) load("custom", customStart, customEnd);
  }

  const fmtPct = (v) => v != null ? `${v}%` : "—";
  const fmtDays = (v) => v != null ? `${v}d` : "—";

  const RANGES = [
    { key: "30", label: "30 Days" },
    { key: "60", label: "60 Days" },
    { key: "90", label: "90 Days" },
    { key: "custom", label: "Custom" },
  ];

  return (
    <div>
      <p className="text-xs text-gray-500 mb-3">
        Leads grouped by UTM source, tracked through the full sales funnel. Leads with no UTM source are grouped as "organic". Junk leads excluded.
      </p>

      <div className="flex gap-1.5 mb-3 flex-wrap">
        {RANGES.map((r) => (
          <button key={r.key} onClick={() => handleRangeClick(r.key)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              range === r.key ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            }`}>
            {r.label}
          </button>
        ))}
      </div>
      {range === "custom" && (
        <div className="flex gap-2 items-center mb-3 flex-wrap">
          <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
            className="border border-gray-300 rounded-lg px-2 py-1 text-xs" />
          <span className="text-xs text-gray-500">to</span>
          <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
            className="border border-gray-300 rounded-lg px-2 py-1 text-xs" />
          <button onClick={handleCustomApply}
            className="px-3 py-1 bg-blue-600 text-white rounded-full text-xs font-medium">Apply</button>
        </div>
      )}

      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}

      {!loading && !error && data && (
        data.rows.length === 0 ? (
          <p className="text-sm text-gray-400 italic py-4">No lead data in this date range.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Source</th>
                  <th className="text-right px-3 py-2 font-semibold">Leads</th>
                  <th className="text-right px-3 py-2 font-semibold">Appts</th>
                  <th className="text-right px-3 py-2 font-semibold">Appt%</th>
                  <th className="text-right px-3 py-2 font-semibold">Sold</th>
                  <th className="text-right px-3 py-2 font-semibold">Lead→Sold%</th>
                  <th className="text-right px-3 py-2 font-semibold">Appt→Sold%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.rows.map((r, i) => (
                  <tr key={i} className="bg-white">
                    <td className="px-3 py-2 font-medium text-gray-800 capitalize">{r.source}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{r.totalLeads}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{r.apptsSet}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{fmtPct(r.apptRate)}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{r.sold}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{fmtPct(r.leadToSoldPct)}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{fmtPct(r.apptToSoldPct)}</td>
                  </tr>
                ))}
                {data.totals && (
                  <tr className="bg-gray-50 font-semibold border-t-2 border-gray-300">
                    <td className="px-3 py-2 text-gray-900">Totals</td>
                    <td className="px-3 py-2 text-right text-gray-900">{data.totals.totalLeads}</td>
                    <td className="px-3 py-2 text-right text-gray-900">{data.totals.apptsSet}</td>
                    <td className="px-3 py-2 text-right text-gray-900">{fmtPct(data.totals.apptRate)}</td>
                    <td className="px-3 py-2 text-right text-gray-900">{data.totals.sold}</td>
                    <td className="px-3 py-2 text-right text-gray-900">{fmtPct(data.totals.leadToSoldPct)}</td>
                    <td className="px-3 py-2 text-right text-gray-900">{fmtPct(data.totals.apptToSoldPct)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}

function CostPerSaleContent({ companyId }) {
  const [range, setRange] = useState("90");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingCpls, setEditingCpls] = useState(false);
  const [cplSources, setCplSources] = useState([]);
  const [cplLoading, setCplLoading] = useState(false);
  const [cplSaving, setCplSaving] = useState(false);

  function load(r, start, end) {
    setLoading(true);
    setError(null);
    let url = `/api/reports/cost-per-sale?range=${r}`;
    if (companyId) url += `&company_id=${companyId}`;
    if (r === "custom" && start && end) url += `&start=${start}&end=${end}`;
    apiRequest(url)
      .then((r) => { setData(r); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }

  useEffect(() => { load("90"); }, [companyId]);

  function handleRangeClick(r) {
    setRange(r);
    if (r !== "custom") load(r);
  }

  function handleCustomApply() {
    if (customStart && customEnd) load("custom", customStart, customEnd);
  }

  function openCplEditor() {
    setCplLoading(true);
    setEditingCpls(true);
    let url = "/api/reports/source-cpls";
    if (companyId) url += `?company_id=${companyId}`;
    apiRequest(url)
      .then((r) => { setCplSources(r.sources); setCplLoading(false); })
      .catch(() => setCplLoading(false));
  }

  function saveCpls() {
    setCplSaving(true);
    const qs = companyId ? `?company_id=${companyId}` : "";
    apiRequest(`/api/reports/source-cpls${qs}`, {
      method: "PUT",
      body: JSON.stringify({ cpls: cplSources.map((s) => ({ source: s.source, cpl: parseFloat(s.cpl) || 0 })) }),
    })
      .then(() => {
        setCplSaving(false);
        setEditingCpls(false);
        load(range, customStart, customEnd);
      })
      .catch(() => setCplSaving(false));
  }

  const fmtMoney = (v) =>
    v == null ? "—" : `$${parseFloat(v).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const fmtPct = (v) => v != null ? `${v}%` : "—";

  const RANGES = [
    { key: "30", label: "30 Days" },
    { key: "60", label: "60 Days" },
    { key: "90", label: "90 Days" },
    { key: "custom", label: "Custom" },
  ];

  return (
    <div>
      <p className="text-xs text-gray-500 mb-3">
        Enter your cost per lead for each UTM source. Sold jobs without a contract price are excluded from revenue calculations.
      </p>

      <div className="flex gap-1.5 mb-3 flex-wrap">
        {RANGES.map((r) => (
          <button key={r.key} onClick={() => handleRangeClick(r.key)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              range === r.key ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            }`}>
            {r.label}
          </button>
        ))}
      </div>
      {range === "custom" && (
        <div className="flex gap-2 items-center mb-3 flex-wrap">
          <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
            className="border border-gray-300 rounded-lg px-2 py-1 text-xs" />
          <span className="text-xs text-gray-500">to</span>
          <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
            className="border border-gray-300 rounded-lg px-2 py-1 text-xs" />
          <button onClick={handleCustomApply}
            className="px-3 py-1 bg-blue-600 text-white rounded-full text-xs font-medium">Apply</button>
        </div>
      )}

      {!editingCpls && (
        <button onClick={openCplEditor}
          className="mb-3 px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50">
          Edit CPL Settings
        </button>
      )}

      {editingCpls && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-2">CPL Settings</div>
          {cplLoading ? <Spinner /> : (
            <>
              <p className="text-xs text-gray-500 mb-3">Enter your average cost per lead for each source. Leave at $0 for organic or untracked sources.</p>
              <div className="space-y-2 mb-3">
                {cplSources.map((s, i) => (
                  <div key={s.source} className="flex items-center gap-3">
                    <span className="text-xs font-medium text-gray-700 w-28 capitalize">{s.source}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500">$</span>
                      <input
                        type="text" inputMode="decimal" value={s.cpl}
                        onChange={(e) => {
                          const updated = [...cplSources];
                          updated[i] = { ...s, cpl: e.target.value };
                          setCplSources(updated);
                        }}
                        className="border border-gray-300 rounded-lg px-2 py-1 text-xs w-24"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={saveCpls} disabled={cplSaving}
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium disabled:opacity-50">
                  {cplSaving ? "Saving..." : "Save"}
                </button>
                <button onClick={() => setEditingCpls(false)}
                  className="px-4 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700">
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}

      {!loading && !error && data && (
        data.rows.length === 0 ? (
          <p className="text-sm text-gray-400 italic py-4">No lead data in this date range.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Source</th>
                  <th className="text-right px-3 py-2 font-semibold">CPL</th>
                  <th className="text-right px-3 py-2 font-semibold">Leads</th>
                  <th className="text-right px-3 py-2 font-semibold">Ad Spend</th>
                  <th className="text-right px-3 py-2 font-semibold">Sold w/Price</th>
                  <th className="text-right px-3 py-2 font-semibold">Avg Contract</th>
                  <th className="text-right px-3 py-2 font-semibold">Revenue</th>
                  <th className="text-right px-3 py-2 font-semibold">Cost/Sale</th>
                  <th className="text-right px-3 py-2 font-semibold">Ad Cost%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.rows.map((r, i) => (
                  <tr key={i} className="bg-white">
                    <td className="px-3 py-2 font-medium text-gray-800 capitalize">{r.source}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{fmtMoney(r.cpl)}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{r.totalLeads}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{fmtMoney(r.totalAdSpend)}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{r.soldWithPrice}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{fmtMoney(r.avgContractPrice)}</td>
                    <td className="px-3 py-2 text-right text-green-700 font-medium">{fmtMoney(r.totalRevenue)}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{fmtMoney(r.costPerSale)}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{fmtPct(r.adCostPctOfRevenue)}</td>
                  </tr>
                ))}
                {data.totals && (
                  <tr className="bg-gray-50 font-semibold border-t-2 border-gray-300">
                    <td className="px-3 py-2 text-gray-900">Totals</td>
                    <td className="px-3 py-2 text-right text-gray-400">—</td>
                    <td className="px-3 py-2 text-right text-gray-900">{data.totals.totalLeads}</td>
                    <td className="px-3 py-2 text-right text-gray-900">{fmtMoney(data.totals.totalAdSpend)}</td>
                    <td className="px-3 py-2 text-right text-gray-900">{data.totals.soldWithPrice}</td>
                    <td className="px-3 py-2 text-right text-gray-900">{fmtMoney(data.totals.avgContractPrice)}</td>
                    <td className="px-3 py-2 text-right text-green-700">{fmtMoney(data.totals.totalRevenue)}</td>
                    <td className="px-3 py-2 text-right text-gray-900">{fmtMoney(data.totals.costPerSale)}</td>
                    <td className="px-3 py-2 text-right text-gray-900">{fmtPct(data.totals.adCostPctOfRevenue)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}

// ─── report modal wrapper ────────────────────────────────────────────────────

const REPORT_CONTENT = {
  automation_recovery: AutomationRecoveryContent,
  conversions_by_source: ConversionsBySourceContent,
  cost_per_sale: CostPerSaleContent,
};

function ReportModal({ report, companyId, onClose }) {
  const Content = REPORT_CONTENT[report.key];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-16 px-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl max-h-[75vh] flex flex-col">
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
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-4">
        <h1 className="text-xl font-bold text-gray-900">Reports</h1>
        {currentCompany && (
          <p className="text-xs text-gray-500 mt-0.5">{currentCompany.name || currentCompany.company_name}</p>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-4">
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
