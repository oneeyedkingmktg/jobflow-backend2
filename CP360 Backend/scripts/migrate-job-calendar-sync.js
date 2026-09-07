/**
 * Migration: Add GHL calendar event ID columns to jobs table
 * Run once: node scripts/migrate-job-calendar-sync.js
 */

require('dotenv').config({ path: '.env.local' });
const { pool } = require('../config/database');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE jobs
        ADD COLUMN IF NOT EXISTS ghl_appt_event_id    TEXT,
        ADD COLUMN IF NOT EXISTS ghl_install_event_id TEXT;
    `);
    console.log('✅ jobs table: ghl_appt_event_id, ghl_install_event_id added');
    console.log('Migration complete.');
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(() => process.exit(1));
