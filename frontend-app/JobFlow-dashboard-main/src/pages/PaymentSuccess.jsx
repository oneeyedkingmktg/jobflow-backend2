import React, { useEffect, useState } from 'react';

function fmt(cents) {
  const v = (parseInt(cents, 10) || 0) / 100;
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PaymentSuccess({ proposalId }) {
  const [data, setData] = useState(null);

  const params     = new URLSearchParams(window.location.search);
  const amountCents = params.get('amount') || '0';
  const payLabel   = params.get('label') || 'Payment';

  useEffect(() => {
    const apiBase = import.meta.env.APP_URL || import.meta.env.VITE_API_URL;

    fetch(`${apiBase}/api/bidder/public/${proposalId}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setData(d))
      .catch(() => {});

    // Send confirmation emails once per session
    const emailKey = `pay_email_${proposalId}_${amountCents}`;
    if (!sessionStorage.getItem(emailKey)) {
      fetch(`${apiBase}/api/bidder/public/${proposalId}/payment-received`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_cents: parseInt(amountCents, 10), pay_label: payLabel }),
      })
        .then(() => sessionStorage.setItem(emailKey, '1'))
        .catch(() => {});
    }
  }, [proposalId]);

  const proposal     = data?.proposal;
  const companyName  = proposal?.company_name_db || proposal?.ghl_company_from_name || proposal?.ghl_company_name || '';
  const companyWeb   = proposal?.company_website_db || proposal?.ghl_company_website || '';
  const designId     = proposal?.proposal_design_id || proposal?.preferred_proposal_design_id;
  const AC           = (designId && proposal?.design_accent_color)  ? proposal.design_accent_color  : null;
  const HBG          = (designId && proposal?.design_primary_color) ? proposal.design_primary_color : null;
  const logoSrc      = proposal?.logo_url || null;
  const websiteUrl   = companyWeb
    ? (companyWeb.startsWith('http') ? companyWeb : `https://${companyWeb}`)
    : null;

  const checkIcon = (
    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
    </svg>
  );

  // ── Styled (theme colors) ───────────────────────────────────────────────────
  if (HBG && AC) {
    return (
      <div className="min-h-screen bg-gray-100">

        {/* Header */}
        <div style={{ background: HBG }}>
          <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-5">
            {logoSrc && <img src={logoSrc} alt={companyName} className="max-h-12 max-w-[120px] object-contain flex-shrink-0" />}
            <div className="text-xl font-black text-white tracking-wide">{companyName}</div>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-4 py-12">
          <div className="bg-white rounded-2xl shadow-sm px-8 py-10 text-center">

            {/* Check circle */}
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: AC }}>
              {checkIcon}
            </div>

            <h1 className="text-2xl font-black mb-2" style={{ color: HBG }}>Payment Received</h1>
            <p className="text-4xl font-black mb-1" style={{ color: AC }}>{fmt(amountCents)}</p>
            <p className="text-sm mb-1" style={{ color: HBG }}>{payLabel}</p>
            <p className="text-gray-400 text-sm mb-8">
              Your payment has been processed successfully. A confirmation email has been sent to you.
            </p>

            {websiteUrl && (
              <a
                href={websiteUrl}
                className="inline-block px-8 py-3 text-white font-bold rounded-xl transition"
                style={{ background: HBG }}
              >
                Return to {companyName || 'Website'}
              </a>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ background: HBG }} className="mt-4">
          <div className="max-w-2xl mx-auto py-4 px-4 text-center">
            <p className="text-sm font-semibold" style={{ color: AC }}>
              ★ Thank you for your business!
            </p>
          </div>
        </div>

      </div>
    );
  }

  // ── Classic (blue) ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-100">

      <div className="bg-blue-700 text-white">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold">{companyName}</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl shadow-sm px-8 py-10 text-center">

          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-5">
            {checkIcon}
          </div>

          <h1 className="text-2xl font-black text-gray-900 mb-2">Payment Received</h1>
          <p className="text-4xl font-black text-blue-700 mb-1">{fmt(amountCents)}</p>
          <p className="text-sm text-gray-500 mb-1">{payLabel}</p>
          <p className="text-gray-400 text-sm mb-8">
            Your payment has been processed successfully. A confirmation email has been sent to you.
          </p>

          {websiteUrl && (
            <a
              href={websiteUrl}
              className="inline-block px-8 py-3 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl transition"
            >
              Return to {companyName || 'Website'}
            </a>
          )}
        </div>
      </div>

    </div>
  );
}
