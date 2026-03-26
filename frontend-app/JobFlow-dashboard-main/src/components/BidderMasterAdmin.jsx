// ============================================================================
// File: src/components/BidderMasterAdmin.jsx
// Master-only: PDF proposal design library (add / edit / delete / toggle)
// ============================================================================

import React, { useEffect, useState } from 'react';
import { BidderAPI } from '../api';

export default function BidderMasterAdmin({ onBack }) {
  const [designs, setDesigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState(null);   // null = list view, 'new' = new form, number = edit
  const [form, setForm] = useState({ name: '', description: '', template_content: '', is_active: true });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      // Fetch all designs including inactive (master view — backend returns all active;
      // for inactive we rely on local toggle since GET only returns is_active=true.
      // We'll store all returned and manage toggles locally after save.)
      const data = await BidderAPI.getProposalDesigns();
      setDesigns(data);
    } catch (e) {
      console.error('Failed to load designs', e);
    } finally {
      setLoading(false);
    }
  }

  function startNew() {
    setForm({ name: '', description: '', template_content: '', is_active: true });
    setEditId('new');
    setMsg('');
  }

  function startEdit(design) {
    setForm({
      name: design.name,
      description: design.description || '',
      template_content: design.template_content || '',
      is_active: design.is_active,
    });
    setEditId(design.id);
    setMsg('');
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    setMsg('');
    try {
      if (editId === 'new') {
        await BidderAPI.createProposalDesign(form);
      } else {
        await BidderAPI.updateProposalDesign(editId, form);
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

  async function handleToggleActive(design) {
    try {
      await BidderAPI.updateProposalDesign(design.id, { ...design, is_active: !design.is_active });
      await load();
    } catch (e) {
      alert('Failed to update design');
    }
  }

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300';
  const labelCls = 'block text-xs font-semibold text-gray-500 uppercase mb-1';

  // ── Form (new or edit) ────────────────────────────────────────────────────
  if (editId !== null) {
    return (
      <div className="p-6 space-y-5">
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

        <div>
          <label className={labelCls}>Template Content</label>
          <p className="text-xs text-gray-400 mb-1">
            HTML template or design notes. Used in Phase 7 (web proposal page). Leave blank for standard invoice layout.
          </p>
          <textarea
            className={`${inputCls} h-48 resize-y font-mono text-xs`}
            value={form.template_content}
            onChange={(e) => setForm((p) => ({ ...p, template_content: e.target.value }))}
            placeholder="<!-- HTML template goes here -->"
          />
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
            className="w-4 h-4"
          />
          <span className="text-sm text-gray-700">Active (visible to companies)</span>
        </label>

        {msg && <p className="text-sm text-red-500">{msg}</p>}

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving || !form.name.trim()}
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
          <p className="text-sm text-gray-400">Companies will use the Standard Invoice layout until a design is added.</p>
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
            <div
              key={d.id}
              className="border border-gray-200 rounded-xl px-5 py-4 flex items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-800">{d.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${d.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {d.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {d.description && (
                  <p className="text-sm text-gray-500 mt-0.5 truncate">{d.description}</p>
                )}
                {d.template_content ? (
                  <p className="text-xs text-blue-500 mt-0.5">Has template content</p>
                ) : (
                  <p className="text-xs text-gray-400 mt-0.5">No template — uses standard invoice</p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleToggleActive(d)}
                  className="text-xs text-gray-500 hover:text-gray-800 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50"
                >
                  {d.is_active ? 'Deactivate' : 'Activate'}
                </button>
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
