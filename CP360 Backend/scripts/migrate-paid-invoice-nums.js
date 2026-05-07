/**
 * Migration: Add paid_invoice_nums to bidder_proposals
 * Tracks which individual invoice numbers have been paid (comma-separated, e.g. "1,F")
 * Run once: node scripts/migrate-paid-invoice-nums.js
 */

require('dotenv').config({ path: '.env.local' });
const { pool } = require('../config/database');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running paid_invoice_nums migration...');
    await client.query(`
      ALTER TABLE bidder_proposals
        ADD COLUMN IF NOT EXISTS paid_invoice_nums TEXT DEFAULT ''
    `);
    console.log('Done — paid_invoice_nums column added.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
