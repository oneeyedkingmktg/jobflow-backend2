// Migration: add mask storage + failure_type columns to visualizations table
// Run from CP360 Backend directory:
//   node scripts/migrations/add-compositing-fields.js

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env.local') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  console.log('Running migration: add compositing fields to visualizations...');
  await pool.query(`
    ALTER TABLE visualizations
      ADD COLUMN IF NOT EXISTS mask_key      TEXT,
      ADD COLUMN IF NOT EXISTS mask_url      TEXT,
      ADD COLUMN IF NOT EXISTS failure_type  VARCHAR(20);
  `);
  console.log('Done.');
  await pool.end();
}

main().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
