// ============================================================================
// File: src/leadModalParts/LeadDetailsView.jsx
// Version: v1.6 – Added Conversations button and modal
// ============================================================================
import React, { useState, useEffect } from "react";
import EstimateModal from "../EstimateModal.jsx";
import ConversationModal from "./ConversationModal.jsx";
import LeadFilesPanel from "./LeadFilesPanel.jsx";
import BidderPanel from "./BidderPanel.jsx";
import LeadTeamPanel from "./LeadTeamPanel.jsx";
import JobReportsPanel from "./JobReportsPanel.jsx";
import { useAuth } from "../AuthContext";
import { useCompany } from "../CompanyContext";
import { BidderAPI } from "../api";
import { usePermission } from "../utils/usePermission";

export default function LeadDetailsView({
  form,
  onEdit,
  showConversations = false,
}) {
const hasEstimate = form?.hasEstimate === true;
  const isOutOfAreaLargeJob = form?.outOfAreaLargeJob === true;
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const isEstimatorOnly = user?.planType === 'estimator_only';
  const financialPermission = usePermission('financial_information');
  const contactEditPermission = usePermission('contact_editing');
  const customerCommsPermission = usePermission('customer_communications');
  const bidderPermission = usePermission('bidder');
  const bidderEnabled = currentCompany?.bidderEnabled ?? currentCompany?.bidder_enabled ?? false;
  const [outOfAreaActionDone, setOutOfAreaActionDone] = useState(null); // 'accepted' | 'declined'
  const [showEstimateModal, setShowEstimateModal] = useState(false);
  const [estimateData, setEstimateData] = useState(null);
  const [showConversationModal, setShowConversationModal] = useState(false);
  const [showFilesModal, setShowFilesModal] = useState(false);
  const [showBidderPanel, setShowBidderPanel] = useState(false);
  const [bidCount, setBidCount] = useState(null);
  const [showTeamPanel, setShowTeamPanel] = useState(false);
  const [showJobReports, setShowJobReports] = useState(false);

  useEffect(() => {
    if (form?.id && !isEstimatorOnly && bidderEnabled) {
      BidderAPI.getProposals(form.id)
        .then(bids => setBidCount(bids.length))
        .catch(() => {});
    }
  }, [form?.id]);

  const handleAcceptOutOfArea = async () => {
    try {
      const { apiRequest } = await import("../api.js");
      await apiRequest(`/leads/${form.id}/accept-out-of-area`, { method: "PUT" });
      setOutOfAreaActionDone("accepted");
    } catch (err) {
      console.error("Failed to accept out-of-area lead:", err);
      alert("Could not accept lead. Please try again.");
    }
  };

  const handleDeclineOutOfArea = async () => {
    if (!window.confirm("Mark this lead as junk? This cannot be undone easily.")) return;
    try {
      const { apiRequest } = await import("../api.js");
      await apiRequest(`/leads/${form.id}`, {
        method: "PUT",
        body: JSON.stringify({ status: "status_junk" }),
      });
      setOutOfAreaActionDone("declined");
    } catch (err) {
      console.error("Failed to decline out-of-area lead:", err);
      alert("Could not decline lead. Please try again.");
    }
  };

  const loadEstimate = async () => {
    try {
      const { apiRequest } = await import("../api.js");
      const data = await apiRequest(`/leads/estimator/${form.id}`);
      setEstimateData(data);
      setShowEstimateModal(true);
    } catch (err) {
      console.error("Failed to load estimate:", err);
      alert("Could not load estimate details");
    }
  };

  const formatProjectType = (type) => {
    if (!type) return "Not Set";
    if (type.startsWith("garage_")) {
      const carCount = type.split("_")[1];
      return `${carCount} Car Garage`;
    }
    if (type === "patio") return "Patio";
    if (type === "basement") return "Basement";
    if (type === "commercial") return "Commercial";
    if (type === "custom") return "Custom Project";
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <>
      {/* MAIN DETAILS CARD */}
      <div
        className={`bg-[#f5f6f7] rounded-2xl border border-gray-200 px-5 py-5 shadow-sm text-sm text-gray-800 space-y-4 transition-shadow${contactEditPermission === 'edit' ? ' cursor-pointer hover:shadow-md' : ''}`}
        onClick={contactEditPermission === 'edit' ? onEdit : undefined}
      >
        <div>
          <span className="text-gray-500 block">Email</span>
          <span className="font-semibold break-words">
            {form.email || "Not Set"}
          </span>
        </div>

        <div>
          <span className="text-gray-500 block">Buyer Type</span>
          <span className="font-semibold break-words">
            {form.buyerType || "Not Set"}
          </span>
        </div>

        {form.companyName && (
          <div>
            <span className="text-gray-500 block">Company</span>
            <span className="font-semibold break-words">
              {form.companyName}
            </span>
          </div>
        )}

        <div>
          <span className="text-gray-500 block">Project Type</span>
          <span className="font-semibold break-words">
            {formatProjectType(form.projectType)}
          </span>
        </div>

        {financialPermission !== 'hide' && (
          <div>
            <span className="text-gray-500 block">Contract Price</span>
            <span className="font-semibold break-words">
              {form.contractPrice
                ? `$${Number(form.contractPrice).toLocaleString()}`
                : "Not Set"}
            </span>
          </div>
        )}

        <div>
          <span className="text-gray-500 block">Notes</span>
          <p className="font-semibold whitespace-pre-line mt-1 break-words">
            {form.notes?.trim() ? form.notes : "No notes added"}
          </p>
        </div>

        <div>
          <span className="text-gray-500 block">Lead Source</span>
          <span className="font-semibold break-words">
            {form.referralSource || "Not Set"}
          </span>
        </div>

        {(user?.role === "master" || user?.role === "admin") && (form.utmSource || form.utmMedium) && (
          <div>
            <span className="text-gray-500 block">Traffic Source</span>
            <span className="font-semibold break-words">
              {[form.utmSource, form.utmMedium].filter(Boolean).join(" - ")}
            </span>
          </div>
        )}

        <div>
          <span className="text-gray-500 block">Date Added</span>
          <span className="font-semibold break-words">
            {form.createdAt
              ? new Date(form.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
              : "Not Set"}
          </span>
        </div>

        {(form.dateCompleted || form.date_completed) && (
          <div>
            <span className="text-gray-500 block">Install Completed</span>
            <span className="font-semibold break-words">
              {(() => {
                const d = form.dateCompleted || form.date_completed;
                const [y, m, day] = d.slice(0, 10).split("-");
                return new Date(parseInt(y), parseInt(m) - 1, parseInt(day))
                  .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
              })()}
            </span>
          </div>
        )}
      </div>

{/* OUT OF AREA LARGE JOB SECTION */}
      {isOutOfAreaLargeJob && !outOfAreaActionDone && (
        <div className="mt-4 bg-amber-50 border border-amber-300 rounded-xl px-4 py-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">🧭</span>
            <span className="font-bold text-amber-900 text-sm">Contact is out of area but may be worth pursuing.</span>
          </div>
          <div className="flex gap-3 mt-3">
            <button
              type="button"
              onClick={handleAcceptOutOfArea}
              className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-lg font-semibold text-sm hover:bg-emerald-700 transition"
            >
              Accept Lead
            </button>
            <button
              type="button"
              onClick={handleDeclineOutOfArea}
              className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg font-semibold text-sm hover:bg-red-700 transition"
            >
              Decline Lead
            </button>
          </div>
        </div>
      )}
      {outOfAreaActionDone === "accepted" && (
        <div className="mt-4 bg-emerald-50 border border-emerald-300 rounded-xl px-4 py-3 text-sm text-emerald-800 font-semibold text-center">
          Lead accepted. Out-of-area flag removed.
        </div>
      )}
      {outOfAreaActionDone === "declined" && (
        <div className="mt-4 bg-gray-100 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-600 font-semibold text-center">
          Lead declined and marked as junk.
        </div>
      )}

{/* ACTION BUTTONS GRID */}
      <div className="mt-4 grid grid-cols-2 gap-3">

        {/* Conversations */}
        {showConversations && customerCommsPermission !== 'hide' && (
          isEstimatorOnly ? (
            <div className="px-3 py-3 bg-gray-100 text-gray-400 rounded-xl font-semibold text-sm text-center border border-gray-200 cursor-not-allowed leading-tight">
              🔒 Messages<br/>Upgrade to Pro
            </div>
          ) : (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowConversationModal(true); }}
              className="px-3 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm shadow hover:bg-blue-700 transition text-center leading-tight"
            >
              View Conversation History
            </button>
          )
        )}

        {/* Online Estimate */}
        {hasEstimate && financialPermission !== 'hide' && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); loadEstimate(); }}
            className="px-3 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm shadow hover:bg-blue-700 transition text-center leading-tight"
          >
            View Online Estimate
          </button>
        )}

        {/* Photos & Files */}
        {contactEditPermission !== 'hide' && (
          isEstimatorOnly ? (
            <div className="px-3 py-3 bg-gray-100 text-gray-400 rounded-xl font-semibold text-sm text-center border border-gray-200 cursor-not-allowed leading-tight">
              🔒 Upgrade to Pro for jobsite photos
            </div>
          ) : (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowFilesModal(true); }}
              className="px-3 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm shadow hover:bg-blue-700 transition text-center leading-tight"
            >
              Photos &amp; Files
            </button>
          )
        )}

        {/* Bids */}
        {!isEstimatorOnly && bidderEnabled && bidderPermission !== 'hide' && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowBidderPanel(true); }}
            className="px-3 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm shadow hover:bg-blue-700 transition text-center leading-tight"
          >
            {bidCount === null ? 'Bids' : bidCount === 0 ? '+ New Bid' : `View Bids (${bidCount})`}
          </button>
        )}

        {/* Assign Team */}
        {!isEstimatorOnly && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowTeamPanel(true); }}
            className="px-3 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm shadow hover:bg-blue-700 transition text-center leading-tight"
          >
            Assign Crew
          </button>
        )}

        {/* Job Report */}
        {!isEstimatorOnly && (user?.role === "admin" || user?.role === "master") && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowJobReports(true); }}
            className="px-3 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm shadow hover:bg-blue-700 transition text-center leading-tight"
          >
            Job Report
          </button>
        )}

      </div>

      {/* FILES MODAL */}
      {showFilesModal && (
        <LeadFilesPanel leadId={form?.id} projectType={form?.projectType ?? ""} onClose={() => setShowFilesModal(false)} />
      )}

      {/* BIDDER PANEL */}
      {showBidderPanel && (
        <BidderPanel
          lead={form}
          onClose={() => { setShowBidderPanel(false); BidderAPI.getProposals(form.id).then(b => setBidCount(b.length)).catch(() => {}); }}
        />
      )}
{/* ESTIMATE MODAL */}
      {showEstimateModal && estimateData && (
        <EstimateModal
          estimate={estimateData}
          onClose={() => setShowEstimateModal(false)}
        />
      )}

      {/* CONVERSATION MODAL */}
      {showConversationModal && (
        <ConversationModal
          lead={form}
          onClose={() => setShowConversationModal(false)}
        />
      )}

      {/* TEAM PANEL */}
      {showTeamPanel && (
        <LeadTeamPanel
          lead={form}
          companyId={currentCompany?.id || currentCompany?.companyId}
          onClose={() => setShowTeamPanel(false)}
        />
      )}

      {/* JOB REPORTS PANEL */}
      {showJobReports && (
        <JobReportsPanel
          lead={form}
          onClose={() => setShowJobReports(false)}
        />
      )}
    </>
  );
}
