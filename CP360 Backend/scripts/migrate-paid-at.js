/**
 * Migration: Add paid_at to bidder_proposals
 * Run once: node scripts/migrate-paid-at.js
 */

require('dotenv').config({ path: '.env.local' });
const { pool } = require('../config/database');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running paid_at migration...');
    await client.query(`
      ALTER TABLE bidder_proposals
        ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP
    `);
    console.log('Done — paid_at column added.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
