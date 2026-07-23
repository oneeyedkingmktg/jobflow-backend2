// Run: node scripts/migrate-warranties.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: path.resolve(__dirname, '../.env.production') });
}

const pool = require('../config/database');

async function migrate() {
  console.log('Running warranties migration…');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS warranties (
      id               SERIAL PRIMARY KEY,
      company_id       INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      internal_name    TEXT NOT NULL,
      warranty_title   TEXT NOT NULL,
      warranty_pdf_url TEXT NOT NULL,
      is_default       BOOLEAN DEFAULT false,
      created_at       TIMESTAMP DEFAULT NOW(),
      updated_at       TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('✓ warranties table');

  await pool.query(`
    ALTER TABLE bidder_proposals
    ADD COLUMN IF NOT EXISTS warranty_id INTEGER REFERENCES warranties(id) ON DELETE SET NULL
  `);
  console.log('✓ bidder_proposals.warranty_id');

  console.log('Migration complete!');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
