const express = require('express');
const router = express.Router();

const { getMembers, getMemberOrdersByDate } = require('../db/pg');
const db = require('../db/pg_ops');
const { getZoneByRadius, getZoneByKelurahan, createZoneTransaction, softDeleteZone } = require('../services/zone.service');
const { getTodayRoute } = require('../services/route.service');
const { performResetAndBackup } = require('../services/backup.service');
const authService = require('../services/auth.service');
const { isValidSalesman, getTodayDateString } = require('../utils/helpers');
const { getMonthlyEvaluation, getSurveyAnalytics } = require('../controllers/analytics.controller');

const authenticate = require('../middleware/auth.middleware');
const { requireSupervisorOrAbove, requireSalesman, requireAdmin } = require('../middleware/role.middleware');

const multer = require('multer');
const path = require('path');
const MAX_SURVEY_PHOTO_SIZE_BYTES = 15 * 1024 * 1024;
const ALLOWED_SURVEY_PHOTO_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif'
]);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../../uploads/surveys/'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'survey-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ 
  storage: storage,
  limits: { fileSize: MAX_SURVEY_PHOTO_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_SURVEY_PHOTO_MIMES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file foto JPG, PNG, WEBP, HEIC, atau HEIF yang diperbolehkan!'));
    }
  }
});

// === Input Validation Helpers ===
const isValidDateFormat = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d);
const isValidSalesmanCode = (s) => typeof s === 'string' && /^[A-Z]{2,5}$/i.test(s.trim());
const isPositiveInteger = (v) => Number.isInteger(Number(v)) && Number(v) > 0;
const sanitizeString = (s, maxLen = 100) => typeof s === 'string' ? s.trim().substring(0, maxLen) : '';
const isWithinMaxLength = (s, maxLen) => !s || (typeof s === 'string' && s.length <= maxLen);

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
             z.radius_km, z.scheduled_date, z.total_member, z.status,
             to_char(z.created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at,
             z.created_by,
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
             z.total_member, z.status,
             to_char(z.created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at,
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
      SET visited = true, is_closed = false, visited_at = timezone('Asia/Jakarta', now())
      FROM zones z
      WHERE vl.zone_id = z.id
        AND vl.zone_id = $1
        AND vl.member_code = $2
        AND vl.visited = false
        AND vl.visited_at >= DATE_TRUNC('month', z.scheduled_date::timestamp)
        AND vl.visited_at < DATE_TRUNC('month', z.scheduled_date::timestamp) + INTERVAL '1 month'
    `, [Number(zone_id), sanitizeString(member_code, 20)]);
    
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
      SET visited = true, is_closed = true, visited_at = timezone('Asia/Jakarta', now())
      FROM zones z
      WHERE vl.zone_id = z.id
        AND vl.zone_id = $1
        AND vl.member_code = $2
        AND vl.visited = false
        AND vl.visited_at >= DATE_TRUNC('month', z.scheduled_date::timestamp)
        AND vl.visited_at < DATE_TRUNC('month', z.scheduled_date::timestamp) + INTERVAL '1 month'
    `, [Number(zone_id), sanitizeString(member_code, 20)]);
    
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
      SELECT zm.member_code, zm.member_name, v.id as visit_log_id, v.visited, v.is_closed,
             to_char(v.visited_at, 'YYYY-MM-DD HH24:MI:SS') as visited_at,
             v.is_approved,
             to_char(v.approved_at, 'YYYY-MM-DD HH24:MI:SS') as approved_at,
             vs.foto_kunjungan_url, vs.visit_lat, vs.visit_lng, vs.visit_accuracy_m,
             to_char(vs.visit_captured_at, 'YYYY-MM-DD HH24:MI:SS') as visit_captured_at
      FROM zone_members zm
      JOIN visit_logs v ON zm.zone_id = v.zone_id AND zm.member_code = v.member_code
      LEFT JOIN LATERAL (
        SELECT foto_kunjungan_url, visit_lat, visit_lng, visit_accuracy_m, visit_captured_at
        FROM visit_surveys
        WHERE visit_id = v.id
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      ) vs ON true
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
      SET is_approved = true, approved_at = timezone('Asia/Jakarta', now())
      FROM zones z
      WHERE vl.zone_id = z.id
        AND vl.zone_id = $1
        AND vl.member_code = $2
        AND vl.visited = true 
        AND vl.is_approved = false
        AND vl.visited_at >= DATE_TRUNC('month', z.scheduled_date::timestamp)
        AND vl.visited_at < DATE_TRUNC('month', z.scheduled_date::timestamp) + INTERVAL '1 month'
    `, [Number(zone_id), sanitizeString(member_code, 20)]);
    
    if (resUpdate.rowCount === 0) {
      return res.status(404).json({ error: 'Kunjungan tidak ditemukan atau sudah disetujui' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menyetujui kunjungan' });
  }
});

// POST /api/visit/reject
router.post('/visit/reject', authenticate, requireSupervisorOrAbove, async (req, res) => {
  const { zone_id, member_code, reason } = req.body;
  if (!member_code || !zone_id) return res.status(400).json({ error: 'Member code dan zone_id harus diisi' });

  try {
    const resUpdate = await db.query(`
      UPDATE visit_logs vl
      SET visited = false, is_closed = false, visited_at = z.scheduled_date::timestamp, reject_reason = $1
      FROM zones z
      WHERE vl.zone_id = z.id
        AND vl.zone_id = $2 
        AND vl.member_code = $3 
        AND vl.visited = true 
        AND vl.is_approved = false
        AND vl.visited_at >= DATE_TRUNC('month', z.scheduled_date::timestamp)
        AND vl.visited_at < DATE_TRUNC('month', z.scheduled_date::timestamp) + INTERVAL '1 month'
    `, [reason || null, Number(zone_id), sanitizeString(member_code, 20)]);
    
    if (resUpdate.rowCount === 0) {
      return res.status(404).json({ error: 'Kunjungan tidak ditemukan atau sudah disetujui' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menolak kunjungan' });
  }
});

// POST /api/upload/survey-photo
router.post('/upload/survey-photo', authenticate, requireSalesman, (req, res) => {
  upload.single('photo')(req, res, function (err) {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Tidak ada file yang diunggah' });
    }
    const fileUrl = '/uploads/surveys/' + req.file.filename;
    res.json({ url: fileUrl });
  });
});

// POST /api/visit/:visit_id/survey
router.post('/visit/:visit_id/survey', authenticate, requireSalesman, async (req, res) => {
  const visit_id = req.params.visit_id;
  const {
    member_code,
    kendala_belanja,
    produk_mahal,
    produk_belum_ada,
    sumber_info_promo,
    promo_menarik,
    perlu_kunjungan_rutin,
    saran_kritik,
    berhasil_order,
    foto_kunjungan_url,
    visit_lat,
    visit_lng,
    visit_accuracy_m,
    visit_captured_at
  } = req.body;

  const advisor_name = req.user.userid; // Get from JWT token

  if (!visit_id || !member_code) {
    return res.status(400).json({ error: 'visit_id dan member_code wajib diisi' });
  }
  if (!isWithinMaxLength(perlu_kunjungan_rutin, 255)) {
    return res.status(400).json({ error: 'Jawaban kunjungan rutin maksimal 255 karakter' });
  }
  if (!isWithinMaxLength(berhasil_order, 255)) {
    return res.status(400).json({ error: 'Jawaban berhasil order maksimal 255 karakter' });
  }

  const lat = Number(visit_lat);
  const lng = Number(visit_lng);
  const accuracy = Number(visit_accuracy_m);
  const capturedAt = visit_captured_at ? new Date(visit_captured_at) : null;

  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    return res.status(400).json({ error: 'Lokasi GPS wajib diaktifkan dan harus valid' });
  }
  if (!Number.isFinite(accuracy) || accuracy < 0) {
    return res.status(400).json({ error: 'Akurasi GPS tidak valid' });
  }
  if (!capturedAt || Number.isNaN(capturedAt.getTime())) {
    return res.status(400).json({ error: 'Waktu pengambilan lokasi tidak valid' });
  }

  try {
    // Validasi eksistensi visit_id
    const checkVisit = await db.query('SELECT id FROM visit_logs WHERE id = $1', [visit_id]);
    if (checkVisit.rows.length === 0) {
      return res.status(404).json({ error: 'Data kunjungan (visit_id) tidak valid atau tidak ditemukan' });
    }

    const query = `
      INSERT INTO visit_surveys (
        visit_id, member_code, advisor_name, kendala_belanja, produk_mahal, 
        produk_belum_ada, sumber_info_promo, promo_menarik, 
        perlu_kunjungan_rutin, saran_kritik, berhasil_order, foto_kunjungan_url,
        visit_lat, visit_lng, visit_accuracy_m, visit_captured_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::timestamptz AT TIME ZONE 'Asia/Jakarta')
      RETURNING id
    `;
    
    // Konversi array ke format JSON string agar aman masuk kolom JSONB
    const safeJsonb = (val) => JSON.stringify(Array.isArray(val) ? val : (val ? [val] : []));

    const values = [
      visit_id,
      member_code,
      advisor_name,
      safeJsonb(kendala_belanja),
      safeJsonb(produk_mahal),
      produk_belum_ada || null,
      safeJsonb(sumber_info_promo),
      promo_menarik || null,
      perlu_kunjungan_rutin || null,
      saran_kritik || null,
      berhasil_order || null,
      foto_kunjungan_url || null,
      lat,
      lng,
      accuracy,
      capturedAt.toISOString()
    ];

    const result = await db.query(query, values);
    
    res.json({ success: true, survey_id: result.rows[0].id });
  } catch (err) {
    console.error('Submit survey error:', err.message);
    res.status(500).json({ error: 'Gagal menyimpan hasil survei' });
  }
});

// POST /api/reset (Admin & Supervisor)
router.post('/reset', authenticate, requireSupervisorOrAbove, async (req, res) => {
  const { adminUserid, adminPassword } = req.body;

  if (!adminUserid || !adminPassword) {
    return res.status(400).json({ error: 'Persetujuan Admin wajib diisi sebelum reset sistem.' });
  }

  try {
    const approval = await authService.loginUser(adminUserid, adminPassword);
    if (approval.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Reset sistem harus disetujui oleh akun ADMIN.' });
    }

    const backupFilename = await performResetAndBackup();
    res.json({ success: true, backupFilename });
  } catch (err) {
    if (err.message === 'Invalid credentials' || err.message === 'Unauthorized role structure') {
      return res.status(403).json({ error: 'Persetujuan Admin tidak valid.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/monthly (Manager/Supervisor)
router.get('/analytics/monthly', authenticate, requireSupervisorOrAbove, getMonthlyEvaluation);

// GET /api/analytics/surveys (Manager/Supervisor)
router.get('/analytics/surveys', authenticate, requireSupervisorOrAbove, getSurveyAnalytics);

module.exports = router;
