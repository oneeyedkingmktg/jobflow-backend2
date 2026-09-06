// ============================================================================
// File: src/leadModalParts/BidMaterialsModal.jsx
// Materials / Order List modal for a bid — computes kit quantities from bid
// items and systems, allows editing Order Qty and Unit Cost per item.
// ============================================================================

import React, { useEffect, useState } from 'react';
import { BidderAPI } from '../api';

function fmt(n) {
  const v = parseFloat(n) || 0;
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtQty(n) {
  if (n == null) return '—';
  return parseFloat(n).toFixed(2);
}

const noSpin = '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

export default function BidMaterialsModal({ proposalId, onClose }) {
  const [loading,  setLoading]  = useState(true);
  const [materials, setMaterials] = useState([]);
  const [saving,   setSaving]   = useState(false);
  const [saveMsg,  setSaveMsg]  = useState('');

  useEffect(() => { load(); }, [proposalId]);

  async function load() {
    setLoading(true);
    setSaveMsg('');
    try {
      const data = await BidderAPI.getMaterials(proposalId);
      setMaterials(data.materials || []);
    } catch (e) {
      console.error('Failed to load materials', e);
    } finally {
      setLoading(false);
    }
  }

  function updateRow(libItemId, field, rawValue) {
    setMaterials(prev => prev.map(m => {
      if (m.library_item_id !== libItemId) return m;
      const next = { ...m, [field]: rawValue };
      if (field === 'order_qty') next.has_override_qty = true;
      if (field === 'unit_cost') next.has_override_cost = true;
      return next;
    }));
  }

  async function saveOverride(libItemId) {
    const m = materials.find(x => x.library_item_id === libItemId);
    if (!m) return;
    setSaving(true);
    setSaveMsg('');
    try {
      await BidderAPI.saveMaterials(proposalId, [
        { library_item_id: libItemId, order_qty: m.order_qty, unit_cost: m.unit_cost },
      ]);
      setSaveMsg('Saved');
      setTimeout(() => setSaveMsg(''), 2000);
    } catch (e) {
      setSaveMsg('Save failed');
    } finally {
      setSaving(false);
    }
  }

  const total = materials.reduce((sum, m) => {
    return sum + (parseFloat(m.order_qty) || 0) * (parseFloat(m.unit_cost) || 0);
  }, 0);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1300] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-bold text-gray-800 text-lg">Materials / Order List</h2>
            <p className="text-xs text-gray-500 mt-0.5">Calculated from bid items. Edit Order Qty or Unit Cost to override defaults.</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={load}
              disabled={loading}
              className="text-xs text-blue-600 hover:underline disabled:opacity-40"
            >
              Refresh
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto overflow-x-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <p className="text-gray-500 text-sm">Calculating materials…</p>
            </div>
          ) : materials.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-center">
              <p className="text-gray-600 font-medium">No materials found</p>
              <p className="text-xs text-gray-400 max-w-sm">
                Add items with a Kit Price and Coverage (sq ft / unit) to the Bidder library,
                then add them to this bid. Charge-only items and freeform rows are excluded.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="text-left py-2 pr-4">Product</th>
                  <th className="text-right py-2 pr-4 whitespace-nowrap">Job Area</th>
                  <th className="text-right py-2 pr-4 whitespace-nowrap">Coverage</th>
                  <th className="text-right py-2 pr-4 whitespace-nowrap">Calc. Qty</th>
                  <th className="text-right py-2 pr-4 whitespace-nowrap">Order Qty</th>
                  <th className="text-right py-2 pr-4 whitespace-nowrap">Unit Cost</th>
                  <th className="text-right py-2 whitespace-nowrap">Ext. Cost</th>
                </tr>
              </thead>
              <tbody>
                {materials.map(m => {
                  const oq = parseFloat(m.order_qty) || 0;
                  const uc = parseFloat(m.unit_cost) || 0;
                  return (
                    <tr key={m.library_item_id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2.5 pr-4 font-medium text-gray-800">{m.name}</td>
                      <td className="py-2.5 pr-4 text-right text-gray-600 tabular-nums">
                        {m.sqft_per_kit
                          ? `${(parseFloat(m.total_area) || 0).toLocaleString()} sf`
                          : '—'}
                      </td>
                      <td className="py-2.5 pr-4 text-right text-gray-500 text-xs tabular-nums whitespace-nowrap">
                        {m.sqft_per_kit
                          ? `${parseFloat(m.sqft_per_kit).toLocaleString()} sf/unit`
                          : '—'}
                      </td>
                      <td className="py-2.5 pr-4 text-right text-gray-400 tabular-nums">
                        {fmtQty(m.calculated_qty)}
                      </td>
                      <td className="py-2.5 pr-4 text-right">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={m.order_qty ?? ''}
                          onChange={e => updateRow(m.library_item_id, 'order_qty', e.target.value)}
                          onBlur={() => saveOverride(m.library_item_id)}
                          className={`w-20 text-right px-2 py-1 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 ${noSpin} ${m.has_override_qty ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300'}`}
                        />
                      </td>
                      <td className="py-2.5 pr-4 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={m.unit_cost ?? ''}
                          onChange={e => updateRow(m.library_item_id, 'unit_cost', e.target.value)}
                          onBlur={() => saveOverride(m.library_item_id)}
                          className={`w-24 text-right px-2 py-1 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 ${noSpin} ${m.has_override_cost ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300'}`}
                        />
                      </td>
                      <td className="py-2.5 text-right font-semibold text-gray-800 tabular-nums">
                        {fmt(oq * uc)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 shrink-0 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Projected Material Cost</p>
              <p className="text-2xl font-bold text-gray-900">{fmt(total)}</p>
            </div>
            {saveMsg && (
              <span className={`text-sm font-medium ${saveMsg.includes('fail') || saveMsg.includes('Failed') ? 'text-red-500' : 'text-green-600'}`}>
                {saveMsg}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            {materials.length > 0 && (
              <p className="text-xs text-gray-400 hidden sm:block">
                Highlighted cells have been overridden from defaults.
              </p>
            )}
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-gray-800 text-white font-semibold rounded-xl hover:bg-gray-900 text-sm"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
