const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// GET all pricing configs for a company
router.get('/:companyId', authenticateToken, async (req, res) => {
  const { companyId } = req.params;

  try {
    // Verify user has access to this company
    if (req.user.company_id !== parseInt(companyId) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(
      `SELECT * FROM estimator_pricing_configs 
       WHERE company_id = $1 
       ORDER BY space_type, finish_type`,
      [companyId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching estimator pricing configs:', error);
    res.status(500).json({ error: 'Failed to fetch pricing configs' });
  }
});

// POST (bulk save/update) pricing configs for a company
router.post('/:companyId', authenticateToken, async (req, res) => {
  const { companyId } = req.params;
  const { configs } = req.body; // Array of pricing config objects

  try {
    // Verify user has access to this company
    if (req.user.company_id !== parseInt(companyId) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Validate configs array
    if (!Array.isArray(configs)) {
      return res.status(400).json({ error: 'configs must be an array' });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Upsert each config (insert or update if exists)
      for (const config of configs) {
        const { space_type, finish_type, min_price_per_sf, max_price_per_sf, enabled } = config;

        await client.query(
          `INSERT INTO estimator_pricing_configs 
           (company_id, space_type, finish_type, min_price_per_sf, max_price_per_sf, enabled, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
           ON CONFLICT (company_id, space_type, finish_type)
           DO UPDATE SET
             min_price_per_sf = EXCLUDED.min_price_per_sf,
             max_price_per_sf = EXCLUDED.max_price_per_sf,
             enabled = EXCLUDED.enabled,
             updated_at = CURRENT_TIMESTAMP`,
          [companyId, space_type, finish_type, min_price_per_sf, max_price_per_sf, enabled]
        );
      }

      await client.query('COMMIT');

      // Fetch and return updated configs
      const result = await client.query(
        `SELECT * FROM estimator_pricing_configs 
         WHERE company_id = $1 
         ORDER BY space_type, finish_type`,
        [companyId]
      );

      res.json({ success: true, configs: result.rows });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error saving estimator pricing configs:', error);
    res.status(500).json({ error: 'Failed to save pricing configs' });
  }
});

module.exports = router;