// ============================================================================
// File: src/LeadsHome.jsx
// Version: v1.6 – Fixed save & exit + new lead creation
// ============================================================================

import React, { useState, useMemo, useEffect } from "react";
import { apiRequest, LeadsAPI } from "./api";

import LeadModal from "./LeadModal.jsx";
import CalendarView from "./CalendarView.jsx";
import PhoneLookupModal from "./PhoneLookupModal.jsx";

import { useCompany } from "./CompanyContext.jsx";
import { useAuth } from "./AuthContext.jsx";

import LeadsHeader from "./leadComponents/LeadHeader.jsx";



import LeadTabs from "./leadComponents/LeadTabs.jsx";
import LeadSearchBar from "./leadComponents/LeadSearchBar.jsx";
import LeadCard from "./leadComponents/LeadCard.jsx";

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

  status: normalizeStatus(lead.status),
  notSoldReason: lead.notSoldReason,
  notes: lead.notes,
  contractPrice: lead.contractPrice,

  appointmentDate: normalizeDate(lead.appointmentDate),
  appointmentTime: lead.appointmentTime || "",
  installDate: normalizeDate(lead.installDate),
  installTentative: lead.installTentative,

hasEstimate: lead.hasEstimate === true,
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
  install_date: lead.installDate || null,
  install_tentative: lead.installTentative || false,

  has_estimate: lead.hasEstimate || false,
});


// --------------------------------------------------
// Component
// --------------------------------------------------
export default function LeadsHome() {
  const { currentCompany } = useCompany();
  const { user } = useAuth();

  const [leads, setLeads] = useState([]);
  const [activeTab, setActiveTab] = useState("Leads");
  const [selectedLead, setSelectedLead] = useState(null);
  const [isNewLead, setIsNewLead] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [showPhoneLookup, setShowPhoneLookup] = useState(false);

  // --------------------------------------------------
  // Load leads
  // --------------------------------------------------
  const loadLeads = async () => {
    if (!currentCompany?.id) return;

    setLoading(true);
    try {
      const res = await apiRequest(
        `/leads?company_id=${currentCompany.id}`
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

  // 🔴 FIX: reload when company changes
  useEffect(() => {
    if (!currentCompany?.id) return;
    loadLeads();
  }, [currentCompany?.id]);


  // --------------------------------------------------
  // Counts
  // --------------------------------------------------
const counts = useMemo(
    () => ({
      "Pre-Leads": leads.filter((l) => l.status === "status_pre_lead").length,
      Leads: leads.filter((l) => l.status === "lead").length,
      "Booked Appt": leads.filter((l) => l.status === "appointment_set").length,
      Sold: leads.filter((l) => l.status === "sold").length,
      "Not Sold": leads.filter((l) => l.status === "not_sold").length,
      Completed: leads.filter((l) => l.status === "complete").length,
      All: leads.filter((l) => l.status !== "status_junk").length,
    }),
    [leads]
  );

  // --------------------------------------------------
  // Filtering
  // --------------------------------------------------
const filteredLeads = useMemo(() => {
    const term = searchTerm.toLowerCase();
    const digits = normalizePhone(searchTerm);

    return leads.filter((lead) => {
      // Always exclude junk leads
      if (lead.status === "status_junk") return false;

      const matchesTab =
        activeTab === "All" ||
        (activeTab === "Pre-Leads" && lead.status === "status_pre_lead") ||
        (activeTab === "Leads" && lead.status === "lead") ||
        (activeTab === "Booked Appt" && lead.status === "appointment_set") ||
        (activeTab === "Sold" && lead.status === "sold") ||
        (activeTab === "Not Sold" && lead.status === "not_sold") ||
        (activeTab === "Completed" && lead.status === "complete");

const matchesSearch =
  !searchTerm ||
  `${lead.firstName || ""} ${lead.lastName || ""}`
    .toLowerCase()
    .includes(term) ||
  lead.city?.toLowerCase().includes(term) ||
  (digits && normalizePhone(lead.phone || "").includes(digits));



      return matchesTab && matchesSearch;
    });
  }, [leads, activeTab, searchTerm]);

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
onAddLead={() => {

  alert("Add Lead clicked! Company ID: " + currentCompany?.id);
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
/>


      <div className="max-w-7xl mx-auto px-4 pb-10">
  {activeTab === "Calendar" ? (
    <CalendarView
      leads={leads}
      onSelectLead={(lead) => {
        setSelectedLead(lead);
        setIsNewLead(false);
      }}
    />
  ) : loading ? (
    <div className="py-10 text-center text-gray-600">Loading...</div>
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
        />
      ))}
    </div>
  )}
</div>

{(selectedLead || isNewLead) && !showPhoneLookup && (
  <LeadModal
          lead={selectedLead}
onSave={async (data) => {
  const backendData = convertLeadToBackend(data);
  const res = data.id
    ? await LeadsAPI.update(data.id, backendData)
    : await LeadsAPI.create(backendData);
  
  if (res.ghlSynced === false) {
    alert("⚠️ Lead saved but not synced with GHL (no API key configured)");
  }
  
  await loadLeads();
  return res.lead;
}}
onSaveAndExit={async (data) => {
  console.log("📤 LeadsHome onSaveAndExit received:", data);
  console.log("🏢 Current company:", currentCompany);
  console.log("👤 Current user:", user);
  
  try {
    const backendData = convertLeadToBackend(data);
    console.log("🔄 Converted to backend format:", backendData);
    console.log("🆔 Company ID being sent:", backendData.company_id);
    
    const res = data.id
      ? await LeadsAPI.update(data.id, backendData)
      : await LeadsAPI.create(backendData);

    console.log("✅ API response:", res);
    
    if (res.ghlSynced === false) {
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
        />
      )}



      {showPhoneLookup && (
        <PhoneLookupModal
          leads={leads}
          onClose={() => setShowPhoneLookup(false)}
onCreateNew={(phone) => {
  console.log("📝 Creating new lead - Company ID:", currentCompany?.id, "Company:", currentCompany);
  setSelectedLead({ 
    id: null, 
    name: "", 
    phone, 
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