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
    WITH SleeperMembers AS (
      SELECT obi_kdmember
FROM tbtr_obi_h
-- Batasi scan data hanya dari 4 bulan lalu sampai hari ini (Format Postgres)
WHERE obi_tgltrans >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '4 month')
GROUP BY obi_kdmember
HAVING 
  -- Transaksi TERAKHIR harus sebelum 1 bulan lalu
  MAX(obi_tgltrans) < DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
  
  -- Transaksi TERAKHIR minimal ada di 4 bulan lalu
  AND MAX(obi_tgltrans) >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '4 month')
    )
    SELECT 
      c.cus_kodeigr, 
      UPPER(c.cus_namamember) AS cus_namamember, 
      c.cus_kodemember, 
      UPPER(crm.crm_alamatusaha4) AS cus_alamatmember5, 
      UPPER(crm.crm_alamatusaha2) AS cus_alamatmember4, 
      UPPER(crm.crm_alamatusaha3) AS cus_alamatmember6, 
      UPPER(crm.crm_kecamatan_usaha) AS cus_kecamatan_surat, 
      c.cus_hpmember,
      c.cus_alamatemail, 
      UPPER(c.cus_nosalesman) AS cus_nosalesman,
      crm.crm_koordinat,
      CASE WHEN s.obi_kdmember IS NOT NULL THEN true ELSE false END AS is_sleeper
    FROM tbmaster_customer c
    JOIN tbmaster_customercrm crm ON c.cus_kodemember = crm.crm_kodemember
    LEFT JOIN SleeperMembers s ON c.cus_kodemember = s.obi_kdmember
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

const getMemberOrdersByDate = async (date, memberCodes) => {
  if (!memberCodes || memberCodes.length === 0) return [];
  const query = `
    SELECT
        h.obi_kdmember AS kode_member,
        SUM((CASE WHEN COALESCE(d.obi_qtyrealisasi, 0) <> 0 THEN d.obi_qtyrealisasi ELSE d.obi_qtyorder END) * (d.obi_hargasatuan + COALESCE(d.obi_ppn, 0) - COALESCE(d.obi_diskon, 0))) as harga_total_item
    FROM tbtr_obi_h h
    LEFT JOIN tbtr_obi_d d ON h.obi_notrans = d.obi_notrans AND h.obi_tgltrans = d.obi_tgltrans
    WHERE h.obi_tglorder::date = $1
        AND h.obi_kdmember = ANY($2)
    GROUP BY h.obi_kdmember;
  `;
  try {
    const res = await pool.query(query, [date, memberCodes]);
    return res.rows;
  } catch (error) {
    console.error('Error fetching member orders from PG', error);
    throw error;
  }
};

const getMemberOrdersByDateRange = async (startDate, endDate, memberCodes) => {
  if (!memberCodes || memberCodes.length === 0) return [];
  const query = `
    SELECT
        h.obi_kdmember AS kode_member,
        h.obi_tglorder::date AS tgl_order,
        SUM((CASE WHEN COALESCE(d.obi_qtyrealisasi, 0) <> 0 THEN d.obi_qtyrealisasi ELSE d.obi_qtyorder END) * (d.obi_hargasatuan + COALESCE(d.obi_ppn, 0) - COALESCE(d.obi_diskon, 0))) as harga_total_item
    FROM tbtr_obi_h h
    LEFT JOIN tbtr_obi_d d ON h.obi_notrans = d.obi_notrans AND h.obi_tgltrans = d.obi_tgltrans
    WHERE h.obi_tglorder >= $1::timestamp AND h.obi_tglorder < $2::timestamp
        AND h.obi_kdmember = ANY($3::text[])
    GROUP BY h.obi_kdmember, h.obi_tglorder::date;
  `;
  try {
    const res = await pool.query(query, [startDate, endDate, memberCodes]);
    return res.rows;
  } catch (error) {
    console.error('Error fetching member orders by date range from PG', error);
    throw error;
  }
};

const getMemberLastOrders = async ({ salesmanCode = '', page = 1, limit = 25 } = {}) => {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(10, Number(limit) || 25));
  const offset = (safePage - 1) * safeLimit;
  const params = [];
  const filters = [];

  if (salesmanCode) {
    params.push(salesmanCode.toUpperCase());
    filters.push(`salesman = $${params.length}`);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const limitParam = params.length + 1;
  const offsetParam = params.length + 2;

  const query = `
    WITH last_orders AS (
      SELECT
        UPPER(tc.cus_nosalesman) AS salesman,
        tc.cus_kodemember AS kode_member,
        UPPER(tc.cus_namamember) AS nama_member,
        tc.cus_hpmember AS nomor_member,
        tc.cus_alamatemail AS email_member,
        UPPER(crm.crm_alamatusaha1) AS alamat,
        UPPER(crm.crm_alamatusaha4) AS kelurahan,
        UPPER(crm.crm_kecamatan_usaha) AS kecamatan,
        MAX(toh.obi_tglpb)::date AS terakhir_order
      FROM tbtr_obi_h toh
      JOIN tbmaster_customer tc
        ON tc.cus_kodemember = toh.obi_kdmember
       AND tc.cus_kodeigr = toh.obi_kodeigr
      JOIN tbmaster_customercrm crm
        ON crm.crm_kodemember = toh.obi_kdmember
       AND crm.crm_kodeigr = toh.obi_kodeigr
      WHERE toh.obi_recid = '6'
        AND toh.obi_kodeigr = '2K'
      GROUP BY
        tc.cus_nosalesman,
        tc.cus_kodemember,
        tc.cus_namamember,
        tc.cus_hpmember,
        tc.cus_alamatemail,
        crm.crm_alamatusaha1,
        crm.crm_alamatusaha4,
        crm.crm_kecamatan_usaha
    ),
    filtered AS (
      SELECT
        *,
        CURRENT_DATE - terakhir_order AS hari_tidak_belanja
      FROM last_orders
      ${whereClause}
    )
    SELECT *, COUNT(*) OVER()::int AS total_count
    FROM filtered
    ORDER BY terakhir_order ASC, kode_member ASC
    LIMIT $${limitParam} OFFSET $${offsetParam}
  `;

  try {
    const res = await pool.query(query, [...params, safeLimit, offset]);
    const total = res.rows[0]?.total_count || 0;
    const data = res.rows.map(({ total_count, ...row }) => row);

    return {
      data,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit)
      }
    };
  } catch (error) {
    console.error('Error fetching member last orders from PG', error);
    throw error;
  }
};

module.exports = {
  pool,
  getMembers,
  getMemberOrdersByDate,
  getMemberOrdersByDateRange,
  getMemberLastOrders
};
