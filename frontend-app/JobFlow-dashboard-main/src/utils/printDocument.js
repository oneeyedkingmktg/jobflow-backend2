// ============================================================================
// File: src/utils/printDocument.js
// Generates print-ready HTML for proposals and invoices
// ============================================================================

function fmt(n) {
  const v = parseFloat(n) || 0;
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d) {
  const date = d ? new Date(d + (d.length === 10 ? 'T12:00:00' : '')) : new Date();
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function calcAmt(ps, bidTotal) {
  const type = ps._type || ps.amount_type;
  const val  = parseFloat(ps._val ?? ps.amount_value) || 0;
  return type === 'dollar' ? val : bidTotal * (val / 100);
}

// ── Shared CSS ──────────────────────────────────────────────────────────────
const BASE_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; color: #000; background: #fff; }
  a { color: #1a56db; text-decoration: underline; }
  a:visited { color: #1a56db; }
  .page { max-width: 750px; margin: 0 auto; padding: 40px; }

  /* Header */
  .doc-header { display: flex; justify-content: space-between; align-items: flex-start;
    border-bottom: 2px solid #000; padding-bottom: 18px; margin-bottom: 24px; }
  .company-name { font-size: 16pt; font-weight: bold; margin-bottom: 4px; }
  .company-detail { font-size: 10.5pt; line-height: 1.6; }
  .doc-title { font-size: 24pt; font-weight: bold; letter-spacing: 3px; text-transform: uppercase;
    text-align: right; }
  .doc-meta { text-align: right; font-size: 10.5pt; line-height: 1.7; margin-top: 6px; }

  /* To / Bill To block */
  .addr-block { margin-bottom: 22px; }
  .addr-label { font-size: 8.5pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px;
    color: #666; margin-bottom: 5px; }
  .addr-name  { font-size: 13pt; font-weight: bold; }
  .addr-line  { font-size: 10.5pt; line-height: 1.6; }

  /* Bid title */
  .bid-title  { font-size: 13pt; font-weight: bold; margin-bottom: 4px; }
  .bid-sub    { font-size: 10.5pt; color: #555; margin-bottom: 16px; }

  /* Items table */
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th { background: #1a1a1a; color: #fff; padding: 8px 10px; font-size: 9.5pt;
    text-transform: uppercase; letter-spacing: 0.5px; }
  th.r, td.r { text-align: right; }
  td { padding: 8px 10px; border-bottom: 1px solid #ddd; font-size: 11pt; vertical-align: top; }
  .item-desc { font-size: 9.5pt; color: #555; margin-top: 2px; }
  .included   { font-style: italic; color: #777; font-size: 9.5pt; }

  /* Totals */
  .totals-wrap { display: flex; justify-content: flex-end; margin-bottom: 20px; }
  .totals-inner { min-width: 280px; }
  .tot-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 11pt; }
  .tot-row.discount { color: #b00; }
  .tot-row.grand { font-size: 13pt; font-weight: bold; border-top: 2px solid #000;
    margin-top: 6px; padding-top: 8px; }

  /* Payment schedule */
  .section-label { font-size: 9pt; font-weight: bold; text-transform: uppercase;
    letter-spacing: 1.5px; color: #555; margin: 20px 0 8px; }
  .pay-row { display: flex; justify-content: space-between; padding: 5px 0;
    border-bottom: 1px solid #e8e8e8; font-size: 11pt; }
  .pay-balance { display: flex; justify-content: space-between; font-size: 12pt;
    font-weight: bold; border-top: 2px solid #000; padding-top: 8px; margin-top: 4px; }

  /* Notes */
  .notes-box { border: 1px solid #ccc; padding: 12px 14px; font-size: 11pt;
    line-height: 1.7; white-space: pre-line; margin-bottom: 18px; }

  /* Signature */
  .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 28px; }
  .sig-line-wrap { margin-top: 18px; }
  .sig-line { border-top: 1px solid #000; padding-top: 5px; font-size: 9.5pt; color: #555; }

  /* Invoice amount box */
  .inv-amount-box { border: 2px solid #000; padding: 16px 20px; margin: 16px 0; }
  .inv-amount-label { font-size: 9pt; font-weight: bold; text-transform: uppercase;
    letter-spacing: 1px; color: #666; margin-bottom: 6px; }
  .inv-amount-value { font-size: 26pt; font-weight: bold; }
  .inv-amount-detail { font-size: 10pt; color: #555; margin-top: 3px; }

  /* Pay URL */
  .pay-url-box { background: #f5f5f5; border: 1px solid #ccc; padding: 10px 14px;
    font-size: 10.5pt; margin-top: 14px; }

  /* Footer */
  .doc-footer { margin-top: 36px; border-top: 1px solid #ccc; padding-top: 8px;
    font-size: 8.5pt; color: #888; text-align: center; }

  /* Install info */
  .install-row { font-size: 10.5pt; margin-bottom: 14px; }

  @media print {
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    @page { margin: 0.5in; size: letter; }
  }
`;

// ── Helpers ─────────────────────────────────────────────────────────────────

function openPrintWindow(html) {
  // In Capacitor iOS/Android, window.open is blocked — use Browser plugin instead
  if (window.Capacitor?.isNative) {
    import('@capacitor/browser').then(({ Browser }) => {
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      Browser.open({ url, presentationStyle: 'popover' });
    });
    return;
  }
  const w = window.open('', '_blank');
  if (!w) { alert('Please allow pop-ups to print documents.'); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 600);
}

function companyBlock(company) {
  const name    = company?.ghlCompanyFromName || company?.companyName || company?.name || '';
  const phone   = company?.ghlCompanyPhone    || company?.phone   || '';
  const email   = company?.ghlCompanyFromEmail || company?.email  || '';
  const street  = company?.ghlCompanyStreetAddress || '';
  const city    = company?.ghlCompanyCity     || '';
  const website = company?.ghlCompanyWebsite  || '';

  const lines = [`<div class="company-name">${name}</div>`, '<div class="company-detail">'];
  if (street) lines.push(`${street}${city ? ', ' + city : ''}<br>`);
  if (phone)  lines.push(`${phone}<br>`);
  if (email)  lines.push(`${email}<br>`);
  if (website)lines.push(`<a href="${website.startsWith('http') ? website : 'https://' + website}">${website}</a><br>`);
  lines.push('</div>');
  return lines.join('');
}

function companyFooterText(company) {
  const name   = company?.ghlCompanyFromName || company?.companyName || company?.name || '';
  const phone  = company?.ghlCompanyPhone    || company?.phone   || '';
  const email  = company?.ghlCompanyFromEmail || company?.email  || '';
  return [name, phone, email].filter(Boolean).join('  ·  ');
}

function clientBlock(lead, label) {
  const addrParts = [lead.address, lead.city, lead.state, lead.zip].filter(Boolean);
  return `
    <div class="addr-block">
      <div class="addr-label">${label}</div>
      <div class="addr-name">${lead.name || lead.fullName || ''}</div>
      ${addrParts.length ? `<div class="addr-line">${addrParts.join(', ')}</div>` : ''}
      ${lead.phone ? `<div class="addr-line">${lead.phone}</div>` : ''}
      ${lead.email ? `<div class="addr-line">${lead.email}</div>` : ''}
    </div>`;
}

function docShell(title, docNum, dateStr, extraMeta, companyHtml, body) {
  return `<!DOCTYPE html><html lang="en"><head>
    <meta charset="utf-8">
    <title>${title} ${docNum}</title>
    <style>${BASE_STYLES}</style>
  </head><body><div class="page">
    <div class="doc-header">
      <div>${companyHtml}</div>
      <div>
        <div class="doc-title">${title}</div>
        <div class="doc-meta">
          <strong>#${docNum}</strong><br>
          ${dateStr}
          ${extraMeta}
        </div>
      </div>
    </div>
    ${body}
  </div></body></html>`;
}

// ── PROPOSAL ─────────────────────────────────────────────────────────────────

export function printProposal({
  proposal, checkedMap, customItems, discounts, paySchedule,
  lead, company, bidTotal, preDiscountTotal, discountTotal, balanceDue,
  proposalTopText = '',
}) {
  const docNum  = `PRO-${String(proposal.id).padStart(4, '0')}`;
  const docDate = `Date: ${fmtDate(proposal.presented_date)}`;
  const extra   = proposal.salesman ? `<br>Prepared by: ${proposal.salesman}` : '';

  // Merge library items + custom items into one sorted list
  const libEntries = Object.entries(checkedMap).map(([, pi]) => ({ ...pi, _type: 'lib' }));
  const allItems = [...libEntries, ...customItems]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const runningTotal = (upToSortOrder) =>
    [...libEntries, ...customItems.filter(i => !i.is_subtotal)]
      .filter(i => (i.sort_order ?? 0) < upToSortOrder)
      .reduce((a, i) => a + (parseFloat(i.line_total) || 0), 0);

  const allRows = allItems.map(item => {
    if (item.is_subtotal) {
      const total = runningTotal(item.sort_order ?? 0);
      return `<tr>
        <td colspan="3" style="text-align:right;font-weight:bold;font-size:10.5pt;border-top:2px solid #aaa;padding-top:8px;color:#444">Running Subtotal</td>
        <td class="r" style="font-weight:bold;border-top:2px solid #aaa;padding-top:8px">${fmt(total)}</td>
      </tr>`;
    }
    if (item._type === 'lib') {
      const showPrice = !!item.breakout_price;
      const qty = Math.round(item._qty ?? item.quantity ?? 1);
      return `<tr>
        <td>
          <div>${item.name}</div>
          ${item._desc || item.description ? `<div class="item-desc">${item._desc || item.description}</div>` : ''}
        </td>
        <td class="r">${showPrice ? qty : ''}</td>
        <td class="r">${showPrice ? fmt(item._price ?? item.unit_price) : ''}</td>
        <td class="r">${showPrice ? fmt(item.line_total) : '<span class="included">Included</span>'}</td>
      </tr>`;
    }
    // Custom line item
    const qty = Math.round(item._qty ?? item.quantity ?? 1);
    return `<tr>
      <td>${item._desc || item.description || ''}</td>
      <td class="r">${qty}</td>
      <td class="r">${fmt(item._price ?? item.price_each)}</td>
      <td class="r">${fmt(item.line_total)}</td>
    </tr>`;
  }).join('');

  const discountRows = discounts.map(d => {
    const type = d._type || d.discount_type;
    const val  = parseFloat(d._val ?? d.discount_value) || 0;
    const amt  = type === 'dollar' ? val : preDiscountTotal * (val / 100);
    const name = d._desc || d.description || 'Discount';
    return `<tr>
      <td colspan="3" style="text-align:right;color:#b00;font-size:10.5pt">${name}</td>
      <td class="r" style="color:#b00">-${fmt(amt)}</td>
    </tr>`;
  }).join('');

  const totalsHtml = `
    <div class="totals-wrap"><div class="totals-inner">
      <div class="tot-row"><span>Subtotal</span><span>${fmt(preDiscountTotal)}</span></div>
      ${discountTotal > 0 ? `<div class="tot-row discount"><span>Discounts</span><span>-${fmt(discountTotal)}</span></div>` : ''}
      <div class="tot-row grand"><span>Bid Total</span><span>${fmt(bidTotal)}</span></div>
    </div></div>`;

  const payHtml = paySchedule.length > 0 ? `
    <div class="section-label">Payment Schedule</div>
    ${paySchedule.map((ps, i) => {
      const amt   = calcAmt(ps, bidTotal);
      const label = ps._desc || ps.description || `Payment ${i + 1}`;
      return `<div class="pay-row"><span>${label}</span><span>${fmt(amt)}</span></div>`;
    }).join('')}
    <div class="pay-balance"><span>Balance Due</span><span>${fmt(balanceDue)}</span></div>
  ` : '';

  const notesHtml = proposal.customer_notes ? `
    <div class="section-label">Notes</div>
    <div class="notes-box">${proposal.customer_notes}</div>` : '';

  const installHtml = proposal.install_date_tbd
    ? `<div class="install-row"><strong>Install Date:</strong> TBD</div>`
    : proposal.install_date
    ? `<div class="install-row"><strong>Install Date:</strong> ${fmtDate(proposal.install_date)}</div>`
    : '';

  const body = `
    ${clientBlock(lead, 'Prepared For')}
    ${proposalTopText ? `<div style="font-size:11pt;line-height:1.7;margin-bottom:14px;white-space:pre-line">${proposalTopText}</div>` : ''}

    <div class="bid-title">${proposal.bid_name || 'Proposal'}</div>
    ${proposal.bid_description ? `<div class="bid-sub">${proposal.bid_description}</div>` : '<div style="margin-bottom:14px"></div>'}

    ${installHtml}

    <table>
      <thead><tr>
        <th style="width:48%">Description</th>
        <th class="r" style="width:8%">Qty</th>
        <th class="r" style="width:20%">Unit Price</th>
        <th class="r" style="width:24%">Total</th>
      </tr></thead>
      <tbody>${allRows}${discountRows}</tbody>
    </table>

    ${totalsHtml}
    ${payHtml}
    ${notesHtml}

    <div class="section-label">Acceptance</div>
    <div style="font-size:10.5pt;margin-bottom:16px;line-height:1.6;">
      By signing below, I/we accept the terms of this proposal and authorize the work described above.
    </div>
    <div class="sig-grid">
      <div><div class="sig-line-wrap"><div class="sig-line">Customer Signature</div></div></div>
      <div><div class="sig-line-wrap"><div class="sig-line">Date</div></div></div>
      <div style="margin-top:20px"><div class="sig-line-wrap"><div class="sig-line">Printed Name</div></div></div>
    </div>

    <div class="doc-footer">${companyFooterText(company)}</div>`;

  openPrintWindow(docShell('Proposal', docNum, docDate, extra, companyBlock(company), body));
}

// ── PAYMENT INVOICE ───────────────────────────────────────────────────────────

export function printPaymentInvoice({ proposal, payEntry, payIdx, lead, company, bidTotal, invoiceTopText = '' }) {
  const amt    = calcAmt(payEntry, bidTotal);
  const type   = payEntry._type || payEntry.amount_type;
  const val    = parseFloat(payEntry._val ?? payEntry.amount_value) || 0;
  const label  = payEntry._desc || payEntry.description || `Payment ${payIdx + 1}`;
  const detail = type === 'percent' ? `${val}% of ${fmt(bidTotal)}` : '';
  const docNum = `INV-${String(proposal.id).padStart(4, '0')}-${payIdx + 1}`;
  const docDate = `Date: ${fmtDate(null)}`;

  const rawPayUrl = (proposal.payment_url || '').trim();
  const payUrl = rawPayUrl && !rawPayUrl.startsWith('http') ? `https://${rawPayUrl}` : rawPayUrl;

  const body = `
    ${clientBlock(lead, 'Bill To')}
    ${invoiceTopText ? `<div style="font-size:11pt;line-height:1.7;margin-bottom:14px;white-space:pre-line">${invoiceTopText}</div>` : ''}

    <div style="font-size:10.5pt;margin-bottom:18px;">
      <strong>Invoice for:</strong> ${proposal.bid_name || ''} — ${lead.name || lead.fullName || ''}
    </div>

    <table>
      <thead><tr><th>Description</th><th class="r">Amount</th></tr></thead>
      <tbody>
        <tr>
          <td>
            <div>${label}</div>
            ${detail ? `<div class="item-desc">${detail}</div>` : ''}
          </td>
          <td class="r">${fmt(amt)}</td>
        </tr>
      </tbody>
    </table>

    <div class="totals-wrap"><div class="totals-inner">
      <div class="tot-row grand"><span>Amount Due</span><span>${fmt(amt)}</span></div>
    </div></div>

    ${payUrl && proposal.include_payment_button ? `
      <div class="pay-url-box"><strong>Pay Online:</strong> <a href="${payUrl}">${payUrl}</a></div>` : ''}

    <div style="margin-top:22px;font-size:10.5pt;color:#555;">
      Please make checks payable to <strong>${company?.ghlCompanyFromName || company?.companyName || company?.name || ''}</strong>.
    </div>

    <div class="doc-footer">${companyFooterText(company)}</div>`;

  openPrintWindow(docShell('Invoice', docNum, docDate, '', companyBlock(company), body));
}

// ── FINAL INVOICE ─────────────────────────────────────────────────────────────

export function printFinalInvoice({ proposal, paySchedule, lead, company, bidTotal, balanceDue, invoiceTopText = '' }) {
  const docNum  = `INV-${String(proposal.id).padStart(4, '0')}-F`;
  const docDate = `Date: ${fmtDate(null)}`;
  const rawPayUrlF = (proposal.payment_url || '').trim();
  const payUrl  = rawPayUrlF && !rawPayUrlF.startsWith('http') ? `https://${rawPayUrlF}` : rawPayUrlF;

  const prevPayRows = paySchedule.map((ps, i) => {
    const amt   = calcAmt(ps, bidTotal);
    const label = ps._desc || ps.description || `Payment ${i + 1}`;
    return `<tr>
      <td style="color:#555">${label} <em style="font-size:9.5pt">(previously invoiced)</em></td>
      <td class="r" style="color:#555">-${fmt(amt)}</td>
    </tr>`;
  }).join('');

  const body = `
    ${clientBlock(lead, 'Bill To')}
    ${invoiceTopText ? `<div style="font-size:11pt;line-height:1.7;margin-bottom:14px;white-space:pre-line">${invoiceTopText}</div>` : ''}

    <div style="font-size:10.5pt;margin-bottom:18px;">
      <strong>Invoice for:</strong> ${proposal.bid_name || ''} — ${lead.name || lead.fullName || ''}
    </div>

    <table>
      <thead><tr><th>Description</th><th class="r">Amount</th></tr></thead>
      <tbody>
        <tr><td><strong>Bid Total</strong></td><td class="r">${fmt(bidTotal)}</td></tr>
        ${prevPayRows}
      </tbody>
    </table>

    <div class="totals-wrap"><div class="totals-inner">
      <div class="tot-row grand"><span>Balance Due</span><span>${fmt(balanceDue)}</span></div>
    </div></div>

    ${payUrl && proposal.include_payment_button ? `
      <div class="pay-url-box"><strong>Pay Online:</strong> <a href="${payUrl}">${payUrl}</a></div>` : ''}

    <div style="margin-top:22px;font-size:10.5pt;color:#555;">
      Please make checks payable to <strong>${company?.ghlCompanyFromName || company?.companyName || company?.name || ''}</strong>.
    </div>

    <div class="doc-footer">${companyFooterText(company)}</div>`;

  openPrintWindow(docShell('Invoice', docNum, docDate, '<br><span style="color:#b00;font-weight:bold">Final Balance</span>', companyBlock(company), body));
}
