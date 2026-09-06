// File: src/leadModalParts/JobReportsPanel.jsx
import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../AuthContext";
import { useCompany } from "../CompanyContext";
import { JobReportsAPI, BidderAPI } from "../api";
import { usePermission } from "../utils/usePermission";

const PROJECT_TYPE_LABELS = {
  garage_1: "1 Car Garage",
  garage_2: "2 Car Garage",
  garage_3: "3 Car Garage",
  garage_4: "4 Car Garage",
  patio: "Patio",
  basement: "Basement",
  commercial: "Commercial",
  custom: "Custom Project",
};

function formatProjectType(type) {
  if (!type) return "Not Set";
  return PROJECT_TYPE_LABELS[type] || type.charAt(0).toUpperCase() + type.slice(1);
}

function fmtMoney(n) {
  const abs = Math.abs(n || 0);
  const formatted = abs.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (n < 0 ? "-$" : "$") + formatted;
}

function fmtHours(minutes) {
  if (!minutes) return "0h 0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

// ============================================================================
// TIME ENTRIES MODAL
// ============================================================================
// ============================================================================
// TIME ENTRY FORM MODAL — add or edit a single entry (z-[80])
// ============================================================================
const NON_EMPLOYEE_SENTINEL = "__non_employee__";

function TimeEntryFormModal({ leadId, companyId, entry, companyUsers, loadingUsers, onSave, onClose }) {
  const isEdit = !!entry;
  const totalMin = entry?.duration_minutes || 0;
  const editIsNonEmployee = isEdit && !!entry.non_employee_name;
  const [form, setForm] = useState({
    user_id: entry?.user_id ? String(entry.user_id) : (editIsNonEmployee ? NON_EMPLOYEE_SENTINEL : ""),
    non_employee_name: entry?.non_employee_name || "",
    date: entry ? new Date(entry.clock_in).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    hours: isEdit ? String(Math.floor(totalMin / 60)) : "",
    minutes: isEdit ? String(totalMin % 60) : "",
    notes: entry?.notes || "",
  });
  const [saving, setSaving] = useState(false);

  const isNonEmployee = form.user_id === NON_EMPLOYEE_SENTINEL;

  const handleSubmit = async () => {
    const h = parseInt(form.hours, 10) || 0;
    const m = parseInt(form.minutes, 10) || 0;
    if (!isEdit) {
      if (!form.user_id) { alert("Please select an employee."); return; }
      if (isNonEmployee && !form.non_employee_name.trim()) { alert("Please enter a name for the non-employee."); return; }
    }
    if (h + m === 0) { alert("Duration must be greater than 0."); return; }
    setSaving(true);
    try {
      if (isEdit) {
        await JobReportsAPI.updateTimeEntry(leadId, entry.id, {
          hours: h, minutes: m, date: form.date, notes: form.notes || null,
        }, companyId);
      } else if (isNonEmployee) {
        await JobReportsAPI.addManualTime(leadId, {
          non_employee_name: form.non_employee_name.trim(),
          date: form.date,
          hours: h,
          minutes: m,
          notes: form.notes || null,
        }, companyId);
      } else {
        await JobReportsAPI.addManualTime(leadId, {
          user_id: parseInt(form.user_id, 10),
          date: form.date,
          hours: h,
          minutes: m,
          notes: form.notes || null,
        }, companyId);
      }
      onSave();
    } catch (err) {
      alert(err.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-base">{isEdit ? "Edit Time Entry" : "Add Time Entry"}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        {/* Employee */}
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">Employee</label>
          {isEdit ? (
            <div className="text-sm font-semibold text-gray-800 px-3 py-2 bg-gray-50 rounded-xl">{entry.user_name}</div>
          ) : loadingUsers ? (
            <div className="text-xs text-gray-400 py-2">Loading…</div>
          ) : (
            <select value={form.user_id} onChange={(e) => {
              const uid = e.target.value;
              setForm((f) => ({
                ...f,
                user_id: uid,
                non_employee_name: uid === NON_EMPLOYEE_SENTINEL ? f.non_employee_name : "",
              }));
            }} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white">
              <option value="">Select employee…</option>
              {companyUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              <option value={NON_EMPLOYEE_SENTINEL}>— Non-Employee / Temp Labor —</option>
            </select>
          )}
        </div>

        {/* Non-employee name field */}
        {!isEdit && isNonEmployee && (
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Name / Description</label>
            <input
              type="text"
              placeholder="e.g. Day laborer, John's crew…"
              value={form.non_employee_name}
              onChange={(e) => setForm((f) => ({ ...f, non_employee_name: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
              autoFocus
            />
          </div>
        )}

        {/* Date */}
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">Date</label>
          <input type="date" value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white" />
        </div>

        {/* Hours + Minutes */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Hours</label>
            <input type="number" min="0" placeholder="0" value={form.hours}
              onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Minutes</label>
            <input type="number" min="0" max="59" placeholder="0" value={form.minutes}
              onChange={(e) => setForm((f) => ({ ...f, minutes: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white" />
          </div>
        </div>


        {/* Notes */}
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">Notes (optional)</label>
          <input type="text" placeholder="Description of work…" value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white" />
        </div>

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-100">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Entry"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TIME LOG MODAL — full entry list with edit/delete (z-[80])
// ============================================================================
function TimeLogModal({ leadId, companyId, companyUsers, loadingUsers, canEdit, onClose, onUpdate }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editEntry, setEditEntry] = useState(null);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await JobReportsAPI.getTimeEntries(leadId, companyId);
      setEntries(data.entries || []);
    } catch (err) {
      console.error("Load time log error:", err);
    } finally {
      setLoading(false);
    }
  }, [leadId, companyId]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this time entry?")) return;
    try {
      await JobReportsAPI.deleteTimeEntry(leadId, id, companyId);
      await load();
      onUpdate();
    } catch (err) {
      alert(err.message || "Failed to delete.");
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
        <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl"
          style={{ maxHeight: "85vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
          <div className="sticky top-0 bg-white px-5 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-900 text-base">Time Log</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
          </div>
          <div className="px-5 pb-6 pt-3">
            {loading ? (
              <div className="text-center py-6 text-gray-400 text-sm">Loading…</div>
            ) : entries.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">No time entries yet.</p>
            ) : (
              <div className="space-y-2">
                {entries.map((e) => {
                  const dateLabel = new Date(e.clock_in).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                  return (
                    <div key={e.id} className="bg-gray-50 rounded-xl px-4 py-3 flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-800">{e.user_name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{dateLabel} · {fmtHours(e.duration_minutes)}</div>
                        {e.notes && <div className="text-xs text-gray-400 italic mt-0.5 truncate">{e.notes}</div>}
                      </div>
                      {canEdit && (
                        <div className="flex gap-3 shrink-0 mt-0.5">
                          <button onClick={() => setEditEntry(e)} className="text-blue-500 hover:text-blue-700 text-xs font-medium">Edit</button>
                          <button onClick={() => handleDelete(e.id)} className="text-red-400 hover:text-red-600 text-xs font-medium">Delete</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {canEdit && (
              <button type="button" onClick={() => setShowAdd(true)}
                className="mt-4 w-full py-2.5 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 text-sm font-semibold hover:border-blue-400 hover:text-blue-600 transition">
                + Add Entry
              </button>
            )}
          </div>
        </div>
      </div>

      {(editEntry || showAdd) && (
        <TimeEntryFormModal
          leadId={leadId}
          companyId={companyId}
          entry={editEntry || null}
          companyUsers={companyUsers}
          loadingUsers={loadingUsers}
          onSave={async () => { setEditEntry(null); setShowAdd(false); await load(); onUpdate(); }}
          onClose={() => { setEditEntry(null); setShowAdd(false); }}
        />
      )}
    </>
  );
}

// ============================================================================
// TIME ENTRIES MODAL — aggregate tally by employee (z-[240])
// ============================================================================
function TimeEntriesModal({ leadId, companyId, employees, canEdit, onClose, onWageChange }) {
  const [rows, setRows] = useState(
    employees.map((e) => ({ ...e, wageInput: e.effective_wage > 0 ? String(e.effective_wage) : "" }))
  );
  const [saving, setSaving] = useState({});
  const [companyUsers, setCompanyUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  // which row's wage is in edit mode, and the value before editing started
  const [editingWageIdx, setEditingWageIdx] = useState(null);
  const [wageEditOriginal, setWageEditOriginal] = useState("");

  useEffect(() => {
    setRows(employees.map((e) => ({ ...e, wageInput: e.effective_wage > 0 ? String(e.effective_wage) : "" })));
  }, [employees]);

  useEffect(() => {
    setLoadingUsers(true);
    JobReportsAPI.getUsers(companyId)
      .then((data) => setCompanyUsers(data.users || []))
      .catch(() => {})
      .finally(() => setLoadingUsers(false));
  }, [companyId]);

  const setWageInput = (idx, val) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, wageInput: val } : r)));

  const startEditWage = (idx) => {
    setWageEditOriginal(rows[idx].wageInput);
    setEditingWageIdx(idx);
  };

  const cancelEditWage = (idx) => {
    setWageInput(idx, wageEditOriginal);
    setEditingWageIdx(null);
  };

  const saveWage = async (emp, idx) => {
    setEditingWageIdx(null);
    const newWage = parseFloat(rows[idx].wageInput);
    if (isNaN(newWage) || newWage < 0) return;
    if (newWage === emp.effective_wage && emp.has_override) return;
    setSaving((s) => ({ ...s, [emp.user_id]: true }));
    try {
      await JobReportsAPI.setLaborOverride(leadId, emp.user_id, newWage, companyId);
      onWageChange();
    } catch (err) {
      console.error("Wage override error:", err);
    } finally {
      setSaving((s) => ({ ...s, [emp.user_id]: false }));
    }
  };

  const computedTotal = rows.reduce((sum, e) => {
    const wage = parseFloat(e.wageInput) || 0;
    return sum + ((parseInt(e.total_minutes, 10) || 0) / 60) * wage;
  }, 0);

  return (
    <>
      <div className="fixed inset-0 z-[240] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
        <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl"
          style={{ maxHeight: "85vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
          <div className="sticky top-0 bg-white px-5 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-900 text-base">Time Entries by Employee</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
          </div>

          <div className="px-5 pb-6 pt-3">
            {rows.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-6">No time entries for this job yet.</p>
            ) : (
              <>
                {/* Header */}
                <div className="flex gap-2 text-xs font-semibold text-gray-400 pb-2 mb-1">
                  <span className="flex-1">Employee</span>
                  <span className="w-16 text-center shrink-0">Hours</span>
                  <span className="w-32 text-center shrink-0">Wage/hr</span>
                  <span className="w-20 text-right shrink-0">Subtotal</span>
                </div>

                {rows.map((emp, idx) => {
                  const hrs = (parseInt(emp.total_minutes, 10) || 0) / 60;
                  const wage = parseFloat(emp.wageInput) || 0;
                  const isEditing = editingWageIdx === idx;
                  const isSavingWage = !!saving[emp.user_id];
                  return (
                    <div key={emp.user_id ?? idx} className="flex items-center gap-2 py-3 border-b border-gray-50">
                      <span className="flex-1 text-sm text-gray-800 font-medium truncate">{emp.user_name}</span>
                      <span className="w-16 text-sm text-gray-700 text-center shrink-0">{fmtHours(emp.total_minutes)}</span>

                      {/* Wage cell */}
                      <div className="w-32 flex items-center justify-center shrink-0">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <span className="text-gray-400 text-xs">$</span>
                            <input
                              type="number" min="0" step="0.01"
                              value={emp.wageInput}
                              onChange={(e) => setWageInput(idx, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveWage(emp, idx);
                                if (e.key === "Escape") cancelEditWage(idx);
                              }}
                              autoFocus
                              className="w-14 text-sm text-center border border-blue-400 rounded-lg px-1 py-0.5 focus:outline-none"
                            />
                            <button
                              onClick={() => saveWage(emp, idx)}
                              disabled={isSavingWage}
                              className="text-blue-500 hover:text-blue-700 text-sm font-bold disabled:opacity-40"
                              title="Save"
                            >✓</button>
                            <button
                              onClick={() => cancelEditWage(idx)}
                              className="text-gray-400 hover:text-gray-600 text-sm"
                              title="Cancel"
                            >✕</button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-700">
                              {isSavingWage
                                ? <span className="text-gray-400 text-xs">Saving…</span>
                                : emp.wageInput
                                  ? `$${parseFloat(emp.wageInput).toFixed(2)}`
                                  : <span className="text-gray-400">—</span>}
                            </span>
                            {canEdit && !emp.non_employee_name && !isSavingWage && (
                              <button
                                onClick={() => startEditWage(idx)}
                                className="text-blue-400 hover:text-blue-600 text-[11px] font-semibold"
                              >
                                Edit
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      <span className="w-20 text-sm font-medium text-gray-800 text-right shrink-0">{fmtMoney(hrs * wage)}</span>
                    </div>
                  );
                })}

                <div className="flex justify-between items-center pt-3 mt-1">
                  <span className="font-semibold text-gray-700 text-sm">Total Labor Cost</span>
                  <span className="font-bold text-gray-900">{fmtMoney(computedTotal)}</span>
                </div>
              </>
            )}

            <div className="mt-5">
              <button type="button" onClick={() => setShowLogModal(true)}
                className="w-full py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition">
                View / Edit Time Log
              </button>
            </div>
          </div>
        </div>
      </div>

      {showLogModal && (
        <TimeLogModal
          leadId={leadId}
          companyId={companyId}
          companyUsers={companyUsers}
          loadingUsers={loadingUsers}
          canEdit={canEdit}
          onClose={() => setShowLogModal(false)}
          onUpdate={onWageChange}
        />
      )}
    </>
  );
}

// ============================================================================
// MATERIALS FORM
// ============================================================================
const noSpin = "appearance-none [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden";

function MaterialsForm({ leadId, companyId, canEdit, onClose, onUpdate }) {
  const [materials, setMaterials]   = useState([]);
  const [library, setLibrary]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [loadVer, setLoadVer]       = useState(0);
  const [importing, setImporting]   = useState(false);
  const [showAdd, setShowAdd]       = useState(false);
  const [addMode, setAddMode]       = useState("library");
  const [expandedCats, setExpandedCats] = useState({});
  const [addForm, setAddForm]       = useState({ name: "", qty: "1", unit: "", unit_cost: "" });
  const [saving, setSaving]         = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [mats, lib] = await Promise.all([
        JobReportsAPI.getMaterials(leadId, companyId),
        BidderAPI.getLibrary(companyId),
      ]);
      setMaterials(mats.materials || []);
      setLibrary(Array.isArray(lib) ? lib : []);
      setLoadVer(v => v + 1);
    } catch (err) {
      console.error("Materials load error:", err);
    } finally {
      setLoading(false);
    }
  }, [leadId, companyId]);

  useEffect(() => { load(); }, [load]);

  const handleImportFromBid = async () => {
    setImporting(true);
    try {
      const result = await JobReportsAPI.importFromBid(leadId, companyId);
      if (!result?.imported) { alert("No items found in the accepted bid."); return; }
      await load();
      onUpdate();
    } catch (err) {
      alert(err.message || "No accepted bid found for this job.");
    } finally {
      setImporting(false);
    }
  };

  const handleBlur = async (m, field, value) => {
    const updates = {};
    updates[field] = field === "unit" ? value : (parseFloat(value) || 0);
    try {
      await JobReportsAPI.updateMaterial(leadId, m.id, updates, companyId);
      await load();
      onUpdate();
    } catch (err) {
      console.error("Update error:", err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Remove this material?")) return;
    await JobReportsAPI.deleteMaterial(leadId, id, companyId);
    setMaterials(prev => prev.filter(m => m.id !== id));
    onUpdate();
  };

  const handleLibraryPick = (item) => {
    setAddForm({ name: item.name, qty: "1", unit: item.default_unit_label || "", unit_cost: String(item.default_unit_price || "") });
  };

  const handleAdd = async () => {
    if (!addForm.name.trim()) return;
    setSaving(true);
    try {
      await JobReportsAPI.addMaterial(leadId, {
        name: addForm.name.trim(),
        qty: parseFloat(addForm.qty) || 1,
        unit: addForm.unit || null,
        unit_cost: parseFloat(addForm.unit_cost) || 0,
      }, companyId);
      setAddForm({ name: "", qty: "1", unit: "", unit_cost: "" });
      setShowAdd(false);
      await load();
      onUpdate();
    } catch (err) {
      console.error("Add material error:", err);
    } finally {
      setSaving(false);
    }
  };

  const totalCost = materials.reduce((a, m) => a + (parseFloat(m.total) || 0), 0);
  const cols = "1fr 3.5rem 3.5rem 4.5rem 4.5rem 1.5rem";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white w-full max-w-xl rounded-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: "88vh" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h3 className="font-bold text-gray-900 text-base">Materials</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {loading ? (
            <div className="text-center py-8 text-gray-400 text-sm">Loading…</div>
          ) : (
            <>
              {/* Action bar */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleImportFromBid}
                  disabled={importing}
                  className="flex items-center gap-1.5 px-3 py-2 bg-green-50 border border-green-200 text-green-700 rounded-xl text-xs font-semibold hover:bg-green-100 transition disabled:opacity-50"
                >
                  {importing ? "Importing…" : "↓ Import from Bid"}
                </button>
                {canEdit && (
                  <button
                    onClick={() => { setShowAdd(true); setAddMode("library"); setAddForm({ name: "", qty: "1", unit: "", unit_cost: "" }); setExpandedCats({}); }}
                    className="ml-auto px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition"
                  >
                    + Add Item
                  </button>
                )}
              </div>

              {/* Materials table */}
              {materials.length > 0 && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  {/* Header row */}
                  <div
                    className="grid items-center bg-gray-50 border-b border-gray-200 px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider"
                    style={{ gridTemplateColumns: cols }}
                  >
                    <span>Item</span>
                    <span className="text-center">Qty</span>
                    <span className="text-center">Unit</span>
                    <span className="text-right">Cost</span>
                    <span className="text-right">Total</span>
                    <span />
                  </div>

                  {/* Item rows — keyed on loadVer so inputs reset after server reload */}
                  {materials.map(m => (
                    <div
                      key={`${m.id}_v${loadVer}`}
                      className="grid items-center px-3 py-2.5 border-b border-gray-100 last:border-0 gap-1"
                      style={{ gridTemplateColumns: cols }}
                    >
                      <span className="text-sm text-gray-800 font-medium truncate pr-1" title={m.name}>{m.name}</span>
                      <input
                        type="number" step="0.01" min="0.01"
                        defaultValue={parseFloat(m.qty)}
                        disabled={!canEdit}
                        onBlur={e => handleBlur(m, "qty", e.target.value)}
                        className={`w-full text-sm text-center border border-gray-200 rounded-lg px-1 py-1 focus:outline-none focus:border-blue-400 ${noSpin} disabled:bg-transparent disabled:border-transparent`}
                      />
                      <input
                        type="text"
                        defaultValue={m.unit || ""}
                        disabled={!canEdit}
                        placeholder="ea"
                        onBlur={e => handleBlur(m, "unit", e.target.value)}
                        className="w-full text-xs text-center border border-gray-200 rounded-lg px-1 py-1 focus:outline-none focus:border-blue-400 disabled:bg-transparent disabled:border-transparent"
                      />
                      <input
                        type="number" step="0.01" min="0"
                        defaultValue={parseFloat(m.unit_cost)}
                        disabled={!canEdit}
                        onBlur={e => handleBlur(m, "unit_cost", e.target.value)}
                        className={`w-full text-sm text-right border border-gray-200 rounded-lg px-1 py-1 focus:outline-none focus:border-blue-400 ${noSpin} disabled:bg-transparent disabled:border-transparent`}
                      />
                      <span className="text-sm font-semibold text-gray-700 text-right">{fmtMoney(m.total)}</span>
                      {canEdit ? (
                        <button onClick={() => handleDelete(m.id)} className="text-red-300 hover:text-red-500 text-xl leading-none text-center">×</button>
                      ) : <span />}
                    </div>
                  ))}

                  {/* Total row */}
                  <div className="flex justify-between items-center px-3 py-2.5 bg-gray-50 border-t border-gray-200">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</span>
                    <span className="text-sm font-bold text-gray-900">{fmtMoney(totalCost)}</span>
                  </div>
                </div>
              )}

              {/* Empty state */}
              {materials.length === 0 && !showAdd && (
                <div className="text-center py-10 space-y-2">
                  <p className="text-gray-400 text-sm">No materials added yet.</p>
                  <p className="text-xs text-gray-400">Import from the accepted bid or add items manually.</p>
                </div>
              )}

              {/* Add item panel */}
              {showAdd && canEdit && (
                <div className="border border-blue-200 rounded-xl p-4 bg-blue-50/40 space-y-3">
                  {/* Mode toggle */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setAddMode("library"); setAddForm(f => ({ ...f, name: "", unit: "", unit_cost: "" })); }}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-semibold border transition ${addMode === "library" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"}`}
                    >
                      From Library
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddMode("custom")}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-semibold border transition ${addMode === "custom" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"}`}
                    >
                      Custom
                    </button>
                  </div>

                  {/* Library picker */}
                  {addMode === "library" && (
                    library.length === 0 ? (
                      <p className="text-sm text-gray-500 bg-white rounded-xl border border-gray-100 px-3 py-3">
                        No library items. Manage via Settings → Bidder.
                      </p>
                    ) : (
                      <div className="rounded-xl border border-gray-200 overflow-hidden bg-white max-h-52 overflow-y-auto">
                        {library.map(cat => (
                          <div key={cat.id} className="border-b border-gray-100 last:border-0">
                            <button
                              type="button"
                              onClick={() => setExpandedCats(p => ({ ...p, [cat.id]: !p[cat.id] }))}
                              className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 text-left"
                            >
                              <span className={`text-gray-400 text-xs transition-transform ${expandedCats[cat.id] ? "rotate-90" : ""}`}>▶</span>
                              <span className="text-sm font-semibold text-gray-700">{cat.name}</span>
                              <span className="text-xs text-gray-400 ml-auto">({cat.items?.length || 0})</span>
                            </button>
                            {expandedCats[cat.id] && (
                              <div className="divide-y divide-gray-50">
                                {(cat.items || []).map(item => (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => handleLibraryPick(item)}
                                    className={`w-full text-left px-4 py-2.5 flex justify-between items-center transition ${addForm.name === item.name ? "bg-blue-50 text-blue-700" : "hover:bg-gray-50 text-gray-800"}`}
                                  >
                                    <span className="text-sm font-medium">{item.name}</span>
                                    <span className="text-xs text-gray-400 ml-2 shrink-0">
                                      {item.default_unit_label || ""}{parseFloat(item.default_unit_price) > 0 ? ` · $${parseFloat(item.default_unit_price).toFixed(2)}` : ""}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )
                  )}

                  {/* Fields */}
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Item Name</label>
                    <input
                      type="text"
                      value={addForm.name}
                      onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                      placeholder={addMode === "library" ? "Select item above…" : "Material name"}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">Qty</label>
                      <input type="number" min="0.01" step="0.01" value={addForm.qty} onChange={e => setAddForm(f => ({ ...f, qty: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">Unit</label>
                      <input type="text" value={addForm.unit} onChange={e => setAddForm(f => ({ ...f, unit: e.target.value }))} placeholder="gal, bag…" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">Cost / Unit</label>
                      <input type="number" min="0" step="0.01" value={addForm.unit_cost} onChange={e => setAddForm(f => ({ ...f, unit_cost: e.target.value }))} placeholder="0.00" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white" />
                    </div>
                  </div>

                  {addForm.qty && addForm.unit_cost ? (
                    <div className="text-xs text-right text-gray-500">
                      Total: <strong className="text-gray-700">{fmtMoney((parseFloat(addForm.qty) || 0) * (parseFloat(addForm.unit_cost) || 0))}</strong>
                    </div>
                  ) : null}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setShowAdd(false); setAddForm({ name: "", qty: "1", unit: "", unit_cost: "" }); }}
                      className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAdd}
                      disabled={saving || !addForm.name.trim()}
                      className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                    >
                      {saving ? "Adding…" : "Add"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PANEL
// ============================================================================
export default function JobReportsPanel({ lead, job, onClose }) {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const companyId = user?.role === "master" ? (currentCompany?.id || currentCompany?.companyId) : null;
  const jobReportPerm = usePermission('job_report');
  const canEdit = jobReportPerm === 'edit';

  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showTimeEntries, setShowTimeEntries] = useState(false);
  const [showMaterials, setShowMaterials] = useState(false);

  const loadSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await JobReportsAPI.getSummary(lead.id, companyId);
      if (!data?.job || !data?.labor || !data?.materials || !data?.summary) {
        setError("Failed to load job report — please try again.");
        return;
      }
      setSummary(data);
    } catch (err) {
      console.error("Job reports load error:", err);
      setError("Failed to load job report");
    } finally {
      setLoading(false);
    }
  }, [lead.id, companyId]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  return (
    <div className="fixed inset-0 z-[220] flex flex-col md:items-center md:justify-center md:bg-black/50 md:p-6">
      <div className="flex-1 md:flex-none bg-white flex flex-col overflow-hidden md:max-w-2xl md:w-full md:max-h-[90vh] md:rounded-2xl md:shadow-2xl">
      {/* Header */}
      <div className="bg-blue-600 text-white px-4 py-4 flex items-center gap-3 shrink-0">
        <button
          onClick={onClose}
          className="text-white/80 hover:text-white p-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-base truncate">
            {job ? job.jobName : lead.name}
          </div>
          <div className="text-white/60 text-xs mt-0.5">
            {job ? `Project Report — ${lead.name}` : "Job Report"}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        {loading ? (
          <div className="flex justify-center items-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
          </div>
        ) : error ? (
          <div className="text-center py-10 space-y-3">
            <p className="text-red-500 text-sm">{error}</p>
            <button
              onClick={loadSummary}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold"
            >
              Retry
            </button>
          </div>
        ) : summary?.job && summary?.labor && summary?.materials && summary?.summary ? (
          <>
            {/* Job Details */}
            <div className="bg-gray-50 rounded-2xl border border-gray-200 px-4 py-4">
              <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest mb-2">Job Details</div>
              <div className="font-bold text-gray-900 text-base">{summary.job.name}</div>
              <div className="text-sm text-gray-500 mt-0.5">{formatProjectType(summary.job.project_type)}</div>
            </div>

            {/* Labor */}
            <div className="bg-gray-50 rounded-2xl border border-gray-200 px-4 py-4 space-y-3">
              <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest">Labor</div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Hours</span>
                <span className="font-semibold text-gray-900">{fmtHours(summary.labor.total_minutes)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Labor Cost</span>
                <span className="font-semibold text-gray-900">{fmtMoney(summary.labor.total_cost)}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowTimeEntries(true)}
                className="w-full text-center text-sm text-blue-600 font-semibold py-2 rounded-xl border border-blue-100 bg-blue-50 hover:bg-blue-100 transition"
              >
                View Time Entries
              </button>
            </div>

            {/* Materials */}
            <div className="bg-gray-50 rounded-2xl border border-gray-200 px-4 py-4 space-y-3">
              <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest">Materials</div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Materials Cost</span>
                <span className="font-semibold text-gray-900">{fmtMoney(summary.materials.total_cost)}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowMaterials(true)}
                className="w-full text-center text-sm text-blue-600 font-semibold py-2 rounded-xl border border-blue-100 bg-blue-50 hover:bg-blue-100 transition"
              >
                {canEdit ? "Add / View Materials" : "View Materials"}
              </button>
            </div>

            {/* Summary */}
            <div className="bg-blue-50 rounded-2xl border border-blue-200 px-4 py-4 space-y-3">
              <div className="text-[10px] text-blue-500 font-semibold uppercase tracking-widest">Job Summary</div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Labor Cost</span>
                <span className="text-gray-900 font-medium">{fmtMoney(summary.labor.total_cost)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Materials Cost</span>
                <span className="text-gray-900 font-medium">{fmtMoney(summary.materials.total_cost)}</span>
              </div>
              <div className="border-t border-blue-200 pt-3 flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-700">Total Job Cost</span>
                <span className="font-bold text-gray-900">{fmtMoney(summary.summary.total_job_cost)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Contract Price</span>
                <span className="text-gray-900 font-medium">{fmtMoney(summary.summary.contract_price)}</span>
              </div>
              <div className="border-t border-blue-200 pt-3 flex justify-between items-center">
                <span className="text-sm font-bold text-gray-800">Gross Profit</span>
                <span className={`font-bold text-lg ${summary.summary.gross_profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {fmtMoney(summary.summary.gross_profit)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Margin</span>
                <span className={`font-semibold ${summary.summary.margin_pct >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {summary.summary.margin_pct}%
                </span>
              </div>
            </div>
          </>
        ) : null}
      </div>

      </div>{/* end inner panel */}

      {/* Time Entries Modal */}
      {showTimeEntries && summary?.labor?.employees && (
        <TimeEntriesModal
          leadId={lead.id}
          companyId={companyId}
          employees={summary.labor.employees}
          canEdit={canEdit}
          onClose={() => setShowTimeEntries(false)}
          onWageChange={loadSummary}
        />
      )}

      {/* Materials Form Modal */}
      {showMaterials && (
        <MaterialsForm
          leadId={lead.id}
          companyId={companyId}
          canEdit={canEdit}
          onClose={() => setShowMaterials(false)}
          onUpdate={loadSummary}
        />
      )}
    </div>
  );
}
