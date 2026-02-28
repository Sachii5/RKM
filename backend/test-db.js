const { pool } = require('./src/db/pg');

async function test() {
  try {
    const res = await pool.query('SELECT * FROM tbmaster_user WHERE userid IN ($1, $2)', ['FLD', 'ALB']);
    console.log('PG Users:', res.rows);
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}
test();
