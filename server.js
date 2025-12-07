// ============================================================================
// JobFlow Backend - Main Server
// ============================================================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Import routes
const authRoutes = require('./routes/auth');
const leadsRoutes = require('./routes/leads');
const usersRoutes = require('./routes/users');
const companiesRoutes = require('./routes/companies');
const ghlRoutes = require('./routes/ghl'); // ADDED

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================================================
// MIDDLEWARE
// ============================================================================

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ============================================================================
// ROUTES
// ============================================================================

app.use('/auth', authRoutes);
app.use('/leads', leadsRoutes);
app.use('/users', usersRoutes);
app.use('/companies', companiesRoutes);
app.use('/ghl', ghlRoutes); // ADDED

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
║   JobFlow Backend API Server           ║
║   Port: ${PORT}                        ║
║   Environment: ${process.env.NODE_ENV || 'development'}        ║
╚════════════════════════════════════════╝
  `);
});

module.exports = app;
