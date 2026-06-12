const { getMemberOrdersByDateRange } = require('../db/pg');
const db = require('../db/pg_ops');
const dayjs = require('dayjs');

const getMonthlyEvaluation = async (req, res) => {
  const { month, year } = req.query;
  
  if (!month || !year) {
    return res.status(400).json({ error: 'Parameter month dan year harus diisi' });
  }

  const m = parseInt(month);
  const y = parseInt(year);
  
  if (isNaN(m) || m < 1 || m > 12 || isNaN(y) || y < 2000) {
    return res.status(400).json({ error: 'Parameter month atau year tidak valid' });
  }

  const startDateStr = `${y}-${String(m).padStart(2, '0')}-01 00:00:00`;
  const endDateStr = m === 12 
    ? `${y + 1}-01-01 00:00:00` 
    : `${y}-${String(m + 1).padStart(2, '0')}-01 00:00:00`;

  try {
    // 1. Get operational data (kunjungan bulanan)
    const query = `
      SELECT 
        z.salesman_code,
        vl.member_code,
        vl.visited,
        vl.is_closed,
        vl.is_approved,
        vl.visited_at
      FROM visit_logs vl
      JOIN zones z ON z.id = vl.zone_id
      WHERE vl.visited_at >= $1::timestamp 
        AND vl.visited_at < $2::timestamp
    `;
    const { rows: visitRows } = await db.query(query, [startDateStr, endDateStr]);

    if (visitRows.length === 0) {
      return res.json([]);
    }

    // 2. Extract unique member codes for batch fetching, filter out nulls/falsy values
    const memberCodes = [...new Set(visitRows.map(r => r.member_code))].filter(Boolean);

    // 3. Batch fetch orders from Master DB
    const orders = await getMemberOrdersByDateRange(startDateStr, endDateStr, memberCodes);
    
    // Kelompokkan tanggal transaksi per member
    const memberOrdersMap = {};
    orders.forEach(o => {
      if (!memberOrdersMap[o.kode_member]) memberOrdersMap[o.kode_member] = [];
      if (o.harga_total_item > 0) {
        memberOrdersMap[o.kode_member].push({
          date: dayjs(o.tgl_order).startOf('day'),
          total_rupiah: parseFloat(o.harga_total_item) || 0
        });
      }
    });

    // Urutkan kunjungan berdasarkan waktu secara ascending agar order dikaitkan ke kunjungan terawal
    visitRows.sort((a, b) => new Date(a.visited_at) - new Date(b.visited_at));

    // 4. Stitch data & Kalkulasi Agregasi
    const salesmanMap = {};
    const dailyMap = {};
    
    visitRows.forEach(row => {
      const { salesman_code, member_code, visited, is_closed, is_approved, visited_at } = row;
      const visitDate = dayjs(visited_at).startOf('day');
      const dateStr = visitDate.format('YYYY-MM-DD');
      
      if (!salesmanMap[salesman_code]) {
        salesmanMap[salesman_code] = {
          salesman_code,
          total_assigned: 0,
          total_visited: 0,
          total_closed: 0,
          total_approved: 0,
          closing_order: 0,
          total_rupiah: 0
        };
      }

      const dailyKey = `${dateStr}_${salesman_code}`;
      if (!dailyMap[dailyKey]) {
        dailyMap[dailyKey] = {
          date: dateStr,
          salesman_code,
          total_visited: 0,
          total_closed: 0,
          closing_order: 0
        };
      }
      
      const stat = salesmanMap[salesman_code];
      const dailyStat = dailyMap[dailyKey];
      stat.total_assigned++;
      
      const isSuccess = (visited === true || is_approved === true) && is_closed !== true;
      
      if (is_closed === true) {
        stat.total_closed++;
        dailyStat.total_closed++;
      } else if (visited === true) {
        stat.total_visited++;
        dailyStat.total_visited++;
      }
      
      if (is_approved === true && is_closed !== true) stat.total_approved++;
      
      if (isSuccess) {
        let visitOrderTotal = 0;
        let hasOrder = false;

        // Cek order pada hari H kunjungan atau setelahnya, lalu hapus dari map agar tidak dihitung ganda
        const ordersForMember = memberOrdersMap[member_code] || [];
        for (let i = ordersForMember.length - 1; i >= 0; i--) {
          const order = ordersForMember[i];
          if (order.date.isSame(visitDate) || order.date.isAfter(visitDate)) {
            hasOrder = true;
            visitOrderTotal += order.total_rupiah;
            ordersForMember.splice(i, 1);
          }
        }
        
        if (hasOrder) {
          stat.closing_order++;
          dailyStat.closing_order++;
          stat.total_rupiah += visitOrderTotal;
        }
      }
    });

    // 5. Final Formatting & Conversion Rate
    const results = Object.values(salesmanMap).map(stat => {
      const success_visits = stat.total_visited; // Kunjungan Berhasil = visited true
      const conversion_rate = success_visits > 0 
        ? Math.round((stat.closing_order / success_visits) * 100) 
        : 0;
        
      return {
        ...stat,
        success_percentage: conversion_rate
      };
    });

    // Urutkan berdasarkan conversion rate tertinggi
    results.sort((a, b) => b.success_percentage - a.success_percentage);

    const dailyResults = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      salesmen: results,
      daily: dailyResults
    });

  } catch (err) {
    console.error('analytics error:', err.message);
    res.status(500).json({ 
      error: 'Gagal memuat data evaluasi bulanan: ' + err.message,
      detail: err.stack
    });
  }
};

const getSurveyAnalytics = async (req, res) => {
  const { month, year, salesman } = req.query;
  
  // Default to current month/year if not provided
  const now = new Date();
  const m = month ? parseInt(month) : now.getMonth() + 1;
  const y = year ? parseInt(year) : now.getFullYear();

  if (isNaN(m) || m < 1 || m > 12 || isNaN(y) || y < 2000) {
    return res.status(400).json({ error: 'Parameter month atau year tidak valid' });
  }

  const startDateStr = `${y}-${String(m).padStart(2, '0')}-01 00:00:00`;
  const endDateStr = m === 12 
    ? `${y + 1}-01-01 00:00:00` 
    : `${y}-${String(m + 1).padStart(2, '0')}-01 00:00:00`;

  let salesmanFilter = '';
  let params = [startDateStr, endDateStr];
  
  if (salesman && salesman !== '') {
    salesmanFilter = ` AND advisor_name = $3 `;
    params.push(salesman);
  }

  try {
    // 0. Fetch all Salesmen for the dropdown
    const salesmenRes = await db.query(`
      SELECT userid as id 
      FROM users_local 
      WHERE role = 'SALESMAN'
      ORDER BY userid ASC
    `);

    // 1. Hit Rate (Berhasil Order)
    const hitRateRes = await db.query(`
      SELECT berhasil_order as label, COUNT(*) as count 
      FROM visit_surveys 
      WHERE berhasil_order IS NOT NULL
        AND created_at >= $1::timestamp AND created_at < $2::timestamp
        ${salesmanFilter}
      GROUP BY berhasil_order
    `, params);

    // 2. Promo Preference
    const promoRes = await db.query(`
      SELECT promo_menarik as label, COUNT(*) as count 
      FROM visit_surveys 
      WHERE promo_menarik IS NOT NULL AND promo_menarik != ''
        AND created_at >= $1::timestamp AND created_at < $2::timestamp
        ${salesmanFilter}
      GROUP BY promo_menarik
    `, params);

    // 3. Top Kendala Belanja (Extract from JSONB array)
    const kendalaRes = await db.query(`
      SELECT value AS label, COUNT(*) AS count
      FROM visit_surveys, jsonb_array_elements_text(kendala_belanja)
      WHERE created_at >= $1::timestamp AND created_at < $2::timestamp
        ${salesmanFilter}
      GROUP BY value
      ORDER BY count DESC
    `, params);

    // 4. Top Produk Mahal (Extract from JSONB array)
    const produkMahalRes = await db.query(`
      SELECT value AS label, COUNT(*) AS count
      FROM visit_surveys, jsonb_array_elements_text(produk_mahal)
      WHERE created_at >= $1::timestamp AND created_at < $2::timestamp
        ${salesmanFilter}
      GROUP BY value
      ORDER BY count DESC
    `, params);

    // 5. Recent Feedback (Saran Kritik & Produk Belum Ada)
    const feedbackRes = await db.query(`
      SELECT member_code, advisor_name, saran_kritik, produk_belum_ada, created_at 
      FROM visit_surveys 
      WHERE ((saran_kritik IS NOT NULL AND saran_kritik != '') 
         OR (produk_belum_ada IS NOT NULL AND produk_belum_ada != ''))
        AND created_at >= $1::timestamp AND created_at < $2::timestamp
        ${salesmanFilter}
      ORDER BY created_at DESC 
      LIMIT 100
    `, params);

    // 6. Timeline (Survey Count per Day)
    const timelineRes = await db.query(`
      SELECT DATE(created_at) as date, COUNT(*) as count 
      FROM visit_surveys 
      WHERE created_at >= $1::timestamp AND created_at < $2::timestamp
        ${salesmanFilter}
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at) ASC
    `, params);

    // 7. Raw Surveys for Export
    const rawSurveysRes = await db.query(`
      SELECT visit_id, member_code, advisor_name, berhasil_order, 
             promo_menarik, kendala_belanja, produk_mahal, 
             produk_belum_ada, saran_kritik, created_at
      FROM visit_surveys
      WHERE created_at >= $1::timestamp AND created_at < $2::timestamp
        ${salesmanFilter}
      ORDER BY created_at DESC
    `, params);

    res.json({
      availableSalesmen: salesmenRes.rows.map(s => s.id),
      timeline: timelineRes.rows,
      rawSurveys: rawSurveysRes.rows,
      hitRate: hitRateRes.rows,
      promo: promoRes.rows,
      kendala: kendalaRes.rows,
      produkMahal: produkMahalRes.rows,
      feedback: feedbackRes.rows
    });

  } catch (err) {
    console.error('Survey analytics error:', err.message);
    res.status(500).json({ error: 'Gagal memuat analitik survei: ' + err.message });
  }
};

module.exports = {
  getMonthlyEvaluation,
  getSurveyAnalytics
};
