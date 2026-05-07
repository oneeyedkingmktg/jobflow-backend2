/**
 * Migration: Add Stripe payment keys to bidder_company_settings
 * Run once: node scripts/migrate-stripe-settings.js
 */

require('dotenv').config({ path: '.env.local' });
const { pool } = require('../config/database');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running Stripe settings migration...');

    await client.query(`
      ALTER TABLE bidder_company_settings
        ADD COLUMN IF NOT EXISTS stripe_publishable_key TEXT,
        ADD COLUMN IF NOT EXISTS stripe_secret_key TEXT
    `);

    console.log('Done — stripe_publishable_key and stripe_secret_key columns added.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
