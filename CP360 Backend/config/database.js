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
  idleTimeoutMillis: 60000,   // close connections idle >60s before Railway kills them (~5min)
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

// Query helper — retries up to 3 times on connection errors.
// Railway kills idle DB connections after ~5 min; on hourly crons ALL pool connections
// can be stale. Each retry waits longer to let the pool flush dead connections and
// establish fresh ones.
const isRetryable = (err) =>
  ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT'].includes(err.code) ||
  /terminated|timeout|reset/i.test(err.message || '');

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
    if (_attempt < 4 && isRetryable(error)) {
      const delay = _attempt * 2000; // 2s, 4s, 6s
      console.warn(`⚠️ DB connection error (attempt ${_attempt}/3), retrying in ${delay}ms:`, error.message);
      await new Promise(r => setTimeout(r, delay));
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
