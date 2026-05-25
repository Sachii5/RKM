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
        memberOrdersMap[o.kode_member].push(dayjs(o.tgl_order).startOf('day'));
      }
    });

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
          closing_order: 0
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
        
        // Cek apakah ada order pada hari H kunjungan atau setelahnya
        const hasOrder = (memberOrdersMap[member_code] || []).some(orderDate => {
          return orderDate.isSame(visitDate) || orderDate.isAfter(visitDate);
        });
        
        if (hasOrder) {
          stat.closing_order++;
          dailyStat.closing_order++;
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

module.exports = {
  getMonthlyEvaluation
};
