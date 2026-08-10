// ============================================================================
// Database Connection Utility
// ============================================================================
const { Pool } = require('pg');

// Create connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 10,
  idleTimeoutMillis: 30000,      // discard idle connections at 30s (before Railway's ~60s kill)
  connectionTimeoutMillis: 5000, // fail fast if pool can't provide a connection in 5s
});

// Test connection on startup
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  // Log but do NOT exit — pg-pool will create a fresh connection on the next query
  console.error('❌ Database pool error (non-fatal):', err.message);
});

const RETRYABLE_CODES = new Set(['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT']);

// Query helper — retries up to 2 times on stale/transient connection errors
const query = async (text, params, _attempt = 0) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;

    if (process.env.NODE_ENV !== 'production') {
      console.log('Query executed:', { text, duration: `${duration}ms`, rows: res.rowCount });
    }

    return res;
  } catch (error) {
    if (_attempt < 2 && RETRYABLE_CODES.has(error.code)) {
      console.warn(`DB query retry ${_attempt + 1}/2 (${error.code})`);
      await new Promise(r => setTimeout(r, 500));
      return query(text, params, _attempt + 1);
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
