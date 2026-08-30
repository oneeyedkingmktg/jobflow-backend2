// ============================================================================
// File: src/components/BidderMasterAdmin.jsx
// Master-only: PDF proposal design library (add / edit / delete)
// ============================================================================

import React, { useEffect, useState } from 'react';
import { BidderAPI } from '../api';
import { useCompany } from '../CompanyContext';

const EMPTY_FORM = {
  name: '',
  description: '',
  primary_color: '#1c2333',
  accent_color: '#f97316',
  visibility: 'public',
  private_company_id: '',
  template_content: '',
};

export default function BidderMasterAdmin({ onBack, embedded = false }) {
  const { companies } = useCompany();
  const [designs, setDesigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      setDesigns(await BidderAPI.getProposalDesigns());
    } catch (e) {
      console.error('Failed to load designs', e);
    } finally {
      setLoading(false);
    }
  }

  function startNew() {
    setForm(EMPTY_FORM);
    setEditId('new');
    setMsg('');
  }

  function startEdit(d) {
    setForm({
      name: d.name,
      description: d.description || '',
      primary_color: d.primary_color || '#1c2333',
      accent_color: d.accent_color || '#f97316',
      visibility: d.visibility || (d.is_active ? 'public' : 'inactive'),
      private_company_id: d.private_company_id ? String(d.private_company_id) : '',
      template_content: d.template_content || '',
    });
    setEditId(d.id);
    setMsg('');
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    setMsg('');
    try {
      const payload = {
        ...form,
        private_company_id: form.visibility === 'private' && form.private_company_id
          ? parseInt(form.private_company_id, 10)
          : null,
      };
      if (editId === 'new') {
        await BidderAPI.createProposalDesign(payload);
      } else {
        await BidderAPI.updateProposalDesign(editId, payload);
      }
      setEditId(null);
      await load();
    } catch (e) {
      setMsg(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Delete design "${name}"? This cannot be undone.`)) return;
    try {
      await BidderAPI.deleteProposalDesign(id);
      await load();
    } catch (e) {
      alert('Failed to delete design');
    }
  }

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300';
  const labelCls = 'block text-xs font-semibold text-gray-500 uppercase mb-1';

  const visibilityLabel = (d) => {
    if (d.visibility === 'private') return `Private`;
    if (d.visibility === 'inactive' || !d.is_active) return 'Inactive';
    return 'Public';
  };
  const visibilityColor = (d) => {
    if (d.visibility === 'private') return 'bg-yellow-100 text-yellow-700';
    if (d.visibility === 'inactive' || !d.is_active) return 'bg-gray-100 text-gray-500';
    return 'bg-green-100 text-green-700';
  };

  // ── Form (new or edit) ────────────────────────────────────────────────────
  if (editId !== null) {
    return (
      <div className="p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-3">
          <button onClick={() => setEditId(null)} className="text-gray-500 hover:text-gray-800">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h3 className="text-lg font-bold text-gray-900">
            {editId === 'new' ? 'New Proposal Design' : 'Edit Design'}
          </h3>
        </div>

        <div>
          <label className={labelCls}>Design Name *</label>
          <input
            className={inputCls}
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="e.g. Standard Invoice, Premium Proposal"
          />
        </div>

        <div>
          <label className={labelCls}>Description</label>
          <input
            className={inputCls}
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            placeholder="Optional — shown to company admins when selecting a design"
          />
        </div>

        {/* Color Pickers */}
        <div className="flex gap-6">
          <div>
            <label className={labelCls}>Primary Color (header/background)</label>
            <div className="flex items-center gap-3 mt-1">
              <input
                type="color"
                value={form.primary_color}
                onChange={(e) => setForm((p) => ({ ...p, primary_color: e.target.value }))}
                className="w-12 h-10 rounded border border-gray-300 cursor-pointer p-0.5"
              />
              <input
                className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
                value={form.primary_color}
                onChange={(e) => setForm((p) => ({ ...p, primary_color: e.target.value }))}
                maxLength={7}
                placeholder="#1c2333"
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Accent Color (highlights/buttons)</label>
            <div className="flex items-center gap-3 mt-1">
              <input
                type="color"
                value={form.accent_color}
                onChange={(e) => setForm((p) => ({ ...p, accent_color: e.target.value }))}
                className="w-12 h-10 rounded border border-gray-300 cursor-pointer p-0.5"
              />
              <input
                className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
                value={form.accent_color}
                onChange={(e) => setForm((p) => ({ ...p, accent_color: e.target.value }))}
                maxLength={7}
                placeholder="#f97316"
              />
            </div>
          </div>
        </div>

        {/* Preview swatch */}
        <div className="rounded-lg overflow-hidden border border-gray-200 text-sm">
          <div style={{ background: form.primary_color }} className="px-4 py-3">
            <span className="text-white font-bold">Company Name</span>
          </div>
          <div style={{ background: form.accent_color, height: 4 }} />
          <div className="bg-white px-4 py-3 flex items-center justify-between">
            <span className="text-gray-700">Invoice / Proposal Preview</span>
            <span style={{ background: form.accent_color, color: '#fff', borderRadius: 4, padding: '4px 14px', fontSize: 12, fontWeight: 700 }}>
              View Document
            </span>
          </div>
        </div>

        {/* Visibility */}
        <div>
          <label className={labelCls}>Visibility</label>
          <select
            className={inputCls}
            value={form.visibility}
            onChange={(e) => setForm((p) => ({ ...p, visibility: e.target.value, private_company_id: '' }))}
          >
            <option value="inactive">Not Active</option>
            <option value="public">Active — Public (all companies)</option>
            <option value="private">Active — Private (one company only)</option>
          </select>
        </div>

        {form.visibility === 'private' && (
          <div>
            <label className={labelCls}>Private For Company</label>
            <select
              className={inputCls}
              value={form.private_company_id}
              onChange={(e) => setForm((p) => ({ ...p, private_company_id: e.target.value }))}
            >
              <option value="">— Select company —</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name || c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className={labelCls}>Template Content</label>
          <p className="text-xs text-gray-400 mb-1">
            HTML template or design notes. Leave blank for standard invoice layout.
          </p>
          <textarea
            className={`${inputCls} h-48 resize-y font-mono text-xs`}
            value={form.template_content}
            onChange={(e) => setForm((p) => ({ ...p, template_content: e.target.value }))}
            placeholder="<!-- HTML template goes here -->"
          />
        </div>

        {msg && <p className="text-sm text-red-500">{msg}</p>}

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving || !form.name.trim() || (form.visibility === 'private' && !form.private_company_id)}
            className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Design'}
          </button>
          <button
            onClick={() => setEditId(null)}
            className="px-4 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        {!embedded && (
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-gray-500 hover:text-gray-800">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Bidder Admin</h2>
              <p className="text-sm text-gray-500">Proposal design library — master account only</p>
            </div>
          </div>
        )}
        <button
          onClick={startNew}
          className="px-4 py-2 bg-blue-600 text-white font-semibold text-sm rounded-lg hover:bg-blue-700"
        >
          + New Design
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading designs…</p>
      ) : designs.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
          <p className="text-gray-500 mb-3">No proposal designs yet.</p>
          <button
            onClick={startNew}
            className="mt-4 px-5 py-2 bg-blue-600 text-white font-semibold text-sm rounded-lg hover:bg-blue-700"
          >
            Create First Design
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {designs.map((d) => (
            <div key={d.id} className="border border-gray-200 rounded-xl px-5 py-4 flex items-center gap-4">
              {/* Color swatch */}
              <div className="shrink-0 flex flex-col gap-1">
                <div style={{ background: d.primary_color || '#1c2333', width: 28, height: 18, borderRadius: 3 }} title={`Primary: ${d.primary_color || '#1c2333'}`} />
                <div style={{ background: d.accent_color || '#f97316', width: 28, height: 8, borderRadius: 3 }} title={`Accent: ${d.accent_color || '#f97316'}`} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-800">{d.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${visibilityColor(d)}`}>
                    {visibilityLabel(d)}
                    {d.visibility === 'private' && d.private_company_id && (() => {
                      const co = companies.find(c => c.id === d.private_company_id);
                      return co ? ` — ${co.company_name || co.name}` : '';
                    })()}
                  </span>
                </div>
                {d.description && (
                  <p className="text-sm text-gray-500 mt-0.5 truncate">{d.description}</p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => startEdit(d)}
                  className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(d.id, d.name)}
                  className="text-xs text-red-500 hover:text-red-700 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
