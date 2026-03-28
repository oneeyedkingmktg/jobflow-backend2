/**
 * Migration: Add last_synced_install_end_date to leads table
 * Run once: node "CP360 Backend/scripts/migrate-install-end-date-sync.js"
 */

require('dotenv').config({ path: '.env.local' });
const { pool } = require('../config/database');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running last_synced_install_end_date migration...');

    await client.query(`
      ALTER TABLE leads
      ADD COLUMN IF NOT EXISTS last_synced_install_end_date DATE;
    `);
    console.log('✅ last_synced_install_end_date column added to leads');

    console.log('Migration complete.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

migrate();
