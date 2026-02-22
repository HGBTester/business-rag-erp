const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'raguser',
    password: process.env.DB_PASSWORD || 'ragpass123',
    database: process.env.DB_NAME || 'business_rag',
    max: 30,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
});

let logged = false;
pool.on('connect', () => {
    if (!logged) { console.log('[DB] Connected to PostgreSQL'); logged = true; }
});
pool.on('error', (err) => console.error('[DB] Pool error:', err.message));

module.exports = pool;
