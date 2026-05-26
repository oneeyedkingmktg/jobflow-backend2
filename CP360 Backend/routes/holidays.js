const express = require('express');
const router  = express.Router();
const pool    = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// GET /api/holidays?from=2026-01-01&to=2027-12-31
// Returns all holidays in the requested range (defaults to current + next year)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const year = new Date().getFullYear();
    const from = req.query.from || `${year}-01-01`;
    const to   = req.query.to   || `${year + 1}-12-31`;

    const result = await pool.query(
      `SELECT date::text, name FROM holidays WHERE date BETWEEN $1 AND $2 ORDER BY date`,
      [from, to]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('GET /api/holidays error:', err);
    res.status(500).json({ error: 'Failed to fetch holidays' });
  }
});

module.exports = router;
