// ============================================================================
// File: src/leadModalParts/JobsPanel.jsx
// Multiple jobs per lead — click card to expand/edit inline
// ============================================================================

import React, { useEffect, useRef, useState } from "react";
import { JobsAPI } from "../api";
import { useAuth } from "../AuthContext";
import { useCompany } from "../CompanyContext";
import BidderPanel from "./BidderPanel";
import LeadTeamPanel from "./LeadTeamPanel";
import JobReportsPanel from "./JobReportsPanel";
import LeadFilesPanel from "./LeadFilesPanel";
import ApptDateTimeModal from "../ApptDateTimeModal";
import DateModal from "../DateModal";

function formatDisplayDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function formatDisplayDateShort(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatTime12h(time) {
  if (!time) return "";
  const [h, m] = time.split(":");
  let hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${m} ${ampm}`;
}

function daysBetween(startStr, endStr) {
  const start = new Date(startStr + "T12:00:00");
  const end = new Date(endStr + "T12:00:00");
  return Math.round((end - start) / 86400000) + 1;
}

function getMondayOfWeek(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay();
  if (day === 1) return dateStr;
  const offset = day === 0 ? 1 : -(day - 1);
  d.setDate(d.getDate() + offset);
  return d.toISOString().split("T")[0];
}

const PROJECT_TYPES = [
  { value: "", label: "— Select Type —" },
  { value: "garage_1", label: "1 Car Garage" },
  { value: "garage_2", label: "2 Car Garage" },
  { value: "garage_3", label: "3 Car Garage" },
  { value: "garage_4", label: "4+ Car Garage" },
  { value: "patio", label: "Patio" },
  { value: "basement", label: "Basement" },
  { value: "commercial", label: "Commercial" },
  { value: "custom", label: "Custom Project" },
];

const STATUS_OPTIONS = [
  { value: "pending",   label: "Pending" },
  { value: "appt_set",  label: "Booked Appt" },
  { value: "sold",      label: "Sold" },
  { value: "not_sold",  label: "Not Sold" },
  { value: "complete",  label: "Completed" },
];

const STATUS_COLORS = {
  pending:  "bg-purple-100 text-purple-700",
  appt_set: "bg-blue-100 text-blue-700",
  sold:     "bg-emerald-100 text-emerald-700",
  not_sold: "bg-gray-100 text-gray-500",
  complete: "bg-slate-200 text-slate-700",
};

const STATUS_LABELS = {
  pending:  "Pending",
  appt_set: "Booked Appt",
  sold:     "Sold",
  not_sold: "Not Sold",
  complete: "Completed",
};

function formatProjectType(type) {
  if (!type) return null;
  const found = PROJECT_TYPES.find((p) => p.value === type);
  return found ? found.label : type;
}

function money(n) {
  const num = Number(n);
  if (!num) return null;
  return `$${Math.round(num).toLocaleString()}`;
}

const EMPTY_FORM = {
  job_name: "",
  project_type: "",
  status: "pending",
  appointment_date: "",
  appointment_time: "",
  install_date: "",
  install_end_date: "",
  install_tentative: false,
  contract_price: "",
  notes: "",
  // jobsite address (prefilled from lead on add)
  address: "",
  city: "",
  state: "",
  zip: "",
};

export default function JobsPanel({ lead, onClose, initialJobId }) {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id || currentCompany?.companyId || null;

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [showJobsiteAddress, setShowJobsiteAddress] = useState(false);
  const [bidsJob, setBidsJob] = useState(null);
  const [laborJob, setLaborJob] = useState(null);
  const [reportJob, setReportJob] = useState(null);
  const [filesJob, setFilesJob] = useState(null);
  const [showApptModal, setShowApptModal] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);

  const pendingJobIdRef = useRef(initialJobId ?? null);

  useEffect(() => { load(); }, [lead?.id]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await JobsAPI.getAll(lead.id, companyId);
      setJobs(data.jobs || []);
    } catch (err) {
      setError(err.message || "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  };

  // Auto-open a specific job when launched from the pipeline card
  useEffect(() => {
    if (!pendingJobIdRef.current || !jobs.length) return;
    const job = jobs.find((j) => j.id === pendingJobIdRef.current);
    if (job) {
      openCard(job);
      pendingJobIdRef.current = null;
    }
  }, [jobs]);

  const openCard = (job) => {
    setEditingId(job.id);
    setIsAddingNew(false);
    setDeleteConfirm(false);
    setShowJobsiteAddress(false);
    setError("");
    setForm({
      job_name: job.jobName || "",
      project_type: job.projectType || "",
      status: job.status || "pending",
      appointment_date: job.appointmentDate ? job.appointmentDate.split("T")[0] : "",
      appointment_time: job.appointmentTime || "",
      install_date: job.installDate ? job.installDate.split("T")[0] : "",
      install_end_date: job.installEndDate ? job.installEndDate.split("T")[0] : "",
      install_tentative: job.installTentative || false,
      contract_price: job.contractPrice != null ? String(job.contractPrice) : "",
      notes: job.notes || job.description || "",
      address: job.address || "",
      city: job.city || "",
      state: job.state || "",
      zip: job.zip || "",
    });
  };

  const closeCard = () => {
    setEditingId(null);
    setDeleteConfirm(false);
    setShowJobsiteAddress(false);
    setForm(EMPTY_FORM);
    setError("");
  };

  const openAdd = () => {
    setIsAddingNew(true);
    setEditingId(null);
    setDeleteConfirm(false);
    setShowJobsiteAddress(false);
    setError("");
    // Pre-fill jobsite address from contact
    setForm({
      ...EMPTY_FORM,
      address: lead?.address || "",
      city: lead?.city || "",
      state: lead?.state || "",
      zip: lead?.zip || "",
    });
  };

  const cancelAdd = () => {
    setIsAddingNew(false);
    setShowJobsiteAddress(false);
    setForm(EMPTY_FORM);
    setError("");
  };

  const handleSave = async (afterSave) => {
    if (!form.job_name.trim()) {
      setError("Job name is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        lead_id: lead.id,
        job_name: form.job_name.trim(),
        project_type: form.project_type || null,
        status: form.status,
        appointment_date: form.appointment_date || null,
        appointment_time: form.appointment_time || null,
        install_date: form.install_date || null,
        install_end_date: form.install_end_date || null,
        install_tentative: form.install_tentative || false,
        contract_price: form.contract_price ? parseFloat(form.contract_price) : null,
        notes: form.notes || null,
        address: form.address || null,
        city: form.city || null,
        state: form.state || null,
        zip: form.zip || null,
      };
      if (editingId) {
        const res = await JobsAPI.update(editingId, payload, companyId);
        setJobs((prev) => prev.map((j) => (j.id === editingId ? res.job : j)));
        if (afterSave) afterSave();
      } else {
        const res = await JobsAPI.create(payload, companyId);
        setJobs((prev) => [...prev, res.job]);
        // Transition into edit mode so action buttons appear; don't close form
        setIsAddingNew(false);
        setEditingId(res.job.id);
      }
    } catch (err) {
      setError(err.message || "Failed to save job");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingId) return;
    try {
      await JobsAPI.delete(editingId, companyId);
      setJobs((prev) => prev.filter((j) => j.id !== editingId));
      closeCard();
    } catch (err) {
      setError(err.message || "Failed to delete job");
    }
  };

  const f = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }));

  const inputCls = "w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";
  const labelCls = "block text-xs font-semibold text-gray-700 mb-1";

  const editForm = (
    <div className="space-y-3">

      {/* Project Name */}
      <div>
        <label className={labelCls}>Project Name <span className="text-red-500">*</span></label>
        <input type="text" value={form.job_name} onChange={f("job_name")}
          placeholder="e.g. Garage Floor — 3 Car" className={inputCls} />
      </div>

      {/* Project Type + Status */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Project Type</label>
          <select value={form.project_type} onChange={f("project_type")} className={inputCls}>
            {PROJECT_TYPES.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Status</label>
          <select value={form.status} onChange={f("status")} className={inputCls}>
            {STATUS_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Appointment */}
      <div>
        <label className={labelCls}>Appointment</label>
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 flex items-center justify-between gap-2">
          <div className="text-sm leading-snug">
            {form.appointment_date ? (
              <span className="font-medium text-gray-800">
                {formatDisplayDate(form.appointment_date)}
                {form.appointment_time && (
                  <span className="text-indigo-700 ml-1">• {formatTime12h(form.appointment_time)}</span>
                )}
              </span>
            ) : (
              <span className="text-gray-400 italic text-sm">No appointment set</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowApptModal(true)}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 whitespace-nowrap shrink-0"
          >
            {form.appointment_date ? "Edit" : "Set Appointment"}
          </button>
        </div>
      </div>

      {/* Install */}
      <div>
        <label className={labelCls}>Install Date</label>
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 flex items-center justify-between gap-2">
          <div className="text-sm leading-snug">
            {form.install_date ? (() => {
              if (form.install_tentative) {
                return <span className="font-medium text-gray-800">Week of {formatDisplayDateShort(getMondayOfWeek(form.install_date))} <span className="text-gray-400 text-xs">(Tentative)</span></span>;
              }
              if (form.install_end_date && form.install_end_date !== form.install_date) {
                const days = daysBetween(form.install_date, form.install_end_date);
                return <span className="font-medium text-gray-800">{formatDisplayDateShort(form.install_date)} – {formatDisplayDateShort(form.install_end_date)} <span className="text-indigo-700">({days} days)</span></span>;
              }
              return <span className="font-medium text-gray-800">{formatDisplayDate(form.install_date)}</span>;
            })() : (
              <span className="text-gray-400 italic text-sm">No install date set</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowInstallModal(true)}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 whitespace-nowrap shrink-0"
          >
            {form.install_date ? "Edit" : "Set Install"}
          </button>
        </div>
      </div>

      {/* Contract Price */}
      <div>
        <label className={labelCls}>Contract Price</label>
        <input type="number" value={form.contract_price} onChange={f("contract_price")}
          placeholder="0" min="0" step="0.01" className={inputCls} />
      </div>

      {/* Notes */}
      <div>
        <label className={labelCls}>Notes</label>
        <textarea value={form.notes} onChange={f("notes")}
          placeholder="Optional notes…" rows={2}
          className={`${inputCls} resize-none`} />
      </div>

      {/* Jobsite Address — small toggle */}
      <div>
        {!showJobsiteAddress ? (
          <button
            type="button"
            onClick={() => setShowJobsiteAddress(true)}
            className="text-xs text-indigo-600 font-semibold hover:text-indigo-800 transition"
          >
            + Edit jobsite address
          </button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-700">Jobsite Address</span>
              <button
                type="button"
                onClick={() => setShowJobsiteAddress(false)}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                hide
              </button>
            </div>
            <input type="text" value={form.address} onChange={f("address")}
              placeholder="Street address" className={inputCls} />
            <div className="grid grid-cols-3 gap-2">
              <input type="text" value={form.city} onChange={f("city")}
                placeholder="City" className={inputCls} />
              <input type="text" value={form.state} onChange={f("state")}
                placeholder="State" className={inputCls} />
              <input type="text" value={form.zip} onChange={f("zip")}
                placeholder="Zip" className={inputCls} />
            </div>
          </div>
        )}
      </div>

      {/* Action buttons + save controls — layout differs for new vs existing */}
      {editingId ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => { const job = jobs.find((j) => j.id === editingId); if (job) setBidsJob(job); }}
              className="py-2.5 bg-blue-600 text-white rounded-lg font-semibold text-xs hover:bg-blue-700 transition text-center"
            >
              View / Create Bids
            </button>
            <button
              type="button"
              onClick={() => { const job = jobs.find((j) => j.id === editingId); if (job) setLaborJob(job); }}
              className="py-2.5 bg-blue-600 text-white rounded-lg font-semibold text-xs hover:bg-blue-700 transition text-center"
            >
              Manage Labor
            </button>
            <button
              type="button"
              onClick={() => { const job = jobs.find((j) => j.id === editingId); if (job) setReportJob(job); }}
              className="py-2.5 bg-blue-600 text-white rounded-lg font-semibold text-xs hover:bg-blue-700 transition text-center"
            >
              Project Report
            </button>
            <button
              type="button"
              onClick={() => { const job = jobs.find((j) => j.id === editingId); if (job) setFilesJob(job); }}
              className="py-2.5 bg-blue-600 text-white rounded-lg font-semibold text-xs hover:bg-blue-700 transition text-center"
            >
              Files &amp; Photos
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={() => handleSave()} disabled={saving}
              className="flex-1 py-2.5 bg-indigo-700 text-white rounded-lg font-semibold text-sm hover:bg-indigo-800 disabled:opacity-50 transition">
              {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={() => handleSave(closeCard)} disabled={saving}
              className="flex-1 py-2.5 bg-green-700 text-white rounded-lg font-semibold text-sm hover:bg-green-800 disabled:opacity-50 transition">
              {saving ? "Saving…" : "Save & Exit"}
            </button>
            <button onClick={closeCard} disabled={saving}
              className="py-2.5 px-4 bg-gray-200 text-gray-700 rounded-lg font-semibold text-sm hover:bg-gray-300 disabled:opacity-50 transition">
              Cancel
            </button>
          </div>
        </>
      ) : (
        <div className="flex gap-2">
          <button onClick={() => handleSave()} disabled={saving}
            className="flex-1 py-2.5 bg-indigo-700 text-white rounded-lg font-semibold text-sm hover:bg-indigo-800 disabled:opacity-50 transition">
            {saving ? "Saving…" : "Add Project"}
          </button>
          <button onClick={cancelAdd} disabled={saving}
            className="py-2.5 px-4 bg-gray-200 text-gray-700 rounded-lg font-semibold text-sm hover:bg-gray-300 disabled:opacity-50 transition">
            Cancel
          </button>
        </div>
      )}

      {/* Delete — inside the expanded form only */}
      {editingId && (
        <div className="pt-1 border-t border-gray-200">
          {deleteConfirm ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-red-700 font-semibold">Delete this project?</span>
              <div className="flex gap-2">
                <button onClick={handleDelete}
                  className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition">
                  Yes, Delete
                </button>
                <button onClick={() => setDeleteConfirm(false)}
                  className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-300 transition">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setDeleteConfirm(true)}
              className="text-xs text-red-500 font-semibold hover:text-red-700 transition">
              Delete Project
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black/60 backdrop-blur-sm">
      <div className="flex flex-col bg-white w-full h-full max-w-lg mx-auto shadow-2xl md:rounded-2xl md:my-8 md:h-auto md:max-h-[90vh]">

        {/* HEADER */}
        <div className="bg-indigo-700 text-white px-6 py-4 flex items-center justify-between shrink-0 md:rounded-t-2xl">
          <div>
            <h2 className="text-lg font-bold">Projects</h2>
            <p className="text-indigo-200 text-sm mt-0.5 truncate">{lead?.name}</p>
          </div>
          <button onClick={onClose} className="text-indigo-200 hover:text-white text-2xl leading-none px-2">×</button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-3 text-red-800 text-sm rounded">{error}</div>
          )}

          {loading ? (
            <div className="text-sm text-gray-400 text-center py-10">Loading…</div>
          ) : jobs.length === 0 && !isAddingNew ? (
            <div className="text-sm text-gray-400 text-center py-10 border border-dashed border-gray-200 rounded-xl">
              No projects yet. Add the first one below.
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  onClick={() => openCard(job)}
                  className="p-4 bg-gray-50 rounded-xl border border-gray-100 cursor-pointer hover:bg-gray-100 hover:border-indigo-200 transition"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 text-sm truncate">{job.jobName}</div>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[job.status] || "bg-gray-100 text-gray-500"}`}>
                          {STATUS_LABELS[job.status] || job.status}
                        </span>
                        {job.projectType && (
                          <span className="text-xs text-gray-500">{formatProjectType(job.projectType)}</span>
                        )}
                        {job.contractPrice && (
                          <span className="text-xs text-gray-500">{money(job.contractPrice)}</span>
                        )}
                        {job.appointmentDate && (
                          <span className="text-xs text-gray-400">
                            Appt {new Date(job.appointmentDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {(job.notes || job.description) && (
                        <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{job.notes || job.description}</p>
                      )}
                    </div>
                    <span className="text-gray-400 text-xs mt-1 shrink-0">›</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isAddingNew && !editingId && (
            <button onClick={openAdd}
              className="w-full py-3 bg-indigo-700 text-white rounded-xl font-semibold text-sm hover:bg-indigo-800 transition">
              + Add Project
            </button>
          )}
        </div>

        {/* FOOTER */}
        <div className="border-t px-6 py-4 bg-gray-50 shrink-0 md:rounded-b-2xl">
          <button onClick={onClose}
            className="w-full py-2.5 bg-gray-200 text-gray-700 rounded-lg font-semibold text-sm hover:bg-gray-300 transition">
            Done
          </button>
        </div>
      </div>

      {/* Project Edit / New Modal */}
      {(editingId || isAddingNew) && (
        <div className="fixed inset-0 z-[210] flex flex-col bg-black/60 backdrop-blur-sm">
          <div className="flex flex-col bg-white w-full h-full max-w-lg mx-auto shadow-2xl md:rounded-2xl md:my-8 md:h-auto md:max-h-[90vh]">
            <div className="bg-indigo-700 text-white px-6 py-4 flex items-center justify-between shrink-0 md:rounded-t-2xl">
              <div>
                <h2 className="text-lg font-bold">{isAddingNew ? "New Project" : "Edit Project"}</h2>
                <p className="text-indigo-200 text-sm mt-0.5 truncate">{lead?.name}</p>
              </div>
              <button
                onClick={isAddingNew ? cancelAdd : closeCard}
                className="text-indigo-200 hover:text-white text-2xl leading-none px-2"
              >×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {error && (
                <div className="bg-red-50 border-l-4 border-red-500 p-3 text-red-800 text-sm rounded mb-4">{error}</div>
              )}
              {editForm}
            </div>
          </div>
        </div>
      )}

      {/* BidderPanel opens over the JobsPanel for the selected job */}
      {bidsJob && (
        <BidderPanel
          lead={lead}
          job={bidsJob}
          onClose={() => { setBidsJob(null); load(); }}
        />
      )}

      {/* LeadTeamPanel opens for the selected project */}
      {laborJob && (
        <LeadTeamPanel
          lead={lead}
          job={laborJob}
          companyId={companyId}
          currentUser={user}
          onClose={() => setLaborJob(null)}
        />
      )}

      {/* JobReportsPanel opens for the selected project */}
      {reportJob && (
        <JobReportsPanel
          lead={lead}
          job={reportJob}
          onClose={() => setReportJob(null)}
        />
      )}

      {/* LeadFilesPanel opens scoped to the selected project */}
      {filesJob && (
        <LeadFilesPanel
          leadId={lead.id}
          jobId={filesJob.id}
          jobName={filesJob.jobName}
          onClose={() => setFilesJob(null)}
        />
      )}

      {/* Appointment date/time picker */}
      {showApptModal && (
        <ApptDateTimeModal
          apptDate={form.appointment_date || null}
          apptTime={form.appointment_time || null}
          companyId={companyId}
          requireSalesman={false}
          zClassName="z-[220]"
          onConfirm={(date, time24) => {
            setForm((p) => ({ ...p, appointment_date: date, appointment_time: time24 }));
          }}
          onRemove={() => {
            setForm((p) => ({ ...p, appointment_date: "", appointment_time: "" }));
          }}
          onClose={() => setShowApptModal(false)}
        />
      )}

      {/* Install date picker */}
      {showInstallModal && (
        <DateModal
          initialDate={form.install_date || null}
          initialEndDate={form.install_end_date || null}
          initialTentative={form.install_tentative || false}
          initialDurationDays={
            form.install_date && form.install_end_date
              ? daysBetween(form.install_date, form.install_end_date)
              : 1
          }
          label="Set Install Date"
          allowTentative={true}
          zClassName="z-[220]"
          onConfirm={(startDate, tentative, duration, endDate) => {
            setForm((p) => ({
              ...p,
              install_date: startDate,
              install_end_date: endDate || null,
              install_tentative: tentative,
            }));
          }}
          onRemove={() => {
            setForm((p) => ({ ...p, install_date: "", install_end_date: "", install_tentative: false }));
          }}
          onClose={() => setShowInstallModal(false)}
        />
      )}
    </div>
  );
}
