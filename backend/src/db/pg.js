const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.PG_HOST,
  user: process.env.PG_USER,
  password: process.env.PG_PASS,
  database: process.env.PG_DB,
  port: process.env.PG_PORT || 5432,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PG client', err);
  process.exit(-1);
});

// Cache implementation
let cachedMembers = null;
let lastCacheTime = null;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

const getMembers = async (forceRefresh = false) => {
  const now = Date.now();
  
  if (!forceRefresh && cachedMembers && lastCacheTime && (now - lastCacheTime < CACHE_DURATION_MS)) {
    return cachedMembers;
  }

  const query = `
    SELECT 
      c.cus_kodeigr, 
      UPPER(c.cus_namamember) AS cus_namamember, 
      c.cus_kodemember, 
      UPPER(c.cus_alamatmember5) AS cus_alamatmember5, 
      UPPER(c.cus_alamatmember4) AS cus_alamatmember4, 
      UPPER(c.cus_alamatmember6) AS cus_alamatmember6, 
      UPPER(c.cus_alamatmember7) AS cus_alamatmember7, 
      UPPER(c.cus_kecamatan_surat) AS cus_kecamatan_surat, 
      c.cus_hpmember,
      c.cus_alamatemail, 
      UPPER(c.cus_nosalesman) AS cus_nosalesman,
      crm.crm_koordinat
    FROM tbmaster_customer c
    JOIN tbmaster_customercrm crm ON c.cus_kodemember = crm.crm_kodemember
    WHERE c.cus_kodeigr = '2K' 
      AND crm.crm_kodeigr = '2K'
      AND crm.crm_koordinat IS NOT NULL
      AND crm.crm_koordinat != ''
  `;

  try {
    const res = await pool.query(query);
    cachedMembers = res.rows;
    lastCacheTime = now;
    return cachedMembers;
  } catch (error) {
    console.error('Error fetching members from PG', error);
    throw error;
  }
};

module.exports = {
  pool,
  getMembers
};
