/**
 * Migration: Add plan_type to companies table
 * Run once: node scripts/migrate-plan-type.js
 */

require('dotenv').config({ path: '.env.local' });
const { pool } = require('../config/database');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running plan_type migration...');

    await client.query(`
      ALTER TABLE companies
      ADD COLUMN IF NOT EXISTS plan_type VARCHAR(20) NOT NULL DEFAULT 'pro';
    `);
    console.log('✅ plan_type column added to companies (default: pro)');

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
