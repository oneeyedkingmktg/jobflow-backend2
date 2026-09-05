// ============================================================================
// File: src/LeadsHome.jsx
// Version: v1.6 – Fixed save & exit + new lead creation
// ============================================================================

import React, { useState, useMemo, useEffect, useRef } from "react";
import { apiRequest, LeadsAPI, CrewsAPI, UsersAPI, PermissionRolesAPI, JobsAPI } from "./api";

import LeadModal from "./LeadModal.jsx";
import CalendarView from "./CalendarView.jsx";
import PhoneLookupModal from "./PhoneLookupModal.jsx";

import { useCompany } from "./CompanyContext.jsx";
import { useAuth } from "./AuthContext.jsx";

import LeadsHeader from "./leadComponents/LeadHeader.jsx";



import LeadTabs from "./leadComponents/LeadTabs.jsx";
import JobReportPickerModal from "./leadModalParts/JobReportPickerModal.jsx";
import LeadSearchBar from "./leadComponents/LeadSearchBar.jsx";
import LeadCard from "./leadComponents/LeadCard.jsx";
import JobPipelineCard from "./leadComponents/JobPipelineCard.jsx";

import { normalizePhone } from "./leadComponents/leadHelpers.js";

// --------------------------------------------------
// Helpers
// --------------------------------------------------
const normalizeDate = (d) => {
  if (!d) return null;  // ✅ Changed "" to null
  let str = String(d).trim();
  if (str.includes("T")) str = str.split("T")[0];
  return str;
};

const normalizeStatus = (status) => {
  if (!status) return "lead";
  return String(status).trim().toLowerCase();
};

const convertLeadFromBackend = (lead) => ({
  id: lead.id,
  companyId: lead.companyId,
  createdByUserId: lead.createdByUserId,

  name: lead.fullName || lead.name || "",
  firstName: lead.firstName || "",
  lastName: lead.lastName || "",

  phone: lead.phone,
  email: lead.email,
  preferredContact: lead.preferredContact,

  address: lead.address,
  city: lead.city,
  state: lead.state,
  zip: lead.zip,

  buyerType: lead.buyerType,
  companyName: lead.companyName,
  projectType: lead.projectType,

  leadSource: lead.leadSource,
  referralSource: lead.referralSource,
  utmSource: lead.utmSource || lead.utm_source || null,
  utmMedium: lead.utmMedium || lead.utm_medium || null,

  status: normalizeStatus(lead.status),
  notSoldReason: lead.notSoldReason,
  notes: lead.notes,
  contractPrice: lead.contractPrice,

  appointmentDate: normalizeDate(lead.appointmentDate),
  appointmentTime: lead.appointmentTime || "",
  installDate: normalizeDate(lead.installDate),
  installTentative: lead.installTentative,
  installDurationDays: lead.installDurationDays || 1,
  installEndDate: normalizeDate(lead.installEndDate),

  hasEstimate: lead.hasEstimate === true,
  deletedAt: lead.deletedAt || lead.deleted_at,

  pauseStatus: lead.pauseStatus || null,
  pauseUntil: lead.pauseUntil || null,
  resumeAction: lead.resumeAction || null,
  pauseNotes: lead.pauseNotes || null,

  ghlContactId: lead.ghlContactId || lead.ghl_contact_id || null,
  createdAt: lead.createdAt || lead.created_at || null,

  proceedWithAutomation:
    lead.proceedWithAutomation ?? lead.proceed_with_automation ?? true,

  hasLeftReview: lead.hasLeftReview ?? lead.has_left_review ?? false,

  driveTimeMinutes: lead.driveTimeMinutes ?? lead.drive_time_minutes ?? null,
  outOfArea: lead.outOfArea ?? lead.out_of_area ?? false,

  appointmentSalesmanId: lead.appointmentSalesmanId || null,
});

const convertLeadToBackend = (lead) => ({
  id: lead.id,
  company_id: lead.companyId,
  created_by_user_id: lead.createdByUserId,

  full_name: lead.name,
  first_name: lead.firstName,
  last_name: lead.lastName,

  phone: lead.phone,
  email: lead.email,
  preferred_contact: lead.preferredContact,

  address: lead.address,
  city: lead.city,
  state: lead.state,
  zip: lead.zip,

  buyer_type: lead.buyerType,
  company_name: lead.companyName,
  project_type: lead.projectType,

  lead_source: lead.leadSource,
  referral_source: lead.referralSource,

  status: lead.status,
  not_sold_reason: lead.notSoldReason,
  notes: lead.notes,
  contract_price: lead.contractPrice,

  appointment_date: lead.appointmentDate || null,
  appointment_time: lead.appointmentTime || null,
  appointment_salesman_id: lead.appointmentSalesmanId ? parseInt(lead.appointmentSalesmanId, 10) : null,
  install_date: lead.installDate || null,
  install_tentative: lead.installTentative || false,
  install_duration_days: lead.installDurationDays || 1,
  install_end_date: lead.installEndDate || null,

  has_estimate: lead.hasEstimate || false,

  pause_status: lead.pauseStatus || null,
  pause_until: lead.pauseUntil || null,
  resume_action: lead.resumeAction || null,
  pause_notes: lead.pauseNotes || null,

  proceed_with_automation: lead.proceedWithAutomation ?? null,
  has_left_review: lead.hasLeftReview ?? false,
});


// --------------------------------------------------
// Component
// --------------------------------------------------
export default function LeadsHome() {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const isMasterAdmin = user?.role === "master";

  const [leads, setLeads] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [activeTab, setActiveTab] = useState("Pre-Leads");
  const jobsEnabled = !!(currentCompany?.jobsEnabled ?? currentCompany?.jobs_enabled);
  const [selectedLead, setSelectedLead] = useState(null);
  const [isNewLead, setIsNewLead] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [includeJunk, setIncludeJunk] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showPhoneLookup, setShowPhoneLookup] = useState(false);
  const [showJobReportPicker, setShowJobReportPicker] = useState(false);
  const [serviceCalls, setServiceCalls] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [blockedTimes, setBlockedTimes] = useState([]);
  const [salespeople, setSalespeople] = useState([]);
  const [crewAssignments, setCrewAssignments] = useState({});
  const [individualAssignments, setIndividualAssignments] = useState({});
  const [calendarRolePerms, setCalendarRolePerms] = useState(null);
  const [calendarCrews, setCalendarCrews] = useState([]);

  // --------------------------------------------------
  // Load leads
  // --------------------------------------------------
const loadLeads = async () => {
    if (!currentCompany?.id) return;

    setLoading(true);
    try {
      const includeDeleted = isMasterAdmin ? '&include_deleted=true' : '';
      const res = await apiRequest(
        `/leads?company_id=${currentCompany.id}${includeDeleted}&include_junk=true`
      );

      const rawLeads = Array.isArray(res)
        ? res
        : Array.isArray(res?.leads)
        ? res.leads
        : [];

      setLeads(rawLeads.map(convertLeadFromBackend));
    } finally {
      setLoading(false);
    }
  };

  const loadJobs = async () => {
    if (!currentCompany?.id || !jobsEnabled) return;
    try {
      const data = await JobsAPI.getPipeline(currentCompany.id);
      setJobs(data.jobs || []);
    } catch {
      setJobs([]);
    }
  };

  const refreshServiceCalls = () => {
    if (!currentCompany?.id) return;
    LeadsAPI.getServiceCallsCalendar(currentCompany.id)
      .then((data) => setServiceCalls(data.serviceCalls || []))
      .catch(() => {});
  };

  const loadHolidays = () => {
    apiRequest('/api/holidays')
      .then((data) => setHolidays(Array.isArray(data) ? data : []))
      .catch(() => {});
  };

  const loadBlockedTimes = () => {
    apiRequest('/api/blocked-times')
      .then((data) => setBlockedTimes(Array.isArray(data) ? data : []))
      .catch(() => {});
  };

  const loadCalendarData = () => {
    if (!currentCompany?.id) return;
    UsersAPI.getSalespeople(currentCompany.id)
      .then((data) => setSalespeople(data.salespeople || []))
      .catch(() => {});
    CrewsAPI.getLeadAssignments(currentCompany.id)
      .then((data) => setCrewAssignments(data.assignments || {}))
      .catch(() => {});
    CrewsAPI.getAll(currentCompany.id)
      .then((data) => setCalendarCrews((data.crews || []).filter((c) => c.has_calendar && c.is_active)))
      .catch(() => {});
    CrewsAPI.getLeadIndividualAssignments(currentCompany.id)
      .then((data) => setIndividualAssignments(data.assignments || {}))
      .catch(() => {});
    // Load calendar role permissions for gear panel filtering
    if (user?.role === "user" && (user?.permissionRoleId || user?.permission_role_id)) {
      const roleId = user.permissionRoleId || user.permission_role_id;
      PermissionRolesAPI.getAll(currentCompany.id)
        .then((data) => {
          const myRole = (data.roles || []).find((r) => r.id === roleId);
          setCalendarRolePerms(myRole?.permissions || null);
        })
        .catch(() => {});
    }
  };

  const handleBlockSave = async (data, id) => {
    if (id) {
      await apiRequest(`/api/blocked-times/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    } else {
      await apiRequest('/api/blocked-times', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    }
    loadBlockedTimes();
  };

  const handleBlockDelete = async (id) => {
    await apiRequest(`/api/blocked-times/${id}`, { method: 'DELETE' });
    loadBlockedTimes();
  };

  // Keep a ref so the event listener always calls the latest version
  const refreshServiceCallsRef = useRef(refreshServiceCalls);
  refreshServiceCallsRef.current = refreshServiceCalls;

  // Listen for any SC create/update/delete from anywhere in the app
  useEffect(() => {
    const handler = () => refreshServiceCallsRef.current();
    window.addEventListener('serviceCallsChanged', handler);
    return () => window.removeEventListener('serviceCallsChanged', handler);
  }, []);

  // 🔴 FIX: reload when company changes
  useEffect(() => {
    if (!currentCompany?.id) return;
    loadLeads();
    loadJobs();
    refreshServiceCalls();
    loadHolidays();
    loadBlockedTimes();
    loadCalendarData();
  }, [currentCompany?.id]);

  // Open a specific lead when navigating from Messages → Go to Lead
  useEffect(() => {
    if (!window.__pendingLeadId || leads.length === 0) return;
    const lead = leads.find((l) => l.id === window.__pendingLeadId);
    if (lead) {
      setSelectedLead(lead);
      setIsNewLead(false);
      window.__pendingLeadId = null;
    }
  }, [leads]);

  // Open a specific lead when tapping a push notification (matched by GHL contact ID)
  useEffect(() => {
    if (!window.__pendingGhlContactId || leads.length === 0) return;
    const lead = leads.find((l) => l.ghlContactId === window.__pendingGhlContactId);
    if (lead) {
      setSelectedLead(lead);
      setIsNewLead(false);
      window.__pendingGhlContactId = null;
    }
  }, [leads]);

  // Listen for tap on estimator-only push notification (matched by internal lead ID)
  useEffect(() => {
    const handleOpenLeadById = (e) => {
      const { leadId } = e.detail;
      const lead = leads.find((l) => l.id === leadId);
      if (lead) {
        setSelectedLead(lead);
        setIsNewLead(false);
        window.__pendingLeadId = null;
      }
    };
    window.addEventListener('openLeadById', handleOpenLeadById);
    return () => window.removeEventListener('openLeadById', handleOpenLeadById);
  }, [leads]);

  // Also listen for real-time event when leads are already loaded
  useEffect(() => {
    const handleOpenLead = (e) => {
      const { ghlContactId } = e.detail;
      console.log('🔍 openLeadByGhlContact fired, looking for:', ghlContactId);
      console.log('🔍 leads loaded:', leads.length, 'sample ghlContactIds:', leads.slice(0,3).map(l => l.ghlContactId));
      const lead = leads.find((l) => l.ghlContactId === ghlContactId);
      console.log('🔍 lead found:', lead ? lead.id : 'NOT FOUND');
      if (lead) {
        setSelectedLead(lead);
        setIsNewLead(false);
        window.__pendingGhlContactId = null;
      }
    };
    window.addEventListener('openLeadByGhlContact', handleOpenLead);
    return () => window.removeEventListener('openLeadByGhlContact', handleOpenLead);
  }, [leads]);

  useEffect(() => {
    if (!leads.length) return;
    const pendingId = sessionStorage.getItem('pendingOpenLeadId');
    if (!pendingId) return;
    const id = parseInt(pendingId, 10);
    const lead = leads.find((l) => l.id === id);
    if (lead) {
      sessionStorage.removeItem('pendingOpenLeadId');
      setSelectedLead(lead);
      setIsNewLead(false);
    }
  }, [leads]);

  // --------------------------------------------------
  // Counts
  // --------------------------------------------------
  // Set of lead IDs that have at least one job (used to remove them from Pre-Lead/Lead tabs)
  const leadIdsWithJobs = useMemo(() => new Set(jobs.map((j) => j.leadId)), [jobs]);

  const counts = useMemo(() => {
    if (jobsEnabled) {
      return {
        "Pre-Leads": leads.filter((l) => !l.deletedAt && l.status === "status_pre_lead" && !leadIdsWithJobs.has(l.id)).length,
        Leads: leads.filter((l) => !l.deletedAt && l.status === "lead" && !leadIdsWithJobs.has(l.id)).length,
        "Booked Appt": jobs.filter((j) => j.status === "appt_set").length,
        Sold: jobs.filter((j) => j.status === "sold").length,
        "Not Sold": jobs.filter((j) => j.status === "not_sold").length,
        Completed: jobs.filter((j) => j.status === "complete").length,
        All: leads.filter((l) => !l.deletedAt && l.status !== "status_junk").length,
        Deleted: leads.filter((l) => l.deletedAt).length,
      };
    }
    return {
      "Pre-Leads": leads.filter((l) => !l.deletedAt && l.status === "status_pre_lead").length,
      Leads: leads.filter((l) => !l.deletedAt && l.status === "lead").length,
      "Booked Appt": leads.filter((l) => !l.deletedAt && l.status === "appointment_set").length,
      Sold: leads.filter((l) => !l.deletedAt && l.status === "sold").length,
      "Not Sold": leads.filter((l) => !l.deletedAt && l.status === "not_sold").length,
      Completed: leads.filter((l) => !l.deletedAt && l.status === "complete").length,
      All: leads.filter((l) => !l.deletedAt && l.status !== "status_junk").length,
      Deleted: leads.filter((l) => l.deletedAt).length,
    };
  }, [leads, jobs, jobsEnabled, leadIdsWithJobs]);
  // --------------------------------------------------
  // Filtering
  // --------------------------------------------------
  // Job-mode tabs — these show job cards instead of lead cards when jobs_enabled
  const JOB_TABS = new Set(["Booked Appt", "Sold", "Not Sold", "Completed"]);
  const JOB_STATUS_FOR_TAB = {
    "Booked Appt": "appt_set",
    Sold: "sold",
    "Not Sold": "not_sold",
    Completed: "complete",
  };

  const filteredLeads = useMemo(() => {
    const term = searchTerm.toLowerCase();
    const digits = normalizePhone(searchTerm);

    // When jobs_enabled and on a job-mode tab, leads list is not rendered — skip filtering
    if (jobsEnabled && JOB_TABS.has(activeTab)) return [];

    return leads.filter((lead) => {
      if (lead.status === "status_junk" && !includeJunk) return false;

      if (activeTab === "Deleted") {
        if (!lead.deletedAt) return false;
      } else if (searchTerm) {
        if (lead.deletedAt && !isMasterAdmin) return false;
      } else {
        if (lead.deletedAt) return false;
      }

      // In jobs mode, Pre-Leads and Leads tabs hide contacts that already have a job
      const hasJob = jobsEnabled && leadIdsWithJobs.has(lead.id);

      const matchesTab =
        activeTab === "All" ||
        activeTab === "Deleted" ||
        (activeTab === "Pre-Leads" && lead.status === "status_pre_lead" && !hasJob) ||
        (activeTab === "Leads" && lead.status === "lead" && !hasJob) ||
        (!jobsEnabled && activeTab === "Booked Appt" && lead.status === "appointment_set") ||
        (!jobsEnabled && activeTab === "Sold" && lead.status === "sold") ||
        (!jobsEnabled && activeTab === "Not Sold" && lead.status === "not_sold") ||
        (!jobsEnabled && activeTab === "Completed" && lead.status === "complete");

      const matchesSearch =
        !searchTerm ||
        `${lead.firstName || ""} ${lead.lastName || ""}`.toLowerCase().includes(term) ||
        lead.city?.toLowerCase().includes(term) ||
        (digits && normalizePhone(lead.phone || "").includes(digits));

      return matchesTab && matchesSearch;
    });
  }, [leads, activeTab, searchTerm, isMasterAdmin, includeJunk, jobsEnabled, leadIdsWithJobs]);

  const filteredJobs = useMemo(() => {
    if (!jobsEnabled || !JOB_TABS.has(activeTab)) return [];
    const targetStatus = JOB_STATUS_FOR_TAB[activeTab];
    const term = searchTerm.toLowerCase();
    const digits = normalizePhone(searchTerm);
    return jobs.filter((job) => {
      if (job.status !== targetStatus) return false;
      if (!searchTerm) return true;
      return (
        (job.contactName || "").toLowerCase().includes(term) ||
        (job.jobName || "").toLowerCase().includes(term) ||
        (job.contactCity || "").toLowerCase().includes(term) ||
        (digits && normalizePhone(job.contactPhone || "").includes(digits))
      );
    });
  }, [jobs, activeTab, searchTerm, jobsEnabled]);

  // --------------------------------------------------
  // Render
  // --------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-100">
<LeadsHeader onRefresh={loadLeads} />



<LeadTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        counts={counts}
        onRefresh={loadLeads}
        isMasterAdmin={isMasterAdmin}
        onJobReports={() => setShowJobReportPicker(true)}
onAddLead={() => {
  if (isMasterAdmin) alert("Add Lead clicked! Company ID: " + currentCompany?.id);
  console.log("🆕 Add Lead clicked - Current company:", currentCompany);
  setSelectedLead(null);
  setIsNewLead(true);
  setShowPhoneLookup(true);
}}
      />

<LeadSearchBar
  searchTerm={searchTerm}
  setSearchTerm={setSearchTerm}
  setActiveTab={setActiveTab}
  includeJunk={includeJunk}
  setIncludeJunk={setIncludeJunk}
/>


      <div className="max-w-7xl mx-auto px-4 pb-10">
  {activeTab === "Calendar" ? (
    <CalendarView
      leads={leads}
      serviceCalls={serviceCalls}
      holidays={holidays}
      onSelectLead={(lead) => {
        setSelectedLead(lead);
        setIsNewLead(false);
      }}
      blockedTimes={blockedTimes}
      currentUser={user}
      onBlockSave={handleBlockSave}
      onBlockDelete={handleBlockDelete}
      salespeople={salespeople}
      crewAssignments={crewAssignments}
      individualAssignments={individualAssignments}
      calendarRolePerms={calendarRolePerms}
      calendarCrews={calendarCrews}
    />
  ) : loading ? (
    <div className="py-10 text-center text-gray-600">Loading...</div>
  ) : jobsEnabled && JOB_TABS.has(activeTab) ? (
    filteredJobs.length === 0 ? (
      <div className="py-10 text-center text-gray-500">No jobs found.</div>
    ) : (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredJobs.map((job) => {
          const lead = leads.find((l) => l.id === job.leadId);
          return (
            <JobPipelineCard
              key={job.id}
              job={job}
              onClick={() => {
                if (lead) { setSelectedLead(lead); setIsNewLead(false); }
              }}
            />
          );
        })}
      </div>
    )
  ) : filteredLeads.length === 0 ? (
    <div className="py-10 text-center text-gray-500">No leads found.</div>
  ) : (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
{filteredLeads.map((lead) => (
        <LeadCard
          key={lead.id}
          lead={lead}
          onClick={() => {
            setSelectedLead(lead);
            setIsNewLead(false);
          }}
          onReinstate={isMasterAdmin ? async (lead) => {
            if (!confirm(`Reinstate ${lead.name}? This will restore the contact in both JobFlow and GoHighLevel.`)) {
              return;
            }
            try {
              await apiRequest(`/leads/${lead.id}/reinstate`, {
                method: "POST"
              });
              alert("Contact reinstated successfully!");
              await loadLeads();
            } catch (error) {
              console.error("Reinstate error:", error);
              alert("Failed to reinstate contact");
            }
          } : null}
        />
      ))}
    </div>
  )}
</div>

{(selectedLead || isNewLead) && !showPhoneLookup && (
  <LeadModal
          lead={selectedLead}
          onServiceCallsChange={refreshServiceCalls}
          onReinstate={isMasterAdmin && selectedLead?.deletedAt ? async (lead) => {
            if (!confirm(`Reinstate ${lead.name}? This will restore the contact in both JobFlow and GoHighLevel.`)) {
              return;
            }
            try {
              await apiRequest(`/leads/${lead.id}/reinstate`, {
                method: "POST"
              });
              alert("Contact reinstated successfully!");
              await loadLeads();
              setSelectedLead(null);
              setIsNewLead(false);
            } catch (error) {
              console.error("Reinstate error:", error);
              alert("Failed to reinstate contact");
            }
          } : null}
onSave={async (data) => {
  const backendData = convertLeadToBackend(data);
  if (!data.id && data.forceCreate) backendData.force_create = true;
  const res = data.id
    ? await LeadsAPI.update(data.id, backendData)
    : await LeadsAPI.create(backendData);

  if (res.calendarConflict) {
    alert(`⚠️ ${res.calendarConflict.message}`);
  } else if (res.ghlSynced === false && !res.lead?.appointmentCalendarEventId && res.lead?.appointmentDate) {
    alert("⚠️ Lead saved but not synced with GHL (no API key configured)");
  }

  await loadLeads();
  loadJobs();
  return res.lead;
}}
onSaveAndExit={async (data) => {
  console.log("📤 LeadsHome onSaveAndExit received:", data);
  console.log("🏢 Current company:", currentCompany);
  console.log("👤 Current user:", user);
  
  try {
    const backendData = convertLeadToBackend(data);
    if (!data.id && data.forceCreate) backendData.force_create = true;
    console.log("🔄 Converted to backend format:", backendData);
    console.log("🆔 Company ID being sent:", backendData.company_id);

    const res = data.id
      ? await LeadsAPI.update(data.id, backendData)
      : await LeadsAPI.create(backendData);

    console.log("✅ API response:", res);

    if (res.calendarConflict) {
      alert(`⚠️ ${res.calendarConflict.message}`);
    } else if (res.ghlSynced === false) {
      alert("⚠️ Lead saved but not synced with GHL (no API key configured)");
    }
    
    await loadLeads();
    return res.lead;
  } catch (error) {
    console.error("❌ LeadsHome save error:", error);
    console.error("Data that failed:", data);
    throw error;
  }
}}
          onClose={() => {
            setSelectedLead(null);
            setIsNewLead(false);
          }}

          onDelete={async (lead) => {
  if (!lead?.id) return;
  try {
    await LeadsAPI.delete(lead.id);
    await loadLeads();
    setSelectedLead(null);
    setIsNewLead(false);
  } catch (error) {
    console.error("Delete error:", error);
    alert("Failed to delete lead");
  }
}}
          onJunk={async (lead) => {
  if (!lead?.id) return;
  try {
    const backendData = convertLeadToBackend({ ...lead, status: 'status_junk' });
    await LeadsAPI.update(lead.id, backendData);
    await loadLeads();
    setSelectedLead(null);
    setIsNewLead(false);
  } catch (error) {
    console.error("Junk error:", error);
    alert("Failed to mark as junk");
  }
}}
        />
      )}



      {showJobReportPicker && (
        <JobReportPickerModal
          companyId={currentCompany?.id || currentCompany?.companyId}
          onClose={() => setShowJobReportPicker(false)}
        />
      )}

      {showPhoneLookup && (
        <PhoneLookupModal
          onClose={() => setShowPhoneLookup(false)}
onCreateNew={(phone, forceCreate) => {
  console.log("📝 Creating new lead - Company ID:", currentCompany?.id, "Company:", currentCompany);
  setSelectedLead({
    id: null,
    name: "",
    phone,
    forceCreate: !!forceCreate,
    status: "status_pre_lead",
    companyId: currentCompany?.id,
    createdByUserId: user?.id
  });
  setIsNewLead(true);
  setShowPhoneLookup(false);
}}
          onSelectExisting={(lead) => {
            setSelectedLead(lead);
            setIsNewLead(false);
            setShowPhoneLookup(false);
          }}
        />
      )}
    </div>
  );
}