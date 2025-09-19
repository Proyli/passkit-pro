// backend/db.js
require('dotenv').config();

const SKIP_DB = String(process.env.SKIP_DB || '').toLowerCase() === 'true';

let pool;

if (SKIP_DB) {
  // Stub sin BD: evita que falle require("../db") y permite .query()
  pool = {
    // Devuelve [rows, fields] como mysql2/promise
    query: async () => [[], []],
    execute: async () => [[], []],
  };
  console.warn('[db] SKIP_DB=true → usando stub de pool (no hay conexión a MySQL).');
} else {
  // BD real (MySQL). Asegúrate de tener mysql2 instalado: npm i mysql2
  const mysql = require('mysql2/promise');

  pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'passforge',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: 'Z',
  });

  console.log('[db] Pool MySQL creado.');
}

module.exports = { pool };
