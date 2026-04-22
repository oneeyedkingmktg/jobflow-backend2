// ============================================================================
// File: src/leadModalParts/BidderForm.jsx
// Full bid builder — items, discounts, totals, payment, notes
// ============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import { BidderAPI, CompaniesAPI } from '../api';
import { useAuth } from '../AuthContext';
import { printProposal, printPaymentInvoice, printFinalInvoice } from '../utils/printDocument';

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n) {
  const v = parseFloat(n) || 0;
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const inputCls  = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300';
const labelCls  = 'block text-xs font-semibold text-gray-500 uppercase mb-1';
const sectionHd = 'text-sm font-bold text-gray-700 uppercase tracking-wide border-b border-gray-200 pb-2 mb-3';
const noSpin    = '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

const STATUS_OPTIONS = [
  { value: 'pending',   label: 'Pending'   },
  { value: 'accepted',  label: 'Accepted'  },
  { value: 'not_sold',  label: 'Not Sold'  },
  { value: 'completed', label: 'Completed' },
];

// ── Main Component ───────────────────────────────────────────────────────────

export default function BidderForm({ proposalId, lead, onBack, onClose }) {
  const { user } = useAuth();

  // ── Data ──────────────────────────────────────────────────────────────────
  const [proposal,      setProposal]      = useState(null);
  const [library,       setLibrary]       = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [saveMsg,       setSaveMsg]       = useState('');

  // ── Proposal header form ──────────────────────────────────────────────────
  const [hdr, setHdr] = useState({
    bid_name: '', bid_description: '', status: 'pending',
    presented_date: '', accepted_date: '',
    install_crew: '', install_date: '', install_date_tbd: false,
    customer_notes: '', internal_notes: '',
    payment_url: '', include_payment_button: true,
  });

  // ── Items ─────────────────────────────────────────────────────────────────
  const [checkedMap, setCheckedMap]         = useState({}); // library_item_id → proposal_item row
  const [customItems, setCustomItems]       = useState([]);
  const [discounts,   setDiscounts]         = useState([]);
  const [paySchedule, setPaySchedule]       = useState([]);
  const [showItemPicker,   setShowItemPicker]   = useState(false);
  const [showDocsModal,    setShowDocsModal]    = useState(false);
  const [company,          setCompany]          = useState(null);
  const [companySettings,  setCompanySettings]  = useState(null);
  const [emailSending,     setEmailSending]     = useState(false);
  const [emailMsg,         setEmailMsg]         = useState('');
  const [emailModal,       setEmailModal]       = useState({ show: false, addr: '', type: 'proposal' });

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    load();
  }, [proposalId]);

  async function load() {
    setLoading(true);
    try {
      const [p, lib, companyRes, settingsRes] = await Promise.all([
        BidderAPI.getProposal(proposalId),
        BidderAPI.getLibrary(lead.companyId),
        lead.companyId ? CompaniesAPI.get(lead.companyId) : Promise.resolve(null),
        BidderAPI.getCompanySettings(lead.companyId).catch(() => null),
      ]);
      if (companyRes?.company) setCompany(companyRes.company);
      if (settingsRes) setCompanySettings(settingsRes);

      setProposal(p);
      setLibrary(lib);

      // Populate header form
      setHdr({
        bid_name:               p.bid_name          || '',
        bid_description:        p.bid_description   || '',
        status:                 p.status            || 'pending',
        presented_date:         p.presented_date    ? p.presented_date.slice(0,10) : '',
        accepted_date:          p.accepted_date     ? p.accepted_date.slice(0,10)  : '',
        install_crew:           p.install_crew      || '',
        install_date:           p.install_date      ? p.install_date.slice(0,10)   : '',
        install_date_tbd:       p.install_date_tbd  || false,
        customer_notes:         p.customer_notes    || '',
        internal_notes:         p.internal_notes    || '',
        payment_url:            p.payment_url       || '',
        include_payment_button: p.include_payment_button ?? true,
      });

      // Library items (non-freeform only)
      const map = {};
      (p.items || []).filter(item => !item.is_freeform && item.library_item_id).forEach((item) => {
        map[item.library_item_id] = { ...item, _price: item.unit_price, _desc: item.description || '', _qty: item.quantity || 1 };
      });
      setCheckedMap(map);
      setCustomItems((p.customItems || []).map(i => ({ ...i, _desc: i.description, _qty: i.quantity, _price: i.price_each })));
      setDiscounts((p.discounts || []).map(d => ({ ...d, _desc: d.description, _val: d.discount_value, _type: d.discount_type, _date: d.if_accepted_by ? d.if_accepted_by.slice(0,10) : '' })));
      const schedules = p.paymentSchedules || [];
      if (schedules.length === 0) {
        try {
          const ps = await BidderAPI.createPayment({ proposal_id: proposalId, description: 'Down Payment', amount_type: 'percent', amount_value: 50, amount_calculated: 0, sort_order: 0 });
          setPaySchedule([{ ...ps, _desc: ps.description, _val: ps.amount_value, _type: ps.amount_type }]);
        } catch (_) {}
      } else {
        setPaySchedule(schedules.map(ps => ({ ...ps, _desc: ps.description, _val: ps.amount_value, _type: ps.amount_type })));
      }
    } catch (e) {
      console.error('Failed to load proposal', e);
    } finally {
      setLoading(false);
    }
  }

  // ── Calculations ──────────────────────────────────────────────────────────
  const itemsTotal = Object.values(checkedMap).reduce((a, i) => a + (parseFloat(i.line_total) || 0), 0);
  const customTotal = customItems.reduce((a, i) => a + (parseFloat(i.line_total) || 0), 0);
  const preDiscountTotal = itemsTotal + customTotal;

  const discountTotal = discounts.reduce((a, d) => {
    if (d.discount_type === 'dollar') return a + (parseFloat(d.discount_amount) || 0);
    return a + (preDiscountTotal * ((parseFloat(d.discount_value) || 0) / 100));
  }, 0);

  const bidTotal = preDiscountTotal - discountTotal;

  // Payment schedule: recalculate amount_calculated from current bidTotal
  const calcPayAmt = (ps) => ps._type === 'dollar'
    ? parseFloat(ps._val) || 0
    : bidTotal * ((parseFloat(ps._val) || 0) / 100);

  const payTotal   = paySchedule.reduce((a, ps) => a + calcPayAmt(ps), 0);
  const balanceDue = bidTotal - payTotal;

  // ── Unified sort order across all item types ──────────────────────────
  function nextSortOrder() {
    const orders = [
      ...Object.values(checkedMap).map(i => i.sort_order ?? 0),
      ...customItems.map(i => i.sort_order ?? 0),
    ];
    return orders.length > 0 ? Math.max(...orders) + 1 : 0;
  }

  // ── Library item — add via picker ────────────────────────────────────────
  async function handlePickItem(e) {
    const val = e.target.value;
    if (!val) return;
    if (val === '__subtotal__') { e.target.value = ''; handleAddSubtotal(); return; }
    const [catId, itemId] = val.split('::').map(Number);
    const cat = library.find(c => c.id === catId);
    const libItem = cat?.items.find(i => i.id === itemId);
    if (!libItem || !cat) return;
    setShowItemPicker(false);
    try {
      const lineTotal = parseFloat(libItem.default_unit_price) || 0;
      // If this library item is already on the bid, add a second copy as a freeform line
      if (checkedMap[libItem.id]) {
        const newItem = await BidderAPI.createCustomItem({
          proposal_id: proposalId,
          description: libItem.name,
          quantity:    1,
          price_each:  parseFloat(libItem.default_unit_price) || 0,
          line_total:  lineTotal,
          sort_order:  nextSortOrder(),
        });
        setCustomItems(prev => [...prev, { ...newItem, _desc: libItem.name, _qty: 1, _price: parseFloat(libItem.default_unit_price) || 0 }]);
        return;
      }
      const newItem = await BidderAPI.createItem({
        proposal_id:     proposalId,
        library_item_id: libItem.id,
        category_name:   cat.name,
        name:            libItem.name,
        description:     libItem.default_description || '',
        unit_price:      libItem.default_unit_price,
        unit_label:      libItem.default_unit_label,
        quantity:        1,
        line_total:      lineTotal,
        is_included:     libItem.is_included,
        is_optional:     false,
        breakout_price:  false,
        sort_order:      nextSortOrder(),
      });
      setCheckedMap(prev => ({ ...prev, [libItem.id]: { ...newItem, _price: newItem.unit_price, _desc: newItem.description || '', _qty: 1 } }));
    } catch (e) { alert('Failed to add item'); }
  }

  async function handleDeleteLibItem(libItemId) {
    const item = checkedMap[libItemId];
    if (!item) return;
    try {
      await BidderAPI.deleteItem(item.id);
      setCheckedMap(prev => { const n = { ...prev }; delete n[libItemId]; return n; });
    } catch (e) { alert('Failed to remove item'); }
  }

  async function handleItemBreakout(libItemId, breakout_price) {
    const item = checkedMap[libItemId];
    if (!item) return;
    try {
      await BidderAPI.updateItem(item.id, { ...item, breakout_price });
      setCheckedMap(prev => ({ ...prev, [libItemId]: { ...item, breakout_price } }));
    } catch (e) { console.error('Failed to update breakout', e); }
  }

  // Update a checked library item's price
  async function handleItemPriceBlur(libItemId) {
    const item = checkedMap[libItemId];
    if (!item) return;
    const unit_price = parseFloat(item._price) || 0;
    const quantity = parseFloat(item._qty) || 1;
    const line_total = unit_price * quantity;
    try {
      await BidderAPI.updateItem(item.id, { ...item, unit_price, quantity, line_total });
      setCheckedMap(prev => ({ ...prev, [libItemId]: { ...item, unit_price, quantity, line_total } }));
    } catch (e) { console.error('Failed to update item price', e); }
  }

  async function handleItemQtyBlur(libItemId) {
    const item = checkedMap[libItemId];
    if (!item) return;
    const unit_price = parseFloat(item.unit_price) || 0;
    const quantity = parseFloat(item._qty) || 1;
    const line_total = unit_price * quantity;
    try {
      await BidderAPI.updateItem(item.id, { ...item, quantity, line_total });
      setCheckedMap(prev => ({ ...prev, [libItemId]: { ...item, quantity, line_total } }));
    } catch (e) { console.error('Failed to update item qty', e); }
  }

  async function handleItemDescBlur(libItemId) {
    const item = checkedMap[libItemId];
    if (!item) return;
    try {
      await BidderAPI.updateItem(item.id, { ...item, description: item._desc });
      setCheckedMap(prev => ({ ...prev, [libItemId]: { ...item, description: item._desc } }));
    } catch (e) { console.error('Failed to update item desc', e); }
  }

  // ── Custom items ──────────────────────────────────────────────────────────
  async function handleAddCustomItem() {
    try {
      const newItem = await BidderAPI.createCustomItem({ proposal_id: proposalId, description: 'Item', quantity: 1, price_each: 0, line_total: 0, sort_order: nextSortOrder() });
      setCustomItems(prev => [...prev, { ...newItem, _desc: newItem.description, _qty: 1, _price: 0 }]);
    } catch (e) { alert('Failed to add item'); }
  }

  async function handleAddSubtotal() {
    setShowItemPicker(false);
    try {
      const newItem = await BidderAPI.createCustomItem({ proposal_id: proposalId, description: 'Subtotal', quantity: 1, price_each: 0, line_total: 0, is_subtotal: true, sort_order: nextSortOrder() });
      setCustomItems(prev => [...prev, { ...newItem, is_subtotal: true, _desc: 'Subtotal', _qty: 1, _price: 0 }]);
    } catch (e) { alert('Failed to add subtotal'); }
  }

  async function handleCustomItemBlur(idx) {
    const item = customItems[idx];
    const quantity   = parseFloat(item._qty)   || 1;
    const price_each = parseFloat(item._price) || 0;
    const line_total = quantity * price_each;
    try {
      await BidderAPI.updateCustomItem(item.id, { description: item._desc, quantity, price_each, line_total, sort_order: item.sort_order });
      setCustomItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity, price_each, line_total, description: item._desc } : it));
    } catch (e) { console.error('Custom item save error', e); }
  }

  async function handleDeleteCustomItem(idx) {
    const item = customItems[idx];
    try {
      await BidderAPI.deleteCustomItem(item.id);
      setCustomItems(prev => prev.filter((_, i) => i !== idx));
    } catch (e) { alert('Failed to delete item'); }
  }

  // ── Discounts ─────────────────────────────────────────────────────────────
  async function handleAddDiscount() {
    try {
      const d = await BidderAPI.createDiscount({ proposal_id: proposalId, description: 'Discount', discount_type: 'dollar', discount_value: 0, discount_amount: 0, sort_order: discounts.length });
      setDiscounts(prev => [...prev, { ...d, _desc: d.description, _val: 0, _type: 'dollar', _date: '' }]);
    } catch (e) { alert('Failed to add discount'); }
  }

  async function handleDiscountBlur(idx) {
    const d = discounts[idx];
    const discount_value  = parseFloat(d._val) || 0;
    const discount_amount = d._type === 'dollar' ? discount_value : preDiscountTotal * (discount_value / 100);
    try {
      await BidderAPI.updateDiscount(d.id, { description: d._desc, discount_type: d._type, discount_value, discount_amount, if_accepted_by: d._date || null, sort_order: d.sort_order });
      setDiscounts(prev => prev.map((it, i) => i === idx ? { ...it, discount_type: d._type, discount_value, discount_amount, description: d._desc, if_accepted_by: d._date || null } : it));
    } catch (e) { console.error('Discount save error', e); }
  }

  async function handleDeleteDiscount(idx) {
    const d = discounts[idx];
    try {
      await BidderAPI.deleteDiscount(d.id);
      setDiscounts(prev => prev.filter((_, i) => i !== idx));
    } catch (e) { alert('Failed to delete discount'); }
  }

  // ── Payment schedule ──────────────────────────────────────────────────────
  async function handleAddPayment() {
    try {
      const ps = await BidderAPI.createPayment({ proposal_id: proposalId, description: 'Down Payment', amount_type: 'percent', amount_value: 50, amount_calculated: bidTotal * 0.5, sort_order: paySchedule.length });
      setPaySchedule(prev => [...prev, { ...ps, _desc: ps.description, _val: ps.amount_value, _type: ps.amount_type }]);
    } catch (e) { alert('Failed to add payment'); }
  }

  async function handlePaymentBlur(idx) {
    const ps = paySchedule[idx];
    const amount_value = parseFloat(ps._val) || 0;
    const amount_calculated = ps._type === 'dollar' ? amount_value : bidTotal * (amount_value / 100);
    try {
      await BidderAPI.updatePayment(ps.id, { description: ps._desc, amount_type: ps._type, amount_value, amount_calculated, sort_order: ps.sort_order });
      setPaySchedule(prev => prev.map((it, i) => i === idx ? { ...it, amount_type: ps._type, amount_value, amount_calculated, description: ps._desc } : it));
    } catch (e) { console.error('Payment save error', e); }
  }

  async function handleDeletePayment(idx) {
    const ps = paySchedule[idx];
    try {
      await BidderAPI.deletePayment(ps.id);
      setPaySchedule(prev => prev.filter((_, i) => i !== idx));
    } catch (e) { alert('Failed to delete payment'); }
  }

  // ── Send proposal email ───────────────────────────────────────────────
  function openEmailModal(type) {
    setEmailMsg('');
    setEmailModal({ show: true, addr: lead.email || '', type });
  }

  async function handleSendEmail() {
    const { addr, type } = emailModal;
    if (!addr.trim()) { setEmailMsg('Please enter an email address'); return; }
    setEmailModal(prev => ({ ...prev, show: false }));
    setEmailSending(true);
    setEmailMsg('');
    try {
      const result = await BidderAPI.sendProposalEmail(proposalId, addr.trim(), type);
      setEmailMsg(`Sent to ${result.sentTo}`);
    } catch (e) {
      setEmailMsg(e.message || 'Failed to send');
    } finally {
      setEmailSending(false);
    }
  }

  // ── Save proposal header ──────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    setSaveMsg('');
    try {
      await BidderAPI.updateProposal(proposalId, {
        ...hdr,
        bid_total:    bidTotal,
        balance_due:  balanceDue,
        salesman:     proposal?.salesman || user?.email || '',
      });
      setSaveMsg('Saved');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (e) {
      setSaveMsg('Failed to save');
    } finally {
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <p className="text-gray-500">Loading bid…</p>
      </div>
    );
  }

  return (
    <>
      {/* Header bar */}
      <div className="bg-blue-600 text-white px-5 py-4 rounded-t-2xl flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-blue-200 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="font-bold text-lg leading-tight">{hdr.bid_name || 'New Bid'}</h2>
            <p className="text-blue-200 text-xs">{lead.name || lead.fullName}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-blue-200 hover:text-white">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 py-5 space-y-6">

        {/* ── BID INFO ─────────────────────────────────────────────────── */}
        <section>
          <p className={sectionHd}>Bid Info</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>Bid Name *</label>
              <input className={inputCls} value={hdr.bid_name} onChange={e => setHdr(p => ({ ...p, bid_name: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Description</label>
              <input className={inputCls} value={hdr.bid_description} onChange={e => setHdr(p => ({ ...p, bid_description: e.target.value }))} placeholder="Short subtitle shown in bid list" />
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select className={inputCls} value={hdr.status} onChange={e => setHdr(p => ({ ...p, status: e.target.value }))}>
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Presented Date</label>
              <input className={inputCls} type="date" value={hdr.presented_date} onChange={e => setHdr(p => ({ ...p, presented_date: e.target.value }))} />
            </div>
            {hdr.status === 'accepted' && (
              <div>
                <label className={labelCls}>Accepted Date</label>
                <input className={inputCls} type="date" value={hdr.accepted_date} onChange={e => setHdr(p => ({ ...p, accepted_date: e.target.value }))} />
              </div>
            )}
            <div>
              <label className={labelCls}>Install Crew</label>
              <input className={inputCls} value={hdr.install_crew} onChange={e => setHdr(p => ({ ...p, install_crew: e.target.value }))} placeholder="Optional" />
            </div>
            <div>
              <label className={labelCls}>Install Date</label>
              <div className="flex items-center gap-2">
                <input className={inputCls} type="date" value={hdr.install_date} disabled={hdr.install_date_tbd} onChange={e => setHdr(p => ({ ...p, install_date: e.target.value }))} />
                <label className="flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap cursor-pointer">
                  <input type="checkbox" checked={hdr.install_date_tbd} onChange={e => setHdr(p => ({ ...p, install_date_tbd: e.target.checked, install_date: e.target.checked ? '' : p.install_date }))} />
                  TBD
                </label>
              </div>
            </div>
          </div>
        </section>

        {/* ── ITEMS (unified: library + custom + subtotals) ──────────────── */}
        <section>
          <p className={sectionHd}>Items</p>

          {/* Unified sorted list */}
          {(() => {
            const libEntries = Object.entries(checkedMap).map(([libItemId, pi]) => ({ ...pi, _type: 'library', _libItemId: libItemId }));
            const allItems = [...libEntries, ...customItems].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

            // Running subtotal calculation helper
            const runningTotal = (upToSortOrder) => {
              const above = [...libEntries, ...customItems.filter(i => !i.is_subtotal)]
                .filter(i => (i.sort_order ?? 0) < upToSortOrder);
              return above.reduce((a, i) => a + (parseFloat(i.line_total) || 0), 0);
            };

            return (
              <div className="space-y-2">
                {allItems.map((item) => {
                  // ── Subtotal row ──────────────────────────────────────────
                  if (item.is_subtotal) {
                    const idx = customItems.findIndex(i => i.id === item.id);
                    const total = runningTotal(item.sort_order ?? 0);
                    return (
                      <div key={`sub-${item.id}`} className="flex items-center gap-2 border-t-2 border-gray-300 pt-2">
                        <span className="flex-1 text-xs font-bold text-gray-500 uppercase tracking-wide">Subtotal</span>
                        <span className="text-sm font-bold text-gray-800">{fmt(total)}</span>
                        <button onClick={() => handleDeleteCustomItem(idx)} className="text-red-300 hover:text-red-500 text-lg leading-none">×</button>
                      </div>
                    );
                  }

                  // ── Library item ──────────────────────────────────────────
                  if (item._type === 'library') {
                    const libItemId = item._libItemId;
                    const pi = checkedMap[libItemId];
                    return (
                      <div key={`lib-${libItemId}`} className="border border-blue-200 rounded-lg bg-blue-50 px-3 py-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-gray-800">{pi.name}</span>
                          <button onClick={() => handleDeleteLibItem(libItemId)} className="text-red-400 hover:text-red-600 text-xl leading-none ml-2">×</button>
                        </div>
                        <div className="flex items-center gap-2">
                          <input className={`w-14 px-2 py-1 border border-blue-300 rounded text-sm text-right ${noSpin}`}
                            type="number" step="1" min="1" value={Math.round(pi._qty)}
                            onChange={e => setCheckedMap(prev => ({ ...prev, [libItemId]: { ...pi, _qty: e.target.value } }))}
                            onBlur={() => handleItemQtyBlur(libItemId)} />
                          <span className="text-gray-400 text-xs">× $</span>
                          <input className={`w-24 px-2 py-1 border border-blue-300 rounded text-sm text-right ${noSpin}`}
                            type="number" step="0.01" value={pi._price || ''}
                            onChange={e => setCheckedMap(prev => ({ ...prev, [libItemId]: { ...pi, _price: e.target.value } }))}
                            onBlur={() => handleItemPriceBlur(libItemId)} />
                          {pi.unit_label && <span className="text-gray-400 text-xs">{pi.unit_label}</span>}
                          <span className="ml-auto text-sm font-semibold text-gray-700">{fmt(pi.line_total)}</span>
                        </div>
                        <label className="mt-2 flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={!!pi.breakout_price}
                            onChange={e => handleItemBreakout(String(libItemId), e.target.checked)}
                            className="accent-blue-600 w-4 h-4" />
                          <span className="text-xs text-gray-500">Breakout pricing on proposal</span>
                        </label>
                        <input className="mt-1 w-full px-2 py-1 border border-gray-200 rounded text-xs text-gray-600 bg-white"
                          placeholder="Description (optional)" value={pi._desc}
                          onChange={e => setCheckedMap(prev => ({ ...prev, [libItemId]: { ...pi, _desc: e.target.value } }))}
                          onBlur={() => handleItemDescBlur(libItemId)} />
                      </div>
                    );
                  }

                  // ── Custom line item ──────────────────────────────────────
                  const idx = customItems.findIndex(i => i.id === item.id);
                  return (
                    <div key={`ci-${item.id}`} className="border border-gray-200 rounded-lg bg-white px-3 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <input className="flex-1 px-2 py-1 border rounded text-sm font-medium" value={item._desc} placeholder="Description"
                          onChange={e => setCustomItems(prev => prev.map((it, i) => i === idx ? { ...it, _desc: e.target.value } : it))}
                          onBlur={() => handleCustomItemBlur(idx)} />
                        <button onClick={() => handleDeleteCustomItem(idx)} className="text-red-400 hover:text-red-600 text-xl leading-none ml-2">×</button>
                      </div>
                      <div className="flex items-center gap-2">
                        <input className={`w-14 px-2 py-1 border rounded text-sm text-right ${noSpin}`} type="number" step="1"
                          value={Math.round(item._qty)}
                          onChange={e => setCustomItems(prev => prev.map((it, i) => i === idx ? { ...it, _qty: e.target.value } : it))}
                          onBlur={() => handleCustomItemBlur(idx)} />
                        <span className="text-gray-400 text-xs">× $</span>
                        <input className={`w-24 px-2 py-1 border rounded text-sm text-right ${noSpin}`} type="number" step="0.01"
                          value={item._price || ''}
                          onChange={e => setCustomItems(prev => prev.map((it, i) => i === idx ? { ...it, _price: e.target.value } : it))}
                          onBlur={() => handleCustomItemBlur(idx)} />
                        <span className="ml-auto text-sm font-semibold text-gray-700">{fmt(item.line_total)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Picker */}
          {library.length === 0 ? (
            <p className="text-sm text-gray-400 mt-2">No items in library. Add items in Company Settings → Bidder.</p>
          ) : showItemPicker ? (
            <div className="mt-2 flex items-center gap-2">
              <select className={`flex-1 ${inputCls}`} defaultValue="" onChange={handlePickItem} autoFocus>
                <option value="" disabled>— Select item —</option>
                <option value="__subtotal__">── Insert Subtotal Line ──</option>
                {library.map(cat => (
                  <optgroup key={cat.id} label={cat.name}>
                    {(cat.items || []).filter(i => i.is_active !== false).map(i => (
                      <option key={i.id} value={`${cat.id}::${i.id}`}>{i.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <button onClick={() => setShowItemPicker(false)} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
            </div>
          ) : (
            <div className="mt-3 flex gap-3">
              <button onClick={() => setShowItemPicker(true)} className="text-sm text-blue-600 hover:underline">+ Add Item</button>
              <button onClick={handleAddCustomItem} className="text-sm text-blue-600 hover:underline">+ Custom Line</button>
            </div>
          )}
        </section>

        {/* ── DISCOUNTS ────────────────────────────────────────────────── */}
        <section>
          <p className={sectionHd}>Discounts</p>
          <div className="space-y-2">
            {discounts.map((d, idx) => (
              <div key={d.id} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-white">
                <div className="flex items-center gap-2">
                  <input className={`${inputCls} flex-1`} value={d._desc} placeholder="Discount name"
                    onChange={e => setDiscounts(prev => prev.map((it, i) => i === idx ? { ...it, _desc: e.target.value } : it))}
                    onBlur={() => handleDiscountBlur(idx)} />
                  <button onClick={() => handleDeleteDiscount(idx)} className="text-red-400 hover:text-red-600 text-xl leading-none">×</button>
                </div>
                <div className="flex items-center gap-2">
                  <select className={`${inputCls} w-16`} value={d._type}
                    onChange={e => setDiscounts(prev => prev.map((it, i) => i === idx ? { ...it, _type: e.target.value } : it))}
                    onBlur={() => handleDiscountBlur(idx)}>
                    <option value="dollar">$</option>
                    <option value="percent">%</option>
                  </select>
                  <input className={`w-24 px-2 py-2 border border-gray-300 rounded-lg text-sm text-right ${noSpin}`} type="number" step="0.01"
                    value={d._val || ''}
                    onChange={e => setDiscounts(prev => prev.map((it, i) => i === idx ? { ...it, _val: e.target.value } : it))}
                    onBlur={() => handleDiscountBlur(idx)} />
                  <span className="ml-auto text-sm font-semibold text-red-600">
                    -{fmt(d._type === 'dollar' ? (parseFloat(d._val) || 0) : preDiscountTotal * ((parseFloat(d._val) || 0) / 100))}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500 whitespace-nowrap">If accepted by:</label>
                  <input className="px-2 py-1 border border-gray-300 rounded-lg text-sm w-36" type="date" value={d._date}
                    onChange={e => setDiscounts(prev => prev.map((it, i) => i === idx ? { ...it, _date: e.target.value } : it))}
                    onBlur={() => handleDiscountBlur(idx)} />
                </div>
              </div>
            ))}
            <button onClick={handleAddDiscount} className="text-sm text-blue-600 hover:underline">+ Add Discount</button>
          </div>
        </section>

        {/* ── TOTALS ───────────────────────────────────────────────────── */}
        <section>
          <div className="bg-gray-50 rounded-xl px-4 py-4 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Items Total</span><span className="font-semibold">{fmt(itemsTotal)}</span>
            </div>
            {customTotal > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Custom Items</span><span className="font-semibold">{fmt(customTotal)}</span>
              </div>
            )}
            {discountTotal > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Discounts</span><span className="font-semibold">-{fmt(discountTotal)}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-900 font-bold text-base border-t border-gray-200 pt-2 mt-1">
              <span>Bid Total</span><span>{fmt(bidTotal)}</span>
            </div>
          </div>
        </section>

        {/* ── PAYMENT SCHEDULE ─────────────────────────────────────────── */}
        <section>
          <p className={sectionHd}>Payment Schedule</p>
          <div className="space-y-2">
            {paySchedule.map((ps, idx) => (
              <div key={ps.id} className="border border-gray-200 rounded-lg px-3 py-3 bg-white">
                <div className="flex items-center gap-2 mb-2">
                  <input className={`${inputCls} flex-1`} value={ps._desc} placeholder="Payment name"
                    onChange={e => setPaySchedule(prev => prev.map((it, i) => i === idx ? { ...it, _desc: e.target.value } : it))}
                    onBlur={() => handlePaymentBlur(idx)} />
                  <button onClick={() => handleDeletePayment(idx)} className="text-red-400 hover:text-red-600 text-xl leading-none">×</button>
                </div>
                <div className="flex items-center gap-2">
                  <select className={`${inputCls} w-16`} value={ps._type}
                    onChange={e => setPaySchedule(prev => prev.map((it, i) => i === idx ? { ...it, _type: e.target.value } : it))}
                    onBlur={() => handlePaymentBlur(idx)}>
                    <option value="percent">%</option>
                    <option value="dollar">$</option>
                  </select>
                  <input className={`w-24 px-2 py-2 border border-gray-300 rounded-lg text-sm text-right ${noSpin}`} type="number" step="0.01"
                    value={ps._val || ''}
                    onChange={e => setPaySchedule(prev => prev.map((it, i) => i === idx ? { ...it, _val: e.target.value } : it))}
                    onBlur={() => handlePaymentBlur(idx)} />
                  <span className="ml-auto text-sm font-semibold text-gray-700">{fmt(calcPayAmt(ps))}</span>
                </div>
              </div>
            ))}
            <button onClick={handleAddPayment} className="text-sm text-blue-600 hover:underline">+ Add Payment</button>
          </div>
          <div className="mt-3 bg-gray-50 rounded-xl px-4 py-3 space-y-1 text-sm">
            {paySchedule.map((ps, idx) => (
              <div key={ps.id} className="flex justify-between text-gray-600">
                <span>{ps._desc || `Payment ${idx + 1}`}</span>
                <span className="font-semibold">{fmt(calcPayAmt(ps))}</span>
              </div>
            ))}
            <div className="flex justify-between text-gray-900 font-bold border-t border-gray-200 pt-2 mt-1">
              <span>Balance Due</span><span>{fmt(balanceDue)}</span>
            </div>
          </div>
          <div className="mt-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={hdr.include_payment_button} onChange={e => setHdr(p => ({ ...p, include_payment_button: e.target.checked }))} className="w-4 h-4" />
              <span className="text-sm text-gray-700">Show payment button on web proposal</span>
            </label>
          </div>
        </section>

        {/* ── NOTES ────────────────────────────────────────────────────── */}
        <section>
          <p className={sectionHd}>Notes</p>
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Customer Notes <span className="normal-case text-gray-400 font-normal">— appears on proposal</span></label>
              <textarea className={`${inputCls} h-20 resize-y`} value={hdr.customer_notes} onChange={e => setHdr(p => ({ ...p, customer_notes: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>🔒 Internal Notes <span className="normal-case text-gray-400 font-normal">— never shown on proposal</span></label>
              <textarea className={`${inputCls} h-20 resize-y`} value={hdr.internal_notes} onChange={e => setHdr(p => ({ ...p, internal_notes: e.target.value }))} />
            </div>
          </div>
        </section>

      </div>

      {/* ── ACTION BAR ───────────────────────────────────────────────────── */}
      <div className="border-t px-5 py-4 bg-white rounded-b-2xl flex items-center gap-3 shrink-0">
        <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Draft'}
        </button>
        <button onClick={() => setShowDocsModal(true)} className="px-5 py-2 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-800">
          Create Documents
        </button>
        {saveMsg && (
          <span className={`text-sm font-medium ml-2 ${saveMsg === 'Saved' ? 'text-green-600' : 'text-red-500'}`}>
            {saveMsg}
          </span>
        )}
        <div className="flex-1" />
        <span className="text-base font-bold text-gray-800">{fmt(bidTotal)}</span>
      </div>

      {/* ── DOCUMENTS MODAL ──────────────────────────────────────────────── */}
      {showDocsModal && (() => {
        const printData = {
          proposal, checkedMap, customItems, discounts, paySchedule,
          lead, company, bidTotal, preDiscountTotal, discountTotal, balanceDue,
          proposalTopText: companySettings?.proposal_top_text || '',
          invoiceTopText: companySettings?.invoice_top_text || '',
        };
        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1100] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <h3 className="font-bold text-gray-800">Create Documents</h3>
                <button onClick={() => setShowDocsModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
              </div>
              <div className="px-6 py-4 space-y-2">
                {/* Proposal row */}
                <div className="flex gap-2">
                  <button
                    onClick={() => printProposal(printData)}
                    className="flex-1 px-4 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 text-sm text-left"
                  >
                    🖨 Print Bid / Proposal
                  </button>
                  <button
                    onClick={() => openEmailModal('proposal')}
                    disabled={emailSending}
                    className="px-3 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 text-xs whitespace-nowrap"
                  >
                    {emailSending ? '…' : '✉ Email'}
                  </button>
                </div>
                {emailMsg && (
                  <p className={`text-xs text-center ${emailMsg.startsWith('Sent') ? 'text-green-600' : 'text-red-500'}`}>
                    {emailMsg}
                  </p>
                )}
                {/* Payment invoice rows */}
                {paySchedule.map((ps, idx) => (
                  <div key={ps.id} className="flex gap-2">
                    <button
                      onClick={() => printPaymentInvoice({ ...printData, payEntry: ps, payIdx: idx })}
                      className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 text-sm text-left"
                    >
                      🧾 Invoice — {ps._desc || `Payment ${idx + 1}`} ({fmt(calcPayAmt(ps))})
                    </button>
                    <button
                      onClick={() => openEmailModal('invoice')}
                      disabled={emailSending}
                      className="px-3 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 text-xs whitespace-nowrap"
                    >
                      {emailSending ? '…' : '✉ Email'}
                    </button>
                  </div>
                ))}
                {/* Final invoice row */}
                <div className="flex gap-2">
                  <button
                    onClick={() => printFinalInvoice(printData)}
                    className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 text-sm text-left"
                  >
                    🧾 Final Invoice ({fmt(balanceDue)})
                  </button>
                  <button
                    onClick={() => openEmailModal('invoice')}
                    disabled={emailSending}
                    className="px-3 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 text-xs whitespace-nowrap"
                  >
                    {emailSending ? '…' : '✉ Email'}
                  </button>
                </div>
              </div>
              <div className="px-6 pb-4 border-t pt-3">
                <p className="text-xs text-gray-400 text-center">Print opens a preview — use Print → Save as PDF</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── EMAIL CONFIRM MODAL ──────────────────────────────────────────────── */}
      {emailModal.show && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1200] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="font-bold text-gray-800">
                {emailModal.type === 'invoice' ? 'Email Invoice' : 'Email Proposal'}
              </h3>
              <button onClick={() => setEmailModal(prev => ({ ...prev, show: false }))} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Send To</label>
                <input
                  type="email"
                  value={emailModal.addr}
                  onChange={e => setEmailModal(prev => ({ ...prev, addr: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  placeholder="customer@email.com"
                  autoFocus
                />
              </div>
              <p className="text-xs text-gray-400">
                {emailModal.type === 'invoice'
                  ? 'Sends the proposal link with invoice-style messaging.'
                  : 'Sends the customer a link to view and sign the proposal.'}
              </p>
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button
                onClick={() => setEmailModal(prev => ({ ...prev, show: false }))}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSendEmail}
                disabled={emailSending}
                className="flex-1 px-4 py-2.5 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 text-sm"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
