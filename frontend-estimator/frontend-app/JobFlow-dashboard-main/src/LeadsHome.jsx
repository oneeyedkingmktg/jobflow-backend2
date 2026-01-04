// ============================================================================
// File: src/LeadsHome.jsx
// Version: v1.5 – Reload leads when company changes
// ============================================================================

import React, { useState, useMemo, useEffect } from "react";
import { apiRequest, LeadsAPI } from "./api";

import LeadModal from "./LeadModal.jsx";
import CalendarView from "./CalendarView.jsx";
import PhoneLookupModal from "./PhoneLookupModal.jsx";

import { useCompany } from "./CompanyContext.jsx";
import { useAuth } from "./AuthContext.jsx";

import LeadHeader from "./leadComponents/LeadHeader.jsx";
import LeadTabs from "./leadComponents/LeadTabs.jsx";
import LeadSearchBar from "./leadComponents/LeadSearchBar.jsx";
import LeadCard from "./leadComponents/LeadCard.jsx";

import { normalizePhone } from "./leadComponents/leadHelpers.js";

// --------------------------------------------------
// Helpers
// --------------------------------------------------
const normalizeDate = (d) => {
  if (!d) return "";
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
    loadLeads();
  }, [currentCompany?.id]);

  // --------------------------------------------------
  // Counts
  // --------------------------------------------------
  const counts = useMemo(
    () => ({
      Leads: leads.filter((l) => l.status === "lead").length,
      "Booked Appt": leads.filter((l) => l.status === "appointment_set").length,
      Sold: leads.filter((l) => l.status === "sold").length,
      "Not Sold": leads.filter((l) => l.status === "not_sold").length,
      Completed: leads.filter((l) => l.status === "complete").length,
      All: leads.length,
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
      const matchesTab =
        activeTab === "All" ||
        (activeTab === "Leads" && lead.status === "lead") ||
        (activeTab === "Booked Appt" && lead.status === "appointment_set") ||
        (activeTab === "Sold" && lead.status === "sold") ||
        (activeTab === "Not Sold" && lead.status === "not_sold") ||
        (activeTab === "Completed" && lead.status === "complete");

      const matchesSearch =
        !searchTerm ||
        lead.name?.toLowerCase().includes(term) ||
        lead.city?.toLowerCase().includes(term) ||
        normalizePhone(lead.phone || "").includes(digits);

      return matchesTab && matchesSearch;
    });
  }, [leads, activeTab, searchTerm]);

  // --------------------------------------------------
  // Render
  // --------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-100">
      <LeadHeader companyName={currentCompany?.name} />

      <LeadTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        counts={counts}
        onAddLead={() => {
          setSelectedLead(null);
          setIsNewLead(true);
          setShowPhoneLookup(true);
        }}
      />

      <LeadSearchBar searchTerm={searchTerm} setSearchTerm={setSearchTerm} />

      <div className="max-w-7xl mx-auto px-4 pb-10">
        {loading ? (
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

      {(selectedLead || isNewLead) && (
        <LeadModal
          lead={selectedLead}
          onSave={async (data) => {
            const res = data.id
              ? await LeadsAPI.update(data.id, data)
              : await LeadsAPI.create(data);
            await loadLeads();
            return res.lead;
          }}
          onSaveAndExit={async (data) => {
            await LeadsAPI.update(data.id, data);
            await loadLeads();
            setSelectedLead(null);
            setIsNewLead(false);
          }}
        />
      )}

      {showPhoneLookup && (
        <PhoneLookupModal
          leads={leads}
          onClose={() => setShowPhoneLookup(false)}
          onCreateNew={(phone) => {
            setSelectedLead({ id: null, name: "", phone, status: "lead" });
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
