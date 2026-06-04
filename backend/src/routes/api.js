const express = require('express');
const router = express.Router();

const { getMembers, getMemberOrdersByDate } = require('../db/pg');
const db = require('../db/pg_ops');
const { getZoneByRadius, getZoneByKelurahan, createZoneTransaction, softDeleteZone } = require('../services/zone.service');
const { getTodayRoute } = require('../services/route.service');
const { performResetAndBackup } = require('../services/backup.service');
const { isValidSalesman, getTodayDateString } = require('../utils/helpers');
const { getMonthlyEvaluation } = require('../controllers/analytics.controller');

const authenticate = require('../middleware/auth.middleware');
const { requireSupervisorOrAbove, requireSalesman, requireAdmin } = require('../middleware/role.middleware');

// === Input Validation Helpers ===
const isValidDateFormat = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d);
const isValidSalesmanCode = (s) => typeof s === 'string' && /^[A-Z]{2,5}$/i.test(s.trim());
const isPositiveInteger = (v) => Number.isInteger(Number(v)) && Number(v) > 0;
const sanitizeString = (s, maxLen = 100) => typeof s === 'string' ? s.trim().substring(0, maxLen) : '';

// GET /api/members (Used by Map plotting for Supervisors/Admins)
router.get('/members', authenticate, requireSupervisorOrAbove, async (req, res) => {
  try {
    const data = await getMembers();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/zone/radius
router.post('/zone/radius', authenticate, requireSupervisorOrAbove, async (req, res) => {
  const { lat, lng, radius_km, salesman_code } = req.body;
  if (lat == null || lng == null || !radius_km || radius_km <= 0 || !salesman_code) {
    return res.status(400).json({ error: 'Lat, lng, radius_km, dan salesman_code harus diisi dengan benar' });
  }
  if (!isValidSalesmanCode(salesman_code)) {
    return res.status(400).json({ error: 'Format kode salesman tidak valid' });
  }
  if (typeof lat !== 'number' || typeof lng !== 'number' || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ error: 'Koordinat tidak valid' });
  }
  if (typeof radius_km !== 'number' || radius_km > 100) {
    return res.status(400).json({ error: 'Radius harus berupa angka dan maksimal 100 km' });
  }

  try {
    const result = await getZoneByRadius(lat, lng, radius_km, salesman_code.toUpperCase());
    res.json(result);
  } catch (err) {
    console.error('zone/radius error:', err.message);
    res.status(500).json({ error: 'Gagal memproses zona. Silakan coba lagi.' });
  }
});

// POST /api/zone/kelurahan
router.post('/zone/kelurahan', authenticate, requireSupervisorOrAbove, async (req, res) => {
  const { kelurahan, salesman_code } = req.body;
  if (!kelurahan || !salesman_code) {
    return res.status(400).json({ error: 'Kecamatan dan salesman_code harus diisi' });
  }
  if (!isValidSalesmanCode(salesman_code)) {
    return res.status(400).json({ error: 'Format kode salesman tidak valid' });
  }

  try {
    const result = await getZoneByKelurahan(sanitizeString(kelurahan, 50), salesman_code.toUpperCase());
    res.json(result);
  } catch (err) {
    console.error('zone/kelurahan error:', err.message);
    res.status(500).json({ error: 'Gagal memproses zona. Silakan coba lagi.' });
  }
});

// POST /api/zone/create
router.post('/zone/create', authenticate, requireSupervisorOrAbove, async (req, res) => {
  const { salesman_code, scheduled_date, zone_type, members, center_lat, center_lng, radius_km, kelurahan } = req.body;
  
  if (!Array.isArray(members) || members.length === 0 || !salesman_code || !scheduled_date) {
    return res.status(400).json({ error: 'Data zona tidak lengkap' });
  }
  if (!isValidSalesmanCode(salesman_code)) {
    return res.status(400).json({ error: 'Format kode salesman tidak valid' });
  }
  if (!isValidDateFormat(scheduled_date)) {
    return res.status(400).json({ error: 'Format tanggal tidak valid (YYYY-MM-DD)' });
  }
  if (!['radius', 'kelurahan', 'manual'].includes(zone_type)) {
    return res.status(400).json({ error: 'Tipe zona tidak valid' });
  }
  if (members.length > 50) {
    return res.status(400).json({ error: 'Jumlah member melebihi batas maksimum (50)' });
  }

  try {
    const zoneId = await createZoneTransaction(
      req.user.userid, 
      req.user.role, 
      salesman_code.toUpperCase(), 
      scheduled_date, 
      zone_type, 
      zone_type === 'radius' ? radius_km : kelurahan,
      members,
      center_lat,
      center_lng,
      radius_km,
      kelurahan
    );
    res.json({ success: true, zoneId });
  } catch (err) {
    if (err.message.includes('Conflict:')) {
      return res.status(409).json({ error: err.message });
    }
    console.error('zone/create error:', err.message);
    res.status(500).json({ error: 'Gagal membuat zona. Silakan coba lagi.' });
  }
});

// DELETE /api/zone/:id
router.delete('/zone/:id', authenticate, requireSupervisorOrAbove, async (req, res) => {
  const zoneId = req.params.id;
  if (!isPositiveInteger(zoneId)) {
    return res.status(400).json({ error: 'ID zona tidak valid' });
  }
  try {
    await softDeleteZone(req.user.userid, req.user.role, Number(zoneId));
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/zones - List all zones (Admin/Supervisor)
router.get('/zones', authenticate, requireSupervisorOrAbove, async (req, res) => {
  try {
    const { salesman_code } = req.query;
    let query = `
      SELECT z.id, z.salesman_code, z.zone_type, z.kelurahan, z.center_lat, z.center_lng,
             z.radius_km, z.scheduled_date, z.total_member, z.status, z.created_at, z.created_by,
             COUNT(CASE WHEN vl.visited = true AND vl.is_closed = false AND vl.is_approved = true THEN 1 END) as visited_count,
             COUNT(CASE WHEN vl.visited = true AND vl.is_closed = false AND vl.is_approved = false THEN 1 END) as pending_approval_count,
             COUNT(CASE WHEN vl.is_closed = true THEN 1 END) as closed_count,
             COUNT(CASE WHEN vl.visited = false THEN 1 END) as pending_count
      FROM zones z
      LEFT JOIN visit_logs vl ON vl.zone_id = z.id
        AND vl.visited_at >= DATE_TRUNC('month', z.scheduled_date::timestamp)
        AND vl.visited_at < DATE_TRUNC('month', z.scheduled_date::timestamp) + INTERVAL '1 month'
      WHERE z.status = 'active'
    `;
    const params = [];
    if (salesman_code) {
      query += ' AND z.salesman_code = $1';
      params.push(salesman_code.toUpperCase());
    }
    query += ' GROUP BY z.id ORDER BY z.scheduled_date DESC';
    const resZones = await db.query(query, params);
    res.json(resZones.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/zones/mine - Salesman's own zones
router.get('/zones/mine', authenticate, requireSalesman, async (req, res) => {
  try {
    const salesman = req.user.userid.toUpperCase();
    const resZones = await db.query(`
      SELECT z.id, z.salesman_code, z.zone_type, z.kelurahan, z.scheduled_date,
             z.total_member, z.status, z.created_at,
             COUNT(CASE WHEN vl.visited = true AND vl.is_closed = false AND vl.is_approved = true THEN 1 END) as visited_count,
             COUNT(CASE WHEN vl.visited = true AND vl.is_closed = false AND vl.is_approved = false THEN 1 END) as pending_approval_count,
             COUNT(CASE WHEN vl.is_closed = true THEN 1 END) as closed_count,
             COUNT(CASE WHEN vl.visited = false THEN 1 END) as pending_count
      FROM zones z
      LEFT JOIN visit_logs vl ON vl.zone_id = z.id
        AND vl.visited_at >= DATE_TRUNC('month', z.scheduled_date::timestamp)
        AND vl.visited_at < DATE_TRUNC('month', z.scheduled_date::timestamp) + INTERVAL '1 month'
      WHERE z.salesman_code = $1 AND z.status = 'active'
      GROUP BY z.id
      ORDER BY z.scheduled_date DESC
    `, [salesman]);
    res.json(resZones.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/zones/member-codes - All member codes currently in active zones
router.get('/zones/member-codes', authenticate, requireSupervisorOrAbove, async (req, res) => {
  try {
    const resRows = await db.query(`
      SELECT zm.member_code, 
             COALESCE(bool_or(vl.visited = true AND vl.is_closed = false), false) as max_visited,
             COALESCE(bool_or(vl.visited = true AND vl.is_closed = true), false) as is_closed,
             COALESCE(bool_or(vl.visited = false), false) as is_unvisited
      FROM zone_members zm
      JOIN zones z ON z.id = zm.zone_id
      LEFT JOIN visit_logs vl ON vl.zone_id = zm.zone_id AND vl.member_code = zm.member_code
        AND vl.visited_at >= DATE_TRUNC('month', z.scheduled_date::timestamp)
        AND vl.visited_at < DATE_TRUNC('month', z.scheduled_date::timestamp) + INTERVAL '1 month'
      WHERE z.status = 'active'
      GROUP BY zm.member_code
    `);
    
    const zoned = [];
    const unvisited = [];
    const closed = [];
    
    resRows.rows.forEach(r => {
      if (r.is_closed === true) closed.push(r.member_code);
      else if (r.max_visited === true) zoned.push(r.member_code);
      else unvisited.push(r.member_code);
    });
    
    res.json({ zoned, unvisited, closed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/route/today
router.get('/route/today', authenticate, requireSalesman, async (req, res) => {
  const salesman = req.user.userid.toUpperCase();
  const dateParam = req.query.date || getTodayDateString();
  
  // Validate date format to prevent injection
  if (!isValidDateFormat(dateParam)) {
    return res.status(400).json({ error: 'Format tanggal tidak valid' });
  }

  try {
    const data = await getTodayRoute(salesman, dateParam);
    res.json(data);
  } catch (err) {
    console.error('route/today error:', err.message);
    res.status(500).json({ error: 'Gagal memuat rute. Silakan coba lagi.' });
  }
});

// POST /api/visit/mark
router.post('/visit/mark', authenticate, requireSalesman, async (req, res) => {
  const { zone_id, member_code } = req.body;
  if (!member_code || !zone_id) {
    return res.status(400).json({ error: 'Member code dan zone_id harus diisi' });
  }
  if (!isPositiveInteger(zone_id)) {
    return res.status(400).json({ error: 'zone_id tidak valid' });
  }

  try {
    const resUpdate = await db.query(`
      UPDATE visit_logs vl
      SET visited = true, is_closed = false, visited_at = $1 
      FROM zones z
      WHERE vl.zone_id = z.id
        AND vl.zone_id = $2 
        AND vl.member_code = $3 
        AND vl.visited = false
        AND vl.visited_at >= DATE_TRUNC('month', z.scheduled_date::timestamp)
        AND vl.visited_at < DATE_TRUNC('month', z.scheduled_date::timestamp) + INTERVAL '1 month'
    `, [new Date().toISOString(), Number(zone_id), sanitizeString(member_code, 20)]);
    
    if (resUpdate.rowCount === 0) {
      return res.status(404).json({ error: 'Member kunjungan tidak ditemukan untuk zona ini' });
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error('visit/mark error:', err.message);
    res.status(500).json({ error: 'Gagal memperbarui status kunjungan' });
  }
});

// POST /api/visit/close
router.post('/visit/close', authenticate, requireSalesman, async (req, res) => {
  const { zone_id, member_code } = req.body;
  if (!member_code || !zone_id) {
    return res.status(400).json({ error: 'Member code dan zone_id harus diisi' });
  }
  if (!isPositiveInteger(zone_id)) {
    return res.status(400).json({ error: 'zone_id tidak valid' });
  }

  try {
    const resUpdate = await db.query(`
      UPDATE visit_logs vl
      SET visited = true, is_closed = true, visited_at = $1 
      FROM zones z
      WHERE vl.zone_id = z.id
        AND vl.zone_id = $2 
        AND vl.member_code = $3 
        AND vl.visited = false
        AND vl.visited_at >= DATE_TRUNC('month', z.scheduled_date::timestamp)
        AND vl.visited_at < DATE_TRUNC('month', z.scheduled_date::timestamp) + INTERVAL '1 month'
    `, [new Date().toISOString(), Number(zone_id), sanitizeString(member_code, 20)]);
    
    if (resUpdate.rowCount === 0) {
      return res.status(404).json({ error: 'Member kunjungan tidak ditemukan untuk zona ini' });
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error('visit/close error:', err.message);
    res.status(500).json({ error: 'Gagal memperbarui status kunjungan toko tutup' });
  }
});

// POST /api/visit/cancel
router.post('/visit/cancel', authenticate, requireSalesman, async (req, res) => {
  const { zone_id, member_code } = req.body;
  if (!member_code || !zone_id) {
    return res.status(400).json({ error: 'Member code dan zone_id harus diisi' });
  }
  if (!isPositiveInteger(zone_id)) {
    return res.status(400).json({ error: 'zone_id tidak valid' });
  }

  try {
    const resUpdate = await db.query(`
      UPDATE visit_logs vl
      SET visited = false, is_closed = false, visited_at = z.scheduled_date::timestamp
      FROM zones z
      WHERE vl.zone_id = z.id
        AND vl.zone_id = $1 
        AND vl.member_code = $2 
        AND vl.visited = true
        AND vl.visited_at >= DATE_TRUNC('month', z.scheduled_date::timestamp)
        AND vl.visited_at < DATE_TRUNC('month', z.scheduled_date::timestamp) + INTERVAL '1 month'
    `, [Number(zone_id), sanitizeString(member_code, 20)]);
    
    if (resUpdate.rowCount === 0) {
      return res.status(404).json({ error: 'Member kunjungan tidak ditemukan, belum ditandai, atau sudah disetujui' });
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error('visit/cancel error:', err.message);
    res.status(500).json({ error: 'Gagal membatalkan kunjungan' });
  }
});

// GET /api/zone/:id/visits
router.get('/zone/:id/visits', authenticate, requireSupervisorOrAbove, async (req, res) => {
  const zoneId = req.params.id;
  if (!isPositiveInteger(zoneId)) return res.status(400).json({ error: 'ID zona tidak valid' });

  try {
    const resZone = await db.query('SELECT scheduled_date FROM zones WHERE id = $1', [Number(zoneId)]);
    if (resZone.rows.length === 0) return res.status(404).json({ error: 'Zona tidak ditemukan' });
    const zone = resZone.rows[0];

    const resVisits = await db.query(`
      SELECT zm.member_code, zm.member_name, v.visited, v.is_closed, v.visited_at, v.is_approved, v.approved_at
      FROM zone_members zm
      JOIN visit_logs v ON zm.zone_id = v.zone_id AND zm.member_code = v.member_code
      WHERE zm.zone_id = $1
        AND v.visited_at >= DATE_TRUNC('month', $2::timestamp)
        AND v.visited_at < DATE_TRUNC('month', $2::timestamp) + INTERVAL '1 month'
    `, [Number(zoneId), zone.scheduled_date]);
    
    const visits = resVisits.rows;

    if (visits.length > 0) {
      const memberCodes = visits.map(v => v.member_code);
      const orders = await getMemberOrdersByDate(zone.scheduled_date, memberCodes);
      
      const orderMap = {};
      orders.forEach(o => {
        orderMap[o.kode_member] = o.harga_total_item;
      });

      visits.forEach(v => {
        v.harga_total_item = orderMap[v.member_code] || 0;
      });
    }

    res.json(visits);
  } catch (err) {
    console.error('zone/visits error:', err.message);
    res.status(500).json({ error: 'Gagal memuat detail kunjungan' });
  }
});

// POST /api/visit/approve
router.post('/visit/approve', authenticate, requireSupervisorOrAbove, async (req, res) => {
  const { zone_id, member_code } = req.body;
  if (!member_code || !zone_id) return res.status(400).json({ error: 'Member code dan zone_id harus diisi' });

  try {
    const resUpdate = await db.query(`
      UPDATE visit_logs vl
      SET is_approved = true, approved_at = $1 
      FROM zones z
      WHERE vl.zone_id = z.id
        AND vl.zone_id = $2 
        AND vl.member_code = $3 
        AND vl.visited = true 
        AND vl.is_approved = false
        AND vl.visited_at >= DATE_TRUNC('month', z.scheduled_date::timestamp)
        AND vl.visited_at < DATE_TRUNC('month', z.scheduled_date::timestamp) + INTERVAL '1 month'
    `, [new Date().toISOString(), Number(zone_id), sanitizeString(member_code, 20)]);
    
    if (resUpdate.rowCount === 0) {
      return res.status(404).json({ error: 'Kunjungan tidak ditemukan atau sudah disetujui' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menyetujui kunjungan' });
  }
});

// POST /api/reset (Admin & Supervisor)
router.post('/reset', authenticate, requireSupervisorOrAbove, async (req, res) => {
  try {
    const backupFilename = await performResetAndBackup();
    res.json({ success: true, backupFilename });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/monthly (Manager/Supervisor)
router.get('/analytics/monthly', authenticate, requireSupervisorOrAbove, getMonthlyEvaluation);

module.exports = router;
