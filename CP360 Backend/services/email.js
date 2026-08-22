const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_PORT == 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: { rejectUnauthorized: false },
});

// Returns true only for http/https URLs — data: URLs break in email clients
function isEmailSafeUrl(url) {
  return url && (url.startsWith('http://') || url.startsWith('https://'));
}

// Contact line added above footer in all customer emails
function contactLine(companyPhone) {
  const reach = companyPhone
    ? ` at ${companyPhone}`
    : '';
  return `<p style="font-size:13px;color:#9ca3af;margin:24px 0 0;font-family:Arial,sans-serif;text-align:center">If you have any questions or concerns please reach out to us${reach} or reply to this email.</p>`;
}

// Shared header row: colored bar with optional logo left + company name right
function emailHeader(HBG, AC, displayName, logoUrl) {
  const safeLogoUrl = isEmailSafeUrl(logoUrl) ? logoUrl : null;
  const logo = safeLogoUrl
    ? `<img src="${safeLogoUrl}" alt="${displayName}" style="max-height:44px;max-width:160px;display:block;object-fit:contain">`
    : `<span style="color:#fff;font-size:22px;font-weight:900;letter-spacing:0.5px;font-family:Arial,sans-serif">${displayName}</span>`;
  return [
    `<tr><td bgcolor="${HBG}" style="padding:18px 28px">`,
    `<table width="100%" cellpadding="0" cellspacing="0"><tr>`,
    `<td style="vertical-align:middle">${logo}</td>`,
    safeLogoUrl
      ? `<td style="vertical-align:middle;text-align:right"><span style="color:#fff;font-size:15px;font-weight:700;font-family:Arial,sans-serif">${displayName}</span></td>`
      : '',
    `</tr></table>`,
    `</td></tr>`,
    `<tr><td bgcolor="${AC}" style="height:4px;font-size:1px;line-height:1px">&nbsp;</td></tr>`,
  ].join('');
}

// Classic (blue) header with optional logo
function emailHeaderClassic(displayName, logoUrl) {
  const safeLogoUrl = isEmailSafeUrl(logoUrl) ? logoUrl : null;
  const logo = safeLogoUrl
    ? `<img src="${safeLogoUrl}" alt="${displayName}" style="max-height:44px;max-width:160px;display:block;object-fit:contain">`
    : `<span style="color:#fff;font-size:22px;font-weight:700;font-family:Arial,sans-serif">${displayName}</span>`;
  return [
    `<tr><td bgcolor="#1d4ed8" style="padding:18px 28px;border-radius:8px 8px 0 0">`,
    `<table width="100%" cellpadding="0" cellspacing="0"><tr>`,
    `<td style="vertical-align:middle">${logo}</td>`,
    safeLogoUrl
      ? `<td style="vertical-align:middle;text-align:right"><span style="color:#fff;font-size:15px;font-weight:700;font-family:Arial,sans-serif">${displayName}</span></td>`
      : '',
    `</tr></table>`,
    `</td></tr>`,
  ].join('');
}

async function sendPasswordResetEmail(email, resetToken) {
  const resetUrl = `${process.env.APP_URL}/?token=${resetToken}`;
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'Password Reset Request - CoatingPro360',
    html: `
      <h2>Password Reset Request</h2>
      <p>You requested a password reset for your CoatingPro360 account.</p>
      <p><a href="${resetUrl}" style="background-color:#4CAF50;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;display:inline-block;">Reset Password</a></p>
      <p>Or copy and paste this link: ${resetUrl}</p>
      <p>This link expires in 1 hour.</p>
      <p>If you didn't request this, ignore this email.</p>
    `,
  });
}

async function sendProposalAcceptedEmails({
  proposalId, proposalDocNum, bidName, bidTotal = null, signatureName, signedAt,
  customerEmail, customerName, contractorEmail, companyName, proposalUrl,
  fromName, fromEmail, companyPhone = null,
  primaryColor = null, accentColor = null, logoUrl = null,
}) {
  const dateStr     = new Date(signedAt).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const displayName = fromName || companyName || 'CoatingPro360';
  const fromHeader  = `"${displayName}" <${process.env.SMTP_USER}>`;
  const replyTo     = fromEmail || undefined;
  const docLabel    = proposalDocNum ? `Proposal #${proposalDocNum}` : (bidName || 'Proposal');
  const totalStr    = bidTotal ? `$${(parseFloat(bidTotal) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : null;
  const HBG         = primaryColor || '#1d4ed8';
  const AC          = accentColor  || '#f97316';

  // ── Contractor email ────────────────────────────────────────────────────────
  if (contractorEmail) {
    const contractorHtml = [
      `<table width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">`,
      emailHeader(HBG, AC, displayName, logoUrl),

      `<tr><td bgcolor="#ffffff" style="padding:28px;border:1px solid #e5e7eb;border-top:none">`,
      `<p style="font-size:16px;color:#111;margin:0 0 6px;font-family:Arial,sans-serif">`,
      `<strong>${customerName || 'Your customer'}</strong> has accepted a proposal.</p>`,

      `<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border:2px solid ${HBG};border-radius:6px">`,
      `<tr><td bgcolor="${HBG}" style="padding:10px 16px;border-radius:4px 4px 0 0">`,
      `<p style="margin:0;font-size:11px;font-weight:900;color:${AC};text-transform:uppercase;letter-spacing:2px;font-family:Arial,sans-serif">Proposal Accepted</p>`,
      `</td></tr>`,
      `<tr><td style="padding:16px">`,
      `<table width="100%" cellpadding="0" cellspacing="0">`,
      `<tr><td style="padding:6px 0;color:#6b7280;font-size:14px;font-family:Arial,sans-serif;width:140px">Project</td><td style="padding:6px 0;font-weight:bold;font-size:14px;font-family:Arial,sans-serif;color:#111">${bidName || '—'}</td></tr>`,
      totalStr ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:14px;font-family:Arial,sans-serif">Amount</td><td style="padding:6px 0;font-weight:bold;font-size:16px;font-family:Arial,sans-serif;color:${HBG}">${totalStr}</td></tr>` : '',
      `<tr><td style="padding:6px 0;color:#6b7280;font-size:14px;font-family:Arial,sans-serif">Signed by</td><td style="padding:6px 0;font-weight:bold;font-size:14px;font-family:Arial,sans-serif;color:#111">${signatureName}</td></tr>`,
      `<tr><td style="padding:6px 0;color:#6b7280;font-size:14px;font-family:Arial,sans-serif">Date &amp; Time</td><td style="padding:6px 0;font-size:14px;font-family:Arial,sans-serif;color:#111">${dateStr}</td></tr>`,
      `</table>`,
      `</td></tr></table>`,

      proposalUrl ? [
        `<table cellpadding="0" cellspacing="0" style="margin:0 auto 24px">`,
        `<tr><td bgcolor="${AC}" style="border-radius:6px">`,
        `<a href="${proposalUrl}" style="display:block;color:#fff;font-weight:bold;font-size:14px;text-decoration:none;font-family:Arial,sans-serif;white-space:nowrap;padding:13px 28px">View Proposal</a>`,
        `</td></tr></table>`,
      ].join('') : '',

      `</td></tr>`,
      `<tr><td bgcolor="${HBG}" style="padding:14px 28px;text-align:center">`,
      `<p style="margin:0;font-size:12px;color:${AC};font-weight:bold;font-family:Arial,sans-serif">&#9733; ${companyName || 'CoatingPro360'}</p>`,
      `</td></tr>`,
      `</table>`,
    ].join('');

    await transporter.sendMail({
      from: fromHeader,
      ...(replyTo && { replyTo }),
      to: contractorEmail,
      subject: `${customerName || 'A customer'} has accepted the proposal for ${bidName}`,
      html: contractorHtml,
    });
  }

  // ── Customer confirmation email ─────────────────────────────────────────────
  if (customerEmail) {
    const customerHtml = [
      `<table width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">`,
      emailHeader(HBG, AC, displayName, logoUrl),

      `<tr><td bgcolor="#ffffff" style="padding:28px;border:1px solid #e5e7eb;border-top:none">`,
      `<p style="font-size:16px;color:#111;margin:0 0 6px;font-family:Arial,sans-serif">Hi ${customerName || 'there'},</p>`,
      `<p style="font-size:15px;color:#4b5563;margin:0 0 20px;font-family:Arial,sans-serif">Your proposal acceptance has been received. Here is a summary for your records.</p>`,

      `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border:2px solid ${HBG};border-radius:6px">`,
      `<tr><td bgcolor="${HBG}" style="padding:10px 16px;border-radius:4px 4px 0 0">`,
      `<p style="margin:0;font-size:11px;font-weight:900;color:${AC};text-transform:uppercase;letter-spacing:2px;font-family:Arial,sans-serif">Acceptance Summary</p>`,
      `</td></tr>`,
      `<tr><td style="padding:16px">`,
      `<table width="100%" cellpadding="0" cellspacing="0">`,
      `<tr><td style="padding:6px 0;color:#6b7280;font-size:14px;font-family:Arial,sans-serif;width:140px">Project</td><td style="padding:6px 0;font-weight:bold;font-size:14px;font-family:Arial,sans-serif;color:#111">${bidName || '—'}</td></tr>`,
      totalStr ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:14px;font-family:Arial,sans-serif">Amount</td><td style="padding:6px 0;font-weight:bold;font-size:16px;font-family:Arial,sans-serif;color:${HBG}">${totalStr}</td></tr>` : '',
      `<tr><td style="padding:6px 0;color:#6b7280;font-size:14px;font-family:Arial,sans-serif">Date Signed</td><td style="padding:6px 0;font-size:14px;font-family:Arial,sans-serif;color:#111">${dateStr}</td></tr>`,
      `</table>`,
      `</td></tr></table>`,

      `<p style="font-size:15px;color:#4b5563;margin:0 0 16px;font-family:Arial,sans-serif">Click below to make your payment.</p>`,
      `<table cellpadding="0" cellspacing="0" style="margin:0 auto 28px">`,
      `<tr><td bgcolor="${AC}" style="border-radius:6px">`,
      `<a href="${proposalUrl}" style="display:block;color:#fff;font-weight:bold;font-size:15px;text-decoration:none;font-family:Arial,sans-serif;white-space:nowrap;padding:14px 36px">Pay Now</a>`,
      `</td></tr></table>`,

      `<p style="font-size:14px;color:#374151;margin:0;font-family:Arial,sans-serif">A representative from <strong>${companyName || 'our team'}</strong> will be in touch shortly.</p>`,
      contactLine(companyPhone),
      `</td></tr>`,

      `<tr><td bgcolor="${HBG}" style="padding:14px 28px;text-align:center">`,
      `<p style="margin:0;font-size:12px;color:${AC};font-weight:bold;font-family:Arial,sans-serif">&#9733; Thank you for your business!</p>`,
      `</td></tr>`,
      `</table>`,
    ].join('');

    await transporter.sendMail({
      from: fromHeader,
      ...(replyTo && { replyTo }),
      to: customerEmail,
      subject: `Your Proposal Acceptance Has Been Received — ${companyName || 'CoatingPro360'}`,
      html: customerHtml,
    });
  }
}

async function sendProposalLinkEmail({
  toEmail, customerName, companyName, bidName, bidTotal, proposalUrl,
  fromName, fromEmail, emailType, companyPhone = null,
  primaryColor = null, accentColor = null, logoUrl = null,
  invoiceLabel = null, payDescription = null, payAmountStr = null,
}) {
  const totalStr    = payAmountStr || `$${(parseFloat(bidTotal) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const displayName = fromName || companyName || 'CoatingPro360';
  const fromHeader  = `"${displayName}" <${process.env.SMTP_USER}>`;
  const replyTo     = fromEmail || undefined;
  const isInvoice   = emailType === 'invoice';
  const docLabel    = isInvoice ? (invoiceLabel || 'Invoice') : 'Proposal';
  const lineTitle   = isInvoice ? (payDescription || bidName) : bidName;
  const subject     = isInvoice
    ? `Your ${displayName} Invoice & Payment Link`
    : `Your Proposal from ${displayName} is Ready`;
  const preheader   = isInvoice
    ? `Invoice from ${displayName}${payDescription ? ' — ' + payDescription : ''} ${totalStr}`
    : `Your proposal from ${displayName} is ready to review.`;
  const btnText     = isInvoice ? 'View Your Invoice' : 'View Your Proposal';
  const HBG         = primaryColor || '#1d4ed8';
  const AC          = accentColor  || (isInvoice ? '#1d4ed8' : '#16a34a');
  const useCustom   = !!(primaryColor && accentColor);

  const html = [
    `<div style="display:none!important;visibility:hidden;mso-hide:all;font-size:1px;color:#ffffff;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">${preheader}</div>`,
    `<table width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">`,

    useCustom
      ? emailHeader(HBG, AC, displayName, logoUrl)
      : emailHeaderClassic(displayName, logoUrl),

    `<tr><td bgcolor="${useCustom ? '#ffffff' : '#f9fafb'}" style="padding:28px;border:1px solid #e5e7eb;border-top:none${useCustom ? '' : ';border-radius:0 0 8px 8px'}">`,
    `<p style="font-size:16px;color:#111;margin:0 0 16px;font-family:Arial,sans-serif">Hi ${customerName || 'there'},</p>`,
    isInvoice
      ? `<p style="font-size:15px;color:#4b5563;margin:0 0 24px;font-family:Arial,sans-serif">Your invoice is ready. Click the button below to view and pay online.</p>`
      : `<p style="font-size:15px;color:#4b5563;margin:0 0 24px;font-family:Arial,sans-serif">Your proposal is ready to review. Click the button below to view the full details.</p>`,

    // Doc card
    useCustom ? [
      `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;border:2px solid ${HBG};border-radius:6px">`,
      `<tr><td bgcolor="${HBG}" style="padding:10px 16px;border-radius:4px 4px 0 0">`,
      `<p style="margin:0;font-size:11px;font-weight:900;color:${AC};text-transform:uppercase;letter-spacing:2px;font-family:Arial,sans-serif">${docLabel}</p>`,
      `</td></tr>`,
      `<tr><td style="padding:16px">`,
      `<p style="margin:0 0 6px;font-size:17px;font-weight:bold;color:${HBG};font-family:Arial,sans-serif">${lineTitle}</p>`,
      `<p style="margin:0;font-size:26px;font-weight:900;color:${HBG};font-family:Arial,sans-serif">${totalStr}</p>`,
      `</td></tr></table>`,
    ].join('') : [
      `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">`,
      `<tr><td bgcolor="#ffffff" style="border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px">`,
      `<p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;font-weight:bold;font-family:Arial,sans-serif">${docLabel}</p>`,
      `<p style="margin:0 0 8px;font-size:18px;font-weight:bold;color:#111;font-family:Arial,sans-serif">${lineTitle}</p>`,
      `<p style="margin:0;font-size:22px;font-weight:bold;color:#1d4ed8;font-family:Arial,sans-serif">${totalStr}</p>`,
      `</td></tr></table>`,
    ].join(''),

    // Button
    `<table cellpadding="0" cellspacing="0" style="margin:0 auto 24px">`,
    `<tr><td bgcolor="${AC}" style="border-radius:6px">`,
    `<a href="${proposalUrl}" style="display:block;color:#fff;font-weight:bold;font-size:15px;text-decoration:none;font-family:Arial,sans-serif;white-space:nowrap;padding:14px 32px">${btnText}</a>`,
    `</td></tr></table>`,

    `<p style="font-size:12px;color:#9ca3af;margin:0;font-family:Arial,sans-serif">Or copy this link into your browser:<br>`,
    `<a href="${proposalUrl}" style="color:${HBG}">${proposalUrl}</a></p>`,

    contactLine(companyPhone),
    `</td></tr>`,

    // Footer
    useCustom ? [
      `<tr><td bgcolor="${HBG}" style="padding:14px 28px;text-align:center">`,
      `<p style="margin:0;font-size:12px;color:${AC};font-weight:bold;font-family:Arial,sans-serif">&#9733; Thank you for the opportunity to earn your business!</p>`,
      `</td></tr>`,
    ].join('') : [
      `<tr><td style="padding:16px 28px;background:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">`,
      `<p style="color:#9ca3af;font-size:12px;margin:0;font-family:Arial,sans-serif">${displayName}</p>`,
      `</td></tr>`,
    ].join(''),

    `</table>`,
  ].join('');

  await transporter.sendMail({ from: fromHeader, ...(replyTo && { replyTo }), to: toEmail, subject, html });
}

async function sendPaymentReceivedEmail({
  contractorEmail, customerEmail, customerName, companyName,
  bidName, amountStr, payLabel, invoiceUrl,
  fromName, fromEmail, companyPhone = null,
  primaryColor = null, accentColor = null, logoUrl = null,
}) {
  const displayName = fromName || companyName || 'CoatingPro360';
  const fromHeader  = `"${displayName}" <${process.env.SMTP_USER}>`;
  const replyTo     = fromEmail || undefined;
  const dateStr     = new Date().toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const firstName   = customerName ? customerName.trim().split(' ')[0] : '';
  const greeting    = customerName ? `Hi ${customerName},` : 'Hi there,';
  const closing     = `We look forward to completing your project${bidName ? ` — ${bidName}` : ''}.`;
  const HBG         = primaryColor || '#1d4ed8';
  const AC          = accentColor  || '#f97316';
  const useCustom   = !!(primaryColor && accentColor);

  function buildHtml(forCustomer) {
    return [
      `<table width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">`,

      useCustom
        ? emailHeader(HBG, AC, displayName, logoUrl)
        : emailHeaderClassic(displayName, logoUrl),

      `<tr><td bgcolor="${useCustom ? '#ffffff' : '#f9fafb'}" style="padding:32px 28px;border:1px solid #e5e7eb;border-top:none${useCustom ? '' : ';border-radius:0 0 8px 8px'};text-align:center">`,
      `<div style="display:inline-block;background:#16a34a;border-radius:50%;width:60px;height:60px;line-height:60px;text-align:center;font-size:30px;color:#fff;margin-bottom:20px">&#10003;</div>`,
      `<h2 style="color:${useCustom ? HBG : '#111'};margin:0 0 20px;font-size:24px;font-weight:900;font-family:Arial,sans-serif">Thank you for your payment</h2>`,
      `<p style="font-size:38px;font-weight:900;color:#16a34a;margin:0 0 6px;font-family:Arial,sans-serif">${amountStr}</p>`,
      `<p style="color:#6b7280;font-size:16px;font-weight:600;margin:0 0 28px;font-family:Arial,sans-serif">${payLabel}</p>`,
      `<p style="color:#4b5563;font-size:15px;margin:0 0 28px;font-family:Arial,sans-serif">${greeting} ${closing}</p>`,
      invoiceUrl ? [
        `<table cellpadding="0" cellspacing="0" style="margin:0 auto">`,
        `<tr><td bgcolor="${HBG}" style="border-radius:6px">`,
        `<a href="${invoiceUrl}" style="display:block;color:#fff;font-weight:bold;font-size:14px;text-decoration:none;font-family:Arial,sans-serif;padding:13px 28px">View Invoice</a>`,
        `</td></tr></table>`,
      ].join('') : '',
      forCustomer ? contactLine(companyPhone) : '',
      `</td></tr>`,

      useCustom ? [
        `<tr><td bgcolor="${HBG}" style="padding:14px 28px;text-align:center">`,
        `<p style="margin:0;font-size:12px;color:${AC};font-weight:bold;font-family:Arial,sans-serif">&#9733; Thank you for your business!</p>`,
        `</td></tr>`,
      ].join('') : [
        `<tr><td style="padding:16px 28px;background:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">`,
        `<p style="color:#9ca3af;font-size:12px;margin:0;font-family:Arial,sans-serif">${displayName}</p>`,
        `</td></tr>`,
      ].join(''),

      `</table>`,
    ].join('');
  }

  const customerSubject = firstName
    ? `Thank you ${firstName}, we have received your payment — details inside`
    : `Thank you, we have received your payment — details inside`;

  const sends = [];
  if (contractorEmail) {
    sends.push(transporter.sendMail({
      from: fromHeader, ...(replyTo && { replyTo }),
      to: contractorEmail,
      subject: `${customerName || 'A customer'} has paid ${amountStr} for ${bidName}`,
      html: buildHtml(false),
    }));
  }
  if (customerEmail) {
    sends.push(transporter.sendMail({
      from: fromHeader, ...(replyTo && { replyTo }),
      to: customerEmail,
      subject: customerSubject,
      html: buildHtml(true),
    }));
  }
  await Promise.all(sends);
}

async function sendWarrantyEmail({
  toEmail, customerName, companyName, warrantyTitle, warrantyPdfDataUrl,
  fromName, fromEmail, companyPhone = null,
  primaryColor = null, accentColor = null, logoUrl = null,
}) {
  const displayName = fromName || companyName || 'CoatingPro360';
  const fromHeader  = `"${displayName}" <${process.env.SMTP_USER}>`;
  const replyTo     = fromEmail || undefined;
  const subject     = `Here is your ${companyName || displayName} project warranty`;
  const HBG         = primaryColor || '#1d4ed8';
  const AC          = accentColor  || '#f97316';
  const useCustom   = !!(primaryColor && accentColor);

  const html = [
    `<table width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">`,

    useCustom
      ? emailHeader(HBG, AC, displayName, logoUrl)
      : emailHeaderClassic(displayName, logoUrl),

    `<tr><td bgcolor="${useCustom ? '#ffffff' : '#f9fafb'}" style="padding:28px;border:1px solid #e5e7eb;border-top:none${useCustom ? '' : ';border-radius:0 0 8px 8px'}">`,
    `<p style="font-size:16px;color:#111;margin:0 0 16px;font-family:Arial,sans-serif">Hi ${customerName || 'there'},</p>`,
    `<p style="font-size:15px;color:#4b5563;margin:0 0 24px;font-family:Arial,sans-serif">Please find your project warranty attached to this email. This document outlines the coverage and terms of your warranty with ${companyName || 'us'}. Keep it for your records — if you have any questions, don't hesitate to reach out.</p>`,

    useCustom ? [
      `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;border:2px solid ${HBG};border-radius:6px">`,
      `<tr><td bgcolor="${HBG}" style="padding:10px 16px;border-radius:4px 4px 0 0">`,
      `<p style="margin:0;font-size:11px;font-weight:900;color:${AC};text-transform:uppercase;letter-spacing:2px;font-family:Arial,sans-serif">WARRANTY</p>`,
      `</td></tr>`,
      `<tr><td style="padding:16px">`,
      `<p style="margin:0;font-size:17px;font-weight:bold;color:${HBG};font-family:Arial,sans-serif">${warrantyTitle}</p>`,
      `</td></tr></table>`,
    ].join('') : [
      `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">`,
      `<tr><td bgcolor="#ffffff" style="border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px">`,
      `<p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;font-weight:bold;font-family:Arial,sans-serif">WARRANTY</p>`,
      `<p style="margin:0;font-size:18px;font-weight:bold;color:#111;font-family:Arial,sans-serif">${warrantyTitle}</p>`,
      `</td></tr></table>`,
    ].join(''),

    contactLine(companyPhone),
    `</td></tr>`,

    useCustom ? [
      `<tr><td bgcolor="${HBG}" style="padding:14px 28px;text-align:center">`,
      `<p style="margin:0;font-size:12px;color:${AC};font-weight:bold;font-family:Arial,sans-serif">&#9733; Thank you for your business!</p>`,
      `</td></tr>`,
    ].join('') : [
      `<tr><td style="padding:16px 28px;background:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">`,
      `<p style="color:#9ca3af;font-size:12px;margin:0;font-family:Arial,sans-serif">${displayName}</p>`,
      `</td></tr>`,
    ].join(''),

    `</table>`,
  ].join('');

  let attachmentContent = null;
  if (warrantyPdfDataUrl) {
    const match = warrantyPdfDataUrl.match(/^data:[^;]+;base64,(.+)$/s);
    if (match) attachmentContent = match[1];
  }

  await transporter.sendMail({
    from: fromHeader,
    ...(replyTo && { replyTo }),
    to: toEmail,
    subject,
    html,
    ...(attachmentContent ? {
      attachments: [{ filename: 'warranty.pdf', content: attachmentContent, encoding: 'base64', contentType: 'application/pdf' }],
    } : {}),
  });
}

async function sendVisualizationEmail({
  toEmail, customerName, companyName, originalImageUrl, generatedImageUrl,
  primaryColor = null, accentColor = null, logoUrl = null, companyPhone = null,
}) {
  const displayName = companyName || 'CoatingPro360';
  const fromHeader  = `"${displayName}" <${process.env.SMTP_USER}>`;
  const HBG         = primaryColor || '#00875A';
  const AC          = accentColor  || '#16a34a';

  const html = [
    `<table width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto">`,
    emailHeader(HBG, AC, displayName, logoUrl),

    `<tr><td bgcolor="#ffffff" style="padding:28px;border:1px solid #e5e7eb;border-top:none">`,
    `<p style="font-size:16px;color:#111;margin:0 0 6px">Hi ${customerName || 'there'},</p>`,
    `<p style="font-size:15px;color:#4b5563;margin:0 0 24px">Here's your floor visualization — see the before and after side by side:</p>`,

    // Before / After images
    `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">`,
    `<tr>`,
    `<td width="49%" style="vertical-align:top;text-align:center;padding-right:6px">`,
    `<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px">Before</p>`,
    originalImageUrl ? `<img src="${originalImageUrl}" alt="Before" style="width:100%;border-radius:8px;display:block;border:1px solid #e5e7eb">` : '',
    `</td>`,
    `<td width="2%"></td>`,
    `<td width="49%" style="vertical-align:top;text-align:center;padding-left:6px">`,
    `<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:${HBG};text-transform:uppercase;letter-spacing:1px">After</p>`,
    generatedImageUrl ? `<img src="${generatedImageUrl}" alt="After" style="width:100%;border-radius:8px;display:block;border:1px solid #e5e7eb">` : '',
    `</td>`,
    `</tr>`,
    `</table>`,

    `<p style="font-size:15px;color:#4b5563;margin:0 0 20px">Like what you see? We'd love to give you a free quote for your project.</p>`,

    // CTA button
    `<table cellpadding="0" cellspacing="0" style="margin:0 auto 24px">`,
    `<tr><td bgcolor="${HBG}" style="border-radius:6px">`,
    `<a href="mailto:${process.env.SMTP_USER}" style="display:block;color:#fff;font-weight:bold;font-size:15px;text-decoration:none;font-family:Arial,sans-serif;white-space:nowrap;padding:14px 32px">Get a Free Quote</a>`,
    `</td></tr></table>`,

    contactLine(companyPhone),
    `</td></tr>`,

    `<tr><td bgcolor="${HBG}" style="padding:14px 28px;text-align:center">`,
    `<p style="margin:0;font-size:12px;color:#ffffff;font-weight:bold;font-family:Arial,sans-serif">&#9733; ${displayName}</p>`,
    `</td></tr>`,
    `</table>`,
  ].join('');

  await transporter.sendMail({
    from: fromHeader,
    to: toEmail,
    subject: `Your Floor Visualization from ${displayName}`,
    html,
  });
}

async function sendSwatchEmail({
  toEmail, customerName, companyName, swatchUrl, blendDescription,
  primaryColor = null, accentColor = null, logoUrl = null, companyPhone = null,
}) {
  const displayName = companyName || 'CoatingPro360';
  const fromHeader  = `"${displayName}" <${process.env.SMTP_USER}>`;
  const HBG         = primaryColor || '#00875A';
  const AC          = accentColor  || '#16a34a';

  const html = [
    `<table width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto">`,
    emailHeader(HBG, AC, displayName, logoUrl),
    `<tr><td bgcolor="#ffffff" style="padding:28px;border:1px solid #e5e7eb;border-top:none">`,
    `<p style="font-size:16px;color:#111;margin:0 0 6px">Hi ${customerName || 'there'},</p>`,
    `<p style="font-size:15px;color:#4b5563;margin:0 0 20px">Here's the floor chip blend we discussed for your project${blendDescription ? ': <strong>' + blendDescription + '</strong>' : ''}.</p>`,
    swatchUrl ? `<img src="${swatchUrl}" alt="Chip Blend Swatch" style="width:100%;border-radius:8px;display:block;border:1px solid #e5e7eb;margin-bottom:24px">` : '',
    `<p style="font-size:15px;color:#4b5563;margin:0 0 20px">Let us know if you'd like to make any changes or if you're ready to move forward!</p>`,
    contactLine(companyPhone),
    `</td></tr>`,
    `<tr><td bgcolor="${HBG}" style="padding:14px 28px;text-align:center">`,
    `<p style="margin:0;font-size:12px;color:#ffffff;font-weight:bold;font-family:Arial,sans-serif">&#9733; ${displayName}</p>`,
    `</td></tr>`,
    `</table>`,
  ].join('');

  await transporter.sendMail({
    from: fromHeader,
    to: toEmail,
    subject: `Your Floor Chip Blend from ${displayName}`,
    html,
  });
}

module.exports = {
  sendPasswordResetEmail,
  sendProposalAcceptedEmails,
  sendProposalLinkEmail,
  sendPaymentReceivedEmail,
  sendWarrantyEmail,
  sendVisualizationEmail,
  sendSwatchEmail,
};
