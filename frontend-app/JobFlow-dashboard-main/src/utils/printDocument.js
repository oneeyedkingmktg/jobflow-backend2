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

import { Capacitor } from '@capacitor/core';

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
  // In Capacitor iOS/Android, inject a full-screen overlay then call window.print()
  if (Capacitor.isNativePlatform()) {
    const existing = document.getElementById('__print_overlay__');
    if (existing) existing.remove();
    document.getElementById('__print_overlay_style__')?.remove();

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const docStyle = doc.querySelector('style')?.textContent || '';

    const styleEl = document.createElement('style');
    styleEl.id = '__print_overlay_style__';
    styleEl.textContent = docStyle + `
      @media print {
        body > *:not(#__print_overlay__) { display: none !important; }
        #__print_overlay__ { position: static !important; overflow: visible !important; }
      }
    `;
    document.head.appendChild(styleEl);

    const overlay = document.createElement('div');
    overlay.id = '__print_overlay__';
    overlay.style.cssText = 'position:fixed;inset:0;background:white;z-index:99999;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:20px;';
    overlay.innerHTML = doc.body.innerHTML;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕ Close';
    closeBtn.style.cssText = 'position:sticky;top:0;float:right;background:#333;color:white;border:none;padding:8px 14px;border-radius:6px;font-size:16px;z-index:1;cursor:pointer;';
    closeBtn.onclick = () => { overlay.remove(); styleEl.remove(); };
    overlay.prepend(closeBtn);

    const printBtn = document.createElement('button');
    printBtn.textContent = '🖨 Print';
    printBtn.style.cssText = 'position:sticky;top:0;float:right;margin-right:8px;background:#1d4ed8;color:white;border:none;padding:8px 14px;border-radius:6px;font-size:16px;z-index:1;cursor:pointer;';
    printBtn.onclick = () => window.print();
    overlay.prepend(printBtn);

    document.body.appendChild(overlay);
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

// ── STYLED PROPOSAL — shared renderer (V2=charcoal/orange, V3=blue/gold) ─────

function printProposalV2(args) {
  return _printProposalStyled({ ...args, AC: '#f97316', HBG: '#1c2333' });
}

function printProposalV3(args) {
  return _printProposalStyled({ ...args, AC: '#FFC133', HBG: '#1E73BE' });
}

function _printProposalStyled({
  proposal, checkedMap, customItems, discounts, paySchedule,
  lead, company, bidTotal, preDiscountTotal, discountTotal, balanceDue,
  logoUrl = '', userName = '', AC, HBG,
}) {
  const docNum  = `PRO-${String(proposal.id + 121).padStart(4, '0')}`;
  const docDate = fmtDate(proposal.presented_date);

  const coName    = company?.companyName || company?.name || company?.ghlCompanyFromName || '';
  const coPhone   = company?.phone   || company?.ghlCompanyPhone    || '';
  const coStreet  = company?.address || company?.ghlCompanyStreetAddress || '';
  const coCity    = company?.city    || company?.ghlCompanyCity     || '';
  const coState   = company?.state   || company?.ghlCompanyState   || '';
  const coZip     = company?.zip     || company?.ghlCompanyZip     || '';
  const coWebsite = company?.website || company?.ghlCompanyWebsite  || '';
  const coAddr    = [coStreet, coCity, coState, coZip].filter(Boolean).join(', ');
  const custAddr  = [lead.address, lead.city, lead.state, lead.zip].filter(Boolean).join(', ');

  const logoHtml = logoUrl
    ? `<div style="display:flex;align-items:center;gap:14px;">
        <img src="${logoUrl}" alt="${coName}" style="max-height:64px;max-width:150px;object-fit:contain;">
        <span style="font-size:16pt;font-weight:900;color:#fff;letter-spacing:0.3px;line-height:1.2;">${coName}</span>
      </div>`
    : `<span style="font-size:18pt;font-weight:900;color:#fff;letter-spacing:0.5px;">${coName}</span>`;

  const libEntries = Object.entries(checkedMap).map(([, pi]) => ({ ...pi, _type: 'lib' }));
  const allItems   = [...libEntries, ...customItems]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const runningTotal = (upTo) =>
    [...libEntries, ...customItems.filter(i => !i.is_subtotal)]
      .filter(i => (i.sort_order ?? 0) < upTo)
      .reduce((a, i) => a + (parseFloat(i.line_total) || 0), 0);

  const TD  = 'padding:9px 12px;border-bottom:1px solid #efefef;vertical-align:top;font-size:10.5pt;';
  const TDR = TD + 'text-align:right;';

  const rows = allItems.map(item => {
    if (item.is_subtotal) {
      const t = runningTotal(item.sort_order ?? 0);
      return `<tr style="background:#f0f2f5;">
        <td colspan="3" style="${TDR}font-size:9pt;color:#666;font-weight:700;border-top:2px solid #ccc;">Running Subtotal</td>
        <td style="${TDR}font-weight:700;border-top:2px solid #ccc;">${fmt(t)}</td>
      </tr>`;
    }
    if (item._type === 'lib') {
      const show = !!item.breakout_price;
      const qty  = Math.round(item._qty ?? item.quantity ?? 1);
      return `<tr>
        <td style="${TD}">
          <div style="font-weight:600;">${item.name}</div>
          ${(item._desc || item.description) ? `<div style="font-size:8.5pt;color:#888;margin-top:2px;">${item._desc || item.description}</div>` : ''}
        </td>
        <td style="${TDR}">${show ? qty : ''}</td>
        <td style="${TDR}">${show ? fmt(item._price ?? item.unit_price) : ''}</td>
        <td style="${TDR}">${show ? fmt(item.line_total) : '<em style="color:#bbb;font-size:9pt;">Included</em>'}</td>
      </tr>`;
    }
    const qty = Math.round(item._qty ?? item.quantity ?? 1);
    return `<tr>
      <td style="${TD}font-weight:600;">${item._desc || item.description || ''}</td>
      <td style="${TDR}">${qty}</td>
      <td style="${TDR}">${fmt(item._price ?? item.price_each)}</td>
      <td style="${TDR}">${fmt(item.line_total)}</td>
    </tr>`;
  }).join('');

  const discountRows = discounts.map(d => {
    const type = d._type || d.discount_type;
    const val  = parseFloat(d._val ?? d.discount_value) || 0;
    const amt  = type === 'dollar' ? val : preDiscountTotal * (val / 100);
    const lbl  = d._desc || d.description || 'Discount';
    const aDate = d._date || d.if_accepted_by || '';
    return `<tr style="color:#c0392b;">
      <td colspan="3" style="${TDR}font-size:10pt;">
        ${lbl}${aDate ? `<div style="font-size:8pt;margin-top:2px;">If accepted by ${fmtDate(aDate)}</div>` : ''}
      </td>
      <td style="${TDR}">-${fmt(amt)}</td>
    </tr>`;
  }).join('');

  let investRows = '';
  if (discountTotal > 0) {
    investRows += `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.1);">
        <span style="font-size:9.5pt;color:#ccc;">Subtotal</span>
        <span style="color:#ccc;font-weight:600;">${fmt(preDiscountTotal)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.1);">
        <span style="font-size:9.5pt;color:#ccc;">Discounts</span>
        <span style="color:#ef4444;font-weight:600;">-${fmt(discountTotal)}</span>
      </div>`;
  }
  investRows += `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.15);">
      <span style="font-size:9.5pt;color:#ccc;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Total Project Cost</span>
      <span style="font-size:14pt;font-weight:900;color:${AC};">${fmt(bidTotal)}</span>
    </div>`;
  paySchedule.forEach((ps, i) => {
    const amt   = calcAmt(ps, bidTotal);
    const label = ps._desc || ps.description || `Payment ${i + 1}`;
    investRows += `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.1);">
        <span style="font-size:9.5pt;color:#ccc;">${label}</span>
        <span style="font-size:12pt;font-weight:700;color:${AC};">${fmt(amt)}</span>
      </div>`;
  });
  investRows += `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;margin-top:3px;">
      <span style="font-size:9.5pt;color:#ccc;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Balance Due</span>
      <span style="font-size:14pt;font-weight:900;color:${AC};">${fmt(balanceDue)}</span>
    </div>`;

  const SEC_HEAD = (label) => `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
      <div style="width:4px;height:18px;background:${AC};border-radius:2px;flex-shrink:0;"></div>
      <span style="font-size:9pt;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:${HBG};">${label}</span>
    </div>`;

  const notesHtml = proposal.customer_notes ? `
    <div style="padding:16px 36px 0;">${SEC_HEAD('Notes')}
      <p style="font-size:10.5pt;line-height:1.7;white-space:pre-line;color:#444;">${proposal.customer_notes}</p>
    </div>` : '';

  const termsHtml = proposal.terms_and_conditions ? `
    <div style="padding:16px 36px 0;">${SEC_HEAD('Terms &amp; Conditions')}
      <p style="font-size:8.5pt;color:#777;line-height:1.6;white-space:pre-line;">${proposal.terms_and_conditions}</p>
    </div>` : '';

  const installHtml = proposal.install_date_tbd
    ? `<p style="font-size:10pt;color:#555;margin-top:6px;"><strong>Install Date:</strong> TBD</p>`
    : proposal.install_date
    ? `<p style="font-size:10pt;color:#555;margin-top:6px;"><strong>Install Date:</strong> ${fmtDate(proposal.install_date)}</p>`
    : '';

  const html = `<!DOCTYPE html><html lang="en"><head>
    <meta charset="utf-8">
    <title>Proposal ${docNum}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #222; background: #fff; }
      .page { max-width: 780px; margin: 0 auto; }
      table { width: 100%; border-collapse: collapse; }
      table th { background: ${HBG}; color: #fff; padding: 8px 12px; font-size: 8.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; text-align: left; }
      table th.r { text-align: right; }
      table tr:nth-child(even) td { background: #fafafa; }
      @media print {
        body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        @page { margin: 0.35in; size: letter; }
      }
    </style>
  </head><body><div class="page">

    <div style="background:${HBG};display:flex;justify-content:space-between;align-items:center;padding:20px 36px;">
      <div>${logoHtml}</div>
      <div style="text-align:right;">
        <div style="font-size:26pt;font-weight:900;letter-spacing:4px;color:#fff;line-height:1;">PROPOSAL</div>
        <div style="font-size:8pt;color:${AC};letter-spacing:2px;margin-top:5px;text-transform:uppercase;">PREMIUM COATING. EXCEPTIONAL RESULTS.</div>
      </div>
    </div>

    <div style="background:#f4f5f7;display:flex;justify-content:space-between;align-items:center;padding:10px 36px;border-bottom:3px solid ${AC};">
      <div>
        <div style="font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#999;">Date</div>
        <div style="font-size:11.5pt;font-weight:700;color:${HBG};">${docDate || '—'}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#999;">Proposal No.</div>
        <div style="font-size:11.5pt;font-weight:700;color:${HBG};">${docNum}</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #e5e7eb;">
      <div style="padding:16px 36px;border-right:1px solid #e5e7eb;">
        <div style="font-size:7.5pt;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:${AC};margin-bottom:6px;">Prepared For:</div>
        <div style="font-size:12.5pt;font-weight:700;color:${HBG};margin-bottom:3px;">${lead.name || lead.fullName || ''}</div>
        ${custAddr    ? `<div style="font-size:9.5pt;color:#666;line-height:1.65;">${custAddr}</div>`    : ''}
        ${lead.phone  ? `<div style="font-size:9.5pt;color:#666;line-height:1.65;">${lead.phone}</div>`  : ''}
        ${lead.email  ? `<div style="font-size:9.5pt;color:#666;line-height:1.65;">${lead.email}</div>`  : ''}
      </div>
      <div style="padding:16px 36px;">
        <div style="font-size:7.5pt;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:${AC};margin-bottom:6px;">Prepared By:</div>
        <div style="font-size:12.5pt;font-weight:700;color:${HBG};margin-bottom:3px;">${coName}</div>
        ${coAddr    ? `<div style="font-size:9.5pt;color:#666;line-height:1.65;">${coAddr}</div>`    : ''}
        ${coPhone   ? `<div style="font-size:9.5pt;color:#666;line-height:1.65;">${coPhone}</div>`   : ''}
        ${coWebsite ? `<div style="font-size:9.5pt;color:#666;line-height:1.65;">${coWebsite}</div>` : ''}
        ${(userName || proposal.salesman) ? `<div style="font-size:9.5pt;color:#444;font-weight:600;line-height:1.65;">${userName || proposal.salesman}</div>` : ''}
      </div>
    </div>

    ${(proposal.bid_name || proposal.bid_description || installHtml) ? `
    <div style="padding:14px 36px 0;">
      ${proposal.bid_name        ? `<div style="font-size:13pt;font-weight:700;color:${HBG};margin-bottom:2px;">${proposal.bid_name}</div>`        : ''}
      ${proposal.bid_description ? `<div style="font-size:10pt;color:#777;">${proposal.bid_description}</div>` : ''}
      ${installHtml}
    </div>` : ''}

    <div style="padding:16px 36px 0;">
      ${SEC_HEAD('Scope of Work')}
      <table>
        <thead><tr>
          <th style="width:50%;">Description</th>
          <th class="r" style="width:8%;">Qty</th>
          <th class="r" style="width:18%;">Unit Price</th>
          <th class="r" style="width:24%;">Total</th>
        </tr></thead>
        <tbody>${rows}${discountRows}</tbody>
      </table>
    </div>

    <div style="padding:20px 36px;display:flex;justify-content:flex-end;">
      <div style="background:${HBG};border-radius:6px;padding:18px 24px;display:inline-block;min-width:300px;">
        <div style="font-size:8pt;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:${AC};margin-bottom:12px;">Investment Summary</div>
        ${investRows}
      </div>
    </div>

    ${notesHtml}
    ${termsHtml}

    <div style="background:${HBG};color:#fff;text-align:center;padding:16px 36px;margin-top:20px;">
      <span style="color:${AC};">★</span>
      <span style="font-size:9.5pt;letter-spacing:1px;margin-left:6px;">Thank you for the opportunity to earn your business!</span>
    </div>

  </div></body></html>`;

  openPrintWindow(html);
}

// ── STYLED INVOICE — shared renderer (V2=charcoal/orange, V3=blue/gold) ──────

function printPaymentInvoiceV2(args) {
  return _printPaymentInvoiceStyled({ ...args, AC: '#f97316', HBG: '#1c2333' });
}

function printPaymentInvoiceV3(args) {
  return _printPaymentInvoiceStyled({ ...args, AC: '#FFC133', HBG: '#1E73BE' });
}

function _printPaymentInvoiceStyled({ proposal, payEntry, payIdx, lead, company, bidTotal, logoUrl = '', userName = '', AC, HBG }) {
  const amt    = calcAmt(payEntry, bidTotal);
  const type   = payEntry._type || payEntry.amount_type;
  const val    = parseFloat(payEntry._val ?? payEntry.amount_value) || 0;
  const label  = payEntry._desc || payEntry.description || `Payment ${payIdx + 1}`;
  const detail = type === 'percent' ? `${val}% of ${fmt(bidTotal)}` : '';
  const docNum = `INV-${String(proposal.id + 121).padStart(4, '0')}-${payIdx + 1}`;
  const docDate = fmtDate(null);

  const coName    = company?.companyName || company?.name || company?.ghlCompanyFromName || '';
  const coPhone   = company?.phone   || company?.ghlCompanyPhone    || '';
  const coStreet  = company?.address || company?.ghlCompanyStreetAddress || '';
  const coCity    = company?.city    || company?.ghlCompanyCity     || '';
  const coState   = company?.state   || company?.ghlCompanyState   || '';
  const coZip     = company?.zip     || company?.ghlCompanyZip     || '';
  const coWebsite = company?.website || company?.ghlCompanyWebsite  || '';
  const coAddr    = [coStreet, coCity, coState, coZip].filter(Boolean).join(', ');
  const custAddr  = [lead.address, lead.city, lead.state, lead.zip].filter(Boolean).join(', ');

  const logoHtml = logoUrl
    ? `<div style="display:flex;align-items:center;gap:14px;">
        <img src="${logoUrl}" alt="${coName}" style="max-height:64px;max-width:150px;object-fit:contain;">
        <span style="font-size:16pt;font-weight:900;color:#fff;letter-spacing:0.3px;line-height:1.2;">${coName}</span>
      </div>`
    : `<span style="font-size:18pt;font-weight:900;color:#fff;letter-spacing:0.5px;">${coName}</span>`;

  const rawPayUrl = (proposal.payment_url || '').trim();
  const payUrl = rawPayUrl && !rawPayUrl.startsWith('http') ? `https://${rawPayUrl}` : rawPayUrl;

  const payUrlHtml = payUrl && proposal.include_payment_button ? `
    <div style="padding:20px 36px 0;">
      <a href="${payUrl}" style="display:block;background:${AC};color:#fff;text-align:center;padding:14px 24px;font-size:11pt;font-weight:700;border-radius:6px;text-decoration:none;letter-spacing:0.5px;">
        Make Your Payment Online
      </a>
      <div style="font-size:9pt;color:#999;text-align:center;margin-top:6px;">${payUrl}</div>
    </div>` : '';

  const html = `<!DOCTYPE html><html lang="en"><head>
    <meta charset="utf-8">
    <title>Invoice ${docNum}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #222; background: #fff; }
      .page { max-width: 780px; margin: 0 auto; }
      table { width: 100%; border-collapse: collapse; }
      table th { background: ${HBG}; color: #fff; padding: 8px 12px; font-size: 8.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; text-align: left; }
      table th.r { text-align: right; }
      table tr:nth-child(even) td { background: #fafafa; }
      @media print {
        body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        @page { margin: 0.35in; size: letter; }
      }
    </style>
  </head><body><div class="page">

    <div style="background:${HBG};display:flex;justify-content:space-between;align-items:center;padding:20px 36px;">
      <div>${logoHtml}</div>
      <div style="text-align:right;">
        <div style="font-size:26pt;font-weight:900;letter-spacing:4px;color:#fff;line-height:1;">INVOICE</div>
        <div style="font-size:8pt;color:${AC};letter-spacing:2px;margin-top:5px;text-transform:uppercase;">PREMIUM COATING. EXCEPTIONAL RESULTS.</div>
      </div>
    </div>

    <div style="background:#f4f5f7;display:flex;justify-content:space-between;align-items:center;padding:10px 36px;border-bottom:3px solid ${AC};">
      <div>
        <div style="font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#999;">Date</div>
        <div style="font-size:11.5pt;font-weight:700;color:${HBG};">${docDate}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#999;">Invoice No.</div>
        <div style="font-size:11.5pt;font-weight:700;color:${HBG};">${docNum}</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #e5e7eb;">
      <div style="padding:16px 36px;border-right:1px solid #e5e7eb;">
        <div style="font-size:7.5pt;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:${AC};margin-bottom:6px;">Bill To:</div>
        <div style="font-size:12.5pt;font-weight:700;color:${HBG};margin-bottom:3px;">${lead.name || lead.fullName || ''}</div>
        ${custAddr   ? `<div style="font-size:9.5pt;color:#666;line-height:1.65;">${custAddr}</div>`   : ''}
        ${lead.phone ? `<div style="font-size:9.5pt;color:#666;line-height:1.65;">${lead.phone}</div>` : ''}
        ${lead.email ? `<div style="font-size:9.5pt;color:#666;line-height:1.65;">${lead.email}</div>` : ''}
      </div>
      <div style="padding:16px 36px;">
        <div style="font-size:7.5pt;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:${AC};margin-bottom:6px;">From:</div>
        <div style="font-size:12.5pt;font-weight:700;color:${HBG};margin-bottom:3px;">${coName}</div>
        ${coAddr    ? `<div style="font-size:9.5pt;color:#666;line-height:1.65;">${coAddr}</div>`    : ''}
        ${coPhone   ? `<div style="font-size:9.5pt;color:#666;line-height:1.65;">${coPhone}</div>`   : ''}
        ${coWebsite ? `<div style="font-size:9.5pt;color:#666;line-height:1.65;">${coWebsite}</div>` : ''}
        ${(userName || proposal.salesman) ? `<div style="font-size:9.5pt;color:#444;font-weight:600;line-height:1.65;">${userName || proposal.salesman}</div>` : ''}
      </div>
    </div>

    <div style="padding:14px 36px 0;">
      <div style="font-size:10pt;color:#555;margin-bottom:14px;">
        <strong>Invoice for:</strong> ${proposal.bid_name || ''} — ${lead.name || lead.fullName || ''}
      </div>
    </div>

    <div style="padding:0 36px;">
      <table>
        <thead><tr>
          <th>Description</th>
          <th class="r" style="width:26%;">Amount</th>
        </tr></thead>
        <tbody>
          <tr>
            <td>
              <div style="font-weight:600;">${label}</div>
              ${detail ? `<div style="font-size:8.5pt;color:#888;margin-top:2px;">${detail}</div>` : ''}
            </td>
            <td style="text-align:right;font-weight:600;">${fmt(amt)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div style="padding:20px 36px;display:flex;justify-content:flex-end;">
      <div style="background:${HBG};border-radius:6px;padding:18px 24px;display:inline-block;min-width:260px;">
        <div style="font-size:8pt;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:${AC};margin-bottom:12px;">Amount Due</div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;">
          <span style="font-size:9.5pt;color:#ccc;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Total Due Now</span>
          <span style="font-size:18pt;font-weight:900;color:${AC};">${fmt(amt)}</span>
        </div>
      </div>
    </div>

    ${payUrlHtml}

    <div style="padding:20px 36px 0;font-size:10pt;color:#555;">
      Please make checks payable to <strong>${coName}</strong>.
    </div>

    <div style="background:${HBG};color:#fff;text-align:center;padding:16px 36px;margin-top:28px;">
      <span style="color:${AC};">★</span>
      <span style="font-size:9.5pt;letter-spacing:1px;margin-left:6px;">Thank you for your business!</span>
    </div>

  </div></body></html>`;

  openPrintWindow(html);
}

// ── STYLED FINAL INVOICE — shared renderer ────────────────────────────────────

function printFinalInvoiceV2(args) {
  return _printFinalInvoiceStyled({ ...args, AC: '#f97316', HBG: '#1c2333' });
}

function printFinalInvoiceV3(args) {
  return _printFinalInvoiceStyled({ ...args, AC: '#FFC133', HBG: '#1E73BE' });
}

function _printFinalInvoiceStyled({ proposal, paySchedule, lead, company, bidTotal, balanceDue, logoUrl = '', userName = '', AC, HBG }) {
  const docNum  = `INV-${String(proposal.id + 121).padStart(4, '0')}-F`;
  const docDate = fmtDate(null);

  const coName    = company?.companyName || company?.name || company?.ghlCompanyFromName || '';
  const coPhone   = company?.phone   || company?.ghlCompanyPhone    || '';
  const coStreet  = company?.address || company?.ghlCompanyStreetAddress || '';
  const coCity    = company?.city    || company?.ghlCompanyCity     || '';
  const coState   = company?.state   || company?.ghlCompanyState   || '';
  const coZip     = company?.zip     || company?.ghlCompanyZip     || '';
  const coWebsite = company?.website || company?.ghlCompanyWebsite  || '';
  const coAddr    = [coStreet, coCity, coState, coZip].filter(Boolean).join(', ');
  const custAddr  = [lead.address, lead.city, lead.state, lead.zip].filter(Boolean).join(', ');

  const logoHtml = logoUrl
    ? `<div style="display:flex;align-items:center;gap:14px;">
        <img src="${logoUrl}" alt="${coName}" style="max-height:64px;max-width:150px;object-fit:contain;">
        <span style="font-size:16pt;font-weight:900;color:#fff;letter-spacing:0.3px;line-height:1.2;">${coName}</span>
      </div>`
    : `<span style="font-size:18pt;font-weight:900;color:#fff;letter-spacing:0.5px;">${coName}</span>`;

  const rawPayUrl = (proposal.payment_url || '').trim();
  const payUrl = rawPayUrl && !rawPayUrl.startsWith('http') ? `https://${rawPayUrl}` : rawPayUrl;

  const payUrlHtml = payUrl && proposal.include_payment_button ? `
    <div style="padding:20px 36px 0;">
      <a href="${payUrl}" style="display:block;background:${AC};color:#fff;text-align:center;padding:14px 24px;font-size:11pt;font-weight:700;border-radius:6px;text-decoration:none;letter-spacing:0.5px;">
        Make Your Payment Online
      </a>
      <div style="font-size:9pt;color:#999;text-align:center;margin-top:6px;">${payUrl}</div>
    </div>` : '';

  const TD  = `padding:9px 12px;border-bottom:1px solid #efefef;vertical-align:top;font-size:10.5pt;`;
  const TDR = TD + 'text-align:right;';

  const prevPayRows = paySchedule.map((ps, i) => {
    const amt   = calcAmt(ps, bidTotal);
    const lbl   = ps._desc || ps.description || `Payment ${i + 1}`;
    return `<tr>
      <td style="${TD}color:#777;font-style:italic;">${lbl} <span style="font-size:8.5pt;">(previously invoiced)</span></td>
      <td style="${TDR}color:#777;">-${fmt(amt)}</td>
    </tr>`;
  }).join('');

  let investRows = `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.1);">
      <span style="font-size:9.5pt;color:#ccc;">Bid Total</span>
      <span style="color:#ccc;font-weight:600;">${fmt(bidTotal)}</span>
    </div>`;
  paySchedule.forEach((ps, i) => {
    const amt   = calcAmt(ps, bidTotal);
    const lbl   = ps._desc || ps.description || `Payment ${i + 1}`;
    investRows += `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.1);">
        <span style="font-size:9.5pt;color:#ccc;">${lbl}</span>
        <span style="color:#ef4444;font-weight:600;">-${fmt(amt)}</span>
      </div>`;
  });
  investRows += `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;margin-top:3px;">
      <span style="font-size:9.5pt;color:#ccc;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Balance Due</span>
      <span style="font-size:18pt;font-weight:900;color:${AC};">${fmt(balanceDue)}</span>
    </div>`;

  const html = `<!DOCTYPE html><html lang="en"><head>
    <meta charset="utf-8">
    <title>Final Invoice ${docNum}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #222; background: #fff; }
      .page { max-width: 780px; margin: 0 auto; }
      table { width: 100%; border-collapse: collapse; }
      table th { background: ${HBG}; color: #fff; padding: 8px 12px; font-size: 8.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; text-align: left; }
      table th.r { text-align: right; }
      table tr:nth-child(even) td { background: #fafafa; }
      @media print {
        body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        @page { margin: 0.35in; size: letter; }
      }
    </style>
  </head><body><div class="page">

    <div style="background:${HBG};display:flex;justify-content:space-between;align-items:center;padding:20px 36px;">
      <div>${logoHtml}</div>
      <div style="text-align:right;">
        <div style="font-size:26pt;font-weight:900;letter-spacing:4px;color:#fff;line-height:1;">INVOICE</div>
        <div style="font-size:8pt;color:${AC};letter-spacing:2px;margin-top:5px;text-transform:uppercase;">FINAL BALANCE</div>
      </div>
    </div>

    <div style="background:#f4f5f7;display:flex;justify-content:space-between;align-items:center;padding:10px 36px;border-bottom:3px solid ${AC};">
      <div>
        <div style="font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#999;">Date</div>
        <div style="font-size:11.5pt;font-weight:700;color:${HBG};">${docDate}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#999;">Invoice No.</div>
        <div style="font-size:11.5pt;font-weight:700;color:${HBG};">${docNum}</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #e5e7eb;">
      <div style="padding:16px 36px;border-right:1px solid #e5e7eb;">
        <div style="font-size:7.5pt;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:${AC};margin-bottom:6px;">Bill To:</div>
        <div style="font-size:12.5pt;font-weight:700;color:${HBG};margin-bottom:3px;">${lead.name || lead.fullName || ''}</div>
        ${custAddr   ? `<div style="font-size:9.5pt;color:#666;line-height:1.65;">${custAddr}</div>`   : ''}
        ${lead.phone ? `<div style="font-size:9.5pt;color:#666;line-height:1.65;">${lead.phone}</div>` : ''}
        ${lead.email ? `<div style="font-size:9.5pt;color:#666;line-height:1.65;">${lead.email}</div>` : ''}
      </div>
      <div style="padding:16px 36px;">
        <div style="font-size:7.5pt;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:${AC};margin-bottom:6px;">From:</div>
        <div style="font-size:12.5pt;font-weight:700;color:${HBG};margin-bottom:3px;">${coName}</div>
        ${coAddr    ? `<div style="font-size:9.5pt;color:#666;line-height:1.65;">${coAddr}</div>`    : ''}
        ${coPhone   ? `<div style="font-size:9.5pt;color:#666;line-height:1.65;">${coPhone}</div>`   : ''}
        ${coWebsite ? `<div style="font-size:9.5pt;color:#666;line-height:1.65;">${coWebsite}</div>` : ''}
        ${(userName || proposal.salesman) ? `<div style="font-size:9.5pt;color:#444;font-weight:600;line-height:1.65;">${userName || proposal.salesman}</div>` : ''}
      </div>
    </div>

    <div style="padding:14px 36px 0;">
      <div style="font-size:10pt;color:#555;margin-bottom:14px;">
        <strong>Invoice for:</strong> ${proposal.bid_name || ''} — ${lead.name || lead.fullName || ''}
      </div>
    </div>

    <div style="padding:0 36px;">
      <table>
        <thead><tr>
          <th>Description</th>
          <th class="r" style="width:26%;">Amount</th>
        </tr></thead>
        <tbody>
          <tr>
            <td style="${TD}font-weight:600;">Bid Total</td>
            <td style="${TDR}font-weight:600;">${fmt(bidTotal)}</td>
          </tr>
          ${prevPayRows}
        </tbody>
      </table>
    </div>

    <div style="padding:20px 36px;display:flex;justify-content:flex-end;">
      <div style="background:${HBG};border-radius:6px;padding:18px 24px;display:inline-block;min-width:300px;">
        <div style="font-size:8pt;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:${AC};margin-bottom:12px;">Final Balance</div>
        ${investRows}
      </div>
    </div>

    ${payUrlHtml}

    <div style="padding:20px 36px 0;font-size:10pt;color:#555;">
      Please make checks payable to <strong>${coName}</strong>.
    </div>

    <div style="background:${HBG};color:#fff;text-align:center;padding:16px 36px;margin-top:28px;">
      <span style="color:${AC};">★</span>
      <span style="font-size:9.5pt;letter-spacing:1px;margin-left:6px;">Thank you for your business!</span>
    </div>

  </div></body></html>`;

  openPrintWindow(html);
}

// ── PROPOSAL (exported) ───────────────────────────────────────────────────────

export function printProposal({
  proposal, checkedMap, customItems, discounts, paySchedule,
  lead, company, bidTotal, preDiscountTotal, discountTotal, balanceDue,
  proposalTopText = '',
  designId = null,
  primaryColor = null,
  accentColor = null,
  logoUrl = '',
  userName = '',
}) {
  if (designId) {
    const AC  = accentColor  || '#f97316';
    const HBG = primaryColor || '#1c2333';
    const args = { proposal, checkedMap, customItems, discounts, paySchedule,
      lead, company, bidTotal, preDiscountTotal, discountTotal, balanceDue, logoUrl, userName };
    return _printProposalStyled({ ...args, AC, HBG });
  }
  const docNum  = `PRO-${String(proposal.id + 121).padStart(4, '0')}`;
  const docDate = `Date: ${fmtDate(proposal.presented_date)}`;
  const extra   = proposal.salesman ? `<br>Prepared by: ${proposal.salesman}` : '';

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
    const qty = Math.round(item._qty ?? item.quantity ?? 1);
    return `<tr>
      <td>${item._desc || item.description || ''}</td>
      <td class="r">${qty}</td>
      <td class="r">${fmt(item._price ?? item.price_each)}</td>
      <td class="r">${fmt(item.line_total)}</td>
    </tr>`;
  }).join('');

  const discountRows = discounts.map(d => {
    const type        = d._type || d.discount_type;
    const val         = parseFloat(d._val ?? d.discount_value) || 0;
    const amt         = type === 'dollar' ? val : preDiscountTotal * (val / 100);
    const name        = d._desc || d.description || 'Discount';
    const acceptDate  = d._date || d.if_accepted_by || '';
    const acceptLabel = acceptDate ? `<div style="font-size:9pt;color:#b00;margin-top:2px">If accepted by ${fmtDate(acceptDate)}</div>` : '';
    return `<tr>
      <td colspan="3" style="text-align:right;color:#b00;font-size:10.5pt">${name}${acceptLabel}</td>
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

    <div class="doc-footer">${companyFooterText(company)}</div>`;

  openPrintWindow(docShell('Proposal', docNum, docDate, extra, companyBlock(company), body));
}

// ── PAYMENT INVOICE (exported) ────────────────────────────────────────────────

export function printPaymentInvoice({ proposal, payEntry, payIdx, lead, company, bidTotal, invoiceTopText = '', designId = null, primaryColor = null, accentColor = null, logoUrl = '', userName = '' }) {
  if (designId) {
    const AC  = accentColor  || '#f97316';
    const HBG = primaryColor || '#1c2333';
    const args = { proposal, payEntry, payIdx, lead, company, bidTotal, logoUrl, userName };
    return _printPaymentInvoiceStyled({ ...args, AC, HBG });
  }
  const amt    = calcAmt(payEntry, bidTotal);
  const type   = payEntry._type || payEntry.amount_type;
  const val    = parseFloat(payEntry._val ?? payEntry.amount_value) || 0;
  const label  = payEntry._desc || payEntry.description || `Payment ${payIdx + 1}`;
  const detail = type === 'percent' ? `${val}% of ${fmt(bidTotal)}` : '';
  const docNum = `INV-${String(proposal.id + 121).padStart(4, '0')}-${payIdx + 1}`;
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

// ── FINAL INVOICE (exported) ──────────────────────────────────────────────────

export function printFinalInvoice({ proposal, paySchedule, lead, company, bidTotal, balanceDue, invoiceTopText = '', designId = null, primaryColor = null, accentColor = null, logoUrl = '', userName = '' }) {
  if (designId) {
    const AC  = accentColor  || '#f97316';
    const HBG = primaryColor || '#1c2333';
    const args = { proposal, paySchedule, lead, company, bidTotal, balanceDue, logoUrl, userName };
    return _printFinalInvoiceStyled({ ...args, AC, HBG });
  }
  const docNum  = `INV-${String(proposal.id + 121).padStart(4, '0')}-F`;
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
