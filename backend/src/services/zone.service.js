const { getMembers } = require('../db/pg');
const { parseCoordinates, calculateDistance } = require('../utils/helpers');
const db = require('../db/sqlite');

const checkConflict = (salesmanCode, scheduledDate) => {
  const existing = db.prepare(`
    SELECT id FROM zones 
    WHERE salesman_code = ? AND scheduled_date = ? AND status = 'active'
  `).get(salesmanCode.toUpperCase(), scheduledDate);
  return !!existing;
};

// Helper: Get all member codes that are already assigned to any active zone
const getAlreadyZonedMemberCodes = () => {
  const rows = db.prepare(`
    SELECT DISTINCT zm.member_code 
    FROM zone_members zm
    JOIN zones z ON z.id = zm.zone_id
    WHERE z.status = 'active'
  `).all();
  return new Set(rows.map(r => r.member_code));
};

const getZoneByRadius = async (lat, lng, radiusKm, salesmanCode) => {
  const members = await getMembers();
  const zonedSet = getAlreadyZonedMemberCodes();
  const myMembers = members.filter(m => m.cus_nosalesman === salesmanCode.toUpperCase());
  
  const analyzedMembers = [];
  for (const m of myMembers) {
    const coords = parseCoordinates(m.crm_koordinat);
    if (!coords) continue;
    const distance = calculateDistance(lat, lng, coords.lat, coords.lng);
    const alreadyZoned = zonedSet.has(m.cus_kodemember);
    analyzedMembers.push({ ...m, distance_km: distance, lat: coords.lat, lng: coords.lng, already_zoned: alreadyZoned });
  }

  analyzedMembers.sort((a, b) => a.distance_km - b.distance_km);

  // Filter: only available (not already zoned) members within radius
  let availableInRadius = analyzedMembers.filter(m => m.distance_km <= radiusKm && !m.already_zoned);
  let requiresConfirmation = false;

  let result = [...availableInRadius];

  // If less than 18 available in radius, fill from closest outside radius (still not zoned)
  if (result.length < 18) {
    const needed = 18 - result.length;
    const resultCodes = new Set(result.map(m => m.cus_kodemember));
    const outsideRadius = analyzedMembers.filter(m => !resultCodes.has(m.cus_kodemember) && !m.already_zoned);
    const extras = outsideRadius.slice(0, needed);
    result = [...result, ...extras];
  }

  if (result.length > 18) {
    requiresConfirmation = true;
  }

  return { members: result, requiresConfirmation, totalFound: result.length, totalWithinRadius: availableInRadius.length };
};

const getZoneByKelurahan = async (kecamatan, salesmanCode) => {
  const members = await getMembers();
  const zonedSet = getAlreadyZonedMemberCodes();
  const searchKecamatan = kecamatan.toUpperCase().trim();
  
  // SPI Kuningan Reference Point
  const spiKuningan = { lat: -6.945995100429211, lng: 108.4892379767215 };

  let result = members.filter(m => 
    m.cus_nosalesman === salesmanCode.toUpperCase() &&
    m.cus_kecamatan_surat === searchKecamatan &&
    !zonedSet.has(m.cus_kodemember)
  ).map(m => {
    const coords = parseCoordinates(m.crm_koordinat) || {lat: null, lng: null};
    const dist = coords.lat ? calculateDistance(spiKuningan.lat, spiKuningan.lng, coords.lat, coords.lng) : Infinity;
    return { ...m, lat: coords.lat, lng: coords.lng, distance_km: dist, is_extra: false };
  });

  // Sort by closest to SPI Kuningan
  result.sort((a, b) => a.distance_km - b.distance_km);

  // If less than 18, fetch from outside the kecamatan (also excluding already-zoned)
  if (result.length < 18) {
    const needed = 18 - result.length;
    
    let outsideMembers = members.filter(m => 
      m.cus_nosalesman === salesmanCode.toUpperCase() &&
      m.cus_kecamatan_surat !== searchKecamatan &&
      !zonedSet.has(m.cus_kodemember)
    ).map(m => {
      const coords = parseCoordinates(m.crm_koordinat) || {lat: null, lng: null};
      const dist = coords.lat ? calculateDistance(spiKuningan.lat, spiKuningan.lng, coords.lat, coords.lng) : Infinity;
      return { ...m, lat: coords.lat, lng: coords.lng, distance_km: dist, is_extra: true };
    });

    outsideMembers.sort((a, b) => a.distance_km - b.distance_km);
    
    const extras = outsideMembers.slice(0, needed);
    result = [...result, ...extras];
  }

  return { members: result, requiresConfirmation: result.length > 18, totalFound: result.length };
};

const createZoneTransaction = (userId, role, salesmanCode, scheduledDate, zoneType, zoneValue, members, centerLat = null, centerLng = null, radiusKm = null, kelurahan = null) => {
  if (checkConflict(salesmanCode, scheduledDate)) {
    throw new Error(`Conflict: An active zone already exists for salesman ${salesmanCode} on ${scheduledDate}`);
  }

  // Transaction
  const performCreation = db.transaction(() => {
    const now = new Date().toISOString();
    
    // 1. Insert Zone
    const zoneInsertStmt = db.prepare(`
      INSERT INTO zones (created_at, created_by, salesman_code, zone_type, center_lat, center_lng, radius_km, kelurahan, scheduled_date, total_member, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `);
    
    const zoneRes = zoneInsertStmt.run(now, userId, salesmanCode, zoneType, centerLat, centerLng, radiusKm, kelurahan, scheduledDate, members.length);
    const zoneId = zoneRes.lastInsertRowid;

    // 2. Insert Zone Members and Visit Logs
    const memberInsertStmt = db.prepare(`
      INSERT INTO zone_members (zone_id, member_code, member_name, lat, lng, alamat_snapshot, hp_snapshot, email_snapshot)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const visitInsertStmt = db.prepare(`
      INSERT INTO visit_logs (zone_id, member_code, visited)
      VALUES (?, ?, 0)
    `);

    for (const m of members) {
      // Snapshot address string for safety
      const alamat = `${m.cus_alamatmember4 || ''} - ${m.cus_alamatmember5 || ''}`;
      memberInsertStmt.run(zoneId, m.cus_kodemember, m.cus_namamember, m.lat, m.lng, alamat, m.cus_hpmember || '', m.cus_alamatemail || '');
      visitInsertStmt.run(zoneId, m.cus_kodemember);
    }

    // 3. Audit Log
    db.prepare(`
      INSERT INTO audit_logs (user_id, role, action, target_id, created_at)
      VALUES (?, ?, 'CREATE_ZONE', ?, ?)
    `).run(userId, role, String(zoneId), now);

    return zoneId;
  });

  return performCreation();
};

const softDeleteZone = (userId, role, zoneId) => {
  const performDeletion = db.transaction(() => {
    const zone = db.prepare('SELECT id FROM zones WHERE id = ? AND status = ?').get(zoneId, 'active');
    if (!zone) throw new Error('Zone not found or already deleted');

    db.prepare(`UPDATE zones SET status = 'deleted' WHERE id = ?`).run(zoneId);
    
    db.prepare(`
      INSERT INTO audit_logs (user_id, role, action, target_id, created_at)
      VALUES (?, ?, 'DELETE_ZONE', ?, ?)
    `).run(userId, role, String(zoneId), new Date().toISOString());
    
    return true;
  });
  
  return performDeletion();
};

module.exports = {
  checkConflict,
  getZoneByRadius,
  getZoneByKelurahan,
  createZoneTransaction,
  softDeleteZone
};
