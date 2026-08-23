require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS company_custom_blends (
      id         SERIAL PRIMARY KEY,
      company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      recipe     JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ccb_company ON company_custom_blends(company_id)`);
  console.log('company_custom_blends table ready');
  await pool.end();
}

run().catch(err => { console.error(err); process.exit(1); });
