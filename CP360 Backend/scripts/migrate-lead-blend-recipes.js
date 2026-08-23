require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lead_blend_recipes (
      id         SERIAL PRIMARY KEY,
      lead_id    INTEGER REFERENCES leads(id) ON DELETE CASCADE,
      company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      recipe     JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('lead_blend_recipes table created (or already existed)');
  await pool.end();
}

run().catch(err => { console.error(err); process.exit(1); });
