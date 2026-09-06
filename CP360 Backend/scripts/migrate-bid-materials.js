// Run: node "CP360 Backend/scripts/migrate-bid-materials.js"
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: path.resolve(__dirname, '../.env.production') });
}

const pool = require('../config/database');

async function migrate() {
  console.log('Running bid-materials migration…');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bid_material_overrides (
      id SERIAL PRIMARY KEY,
      proposal_id INTEGER NOT NULL REFERENCES bidder_proposals(id) ON DELETE CASCADE,
      library_item_id INTEGER NOT NULL REFERENCES bidder_library_items(id) ON DELETE CASCADE,
      order_qty NUMERIC(10,4),
      unit_cost NUMERIC(10,4),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(proposal_id, library_item_id)
    )
  `);
  console.log('✓ bid_material_overrides table');

  console.log('Migration complete.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
