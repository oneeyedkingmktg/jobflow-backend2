/**
 * Migration: Add convenience_fee_percent to bidder_company_settings
 * Run once: node scripts/migrate-convenience-fee.js
 */

require('dotenv').config({ path: '.env.local' });
const { pool } = require('../config/database');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running convenience fee migration...');

    await client.query(`
      ALTER TABLE bidder_company_settings
        ADD COLUMN IF NOT EXISTS convenience_fee_percent DECIMAL(5,2) DEFAULT 0
    `);

    console.log('Done — convenience_fee_percent column added.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
