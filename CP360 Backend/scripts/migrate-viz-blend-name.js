require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  await pool.query(`ALTER TABLE visualizations ADD COLUMN IF NOT EXISTS blend_name TEXT`);
  console.log('visualizations.blend_name column ready');
  await pool.end();
}
run().catch(err => { console.error(err); process.exit(1); });
