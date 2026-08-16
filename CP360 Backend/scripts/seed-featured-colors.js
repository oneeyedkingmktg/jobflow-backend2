// ============================================================================
// Seed default featured chip colors for all companies
// Seeds 6 popular neutrals into company_chip_selections for every company
//
// Run from CP360 Backend directory:
//   node scripts/seed-featured-colors.js
//
// Safe to re-run — uses ON CONFLICT DO NOTHING.
// ============================================================================

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// 6 neutrals — warm, cool, light, mid, dark gray, warm beige
// Covers the most common epoxy floor color requests
const FEATURED_NAMES = [
  'Sand Dollar',   // warm beige — most popular starter color
  'Feather Gray',  // medium cool gray — #1 selling gray
  'Nimbus',        // light cool gray
  'Gracious',      // warm neutral blend (antique white/taupe/granite)
  'Avalanche',     // bright white/light — clean garage look
  'Timberwolf',    // darker charcoal gray
];

async function main() {
  // Resolve names to IDs
  const { rows: colorRows } = await pool.query(
    `SELECT id, name FROM chip_colors WHERE LOWER(name) = ANY($1::text[]) AND is_active = true`,
    [FEATURED_NAMES.map((n) => n.toLowerCase())]
  );

  if (colorRows.length === 0) {
    console.error('No matching chip colors found. Run scrape-torginol.js first.');
    process.exit(1);
  }

  console.log(`Found ${colorRows.length}/${FEATURED_NAMES.length} colors:`);
  colorRows.forEach((c) => console.log(`  ${c.id}: ${c.name}`));

  const missing = FEATURED_NAMES.filter(
    (n) => !colorRows.find((c) => c.name.toLowerCase() === n.toLowerCase())
  );
  if (missing.length) console.warn(`  Warning — not found: ${missing.join(', ')}`);

  // Get all active companies
  const { rows: companies } = await pool.query(
    `SELECT id, name FROM companies WHERE deleted_at IS NULL ORDER BY id`
  );
  console.log(`\nSeeding ${colorRows.length} colors for ${companies.length} companies...\n`);

  for (const company of companies) {
    let inserted = 0;
    for (let i = 0; i < colorRows.length; i++) {
      const color = colorRows[i];
      // Sort order matches FEATURED_NAMES order for consistent display
      const sortOrder = FEATURED_NAMES.findIndex(
        (n) => n.toLowerCase() === color.name.toLowerCase()
      );
      await pool.query(
        `INSERT INTO company_chip_selections (company_id, chip_color_id, sort_order)
         VALUES ($1, $2, $3)
         ON CONFLICT (company_id, chip_color_id) DO NOTHING`,
        [company.id, color.id, sortOrder]
      );
      inserted++;
    }
    console.log(`  ${company.name} — ${inserted} colors seeded`);
  }

  console.log('\nDone.');
  await pool.end();
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
