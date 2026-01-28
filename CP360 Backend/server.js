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
app.use("/google-drive", googleDriveRoutes);



// ============================================================================
// HEALTH CHECK
// ============================================================================
app.get("/", (req, res) => {
  res.json({ status: "JobFlow Backend Running" });
});

// ============================================================================
// START SERVER
// ============================================================================
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
});

module.exports = app;