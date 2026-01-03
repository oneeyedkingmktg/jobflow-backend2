console.log("🔥 SERVER FILE LOADED");

// ============================================================================
// JobFlow Backend - Main Server (v3.4 - added GHL contact webhook)
// ============================================================================

// 🔴 DOTENV MUST BE FIRST
require("dotenv").config({
  path: require("path").resolve(__dirname, ".env"),
});

// Debug: confirm env is actually loaded
console.log("ENV CHECK:", {
  NODE_ENV: process.env.NODE_ENV,
  DEV_AUTH_BYPASS: process.env.DEV_AUTH_BYPASS,
  DEV_COMPANY_ID: process.env.DEV_COMPANY_ID,
});

const express = require("express");
const cors = require("cors");

const { authenticateToken } = require("./middleware/auth");

// ============================================================================
// ROUTE IMPORTS
// ============================================================================

// Public routes
const authRoutes = require("./routes/auth");
const ghlWebhookRoutes = require("./routes/ghlWebhook");
const webhookRoutes = require("./routes/webhookRoutes");
const estimatorRoutes = require("./routes/estimator");

// Protected routes
const leadsRoutes = require("./routes/leads");
const usersRoutes = require("./routes/users");
const companiesRoutes = require("./routes/companies");
const ghlRoutes = require("./routes/ghl");

// ============================================================================
// APP SETUP
// ============================================================================

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================================================
// GLOBAL MIDDLEWARE
// ============================================================================
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ============================================================================
// PUBLIC ROUTES (NO AUTH)
// ============================================================================
app.use("/auth", authRoutes);
app.use("/webhooks/ghl", ghlWebhookRoutes);
app.use("/api/webhooks", webhookRoutes); // NEW: GHL contact sync webhook

// 🔓 PUBLIC ESTIMATOR PREVIEW (MUST COME FIRST)
app.use("/estimator/preview", estimatorRoutes);

// ============================================================================
// PROTECTED ROUTES (JWT REQUIRED)
// ============================================================================
app.use("/leads", leadsRoutes);
app.use("/users", authenticateToken, usersRoutes);
app.use("/companies", authenticateToken, companiesRoutes);
app.use("/ghl", authenticateToken, ghlRoutes);
app.use("/estimator", estimatorRoutes);

// ============================================================================
// HEALTH CHECK
// ============================================================================
app.get("/", (req, res) => {
  res.json({ status: "JobFlow Backend Running" });
});

// ============================================================================
// START SERVER
// ============================================================================
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║        JobFlow Backend API Server      ║
║        Port: ${PORT}
║        Environment: ${process.env.NODE_ENV || "development"}
╚════════════════════════════════════════╝
`);
});

module.exports = app;