// ============================================================================
// File: src/leadModalParts/JobsPanel.jsx
// Multiple jobs per lead — list, add, edit, delete
// ============================================================================

import React, { useEffect, useState } from "react";
import { JobsAPI } from "../api";
import { useCompany } from "../CompanyContext";

const STATUS_LABELS = {
  in_progress: "In Progress",
  scheduled: "Scheduled",
  complete: "Complete",
  cancelled: "Cancelled",
};

const STATUS_COLORS = {
  in_progress: "bg-blue-100 text-blue-700",
  scheduled: "bg-amber-100 text-amber-800",
  complete: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-gray-100 text-gray-500",
};

const EMPTY_FORM = {
  job_name: "",
  status: "in_progress",
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

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

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

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (job) => {
    setEditingId(job.id);
    setForm({
      job_name: job.jobName || "",
      status: job.status || "in_progress",
      contract_price: job.contractPrice != null ? String(job.contractPrice) : "",
      start_date: job.startDate ? job.startDate.split("T")[0] : "",
      description: job.description || "",
    });
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
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
      } else {
        const res = await JobsAPI.create(payload, companyId);
        setJobs((prev) => [...prev, res.job]);
      }
      cancelForm();
    } catch (err) {
      setError(err.message || "Failed to save job");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await JobsAPI.delete(id, companyId);
      setJobs((prev) => prev.filter((j) => j.id !== id));
      setDeleteConfirmId(null);
    } catch (err) {
      setError(err.message || "Failed to delete job");
    }
  };

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
          ) : jobs.length === 0 && !showForm ? (
            <div className="text-sm text-gray-400 text-center py-10 border border-dashed border-gray-200 rounded-xl">
              No jobs yet. Add the first one below.
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="p-4 bg-gray-50 rounded-xl border border-gray-100"
                >
                  {deleteConfirmId === job.id ? (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-red-700 font-semibold">Delete "{job.jobName}"?</span>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => handleDelete(job.id)}
                          className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition"
                        >
                          Yes, Delete
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-300 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-3">
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
                                Starts {new Date(job.startDate).toLocaleDateString()}
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
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => openEdit(job)}
                            className="text-xs text-blue-600 font-semibold hover:text-blue-800 px-2 py-1"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(job.id)}
                            className="text-xs text-red-400 font-semibold hover:text-red-600 px-2 py-1"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ADD / EDIT FORM */}
          {showForm && (
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
                  onClick={cancelForm}
                  disabled={saving}
                  className="py-2.5 px-4 bg-gray-200 text-gray-700 rounded-lg font-semibold text-sm hover:bg-gray-300 disabled:opacity-50 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ADD BUTTON — always visible when form is not shown */}
          {!showForm && (
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
