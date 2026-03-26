/**
 * services/ghlCompanySync.js
 * Fetches GHL location custom values and stores them on the company record.
 * Call fire-and-forget from webhook handlers — errors are logged but never
 * surface to the caller.
 */

const CryptoJS = require('crypto-js');
const { pool } = require('../config/database');
const { createGhlClient } = require('./ghlClient');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'change-this-encryption-key';

// Mirrors the resolveApiKey logic in controllers/ghlAPI.js
function resolveApiKey(storedValue) {
  if (!storedValue) return null;
  try {
    const bytes = CryptoJS.AES.decrypt(storedValue, ENCRYPTION_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (decrypted && decrypted.trim().length >= 20) return decrypted.trim();
  } catch (_) {}
  // Fallback: stored as plain text
  return storedValue.trim().length >= 20 ? storedValue.trim() : null;
}

// Maps GHL fieldKey → companies column name
const FIELD_KEY_MAP = {
  'custom_values.company_name':           'ghl_company_name',
  'custom_values.company_from_name':      'ghl_company_from_name',
  'custom_values.company_from_email':     'ghl_company_from_email',
  'custom_values.company_phone':          'ghl_company_phone',
  'custom_values.company_website':        'ghl_company_website',
  'custom_values.company_street_address': 'ghl_company_street_address',
  'custom_values.company_city':           'ghl_company_city',
  'custom_values.company_state':          'ghl_company_state',
  'custom_values.company_zip':            'ghl_company_zip',
};

/**
 * syncCompanyValues(companyId)
 * Fetches GHL custom values for the company's location and updates the
 * companies table. Safe to call fire-and-forget.
 */
async function syncCompanyValues(companyId) {
  try {
    const result = await pool.query(
      'SELECT ghl_api_key, ghl_location_id FROM companies WHERE id = $1',
      [companyId]
    );

    if (!result.rows.length) return;

    const { ghl_api_key, ghl_location_id } = result.rows[0];
    const apiKey = resolveApiKey(ghl_api_key);

    if (!apiKey || !ghl_location_id) {
      console.log(`[GHL Sync] Company ${companyId} has no GHL credentials — skipping custom value sync`);
      return;
    }

    const ghl = createGhlClient({ ghl_api_key: apiKey, ghl_location_id });
    const customValues = await ghl.getCustomValues();

    if (!customValues.length) return;

    // Build UPDATE from the values we care about
    const updates = {};
    for (const cv of customValues) {
      const col = FIELD_KEY_MAP[cv.fieldKey];
      if (col && cv.value != null) {
        updates[col] = cv.value;
      }
    }

    if (!Object.keys(updates).length) return;

    const fields = Object.keys(updates).map((col, i) => `${col} = $${i + 1}`);
    const values = Object.values(updates);
    values.push(companyId);

    await pool.query(
      `UPDATE companies SET ${fields.join(', ')} WHERE id = $${values.length}`,
      values
    );

    console.log(`[GHL Sync] Updated ${Object.keys(updates).length} company values for company ${companyId}`);
  } catch (err) {
    // Never throw — this is fire-and-forget
    console.error(`[GHL Sync] Failed to sync company values for company ${companyId}:`, err.message);
  }
}

module.exports = { syncCompanyValues };
