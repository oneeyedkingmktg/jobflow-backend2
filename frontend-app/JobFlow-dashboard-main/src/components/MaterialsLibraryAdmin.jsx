import React, { useState, useEffect, useCallback } from "react";
import { JobReportsAPI } from "../api";
import { useAuth } from "../AuthContext";
import { useCompany } from "../CompanyContext";

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300";
const labelCls = "block text-xs font-semibold text-gray-500 uppercase mb-1";

export default function MaterialsLibraryAdmin({ onBack, companyId: propCompanyId }) {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const companyId = propCompanyId != null
    ? propCompanyId
    : user?.role === "master"
      ? (currentCompany?.id || currentCompany?.companyId || null)
      : null;

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCats, setExpandedCats] = useState({});

  // New category
  const [newCatName, setNewCatName] = useState("");
  const [addingCat, setAddingCat] = useState(false);

  // Edit category
  const [editCatId, setEditCatId] = useState(null);
  const [editCatName, setEditCatName] = useState("");

  // New item — keyed by category id
  const [newItemCatId, setNewItemCatId] = useState(null);
  const [newItemForm, setNewItemForm] = useState({ name: "", unit: "", default_cost: "" });
  const [savingItem, setSavingItem] = useState(false);

  // Edit item
  const [editItemId, setEditItemId] = useState(null);
  const [editItemForm, setEditItemForm] = useState({ name: "", unit: "", default_cost: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await JobReportsAPI.getLibrary(companyId);
      const cats = data.categories || [];
      setCategories(cats);
      setExpandedCats({});
    } catch (err) {
      console.error("Library load error:", err);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const toggleCat = (id) =>
    setExpandedCats((p) => ({ ...p, [id]: !p[id] }));

  // ── Category actions ──────────────────────────────────────────────────────

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    setAddingCat(true);
    try {
      await JobReportsAPI.createCategory({ name: newCatName.trim() }, companyId);
      setNewCatName("");
      await load();
    } catch (err) {
      alert(err.message || "Failed to add category.");
    } finally {
      setAddingCat(false);
    }
  };

  const handleSaveCategory = async (id) => {
    if (!editCatName.trim()) return;
    try {
      await JobReportsAPI.updateCategory(id, { name: editCatName.trim() }, companyId);
      setEditCatId(null);
      await load();
    } catch (err) {
      alert(err.message || "Failed to save category.");
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm("Delete this category and all its items?")) return;
    try {
      await JobReportsAPI.deleteCategory(id, companyId);
      await load();
    } catch (err) {
      alert(err.message || "Failed to delete category.");
    }
  };

  // ── Item actions ──────────────────────────────────────────────────────────

  const startAddItem = (catId) => {
    setNewItemCatId(catId);
    setNewItemForm({ name: "", unit: "", default_cost: "" });
    setEditItemId(null);
  };

  const handleAddItem = async (catId) => {
    if (!newItemForm.name.trim()) return;
    setSavingItem(true);
    try {
      await JobReportsAPI.createItem({
        category_id: catId,
        name: newItemForm.name.trim(),
        unit: newItemForm.unit.trim() || null,
        default_cost: parseFloat(newItemForm.default_cost) || 0,
      }, companyId);
      setNewItemCatId(null);
      await load();
    } catch (err) {
      alert(err.message || "Failed to add item.");
    } finally {
      setSavingItem(false);
    }
  };

  const startEditItem = (item) => {
    setEditItemId(item.id);
    setEditItemForm({
      name: item.name,
      unit: item.unit || "",
      default_cost: item.default_cost != null ? String(item.default_cost) : "",
    });
    setNewItemCatId(null);
  };

  const handleSaveItem = async (id) => {
    if (!editItemForm.name.trim()) return;
    try {
      await JobReportsAPI.updateItem(id, {
        name: editItemForm.name.trim(),
        unit: editItemForm.unit.trim() || null,
        default_cost: parseFloat(editItemForm.default_cost) || 0,
      }, companyId);
      setEditItemId(null);
      await load();
    } catch (err) {
      alert(err.message || "Failed to save item.");
    }
  };

  const handleDeleteItem = async (id) => {
    if (!window.confirm("Remove this item from the library?")) return;
    try {
      await JobReportsAPI.deleteItem(id, companyId);
      await load();
    } catch (err) {
      alert(err.message || "Failed to delete item.");
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {onBack && (
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200 bg-white shrink-0">
          <button onClick={onBack} className="text-gray-500 hover:text-gray-700 p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-lg font-bold text-gray-900">Materials Library</h2>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-1 py-4 space-y-4">
        {loading ? (
          <p className="text-sm text-gray-500 text-center py-8">Loading library…</p>
        ) : (
          <>
            {categories.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">No categories yet. Add one below.</p>
            )}

            {categories.map((cat) => (
              <div key={cat.id} className="border border-gray-200 rounded-xl overflow-hidden">
                {/* Category header */}
                <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
                  {editCatId === cat.id ? (
                    <>
                      <input
                        className="flex-1 px-2 py-1 border rounded text-sm"
                        value={editCatName}
                        onChange={(e) => setEditCatName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSaveCategory(cat.id)}
                        autoFocus
                      />
                      <button onClick={() => handleSaveCategory(cat.id)}
                        className="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg">Save</button>
                      <button onClick={() => setEditCatId(null)}
                        className="px-3 py-1 bg-gray-200 text-gray-700 text-xs rounded-lg">Cancel</button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => toggleCat(cat.id)}
                        className="flex-1 text-left font-semibold text-gray-800 text-sm flex items-center gap-2"
                      >
                        <span className={`transition-transform text-gray-400 text-xs ${expandedCats[cat.id] ? "rotate-90" : ""}`}>▶</span>
                        {cat.name}
                        <span className="text-gray-400 font-normal text-xs">({cat.items?.length || 0} items)</span>
                      </button>
                      <button onClick={() => { setEditCatId(cat.id); setEditCatName(cat.name); }}
                        className="text-xs text-blue-600 hover:underline px-2">Rename</button>
                      <button onClick={() => handleDeleteCategory(cat.id)}
                        className="text-xs text-red-500 hover:underline px-2">Delete</button>
                    </>
                  )}
                </div>

                {/* Items — only when expanded */}
                {expandedCats[cat.id] && (
                  <div className="divide-y divide-gray-100">
                    {cat.items.map((item) => (
                      <div key={item.id} className="px-4 py-3">
                        {editItemId === item.id ? (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className={labelCls}>Name *</label>
                                <input className={inputCls} value={editItemForm.name}
                                  onChange={(e) => setEditItemForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
                              </div>
                              <div>
                                <label className={labelCls}>Default Cost</label>
                                <input className={inputCls} type="number" min="0" step="0.01"
                                  value={editItemForm.default_cost}
                                  onChange={(e) => setEditItemForm((f) => ({ ...f, default_cost: e.target.value }))} />
                              </div>
                            </div>
                            <div>
                              <label className={labelCls}>Unit</label>
                              <input className={inputCls} placeholder="ea, sqft, bag…" value={editItemForm.unit}
                                onChange={(e) => setEditItemForm((f) => ({ ...f, unit: e.target.value }))} />
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => handleSaveItem(item.id)}
                                className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg">Save</button>
                              <button onClick={() => setEditItemId(null)}
                                className="px-4 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-lg">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-sm text-gray-800">{item.name}</span>
                              <span className="text-xs text-gray-400 ml-2">
                                {item.unit || "ea"}
                                {parseFloat(item.default_cost) > 0 && ` · $${parseFloat(item.default_cost).toFixed(2)}`}
                              </span>
                            </div>
                            <button onClick={() => startEditItem(item)}
                              className="text-xs text-blue-600 hover:underline px-2">Edit</button>
                            <button onClick={() => handleDeleteItem(item.id)}
                              className="text-xs text-red-500 hover:underline px-2">Delete</button>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Add item row */}
                    {newItemCatId === cat.id ? (
                      <div className="px-4 py-3 bg-blue-50 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className={labelCls}>Name *</label>
                            <input className={inputCls} value={newItemForm.name}
                              onChange={(e) => setNewItemForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
                          </div>
                          <div>
                            <label className={labelCls}>Default Cost</label>
                            <input className={inputCls} type="number" min="0" step="0.01"
                              value={newItemForm.default_cost}
                              onChange={(e) => setNewItemForm((f) => ({ ...f, default_cost: e.target.value }))} />
                          </div>
                        </div>
                        <div>
                          <label className={labelCls}>Unit</label>
                          <input className={inputCls} placeholder="ea, sqft, bag…" value={newItemForm.unit}
                            onChange={(e) => setNewItemForm((f) => ({ ...f, unit: e.target.value }))} />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleAddItem(cat.id)} disabled={savingItem || !newItemForm.name.trim()}
                            className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-50">
                            {savingItem ? "Saving…" : "Add Item"}
                          </button>
                          <button onClick={() => setNewItemCatId(null)}
                            className="px-4 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-lg">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="px-4 py-2">
                        <button onClick={() => startAddItem(cat.id)}
                          className="text-sm text-blue-600 hover:underline">+ Add Item</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Add category */}
            <div className="flex gap-2 pt-2">
              <input
                className={`${inputCls} flex-1`}
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="New category name…"
                onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
              />
              <button onClick={handleAddCategory} disabled={addingCat || !newCatName.trim()}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg disabled:opacity-50">
                {addingCat ? "Adding…" : "+ Category"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
