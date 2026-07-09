const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { pool } = require('../config/database');

router.use(authenticateToken);

// GET /api/blocked-times — admin sees all for company, user sees only their own
router.get('/', async (req, res) => {
  try {
    const { id: userId, role, company_id } = req.user;

    let query = `
      SELECT bt.*, u.name AS user_name
      FROM blocked_times bt
      LEFT JOIN users u ON u.id = bt.user_id
      WHERE bt.company_id = $1
    `;
    const params = [company_id];

    if (role !== 'admin' && role !== 'master') {
      query += ` AND bt.user_id = $${params.length + 1}`;
      params.push(userId);
    }

    query += ' ORDER BY bt.date, bt.start_time NULLS FIRST';

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (e) {
    console.error('GET /api/blocked-times error:', e);
    res.status(500).json({ error: 'Failed to fetch blocked times' });
  }
});

// POST /api/blocked-times
router.post('/', async (req, res) => {
  try {
    const { id: userId, company_id } = req.user;
    const { name, applies_to, date, all_day, start_time, end_time } = req.body;

    if (!name || !applies_to || !date) {
      return res.status(400).json({ error: 'name, applies_to, and date are required' });
    }

    const { rows } = await pool.query(
      `INSERT INTO blocked_times (company_id, user_id, name, applies_to, date, all_day, start_time, end_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [company_id, userId, name.trim(), applies_to, date, all_day ?? false, start_time || null, end_time || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error('POST /api/blocked-times error:', e);
    res.status(500).json({ error: 'Failed to create blocked time' });
  }
});

// PUT /api/blocked-times/:id
router.put('/:id', async (req, res) => {
  try {
    const { id: userId, role, company_id } = req.user;
    const { id } = req.params;
    const { name, applies_to, date, all_day, start_time, end_time } = req.body;

    const existing = await pool.query(
      'SELECT * FROM blocked_times WHERE id = $1 AND company_id = $2',
      [id, company_id]
    );
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    if (role !== 'admin' && role !== 'master' && existing.rows[0].user_id !== parseInt(userId)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { rows } = await pool.query(
      `UPDATE blocked_times
       SET name=$1, applies_to=$2, date=$3, all_day=$4, start_time=$5, end_time=$6
       WHERE id=$7 AND company_id=$8
       RETURNING *`,
      [name.trim(), applies_to, date, all_day ?? false, start_time || null, end_time || null, id, company_id]
    );
    res.json(rows[0]);
  } catch (e) {
    console.error('PUT /api/blocked-times error:', e);
    res.status(500).json({ error: 'Failed to update blocked time' });
  }
});

// DELETE /api/blocked-times/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id: userId, role, company_id } = req.user;
    const { id } = req.params;

    const existing = await pool.query(
      'SELECT * FROM blocked_times WHERE id = $1 AND company_id = $2',
      [id, company_id]
    );
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    if (role !== 'admin' && role !== 'master' && existing.rows[0].user_id !== parseInt(userId)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await pool.query('DELETE FROM blocked_times WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (e) {
    console.error('DELETE /api/blocked-times error:', e);
    res.status(500).json({ error: 'Failed to delete blocked time' });
  }
});

module.exports = router;
