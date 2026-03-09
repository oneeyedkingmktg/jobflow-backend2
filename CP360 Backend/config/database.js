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
  // Keep connections alive so Railway doesn't drop them after idle timeout
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  // Limit pool size and idle time to avoid stale connections
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
});

// Test connection on startup
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  // Log but do NOT exit — stale connections get dropped by Railway periodically.
  // The pool will automatically create a fresh connection on the next query.
  console.error('❌ Database pool error (non-fatal):', err.message);
});

// Query helper function — retries once on connection errors (Railway cold-start / stale connection)
const RETRYABLE = ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'CONNECTION_TERMINATED'];

const query = async (text, params, _attempt = 1) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;

    if (process.env.NODE_ENV !== 'production') {
      console.log('Query executed:', { text, duration: `${duration}ms`, rows: res.rowCount });
    }

    return res;
  } catch (error) {
    const isRetryable = RETRYABLE.some(code =>
      error.code === code || (error.message || '').includes('terminated') || (error.message || '').includes('timeout')
    );

    if (_attempt === 1 && isRetryable) {
      console.warn('⚠️ DB connection error, retrying once:', error.message);
      await new Promise(r => setTimeout(r, 500));
      return query(text, params, 2);
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
