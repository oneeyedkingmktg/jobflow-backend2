// File: src/leadModalParts/JobReportsPanel.jsx
import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../AuthContext";
import { useCompany } from "../CompanyContext";
import { JobReportsAPI } from "../api";

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
function TimeEntriesModal({ leadId, companyId, employees, onClose, onWageChange }) {
  const [rows, setRows] = useState(
    employees.map((e) => ({ ...e, wageInput: e.effective_wage > 0 ? String(e.effective_wage) : "" }))
  );
  const [saving, setSaving] = useState({});

  const handleWageBlur = async (emp, idx) => {
    const raw = rows[idx].wageInput;
    const newWage = parseFloat(raw);
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

  const setWageInput = (idx, val) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, wageInput: val } : r)));

  const computedTotal = rows.reduce((sum, e) => {
    const wage = parseFloat(e.wageInput) || 0;
    return sum + ((parseInt(e.total_minutes, 10) || 0) / 60) * wage;
  }, 0);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white w-full max-w-lg rounded-t-2xl shadow-2xl"
        style={{ maxHeight: "80vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white px-5 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-base">Time Entries by Employee</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="px-5 pb-8 pt-3">
          {rows.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">
              No clocked time entries for this job yet.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-2 text-xs font-semibold text-gray-400 pb-2 mb-1">
                <span className="col-span-1">Employee</span>
                <span className="text-center">Hours</span>
                <span className="text-center">Wage/hr</span>
                <span className="text-right">Subtotal</span>
              </div>

              {rows.map((emp, idx) => {
                const hours = (parseInt(emp.total_minutes, 10) || 0) / 60;
                const wage = parseFloat(emp.wageInput) || 0;
                const subtotal = hours * wage;
                return (
                  <div key={emp.user_id} className="grid grid-cols-4 gap-2 items-center py-3 border-b border-gray-50">
                    <span className="text-sm text-gray-800 font-medium truncate col-span-1">
                      {emp.user_name}
                    </span>
                    <span className="text-sm text-gray-700 text-center">{fmtHours(emp.total_minutes)}</span>
                    <div className="flex items-center justify-center">
                      <span className="text-gray-400 text-xs mr-0.5">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={emp.wageInput}
                        onChange={(e) => setWageInput(idx, e.target.value)}
                        onBlur={() => handleWageBlur(emp, idx)}
                        className="w-16 text-sm text-center border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:border-blue-400"
                        disabled={!!saving[emp.user_id]}
                        placeholder="0"
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-800 text-right">{fmtMoney(subtotal)}</span>
                  </div>
                );
              })}

              <div className="flex justify-between items-center pt-3 mt-1">
                <span className="font-semibold text-gray-700 text-sm">Total Labor Cost</span>
                <span className="font-bold text-gray-900">{fmtMoney(computedTotal)}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MATERIALS FORM
// ============================================================================
function MaterialsForm({ leadId, companyId, onClose, onUpdate }) {
  const [materials, setMaterials] = useState([]);
  const [library, setLibrary] = useState({ categories: [] });
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addMode, setAddMode] = useState("library");
  const [selectedCatId, setSelectedCatId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [form, setForm] = useState({
    name: "", qty: "1", unit: "", unit_cost: "", notes: "",
    save_to_library: false, category_id: "",
  });
  const [newCatName, setNewCatName] = useState("");
  const [addingCat, setAddingCat] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [mats, lib] = await Promise.all([
        JobReportsAPI.getMaterials(leadId, companyId),
        JobReportsAPI.getLibrary(companyId),
      ]);
      setMaterials(mats.materials || []);
      setLibrary(lib || { categories: [] });
    } catch (err) {
      console.error("Materials load error:", err);
    } finally {
      setLoading(false);
    }
  }, [leadId, companyId]);

  useEffect(() => { load(); }, [load]);

  const handleLibraryItemSelect = (itemId) => {
    setSelectedItemId(itemId);
    if (!itemId) return;
    const allItems = library.categories.flatMap((c) => c.items || []);
    const item = allItems.find((i) => String(i.id) === String(itemId));
    if (item) {
      setForm((f) => ({
        ...f,
        name: item.name,
        unit: item.unit || "",
        unit_cost: item.default_cost !== undefined ? String(item.default_cost) : "",
      }));
    }
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    setAddingCat(true);
    try {
      await JobReportsAPI.createCategory({ name: newCatName.trim() }, companyId);
      setNewCatName("");
      const lib = await JobReportsAPI.getLibrary(companyId);
      setLibrary(lib || { categories: [] });
    } catch (err) {
      console.error("Add category error:", err);
    } finally {
      setAddingCat(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        qty: parseFloat(form.qty) || 1,
        unit: form.unit || null,
        unit_cost: parseFloat(form.unit_cost) || 0,
        notes: form.notes || null,
        save_to_library: form.save_to_library,
        category_id: form.save_to_library && form.category_id ? parseInt(form.category_id) : null,
      };
      if (addMode === "library" && selectedItemId) {
        payload.material_item_id = parseInt(selectedItemId);
      }
      await JobReportsAPI.addMaterial(leadId, payload, companyId);
      setShowAddForm(false);
      setForm({ name: "", qty: "1", unit: "", unit_cost: "", notes: "", save_to_library: false, category_id: "" });
      setSelectedCatId("");
      setSelectedItemId("");
      setAddMode("library");
      await load();
      onUpdate();
    } catch (err) {
      console.error("Add material error:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Remove this material?")) return;
    try {
      await JobReportsAPI.deleteMaterial(leadId, id, companyId);
      await load();
      onUpdate();
    } catch (err) {
      console.error("Delete material error:", err);
    }
  };

  const catItems = selectedCatId
    ? (library.categories.find((c) => String(c.id) === String(selectedCatId))?.items || [])
    : [];

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white w-full max-w-lg rounded-t-2xl shadow-2xl"
        style={{ maxHeight: "88vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white px-5 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-base">Materials</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="px-5 pb-8 pt-3 space-y-3">
          {/* Existing entries */}
          {loading ? (
            <div className="text-center py-4 text-gray-400 text-sm">Loading…</div>
          ) : materials.length > 0 ? (
            <div className="space-y-2">
              {materials.map((m) => (
                <div key={m.id} className="bg-gray-50 rounded-xl px-4 py-3 flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-gray-900">{m.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {parseFloat(m.qty)} {m.unit || "ea"} ×{" "}
                      {fmtMoney(m.unit_cost)} ={" "}
                      <span className="font-semibold text-gray-700">{fmtMoney(m.total)}</span>
                    </div>
                    {m.notes && (
                      <div className="text-xs text-gray-400 mt-0.5 italic">{m.notes}</div>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="text-red-400 hover:text-red-600 text-xs shrink-0 mt-0.5 font-medium"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : !showAddForm ? (
            <p className="text-gray-400 text-sm text-center py-4">No materials added yet.</p>
          ) : null}

          {/* Add form */}
          {showAddForm ? (
            <div className="border border-gray-200 rounded-2xl p-4 bg-gray-50 space-y-3">
              {/* Mode toggle */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAddMode("library");
                    setForm((f) => ({ ...f, name: "", unit: "", unit_cost: "" }));
                    setSelectedItemId("");
                  }}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-semibold border transition ${
                    addMode === "library"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  From Library
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddMode("custom");
                    setForm((f) => ({ ...f, name: "", unit: "", unit_cost: "" }));
                    setSelectedCatId("");
                    setSelectedItemId("");
                  }}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-semibold border transition ${
                    addMode === "custom"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  + Custom Item
                </button>
              </div>

              {addMode === "library" && (
                <>
                  {library.categories.length === 0 ? (
                    <div className="text-sm text-gray-500 bg-white rounded-xl border border-gray-100 px-3 py-3">
                      <p className="mb-2">No categories yet. Add one to get started:</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Category name"
                          value={newCatName}
                          onChange={(e) => setNewCatName(e.target.value)}
                          className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
                        />
                        <button
                          type="button"
                          onClick={handleAddCategory}
                          disabled={addingCat || !newCatName.trim()}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">Category</label>
                        <select
                          value={selectedCatId}
                          onChange={(e) => {
                            setSelectedCatId(e.target.value);
                            setSelectedItemId("");
                            setForm((f) => ({ ...f, name: "", unit: "", unit_cost: "" }));
                          }}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
                        >
                          <option value="">Select category…</option>
                          {library.categories.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                      {selectedCatId && (
                        <div>
                          <label className="text-xs font-semibold text-gray-600 block mb-1">Item</label>
                          <select
                            value={selectedItemId}
                            onChange={(e) => handleLibraryItemSelect(e.target.value)}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
                          >
                            <option value="">Select item…</option>
                            {catItems.map((i) => (
                              <option key={i.id} value={i.id}>
                                {i.name}{i.unit ? ` (${i.unit})` : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {/* Name */}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Item Name</label>
                <input
                  type="text"
                  placeholder={addMode === "library" ? "Auto-filled from library" : "Material name"}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Qty</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={form.qty}
                    onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Unit</label>
                  <input
                    type="text"
                    placeholder="gal, bag…"
                    value={form.unit}
                    onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Unit Cost</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={form.unit_cost}
                    onChange={(e) => setForm((f) => ({ ...f, unit_cost: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
                  />
                </div>
              </div>

              {form.qty && form.unit_cost && (
                <div className="text-xs text-gray-500 text-right -mt-1">
                  Total: <span className="font-semibold text-gray-700">
                    {fmtMoney((parseFloat(form.qty) || 0) * (parseFloat(form.unit_cost) || 0))}
                  </span>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Notes (optional)</label>
                <input
                  type="text"
                  placeholder="Brand, color, supplier…"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
                />
              </div>

              {/* Save to library (custom mode only) */}
              {addMode === "custom" && (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={form.save_to_library}
                      onChange={(e) => setForm((f) => ({ ...f, save_to_library: e.target.checked }))}
                      className="rounded"
                    />
                    Save to materials library for future use
                  </label>
                  {form.save_to_library && (
                    <div className="space-y-2 pl-6">
                      <select
                        value={form.category_id}
                        onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
                      >
                        <option value="">No category (uncategorized)</option>
                        {library.categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Or add new category…"
                          value={newCatName}
                          onChange={(e) => setNewCatName(e.target.value)}
                          className="flex-1 border border-gray-200 rounded-xl px-3 py-1.5 text-sm bg-white"
                        />
                        <button
                          type="button"
                          onClick={handleAddCategory}
                          disabled={addingCat || !newCatName.trim()}
                          className="px-3 py-1.5 bg-gray-700 text-white rounded-xl text-xs font-semibold disabled:opacity-50"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setForm({ name: "", qty: "1", unit: "", unit_cost: "", notes: "", save_to_library: false, category_id: "" });
                    setSelectedCatId("");
                    setSelectedItemId("");
                    setAddMode("library");
                  }}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={saving || !form.name.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "Adding…" : "Add Material"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="w-full py-3 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 text-sm font-semibold hover:border-blue-400 hover:text-blue-600 transition"
            >
              + Add Material
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PANEL
// ============================================================================
export default function JobReportsPanel({ lead, onClose }) {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const companyId = user?.role === "master" ? (currentCompany?.id || currentCompany?.companyId) : null;

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
    <div className="fixed inset-0 z-50 bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-[#1a2e5a] text-white px-4 py-4 flex items-center gap-3 shrink-0">
        <button
          onClick={onClose}
          className="text-white/80 hover:text-white p-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-base truncate">{lead.name}</div>
          <div className="text-white/60 text-xs mt-0.5">Job Report</div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        {loading ? (
          <div className="flex justify-center items-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
          </div>
        ) : error ? (
          <div className="text-center text-red-500 py-10 text-sm">{error}</div>
        ) : summary && (
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
                Add / View Materials
              </button>
            </div>

            {/* Summary */}
            <div className="bg-[#1a2e5a] rounded-2xl px-4 py-4 space-y-3">
              <div className="text-[10px] text-white/50 font-semibold uppercase tracking-widest">Job Summary</div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-white/70">Labor Cost</span>
                <span className="text-white font-medium">{fmtMoney(summary.labor.total_cost)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-white/70">Materials Cost</span>
                <span className="text-white font-medium">{fmtMoney(summary.materials.total_cost)}</span>
              </div>
              <div className="border-t border-white/20 pt-3 flex justify-between items-center">
                <span className="text-sm font-semibold text-white">Total Job Cost</span>
                <span className="font-bold text-white">{fmtMoney(summary.summary.total_job_cost)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-white/70">Contract Price</span>
                <span className="text-white font-medium">{fmtMoney(summary.summary.contract_price)}</span>
              </div>
              <div className="border-t border-white/20 pt-3 flex justify-between items-center">
                <span className="text-sm font-bold text-white">Gross Profit</span>
                <span className={`font-bold text-lg ${summary.summary.gross_profit >= 0 ? "text-green-300" : "text-red-300"}`}>
                  {fmtMoney(summary.summary.gross_profit)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-white/70">Margin</span>
                <span className={`font-semibold ${summary.summary.margin_pct >= 0 ? "text-green-300" : "text-red-300"}`}>
                  {summary.summary.margin_pct}%
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Time Entries Modal */}
      {showTimeEntries && summary && (
        <TimeEntriesModal
          leadId={lead.id}
          companyId={companyId}
          employees={summary.labor.employees}
          onClose={() => setShowTimeEntries(false)}
          onWageChange={() => { setShowTimeEntries(false); loadSummary(); }}
        />
      )}

      {/* Materials Form Modal */}
      {showMaterials && (
        <MaterialsForm
          leadId={lead.id}
          companyId={companyId}
          onClose={() => setShowMaterials(false)}
          onUpdate={loadSummary}
        />
      )}
    </div>
  );
}
