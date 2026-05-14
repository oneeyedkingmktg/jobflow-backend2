/**
 * Migration: Add doc_number to bidder_proposals
 * Replaces sequential IDs in public URLs with a non-guessable 6-digit number.
 * Run once: node scripts/migrate-doc-number.js
 */

require('dotenv').config({ path: '.env.local' });
const { pool } = require('../config/database');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running doc_number migration...');

    await client.query(`
      ALTER TABLE bidder_proposals
        ADD COLUMN IF NOT EXISTS doc_number INTEGER
    `);

    // Populate existing rows using the same scramble as docId() on the frontend
    const updated = await client.query(`
      UPDATE bidder_proposals
      SET doc_number = ((id * 982451 + 123457) % 900000) + 100000
      WHERE doc_number IS NULL
      RETURNING id, doc_number
    `);
    console.log(`Populated doc_number for ${updated.rowCount} existing proposals.`);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS bidder_proposals_doc_number_idx
      ON bidder_proposals (doc_number)
    `);

    console.log('Done — doc_number column added and indexed.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
