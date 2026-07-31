/**
 * Run v2 schema migration
 * Creates 7 new tables + adds user_type_id to users
 * Safe to run multiple times (all statements use IF NOT EXISTS)
 *
 * Usage:
 *   cd "CP360 Backend"
 *   node scripts/run-v2-migration.js
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const fs = require('fs');
const { pool } = require('../config/database');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running v2 schema migration...');
    console.log('Connected to:', process.env.DATABASE_URL?.split('@')[1] || 'database');

    const sql = fs.readFileSync(
      path.resolve(__dirname, '../migrations/v2-schema.sql'),
      'utf8'
    );

    await client.query(sql);

    console.log('');
    console.log('✅ user_types table ready');
    console.log('✅ crews table ready');
    console.log('✅ crew_members table ready');
    console.log('✅ jobs table ready');
    console.log('✅ job_assignments table ready');
    console.log('✅ time_entries table ready');
    console.log('✅ job_materials table ready');
    console.log('✅ users.user_type_id column ready');
    console.log('');
    console.log('v2 migration complete.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    console.error(err);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

migrate();
