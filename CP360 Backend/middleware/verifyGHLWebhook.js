// middleware/verifyGHLWebhook.js
// Verifies the X-GHL-Signature (ED25519) header on incoming GHL webhook requests.
// Falls back gracefully during the transition period (legacy header deprecated July 1 2026).

const crypto = require('crypto');

const GHL_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAi2HR1srL4o18O8BRa7gVJY7G7bupbN3H9AwJrHCDiOg=
-----END PUBLIC KEY-----`;

module.exports = function verifyGHLWebhook(req, res, next) {
  const signature = req.headers['x-ghl-signature'];

  // No new signature header — allow through during transition period
  if (!signature) {
    console.warn('⚠️  GHL webhook: X-GHL-Signature missing (legacy request — allowed until July 1 2026)');
    return next();
  }

  const rawBody = req.rawBody;
  if (!rawBody) {
    console.warn('⚠️  GHL webhook: raw body unavailable, skipping signature check');
    return next();
  }

  try {
    const sigBuffer = Buffer.from(signature, 'base64');
    const isValid = crypto.verify(null, rawBody, GHL_PUBLIC_KEY, sigBuffer);

    if (!isValid) {
      console.error('❌ GHL webhook signature verification FAILED — request rejected');
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    console.log('✅ GHL webhook signature verified');
    next();
  } catch (err) {
    console.error('❌ GHL webhook signature error:', err.message);
    return res.status(401).json({ error: 'Signature verification error' });
  }
};
