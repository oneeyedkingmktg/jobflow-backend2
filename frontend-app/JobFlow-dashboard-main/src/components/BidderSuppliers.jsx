// ============================================================================
// File: src/components/BidderSuppliers.jsx
// Master-only: global supplier catalog + per-supplier product lists + systems
// ============================================================================

import React, { useEffect, useState } from 'react';
import { BidderAPI } from '../api';

const UNIT_OPTIONS = ['per sqft', 'per kit', 'per gallon', 'per unit', 'flat fee', 'per hour'];

const EMPTY_SUPPLIER = { name: '', notes: '', phone: '', website: '', contact_name: '', lead_time: '', order_email: '' };
const EMPTY_PRODUCT = {
  name: '', internal_name: '', internal_description: '', description: '',
  default_unit_price: '', default_unit_label: 'per sqft',
  color: '', sku: '', kit_price: '', sqft_per_kit: '', is_charge_only: false,
};
const EMPTY_SYSTEM = {
  name: '', internal_name: '', internal_description: '', description: '',
  default_unit_price: '', default_unit_label: 'per sqft',
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
          <label className={labelCls}>Product Name * <span className="normal-case text-gray-400 font-normal">— shown on proposal</span></label>
          <input className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Polyaspartic Base Coat" />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Internal Name <span className="normal-case text-gray-400 font-normal">— shown in bidder picker</span></label>
          <input className={inputCls} value={form.internal_name} onChange={(e) => set('internal_name', e.target.value)} placeholder="e.g. SW Poly Base — Low Moisture" />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Description <span className="normal-case text-gray-400 font-normal">— shown on proposal</span></label>
          <input className={inputCls} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Optional proposal description" />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Internal Description <span className="normal-case text-gray-400 font-normal">— internal notes only</span></label>
          <input className={inputCls} value={form.internal_description} onChange={(e) => set('internal_description', e.target.value)} placeholder="e.g. Coverage rate, mix ratio, notes for staff" />
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
          <label className={labelCls}>Proposal Name * <span className="normal-case text-gray-400 font-normal">— shown on customer proposal</span></label>
          <input className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Full Broadcast Decorative Flake" />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Internal Name * <span className="normal-case text-gray-400 font-normal">— shown in bidder item picker</span></label>
          <input className={inputCls} value={form.internal_name} onChange={(e) => set('internal_name', e.target.value)} placeholder="e.g. Low Moisture – No MVB – ¼″ Flakes" />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Description <span className="normal-case text-gray-400 font-normal">— shown on proposal</span></label>
          <input className={inputCls} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Optional description shown on proposal" />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Internal Description <span className="normal-case text-gray-400 font-normal">— internal notes only</span></label>
          <input className={inputCls} value={form.internal_description || ''} onChange={(e) => set('internal_description', e.target.value)} placeholder="e.g. Application notes, mix ratios, installer tips" />
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
          disabled={saving || !form.name.trim() || !form.internal_name.trim() || form.component_ids.length === 0}
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
  const [showProducts, setShowProducts] = useState(false);
  const [showSystems, setShowSystems] = useState(false);

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
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-800">{supplier.name}</span>
              {!supplier.is_active && (
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactive</span>
              )}
            </div>
            {supplier.notes && (
              <p className="text-xs text-gray-500 mt-0.5 truncate">{supplier.notes}</p>
            )}
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
              {supplier.contact_name && (
                <span className="text-xs text-gray-400">{supplier.contact_name}</span>
              )}
              {supplier.phone && (
                <span className="text-xs text-gray-400">{supplier.phone}</span>
              )}
              {supplier.website && (
                <a href={supplier.website} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-xs text-blue-500 hover:underline">
                  {supplier.website.replace(/^https?:\/\//, '')}
                </a>
              )}
              {supplier.order_email && (
                <a href={`mailto:${supplier.order_email}`} onClick={(e) => e.stopPropagation()} className="text-xs text-blue-500 hover:underline">
                  {supplier.order_email}
                </a>
              )}
              {supplier.lead_time && (
                <span className="text-xs text-gray-400">Lead time: {supplier.lead_time}</span>
              )}
            </div>
          </div>
        </button>
        <button onClick={() => onEdit(supplier)} className="text-xs text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50">
          View
        </button>
        <button onClick={() => onDelete(supplier)} className="text-xs text-red-500 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50">
          Delete
        </button>
      </div>

      {/* Products panel */}
      {open && (
        <div className="border-t border-gray-100 bg-gray-50 p-3 space-y-2">

          {/* ── Systems dropdown ── */}
          <div className="border border-purple-100 rounded-lg overflow-hidden bg-white">
            <button
              onClick={() => setShowSystems((p) => !p)}
              className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-purple-50 text-left"
            >
              <svg className={`w-3.5 h-3.5 text-purple-300 transition-transform flex-shrink-0 ${showSystems ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-xs font-semibold text-purple-600 uppercase tracking-wide">⬡ Systems</span>
              <span className="text-xs text-gray-400 font-normal ml-1">({systemProducts.length})</span>
            </button>
            {showSystems && (
              <div className="border-t border-purple-100 p-3 space-y-2">
                {loadingProducts ? (
                  <p className="text-sm text-gray-400">Loading…</p>
                ) : systemProducts.length === 0 && !addingSystem ? (
                  <p className="text-sm text-gray-400 italic px-1">No systems yet.</p>
                ) : (
                  <div className="space-y-2">
                    {systemProducts.map((p) =>
                      editProductId === p.id ? (
                        <SystemForm
                          key={p.id}
                          initial={{
                            name: p.name,
                            internal_name: p.internal_name || '',
                            internal_description: p.internal_description || '',
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
                {addingSystem && (
                  <SystemForm
                    availableComponents={componentOptions}
                    onSave={handleSaveProduct}
                    onCancel={() => setAddingSystem(false)}
                    saving={savingProduct}
                  />
                )}
                {!addingProduct && !addingSystem && (
                  <button onClick={startAddSystem} className="mt-1 text-xs text-purple-600 border border-purple-200 px-3 py-1.5 rounded-lg hover:bg-purple-50">
                    + Add System
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── Products dropdown ── */}
          <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
            <button
              onClick={() => setShowProducts((p) => !p)}
              className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 text-left"
            >
              <svg className={`w-3.5 h-3.5 text-gray-300 transition-transform flex-shrink-0 ${showProducts ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">📦 Products</span>
              <span className="text-xs text-gray-400 font-normal ml-1">({regularProducts.length})</span>
            </button>
            {showProducts && (
              <div className="border-t border-gray-100 p-3 space-y-2">
                {loadingProducts ? (
                  <p className="text-sm text-gray-400">Loading…</p>
                ) : regularProducts.length === 0 && !addingProduct ? (
                  <p className="text-sm text-gray-400 italic px-1">No products yet.</p>
                ) : (
                  <div className="space-y-2">
                    {regularProducts.map((p) =>
                      editProductId === p.id ? (
                        <ProductForm
                          key={p.id}
                          initial={{
                            name: p.name,
                            internal_name: p.internal_name || '',
                            internal_description: p.internal_description || '',
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
                {addingProduct && (
                  <ProductForm
                    onSave={handleSaveProduct}
                    onCancel={() => setAddingProduct(false)}
                    saving={savingProduct}
                  />
                )}
                {!addingProduct && !addingSystem && (
                  <button onClick={startAddProduct} className="mt-1 text-xs text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50">
                    + Add Product
                  </button>
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
          <span className="font-medium text-gray-800 text-sm">{p.internal_name || p.name}</span>
          {p.sku && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-mono">SKU: {p.sku}</span>}
          {p.color && <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">{p.color}</span>}
          {p.is_charge_only && <span className="text-xs bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full">Service charge</span>}
          {!p.is_active && <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Inactive</span>}
        </div>
        {p.internal_name && <p className="text-xs text-blue-600 mt-0.5">Proposal name: {p.name}</p>}
        {p.internal_description && <p className="text-xs text-gray-400 italic mt-0.5">{p.internal_description}</p>}
        {!p.internal_description && p.description && <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>}
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
          <span className="font-medium text-gray-800 text-sm">{p.internal_name || p.name}</span>
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold">System</span>
          {p.sku && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-mono">SKU: {p.sku}</span>}
          {p.color && <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">{p.color}</span>}
          {!p.is_active && <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Inactive</span>}
        </div>
        {p.internal_name && (
          <p className="text-xs text-purple-600 mt-0.5">Proposal name: {p.name}</p>
        )}
        {p.internal_description && <p className="text-xs text-gray-400 italic mt-0.5">{p.internal_description}</p>}
        {!p.internal_description && p.description && <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>}
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
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className={labelCls}>Supplier Name *</label>
          <input className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Sherwin-Williams" />
        </div>
        <div>
          <label className={labelCls}>Contact Name</label>
          <input className={inputCls} value={form.contact_name || ''} onChange={(e) => set('contact_name', e.target.value)} placeholder="e.g. John Smith" />
        </div>
        <div>
          <label className={labelCls}>Phone</label>
          <input className={inputCls} value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} placeholder="e.g. (800) 555-0100" />
        </div>
        <div>
          <label className={labelCls}>Website</label>
          <input className={inputCls} value={form.website || ''} onChange={(e) => set('website', e.target.value)} placeholder="e.g. https://sherwin-williams.com" />
        </div>
        <div>
          <label className={labelCls}>Order Email</label>
          <input className={inputCls} type="email" value={form.order_email || ''} onChange={(e) => set('order_email', e.target.value)} placeholder="e.g. orders@supplier.com" />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Lead Time</label>
          <input className={inputCls} value={form.lead_time || ''} onChange={(e) => set('lead_time', e.target.value)} placeholder="e.g. 3–5 business days" />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Notes</label>
          <input className={inputCls} value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} placeholder="Optional internal notes" />
        </div>
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

// ── CategoryRow ──────────────────────────────────────────────────────────────
function CategoryRow({ cat, onRename, onDelete, deleteError, onClearError }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(cat.name);
  const [saving, setSaving] = useState(false);
  const isProtected = cat.name === 'Uncategorized';
  const hasError = deleteError?.catId === cat.id;

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === cat.name) { setEditing(false); setName(cat.name); return; }
    setSaving(true);
    try {
      await onRename(cat.id, trimmed);
      setEditing(false);
    } catch (err) {
      alert(err.message || 'Failed to rename category');
      setName(cat.name);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl">
        {editing ? (
          <>
            <input
              className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setEditing(false); setName(cat.name); } }}
              autoFocus
            />
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="text-xs text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => { setEditing(false); setName(cat.name); }}
              className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <span className="flex-1 text-sm font-medium text-gray-800">{cat.name}</span>
            {isProtected && (
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Default</span>
            )}
            {!isProtected && (
              <>
                <button
                  onClick={() => { setEditing(true); if (hasError) onClearError(); }}
                  className="text-xs text-blue-600 border border-blue-200 px-2 py-1 rounded-lg hover:bg-blue-50"
                >
                  Rename
                </button>
                <button
                  onClick={() => onDelete(cat)}
                  className="text-xs text-red-500 border border-red-200 px-2 py-1 rounded-lg hover:bg-red-50"
                >
                  Delete
                </button>
              </>
            )}
          </>
        )}
      </div>
      {hasError && (
        <div className="mt-1 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <p className="font-semibold mb-1">
            Cannot delete — {deleteError.products.length} product{deleteError.products.length !== 1 ? 's' : ''} assigned to this category:
          </p>
          <ul className="list-disc list-inside space-y-0.5 text-xs mb-2">
            {deleteError.products.map((p) => <li key={p}>{p}</li>)}
          </ul>
          <p className="text-xs text-red-500 mb-2">Reassign these products to a different category before deleting.</p>
          <button onClick={onClearError} className="text-xs text-red-600 underline hover:text-red-800">Dismiss</button>
        </div>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function BidderSuppliers() {
  // ── Suppliers state ──
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingSupplier, setAddingSupplier] = useState(false);
  const [editSupplierId, setEditSupplierId] = useState(null);
  const [savingSupplier, setSavingSupplier] = useState(false);

  // ── Categories state ──
  const [categories, setCategories] = useState([]);
  const [catLoading, setCatLoading] = useState(true);
  const [addingCat, setAddingCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [savingCat, setSavingCat] = useState(false);
  const [deleteError, setDeleteError] = useState(null); // { catId, products }

  useEffect(() => { loadSuppliers(); loadCategories(); }, []);

  async function loadSuppliers() {
    setLoading(true);
    try {
      setSuppliers(await BidderAPI.getGlobalSuppliers());
    } catch {
      console.error('Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories() {
    setCatLoading(true);
    try {
      setCategories(await BidderAPI.getGlobalCategories());
    } catch {
      console.error('Failed to load categories');
    } finally {
      setCatLoading(false);
    }
  }

  // ── Supplier handlers ──
  async function handleAddSupplier(form) {
    setSavingSupplier(true);
    try {
      await BidderAPI.createGlobalSupplier(form);
      setAddingSupplier(false);
      await loadSuppliers();
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
      await loadSuppliers();
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
      await loadSuppliers();
    } catch {
      alert('Failed to delete supplier');
    }
  }

  // ── Category handlers ──
  async function handleAddCategory() {
    const name = newCatName.trim();
    if (!name) return;
    setSavingCat(true);
    try {
      await BidderAPI.createGlobalCategory({ name });
      setNewCatName('');
      setAddingCat(false);
      await loadCategories();
    } catch (err) {
      alert(err.message || 'Failed to create category');
    } finally {
      setSavingCat(false);
    }
  }

  async function handleRenameCategory(id, name) {
    await BidderAPI.updateGlobalCategory(id, { name });
    await loadCategories();
  }

  async function handleDeleteCategory(cat) {
    setDeleteError(null);
    try {
      await BidderAPI.deleteGlobalCategory(cat.id);
      await loadCategories();
    } catch (err) {
      if (err.products) {
        setDeleteError({ catId: cat.id, products: err.products });
      } else {
        alert(err.message || 'Failed to delete category');
      }
    }
  }

  return (
    <div className="p-6 space-y-8">

      {/* ══ Suppliers section ══════════════════════════════════════════════ */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-gray-800">Suppliers</h3>
            <p className="text-xs text-gray-500 mt-0.5">Global product catalog by supplier</p>
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
                  initial={{
                    name: s.name,
                    notes: s.notes || '',
                    phone: s.phone || '',
                    website: s.website || '',
                    contact_name: s.contact_name || '',
                    lead_time: s.lead_time || '',
                    order_email: s.order_email || '',
                  }}
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
      </section>

      {/* ══ Categories section ═════════════════════════════════════════════ */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-gray-800">Categories</h3>
            <p className="text-xs text-gray-500 mt-0.5">Product categories assigned to global SKUs</p>
          </div>
          {!addingCat && (
            <button
              onClick={() => { setAddingCat(true); setNewCatName(''); }}
              className="px-4 py-2 bg-blue-600 text-white font-semibold text-sm rounded-lg hover:bg-blue-700"
            >
              + Add Category
            </button>
          )}
        </div>

        {catLoading ? (
          <p className="text-sm text-gray-400">Loading categories…</p>
        ) : (
          <div className="space-y-2">
            {categories.map((cat) => (
              <CategoryRow
                key={cat.id}
                cat={cat}
                onRename={handleRenameCategory}
                onDelete={handleDeleteCategory}
                deleteError={deleteError}
                onClearError={() => setDeleteError(null)}
              />
            ))}
          </div>
        )}

        {addingCat && (
          <div className="mt-3 flex items-center gap-2">
            <input
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="Category name, e.g. Epoxy"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategory(); if (e.key === 'Escape') setAddingCat(false); }}
              autoFocus
            />
            <button
              onClick={handleAddCategory}
              disabled={savingCat || !newCatName.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {savingCat ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => setAddingCat(false)}
              className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        )}
      </section>

    </div>
  );
}
