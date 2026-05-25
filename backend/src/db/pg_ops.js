const { Pool } = require('pg');
require('dotenv').config();

const db = new Pool({
  host: process.env.DB_OPS_HOST,
  user: process.env.DB_OPS_USER,
  password: process.env.DB_OPS_PASS,
  database: process.env.DB_OPS_NAME,
  port: process.env.DB_OPS_PORT || 5432,
});

db.on('error', (err) => {
  console.error('Unexpected error on idle ops PG client', err);
  process.exit(-1);
});

module.exports = db;
