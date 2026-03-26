// ============================================================================
// File: src/pages/PublicProposal.jsx
// Public proposal page — no auth required. Customers view and sign proposals.
// ============================================================================

import React, { useEffect, useState } from 'react';
import { apiRequest } from '../api';

function fmt(n) {
  const v = parseFloat(n) || 0;
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d + (d.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

function calcAmt(ps, bidTotal) {
  const val = parseFloat(ps.amount_value) || 0;
  return ps.amount_type === 'dollar' ? val : bidTotal * (val / 100);
}

export default function PublicProposal({ proposalId }) {
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [sigName,   setSigName]   = useState('');
  const [agreed,    setAgreed]    = useState(false);
  const [signing,   setSigning]   = useState(false);
  const [signed,    setSigned]    = useState(false);
  const [signedBy,  setSignedBy]  = useState('');
  const [signedAt,  setSignedAt]  = useState('');
  const [submitErr, setSubmitErr] = useState('');

  useEffect(() => {
    apiRequest(`/api/bidder/public/${proposalId}`)
      .then(d => {
        setData(d);
        if (d.proposal?.signed_at) {
          setSigned(true);
          setSignedBy(d.proposal.signature_name || '');
          setSignedAt(d.proposal.signed_at);
        }
      })
      .catch(() => setError('Proposal not found or no longer available.'))
      .finally(() => setLoading(false));
  }, [proposalId]);

  async function handleSign() {
    if (!sigName.trim()) { setSubmitErr('Please type your full name to sign.'); return; }
    if (!agreed) { setSubmitErr('Please agree to the Terms & Conditions.'); return; }
    setSigning(true);
    setSubmitErr('');
    try {
      const res = await fetch(`${import.meta.env.APP_URL || import.meta.env.VITE_API_URL}/api/bidder/public/${proposalId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature_name: sigName.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to submit');
      setSigned(true);
      setSignedBy(sigName.trim());
      setSignedAt(json.signed_at);
    } catch (e) {
      setSubmitErr(e.message || 'Something went wrong. Please try again.');
    } finally {
      setSigning(false);
    }
  }

  // ── Loading / Error ────────────────────────────────────────────────────────
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
  const companyName  = proposal.ghl_company_from_name || proposal.company_name_db || '';
  const companyPhone = proposal.ghl_company_phone || '';
  const companyEmail = proposal.ghl_company_from_email || '';
  const companyStreet= proposal.ghl_company_street_address || '';
  const companyCity  = proposal.ghl_company_city || '';
  const companyWeb   = proposal.ghl_company_website || '';

  // Calculations
  const libItems = items.filter(i => !i.is_freeform);
  const itemsTotal   = libItems.reduce((a, i) => a + (parseFloat(i.line_total) || 0), 0);
  const customTotal  = customItems.filter(i => !i.is_subtotal).reduce((a, i) => a + (parseFloat(i.line_total) || 0), 0);
  const preDiscount  = itemsTotal + customTotal;
  const discountTotal= discounts.reduce((a, d) => {
    const val = parseFloat(d.discount_value) || 0;
    return a + (d.discount_type === 'dollar' ? val : preDiscount * (val / 100));
  }, 0);
  const bidTotal  = preDiscount - discountTotal;
  const payTotal  = paymentSchedules.reduce((a, ps) => a + calcAmt(ps, bidTotal), 0);
  const balanceDue= bidTotal - payTotal;

  const payUrl = (proposal.payment_url || proposal.company_payment_url || '').trim();
  const showPayButton = (proposal.include_payment_button ?? proposal.company_include_payment_button) && payUrl;

  const termsText = proposal.terms_and_conditions || '';
  const systemNotes = proposal.system_notes || '';

  return (
    <div className="min-h-screen bg-gray-100">

      {/* ── Company Header ─────────────────────────────────────────────── */}
      <div className="bg-blue-700 text-white px-6 py-6">
        <h1 className="text-2xl font-bold">{companyName}</h1>
        {companyStreet && <p className="text-blue-200 text-sm mt-0.5">{companyStreet}{companyCity ? ', ' + companyCity : ''}</p>}
        <div className="flex flex-wrap gap-x-4 mt-1 text-blue-200 text-sm">
          {companyPhone && <a href={`tel:${companyPhone}`} className="hover:text-white">{companyPhone}</a>}
          {companyEmail && <a href={`mailto:${companyEmail}`} className="hover:text-white">{companyEmail}</a>}
          {companyWeb   && <a href={companyWeb.startsWith('http') ? companyWeb : `https://${companyWeb}`} className="hover:text-white">{companyWeb}</a>}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* ── Proposal Title ─────────────────────────────────────────────── */}
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

          {/* Prepared for */}
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

        {/* ── Line Items ─────────────────────────────────────────────────── */}
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
                  const total = runningTotal(item.sort_order ?? 0);
                  return (
                    <div key={`sub-${item.id}`} className="py-2 flex items-center justify-between border-t-2 border-gray-300 mt-1">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Running Subtotal</span>
                      <span className="text-sm font-bold text-gray-800">{fmt(total)}</span>
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
                        {item.breakout_price ? (
                          <p className="font-semibold text-gray-900 text-sm">{fmt(item.line_total)}</p>
                        ) : (
                          <p className="text-sm text-gray-400 italic">Included</p>
                        )}
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

        {/* ── Totals ─────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm px-5 py-5 space-y-2">
          {discountTotal > 0 && (
            <>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span><span>{fmt(preDiscount)}</span>
              </div>
              {discounts.map(d => {
                const val = parseFloat(d.discount_value) || 0;
                const amt = d.discount_type === 'dollar' ? val : preDiscount * (val / 100);
                return (
                  <div key={d.id} className="flex justify-between text-sm text-red-600">
                    <span>{d.description || 'Discount'}</span><span>-{fmt(amt)}</span>
                  </div>
                );
              })}
            </>
          )}
          <div className="flex justify-between font-bold text-lg border-t border-gray-200 pt-2">
            <span>Total</span><span>{fmt(bidTotal)}</span>
          </div>
        </div>

        {/* ── Payment Schedule ───────────────────────────────────────────── */}
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

        {/* ── System Notes ───────────────────────────────────────────────── */}
        {systemNotes && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4">
            <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-2">Notes</p>
            <p className="text-sm text-blue-900 whitespace-pre-line">{systemNotes}</p>
          </div>
        )}

        {/* ── Customer Notes ─────────────────────────────────────────────── */}
        {proposal.customer_notes && (
          <div className="bg-white rounded-2xl shadow-sm px-5 py-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Additional Notes</p>
            <p className="text-sm text-gray-700 whitespace-pre-line">{proposal.customer_notes}</p>
          </div>
        )}

        {/* ── Terms & Conditions ─────────────────────────────────────────── */}
        {termsText && (
          <div className="bg-white rounded-2xl shadow-sm px-5 py-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Terms &amp; Conditions</p>
            <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg px-4 py-3">
              <p className="text-xs text-gray-600 whitespace-pre-line leading-relaxed">{termsText}</p>
            </div>
          </div>
        )}

        {/* ── Sign / Already Signed ──────────────────────────────────────── */}
        {signed ? (
          <div className="bg-green-50 border border-green-300 rounded-2xl px-5 py-6 text-center">
            <div className="text-4xl mb-2">✅</div>
            <h3 className="text-lg font-bold text-green-800 mb-1">Proposal Accepted</h3>
            <p className="text-green-700 text-sm">
              Signed by <strong>{signedBy}</strong>
              {signedAt && ` on ${new Date(signedAt).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}`}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm px-5 py-6">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Accept &amp; Sign</p>

            {termsText && (
              <label className="flex items-start gap-3 mb-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={e => setAgreed(e.target.checked)}
                  className="mt-0.5 w-5 h-5 accent-blue-600 shrink-0"
                />
                <span className="text-sm text-gray-700">
                  I have read and agree to the Terms &amp; Conditions above.
                </span>
              </label>
            )}

            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Type your full name to sign
              </label>
              <input
                type="text"
                value={sigName}
                onChange={e => setSigName(e.target.value)}
                placeholder="Full Name"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>

            {submitErr && (
              <p className="text-red-500 text-sm mb-3">{submitErr}</p>
            )}

            <button
              onClick={handleSign}
              disabled={signing}
              className="w-full py-4 bg-green-600 text-white font-bold text-base rounded-xl hover:bg-green-700 disabled:opacity-50 transition"
            >
              {signing ? 'Submitting…' : 'Accept This Proposal'}
            </button>

            <p className="text-xs text-gray-400 text-center mt-3">
              By signing, you agree to the terms of this proposal. Your electronic signature is legally binding.
            </p>
          </div>
        )}

        {/* ── Payment Button ─────────────────────────────────────────────── */}
        {showPayButton && (
          <a
            href={payUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-4 bg-blue-600 text-white font-bold text-base rounded-2xl text-center hover:bg-blue-700 transition shadow"
          >
            Make Your Payment
          </a>
        )}

        <div className="pb-8 text-center text-xs text-gray-400">
          {companyName}{companyPhone ? ` · ${companyPhone}` : ''}
        </div>

      </div>
    </div>
  );
}
