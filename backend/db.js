// backend/db.js
require('dotenv').config();

const SKIP_DB = String(process.env.SKIP_DB || '').toLowerCase() === 'true';

let pool;

if (SKIP_DB) {
  pool = {
    query: async () => [[], []],
    execute: async () => [[], []],
  };
  console.warn('[db] SKIP_DB=true → usando stub de pool (sin conexión PostgreSQL).');
} else {
  const { Pool } = require('pg');

  // SSL para Azure PostgreSQL
  // DB_SSL=require   -> fuerza TLS; usa CAs del sistema.
  // DB_SSL_CA_B64=<base64 del certificado CA> (opcional) -> valida contra CA específica.
  const sslMode = String(process.env.DB_SSL || '').toLowerCase();
  let ssl;
  if (['require', 'required', 'true'].includes(sslMode)) {
    ssl = { rejectUnauthorized: false };
    if (Object.prototype.hasOwnProperty.call(process.env, 'DB_SSL_REJECT_UNAUTHORIZED')) {
      ssl.rejectUnauthorized = String(process.env.DB_SSL_REJECT_UNAUTHORIZED).toLowerCase() === 'true';
    }
    if (process.env.DB_SSL_CA_B64) {
      ssl.ca = Buffer.from(process.env.DB_SSL_CA_B64, 'base64').toString('utf8');
    }
  }

  pool = new Pool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'passforge',
    max: Number(process.env.DB_POOL || 10),
    connectionTimeoutMillis: 20000,
    idleTimeoutMillis: 30000,
    ssl, // undefined en local; objeto SSL en Azure
  });

  console.log('[db] Pool PostgreSQL creado.');

  // Ping inicial (log útil en Azure)
  (async () => {
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      console.log('[db] Ping OK contra PostgreSQL.');
    } catch (e) {
      console.error('[db] Error conectando a PostgreSQL:', e.message);
    }
  })();
}

module.exports = { pool };
