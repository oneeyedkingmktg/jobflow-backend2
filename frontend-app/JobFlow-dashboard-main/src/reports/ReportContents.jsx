import React, { useEffect, useState } from "react";
import { apiRequest } from "../api";

// ─── shared helpers ───────────────────────────────────────────────────────────

export function MetricRow({ label, value, sub }) {
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

export function SectionCard({ title, children }) {
  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-3">
      <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{title}</div>
      {children}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex justify-center py-10">
      <div className="animate-spin rounded-full h-7 w-7 border-4 border-blue-500 border-t-transparent" />
    </div>
  );
}

export function ErrorMsg({ msg }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{msg}</div>
  );
}

export function ExpandableDetail({ label, rows, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 font-medium py-1"
      >
        <svg className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        {open ? `Hide ${label}` : `${label}${rows > 0 ? ` (${rows})` : ""}`}
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}

export function ContactLink({ id, name }) {
  function handleClick(e) {
    e.preventDefault();
    if (!id) return;
    sessionStorage.setItem("pendingOpenLeadId", String(id));
    window.__setAppScreen?.("leads");
  }
  return (
    <button onClick={handleClick} className="text-blue-600 hover:underline text-left font-medium">
      {name || "—"}
    </button>
  );
}

// ─── Automation Recovery ──────────────────────────────────────────────────────

export function AutomationRecoveryContent({ companyId }) {
  const [range, setRange] = useState("30");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  function load(r) {
    setLoading(true);
    setError(null);
    let url = `/api/reports/automation-recovery?range=${r}`;
    if (companyId) url += `&company_id=${companyId}`;
    apiRequest(url)
      .then((res) => { setData(res); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }

  useEffect(() => { load("30"); }, [companyId]);

  function handleRange(r) { setRange(r); load(r); }

  const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString() : "—";
  const fmtMoney = (v) => v == null ? "—" : `$${parseFloat(v).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const fmtMoneyOrDash = (v) => (v == null || v === 0) ? <span className="text-gray-400">—</span> : fmtMoney(v);

  const RANGES = [
    { key: "30", label: "30 Days" }, { key: "60", label: "60 Days" },
    { key: "90", label: "90 Days" }, { key: "ytd", label: "This Year" }, { key: "all", label: "All Time" },
  ];

  const m = data?.metrics;

  return (
    <div>
      <p className="text-xs text-gray-500 mb-3">
        Shows how your follow-up system converts contacts back into appointments and sales. Appointments filter by booking date. Sales filter by sold date. A sale counts in only one bucket — Not Sold Recovery takes priority over Lead Sales.
      </p>
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {RANGES.map((r) => (
          <button key={r.key} onClick={() => handleRange(r.key)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${range === r.key ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}>
            {r.label}
          </button>
        ))}
      </div>
      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}
      {!loading && !error && m && (
        <>
          <SectionCard title="Appointments">
            <MetricRow label="Total Appointments Set" value={m.totalAppts} />
            <MetricRow label="Recovered Appointments" value={m.recoveredAppts} />
            <MetricRow label="Appointment Recovery Rate" value={`${m.apptRecoveryPct}%`}
              sub={m.avgDaysAppt != null ? `Avg ${m.avgDaysAppt} days to recovery` : undefined} />
            <ExpandableDetail label="Contact Log" rows={(data.recoveredAppts || []).length}>
              {(data.recoveredAppts || []).length === 0 ? (
                <p className="text-xs text-gray-400 italic py-1">No recovered appointments in this range.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-500"><tr>
                      <th className="text-left px-3 py-2 font-semibold">Contact</th>
                      <th className="text-left px-3 py-2 font-semibold">Lead Date</th>
                      <th className="text-left px-3 py-2 font-semibold">Appt Date</th>
                      <th className="text-right px-3 py-2 font-semibold">Days</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.recoveredAppts.map((r, i) => (
                        <tr key={i} className="bg-white">
                          <td className="px-3 py-2"><ContactLink id={r.id} name={r.fullName} /></td>
                          <td className="px-3 py-2 text-gray-500">{fmtDate(r.leadDate)}</td>
                          <td className="px-3 py-2 text-gray-500">{fmtDate(r.apptDate)}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{r.daysToRecovery}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </ExpandableDetail>
          </SectionCard>

          <SectionCard title="Lead Sales">
            <MetricRow label="Recovered Sales" value={m.leadSalesCount} />
            <MetricRow label="Recovered Sales Value" value={fmtMoney(m.leadSalesRevenue)} />
            <ExpandableDetail label="Contact Log" rows={(data.leadSales || []).length}>
              {(data.leadSales || []).length === 0 ? (
                <p className="text-xs text-gray-400 italic py-1">No lead sales in this range.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-500"><tr>
                      <th className="text-left px-3 py-2 font-semibold">Contact</th>
                      <th className="text-left px-3 py-2 font-semibold">Lead Date</th>
                      <th className="text-left px-3 py-2 font-semibold">Sold Date</th>
                      <th className="text-right px-3 py-2 font-semibold">Contract</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.leadSales.map((r, i) => (
                        <tr key={i} className="bg-white">
                          <td className="px-3 py-2"><ContactLink id={r.id} name={r.fullName} /></td>
                          <td className="px-3 py-2 text-gray-500">{fmtDate(r.leadDate)}</td>
                          <td className="px-3 py-2 text-gray-500">{fmtDate(r.soldDate)}</td>
                          <td className="px-3 py-2 text-right font-medium text-green-700">{fmtMoneyOrDash(r.contractPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </ExpandableDetail>
          </SectionCard>

          <SectionCard title="Not Sold Recovery">
            <MetricRow label="Recovered Sales" value={m.notSoldCount} />
            <MetricRow label="Recovered Sales Value" value={fmtMoney(m.notSoldRevenue)} />
            <MetricRow label="Recovery Rate" value={`${m.notSoldRecoveryPct}%`}
              sub={m.avgDaysNotSold != null ? `Avg ${m.avgDaysNotSold} days to recovery` : undefined} />
            <ExpandableDetail label="Contact Log" rows={(data.notSoldRecovery || []).length}>
              {(data.notSoldRecovery || []).length === 0 ? (
                <p className="text-xs text-gray-400 italic py-1">No not-sold recoveries in this range.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-500"><tr>
                      <th className="text-left px-3 py-2 font-semibold">Contact</th>
                      <th className="text-left px-3 py-2 font-semibold">Not Sold Date</th>
                      <th className="text-left px-3 py-2 font-semibold">Sold Date</th>
                      <th className="text-right px-3 py-2 font-semibold">Days</th>
                      <th className="text-right px-3 py-2 font-semibold">Contract</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.notSoldRecovery.map((r, i) => (
                        <tr key={i} className="bg-white">
                          <td className="px-3 py-2"><ContactLink id={r.id} name={r.fullName} /></td>
                          <td className="px-3 py-2 text-gray-500">{fmtDate(r.notSoldDate)}</td>
                          <td className="px-3 py-2 text-gray-500">{fmtDate(r.soldDate)}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{r.daysToRecovery}</td>
                          <td className="px-3 py-2 text-right font-medium text-green-700">{fmtMoneyOrDash(r.contractPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </ExpandableDetail>
          </SectionCard>
        </>
      )}
    </div>
  );
}

// ─── Conversions by Source ────────────────────────────────────────────────────

export function ConversionsBySourceContent({ companyId }) {
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

  function handleRangeClick(r) { setRange(r); if (r !== "custom") load(r); }
  function handleCustomApply() { if (customStart && customEnd) load("custom", customStart, customEnd); }

  const fmtPct = (v) => v != null ? `${v}%` : "—";

  const RANGES = [
    { key: "30", label: "30 Days" }, { key: "60", label: "60 Days" },
    { key: "90", label: "90 Days" }, { key: "custom", label: "Custom" },
  ];

  return (
    <div>
      <p className="text-xs text-gray-500 mb-3">
        Leads grouped by UTM source, tracked through the full sales funnel. Leads with no UTM source are grouped as "organic". Junk leads excluded.
      </p>
      <div className="flex gap-1.5 mb-3 flex-wrap">
        {RANGES.map((r) => (
          <button key={r.key} onClick={() => handleRangeClick(r.key)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${range === r.key ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}>
            {r.label}
          </button>
        ))}
      </div>
      {range === "custom" && (
        <div className="flex gap-2 items-center mb-3 flex-wrap">
          <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1 text-xs" />
          <span className="text-xs text-gray-500">to</span>
          <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1 text-xs" />
          <button onClick={handleCustomApply} className="px-3 py-1 bg-blue-600 text-white rounded-full text-xs font-medium">Apply</button>
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
              <thead className="bg-gray-50 text-gray-500"><tr>
                <th className="text-left px-3 py-2 font-semibold">Source</th>
                <th className="text-right px-3 py-2 font-semibold">Leads</th>
                <th className="text-right px-3 py-2 font-semibold">Appts</th>
                <th className="text-right px-3 py-2 font-semibold">Appt%</th>
                <th className="text-right px-3 py-2 font-semibold">Sold</th>
                <th className="text-right px-3 py-2 font-semibold">Lead→Sold%</th>
                <th className="text-right px-3 py-2 font-semibold">Appt→Sold%</th>
              </tr></thead>
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

// ─── Cost Per Sale ────────────────────────────────────────────────────────────

export function CostPerSaleContent({ companyId }) {
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

  function handleRangeClick(r) { setRange(r); if (r !== "custom") load(r); }
  function handleCustomApply() { if (customStart && customEnd) load("custom", customStart, customEnd); }

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
      .then(() => { setCplSaving(false); setEditingCpls(false); load(range, customStart, customEnd); })
      .catch(() => setCplSaving(false));
  }

  const fmtMoney = (v) => v == null ? "—" : `$${parseFloat(v).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const fmtPct = (v) => v != null ? `${v}%` : "—";

  const RANGES = [
    { key: "30", label: "30 Days" }, { key: "60", label: "60 Days" },
    { key: "90", label: "90 Days" }, { key: "custom", label: "Custom" },
  ];

  return (
    <div>
      <p className="text-xs text-gray-500 mb-3">
        Enter your cost per lead for each UTM source. Sold jobs without a contract price are excluded from revenue calculations.
      </p>
      <div className="flex gap-1.5 mb-3 flex-wrap">
        {RANGES.map((r) => (
          <button key={r.key} onClick={() => handleRangeClick(r.key)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${range === r.key ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}>
            {r.label}
          </button>
        ))}
      </div>
      {range === "custom" && (
        <div className="flex gap-2 items-center mb-3 flex-wrap">
          <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1 text-xs" />
          <span className="text-xs text-gray-500">to</span>
          <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1 text-xs" />
          <button onClick={handleCustomApply} className="px-3 py-1 bg-blue-600 text-white rounded-full text-xs font-medium">Apply</button>
        </div>
      )}
      {!editingCpls && (
        <button onClick={openCplEditor} className="mb-3 px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50">
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
                      <input type="text" inputMode="decimal" value={s.cpl}
                        onChange={(e) => { const u = [...cplSources]; u[i] = { ...s, cpl: e.target.value }; setCplSources(u); }}
                        className="border border-gray-300 rounded-lg px-2 py-1 text-xs w-24" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={saveCpls} disabled={cplSaving} className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium disabled:opacity-50">
                  {cplSaving ? "Saving..." : "Save"}
                </button>
                <button onClick={() => setEditingCpls(false)} className="px-4 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700">
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
              <thead className="bg-gray-50 text-gray-500"><tr>
                <th className="text-left px-3 py-2 font-semibold">Source</th>
                <th className="text-right px-3 py-2 font-semibold">CPL</th>
                <th className="text-right px-3 py-2 font-semibold">Leads</th>
                <th className="text-right px-3 py-2 font-semibold">Ad Spend</th>
                <th className="text-right px-3 py-2 font-semibold">Sold w/Price</th>
                <th className="text-right px-3 py-2 font-semibold">Avg Contract</th>
                <th className="text-right px-3 py-2 font-semibold">Revenue</th>
                <th className="text-right px-3 py-2 font-semibold">Cost/Sale</th>
                <th className="text-right px-3 py-2 font-semibold">Ad Cost%</th>
              </tr></thead>
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

// ─── Speed to Lead ────────────────────────────────────────────────────────────

export function SpeedToLeadContent({ companyId }) {
  const today = new Date();
  const defaultEnd = today.toISOString().split('T')[0];
  const defaultStart = new Date(today - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function load(s, e) {
    setLoading(true);
    setError(null);
    let url = `/api/reports/speed-to-lead?start=${s}&end=${e}`;
    if (companyId) url += `&company_id=${companyId}`;
    apiRequest(url)
      .then((r) => { setData(r); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }

  useEffect(() => { load(defaultStart, defaultEnd); }, [companyId]);

  function fmtTime(minutes) {
    if (minutes == null) return '—';
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h >= 48) return `${Math.floor(h / 24)}d ${h % 24}h`;
    if (h >= 24) {
      const rh = h % 24;
      return rh ? `${Math.floor(h / 24)}d ${rh}h` : `${Math.floor(h / 24)}d`;
    }
    return m ? `${h}h ${m}m` : `${h}h`;
  }

  const STATUS_STYLE = {
    'status_pre_lead': 'text-gray-600',
    'lead':            'text-blue-700',
    'appointment_set': 'text-purple-700',
    'sold':            'text-green-700',
    'not_sold':        'text-red-600',
  };

  return (
    <div>
      <p className="text-xs text-gray-500 mb-3">
        Average time from lead creation to first outbound call, by current status. Helps reveal whether faster response time correlates with higher conversion rates. Call data is pulled from GHL and cached — first run may take a moment.
      </p>

      <div className="flex gap-2 items-center mb-4 flex-wrap">
        <input
          type="date" value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="border border-gray-300 rounded-lg px-2 py-1 text-xs"
        />
        <span className="text-xs text-gray-400">to</span>
        <input
          type="date" value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="border border-gray-300 rounded-lg px-2 py-1 text-xs"
        />
        <button
          onClick={() => load(startDate, endDate)}
          className="px-3 py-1 bg-blue-600 text-white rounded-full text-xs font-medium"
        >
          Run
        </button>
      </div>

      {loading && (
        <div>
          <Spinner />
          <p className="text-xs text-gray-400 text-center mt-2">
            Fetching call data from GHL — first run may take a moment.
          </p>
        </div>
      )}
      {error && <ErrorMsg msg={error} />}
      {!loading && !error && data && (
        <>
          {data.synced > 0 && (
            <p className="text-xs text-blue-600 mb-2">
              Synced {data.synced} new call record{data.synced !== 1 ? 's' : ''} from GHL.
            </p>
          )}
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Status</th>
                  <th className="text-right px-3 py-2 font-semibold">Leads</th>
                  <th className="text-right px-3 py-2 font-semibold">Called</th>
                  <th className="text-right px-3 py-2 font-semibold">Raw</th>
                  <th className="text-right px-3 py-2 font-semibold">Biz Hrs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.rows.map((r) => (
                  <tr key={r.status} className="bg-white">
                    <td className={`px-3 py-2.5 font-medium ${STATUS_STYLE[r.status] || 'text-gray-800'}`}>
                      {r.label}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-700">{r.count}</td>
                    <td className="px-3 py-2.5 text-right text-gray-500">{r.reached} of {r.count}</td>
                    <td className="px-3 py-2.5 text-right text-gray-400">{fmtTime(r.avgMinutes)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-gray-900">{fmtTime(r.avgBizMinutes)}</td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-semibold border-t-2 border-gray-300">
                  <td className="px-3 py-2.5 text-gray-900">All Statuses</td>
                  <td className="px-3 py-2.5 text-right text-gray-900">{data.overall.count}</td>
                  <td className="px-3 py-2.5 text-right text-gray-700">{data.overall.reached} of {data.overall.count}</td>
                  <td className="px-3 py-2.5 text-right text-gray-400">{fmtTime(data.overall.avgMinutes)}</td>
                  <td className="px-3 py-2.5 text-right text-gray-900">{fmtTime(data.overall.avgBizMinutes)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Biz Hrs excludes business hours (9am–5pm) when the crew is on job sites. Raw is total clock time. Leads with no outbound call recorded are counted in totals but excluded from averages.
          </p>

          {data.buckets && (
            <div className="mt-5">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Response Time vs. Conversion</div>
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">First Call</th>
                      <th className="text-right px-3 py-2 font-semibold">Leads</th>
                      <th className="text-right px-3 py-2 font-semibold">% of Leads</th>
                      <th className="text-right px-3 py-2 font-semibold">Appts</th>
                      <th className="text-right px-3 py-2 font-semibold">Sales</th>
                      <th className="text-right px-3 py-2 font-semibold">Lead→Appt</th>
                      <th className="text-right px-3 py-2 font-semibold">Lead→Sale</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.buckets.map((b, i) => (
                      <tr key={i} className={b.label === 'Never Called' ? 'bg-gray-50' : 'bg-white'}>
                        <td className="px-3 py-2.5 font-medium text-gray-800 whitespace-nowrap">{b.label}</td>
                        <td className="px-3 py-2.5 text-right text-gray-700">{b.count}</td>
                        <td className="px-3 py-2.5 text-right text-gray-500">{b.pctOfLeads.toFixed(1)}%</td>
                        <td className="px-3 py-2.5 text-right text-gray-700">{b.appts}</td>
                        <td className="px-3 py-2.5 text-right text-gray-700">{b.sales}</td>
                        <td className="px-3 py-2.5 text-right font-medium text-gray-900">{b.count > 0 ? `${b.leadToApptPct.toFixed(1)}%` : '—'}</td>
                        <td className="px-3 py-2.5 text-right font-medium text-gray-900">{b.count > 0 ? `${b.leadToSalePct.toFixed(1)}%` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                Appointments = reached appt stage or later. Sales = ultimately sold. Buckets use biz-hrs response time (excluding 9am–5pm). All lead counts sum to the total above.
              </p>
            </div>
          )}

          {data.detail && data.detail.length > 0 && (
            <ExpandableDetail label="Lead-by-Lead Call Log (sorted slowest → fastest biz hrs)" rows={data.detail.length}>
              <div className="overflow-x-auto rounded-lg border border-gray-200 mt-1">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">Name</th>
                      <th className="text-left px-3 py-2 font-semibold">Status</th>
                      <th className="text-left px-3 py-2 font-semibold">Lead In</th>
                      <th className="text-left px-3 py-2 font-semibold">First Call</th>
                      <th className="text-right px-3 py-2 font-semibold">Raw</th>
                      <th className="text-right px-3 py-2 font-semibold">Biz Hrs</th>
                      <th className="text-center px-3 py-2 font-semibold">Flags</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.detail.map((r) => {
                      const fmtDT = (iso, day) => {
                        const d = new Date(iso);
                        return `${day} ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
                      };
                      const flags = [
                        r.afterHoursLead && 'Lead after-hrs',
                        r.weekendLead    && 'Lead weekend',
                        r.afterHoursCall && 'Call after-hrs',
                        r.weekendCall    && 'Call weekend',
                      ].filter(Boolean);
                      return (
                        <tr key={r.id} className={r.flagged ? 'bg-amber-50' : 'bg-white'}>
                          <td className="px-3 py-2">
                            <ContactLink id={r.id} name={r.name} />
                          </td>
                          <td className="px-3 py-2 text-gray-500">{r.status}</td>
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{fmtDT(r.createdAt, r.createdDay)}</td>
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{fmtDT(r.firstCallAt, r.calledDay)}</td>
                          <td className="px-3 py-2 text-right text-gray-400 whitespace-nowrap">{fmtTime(r.minutesToCall)}</td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-900 whitespace-nowrap">{fmtTime(r.bizMinutesToCall)}</td>
                          <td className="px-3 py-2 text-center">
                            {flags.length > 0 && (
                              <span className="text-amber-700 font-medium">{flags.join(' · ')}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </ExpandableDetail>
          )}
        </>
      )}
    </div>
  );
}

// ─── report component map ─────────────────────────────────────────────────────

export const REPORT_CONTENT = {
  automation_recovery: AutomationRecoveryContent,
  conversions_by_source: ConversionsBySourceContent,
  cost_per_sale: CostPerSaleContent,
  speed_to_lead: SpeedToLeadContent,
};
