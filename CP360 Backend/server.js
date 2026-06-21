console.log("🔥 SERVER FILE LOADED");

// ============================================================================
// JobFlow Backend - Main Server (v3.4 - added GHL contact webhook)
// ============================================================================

// 🔴 DOTENV MUST BE FIRST
const path = require("path");

require("dotenv").config({
  path:
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, ".env.production")
      : path.resolve(__dirname, ".env.local"),
});

// Debug: confirm env is actually loaded
console.log("ENV CHECK:", {
  NODE_ENV: process.env.NODE_ENV,
  DEV_COMPANY_ID: process.env.DEV_COMPANY_ID,
});

// Debug: confirm database url is loaded
console.log(
  "DB CHECK:",
  process.env.DATABASE_URL ? "FOUND" : "MISSING"
);


const express = require("express");
const { startMonitoring } = require('./monitoring/scheduler');
const cors = require("cors");
const { initializeFirebase } = require('./config/firebase');
const estimatorPricingRoutes = require('./routes/estimatorPricing');
const { authenticateToken } = require("./middleware/auth");

// ============================================================================
// ROUTE IMPORTS
// ============================================================================

// Public routes
const authRoutes = require("./routes/auth");
const ghlWebhookRoutes = require("./routes/ghlWebhook");
const webhookRoutes = require("./routes/webhookRoutes");
const estimatorRoutes = require("./routes/estimator");
const pushNotificationRoutes = require('./routes/pushNotifications');
const googleDriveRoutes = require("./routes/googleDrive");


// Protected routes
const leadsRoutes = require("./routes/leads");
const usersRoutes = require("./routes/users");
const companiesRoutes = require("./routes/companies");
const ghlRoutes = require("./routes/ghl");
const messagesRoutes = require("./routes/messages");
const sipRoutes = require("./routes/sip");
const bidderRoutes = require("./routes/bidder");
const serviceCallsRoutes = require("./routes/serviceCalls");
const reportsRoutes = require("./routes/reports");
const holidaysRoutes = require("./routes/holidays");



// ============================================================================
// APP SETUP
// ============================================================================

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================================================
// GLOBAL MIDDLEWARE
// ============================================================================
app.use(cors());
app.use(express.json({
  limit: "10mb",
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));
app.use(express.urlencoded({ extended: true }));

// ============================================================================
// PUBLIC ROUTES (NO AUTH)
// ============================================================================
app.use("/auth", authRoutes);
app.use("/webhooks/ghl", ghlWebhookRoutes);
app.use("/api/webhooks", webhookRoutes); // NEW: GHL contact sync webhook

// 🔓 PUBLIC ESTIMATOR PREVIEW (MUST COME FIRST)
app.use("/estimator/preview", estimatorRoutes);
app.use('/api/estimator-pricing', estimatorPricingRoutes);

// ============================================================================
// PROTECTED ROUTES (JWT REQUIRED)
// ============================================================================
app.use("/leads", leadsRoutes);
app.use("/users", authenticateToken, usersRoutes);
app.use("/companies", authenticateToken, companiesRoutes);
app.use("/ghl", authenticateToken, ghlRoutes);
app.use("/estimator", estimatorRoutes);
app.use("/api/push", authenticateToken, pushNotificationRoutes);
app.use("/api/drive", authenticateToken, googleDriveRoutes);
app.use("/api/messages", messagesRoutes);
app.use("/api/sip", sipRoutes);
app.use("/google-drive", googleDriveRoutes);
app.use("/api/bidder", bidderRoutes);
app.use("/leads/:leadId/service-calls", serviceCallsRoutes);
app.use("/api/reports", authenticateToken, reportsRoutes);
app.use("/api/holidays", holidaysRoutes);



// ============================================================================
// HEALTH CHECK
// ============================================================================
app.get("/", (req, res) => {
  res.json({ status: "JobFlow Backend Running" });
});

// ============================================================================
// START SERVER
// ============================================================================
// ============================================================================
// STARTUP MIGRATIONS
// ============================================================================
const { pool } = require('./config/database');
async function runMigrations() {
  const migrations = [
    // companies — columns added over time without migrations
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS reports_enabled BOOLEAN DEFAULT false`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS ghl_sc_calendar TEXT`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS ghl_sc_assigned_user TEXT`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS ghl_appt_assigned_user TEXT`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS ghl_install_assigned_user TEXT`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS ghl_appt_title_template TEXT`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS ghl_install_title_template TEXT`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS ghl_appt_description_template TEXT`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS ghl_install_description_template TEXT`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS show_conversations BOOLEAN DEFAULT false`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS billing_status VARCHAR(50) DEFAULT 'active'`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS google_base_tag TEXT`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS meta_base_tag TEXT`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS google_conversion_event TEXT`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS meta_conversion_event TEXT`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS microsoft_base_tag TEXT`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS microsoft_conversion_event TEXT`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS service_area_zips JSONB`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS sip_domain TEXT`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS plan_type VARCHAR(50) DEFAULT 'pro'`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS est_push_title TEXT`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS est_push_body TEXT`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS bidder_enabled BOOLEAN DEFAULT false`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS google_drive_base_folder_id TEXT`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS estimator_enabled BOOLEAN DEFAULT false`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS estimator_code VARCHAR(10)`,
    // leads
    `ALTER TABLE leads ADD COLUMN IF NOT EXISTS sold_at TIMESTAMP`,
    `ALTER TABLE leads ADD COLUMN IF NOT EXISTS appt_set_at TIMESTAMP`,
    // report definitions
    `CREATE TABLE IF NOT EXISTS report_definitions (
      id SERIAL PRIMARY KEY,
      key VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `INSERT INTO report_definitions (key, name, description) VALUES
      ('recent_activity', 'Recent Activity', 'Count of new leads, appointments set, and jobs sold in the last 30 days'),
      ('conversions', 'Conversions', 'Lead-to-appointment-to-sold conversion rates for leads created 30–60 days ago')
    ON CONFLICT (key) DO NOTHING`,
    `ALTER TABLE bidder_company_settings ADD COLUMN IF NOT EXISTS email_from_name TEXT`,
    `ALTER TABLE bidder_company_settings ADD COLUMN IF NOT EXISTS email_from_email TEXT`,
    `ALTER TABLE bidder_company_settings ADD COLUMN IF NOT EXISTS proposal_top_text TEXT`,
    `ALTER TABLE bidder_company_settings ADD COLUMN IF NOT EXISTS invoice_top_text TEXT`,
    `ALTER TABLE bidder_company_settings ADD COLUMN IF NOT EXISTS proposal_domain TEXT`,
    `CREATE TABLE IF NOT EXISTS conversation_updates (
      contact_id TEXT PRIMARY KEY,
      company_id INTEGER,
      last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `ALTER TABLE conversation_updates RENAME COLUMN conversation_id TO contact_id`,
    // bidder_proposals — non-sequential 6-digit public URL identifier
    `ALTER TABLE bidder_proposals ADD COLUMN IF NOT EXISTS doc_number INTEGER`,
    `UPDATE bidder_proposals SET doc_number = ((id * 982451 + 123457) % 900000) + 100000 WHERE doc_number IS NULL`,
    `CREATE UNIQUE INDEX IF NOT EXISTS bidder_proposals_doc_number_idx ON bidder_proposals (doc_number)`,
    // status_events — persistent log of every lead status change (source of truth for recovery report)
    `CREATE TABLE IF NOT EXISTS status_events (
      id SERIAL PRIMARY KEY,
      lead_id INTEGER NOT NULL,
      company_id INTEGER NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS status_events_lead_id_idx ON status_events (lead_id)`,
    `CREATE INDEX IF NOT EXISTS status_events_company_status_created_idx ON status_events (company_id, to_status, created_at)`,
    // Backfill appt_booked events from existing appt_set_at timestamps (idempotent)
    `INSERT INTO status_events (lead_id, company_id, to_status, created_at)
      SELECT id, company_id, 'appt_booked', appt_set_at
      FROM leads
      WHERE appt_set_at IS NOT NULL AND deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM status_events se
          WHERE se.lead_id = leads.id AND se.to_status = 'appt_booked' AND se.created_at = leads.appt_set_at
        )`,
    // Backfill sold events from existing sold_at timestamps (idempotent)
    `INSERT INTO status_events (lead_id, company_id, to_status, created_at)
      SELECT id, company_id, 'sold', sold_at
      FROM leads
      WHERE sold_at IS NOT NULL AND deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM status_events se
          WHERE se.lead_id = leads.id AND se.to_status = 'sold' AND se.created_at = leads.sold_at
        )`,
    // automation_recovery report definition (upsert so name/description are always correct)
    `INSERT INTO report_definitions (key, name, description) VALUES
      ('automation_recovery', 'Automation Recovery', 'See how many appointments and sold jobs came back after manual follow-up had stalled.')
      ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description`,
    // Restore recent_activity row in case its name was accidentally overwritten
    `UPDATE report_definitions
      SET name = 'Recent Activity',
          description = 'Count of new leads, appointments set, and jobs sold in the last 30 days'
      WHERE key = 'recent_activity'`,
    // holidays table
    `CREATE TABLE IF NOT EXISTS holidays (
      id   SERIAL PRIMARY KEY,
      date DATE NOT NULL,
      name TEXT NOT NULL,
      UNIQUE(date)
    )`,
    // PayPal payment processor columns
    `ALTER TABLE bidder_company_settings ADD COLUMN IF NOT EXISTS paypal_client_id TEXT`,
    `ALTER TABLE bidder_company_settings ADD COLUMN IF NOT EXISTS paypal_secret_key TEXT`,
    `ALTER TABLE bidder_company_settings ADD COLUMN IF NOT EXISTS payment_processor VARCHAR(20) DEFAULT 'stripe'`,
    // Per-finish minimum job prices (replaces global minimum_job_price)
    `ALTER TABLE estimator_configs ADD COLUMN IF NOT EXISTS min_price_solid NUMERIC DEFAULT 0`,
    `ALTER TABLE estimator_configs ADD COLUMN IF NOT EXISTS min_price_flake NUMERIC DEFAULT 0`,
    `ALTER TABLE estimator_configs ADD COLUMN IF NOT EXISTS min_price_metallic NUMERIC DEFAULT 0`,
    `ALTER TABLE estimator_configs ADD COLUMN IF NOT EXISTS min_price_custom NUMERIC DEFAULT 0`,
    `UPDATE estimator_configs SET
      min_price_solid = COALESCE(NULLIF(min_price_solid, 0), minimum_job_price, 0),
      min_price_flake = COALESCE(NULLIF(min_price_flake, 0), minimum_job_price, 0),
      min_price_metallic = COALESCE(NULLIF(min_price_metallic, 0), minimum_job_price, 0),
      min_price_custom = COALESCE(NULLIF(min_price_custom, 0), minimum_job_price, 0)
    WHERE minimum_job_price IS NOT NULL AND minimum_job_price > 0`,
    `ALTER TABLE estimator_configs DROP COLUMN IF EXISTS minimum_job_price`,
    // permissions system
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS service_calls_enabled BOOLEAN DEFAULT false`,
    // estimator_leads — add 'custom' to selected_quality check constraint
    `ALTER TABLE estimator_leads DROP CONSTRAINT IF EXISTS estimator_leads_selected_quality_check`,
    `ALTER TABLE estimator_leads ADD CONSTRAINT estimator_leads_selected_quality_check CHECK (selected_quality IN ('solid', 'flake', 'metallic', 'custom'))`,
  ];
  for (const sql of migrations) {
    try {
      await pool.query(sql);
      console.log('Migration OK:', sql.slice(0, 80));
    } catch (e) {
      console.warn('Migration skipped:', e.message, '|', sql.slice(0, 80));
    }
  }
  console.log('Migrations complete');

  // Auto-seed holidays if the table is empty
  try {
    const { rows } = await pool.query('SELECT COUNT(*) FROM holidays');
    if (parseInt(rows[0].count, 10) === 0) {
      console.log('📅 Holidays table empty — seeding now...');
      const { seedInitial } = require('./services/holidayService');
      await seedInitial();
    }
  } catch (e) {
    console.warn('Holiday auto-seed skipped:', e.message);
  }
}
runMigrations();

// Initialize Firebase
initializeFirebase();
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║        JobFlow Backend API Server      ║
║        Port: ${PORT}
║        Environment: ${process.env.NODE_ENV || "development"}
╚════════════════════════════════════════╝
`);
  console.log('DEBUG - KEY_MONITOR_ENABLED:', process.env.KEY_MONITOR_ENABLED);
  console.log('DEBUG - ALERT_EMAIL:', process.env.ALERT_EMAIL);
  startMonitoring();

});

module.exports = app;