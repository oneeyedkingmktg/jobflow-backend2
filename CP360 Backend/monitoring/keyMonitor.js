// Key Monitor - Tracks GHL API key changes
const pool = require('../config/database');
const nodemailer = require('nodemailer');

const ENABLED = process.env.KEY_MONITOR_ENABLED === 'true';
const ALERT_EMAIL = process.env.ALERT_EMAIL || 'your-email@example.com';

// Store key hashes in memory (or use a separate monitoring table)
let lastKnownKeys = {};

async function checkKeys() {
  if (!ENABLED) return;
  
  try {
    const result = await pool.query(
      `SELECT id, company_name, ghl_api_key FROM companies WHERE deleted_at IS NULL`
    );
    
    const changes = [];
    const now = new Date().toISOString();
    
    for (const company of result.rows) {
      const currentKey = company.ghl_api_key;
      const lastKey = lastKnownKeys[company.id];
      
      if (lastKey && lastKey !== currentKey) {
        changes.push({
          companyId: company.id,
          companyName: company.company_name,
          timestamp: now
        });
      }
      
      lastKnownKeys[company.id] = currentKey;
    }
    
    if (changes.length > 0) {
      await sendAlert(changes);
    }
    
    await sendDailySummary(changes.length === 0);
    
  } catch (error) {
    console.error('Key monitor error:', error);
  }
}

async function sendAlert(changes) {
  const subject = `🚨 GHL API Key Change Detected`;
  const body = `
API keys changed for the following companies:

${changes.map(c => `- Company ID ${c.companyId} (${c.companyName}) at ${c.timestamp}`).join('\n')}

To disable monitoring:
Set KEY_MONITOR_ENABLED=false in environment variables
  `;
  
  await sendEmail(subject, body);
}

async function sendDailySummary(noErrors) {
  const subject = noErrors ? '✅ Daily Key Monitor - No Changes' : '⚠️ Daily Key Monitor - Changes Detected';
  const body = noErrors 
    ? `No API key changes detected today.\n\nTo disable: Set KEY_MONITOR_ENABLED=false`
    : `API key changes were detected today. Check previous alert emails for details.`;
    
  await sendEmail(subject, body);
}

async function sendEmail(subject, body) {
  const nodemailer = require('nodemailer');
  
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  });
  
  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to: ALERT_EMAIL,
    subject,
    text: body
  });
}

module.exports = { checkKeys };