// ============================================================================
// Database Connection Utility
// ============================================================================
const { Pool } = require('pg');

// Create connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Test connection on startup
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  // Log but do NOT exit — pg-pool will create a fresh connection on the next query
  console.error('❌ Database pool error (non-fatal):', err.message);
});

// Query helper function — retries once on stale connection errors (Railway drops idle connections)
const query = async (text, params, _retry = false) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;

    if (process.env.NODE_ENV !== 'production') {
      console.log('Query executed:', { text, duration: `${duration}ms`, rows: res.rowCount });
    }

    return res;
  } catch (error) {
    const stale = error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED';
    if (!_retry && stale) {
      // Wait 200ms for the pool to create a fresh connection, then try once more
      await new Promise(r => setTimeout(r, 200));
      return query(text, params, true);
    }
    console.error('Database query error:', error);
    throw error;
  }
};

// Transaction helper
const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  query,
  transaction,
  pool
};
