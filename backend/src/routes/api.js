const express = require('express');
const router = express.Router();

const { getMembers } = require('../db/pg');
const db = require('../db/sqlite');
const { getZoneByRadius, getZoneByKelurahan, createZoneTransaction, softDeleteZone } = require('../services/zone.service');
const { getTodayRoute } = require('../services/route.service');
const { performResetAndBackup } = require('../services/backup.service');
const { isValidSalesman, getTodayDateString } = require('../utils/helpers');

const authenticate = require('../middleware/auth.middleware');
const { requireSupervisorOrAbove, requireSalesman, requireAdmin } = require('../middleware/role.middleware');

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
    return res.status(400).json({ error: 'Valid lat, lng, radius_km, and salesman_code required' });
  }

  try {
    const result = await getZoneByRadius(lat, lng, radius_km, salesman_code.toUpperCase());
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/zone/kelurahan
router.post('/zone/kelurahan', authenticate, requireSupervisorOrAbove, async (req, res) => {
  const { kelurahan, salesman_code } = req.body;
  if (!kelurahan || !salesman_code) {
    return res.status(400).json({ error: 'Kelurahan and salesman_code required' });
  }

  try {
    const result = await getZoneByKelurahan(kelurahan, salesman_code.toUpperCase());
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/zone/create
router.post('/zone/create', authenticate, requireSupervisorOrAbove, (req, res) => {
  const { salesman_code, scheduled_date, zone_type, members, center_lat, center_lng, radius_km, kelurahan } = req.body;
  
  if (!Array.isArray(members) || members.length === 0 || !salesman_code || !scheduled_date) {
    return res.status(400).json({ error: 'Invalid payload for zone creation' });
  }

  try {
    const zoneId = createZoneTransaction(
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
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/zone/:id
router.delete('/zone/:id', authenticate, requireSupervisorOrAbove, (req, res) => {
  try {
    softDeleteZone(req.user.userid, req.user.role, req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/zones - List all zones (Admin/Supervisor)
router.get('/zones', authenticate, requireSupervisorOrAbove, (req, res) => {
  try {
    const { salesman_code } = req.query;
    let query = `
      SELECT z.id, z.salesman_code, z.zone_type, z.kelurahan, z.center_lat, z.center_lng,
             z.radius_km, z.scheduled_date, z.total_member, z.status, z.created_at, z.created_by,
             COUNT(CASE WHEN vl.visited = 1 THEN 1 END) as visited_count,
             COUNT(CASE WHEN vl.visited = 0 THEN 1 END) as pending_count
      FROM zones z
      LEFT JOIN visit_logs vl ON vl.zone_id = z.id
      WHERE z.status = 'active'
    `;
    const params = [];
    if (salesman_code) {
      query += ' AND z.salesman_code = ?';
      params.push(salesman_code.toUpperCase());
    }
    query += ' GROUP BY z.id ORDER BY z.scheduled_date DESC';
    const zones = db.prepare(query).all(...params);
    res.json(zones);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/zones/mine - Salesman's own zones
router.get('/zones/mine', authenticate, requireSalesman, (req, res) => {
  try {
    const salesman = req.user.userid.toUpperCase();
    const zones = db.prepare(`
      SELECT z.id, z.salesman_code, z.zone_type, z.kelurahan, z.scheduled_date,
             z.total_member, z.status, z.created_at,
             COUNT(CASE WHEN vl.visited = 1 THEN 1 END) as visited_count,
             COUNT(CASE WHEN vl.visited = 0 THEN 1 END) as pending_count
      FROM zones z
      LEFT JOIN visit_logs vl ON vl.zone_id = z.id
      WHERE z.salesman_code = ? AND z.status = 'active'
      GROUP BY z.id
      ORDER BY z.scheduled_date DESC
    `).all(salesman);
    res.json(zones);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/zones/member-codes - All member codes currently in active zones
router.get('/zones/member-codes', authenticate, requireSupervisorOrAbove, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT DISTINCT zm.member_code 
      FROM zone_members zm
      JOIN zones z ON z.id = zm.zone_id
      WHERE z.status = 'active'
    `).all();
    res.json(rows.map(r => r.member_code));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/route/today
router.get('/route/today', authenticate, requireSalesman, (req, res) => {
  const salesman = req.user.userid.toUpperCase(); // Derived securely from JWT
  const today = req.query.date || getTodayDateString();

  try {
    const data = getTodayRoute(salesman, today);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/visit/mark
router.post('/visit/mark', authenticate, requireSalesman, (req, res) => {
  const { zone_id, member_code } = req.body;
  if (!member_code || !zone_id) {
    return res.status(400).json({ error: 'Member code and zone_id required' });
  }

  try {
    const stmt = db.prepare(`
      UPDATE visit_logs 
      SET visited = 1, visited_at = ? 
      WHERE zone_id = ? AND member_code = ? AND visited = 0
    `);
    
    const info = stmt.run(new Date().toISOString(), zone_id, member_code);
    
    if (info.changes === 0) {
      return res.status(404).json({ error: 'Pending route member not found for this zone' });
    }
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/visit/cancel
router.post('/visit/cancel', authenticate, requireSalesman, (req, res) => {
  const { zone_id, member_code } = req.body;
  if (!member_code || !zone_id) {
    return res.status(400).json({ error: 'Member code and zone_id required' });
  }

  try {
    const stmt = db.prepare(`
      UPDATE visit_logs 
      SET visited = 0, visited_at = NULL 
      WHERE zone_id = ? AND member_code = ? AND visited = 1
    `);
    
    const info = stmt.run(zone_id, member_code);
    
    if (info.changes === 0) {
      return res.status(404).json({ error: 'Member kunjungan tidak ditemukan atau belum ditandai' });
    }
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reset (Admin Only)
router.post('/reset', authenticate, requireAdmin, (req, res) => {
  try {
    const backupFilename = performResetAndBackup();
    res.json({ success: true, backupFilename });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
