const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_PORT == 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false  // Add this to ignore certificate mismatch
  }
});

async function sendPasswordResetEmail(email, resetToken) {
  const resetUrl = `${process.env.APP_URL}/?token=${resetToken}`;

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'Password Reset Request - CoatingPro360',
    html: `
      <h2>Password Reset Request</h2>
      <p>You requested a password reset for your CoatingPro360 account.</p>
      <p>Click the link below to reset your password:</p>
      <p><a href="${resetUrl}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a></p>
      <p>Or copy and paste this link into your browser:</p>
      <p>${resetUrl}</p>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
      <hr>
      <p style="color: #666; font-size: 12px;">CoatingPro360 - Lead Management System</p>
    `,
  };

  await transporter.sendMail(mailOptions);
}

async function sendProposalAcceptedEmails({ proposalId, bidName, signatureName, signedAt, customerEmail, customerName, contractorEmail, companyName, proposalUrl, fromName, fromEmail }) {
  const dateStr = new Date(signedAt).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const displayName = fromName || companyName || 'CoatingPro360';
  const senderAddr = fromEmail || process.env.SMTP_USER;
  const fromHeader = `"${displayName}" <${senderAddr}>`;

  // Email to contractor
  if (contractorEmail) {
    await transporter.sendMail({
      from: fromHeader,
      to: contractorEmail,
      subject: `Proposal Accepted — ${bidName}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#1d4ed8;padding:24px;border-radius:8px 8px 0 0">
            <h2 style="color:#fff;margin:0">Proposal Accepted</h2>
          </div>
          <div style="background:#f9fafb;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb">
            <p style="font-size:16px;color:#111"><strong>${customerName || 'Your customer'}</strong> has accepted proposal <strong>${bidName}</strong>.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0">
              <tr><td style="padding:8px 0;color:#6b7280;width:140px">Signed by</td><td style="padding:8px 0;font-weight:bold">${signatureName}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280">Date &amp; Time</td><td style="padding:8px 0">${dateStr}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280">Proposal</td><td style="padding:8px 0">${bidName}</td></tr>
            </table>
            ${proposalUrl ? `<p><a href="${proposalUrl}" style="color:#1d4ed8">View Proposal</a></p>` : ''}
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
            <p style="color:#9ca3af;font-size:12px">CoatingPro360</p>
          </div>
        </div>`,
    });
  }

  // Confirmation email to customer
  if (customerEmail) {
    await transporter.sendMail({
      from: fromHeader,
      to: customerEmail,
      subject: `Your Proposal Has Been Accepted — ${companyName || 'CoatingPro360'}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#1d4ed8;padding:24px;border-radius:8px 8px 0 0">
            <h2 style="color:#fff;margin:0">Thank You!</h2>
          </div>
          <div style="background:#f9fafb;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb">
            <p style="font-size:16px;color:#111">Thank you for accepting your proposal. Here's a summary of your acceptance.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0">
              <tr><td style="padding:8px 0;color:#6b7280;width:140px">Signed by</td><td style="padding:8px 0;font-weight:bold">${signatureName}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280">Date &amp; Time</td><td style="padding:8px 0">${dateStr}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280">Proposal</td><td style="padding:8px 0">${bidName}</td></tr>
            </table>
            <p style="color:#374151">A representative from <strong>${companyName || 'our team'}</strong> will be in touch shortly.</p>
            ${proposalUrl ? `<p><a href="${proposalUrl}" style="color:#1d4ed8">View your proposal</a></p>` : ''}
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
            <p style="color:#9ca3af;font-size:12px">${companyName || 'CoatingPro360'}</p>
          </div>
        </div>`,
    });
  }
}

async function sendProposalLinkEmail({ toEmail, customerName, companyName, bidName, bidTotal, proposalUrl, fromName, fromEmail, emailType, primaryColor = null, accentColor = null, invoiceLabel = null, payDescription = null, payAmountStr = null }) {
  const totalStr = payAmountStr || `$${(parseFloat(bidTotal) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const displayName = fromName || companyName || 'CoatingPro360';
  const senderEmail = fromEmail || process.env.SMTP_USER || process.env.EMAIL_FROM;
  const fromHeader  = `"${displayName}" <${senderEmail}>`;

  const isInvoice   = emailType === 'invoice';
  const docLabel    = isInvoice ? (invoiceLabel || 'Invoice') : 'Proposal';
  const lineTitle   = isInvoice ? (payDescription || bidName) : bidName;
  const subject     = isInvoice
    ? `${invoiceLabel ? invoiceLabel + ' — ' : ''}Invoice from ${displayName}`
    : `Your Proposal from ${displayName} is Ready`;
  const preheader   = isInvoice
    ? `Invoice from ${displayName}${payDescription ? ' — ' + payDescription : ''} ${totalStr}`
    : `Your proposal from ${displayName} is ready to review.`;
  const btnText     = isInvoice ? 'View Your Invoice' : 'View Your Proposal';

  let html;

  if (primaryColor && accentColor) {
    // ── Professional (custom colors) ─────────────────────────────────────────
    const HBG = primaryColor;
    const AC  = accentColor;
    html = [
      `<div style="display:none!important;visibility:hidden;mso-hide:all;font-size:1px;color:#ffffff;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">${preheader}</div>`,
      `<table width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">`,

      // Header
      `<tr><td bgcolor="${HBG}" style="padding:24px 28px">`,
      `<h2 style="color:#fff;margin:0;font-size:22px;font-weight:900;letter-spacing:0.5px;font-family:Arial,sans-serif">${displayName}</h2>`,
      `</td></tr>`,

      // Accent strip
      `<tr><td bgcolor="${AC}" style="height:4px;font-size:1px;line-height:1px">&nbsp;</td></tr>`,

      // Body
      `<tr><td bgcolor="#ffffff" style="padding:28px;border:1px solid #e5e7eb;border-top:none">`,
      `<p style="font-size:16px;color:#111;margin:0 0 16px;font-family:Arial,sans-serif">Hi ${customerName || 'there'},</p>`,
      isInvoice
        ? `<p style="font-size:15px;color:#4b5563;margin:0 0 24px;font-family:Arial,sans-serif">Your invoice is ready. Click the button below to view and pay online.</p>`
        : `<p style="font-size:15px;color:#4b5563;margin:0 0 24px;font-family:Arial,sans-serif">Your proposal is ready to review. Click the button below to view the full details.</p>`,

      // Bid / Invoice card
      `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;border:2px solid ${HBG};border-radius:6px">`,
      `<tr><td bgcolor="${HBG}" style="padding:10px 16px;border-radius:4px 4px 0 0">`,
      `<p style="margin:0;font-size:11px;font-weight:900;color:${AC};text-transform:uppercase;letter-spacing:2px;font-family:Arial,sans-serif">${docLabel}</p>`,
      `</td></tr>`,
      `<tr><td style="padding:16px">`,
      `<p style="margin:0 0 6px;font-size:17px;font-weight:bold;color:${HBG};font-family:Arial,sans-serif">${lineTitle}</p>`,
      `<p style="margin:0;font-size:26px;font-weight:900;color:${HBG};font-family:Arial,sans-serif">${totalStr}</p>`,
      `</td></tr></table>`,

      // Button
      `<table cellpadding="0" cellspacing="0" style="margin:0 auto 24px">`,
      `<tr><td bgcolor="${AC}" style="border-radius:6px;padding:14px 32px">`,
      `<a href="${proposalUrl}" style="color:#fff;font-weight:bold;font-size:15px;text-decoration:none;font-family:Arial,sans-serif;white-space:nowrap">${btnText}</a>`,
      `</td></tr></table>`,

      `<p style="font-size:12px;color:#9ca3af;margin:0;font-family:Arial,sans-serif">Or copy this link into your browser:<br>`,
      `<a href="${proposalUrl}" style="color:${HBG}">${proposalUrl}</a></p>`,
      `</td></tr>`,

      // Footer
      `<tr><td bgcolor="${HBG}" style="padding:14px 28px;text-align:center">`,
      `<p style="margin:0;font-size:12px;color:${AC};font-weight:bold;font-family:Arial,sans-serif">&#9733; Thank you for the opportunity to earn your business!</p>`,
      `</td></tr>`,

      `</table>`,
    ].join('');
  } else {
    // ── Classic (blue) ────────────────────────────────────────────────────────
    const buttonColor = isInvoice ? '#1d4ed8' : '#16a34a';
    html = [
      `<div style="display:none!important;visibility:hidden;mso-hide:all;font-size:1px;color:#f9fafb;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">${preheader}</div>`,
      `<table width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">`,
      `<tr><td bgcolor="#1d4ed8" style="padding:24px 28px;border-radius:8px 8px 0 0">`,
      `<h2 style="color:#fff;margin:0;font-size:22px;font-family:Arial,sans-serif">${displayName}</h2>`,
      `</td></tr>`,
      `<tr><td bgcolor="#f9fafb" style="padding:28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">`,
      `<p style="font-size:16px;color:#111;margin:0 0 16px;font-family:Arial,sans-serif">Hi ${customerName || 'there'},</p>`,
      isInvoice
        ? `<p style="font-size:15px;color:#374151;margin:0 0 20px;font-family:Arial,sans-serif">Your invoice is ready. Click the button below to view and pay online.</p>`
        : `<p style="font-size:15px;color:#374151;margin:0 0 20px;font-family:Arial,sans-serif">Your proposal is ready to review. Click the button below to view the full details.</p>`,
      `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">`,
      `<tr><td bgcolor="#ffffff" style="border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px">`,
      `<p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;font-weight:bold;font-family:Arial,sans-serif">${docLabel}</p>`,
      `<p style="margin:0 0 8px;font-size:18px;font-weight:bold;color:#111;font-family:Arial,sans-serif">${lineTitle}</p>`,
      `<p style="margin:0;font-size:22px;font-weight:bold;color:#1d4ed8;font-family:Arial,sans-serif">${totalStr}</p>`,
      `</td></tr></table>`,
      `<table cellpadding="0" cellspacing="0" style="margin:0 auto 24px">`,
      `<tr><td bgcolor="${buttonColor}" style="border-radius:8px;padding:14px 28px">`,
      `<a href="${proposalUrl}" style="color:#fff;font-weight:bold;font-size:16px;text-decoration:none;font-family:Arial,sans-serif;white-space:nowrap">${btnText}</a>`,
      `</td></tr></table>`,
      `<p style="font-size:12px;color:#9ca3af;margin:0;font-family:Arial,sans-serif">Or copy this link into your browser:<br>`,
      `<a href="${proposalUrl}" style="color:#1d4ed8">${proposalUrl}</a></p>`,
      `<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">`,
      `<p style="color:#9ca3af;font-size:12px;margin:0;font-family:Arial,sans-serif">${displayName}</p>`,
      `</td></tr></table>`,
    ].join('');
  }

  await transporter.sendMail({ from: fromHeader, to: toEmail, subject, html });
}

async function sendPaymentReceivedEmail({ contractorEmail, customerEmail, customerName, companyName, bidName, amountStr, payLabel, invoiceUrl, fromName, fromEmail, primaryColor = null, accentColor = null }) {
  const displayName = fromName || companyName || 'CoatingPro360';
  const senderEmail = fromEmail || process.env.SMTP_USER || process.env.EMAIL_FROM;
  const fromHeader  = `"${displayName}" <${senderEmail}>`;
  const dateStr     = new Date().toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

  let html;
  if (primaryColor && accentColor) {
    const HBG = primaryColor;
    const AC  = accentColor;
    html = [
      `<table width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">`,
      `<tr><td bgcolor="${HBG}" style="padding:24px 28px">`,
      `<h2 style="color:#fff;margin:0;font-size:22px;font-weight:900;font-family:Arial,sans-serif">${displayName}</h2>`,
      `</td></tr>`,
      `<tr><td bgcolor="${AC}" style="height:4px;font-size:1px;line-height:1px">&nbsp;</td></tr>`,
      `<tr><td bgcolor="#ffffff" style="padding:28px;border:1px solid #e5e7eb;border-top:none">`,
      `<div style="text-align:center;padding:16px 0 24px">`,
      `<div style="display:inline-block;background:${AC};border-radius:50%;width:56px;height:56px;line-height:56px;text-align:center;font-size:28px;color:#fff">&#10003;</div>`,
      `<h2 style="color:${HBG};margin:16px 0 8px;font-size:22px;font-family:Arial,sans-serif">Payment Received</h2>`,
      `<p style="font-size:32px;font-weight:900;color:${AC};margin:0 0 4px;font-family:Arial,sans-serif">${amountStr}</p>`,
      `<p style="color:#6b7280;font-size:14px;margin:0;font-family:Arial,sans-serif">${payLabel}</p>`,
      `</div>`,
      `<table style="width:100%;border-collapse:collapse;margin:16px 0;border:1px solid #e5e7eb;border-radius:6px">`,
      `<tr><td style="padding:10px 16px;color:#6b7280;font-size:13px;border-bottom:1px solid #e5e7eb;width:140px;font-family:Arial,sans-serif">Customer</td><td style="padding:10px 16px;font-weight:bold;font-size:13px;border-bottom:1px solid #e5e7eb;font-family:Arial,sans-serif">${customerName || '—'}</td></tr>`,
      `<tr><td style="padding:10px 16px;color:#6b7280;font-size:13px;border-bottom:1px solid #e5e7eb;font-family:Arial,sans-serif">Project</td><td style="padding:10px 16px;font-size:13px;border-bottom:1px solid #e5e7eb;font-family:Arial,sans-serif">${bidName}</td></tr>`,
      `<tr><td style="padding:10px 16px;color:#6b7280;font-size:13px;font-family:Arial,sans-serif">Date</td><td style="padding:10px 16px;font-size:13px;font-family:Arial,sans-serif">${dateStr}</td></tr>`,
      `</table>`,
      invoiceUrl ? `<table cellpadding="0" cellspacing="0" style="margin:20px auto 0"><tr><td bgcolor="${HBG}" style="border-radius:6px;padding:12px 24px"><a href="${invoiceUrl}" style="color:#fff;font-weight:bold;font-size:14px;text-decoration:none;font-family:Arial,sans-serif">View Invoice</a></td></tr></table>` : '',
      `</td></tr>`,
      `<tr><td bgcolor="${HBG}" style="padding:14px 28px;text-align:center">`,
      `<p style="margin:0;font-size:12px;color:${AC};font-weight:bold;font-family:Arial,sans-serif">&#9733; Thank you for your business!</p>`,
      `</td></tr></table>`,
    ].join('');
  } else {
    html = [
      `<table width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">`,
      `<tr><td bgcolor="#1d4ed8" style="padding:24px 28px;border-radius:8px 8px 0 0">`,
      `<h2 style="color:#fff;margin:0;font-size:22px;font-family:Arial,sans-serif">${displayName}</h2>`,
      `</td></tr>`,
      `<tr><td bgcolor="#f9fafb" style="padding:28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">`,
      `<div style="text-align:center;padding:16px 0 24px">`,
      `<div style="display:inline-block;background:#16a34a;border-radius:50%;width:56px;height:56px;line-height:56px;text-align:center;font-size:28px;color:#fff">&#10003;</div>`,
      `<h2 style="color:#111;margin:16px 0 8px;font-size:22px;font-family:Arial,sans-serif">Payment Received</h2>`,
      `<p style="font-size:32px;font-weight:900;color:#1d4ed8;margin:0 0 4px;font-family:Arial,sans-serif">${amountStr}</p>`,
      `<p style="color:#6b7280;font-size:14px;margin:0;font-family:Arial,sans-serif">${payLabel}</p>`,
      `</div>`,
      `<table style="width:100%;border-collapse:collapse;margin:16px 0;border:1px solid #e5e7eb;border-radius:6px">`,
      `<tr><td style="padding:10px 16px;color:#6b7280;font-size:13px;border-bottom:1px solid #e5e7eb;width:140px;font-family:Arial,sans-serif">Customer</td><td style="padding:10px 16px;font-weight:bold;font-size:13px;border-bottom:1px solid #e5e7eb;font-family:Arial,sans-serif">${customerName || '—'}</td></tr>`,
      `<tr><td style="padding:10px 16px;color:#6b7280;font-size:13px;border-bottom:1px solid #e5e7eb;font-family:Arial,sans-serif">Project</td><td style="padding:10px 16px;font-size:13px;border-bottom:1px solid #e5e7eb;font-family:Arial,sans-serif">${bidName}</td></tr>`,
      `<tr><td style="padding:10px 16px;color:#6b7280;font-size:13px;font-family:Arial,sans-serif">Date</td><td style="padding:10px 16px;font-size:13px;font-family:Arial,sans-serif">${dateStr}</td></tr>`,
      `</table>`,
      invoiceUrl ? `<table cellpadding="0" cellspacing="0" style="margin:20px auto 0"><tr><td bgcolor="#1d4ed8" style="border-radius:6px;padding:12px 24px"><a href="${invoiceUrl}" style="color:#fff;font-weight:bold;font-size:14px;text-decoration:none;font-family:Arial,sans-serif">View Invoice</a></td></tr></table>` : '',
      `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 0">`,
      `<p style="color:#9ca3af;font-size:12px;margin:0;font-family:Arial,sans-serif">${displayName}</p>`,
      `</td></tr></table>`,
    ].join('');
  }

  const sends = [];
  if (contractorEmail) {
    sends.push(transporter.sendMail({ from: fromHeader, to: contractorEmail, subject: `Payment Received — ${bidName}`, html }));
  }
  if (customerEmail) {
    sends.push(transporter.sendMail({ from: fromHeader, to: customerEmail, subject: `Payment Confirmation — ${companyName || 'CoatingPro360'}`, html }));
  }
  await Promise.all(sends);
}

module.exports = {
  sendPasswordResetEmail,
  sendProposalAcceptedEmails,
  sendProposalLinkEmail,
  sendPaymentReceivedEmail,
};