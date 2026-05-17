// ============================================================================
// File: src/company/CompanyModal.jsx
// Version: v1.8.6 - Add API key status indicator
// ============================================================================

console.log("📂 CompanyModal.jsx file loaded");

import React, { useEffect, useState } from "react";
import { useAuth } from "../AuthContext";
import { apiRequest } from "../api";
import UsersHome from "../users/UsersHome";
import EstimatorPricingModal from "./EstimatorPricingModal";
import EstimatorMasterModal from "./EstimatorMasterModal";
import BidderAdminSettings from "./BidderAdminSettings";

// Phone formatter utility
const formatPhoneNumber = (value) => {
  if (!value) return "";
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

export default function CompanyModal({
  mode, // "view" | "edit" | "create"
  company,
  onEdit,
  onClose,
  onSave,
}) {
  console.log("🎨 CompanyModal component rendering");
  console.log("🎨 Mode:", mode);
  console.log("🎨 Received company:", company);
  
  const { user, isMaster } = useAuth();
  // ... rest of code
  const isCreate = mode === "create";
  const isMasterUser = isMaster();
  const isAdminUser = user?.role === "admin";

  // ------------------------------------------------------------
  // SECTION STATE
  // ------------------------------------------------------------
  const [activeSection, setActiveSection] = useState("info");
  const [sectionMode, setSectionMode] = useState("view");

  const [form, setForm] = useState(null);
  const [ghlForm, setGhlForm] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

// MODAL STATE
  const [showEstimatorPricing, setShowEstimatorPricing] = useState(false);
  const [showEstimatorMaster, setShowEstimatorMaster] = useState(false);

  // REPORTS STATE
  const [reportDefs, setReportDefs] = useState(null);
  const [openReport, setOpenReport] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportRange, setReportRange] = useState('30');

  // ORPHAN CHECK STATE
  const [orphanLoading, setOrphanLoading] = useState(false);
  const [orphanResults, setOrphanResults] = useState(null);
  const [orphanResyncStatus, setOrphanResyncStatus] = useState({});

  // TRACKING FORM STATE
  const [trackingForm, setTrackingForm] = useState({
    google_base_tag: "",
    meta_base_tag: "",
    google_conversion_event: "",
    meta_conversion_event: "",
    microsoft_base_tag: "",
    microsoft_conversion_event: "",
  });

  // Track checkbox interaction
  const [suspendedTouched, setSuspendedTouched] = useState(false);

  // ------------------------------------------------------------
  // INIT FORM
  // ------------------------------------------------------------
  const [prevCompanyId, setPrevCompanyId] = useState(null);

 useEffect(() => {
  console.log("🔍 useEffect triggered");
  console.log("🔍 isCreate:", isCreate);
  console.log("🔍 company:", company);
  
  
  if (isCreate) {
    setActiveSection("info");
    setSectionMode("edit");
setForm({
  name: "",
  phone: "",
  email: "",
  website: "",
  address: "",
  city: "",
  state: "",
  zip: "",
  timezone: "America/New_York",
  suspended: false,
  plan_type: "pro",
  reports_enabled: false,
  service_area_zips: "",
  est_push_title: "",
  est_push_body: "",
});

setGhlForm({
  ghlApiKey: "",
  ghlLocationId: "",
  ghlInstallCalendar: "",
  ghlApptCalendar: "",
  ghlApptAssignedUser: "",
  ghlInstallAssignedUser: "",
  ghlScCalendar: "",
  ghlScAssignedUser: "",
  ghlApptTitleTemplate: "",
  ghlInstallTitleTemplate: "",
  ghlApptDescriptionTemplate: "",
  ghlInstallDescriptionTemplate: "",
  showConversations: false,
});

    setSuspendedTouched(false);
    setPrevCompanyId(null);
    return;
  }

  if (company) {
    const isNewCompany = prevCompanyId !== company.id;

    // Only reset the active section when switching to a different company.
    // When the same company is updated (e.g. after saving tracking codes),
    // stay on the current section so the user sees the saved data in place.
    if (isNewCompany) {
      setActiveSection("info");
      setSectionMode("view");
    }

setForm({
  name: company.name || "",
  phone: company.phone || "",
  email: company.email || "",
  website: company.website || "",
  address: company.address || "",
  city: company.city || "",
  state: company.state || "",
zip: company.zip || "",
  timezone: company.timezone || "America/New_York",
  suspended: company.suspended === true,
  plan_type: company.plan_type || company.planType || "pro",
  reports_enabled: company.reports_enabled === true || company.reportsEnabled === true,
  est_push_title: company.est_push_title || company.estPushTitle || "",
  est_push_body: company.est_push_body || company.estPushBody || "",
  googleDriveBaseFolderId:
  company.googleDriveBaseFolderId ??
  company.google_drive_base_folder_id ??
  "",
service_area_zips: Array.isArray(company.serviceAreaZips ?? company.service_area_zips)
    ? (company.serviceAreaZips ?? company.service_area_zips).join(", ")
    : (company.serviceAreaZips ?? company.service_area_zips) || "",
});


console.log("🧠 Initializing GHL form from company:", {
  ghl_location_id: company.ghl_location_id,
  ghl_appt_calendar: company.ghl_appt_calendar,
  ghl_install_calendar: company.ghl_install_calendar,
});

setGhlForm({
    ghlApiKey: company.ghlApiKey || "",
    ghlLocationId: company.ghlLocationId || "",
    ghlInstallCalendar: company.ghlInstallCalendar || "",
    ghlApptCalendar: company.ghlApptCalendar || "",
    ghlApptAssignedUser: company.ghlApptAssignedUser || "",
    ghlInstallAssignedUser: company.ghlInstallAssignedUser || "",
    ghlScCalendar: company.ghlScCalendar || "",
    ghlScAssignedUser: company.ghlScAssignedUser || "",
    ghlApptTitleTemplate: company.ghlApptTitleTemplate ?? "",
    ghlInstallTitleTemplate: company.ghlInstallTitleTemplate ?? "",
    ghlApptDescriptionTemplate: company.ghlApptDescriptionTemplate ?? "",
    ghlInstallDescriptionTemplate: company.ghlInstallDescriptionTemplate ?? "",
    showConversations: company.showConversations || false,
    sipDomain: company.sipDomain || company.sip_domain || "",
  });
    
    console.log("🔍 setGhlForm called with data");

setTrackingForm({
      google_base_tag: company.googleBaseTag || company.google_base_tag || "",
      meta_base_tag: company.metaBaseTag || company.meta_base_tag || "",
      google_conversion_event: company.googleConversionEvent || company.google_conversion_event || "",
      meta_conversion_event: company.metaConversionEvent || company.meta_conversion_event || "",
      microsoft_base_tag: company.microsoftBaseTag || company.microsoft_base_tag || "",
      microsoft_conversion_event: company.microsoftConversionEvent || company.microsoft_conversion_event || "",
    });

    setSuspendedTouched(false);
    setPrevCompanyId(company.id);
  }
}, [isCreate, company, company?.id, company?.updatedAt, company?.updated_at]);

if (!form) return null;
  // ------------------------------------------------------------
  // HANDLERS
  // ------------------------------------------------------------
  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError("");
    if (field === "suspended") {
      setSuspendedTouched(true);
    }
  };

  const handleGhlChange = (field, value) => {
    setGhlForm((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  const handleSave = async () => {
    if (!form.name) {
      setError("Company name is required");
      return;
    }

    if (saving) return;

    try {
      setSaving(true);
      setError("");

const rawZips = (form.service_area_zips || "").replace(/[\[\]\s]/g, " ");
      const zipsArray = rawZips
        .split(",")
        .map((z) => z.trim())
        .filter((z) => z.length > 0 && !isNaN(z));

      const payload = {
        name: form.name,
        phone: form.phone || null,
        email: form.email || null,
        website: form.website || null,
        address: form.address || null,
        city: form.city || null,
        state: form.state || null,
        zip: form.zip || null,
        suspended: form.suspended,
        plan_type: form.plan_type,
        reports_enabled: form.reports_enabled,
        est_push_title: form.est_push_title || null,
        est_push_body: form.est_push_body || null,
        timezone: form.timezone,
        google_drive_base_folder_id: form.googleDriveBaseFolderId || null,
        service_area_zips: zipsArray.length > 0 ? zipsArray : null,
      };

      await onSave(payload);
      setSectionMode("view");
    } catch (err) {
      console.error("Save company info error:", err);
      setError(err.message || "Failed to save company");
    } finally {
      setSaving(false);
    }
  };

const handleSaveGHLKeys = async () => {
  if (saving) return;

  try {
    setSaving(true);
    setError("");

    const payload = {
      name: form.name,
      phone: form.phone || null,
      email: form.email || null,
      website: form.website || null,
      address: form.address || null,
      city: form.city || null,
      state: form.state || null,
      zip: form.zip || null,
      suspended: form.suspended,
    };

    // Only include GHL fields if they have values (don't overwrite with null)
    if (ghlForm.ghlApiKey) {
      payload.ghl_api_key = ghlForm.ghlApiKey;
    }
    if (ghlForm.ghlLocationId) {
      payload.ghl_location_id = ghlForm.ghlLocationId;
    }
    if (ghlForm.ghlInstallCalendar) {
      payload.ghl_install_calendar = ghlForm.ghlInstallCalendar;
    }
    if (ghlForm.ghlApptCalendar) {
      payload.ghl_appt_calendar = ghlForm.ghlApptCalendar;
    }
    if (ghlForm.ghlApptAssignedUser) {
      payload.ghl_appt_assigned_user = ghlForm.ghlApptAssignedUser;
    }
    if (ghlForm.ghlInstallAssignedUser) {
      payload.ghl_install_assigned_user = ghlForm.ghlInstallAssignedUser;
    }
    if (ghlForm.ghlScCalendar) {
      payload.ghl_sc_calendar = ghlForm.ghlScCalendar;
    }
    if (ghlForm.ghlScAssignedUser) {
      payload.ghl_sc_assigned_user = ghlForm.ghlScAssignedUser;
    }
    if (ghlForm.ghlApptTitleTemplate) {
      payload.ghl_appt_title_template = ghlForm.ghlApptTitleTemplate;
    }
    if (ghlForm.ghlInstallTitleTemplate) {
      payload.ghl_install_title_template = ghlForm.ghlInstallTitleTemplate;
    }
    if (ghlForm.ghlApptDescriptionTemplate) {
      payload.ghl_appt_description_template = ghlForm.ghlApptDescriptionTemplate;
    }
if (ghlForm.ghlInstallDescriptionTemplate) {
      payload.ghl_install_description_template = ghlForm.ghlInstallDescriptionTemplate;
    }
    
    // Always include showConversations (boolean)
    payload.show_conversations = ghlForm.showConversations || false;
    payload.sip_domain = ghlForm.sipDomain || null;

    await onSave(payload);
    setError("");
  } catch (err) {
    console.error("GHL save error:", err);
    setError(err.message || "Failed to save GHL keys");
  } finally {
    setSaving(false);
  }
};

  // ------------------------------------------------------------
const handleSaveTracking = async () => {
    if (saving) return;
    try {
      setSaving(true);
      setError("");
      const payload = {
        name: form.name,
        google_base_tag: trackingForm.google_base_tag ?? "",
        meta_base_tag: trackingForm.meta_base_tag ?? "",
        google_conversion_event: trackingForm.google_conversion_event ?? "",
        meta_conversion_event: trackingForm.meta_conversion_event ?? "",
        microsoft_base_tag: trackingForm.microsoft_base_tag ?? "",
        microsoft_conversion_event: trackingForm.microsoft_conversion_event ?? "",
      };
      await onSave(payload);
      setError("");
    } catch (err) {
      console.error("Tracking save error:", err);
      setError(err.message || "Failed to save tracking codes");
    } finally {
      setSaving(false);
    }
  };

  const ENDPOINT_MAP = { recent_activity: "activity", conversions: "conversions", automation_recovery: "automation-recovery" };

  const fetchReportData = async (def, range) => {
    setReportLoading(true);
    setReportData(null);
    const endpoint = ENDPOINT_MAP[def.key] ?? def.key;
    let url = `/api/reports/${endpoint}?company_id=${company.id}`;
    if (range && range !== '30') url += `&range=${range}`;
    try {
      const res = await apiRequest(url);
      setReportData(def.key === 'automation_recovery' ? res.metrics : res.metrics);
    } catch (e) {
      setReportData(null);
    }
    setReportLoading(false);
  };

  const openReportModal = (def) => {
    setOpenReport(def);
    setReportRange('30');
    fetchReportData(def, '30');
  };

  const runOrphanCheck = async () => {
    setOrphanLoading(true);
    setOrphanResults(null);
    setOrphanResyncStatus({});
    try {
      const res = await apiRequest(`/api/reports/orphan-contacts?company_id=${company.id}`);
      setOrphanResults(res.orphans || []);
    } catch (e) {
      setOrphanResults([]);
    }
    setOrphanLoading(false);
  };

  const resyncLead = async (leadId) => {
    setOrphanResyncStatus(prev => ({ ...prev, [leadId]: 'syncing' }));
    try {
      await apiRequest('/api/reports/orphan-resync', {
        method: 'POST',
        body: JSON.stringify({ lead_id: leadId, company_id: company.id }),
      });
      setOrphanResyncStatus(prev => ({ ...prev, [leadId]: 'done' }));
    } catch (e) {
      setOrphanResyncStatus(prev => ({ ...prev, [leadId]: 'error' }));
    }
  };

  const renderReports = () => {
    if (!reportDefs) {
      apiRequest("/api/reports/definitions")
        .then((r) => setReportDefs(r.reports))
        .catch(() => setReportDefs([]));
      return (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-7 w-7 border-4 border-blue-500 border-t-transparent" />
        </div>
      );
    }

    const ReportPopup = () => {
      if (!openReport) return null;
      const data = reportData;

      const ModalShell = ({ children }) => (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 pt-16 px-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl max-h-[75vh] flex flex-col">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-gray-900">{openReport.name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{openReport.description}</p>
              </div>
              <button onClick={() => setOpenReport(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none ml-4">×</button>
            </div>
            <div className="overflow-y-auto px-5 py-4 flex-1">
              {reportLoading ? (
                <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-7 w-7 border-4 border-blue-500 border-t-transparent" /></div>
              ) : children}
            </div>
          </div>
        </div>
      );

      if (openReport.key === "automation_recovery") {
        const m = data;
        const fmtMoney = (v) => v == null ? "—" : `$${parseFloat(v).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
        const Row = ({ label, value, green }) => (
          <div className="flex justify-between py-2 border-b border-gray-100 last:border-0">
            <span className="text-sm text-gray-600">{label}</span>
            <span className={`text-sm font-semibold ${green ? "text-green-700" : ""}`}>{value}</span>
          </div>
        );
        const RANGES = [{ key: "30", label: "30 Days" }, { key: "90", label: "90 Days" }, { key: "ytd", label: "YTD" }];
        return (
          <ModalShell>
            <div className="flex gap-1.5 mb-4">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => { setReportRange(r.key); fetchReportData(openReport, r.key); }}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${reportRange === r.key ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {!m ? (
              <p className="text-sm text-gray-400 italic py-2">No data available.</p>
            ) : (
              <>
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-3">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Appointments</div>
                  <Row label="Total Appointments Set" value={m.totalAppts} />
                  <Row label="Recovered Appointments" value={m.recoveredAppts} />
                  <Row label="Appointment Recovery Rate" value={`${m.apptRecoveryPct}%`} />
                  {m.avgDaysAppt != null && <Row label="Avg Days to Recovery" value={`${m.avgDaysAppt} days`} />}
                </div>
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-3">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Sales</div>
                  <Row label="Total Jobs Sold" value={m.totalSold} />
                  <Row label="Recovered Sales" value={m.recoveredSales} />
                  <Row label="Recovered Revenue" value={fmtMoney(m.recoveredSalesRevenue)} green />
                  <Row label="Sales Recovery Rate" value={`${m.salesRecoveryPct}%`} />
                  {m.avgDaysSale != null && <Row label="Avg Days to Recovery" value={`${m.avgDaysSale} days`} />}
                </div>
              </>
            )}
          </ModalShell>
        );
      }

      const SectionCard = ({ title, d }) => (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-3">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{title}</div>
          {!d || (d.totalLeads === 0 && d.newLeads === undefined) ? (
            <p className="text-sm text-gray-400 italic">No data yet</p>
          ) : openReport.key === "recent_activity" ? (
            <>
              <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-sm text-gray-600">New Leads</span><span className="text-sm font-semibold">{d.newLeads}</span></div>
              <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-sm text-gray-600">Appointments Set</span><span className="text-sm font-semibold">{d.apptsSet}</span></div>
              <div className="flex justify-between py-2"><span className="text-sm text-gray-600">Jobs Sold</span><span className="text-sm font-semibold">{d.jobsSold}</span></div>
            </>
          ) : (
            <>
              <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-sm text-gray-600">Leads in this report</span><span className="text-sm font-semibold">{d.totalLeads}</span></div>
              <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-sm text-gray-600">Lead → Appointment</span><span className="text-sm font-semibold">{d.leadsToAppt} ({d.leadToApptPct}%)</span></div>
              <div className="flex justify-between py-2 border-b border-gray-100"><span className="text-sm text-gray-600">Appointment → Sold</span><span className="text-sm font-semibold">{d.apptToSold} ({d.apptToSoldPct}%)</span></div>
              <div className="flex justify-between py-2"><span className="text-sm text-gray-600">Lead → Sold (total)</span><span className="text-sm font-semibold">{d.leadsToSold} ({d.leadToSoldPct}%)</span></div>
            </>
          )}
        </div>
      );

      return (
        <ModalShell>
          <SectionCard title="Regular Leads" d={data?.non_estimator} />
          <SectionCard title="Estimator Leads" d={data?.estimator} />
        </ModalShell>
      );
    };

    return (
      <div className="space-y-3">
        <p className="text-xs text-gray-500">Select a report to view data for this company.</p>

        {/* Orphan CP Contacts — master only */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
          <div className="text-sm font-semibold text-gray-900">Orphan CP Contacts</div>
          <div className="text-xs text-gray-500 mt-0.5">Find leads whose GHL contact ID no longer exists in GoHighLevel</div>
          <button
            onClick={runOrphanCheck}
            disabled={orphanLoading}
            className="mt-3 px-4 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50"
          >
            {orphanLoading ? 'Checking…' : 'Run Check'}
          </button>

          {orphanResults !== null && (
            <div className="mt-3">
              {orphanResults.length === 0 ? (
                <p className="text-xs text-green-700 font-semibold">All contacts verified — no orphans found.</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-red-600 font-semibold">
                    {orphanResults.length} orphaned contact{orphanResults.length !== 1 ? 's' : ''} found:
                  </p>
                  {orphanResults.map((lead) => {
                    const syncStatus = orphanResyncStatus[lead.id];
                    return (
                      <div key={lead.id} className="flex items-center justify-between bg-red-50 rounded-lg px-3 py-2">
                        <div>
                          <div className="text-xs font-semibold text-gray-900">{lead.name || '(no name)'}</div>
                          <div className="text-xs text-gray-500">{lead.phone || lead.email || ''} · {lead.status}</div>
                        </div>
                        {syncStatus === 'done' ? (
                          <span className="text-xs text-green-700 font-semibold">Synced ✓</span>
                        ) : syncStatus === 'error' ? (
                          <span className="text-xs text-red-600 font-semibold">Failed</span>
                        ) : (
                          <button
                            onClick={() => resyncLead(lead.id)}
                            disabled={syncStatus === 'syncing'}
                            className="px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50"
                          >
                            {syncStatus === 'syncing' ? 'Syncing…' : 'Resync with GHL'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {reportDefs.length === 0 && <p className="text-sm text-gray-400 italic">No reports available.</p>}
        {reportDefs.map((def) => (
          <button
            key={def.key}
            onClick={() => openReportModal(def)}
            className="w-full text-left bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 active:bg-gray-50"
          >
            <div className="text-sm font-semibold text-gray-900">{def.name}</div>
            <div className="text-xs text-gray-500 mt-0.5">{def.description}</div>
            <div className="text-xs text-blue-600 mt-2 font-medium">View →</div>
          </button>
        ))}
        <ReportPopup />
      </div>
    );
  };

  const renderTracking = () => (
    <div className="space-y-5">
      {error && (
        <div className="bg-red-50 border-l-4 border-red-600 p-3 text-red-800 text-sm">
          {error}
        </div>
      )}

      <div className="bg-yellow-50 border-l-4 border-yellow-500 p-3 text-yellow-800 text-sm">
        <strong>Conversion Tracking</strong>
        <p className="mt-1">Paste tracking codes here. Base tags inject into the estimator &lt;head&gt;. Conversion events fire on form submit success.</p>
      </div>

      <div>
        <div className={viewLabel}>GOOGLE / GA4 BASE TAG</div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 space-y-1 mb-2">
          <p className="font-semibold">Where to find this code:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Go to <strong>Google Ads</strong> → Tools &amp; Settings → Audience Manager → Your Data Sources → Google tag</li>
            <li>Click <strong>Tag setup</strong> → Install the tag yourself</li>
            <li>Copy both <code>&lt;script&gt;</code> blocks shown and paste them here</li>
          </ol>
        </div>
        <textarea
          className={`${editBox} font-mono text-xs`}
          rows="4"
          value={trackingForm.google_base_tag}
          onChange={(e) => setTrackingForm((p) => ({ ...p, google_base_tag: e.target.value }))}
          placeholder={'<script async src="https://www.googletagmanager.com/gtag/js?id=AW-XXXXXXXXX"></script>'}
        />
      </div>

      <div>
        <div className={viewLabel}>GOOGLE CONVERSION EVENT CODE</div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 space-y-1 mb-2">
          <p className="font-semibold">Where to find this code:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Go to <strong>Google Ads</strong> → Goals → Conversions → click your conversion action</li>
            <li>Click <strong>Tag setup</strong> → Use Google tag → Install manually</li>
            <li>Copy only the <strong>event snippet</strong> line — looks like: <code>gtag('event', 'conversion', {'{'}'send_to': 'AW-...'{'}'});</code></li>
            <li>Paste just that one line here — no <code>&lt;script&gt;</code> tags</li>
          </ol>
        </div>
        <textarea
          className={`${editBox} font-mono text-xs`}
          rows="2"
          value={trackingForm.google_conversion_event}
          onChange={(e) => setTrackingForm((p) => ({ ...p, google_conversion_event: e.target.value }))}
          placeholder={"gtag('event', 'conversion', { send_to: 'AW-XXXXXXXXX/XXXXXXXXX' });"}
        />
      </div>

      <div>
        <div className={viewLabel}>META (FACEBOOK) BASE TAG</div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 space-y-1 mb-2">
          <p className="font-semibold">Where to find this code:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Go to <strong>Meta Business Suite</strong> → Events Manager → your Pixel → Add Events → From a new website</li>
            <li>Choose <strong>Install code manually</strong></li>
            <li>Copy the full base code block (the <code>!function(f,b,e,v...)</code> script including <code>fbq('init', ...)</code> and <code>fbq('track', 'PageView')</code>)</li>
            <li>Paste the entire <code>&lt;script&gt;</code> block here</li>
          </ol>
        </div>
        <textarea
          className={`${editBox} font-mono text-xs`}
          rows="4"
          value={trackingForm.meta_base_tag}
          onChange={(e) => setTrackingForm((p) => ({ ...p, meta_base_tag: e.target.value }))}
          placeholder={'<script>!function(f,b,e,v,n,t,s){...}fbq("init","XXXXXXXXXXXXXXX");</script>'}
        />
      </div>

      <div>
        <div className={viewLabel}>META CONVERSION EVENT CODE</div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 space-y-1 mb-2">
          <p className="font-semibold">Where to find this code:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Go to <strong>Meta Business Suite</strong> → Events Manager → your Pixel → Add Events → Install code manually</li>
            <li>Select <strong>Lead</strong> as the event type and copy the event line</li>
            <li>Paste just that one line here — no <code>&lt;script&gt;</code> tags</li>
          </ol>
          <p className="text-blue-700 mt-1"><strong>'Lead'</strong> is Meta's standard event for form submissions — shows in Events Manager and lets Meta optimize your ads.</p>
        </div>
        <textarea
          className={`${editBox} font-mono text-xs`}
          rows="2"
          value={trackingForm.meta_conversion_event}
          onChange={(e) => setTrackingForm((p) => ({ ...p, meta_conversion_event: e.target.value }))}
          placeholder={"fbq('track', 'Lead');"}
        />
      </div>

      <div>
        <div className={viewLabel}>MICROSOFT (BING) BASE TAG</div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 space-y-1 mb-2">
          <p className="font-semibold">Where to find this code:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Go to <strong>Microsoft Advertising</strong> (ads.microsoft.com) → Tools → UET Tags</li>
            <li>Click your UET tag name → click <strong>View tag</strong></li>
            <li>Copy the full <code>&lt;script&gt;</code> block shown and paste it here</li>
          </ol>
          <p className="text-blue-700 mt-1">Required before the conversion event will fire. Loads the UET tag on the estimator.</p>
        </div>
        <textarea
          className={`${editBox} font-mono text-xs`}
          rows="4"
          value={trackingForm.microsoft_base_tag}
          onChange={(e) => setTrackingForm((p) => ({ ...p, microsoft_base_tag: e.target.value }))}
          placeholder={'<script>(function(w,d,t,r,u){var f,n,i;w[u]=w[u]||[];...ti:"XXXXXXXXX"...})(window,document,"script","//bat.bing.com/bat.js","uetq");</script>'}
        />
      </div>

      <div>
        <div className={viewLabel}>MICROSOFT CONVERSION EVENT CODE</div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 space-y-1 mb-2">
          <p className="font-semibold">Where to find this code:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Go to <strong>Microsoft Advertising</strong> → Tools → Conversion Goals → click your goal (or create one with type <strong>Event</strong>)</li>
            <li>The event code looks like: <code>window.uetq = window.uetq || []; window.uetq.push('event', 'submit_lead', {'{'}{'}'}); </code></li>
            <li>Paste just that one line here — no <code>&lt;script&gt;</code> tags</li>
          </ol>
          <p className="text-blue-700 mt-1">Fires on estimator form submit. Shows in Microsoft Ads under your conversion goal.</p>
        </div>
        <textarea
          className={`${editBox} font-mono text-xs`}
          rows="2"
          value={trackingForm.microsoft_conversion_event}
          onChange={(e) => setTrackingForm((p) => ({ ...p, microsoft_conversion_event: e.target.value }))}
          placeholder={"window.uetq = window.uetq || []; window.uetq.push('event', 'submit_lead', {});"}
        />
      </div>
    </div>
  );

  // UI HELPERS
  const sectionBtn = (active) =>
    `px-4 py-2 rounded-lg font-semibold text-sm transition ${
      active
        ? "bg-blue-600 text-white"
        : "bg-white text-gray-700 border border-gray-200 hover:border-blue-300 hover:bg-blue-50"
    }`;

  const viewLabel = "text-xs uppercase text-gray-500 font-semibold mb-1";
  const viewValue = "text-gray-900 font-medium mb-3";
  const editBox = "w-full px-3 py-2 border rounded-lg text-sm";

  // ------------------------------------------------------------
  // RENDER SECTIONS
  // ------------------------------------------------------------
  const renderCompanyInfo = () => {
    const isEditing = sectionMode === "edit";

    return (
      <div className="space-y-4">
        {error && (
          <div className="bg-red-50 border-l-4 border-red-600 p-3 text-red-800 text-sm">
            {error}
          </div>
        )}

        <div>
          <div className={viewLabel}>COMPANY NAME</div>
          {isEditing ? (
            <input
              className={editBox}
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
            />
          ) : (
            <div className={viewValue}>{form.name || "—"}</div>
          )}
        </div>

        <div>
          <div className={viewLabel}>PHONE</div>
          {isEditing ? (
            <input
              className={editBox}
              value={form.phone}
              onChange={(e) =>
                handleChange("phone", formatPhoneNumber(e.target.value))
              }
            />
          ) : (
            <div className={viewValue}>{form.phone || "—"}</div>
          )}
        </div>

        <div>
          <div className={viewLabel}>EMAIL</div>
          {isEditing ? (
            <input
              className={editBox}
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
            />
          ) : (
            <div className={viewValue}>{form.email || "—"}</div>
          )}
        </div>

        <div>
          <div className={viewLabel}>WEBSITE</div>
          {isEditing ? (
            <input
              className={editBox}
              value={form.website}
              onChange={(e) => handleChange("website", e.target.value)}
            />
          ) : (
            <div className={viewValue}>{form.website || "—"}</div>
          )}
        </div>

        <div>
  <div className={viewLabel}>GOOGLE DRIVE BASE FOLDER ID</div>
  {isEditing ? (
    <input
      className={editBox}
      value={form.googleDriveBaseFolderId}
      onChange={(e) =>
        handleChange("googleDriveBaseFolderId", e.target.value)
      }
      placeholder="Paste Google Drive folder ID"
    />
  ) : (
    <div className={viewValue}>
      {form.googleDriveBaseFolderId || "—"}
    </div>
  )}
</div>

{isEditing && (
  <p className="text-xs text-gray-500 mt-1">
    Open the folder in Google Drive and copy the ID from the browser address bar.
  </p>
)}



        <div>
          <div className={viewLabel}>ADDRESS</div>
          {isEditing ? (
            <input
              className={editBox}
              value={form.address}
              onChange={(e) => handleChange("address", e.target.value)}
            />
          ) : (
            <div className={viewValue}>{form.address || "—"}</div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className={viewLabel}>CITY</div>
            {isEditing ? (
              <input
                className={editBox}
                value={form.city}
                onChange={(e) => handleChange("city", e.target.value)}
              />
            ) : (
              <div className={viewValue}>{form.city || "—"}</div>
            )}
          </div>

          <div>
            <div className={viewLabel}>STATE</div>
            {isEditing ? (
              <input
                className={editBox}
                value={form.state}
                onChange={(e) => handleChange("state", e.target.value)}
              />
            ) : (
              <div className={viewValue}>{form.state || "—"}</div>
            )}
          </div>

          <div>
            <div className={viewLabel}>ZIP</div>
            {isEditing ? (
              <input
                className={editBox}
                value={form.zip}
                onChange={(e) => handleChange("zip", e.target.value)}
              />
            ) : (
              <div className={viewValue}>{form.zip || "—"}</div>
            )}
          </div>
          <div>
  <div className={viewLabel}>COMPANY TIME ZONE</div>
  {isEditing ? (
    <select
      className={editBox}
      value={form.timezone}
      onChange={(e) => handleChange("timezone", e.target.value)}
    >
      <option value="America/New_York">Eastern (America/New_York)</option>
      <option value="America/Chicago">Central (America/Chicago)</option>
      <option value="America/Denver">Mountain (America/Denver)</option>
      <option value="America/Phoenix">Arizona (America/Phoenix)</option>
      <option value="America/Los_Angeles">Pacific (America/Los_Angeles)</option>
      <option value="America/Anchorage">Alaska (America/Anchorage)</option>
      <option value="Pacific/Honolulu">Hawaii (Pacific/Honolulu)</option>
    </select>
  ) : (
    <div className={viewValue}>{form.timezone || "—"}</div>
  )}
</div>

        </div>

<div className="pt-4 border-t">
          <div className={viewLabel}>SERVICE AREA ZIP CODES</div>
          {isEditing ? (
            <>
              <textarea
                className={editBox}
                rows={3}
                value={form.service_area_zips}
                onChange={(e) => handleChange("service_area_zips", e.target.value)}
                placeholder="60457, 60458, 60459"
              />
              <div className="text-xs text-gray-500 mt-1">Enter zip codes separated by commas. Leave blank to allow all zip codes.</div>
            </>
          ) : (
            <div className={viewValue}>{form.service_area_zips || "All zip codes allowed"}</div>
          )}
        </div>

        {isMasterUser && sectionMode === "edit" && (
          <div className="pt-4 border-t space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.suspended}
                onChange={(e) => handleChange("suspended", e.target.checked)}
                className="w-5 h-5 text-blue-600 rounded"
              />
              <div>
                <div className="font-semibold text-gray-900">
                  Suspend Account
                </div>
                <div className="text-sm text-gray-600">
                  Prevent all users from this company from logging in
                </div>
              </div>
            </label>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">Plan</label>
              <select
                value={form.plan_type}
                onChange={(e) => handleChange("plan_type", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="pro">Pro</option>
                <option value="estimator_only">Estimator Only</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.reports_enabled}
                onChange={async (e) => {
                  const val = e.target.checked;
                  handleChange("reports_enabled", val);
                  if (company?.id) {
                    try {
                      await apiRequest(`/companies/${company.id}/reports-enabled`, {
                        method: "PUT",
                        body: JSON.stringify({ reports_enabled: val }),
                      });
                    } catch (err) {
                      console.error("reports-enabled save failed:", err);
                    }
                  }
                }}
                className="w-4 h-4 rounded border-gray-300 text-blue-600"
              />
              <div>
                <div className="text-sm font-semibold text-gray-900">Reports Tab</div>
                <div className="text-sm text-gray-600">Show lifecycle timing and close-rate reports for this company</div>
              </div>
            </label>

            {form.plan_type === "estimator_only" && (
              <div className="pt-2 space-y-3">
                <div className="text-xs font-semibold text-blue-700 uppercase">New Lead Push Notification</div>
                <p className="text-xs text-gray-500">
                  Available merge fields: <code>{"{{name}}"}</code>, <code>{"{{project}}"}</code>
                </p>
                <div>
                  <label className="block text-xs text-gray-500 font-semibold mb-1">TITLE</label>
                  <input
                    className={editBox}
                    value={form.est_push_title}
                    onChange={(e) => handleChange("est_push_title", e.target.value)}
                    placeholder="New Estimator Lead"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 font-semibold mb-1">BODY</label>
                  <textarea
                    className={`${editBox} text-sm`}
                    rows={3}
                    value={form.est_push_body}
                    onChange={(e) => handleChange("est_push_body", e.target.value)}
                    placeholder={"{{name}} just submitted an estimator request for a {{project}} project. Click to open lead."}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

const renderGHLKeys = () => {
    const hasApiKey = company?.ghl_api_key || company?.ghlApikey;

    return (
      <div className="space-y-4">
        {error && (
          <div className="bg-red-50 border-l-4 border-red-600 p-3 text-red-800 text-sm">
            {error}
          </div>
        )}

        <div className="bg-blue-50 border-l-4 border-blue-600 p-3 text-blue-800 text-sm mb-4">
          <strong>GoHighLevel Integration Settings</strong>
          <p className="mt-1">
            Enter your GHL API credentials to enable lead syncing and calendar integration.
          </p>
        </div>

        {/* API Credentials */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className={viewLabel}>GHL API KEY</div>
            {hasApiKey && (
              <div className="flex items-center gap-2 text-green-600 text-sm font-semibold">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                API Key Configured
              </div>
            )}
          </div>
          <input
            type="password"
            className={editBox}
            value={ghlForm.ghlApiKey}
            onChange={(e) => handleGhlChange("ghlApiKey", e.target.value)}
            placeholder={hasApiKey ? "Enter new key to replace existing" : "Enter your GoHighLevel API key"}
          />
          {hasApiKey && (
            <p className="text-xs text-gray-500 mt-1">
              Leave blank to keep existing key
            </p>
          )}
        </div>

        <div>
          <div className={viewLabel}>GHL LOCATION ID</div>
          <input
            className={editBox}
            value={ghlForm.ghlLocationId}
            onChange={(e) => handleGhlChange("ghlLocationId", e.target.value)}
            placeholder="Enter your GoHighLevel location ID"
          />
        </div>

        {/* Appointment Calendar Section */}
        <div className="border-t pt-4 mt-4">
          <h4 className="font-bold text-gray-700 mb-3">Appointment Calendar</h4>

          <div>
            <div className={viewLabel}>CALENDAR ID</div>
            <input
              className={editBox}
              value={ghlForm.ghlApptCalendar}
              onChange={(e) => handleGhlChange("ghlApptCalendar", e.target.value)}
              placeholder="Calendar ID for sales appointments"
            />
          </div>

          <div className="mt-3">
            <div className={viewLabel}>ASSIGNED USER ID</div>
            <input
              className={editBox}
              value={ghlForm.ghlApptAssignedUser}
              onChange={(e) => handleGhlChange("ghlApptAssignedUser", e.target.value)}
              placeholder="GHL User ID for appointment bookings"
            />
          </div>

          <div className="mt-3">
            <div className={viewLabel}>TITLE TEMPLATE</div>
            <input
              className={editBox}
              value={ghlForm.ghlApptTitleTemplate}
              onChange={(e) => handleGhlChange("ghlApptTitleTemplate", e.target.value)}
              placeholder="{{full_name}} - Appointment"
            />
          </div>

          <div className="mt-3">
            <div className={viewLabel}>DESCRIPTION TEMPLATE</div>
            <textarea
              className={`${editBox} font-mono text-xs`}
              rows="8"
              value={ghlForm.ghlApptDescriptionTemplate}
              onChange={(e) => handleGhlChange("ghlApptDescriptionTemplate", e.target.value)}
              placeholder="Customer: {{full_name}}&#10;Phone: {{phone}}&#10;Email: {{email}}&#10;&#10;Service Address:&#10;{{address}}&#10;{{city}}, {{state}} {{zip}}"
            />
            <p className="text-xs text-gray-500 mt-1">
              Available fields: {`{{full_name}}, {{phone}}, {{email}}, {{address}}, {{city}}, {{state}}, {{zip}}, {{square_footage}}, {{finish_type}}, {{notes}}`}
            </p>
          </div>
        </div>

        {/* Install Calendar Section */}
        <div className="border-t pt-4 mt-4">
          <h4 className="font-bold text-gray-700 mb-3">Install Calendar</h4>

          <div>
            <div className={viewLabel}>CALENDAR ID</div>
            <input
              className={editBox}
              value={ghlForm.ghlInstallCalendar}
              onChange={(e) => handleGhlChange("ghlInstallCalendar", e.target.value)}
              placeholder="Calendar ID for installation appointments"
            />
          </div>

          <div className="mt-3">
            <div className={viewLabel}>ASSIGNED USER ID</div>
            <input
              className={editBox}
              value={ghlForm.ghlInstallAssignedUser}
              onChange={(e) => handleGhlChange("ghlInstallAssignedUser", e.target.value)}
              placeholder="GHL User ID for install bookings"
            />
          </div>

          <div className="mt-3">
            <div className={viewLabel}>TITLE TEMPLATE</div>
            <input
              className={editBox}
              value={ghlForm.ghlInstallTitleTemplate}
              onChange={(e) => handleGhlChange("ghlInstallTitleTemplate", e.target.value)}
              placeholder="{{full_name}} - Install"
            />
          </div>

          <div className="mt-3">
            <div className={viewLabel}>DESCRIPTION TEMPLATE</div>
            <textarea
              className={`${editBox} font-mono text-xs`}
              rows="8"
              value={ghlForm.ghlInstallDescriptionTemplate}
              onChange={(e) => handleGhlChange("ghlInstallDescriptionTemplate", e.target.value)}
              placeholder="Customer: {{full_name}}&#10;Phone: {{phone}}&#10;Email: {{email}}&#10;&#10;Service Address:&#10;{{address}}&#10;{{city}}, {{state}} {{zip}}"
            />
<p className="text-xs text-gray-500 mt-1">
              Available fields: {`{{full_name}}, {{phone}}, {{email}}, {{address}}, {{city}}, {{state}}, {{zip}}, {{square_footage}}, {{finish_type}}, {{notes}}`}
            </p>
          </div>
        </div>

        {/* Service Call Calendar Section */}
        <div className="border-t pt-4 mt-4">
          <h4 className="font-bold text-gray-700 mb-3">Service Call Calendar</h4>

          <div>
            <div className={viewLabel}>CALENDAR ID</div>
            <input
              className={editBox}
              value={ghlForm.ghlScCalendar}
              onChange={(e) => handleGhlChange("ghlScCalendar", e.target.value)}
              placeholder="Calendar ID for service call appointments"
            />
          </div>

          <div className="mt-3">
            <div className={viewLabel}>ASSIGNED USER ID</div>
            <input
              className={editBox}
              value={ghlForm.ghlScAssignedUser}
              onChange={(e) => handleGhlChange("ghlScAssignedUser", e.target.value)}
              placeholder="GHL User ID for service call bookings"
            />
          </div>
        </div>

        {/* SIP Domain */}
        <div className="border-t pt-4 mt-4">
          <h4 className="font-bold text-gray-700 mb-3">Softphone (SIP)</h4>
          <div>
            <div className={viewLabel}>SIP DOMAIN</div>
            <input
              className={editBox}
              value={ghlForm.sipDomain}
              onChange={(e) => handleGhlChange("sipDomain", e.target.value)}
              placeholder="e.g. company.sip.ashburn.twilio.com"
            />
            <p className="text-xs text-gray-500 mt-1">
              Twilio SIP Domain for outgoing calls. Set per-user credentials in User Management.
            </p>
          </div>
        </div>

        {/* Conversations Feature Toggle */}
        <div className="border-t pt-4 mt-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={ghlForm.showConversations}
              onChange={(e) => handleGhlChange("showConversations", e.target.checked)}
              className="w-5 h-5 text-blue-600 rounded"
            />
            <div>
              <div className="font-semibold text-gray-700">Show Conversations Feature</div>
              <div className="text-sm text-gray-500">Display message history button on lead cards</div>
            </div>
          </label>
        </div>
      </div>
    );
  };

  // ------------------------------------------------------------
  // MODAL
  // ------------------------------------------------------------
  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
          <div className="bg-blue-600 text-white px-6 py-4 rounded-t-2xl">
            <h2 className="text-xl font-bold">
              {isCreate ? "Add Company" : form.name}
            </h2>
          </div>

          <div className="px-6 py-4 flex flex-wrap gap-2 border-b">
            <button
              className={sectionBtn(activeSection === "info")}
              onClick={() => {
                setActiveSection("info");
                setSectionMode("view");
              }}
            >
              Company Info
            </button>

            {isMasterUser && (
              <button
                className={sectionBtn(activeSection === "ghl")}
onClick={() => {
  setActiveSection("ghl");
  setSectionMode("edit");

setGhlForm({
    ghlApiKey: company.ghlApiKey || "",
    ghlLocationId: company.ghlLocationId || "",
    ghlInstallCalendar: company.ghlInstallCalendar || "",
    ghlApptCalendar: company.ghlApptCalendar || "",
    ghlApptAssignedUser: company.ghlApptAssignedUser || "",
    ghlInstallAssignedUser: company.ghlInstallAssignedUser || "",
    ghlApptTitleTemplate: company.ghlApptTitleTemplate ?? "",
    ghlInstallTitleTemplate: company.ghlInstallTitleTemplate ?? "",
    ghlApptDescriptionTemplate: company.ghlApptDescriptionTemplate ?? "",
    ghlInstallDescriptionTemplate: company.ghlInstallDescriptionTemplate ?? "",
    showConversations: company.showConversations || false,
    sipDomain: company.sipDomain || company.sip_domain || "",
  });
}}


              >
                GHL Keys
              </button>
            )}

{(isMasterUser || isAdminUser) && (
  <button
    className={sectionBtn(false)}
    onClick={() => setShowEstimatorPricing(true)}
  >
    Estimator
  </button>
)}
{isMasterUser && (
              <button
                className={sectionBtn(false)}
                onClick={() => setShowEstimatorMaster(true)}
              >
                Estimator Admin
              </button>
            )}

{isMasterUser && (
              <button
                className={sectionBtn(activeSection === "tracking")}
                onClick={() => {
                  setActiveSection("tracking");
                  setSectionMode("edit");
setTrackingForm({
                    google_base_tag: company.googleBaseTag || company.google_base_tag || "",
                    meta_base_tag: company.metaBaseTag || company.meta_base_tag || "",
                    google_conversion_event: company.googleConversionEvent || company.google_conversion_event || "",
                    meta_conversion_event: company.metaConversionEvent || company.meta_conversion_event || "",
                    microsoft_base_tag: company.microsoftBaseTag || company.microsoft_base_tag || "",
                    microsoft_conversion_event: company.microsoftConversionEvent || company.microsoft_conversion_event || "",
                  });
                }}
              >
                Tracking
              </button>
            )}

            {isMasterUser && !isCreate && (
              <button
                className={sectionBtn(activeSection === "reports")}
                onClick={() => {
                  setActiveSection("reports");
                  setSectionMode("view");
                }}
              >
                Reports
              </button>
            )}

            {(isMasterUser || isAdminUser) && !isCreate && (
              <button
                className={sectionBtn(activeSection === "users")}
                onClick={() => {
                  setActiveSection("users");
                  setSectionMode("view");
                }}
              >
                Users
              </button>
            )}

            {(isMasterUser || isAdminUser) && !isCreate && (
              <button
                className={sectionBtn(activeSection === "bidder")}
                onClick={() => {
                  setActiveSection("bidder");
                  setSectionMode("view");
                }}
              >
                Bidder
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {activeSection === "info" && renderCompanyInfo()}
{activeSection === "ghl" && renderGHLKeys()}
            {activeSection === "tracking" && renderTracking()}
{activeSection === "users" && (
  <UsersHome
    scopedCompany={company}
    allowAdminAccess={true}
  />
)}

{activeSection === "bidder" && (
  <BidderAdminSettings companyId={company?.id} />
)}

{activeSection === "reports" && renderReports()}

          </div>

          <div className="border-t px-6 py-4 bg-white rounded-b-2xl flex justify-between">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 font-semibold"
            >
              Close
            </button>

            {activeSection === "info" && (
              <button
                onClick={() => {
                  if (sectionMode === "view") {
                    setSectionMode("edit");
                    if (onEdit) onEdit();
                  } else {
                    handleSave();
                  }
                }}
                className="px-6 py-2 rounded-lg bg-blue-600 text-white font-semibold"
                disabled={saving}
              >
                {sectionMode === "view"
                  ? "Edit Company Info"
                  : saving
                  ? "Saving…"
                  : "Save"}
              </button>
            )}

{activeSection === "ghl" && (
              <button
                onClick={handleSaveGHLKeys}
                className="px-6 py-2 rounded-lg bg-blue-600 text-white font-semibold"
                disabled={saving}
              >
                {saving ? "Saving…" : "Save GHL Keys"}
              </button>
            )}

            {activeSection === "tracking" && (
              <button
                onClick={handleSaveTracking}
                className="px-6 py-2 rounded-lg bg-blue-600 text-white font-semibold"
                disabled={saving}
              >
                {saving ? "Saving…" : "Save Tracking Codes"}
              </button>
            )}
          </div>
        </div>
      </div>

      {showEstimatorPricing && (
        <EstimatorPricingModal
          company={company}
          onSave={onSave}
          onClose={() => setShowEstimatorPricing(false)}
        />
      )}

      {showEstimatorMaster && (
        <EstimatorMasterModal
          company={company}
          onSave={onSave}
          onClose={() => setShowEstimatorMaster(false)}
        />
      )}
    </>
  );
}