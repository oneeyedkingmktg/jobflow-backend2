import React, { useState, useEffect, useCallback } from "react";
import { JobReportsAPI } from "../api";
import { useAuth } from "../AuthContext";
import { useCompany } from "../CompanyContext";

export default function MaterialsLibraryAdmin({ onBack }) {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const companyId = user?.role === "master"
    ? (currentCompany?.id || currentCompany?.companyId || null)
    : null;

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // New category
  const [newCatName, setNewCatName] = useState("");
  const [savingCat, setSavingCat] = useState(false);

  // Edit category
  const [editCatId, setEditCatId] = useState(null);
  const [editCatName, setEditCatName] = useState("");

  // New item — keyed by category id
  const [addingItemCatId, setAddingItemCatId] = useState(null);
  const [newItem, setNewItem] = useState({ name: "", unit: "", default_cost: "" });
  const [savingItem, setSavingItem] = useState(false);

  // Edit item
  const [editItemId, setEditItemId] = useState(null);
  const [editItem, setEditItem] = useState({ name: "", unit: "", default_cost: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await JobReportsAPI.getLibrary(companyId);
      setCategories(data.categories || []);
    } catch (err) {
      console.error("Library load error:", err);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  // ── Category actions ──────────────────────────────────────────────────────

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    setSavingCat(true);
    try {
      await JobReportsAPI.createCategory({ name: newCatName.trim() }, companyId);
      setNewCatName("");
      await load();
    } catch (err) {
      alert(err.message || "Failed to add category.");
    } finally {
      setSavingCat(false);
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

  const openAddItem = (catId) => {
    setAddingItemCatId(catId);
    setNewItem({ name: "", unit: "", default_cost: "" });
    setEditItemId(null);
  };

  const handleAddItem = async (catId) => {
    if (!newItem.name.trim()) return;
    setSavingItem(true);
    try {
      await JobReportsAPI.createItem({
        category_id: catId,
        name: newItem.name.trim(),
        unit: newItem.unit.trim() || null,
        default_cost: parseFloat(newItem.default_cost) || 0,
      }, companyId);
      setAddingItemCatId(null);
      await load();
    } catch (err) {
      alert(err.message || "Failed to add item.");
    } finally {
      setSavingItem(false);
    }
  };

  const openEditItem = (item) => {
    setEditItemId(item.id);
    setEditItem({
      name: item.name,
      unit: item.unit || "",
      default_cost: item.default_cost != null ? String(item.default_cost) : "",
    });
    setAddingItemCatId(null);
  };

  const handleSaveItem = async (id) => {
    if (!editItem.name.trim()) return;
    try {
      await JobReportsAPI.updateItem(id, {
        name: editItem.name.trim(),
        unit: editItem.unit.trim() || null,
        default_cost: parseFloat(editItem.default_cost) || 0,
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
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200 bg-white shrink-0">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-700 p-1">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-bold text-gray-900">Materials Library</h2>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm">Loading…</div>
        ) : (
          <>
            {categories.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">No categories yet. Add one below.</p>
            )}

            {categories.map((cat) => (
              <div key={cat.id} className="border border-gray-200 rounded-2xl overflow-hidden">
                {/* Category header */}
                <div className="bg-gray-50 px-4 py-3 flex items-center gap-2">
                  {editCatId === cat.id ? (
                    <>
                      <input
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-semibold"
                        value={editCatName}
                        onChange={(e) => setEditCatName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSaveCategory(cat.id)}
                        autoFocus
                      />
                      <button onClick={() => handleSaveCategory(cat.id)}
                        className="px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700">
                        Save
                      </button>
                      <button onClick={() => setEditCatId(null)}
                        className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-300">
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm font-bold text-gray-800">{cat.name}</span>
                      <button onClick={() => { setEditCatId(cat.id); setEditCatName(cat.name); }}
                        className="text-blue-500 hover:text-blue-700 text-xs font-medium px-2">
                        Edit
                      </button>
                      <button onClick={() => handleDeleteCategory(cat.id)}
                        className="text-red-400 hover:text-red-600 text-xs font-medium px-2">
                        Delete
                      </button>
                    </>
                  )}
                </div>

                {/* Items */}
                <div className="divide-y divide-gray-100">
                  {cat.items.length === 0 && addingItemCatId !== cat.id && (
                    <div className="px-4 py-3 text-xs text-gray-400 italic">No items yet.</div>
                  )}

                  {cat.items.map((item) => (
                    <div key={item.id} className="px-4 py-3">
                      {editItemId === item.id ? (
                        <div className="space-y-2">
                          <input
                            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                            placeholder="Item name"
                            value={editItem.name}
                            onChange={(e) => setEditItem((f) => ({ ...f, name: e.target.value }))}
                          />
                          <div className="flex gap-2">
                            <input
                              className="w-24 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                              placeholder="Unit (ea)"
                              value={editItem.unit}
                              onChange={(e) => setEditItem((f) => ({ ...f, unit: e.target.value }))}
                            />
                            <input
                              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                              placeholder="Default cost"
                              type="number"
                              min="0"
                              step="0.01"
                              value={editItem.default_cost}
                              onChange={(e) => setEditItem((f) => ({ ...f, default_cost: e.target.value }))}
                            />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => handleSaveItem(item.id)}
                              className="flex-1 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700">
                              Save
                            </button>
                            <button onClick={() => setEditItemId(null)}
                              className="flex-1 py-1.5 bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-300">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-gray-800 font-medium">{item.name}</span>
                            <span className="text-xs text-gray-400 ml-2">
                              {item.unit || "ea"}
                              {item.default_cost > 0 && ` · $${parseFloat(item.default_cost).toFixed(2)}`}
                            </span>
                          </div>
                          <div className="flex gap-3 shrink-0">
                            <button onClick={() => openEditItem(item)}
                              className="text-blue-500 hover:text-blue-700 text-xs font-medium">
                              Edit
                            </button>
                            <button onClick={() => handleDeleteItem(item.id)}
                              className="text-red-400 hover:text-red-600 text-xs font-medium">
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Add item inline form */}
                  {addingItemCatId === cat.id ? (
                    <div className="px-4 py-3 space-y-2 bg-blue-50">
                      <input
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                        placeholder="Item name"
                        value={newItem.name}
                        onChange={(e) => setNewItem((f) => ({ ...f, name: e.target.value }))}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <input
                          className="w-24 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                          placeholder="Unit (ea)"
                          value={newItem.unit}
                          onChange={(e) => setNewItem((f) => ({ ...f, unit: e.target.value }))}
                        />
                        <input
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                          placeholder="Default cost"
                          type="number"
                          min="0"
                          step="0.01"
                          value={newItem.default_cost}
                          onChange={(e) => setNewItem((f) => ({ ...f, default_cost: e.target.value }))}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleAddItem(cat.id)} disabled={savingItem || !newItem.name.trim()}
                          className="flex-1 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
                          {savingItem ? "Saving…" : "Add Item"}
                        </button>
                        <button onClick={() => setAddingItemCatId(null)}
                          className="flex-1 py-1.5 bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-300">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => openAddItem(cat.id)}
                      className="w-full px-4 py-2.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 text-left transition">
                      + Add Item
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Add category */}
            <div className="border-2 border-dashed border-gray-300 rounded-2xl p-4">
              <div className="text-xs font-semibold text-gray-500 mb-2">New Category</div>
              <div className="flex gap-2">
                <input
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="Category name…"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                />
                <button onClick={handleAddCategory} disabled={savingCat || !newCatName.trim()}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {savingCat ? "…" : "Add"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
