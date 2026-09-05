// ============================================================================
// File: src/leadModalParts/JobsPanel.jsx
// Multiple jobs per lead — click card to expand/edit inline
// ============================================================================

import React, { useEffect, useState } from "react";
import { JobsAPI } from "../api";
import { useCompany } from "../CompanyContext";
import BidderPanel from "./BidderPanel";

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
  contract_price: "",
  notes: "",
  // jobsite address (prefilled from lead on add)
  address: "",
  city: "",
  state: "",
  zip: "",
};

export default function JobsPanel({ lead, onClose }) {
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
  const [bidsJob, setBidsJob] = useState(null); // job to open BidderPanel for

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

  const openCard = (job) => {
    setEditingId(job.id);
    setIsAddingNew(false);
    setDeleteConfirm(false);
    setShowJobsiteAddress(!!(job.address || job.city || job.state || job.zip));
    setError("");
    setForm({
      job_name: job.jobName || "",
      project_type: job.projectType || "",
      status: job.status || "pending",
      appointment_date: job.appointmentDate ? job.appointmentDate.split("T")[0] : "",
      appointment_time: job.appointmentTime || "",
      install_date: job.installDate ? job.installDate.split("T")[0] : "",
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

  const handleSave = async () => {
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
        closeCard();
      } else {
        const res = await JobsAPI.create(payload, companyId);
        setJobs((prev) => [...prev, res.job]);
        cancelAdd();
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
    <div className="border border-indigo-200 bg-indigo-50 rounded-xl p-4 space-y-3">
      <div className="text-sm font-bold text-indigo-800">
        {editingId ? "Edit Project" : "New Project"}
      </div>

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

      {/* Appointment Date + Time */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Appointment Date</label>
          <input type="date" value={form.appointment_date} onChange={f("appointment_date")} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Appointment Time</label>
          <input type="time" value={form.appointment_time} onChange={f("appointment_time")} className={inputCls} />
        </div>
      </div>

      {/* Install Date + Contract Price */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Install Date</label>
          <input type="date" value={form.install_date} onChange={f("install_date")} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Contract Price</label>
          <input type="number" value={form.contract_price} onChange={f("contract_price")}
            placeholder="0" min="0" step="0.01" className={inputCls} />
        </div>
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

      {/* Bids button — only on existing jobs */}
      {editingId && (
        <button
          type="button"
          onClick={() => {
            const job = jobs.find((j) => j.id === editingId);
            if (job) setBidsJob(job);
          }}
          className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 transition"
        >
          View / Create Bids
        </button>
      )}

      {/* Save / Cancel */}
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving}
          className="flex-1 py-2.5 bg-indigo-700 text-white rounded-lg font-semibold text-sm hover:bg-indigo-800 disabled:opacity-50 transition">
          {saving ? "Saving…" : editingId ? "Save Changes" : "Add Project"}
        </button>
        <button onClick={editingId ? closeCard : cancelAdd} disabled={saving}
          className="py-2.5 px-4 bg-gray-200 text-gray-700 rounded-lg font-semibold text-sm hover:bg-gray-300 disabled:opacity-50 transition">
          Cancel
        </button>
      </div>

      {/* Delete — inside the expanded form only */}
      {editingId && (
        <div className="pt-1 border-t border-indigo-200">
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
              {jobs.map((job) =>
                editingId === job.id ? (
                  <div key={job.id}>{editForm}</div>
                ) : (
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
                )
              )}
            </div>
          )}

          {isAddingNew && editForm}

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

      {/* BidderPanel opens over the JobsPanel for the selected job */}
      {bidsJob && (
        <BidderPanel
          lead={lead}
          job={bidsJob}
          onClose={() => setBidsJob(null)}
        />
      )}
    </div>
  );
}
