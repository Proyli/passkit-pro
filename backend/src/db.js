// backend/db.js
const { Pool } = require('pg');

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

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: Number(process.env.DB_POOL || 10),
  ssl,
});

module.exports = { pool };
