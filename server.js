// ============================================================================
// JobFlow Backend - Main Server (v3.0 unified architecture)
// ============================================================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { authenticateToken } = require('./middleware/auth');

// Public routes
const authRoutes = require('./routes/auth');
const ghlWebhookRoutes = require('./routes/ghlWebhook');

// Protected routes
const leadsRoutes = require('./routes/leads');
const usersRoutes = require('./routes/users');
const companiesRoutes = require('./routes/companies');
const ghlRoutes = require('./routes/ghl');

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================================================
// GLOBAL MIDDLEWARE
// ============================================================================
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ============================================================================
// PUBLIC ROUTES (NO AUTH)
// ============================================================================
app.use('/auth', authRoutes);

// Webhooks (external system cannot send JWT)
app.use('/webhooks/ghl', ghlWebhookRoutes);

// ============================================================================
// PROTECTED ROUTES (JWT REQUIRED)
// ============================================================================
app.use('/leads', authenticateToken, leadsRoutes);
app.use('/users', authenticateToken, usersRoutes);
app.use('/companies', authenticateToken, companiesRoutes);
app.use('/ghl', authenticateToken, ghlRoutes);

// ============================================================================
// HEALTH CHECK
// ============================================================================
app.get('/', (req, res) => {
  res.json({ status: 'JobFlow Backend Running' });
});

// ============================================================================
// START SERVER
// ============================================================================
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║        JobFlow Backend API Server      ║
║        Port: ${PORT}                            
║        Environment: ${process.env.NODE_ENV || 'development'}      
╚════════════════════════════════════════╝
`);
});

module.exports = app;
