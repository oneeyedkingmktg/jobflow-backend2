/**
 * Migration: Create all Bidder feature tables + company GHL value columns
 * Run once: node scripts/migrate-bidder.js
 */

require('dotenv').config({ path: '.env.local' });
const { pool } = require('../config/database');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running Bidder migration...');

    // ── GHL company value columns on companies table ──────────────────────
    await client.query(`
      ALTER TABLE companies
        ADD COLUMN IF NOT EXISTS ghl_company_name TEXT,
        ADD COLUMN IF NOT EXISTS ghl_company_from_name TEXT,
        ADD COLUMN IF NOT EXISTS ghl_company_from_email TEXT,
        ADD COLUMN IF NOT EXISTS ghl_company_phone TEXT,
        ADD COLUMN IF NOT EXISTS ghl_company_website TEXT,
        ADD COLUMN IF NOT EXISTS ghl_company_street_address TEXT,
        ADD COLUMN IF NOT EXISTS ghl_company_city TEXT,
        ADD COLUMN IF NOT EXISTS ghl_company_state TEXT,
        ADD COLUMN IF NOT EXISTS ghl_company_zip TEXT;
    `);
    console.log('✅ companies table: GHL custom value columns added');

    // ── bidder_proposal_designs (master-level PDF template library) ───────
    await client.query(`
      CREATE TABLE IF NOT EXISTS bidder_proposal_designs (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        template_content TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ bidder_proposal_designs table ready');

    // ── bidder_categories (per-company item library buckets) ──────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS bidder_categories (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true
      );
    `);
    console.log('✅ bidder_categories table ready');

    // ── bidder_library_items (per-company line item library) ──────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS bidder_library_items (
        id SERIAL PRIMARY KEY,
        category_id INTEGER NOT NULL REFERENCES bidder_categories(id) ON DELETE CASCADE,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        default_unit_price NUMERIC(10,4) DEFAULT 0,
        default_unit_label TEXT,
        is_included BOOLEAN DEFAULT false,
        show_quantity BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0
      );
    `);
    console.log('✅ bidder_library_items table ready');

    // ── bidder_proposals ──────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS bidder_proposals (
        id SERIAL PRIMARY KEY,
        lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        bid_name TEXT NOT NULL,
        bid_description TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        presented_date DATE,
        accepted_date DATE,
        salesman TEXT,
        install_crew TEXT,
        install_date DATE,
        install_date_tbd BOOLEAN DEFAULT false,
        output_mode TEXT NOT NULL DEFAULT 'lump_sum',
        customer_notes TEXT,
        internal_notes TEXT,
        bid_total NUMERIC(10,2) DEFAULT 0,
        down_payment_type TEXT NOT NULL DEFAULT 'percent',
        down_payment_value NUMERIC(10,2) DEFAULT 50,
        down_payment_amount NUMERIC(10,2) DEFAULT 0,
        balance_due NUMERIC(10,2) DEFAULT 0,
        payment_url TEXT,
        include_payment_button BOOLEAN DEFAULT true,
        proposal_design_id INTEGER REFERENCES bidder_proposal_designs(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ bidder_proposals table ready');

    // ── bidder_proposal_items (line items on a bid, from library or freeform)
    await client.query(`
      CREATE TABLE IF NOT EXISTS bidder_proposal_items (
        id SERIAL PRIMARY KEY,
        proposal_id INTEGER NOT NULL REFERENCES bidder_proposals(id) ON DELETE CASCADE,
        library_item_id INTEGER REFERENCES bidder_library_items(id) ON DELETE SET NULL,
        category_name TEXT,
        name TEXT NOT NULL,
        description TEXT,
        unit_price NUMERIC(10,4) DEFAULT 0,
        unit_label TEXT,
        quantity NUMERIC(10,2),
        line_total NUMERIC(10,2) DEFAULT 0,
        is_included BOOLEAN DEFAULT false,
        is_optional BOOLEAN DEFAULT false,
        is_accepted BOOLEAN,
        is_freeform BOOLEAN DEFAULT false,
        sort_order INTEGER DEFAULT 0
      );
    `);
    console.log('✅ bidder_proposal_items table ready');

    // ── bidder_custom_items (flat description/qty/price rows on a bid) ────
    await client.query(`
      CREATE TABLE IF NOT EXISTS bidder_custom_items (
        id SERIAL PRIMARY KEY,
        proposal_id INTEGER NOT NULL REFERENCES bidder_proposals(id) ON DELETE CASCADE,
        description TEXT NOT NULL,
        quantity NUMERIC(10,2) DEFAULT 1,
        price_each NUMERIC(10,2) DEFAULT 0,
        line_total NUMERIC(10,2) DEFAULT 0,
        sort_order INTEGER DEFAULT 0
      );
    `);
    console.log('✅ bidder_custom_items table ready');

    // ── bidder_discounts ──────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS bidder_discounts (
        id SERIAL PRIMARY KEY,
        proposal_id INTEGER NOT NULL REFERENCES bidder_proposals(id) ON DELETE CASCADE,
        description TEXT NOT NULL,
        discount_type TEXT NOT NULL DEFAULT 'dollar',
        discount_value NUMERIC(10,2) DEFAULT 0,
        discount_amount NUMERIC(10,2) DEFAULT 0,
        if_accepted_by DATE,
        sort_order INTEGER DEFAULT 0
      );
    `);
    console.log('✅ bidder_discounts table ready');

    // ── bidder_company_settings ───────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS bidder_company_settings (
        company_id INTEGER PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
        default_payment_url TEXT,
        include_payment_button BOOLEAN DEFAULT true,
        down_payment_default_percent NUMERIC(5,2) DEFAULT 50,
        preferred_proposal_design_id INTEGER REFERENCES bidder_proposal_designs(id) ON DELETE SET NULL,
        terms_and_conditions TEXT,
        system_notes TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ bidder_company_settings table ready');

    // ── Indexes ───────────────────────────────────────────────────────────
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_bidder_proposals_lead_id ON bidder_proposals(lead_id);
      CREATE INDEX IF NOT EXISTS idx_bidder_proposals_company_id ON bidder_proposals(company_id);
      CREATE INDEX IF NOT EXISTS idx_bidder_proposal_items_proposal_id ON bidder_proposal_items(proposal_id);
      CREATE INDEX IF NOT EXISTS idx_bidder_custom_items_proposal_id ON bidder_custom_items(proposal_id);
      CREATE INDEX IF NOT EXISTS idx_bidder_discounts_proposal_id ON bidder_discounts(proposal_id);
      CREATE INDEX IF NOT EXISTS idx_bidder_library_items_company_id ON bidder_library_items(company_id);
      CREATE INDEX IF NOT EXISTS idx_bidder_categories_company_id ON bidder_categories(company_id);
    `);
    console.log('✅ Indexes created');

    console.log('\nBidder migration complete.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

migrate();
