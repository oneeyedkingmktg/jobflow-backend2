/**
 * Migration: Add Microsoft/Bing UET tracking fields to companies table
 * Run once: node scripts/migrate-microsoft-tracking.js
 */

require('dotenv').config({ path: '.env.local' });
const { pool } = require('../config/database');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running Microsoft tracking migration...');

    await client.query(`
      ALTER TABLE companies
        ADD COLUMN IF NOT EXISTS microsoft_base_tag TEXT,
        ADD COLUMN IF NOT EXISTS microsoft_conversion_event TEXT;
    `);
    console.log('✅ companies table: microsoft_base_tag, microsoft_conversion_event added');

    console.log('\nMicrosoft tracking migration complete.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

migrate();
