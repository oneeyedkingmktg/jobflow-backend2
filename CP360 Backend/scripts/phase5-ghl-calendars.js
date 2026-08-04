// Migration: Phase 5 — GHL Calendar Integration
// Adds salesman_ghl_event_id and crew_ghl_event_id columns to leads table
// Safe to run multiple times (IF NOT EXISTS)

require("dotenv").config({ path: require("path").join(__dirname, "../.env.local") });
const db = require("../config/database");

async function migrate() {
  console.log("Running Phase 5 migration...");

  await db.query(`
    ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS salesman_ghl_event_id TEXT,
    ADD COLUMN IF NOT EXISTS crew_ghl_event_id TEXT
  `);

  console.log("✅ Added salesman_ghl_event_id and crew_ghl_event_id to leads table");
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
