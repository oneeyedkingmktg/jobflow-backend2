// ============================================================================
// File: src/leadModalParts/JobsPanel.jsx
// Multiple jobs per lead — click a card to expand/edit inline
// ============================================================================

import React, { useEffect, useState } from "react";
import { JobsAPI } from "../api";
import { useCompany } from "../CompanyContext";

const STATUS_LABELS = {
  appt_set: "Booked Appt",
  sold: "Sold",
  not_sold: "Not Sold",
  complete: "Completed",
};

const STATUS_COLORS = {
  appt_set: "bg-blue-100 text-blue-700",
  sold: "bg-emerald-100 text-emerald-700",
  not_sold: "bg-gray-100 text-gray-500",
  complete: "bg-slate-200 text-slate-700",
};

const EMPTY_FORM = {
  job_name: "",
  status: "appt_set",
  contract_price: "",
  start_date: "",
  description: "",
};

function money(n) {
  const num = Number(n);
  if (!num) return null;
  return `$${Math.round(num).toLocaleString()}`;
}

export default function JobsPanel({ lead, onClose }) {
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id || currentCompany?.companyId || null;

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // editingId: which job card is currently expanded (null = none)
  const [editingId, setEditingId] = useState(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    load();
  }, [lead?.id]);

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
    setError("");
    setForm({
      job_name: job.jobName || "",
      status: job.status || "appt_set",
      contract_price: job.contractPrice != null ? String(job.contractPrice) : "",
      start_date: job.startDate ? job.startDate.split("T")[0] : "",
      description: job.description || "",
    });
  };

  const closeCard = () => {
    setEditingId(null);
    setDeleteConfirm(false);
    setForm(EMPTY_FORM);
    setError("");
  };

  const openAdd = () => {
    setIsAddingNew(true);
    setEditingId(null);
    setDeleteConfirm(false);
    setForm(EMPTY_FORM);
    setError("");
  };

  const cancelAdd = () => {
    setIsAddingNew(false);
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
        status: form.status,
        contract_price: form.contract_price ? parseFloat(form.contract_price) : null,
        start_date: form.start_date || null,
        description: form.description || null,
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

  const editForm = (
    <div className="border border-indigo-200 bg-indigo-50 rounded-xl p-4 space-y-3">
      <div className="text-sm font-bold text-indigo-800">
        {editingId ? "Edit Job" : "New Job"}
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">
          Job Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.job_name}
          onChange={(e) => setForm((p) => ({ ...p, job_name: e.target.value }))}
          placeholder="e.g. Garage Floor — 3 Car"
          className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Status</label>
          <select
            value={form.status}
            onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {Object.entries(STATUS_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Contract Price</label>
          <input
            type="number"
            value={form.contract_price}
            onChange={(e) => setForm((p) => ({ ...p, contract_price: e.target.value }))}
            placeholder="0"
            min="0"
            step="0.01"
            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">Start Date</label>
        <input
          type="date"
          value={form.start_date}
          onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
          className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">Notes</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          placeholder="Optional notes about this job…"
          rows={2}
          className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-2.5 bg-indigo-700 text-white rounded-lg font-semibold text-sm hover:bg-indigo-800 disabled:opacity-50 transition"
        >
          {saving ? "Saving…" : editingId ? "Save Changes" : "Add Job"}
        </button>
        <button
          onClick={editingId ? closeCard : cancelAdd}
          disabled={saving}
          className="py-2.5 px-4 bg-gray-200 text-gray-700 rounded-lg font-semibold text-sm hover:bg-gray-300 disabled:opacity-50 transition"
        >
          Cancel
        </button>
      </div>

      {/* Delete — only for existing jobs, lives inside the expanded form */}
      {editingId && (
        <div className="pt-1 border-t border-indigo-200">
          {deleteConfirm ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-red-700 font-semibold">Delete this job?</span>
              <div className="flex gap-2">
                <button
                  onClick={handleDelete}
                  className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition"
                >
                  Yes, Delete
                </button>
                <button
                  onClick={() => setDeleteConfirm(false)}
                  className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="text-xs text-red-500 font-semibold hover:text-red-700 transition"
            >
              Delete Job
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
            <h2 className="text-lg font-bold">Jobs</h2>
            <p className="text-indigo-200 text-sm mt-0.5 truncate">{lead?.name}</p>
          </div>
          <button onClick={onClose} className="text-indigo-200 hover:text-white text-2xl leading-none px-2">
            ×
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-3 text-red-800 text-sm rounded">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-sm text-gray-400 text-center py-10">Loading…</div>
          ) : jobs.length === 0 && !isAddingNew ? (
            <div className="text-sm text-gray-400 text-center py-10 border border-dashed border-gray-200 rounded-xl">
              No jobs yet. Add the first one below.
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) =>
                editingId === job.id ? (
                  // EXPANDED — inline edit form
                  <div key={job.id}>{editForm}</div>
                ) : (
                  // COLLAPSED — clickable summary card
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
                          {job.contractPrice && (
                            <span className="text-xs text-gray-500">{money(job.contractPrice)}</span>
                          )}
                          {job.startDate && (
                            <span className="text-xs text-gray-400">
                              {new Date(job.startDate).toLocaleDateString()}
                            </span>
                          )}
                          {job.crewName && (
                            <span className="text-xs text-indigo-600">{job.crewName}</span>
                          )}
                        </div>
                        {job.description && (
                          <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{job.description}</p>
                        )}
                      </div>
                      <span className="text-gray-400 text-xs mt-1 shrink-0">›</span>
                    </div>
                  </div>
                )
              )}
            </div>
          )}

          {/* ADD FORM */}
          {isAddingNew && editForm}

          {/* ADD BUTTON — visible when not adding and no card is expanded */}
          {!isAddingNew && !editingId && (
            <button
              onClick={openAdd}
              className="w-full py-3 bg-indigo-700 text-white rounded-xl font-semibold text-sm hover:bg-indigo-800 transition"
            >
              + Add Job
            </button>
          )}
        </div>

        {/* FOOTER */}
        <div className="border-t px-6 py-4 bg-gray-50 shrink-0 md:rounded-b-2xl">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-gray-200 text-gray-700 rounded-lg font-semibold text-sm hover:bg-gray-300 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
