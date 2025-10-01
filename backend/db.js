// backend/db.js
require('dotenv').config();

const SKIP_DB = String(process.env.SKIP_DB || '').toLowerCase() === 'true';

let pool;

if (SKIP_DB) {
  pool = {
    query: async () => [[], []],
    execute: async () => [[], []],
  };
  console.warn('[db] SKIP_DB=true → usando stub de pool (sin conexión MySQL).');
} else {
  const mysql = require('mysql2/promise');

  // SSL para Azure MySQL
  // MYSQL_SSL=required  -> fuerza TLS; usa CAs del sistema.
  // DB_SSL_CA_B64=<base64 del certificado CA> (opcional) -> valida contra CA específica.
  const sslMode = String(process.env.MYSQL_SSL || '').toLowerCase();
  let ssl;
  if (sslMode === 'required' || sslMode === 'true') {
    ssl = { rejectUnauthorized: true, minVersion: 'TLSv1.2' };
    if (process.env.DB_SSL_CA_B64) {
      ssl.ca = Buffer.from(process.env.DB_SSL_CA_B64, 'base64').toString('utf8');
    }
  }

  pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root', // En Azure: usuario@servidor
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'passforge',
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_POOL || 10),
    queueLimit: 0,
    multipleStatements: false,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    connectTimeout: 20000,
    timezone: 'Z',
    ssl, // undefined en local; objeto SSL en Azure
  });

  console.log('[db] Pool MySQL creado.');

  // Ping inicial (log útil en Azure)
  (async () => {
    try {
      const conn = await pool.getConnection();
      await conn.ping();
      conn.release();
      console.log('[db] Ping OK contra MySQL.');
    } catch (e) {
      console.error('[db] Error conectando a MySQL:', e.message);
    }
  })();
}

module.exports = { pool };
