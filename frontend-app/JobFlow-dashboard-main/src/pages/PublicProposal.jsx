// ============================================================================
// File: src/pages/PublicProposal.jsx
// Public proposal page — no auth required. Customers view and sign proposals.
// Unsigned → proposal view (T&C, notes, accept form).
// Signed   → invoice view (clean invoice matching print, pay button only).
// ============================================================================

import React, { useEffect, useState } from 'react';

function fmt(n) {
  const v = parseFloat(n) || 0;
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d) {
  if (!d) return '';
  const dateOnly = String(d).substring(0, 10);
  return new Date(dateOnly + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

function todayStr() {
  return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function calcAmt(ps, bidTotal) {
  const val = parseFloat(ps.amount_value) || 0;
  return ps.amount_type === 'dollar' ? val : bidTotal * (val / 100);
}

export default function PublicProposal({ proposalId, forceView, invoiceNum = '1' }) {
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [paying,     setPaying]     = useState(false);
  const [payError,   setPayError]   = useState('');
  const [sigName,    setSigName]    = useState('');
  const [signing,    setSigning]    = useState(false);
  const [justSigned, setJustSigned] = useState(false);

  useEffect(() => {
    const apiBase = import.meta.env.APP_URL || import.meta.env.VITE_API_URL;
    fetch(`${apiBase}/api/bidder/public/${proposalId}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setData(d))
      .catch(() => setError('Proposal not found or no longer available.'))
      .finally(() => setLoading(false));
  }, [proposalId]);

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="text-center">
        <p className="text-2xl font-bold text-gray-800 mb-2">Proposal Not Found</p>
        <p className="text-gray-500">{error}</p>
      </div>
    </div>
  );

  const { proposal, lead, items = [], customItems = [], discounts = [], paymentSchedules = [] } = data;

  // Company info
  const companyName   = proposal.company_name_db     || proposal.ghl_company_from_name  || proposal.ghl_company_name || '';
  const companyPhone  = proposal.company_phone_db    || proposal.ghl_company_phone       || '';
  const companyEmail  = proposal.company_email_db    || proposal.ghl_company_from_email  || '';
  const companyStreet = proposal.company_address_db  || proposal.ghl_company_street_address || '';
  const companyCity   = proposal.company_city_db     || proposal.ghl_company_city        || '';
  const companyState  = proposal.company_state_db    || proposal.ghl_company_state       || '';
  const companyZip    = proposal.company_zip_db      || proposal.ghl_company_zip         || '';
  const companyWeb    = proposal.company_website_db  || proposal.ghl_company_website     || '';

  // Calculations
  const libItems      = items.filter(i => !i.is_freeform);
  const itemsTotal    = libItems.reduce((a, i) => a + (parseFloat(i.line_total) || 0), 0);
  const customTotal   = customItems.filter(i => !i.is_subtotal).reduce((a, i) => a + (parseFloat(i.line_total) || 0), 0);
  const preDiscount   = itemsTotal + customTotal;
  const discountTotal = discounts.reduce((a, d) => {
    const val = parseFloat(d.discount_value) || 0;
    return a + (d.discount_type === 'dollar' ? val : preDiscount * (val / 100));
  }, 0);
  const bidTotal   = preDiscount - discountTotal;
  const payTotal   = paymentSchedules.reduce((a, ps) => a + calcAmt(ps, bidTotal), 0);
  const balanceDue = bidTotal - payTotal;

  // Stripe / payment
  const stripeConfigured = !!(proposal.company_stripe_publishable_key);
  const showPayButton    = (proposal.include_payment_button ?? proposal.company_include_payment_button) && stripeConfigured;

  // Resolve which payment schedule entry this invoice is for
  const totalInvoices = paymentSchedules.length;
  const invoiceIndex  = invoiceNum === 'F'
    ? Math.max(0, totalInvoices - 1)
    : Math.max(0, Math.min(parseInt(invoiceNum, 10) - 1, totalInvoices - 1 || 0));
  const isLastInvoice = totalInvoices > 1 && invoiceIndex === totalInvoices - 1;
  const invSuffix     = isLastInvoice ? 'F' : (totalInvoices <= 1 ? '1' : String(invoiceIndex + 1));

  const payEntry      = paymentSchedules[invoiceIndex] || null;
  const basePayAmount = payEntry ? calcAmt(payEntry, bidTotal) : bidTotal;
  const feePercent    = parseFloat(proposal.company_convenience_fee_percent) || 0;
  const feeAmount     = basePayAmount * (feePercent / 100);
  const totalWithFee  = basePayAmount + feeAmount;

  // Invoice metadata
  const invNum  = `INV-${String(proposal.id + 121).padStart(4, '0')}-${invSuffix}`;
  const invDate = fmtDate(proposal.signed_at) || todayStr();
  const payLabel  = payEntry?.description || 'Full Payment';
  const payDetail = payEntry?.amount_type === 'percent'
    ? `${parseFloat(payEntry.amount_value) || 0}% of ${fmt(bidTotal)}`
    : '';

  async function handleStripePayment() {
    setPayError('');
    setPaying(true);
    try {
      const apiBase = import.meta.env.APP_URL || import.meta.env.VITE_API_URL;
      const resp = await fetch(`${apiBase}/api/bidder/public/${proposalId}/stripe-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base_amount_cents: Math.round(basePayAmount * 100),
          convenience_fee_percent: feePercent,
          success_url: `${window.location.origin}/payment-success/${proposalId}?amount=${Math.round(totalWithFee * 100)}&label=${encodeURIComponent(payLabel)}&inv=${invSuffix}`,
          cancel_url:  window.location.href,
        }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || 'Payment setup failed');
      window.location.href = json.url;
    } catch (e) {
      setPayError(e.message || 'Unable to start payment. Please try again.');
      setPaying(false);
    }
  }

  async function handleSign() {
    if (!sigName.trim()) return;
    setSigning(true);
    try {
      const apiBase = import.meta.env.APP_URL || import.meta.env.VITE_API_URL;
      await fetch(`${apiBase}/api/bidder/public/${proposalId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature_name: sigName.trim() }),
      });
    } catch { /* non-critical */ } finally {
      setJustSigned(true);
      setSigning(false);
    }
  }

  // Invoice route always shows invoice; proposal route always shows proposal
  const isSigned      = forceView === 'invoice';
  const paidNums      = (proposal.paid_invoice_nums || '').split(',').filter(Boolean);
  const isPaid        = paidNums.includes(invSuffix) || paidNums.includes(String(invoiceIndex + 1));
  const alreadySigned = !!proposal.signed_at || justSigned;
  const invoiceUrl   = `${window.location.origin}/invoice/${proposalId}`;
  const termsText    = proposal.terms_and_conditions || '';
  const systemNotes  = proposal.system_notes || '';
  const designId     = proposal.proposal_design_id || proposal.preferred_proposal_design_id;

  // Pre-sort items for proposal view
  const allSortedItems = [
    ...libItems.map(i => ({ ...i, _type: 'lib' })),
    ...customItems.map(i => ({ ...i, _type: 'custom' })),
  ].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const runningSubtotal = (upTo) =>
    [...libItems, ...customItems.filter(i => !i.is_subtotal)]
      .filter(i => (i.sort_order ?? 0) < upTo)
      .reduce((a, i) => a + (parseFloat(i.line_total) || 0), 0);

  // ── Pay button / paid badge (reused in both invoice designs) ────────────────
  const paidBadge = (
    <div className="flex items-center justify-center gap-3 py-4 bg-green-50 border border-green-200 rounded-2xl">
      <svg className="w-6 h-6 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
      <span className="text-green-700 font-bold text-lg tracking-wide">PAID</span>
    </div>
  );

  const payBlock = isPaid ? paidBadge : (showPayButton ? (
    <div>
      {feePercent > 0 && (
        <p className="text-xs text-gray-500 text-center mb-2">
          Online payments include a {feePercent}% convenience fee — total: {fmt(totalWithFee)}
        </p>
      )}
      {payError && <p className="text-red-600 text-sm mb-2 text-center">{payError}</p>}
      <button
        onClick={handleStripePayment}
        disabled={paying}
        className="block w-full py-4 text-white font-bold text-base rounded-2xl text-center shadow transition disabled:opacity-60 bg-blue-600 hover:bg-blue-700"
      >
        {paying ? 'Redirecting to Stripe…' : 'Make Your Payment'}
      </button>
    </div>
  ) : null);

  // ============================================================
  // INVOICE VIEW (signed)
  // ============================================================
  if (isSigned) {
    // ── Styled invoice ───────────────────────────────────────
    if (designId) {
      const AC  = proposal.design_accent_color  || '#f97316';
      const HBG = proposal.design_primary_color || '#1c2333';
      const logoSrc = proposal.logo_url || null;

      const paidBadgeStyled = (
        <div className="flex items-center justify-center gap-3 py-4 bg-green-50 border border-green-200 rounded-2xl">
          <svg className="w-6 h-6 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-green-700 font-black text-lg tracking-widest">PAID</span>
        </div>
      );

      const payBtnStyled = isPaid ? paidBadgeStyled : (showPayButton ? (
        <div>
          {feePercent > 0 && (
            <p className="text-xs text-gray-500 text-center mb-2">
              Online payments include a {feePercent}% convenience fee — total: {fmt(totalWithFee)}
            </p>
          )}
          {payError && <p className="text-red-600 text-sm mb-2 text-center">{payError}</p>}
          <button
            onClick={handleStripePayment}
            disabled={paying}
            className="block w-full py-4 text-white font-bold text-base rounded-2xl text-center shadow transition disabled:opacity-60"
            style={{ background: AC }}
          >
            {paying ? 'Redirecting to Stripe…' : 'Make Your Payment'}
          </button>
        </div>
      ) : null);

      return (
        <div className="min-h-screen bg-gray-100">

          {/* Header */}
          <div style={{ background: HBG }}>
            <div className="max-w-3xl mx-auto flex justify-between items-center px-4 py-5">
              <div className="flex items-center gap-3">
                {logoSrc && <img src={logoSrc} alt={companyName} className="max-h-14 max-w-[140px] object-contain flex-shrink-0" />}
                <div className="text-xl font-black text-white tracking-wide leading-tight">{companyName}</div>
              </div>
              <div className="text-right flex-shrink-0 ml-4">
                <div className="text-4xl font-black text-white tracking-widest leading-none">INVOICE</div>
                <div className="text-xs font-bold uppercase tracking-widest mt-1.5" style={{ color: AC }}>
                  PREMIUM COATING. EXCEPTIONAL RESULTS.
                </div>
              </div>
            </div>
          </div>

          {/* Date / Number strip */}
          <div className="bg-gray-100" style={{ borderBottom: `3px solid ${AC}` }}>
            <div className="max-w-3xl mx-auto flex justify-between items-center px-4 py-2.5">
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-gray-400">Date</div>
                <div className="text-sm font-bold" style={{ color: HBG }}>{invDate}</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold uppercase tracking-widest text-gray-400">Invoice No.</div>
                <div className="text-sm font-bold" style={{ color: HBG }}>{invNum}</div>
              </div>
            </div>
          </div>

          {/* Bill To / From */}
          <div className="bg-white border-b border-gray-200">
            <div className="max-w-3xl mx-auto grid grid-cols-2">
              <div className="px-4 py-4 border-r border-gray-200">
                <div className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: AC }}>Bill To:</div>
                {lead && (
                  <>
                    <div className="text-base font-bold" style={{ color: HBG }}>{lead.full_name || lead.name}</div>
                    {lead.address && <div className="text-sm text-gray-500 mt-0.5">{[lead.address, lead.city, lead.state, lead.zip].filter(Boolean).join(', ')}</div>}
                    {lead.phone && <div className="text-sm text-gray-500">{lead.phone}</div>}
                    {lead.email && <div className="text-sm text-gray-500">{lead.email}</div>}
                  </>
                )}
              </div>
              <div className="px-4 py-4">
                <div className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: AC }}>From:</div>
                <div className="text-base font-bold" style={{ color: HBG }}>{companyName}</div>
                {companyStreet && <div className="text-sm text-gray-500 mt-0.5">{[companyStreet, companyCity, companyState, companyZip].filter(Boolean).join(', ')}</div>}
                {companyPhone && <div className="text-sm text-gray-500">{companyPhone}</div>}
                {companyWeb   && <div className="text-sm text-gray-500">{companyWeb}</div>}
                {(proposal.created_by_name || proposal.salesman) && <div className="text-sm font-semibold text-gray-700">{proposal.created_by_name || proposal.salesman}</div>}
              </div>
            </div>
          </div>

          <div className="max-w-3xl mx-auto px-4 py-5 space-y-4">

            {/* Invoice for */}
            <div className="bg-white rounded-xl shadow-sm px-5 py-3">
              <p className="text-sm text-gray-600">
                <strong>Invoice for:</strong> {proposal.bid_name || ''}{lead ? ` — ${lead.full_name || lead.name}` : ''}
              </p>
            </div>

            {/* Line item table */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: HBG }}>
                    <th className="text-left px-4 py-2.5 text-white text-xs font-bold uppercase tracking-wider">Description</th>
                    <th className="text-right px-4 py-2.5 text-white text-xs font-bold uppercase tracking-wider w-36">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-white">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">{payLabel}</div>
                      {payDetail && <div className="text-xs text-gray-400 mt-0.5">{payDetail}</div>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(basePayAmount)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Amount Due */}
            <div className="flex justify-end">
              <div className="rounded-xl shadow-sm overflow-hidden" style={{ background: HBG, minWidth: '240px' }}>
                <div className="px-6 py-4 flex justify-between items-center">
                  <span className="text-sm font-black uppercase tracking-widest text-gray-300">Amount Due</span>
                  <span className="text-2xl font-black ml-6" style={{ color: AC }}>{fmt(basePayAmount)}</span>
                </div>
              </div>
            </div>

            {payBtnStyled}

          </div>

          {/* Footer */}
          <div style={{ background: HBG }} className="mt-4">
            <div className="max-w-3xl mx-auto py-4 px-4 text-center">
              <p className="text-sm font-semibold tracking-wide" style={{ color: AC }}>
                ★ Thank you for your business!
              </p>
            </div>
          </div>

        </div>
      );
    }

    // ── Classic invoice ──────────────────────────────────────
    return (
      <div className="min-h-screen bg-gray-100">

        <div className="bg-blue-700 text-white">
          <div className="max-w-2xl mx-auto px-4 py-6">
            <h1 className="text-2xl font-bold">{companyName}</h1>
            {companyStreet && (
              <p className="text-blue-200 text-sm mt-0.5">
                {[companyStreet, companyCity, companyState, companyZip].filter(Boolean).join(', ')}
              </p>
            )}
            <div className="flex flex-wrap gap-x-4 mt-1 text-blue-200 text-sm">
              {companyPhone && <a href={`tel:${companyPhone}`} className="hover:text-white">{companyPhone}</a>}
              {companyEmail && <a href={`mailto:${companyEmail}`} className="hover:text-white">{companyEmail}</a>}
              {companyWeb   && <a href={companyWeb.startsWith('http') ? companyWeb : `https://${companyWeb}`} className="hover:text-white">{companyWeb}</a>}
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

          {/* Invoice header card */}
          <div className="bg-white rounded-2xl shadow-sm px-5 py-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Invoice</p>
                <h2 className="text-xl font-bold text-gray-900">{proposal.bid_name}</h2>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-gray-400">Invoice No.</p>
                <p className="text-sm font-bold text-gray-700">{invNum}</p>
                <p className="text-xs text-gray-400 mt-1">Date</p>
                <p className="text-sm font-semibold text-gray-700">{invDate}</p>
              </div>
            </div>

            {/* Bill To */}
            {lead && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Bill To</p>
                <p className="font-semibold text-gray-900">{lead.full_name || lead.name}</p>
                {lead.address && <p className="text-sm text-gray-500">{[lead.address, lead.city, lead.state, lead.zip].filter(Boolean).join(', ')}</p>}
                {lead.phone && <p className="text-sm text-gray-500">{lead.phone}</p>}
                {lead.email && <p className="text-sm text-gray-500">{lead.email}</p>}
              </div>
            )}
          </div>

          {/* Invoice for */}
          <div className="bg-white rounded-2xl shadow-sm px-5 py-3">
            <p className="text-sm text-gray-600">
              <strong>Invoice for:</strong> {proposal.bid_name || ''}{lead ? ` — ${lead.full_name || lead.name}` : ''}
            </p>
          </div>

          {/* Line item table */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-800 text-white">
                  <th className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider">Description</th>
                  <th className="text-right px-4 py-2.5 text-xs font-bold uppercase tracking-wider w-36">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-white">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-900">{payLabel}</div>
                    {payDetail && <div className="text-xs text-gray-400 mt-0.5">{payDetail}</div>}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(basePayAmount)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Amount Due */}
          <div className="bg-white rounded-2xl shadow-sm px-5 py-4 flex justify-between items-center">
            <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Amount Due</span>
            <span className="text-2xl font-black text-gray-900">{fmt(basePayAmount)}</span>
          </div>

          {payBlock}

          <div className="pb-8 text-center text-xs text-gray-400 space-y-1">
            <p>{companyName}</p>
            {(companyStreet || companyCity) && (
              <p>{[companyStreet, companyCity, companyState, companyZip].filter(Boolean).join(', ')}</p>
            )}
            <p>{[companyPhone, companyEmail].filter(Boolean).join(' · ')}</p>
          </div>

        </div>
      </div>
    );
  }

  // ============================================================
  // PROPOSAL VIEW (unsigned)
  // ============================================================

  // ── Styled (Professional) proposal ───────────────────────────────────────
  if (designId) {
    const AC  = proposal.design_accent_color  || '#f97316';
    const HBG = proposal.design_primary_color || '#1c2333';
    const docNum = `PRO-${String(proposal.id + 121).padStart(4, '0')}`;
    const logoSrc = proposal.logo_url || null;

    return (
      <div className="min-h-screen bg-gray-100">

        {/* Header */}
        <div style={{ background: HBG }}>
          <div className="max-w-3xl mx-auto flex justify-between items-center px-4 py-5">
            <div className="flex items-center gap-3">
              {logoSrc && <img src={logoSrc} alt={companyName} className="max-h-14 max-w-[140px] object-contain flex-shrink-0" />}
              <div className="text-xl font-black text-white tracking-wide leading-tight">{companyName}</div>
            </div>
            <div className="text-right flex-shrink-0 ml-4">
              <div className="text-4xl font-black text-white tracking-widest leading-none">PROPOSAL</div>
              <div className="text-xs font-bold uppercase tracking-widest mt-1.5" style={{ color: AC }}>
                PREMIUM COATING. EXCEPTIONAL RESULTS.
              </div>
            </div>
          </div>
        </div>

        {/* Date / Number strip */}
        <div className="bg-gray-100" style={{ borderBottom: `3px solid ${AC}` }}>
          <div className="max-w-3xl mx-auto flex justify-between items-center px-4 py-2.5">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-gray-400">Date</div>
              <div className="text-sm font-bold" style={{ color: HBG }}>{fmtDate(proposal.presented_date) || '—'}</div>
            </div>
            <div className="text-right">
              <div className="text-xs font-bold uppercase tracking-widest text-gray-400">Proposal No.</div>
              <div className="text-sm font-bold" style={{ color: HBG }}>{docNum}</div>
            </div>
          </div>
        </div>

        {/* Prepared For / By */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-3xl mx-auto grid grid-cols-2">
            <div className="px-4 py-4 border-r border-gray-200">
              <div className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: AC }}>Prepared For:</div>
              {lead && (
                <>
                  <div className="text-base font-bold" style={{ color: HBG }}>{lead.full_name || lead.name}</div>
                  {lead.address && <div className="text-sm text-gray-500 mt-0.5">{[lead.address, lead.city, lead.state, lead.zip].filter(Boolean).join(', ')}</div>}
                  {lead.phone && <div className="text-sm text-gray-500">{lead.phone}</div>}
                  {lead.email && <div className="text-sm text-gray-500">{lead.email}</div>}
                </>
              )}
            </div>
            <div className="px-4 py-4">
              <div className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: AC }}>Prepared By:</div>
              <div className="text-base font-bold" style={{ color: HBG }}>{companyName}</div>
              {companyStreet && <div className="text-sm text-gray-500 mt-0.5">{[companyStreet, companyCity, companyState, companyZip].filter(Boolean).join(', ')}</div>}
              {companyPhone && <div className="text-sm text-gray-500">{companyPhone}</div>}
              {companyWeb   && <div className="text-sm text-gray-500">{companyWeb}</div>}
              {(proposal.created_by_name || proposal.salesman) && <div className="text-sm font-semibold text-gray-700">{proposal.created_by_name || proposal.salesman}</div>}
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 py-5 space-y-4">

          {/* Bid name / description */}
          {(proposal.bid_name || proposal.bid_description || proposal.install_date || proposal.install_date_tbd) && (
            <div className="bg-white rounded-xl shadow-sm px-5 py-4">
              {proposal.bid_name && <h2 className="text-lg font-bold" style={{ color: HBG }}>{proposal.bid_name}</h2>}
              {proposal.bid_description && <p className="text-sm text-gray-500 mt-1">{proposal.bid_description}</p>}
              {proposal.install_date && !proposal.install_date_tbd && (
                <p className="text-sm text-gray-600 mt-2"><strong>Install Date:</strong> {fmtDate(proposal.install_date)}</p>
              )}
              {proposal.install_date_tbd && (
                <p className="text-sm text-gray-600 mt-2"><strong>Install Date:</strong> To Be Determined</p>
              )}
            </div>
          )}

          {/* Scope of Work */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100">
              <div className="w-1 h-5 rounded-full flex-shrink-0" style={{ background: AC }} />
              <span className="text-xs font-black uppercase tracking-widest" style={{ color: HBG }}>Scope of Work</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: HBG }}>
                    <th className="text-left px-4 py-2.5 text-white text-xs font-bold uppercase tracking-wider">Description</th>
                    <th className="text-right px-4 py-2.5 text-white text-xs font-bold uppercase tracking-wider w-14">Qty</th>
                    <th className="text-right px-4 py-2.5 text-white text-xs font-bold uppercase tracking-wider w-28">Unit Price</th>
                    <th className="text-right px-4 py-2.5 text-white text-xs font-bold uppercase tracking-wider w-28">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {allSortedItems.map((item, idx) => {
                    if (item.is_subtotal) {
                      const t = runningSubtotal(item.sort_order ?? 0);
                      return (
                        <tr key={`sub-${item.id}`} className="bg-gray-50">
                          <td colSpan={3} className="px-4 py-2 text-right text-xs font-bold uppercase tracking-wide text-gray-500 border-t-2 border-gray-300">Running Subtotal</td>
                          <td className="px-4 py-2 text-right font-bold text-gray-800 border-t-2 border-gray-300">{fmt(t)}</td>
                        </tr>
                      );
                    }
                    if (item._type === 'lib') {
                      return (
                        <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-4 py-2.5">
                            <div className="font-semibold text-gray-900">{item.name}</div>
                            {item.description && <div className="text-xs text-gray-400 mt-0.5">{item.description}</div>}
                          </td>
                          <td className="px-4 py-2.5 text-right text-gray-600">{item.breakout_price ? item.quantity : ''}</td>
                          <td className="px-4 py-2.5 text-right text-gray-600">{item.breakout_price ? fmt(item.unit_price) : ''}</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
                            {item.breakout_price ? fmt(item.line_total) : <span className="text-gray-400 italic font-normal text-xs">Included</span>}
                          </td>
                        </tr>
                      );
                    }
                    return (
                      <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-4 py-2.5 font-semibold text-gray-900">{item.description}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600">{item.quantity}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600">{fmt(item.price_each)}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{fmt(item.line_total)}</td>
                      </tr>
                    );
                  })}
                  {discounts.map(d => {
                    const val = parseFloat(d.discount_value) || 0;
                    const amt = d.discount_type === 'dollar' ? val : preDiscount * (val / 100);
                    const acceptDate = d.if_accepted_by ? String(d.if_accepted_by).substring(0, 10) : '';
                    return (
                      <tr key={d.id} className="text-red-600">
                        <td colSpan={3} className="px-4 py-2 text-right text-sm">
                          {d.description || 'Discount'}
                          {acceptDate && <span className="block text-xs font-normal">If accepted by {fmtDate(acceptDate)}</span>}
                        </td>
                        <td className="px-4 py-2 text-right font-semibold">-{fmt(amt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Investment Summary */}
          <div className="flex justify-end">
            <div className="rounded-xl shadow-sm overflow-hidden" style={{ background: HBG, minWidth: '280px' }}>
              <div className="px-6 py-5">
                <div className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: AC }}>Investment Summary</div>
                {discountTotal > 0 && (
                  <>
                    <div className="flex justify-between items-center py-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <span className="text-sm text-gray-400">Subtotal</span>
                      <span className="text-gray-300 font-semibold">{fmt(preDiscount)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <span className="text-sm text-gray-400">Discounts</span>
                      <span className="text-red-400 font-semibold">-{fmt(discountTotal)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
                  <span className="text-sm text-gray-300 font-bold uppercase tracking-wider">Total Project Cost</span>
                  <span className="text-xl font-black" style={{ color: AC }}>{fmt(bidTotal)}</span>
                </div>
                {paymentSchedules.map((ps, i) => (
                  <div key={ps.id} className="flex justify-between items-center py-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <span className="text-sm text-gray-400">{ps.description || `Payment ${i + 1}`}</span>
                    <span className="font-bold text-base" style={{ color: AC }}>{fmt(calcAmt(ps, bidTotal))}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center py-2 mt-1">
                  <span className="text-sm text-gray-300 font-bold uppercase tracking-wider">Balance Due</span>
                  <span className="text-xl font-black" style={{ color: AC }}>{fmt(balanceDue)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* System Notes */}
          {systemNotes && (
            <div className="bg-white rounded-xl shadow-sm px-5 py-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-5 rounded-full flex-shrink-0" style={{ background: AC }} />
                <span className="text-xs font-black uppercase tracking-widest" style={{ color: HBG }}>Notes</span>
              </div>
              <p className="text-sm text-gray-600 whitespace-pre-line">{systemNotes}</p>
            </div>
          )}

          {/* Terms & Conditions */}
          {termsText && (
            <div className="bg-white rounded-xl shadow-sm px-5 py-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-5 rounded-full flex-shrink-0" style={{ background: AC }} />
                <span className="text-xs font-black uppercase tracking-widest" style={{ color: HBG }}>Terms &amp; Conditions</span>
              </div>
              <div className="max-h-48 overflow-y-auto pr-1">
                <p className="text-sm text-gray-600 whitespace-pre-line">{termsText}</p>
              </div>
            </div>
          )}

          {/* Accept / Invoice Link */}
          {alreadySigned ? (
            <div className="bg-green-50 border border-green-200 rounded-xl shadow-sm px-5 py-5 text-center">
              <p className="font-bold text-green-700 text-base mb-1">✓ Proposal Accepted</p>
              <p className="text-sm text-green-600 mb-4">Thank you! Your proposal has been accepted.</p>
              <a
                href={invoiceUrl}
                className="block w-full py-3 text-white font-bold rounded-xl text-center transition"
                style={{ background: AC }}
              >
                View Invoice
              </a>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm px-5 py-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-5 rounded-full flex-shrink-0" style={{ background: AC }} />
                <span className="text-xs font-black uppercase tracking-widest" style={{ color: HBG }}>Accept This Proposal</span>
              </div>
              <p className="text-sm text-gray-500 mb-3">
                By typing your name below and clicking "Accept Proposal," you agree to the terms and conditions outlined above.
              </p>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-orange-300"
                placeholder="Type your full name to sign"
                value={sigName}
                onChange={e => setSigName(e.target.value)}
                disabled={signing}
              />
              <button
                onClick={handleSign}
                disabled={signing || !sigName.trim()}
                className="w-full py-3 text-white font-bold rounded-xl transition disabled:opacity-50"
                style={{ background: AC }}
              >
                {signing ? 'Submitting…' : 'Accept Proposal'}
              </button>
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={{ background: HBG }} className="mt-4">
          <div className="max-w-3xl mx-auto py-4 px-4 text-center">
            <p className="text-sm font-semibold tracking-wide" style={{ color: AC }}>
              ★ Thank you for the opportunity to earn your business!
            </p>
          </div>
        </div>

      </div>
    );
  }

  // ── Classic proposal ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-100">

      <div className="bg-blue-700 text-white">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold">{companyName}</h1>
          {companyStreet && (
            <p className="text-blue-200 text-sm mt-0.5">
              {[companyStreet, companyCity, companyState, companyZip].filter(Boolean).join(', ')}
            </p>
          )}
          <div className="flex flex-wrap gap-x-4 mt-1 text-blue-200 text-sm">
            {companyPhone && <a href={`tel:${companyPhone}`} className="hover:text-white">{companyPhone}</a>}
            {companyEmail && <a href={`mailto:${companyEmail}`} className="hover:text-white">{companyEmail}</a>}
            {companyWeb   && <a href={companyWeb.startsWith('http') ? companyWeb : `https://${companyWeb}`} className="hover:text-white">{companyWeb}</a>}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Title */}
        <div className="bg-white rounded-2xl shadow-sm px-5 py-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Proposal</p>
              <h2 className="text-xl font-bold text-gray-900">{proposal.bid_name}</h2>
              {proposal.bid_description && <p className="text-gray-500 text-sm mt-1">{proposal.bid_description}</p>}
            </div>
            {proposal.presented_date && (
              <div className="text-right shrink-0">
                <p className="text-xs text-gray-400">Date</p>
                <p className="text-sm font-semibold text-gray-700">{fmtDate(proposal.presented_date)}</p>
              </div>
            )}
          </div>

          {lead && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Prepared For</p>
              <p className="font-semibold text-gray-900">{lead.full_name || lead.name}</p>
              {lead.address && <p className="text-sm text-gray-500">{[lead.address, lead.city, lead.state, lead.zip].filter(Boolean).join(', ')}</p>}
              {lead.phone && <p className="text-sm text-gray-500">{lead.phone}</p>}
            </div>
          )}

          {proposal.install_date && !proposal.install_date_tbd && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Install Date: </span>
              <span className="text-sm font-semibold text-gray-700">{fmtDate(proposal.install_date)}</span>
            </div>
          )}
          {proposal.install_date_tbd && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Install Date: </span>
              <span className="text-sm text-gray-500">To Be Determined</span>
            </div>
          )}
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-2xl shadow-sm px-5 py-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Scope of Work</p>
          <div className="divide-y divide-gray-100">
            {(() => {
              const allItems = [
                ...libItems.map(i => ({ ...i, _type: 'lib' })),
                ...customItems.map(i => ({ ...i, _type: 'custom' })),
              ].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

              const runningTotal = (upToSortOrder) =>
                [...libItems, ...customItems.filter(i => !i.is_subtotal)]
                  .filter(i => (i.sort_order ?? 0) < upToSortOrder)
                  .reduce((a, i) => a + (parseFloat(i.line_total) || 0), 0);

              return allItems.map(item => {
                if (item.is_subtotal) {
                  return (
                    <div key={`sub-${item.id}`} className="py-2 flex items-center justify-between border-t-2 border-gray-300 mt-1">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Running Subtotal</span>
                      <span className="text-sm font-bold text-gray-800">{fmt(runningTotal(item.sort_order ?? 0))}</span>
                    </div>
                  );
                }
                if (item._type === 'lib') {
                  return (
                    <div key={item.id} className="py-3 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm">{item.name}</p>
                        {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        {item.breakout_price
                          ? <p className="font-semibold text-gray-900 text-sm">{fmt(item.line_total)}</p>
                          : <p className="text-sm text-gray-400 italic">Included</p>}
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={item.id} className="py-3 flex items-start justify-between gap-3">
                    <p className="font-semibold text-gray-900 text-sm flex-1">{item.description}</p>
                    <p className="font-semibold text-gray-900 text-sm shrink-0">{fmt(item.line_total)}</p>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Totals */}
        <div className="bg-white rounded-2xl shadow-sm px-5 py-5 space-y-2">
          {discountTotal > 0 && (
            <>
              <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span><span>{fmt(preDiscount)}</span></div>
              {discounts.map(d => {
                const val = parseFloat(d.discount_value) || 0;
                const amt = d.discount_type === 'dollar' ? val : preDiscount * (val / 100);
                const acceptDate = d.if_accepted_by ? String(d.if_accepted_by).substring(0, 10) : '';
                return (
                  <div key={d.id} className="flex justify-between text-sm text-red-600">
                    <span>
                      {d.description || 'Discount'}
                      {acceptDate && <span className="block text-xs font-normal">If accepted by {fmtDate(acceptDate)}</span>}
                    </span>
                    <span className="shrink-0 ml-3">-{fmt(amt)}</span>
                  </div>
                );
              })}
            </>
          )}
          <div className="flex justify-between font-bold text-lg border-t border-gray-200 pt-2">
            <span>Total</span><span>{fmt(bidTotal)}</span>
          </div>
        </div>

        {/* Payment Schedule */}
        {paymentSchedules.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm px-5 py-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Payment Schedule</p>
            <div className="space-y-2">
              {paymentSchedules.map((ps, i) => (
                <div key={ps.id} className="flex justify-between text-sm">
                  <span className="text-gray-700">{ps.description || `Payment ${i + 1}`}</span>
                  <span className="font-semibold text-gray-900">{fmt(calcAmt(ps, bidTotal))}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold border-t border-gray-200 pt-2">
                <span>Balance Due</span><span>{fmt(balanceDue)}</span>
              </div>
            </div>
          </div>
        )}

        {/* System Notes */}
        {systemNotes && (
          <div className="bg-white rounded-2xl shadow-sm px-5 py-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Notes</p>
            <p className="text-sm text-gray-700 whitespace-pre-line">{systemNotes}</p>
          </div>
        )}

        {/* Terms & Conditions */}
        {termsText && (
          <div className="bg-white rounded-2xl shadow-sm px-5 py-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Terms &amp; Conditions</p>
            <div className="max-h-48 overflow-y-auto pr-1">
              <p className="text-sm text-gray-600 whitespace-pre-line">{termsText}</p>
            </div>
          </div>
        )}

        {/* Accept / Invoice Link */}
        {alreadySigned ? (
          <div className="bg-green-50 border border-green-200 rounded-2xl shadow-sm px-5 py-5 text-center">
            <p className="font-bold text-green-700 text-base mb-1">✓ Proposal Accepted</p>
            <p className="text-sm text-green-600 mb-4">Thank you! Your proposal has been accepted.</p>
            <a
              href={invoiceUrl}
              className="block w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-center transition"
            >
              View Invoice
            </a>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm px-5 py-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Accept This Proposal</p>
            <p className="text-sm text-gray-500 mb-3">
              By typing your name below and clicking "Accept Proposal," you agree to the terms and conditions outlined above.
            </p>
            <input
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="Type your full name to sign"
              value={sigName}
              onChange={e => setSigName(e.target.value)}
              disabled={signing}
            />
            <button
              onClick={handleSign}
              disabled={signing || !sigName.trim()}
              className="w-full py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition disabled:opacity-50"
            >
              {signing ? 'Submitting…' : 'Accept Proposal'}
            </button>
          </div>
        )}

        <div className="pb-8 text-center text-xs text-gray-400 space-y-1">
          <p>{companyName}</p>
          {(companyStreet || companyCity) && (
            <p>{[companyStreet, companyCity, companyState, companyZip].filter(Boolean).join(', ')}</p>
          )}
          <p>{[companyPhone, companyEmail].filter(Boolean).join(' · ')}</p>
        </div>

      </div>
    </div>
  );
}
