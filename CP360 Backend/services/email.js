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

async function sendProposalAcceptedEmails({ proposalId, bidName, signatureName, signedAt, customerEmail, customerName, contractorEmail, companyName, proposalUrl }) {
  const dateStr = new Date(signedAt).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

  // Email to contractor
  if (contractorEmail) {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
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
      from: process.env.EMAIL_FROM,
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

async function sendProposalLinkEmail({ toEmail, customerName, companyName, bidName, bidTotal, proposalUrl, fromName, fromEmail, emailType }) {
  const totalStr = `$${(parseFloat(bidTotal) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const displayName = fromName || companyName || 'CoatingPro360';
  const senderEmail = fromEmail || process.env.SMTP_USER || process.env.EMAIL_FROM;
  const fromHeader  = `"${displayName}" <${senderEmail}>`;

  const isInvoice   = emailType === 'invoice';
  const subject     = isInvoice
    ? `Your Invoice from ${displayName} — ${bidName}`
    : `Your Proposal from ${displayName} is Ready`;
  const buttonText  = isInvoice ? 'Click to See and Pay Your Invoice' : 'View &amp; Sign Your Proposal';
  const buttonColor = isInvoice ? '#1d4ed8' : '#16a34a';
  const docLabel    = isInvoice ? 'Invoice' : 'Proposal';
  const preheader   = isInvoice
    ? `Your invoice from ${displayName} for ${bidName} is ready.`
    : `Your proposal from ${displayName} is ready to review and sign.`;

  await transporter.sendMail({
    from: fromHeader,
    to: toEmail,
    subject,
    html: [
      `<div style="display:none!important;visibility:hidden;mso-hide:all;font-size:1px;color:#f9fafb;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">${preheader}</div>`,
      `<table width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">`,
      `<tr><td bgcolor="#1d4ed8" style="padding:24px 28px;border-radius:8px 8px 0 0">`,
      `<h2 style="color:#fff;margin:0;font-size:22px;font-family:Arial,sans-serif">${displayName}</h2>`,
      `</td></tr>`,
      `<tr><td bgcolor="#f9fafb" style="padding:28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">`,
      `<p style="font-size:16px;color:#111;margin:0 0 16px;font-family:Arial,sans-serif">Hi ${customerName || 'there'},</p>`,
      isInvoice
        ? `<p style="font-size:15px;color:#374151;margin:0 0 20px;font-family:Arial,sans-serif">Your invoice is ready. Click the button below to view and pay online.</p>`
        : `<p style="font-size:15px;color:#374151;margin:0 0 20px;font-family:Arial,sans-serif">Your proposal is ready to review. Click the button below to view the full details and sign when you're ready.</p>`,
      `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">`,
      `<tr><td bgcolor="#ffffff" style="border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px">`,
      `<p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;font-weight:bold;font-family:Arial,sans-serif">${docLabel}</p>`,
      `<p style="margin:0 0 8px;font-size:18px;font-weight:bold;color:#111;font-family:Arial,sans-serif">${bidName}</p>`,
      `<p style="margin:0;font-size:22px;font-weight:bold;color:#1d4ed8;font-family:Arial,sans-serif">${totalStr}</p>`,
      `</td></tr></table>`,
      `<table cellpadding="0" cellspacing="0" style="margin:0 auto 24px">`,
      `<tr><td bgcolor="${buttonColor}" style="border-radius:8px;padding:14px 28px">`,
      `<a href="${proposalUrl}" style="color:#fff;font-weight:bold;font-size:16px;text-decoration:none;font-family:Arial,sans-serif;white-space:nowrap">${buttonText}</a>`,
      `</td></tr></table>`,
      `<p style="font-size:12px;color:#9ca3af;margin:0;font-family:Arial,sans-serif">Or copy this link into your browser:<br>`,
      `<a href="${proposalUrl}" style="color:#1d4ed8">${proposalUrl}</a></p>`,
      `<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">`,
      `<p style="color:#9ca3af;font-size:12px;margin:0;font-family:Arial,sans-serif">${displayName}</p>`,
      `</td></tr></table>`,
    ].join(''),
  });
}

module.exports = {
  sendPasswordResetEmail,
  sendProposalAcceptedEmails,
  sendProposalLinkEmail,
};