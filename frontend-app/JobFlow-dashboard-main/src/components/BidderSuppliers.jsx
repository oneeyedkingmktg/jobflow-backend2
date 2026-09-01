// ============================================================================
// File: src/components/BidderSuppliers.jsx
// Master-only: global supplier catalog + per-supplier product lists + systems
// ============================================================================

import React, { useEffect, useState } from 'react';
import { BidderAPI } from '../api';

const UNIT_OPTIONS = ['per sqft', 'per kit', 'per gallon', 'per unit', 'flat fee', 'per hour'];

const EMPTY_SUPPLIER = { name: '', notes: '' };
const EMPTY_PRODUCT = {
  name: '', description: '', default_unit_price: '', default_unit_label: 'per sqft',
  color: '', sku: '', kit_price: '', sqft_per_kit: '', is_charge_only: false,
};
const EMPTY_SYSTEM = {
  name: '', description: '', default_unit_price: '', default_unit_label: 'per sqft',
  color: '', sku: '', component_ids: [],
};

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300';
const labelCls = 'block text-xs font-semibold text-gray-500 uppercase mb-1';

// ── ProductForm ──────────────────────────────────────────────────────────────
function ProductForm({ initial = EMPTY_PRODUCT, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className={labelCls}>Product Name *</label>
          <input className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Polyaspartic Base Coat" />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Description</label>
          <input className={inputCls} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Optional description" />
        </div>
        <div>
          <label className={labelCls}>Unit Price ($)</label>
          <input className={inputCls} type="number" min="0" step="0.01" value={form.default_unit_price} onChange={(e) => set('default_unit_price', e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <label className={labelCls}>Unit Label</label>
          <select className={inputCls} value={form.default_unit_label} onChange={(e) => set('default_unit_label', e.target.value)}>
            {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Color / Finish</label>
          <input className={inputCls} value={form.color} onChange={(e) => set('color', e.target.value)} placeholder="e.g. Slate Gray" />
        </div>
        <div className="flex items-center gap-2 pt-5">
          <input type="checkbox" id="charge_only_prod" checked={form.is_charge_only} onChange={(e) => set('is_charge_only', e.target.checked)} className="w-4 h-4 rounded" />
          <label htmlFor="charge_only_prod" className="text-sm text-gray-700">Service charge only (no material)</label>
        </div>
        {!form.is_charge_only && (
          <>
            <div>
              <label className={labelCls}>SKU</label>
              <input className={inputCls} value={form.sku} onChange={(e) => set('sku', e.target.value)} placeholder="e.g. SW-1234" />
            </div>
            <div>
              <label className={labelCls}>Kit Price ($)</label>
              <input className={inputCls} type="number" min="0" step="0.01" value={form.kit_price} onChange={(e) => set('kit_price', e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className={labelCls}>Sqft / Kit</label>
              <input className={inputCls} type="number" min="0" step="1" value={form.sqft_per_kit} onChange={(e) => set('sqft_per_kit', e.target.value)} placeholder="0" />
            </div>
          </>
        )}
      </div>
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onSave({ ...form, is_system: false, component_ids: [] })}
          disabled={saving || !form.name.trim()}
          className="px-4 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg disabled:opacity-50 hover:bg-blue-700"
        >
          {saving ? 'Saving…' : 'Save Product'}
        </button>
        <button onClick={onCancel} className="px-4 py-1.5 bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-300">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── SystemForm ───────────────────────────────────────────────────────────────
function SystemForm({ initial = EMPTY_SYSTEM, availableComponents = [], onSave, onCancel, saving }) {
  const [form, setForm] = useState({ ...EMPTY_SYSTEM, ...initial });
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  function toggleComponent(id) {
    setForm((p) => ({
      ...p,
      component_ids: p.component_ids.includes(id)
        ? p.component_ids.filter((x) => x !== id)
        : [...p.component_ids, id],
    }));
  }

  return (
    <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded-full font-semibold">System</span>
        <span className="text-xs text-purple-700 font-medium">Bundle of products from this supplier</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className={labelCls}>System Name *</label>
          <input className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Full Polyaspartic System" />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Description</label>
          <input className={inputCls} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Optional description" />
        </div>
        <div>
          <label className={labelCls}>System Price ($)</label>
          <input className={inputCls} type="number" min="0" step="0.01" value={form.default_unit_price} onChange={(e) => set('default_unit_price', e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <label className={labelCls}>Unit Label</label>
          <select className={inputCls} value={form.default_unit_label} onChange={(e) => set('default_unit_label', e.target.value)}>
            {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Color / Finish</label>
          <input className={inputCls} value={form.color} onChange={(e) => set('color', e.target.value)} placeholder="e.g. Slate Gray" />
        </div>
        <div>
          <label className={labelCls}>SKU</label>
          <input className={inputCls} value={form.sku} onChange={(e) => set('sku', e.target.value)} placeholder="e.g. SYS-001" />
        </div>
      </div>

      <div>
        <label className={labelCls}>Components — select products from this supplier</label>
        {availableComponents.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No products available. Add regular products first.</p>
        ) : (
          <div className="border border-purple-200 rounded-lg bg-white divide-y divide-gray-100 max-h-48 overflow-y-auto">
            {availableComponents.map((p) => (
              <label key={p.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-purple-50">
                <input
                  type="checkbox"
                  checked={form.component_ids.includes(p.id)}
                  onChange={() => toggleComponent(p.id)}
                  className="w-4 h-4 rounded accent-purple-600"
                />
                <span className="text-sm text-gray-800">{p.name}</span>
                {p.sku && <span className="text-xs text-gray-400 font-mono">{p.sku}</span>}
                <span className="ml-auto text-xs text-gray-500">${parseFloat(p.default_unit_price || 0).toFixed(2)} {p.default_unit_label}</span>
              </label>
            ))}
          </div>
        )}
        {form.component_ids.length > 0 && (
          <p className="text-xs text-purple-600 mt-1">{form.component_ids.length} component{form.component_ids.length !== 1 ? 's' : ''} selected</p>
        )}
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onSave({ ...form, is_system: true })}
          disabled={saving || !form.name.trim() || form.component_ids.length === 0}
          className="px-4 py-1.5 bg-purple-600 text-white text-sm font-semibold rounded-lg disabled:opacity-50 hover:bg-purple-700"
        >
          {saving ? 'Saving…' : 'Save System'}
        </button>
        <button onClick={onCancel} className="px-4 py-1.5 bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-300">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── SupplierRow ──────────────────────────────────────────────────────────────
function SupplierRow({ supplier, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [addingProduct, setAddingProduct] = useState(false);
  const [addingSystem, setAddingSystem] = useState(false);
  const [editProductId, setEditProductId] = useState(null);
  const [savingProduct, setSavingProduct] = useState(false);

  // Non-system, non-charge-only products available as system components
  const componentOptions = products.filter((p) => !p.is_system && !p.is_charge_only);

  async function loadProducts() {
    setLoadingProducts(true);
    try {
      setProducts(await BidderAPI.getSupplierProducts(supplier.id));
    } finally {
      setLoadingProducts(false);
    }
  }

  function handleToggle() {
    if (!open && products.length === 0) loadProducts();
    setOpen((p) => !p);
  }

  function startAddProduct() {
    setAddingProduct(true);
    setAddingSystem(false);
    setEditProductId(null);
  }

  function startAddSystem() {
    setAddingSystem(true);
    setAddingProduct(false);
    setEditProductId(null);
  }

  async function handleSaveProduct(form) {
    setSavingProduct(true);
    try {
      await BidderAPI.createSupplierProduct(supplier.id, form);
      setAddingProduct(false);
      setAddingSystem(false);
      await loadProducts();
    } catch {
      alert('Failed to save product');
    } finally {
      setSavingProduct(false);
    }
  }

  async function handleUpdateProduct(id, form) {
    setSavingProduct(true);
    try {
      await BidderAPI.updateSupplierProduct(id, form);
      setEditProductId(null);
      await loadProducts();
    } catch {
      alert('Failed to update product');
    } finally {
      setSavingProduct(false);
    }
  }

  async function handleDeleteProduct(id, name) {
    if (!window.confirm(`Delete "${name}"?`)) return;
    try {
      await BidderAPI.deleteSupplierProduct(id);
      await loadProducts();
    } catch {
      alert('Failed to delete product');
    }
  }

  const regularProducts = products.filter((p) => !p.is_system);
  const systemProducts  = products.filter((p) => p.is_system);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Supplier header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white">
        <button onClick={handleToggle} className="flex items-center gap-2 flex-1 min-w-0 text-left">
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${open ? 'rotate-90' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <div>
            <span className="font-semibold text-gray-800">{supplier.name}</span>
            {!supplier.is_active && (
              <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactive</span>
            )}
            {supplier.notes && (
              <p className="text-xs text-gray-500 mt-0.5 truncate">{supplier.notes}</p>
            )}
          </div>
        </button>
        <button onClick={() => onEdit(supplier)} className="text-xs text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50">
          Edit
        </button>
        <button onClick={() => onDelete(supplier)} className="text-xs text-red-500 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50">
          Delete
        </button>
      </div>

      {/* Products panel */}
      {open && (
        <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-4">

          {/* ── Regular Products ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase">Products</span>
              {!addingProduct && !addingSystem && (
                <button onClick={startAddProduct} className="text-xs text-blue-600 border border-blue-200 px-3 py-1 rounded-lg hover:bg-blue-50">
                  + Add Product
                </button>
              )}
            </div>

            {addingProduct && (
              <ProductForm
                onSave={handleSaveProduct}
                onCancel={() => setAddingProduct(false)}
                saving={savingProduct}
              />
            )}

            {loadingProducts ? (
              <p className="text-sm text-gray-400">Loading…</p>
            ) : regularProducts.length === 0 && !addingProduct ? (
              <p className="text-sm text-gray-400 italic">No products yet.</p>
            ) : (
              <div className="space-y-2">
                {regularProducts.map((p) =>
                  editProductId === p.id ? (
                    <ProductForm
                      key={p.id}
                      initial={{
                        name: p.name,
                        description: p.description || '',
                        default_unit_price: p.default_unit_price,
                        default_unit_label: p.default_unit_label || 'per sqft',
                        color: p.color || '',
                        sku: p.sku || '',
                        kit_price: p.kit_price != null ? p.kit_price : '',
                        sqft_per_kit: p.sqft_per_kit != null ? p.sqft_per_kit : '',
                        is_charge_only: p.is_charge_only || false,
                      }}
                      onSave={(form) => handleUpdateProduct(p.id, form)}
                      onCancel={() => setEditProductId(null)}
                      saving={savingProduct}
                    />
                  ) : (
                    <ProductRow
                      key={p.id}
                      p={p}
                      onEdit={() => { setEditProductId(p.id); setAddingProduct(false); setAddingSystem(false); }}
                      onDelete={() => handleDeleteProduct(p.id, p.name)}
                    />
                  )
                )}
              </div>
            )}
          </div>

          {/* ── Systems ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-purple-600 uppercase">Systems</span>
              {!addingProduct && !addingSystem && (
                <button onClick={startAddSystem} className="text-xs text-purple-600 border border-purple-200 px-3 py-1 rounded-lg hover:bg-purple-50">
                  + Add System
                </button>
              )}
            </div>

            {addingSystem && (
              <SystemForm
                availableComponents={componentOptions}
                onSave={handleSaveProduct}
                onCancel={() => setAddingSystem(false)}
                saving={savingProduct}
              />
            )}

            {systemProducts.length === 0 && !addingSystem ? (
              <p className="text-sm text-gray-400 italic">No systems yet.</p>
            ) : (
              <div className="space-y-2">
                {systemProducts.map((p) =>
                  editProductId === p.id ? (
                    <SystemForm
                      key={p.id}
                      initial={{
                        name: p.name,
                        description: p.description || '',
                        default_unit_price: p.default_unit_price,
                        default_unit_label: p.default_unit_label || 'per sqft',
                        color: p.color || '',
                        sku: p.sku || '',
                        component_ids: (p.components || []).map((c) => c.component_product_id),
                      }}
                      availableComponents={componentOptions}
                      onSave={(form) => handleUpdateProduct(p.id, form)}
                      onCancel={() => setEditProductId(null)}
                      saving={savingProduct}
                    />
                  ) : (
                    <SystemRow
                      key={p.id}
                      p={p}
                      onEdit={() => { setEditProductId(p.id); setAddingProduct(false); setAddingSystem(false); }}
                      onDelete={() => handleDeleteProduct(p.id, p.name)}
                    />
                  )
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── ProductRow (regular item display) ────────────────────────────────────────
function ProductRow({ p, onEdit, onDelete }) {
  return (
    <div className="flex items-start gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-gray-800 text-sm">{p.name}</span>
          {p.sku && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-mono">SKU: {p.sku}</span>}
          {p.color && <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">{p.color}</span>}
          {p.is_charge_only && <span className="text-xs bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full">Service charge</span>}
          {!p.is_active && <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Inactive</span>}
        </div>
        {p.description && <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>}
        <div className="flex gap-3 mt-1 text-xs text-gray-500 flex-wrap">
          <span>${parseFloat(p.default_unit_price || 0).toFixed(2)} {p.default_unit_label}</span>
          {p.kit_price != null && <span>Kit: ${parseFloat(p.kit_price).toFixed(2)}</span>}
          {p.sqft_per_kit != null && <span>{p.sqft_per_kit} sqft/kit</span>}
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        <button onClick={onEdit} className="text-xs text-blue-600 border border-blue-200 px-2 py-1 rounded-lg hover:bg-blue-50">Edit</button>
        <button onClick={onDelete} className="text-xs text-red-500 border border-red-200 px-2 py-1 rounded-lg hover:bg-red-50">Delete</button>
      </div>
    </div>
  );
}

// ── SystemRow (system display with components) ────────────────────────────────
function SystemRow({ p, onEdit, onDelete }) {
  return (
    <div className="flex items-start gap-3 bg-white border border-purple-200 rounded-lg px-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-gray-800 text-sm">{p.name}</span>
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold">System</span>
          {p.sku && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-mono">SKU: {p.sku}</span>}
          {p.color && <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">{p.color}</span>}
          {!p.is_active && <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Inactive</span>}
        </div>
        {p.description && <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>}
        <div className="flex gap-3 mt-1 text-xs text-gray-500">
          <span>${parseFloat(p.default_unit_price || 0).toFixed(2)} {p.default_unit_label}</span>
        </div>
        {p.components && p.components.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {p.components.map((c) => (
              <span key={c.component_product_id} className="text-xs bg-purple-50 text-purple-600 border border-purple-100 px-2 py-0.5 rounded-full">
                {c.name}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-2 shrink-0">
        <button onClick={onEdit} className="text-xs text-blue-600 border border-blue-200 px-2 py-1 rounded-lg hover:bg-blue-50">Edit</button>
        <button onClick={onDelete} className="text-xs text-red-500 border border-red-200 px-2 py-1 rounded-lg hover:bg-red-50">Delete</button>
      </div>
    </div>
  );
}

// ── SupplierForm ─────────────────────────────────────────────────────────────
function SupplierForm({ initial = EMPTY_SUPPLIER, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
      <div>
        <label className={labelCls}>Supplier Name *</label>
        <input className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Sherwin-Williams" />
      </div>
      <div>
        <label className={labelCls}>Notes</label>
        <input className={inputCls} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Optional notes" />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onSave(form)}
          disabled={saving || !form.name.trim()}
          className="px-4 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg disabled:opacity-50 hover:bg-blue-700"
        >
          {saving ? 'Saving…' : 'Save Supplier'}
        </button>
        <button onClick={onCancel} className="px-4 py-1.5 bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-300">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function BidderSuppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingSupplier, setAddingSupplier] = useState(false);
  const [editSupplierId, setEditSupplierId] = useState(null);
  const [savingSupplier, setSavingSupplier] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      setSuppliers(await BidderAPI.getGlobalSuppliers());
    } catch {
      console.error('Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddSupplier(form) {
    setSavingSupplier(true);
    try {
      await BidderAPI.createGlobalSupplier(form);
      setAddingSupplier(false);
      await load();
    } catch {
      alert('Failed to save supplier');
    } finally {
      setSavingSupplier(false);
    }
  }

  async function handleUpdateSupplier(id, form) {
    setSavingSupplier(true);
    try {
      await BidderAPI.updateGlobalSupplier(id, form);
      setEditSupplierId(null);
      await load();
    } catch {
      alert('Failed to update supplier');
    } finally {
      setSavingSupplier(false);
    }
  }

  async function handleDeleteSupplier(supplier) {
    if (!window.confirm(`Delete supplier "${supplier.name}" and all its products? This cannot be undone.`)) return;
    try {
      await BidderAPI.deleteGlobalSupplier(supplier.id);
      await load();
    } catch {
      alert('Failed to delete supplier');
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Global product catalog by supplier — master account only</p>
        </div>
        {!addingSupplier && (
          <button
            onClick={() => { setAddingSupplier(true); setEditSupplierId(null); }}
            className="px-4 py-2 bg-blue-600 text-white font-semibold text-sm rounded-lg hover:bg-blue-700"
          >
            + Add Supplier
          </button>
        )}
      </div>

      {addingSupplier && (
        <SupplierForm
          onSave={handleAddSupplier}
          onCancel={() => setAddingSupplier(false)}
          saving={savingSupplier}
        />
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Loading suppliers…</p>
      ) : suppliers.length === 0 && !addingSupplier ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
          <p className="text-gray-500 mb-3">No suppliers yet.</p>
          <button
            onClick={() => setAddingSupplier(true)}
            className="px-5 py-2 bg-blue-600 text-white font-semibold text-sm rounded-lg hover:bg-blue-700"
          >
            Add First Supplier
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {suppliers.map((s) =>
            editSupplierId === s.id ? (
              <SupplierForm
                key={s.id}
                initial={{ name: s.name, notes: s.notes || '' }}
                onSave={(form) => handleUpdateSupplier(s.id, form)}
                onCancel={() => setEditSupplierId(null)}
                saving={savingSupplier}
              />
            ) : (
              <SupplierRow
                key={s.id}
                supplier={s}
                onEdit={(sup) => { setEditSupplierId(sup.id); setAddingSupplier(false); }}
                onDelete={handleDeleteSupplier}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}
