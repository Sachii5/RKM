const { getMembers } = require('../db/pg');
const { parseCoordinates, calculateDistance } = require('../utils/helpers');
const db = require('../db/pg_ops');

const checkConflict = async (salesmanCode, scheduledDate) => {
  const res = await db.query(`
    SELECT id FROM zones 
    WHERE salesman_code = $1 AND scheduled_date = $2 AND status = 'active'
  `, [salesmanCode.toUpperCase(), scheduledDate]);
  return res.rows.length > 0;
};

// Helper: Get all member codes that are already assigned to any active zone AND have been visited/approved
const getAlreadyZonedMemberCodes = async () => {
  const res = await db.query(`
    SELECT zm.member_code
    FROM zone_members zm
    JOIN zones z ON z.id = zm.zone_id
    LEFT JOIN visit_logs vl ON vl.zone_id = zm.zone_id AND vl.member_code = zm.member_code
    WHERE z.status = 'active'
    GROUP BY zm.member_code
    HAVING bool_or(vl.visited = true AND vl.is_closed = true) IS NOT TRUE
  `);
  return new Set(res.rows.map(r => r.member_code));
};

const getZoneByRadius = async (lat, lng, radiusKm, salesmanCode) => {
  const members = await getMembers();
  const zonedSet = await getAlreadyZonedMemberCodes();
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
  const zonedSet = await getAlreadyZonedMemberCodes();
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

const createZoneTransaction = async (userId, role, salesmanCode, scheduledDate, zoneType, zoneValue, members, centerLat = null, centerLng = null, radiusKm = null, kelurahan = null) => {
  if (await checkConflict(salesmanCode, scheduledDate)) {
    throw new Error(`Conflict: An active zone already exists for salesman ${salesmanCode} on ${scheduledDate}`);
  }

  // Transaction
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const now = new Date().toISOString();
    
    // 1. Insert Zone
    const zoneRes = await client.query(`
      INSERT INTO zones (created_at, created_by, salesman_code, zone_type, center_lat, center_lng, radius_km, kelurahan, scheduled_date, total_member, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active')
      RETURNING id
    `, [now, userId, salesmanCode, zoneType, centerLat, centerLng, radiusKm, kelurahan, scheduledDate, members.length]);
    
    const zoneId = zoneRes.rows[0].id;

    // 2. Insert Zone Members and Visit Logs
    const memberInsertQuery = `
      INSERT INTO zone_members (zone_id, member_code, member_name, lat, lng, alamat_snapshot, hp_snapshot, email_snapshot)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;
    
    const visitInsertQuery = `
      INSERT INTO visit_logs (zone_id, member_code, visited, is_approved, visited_at)
      VALUES ($1, $2, false, false, $3)
    `;

    for (const m of members) {
      // Snapshot address string for safety
      const alamat = `${m.cus_alamatmember4 || ''} - ${m.cus_alamatmember5 || ''}`;
      await client.query(memberInsertQuery, [zoneId, m.cus_kodemember, m.cus_namamember, m.lat, m.lng, alamat, m.cus_hpmember || '', m.cus_alamatemail || '']);
      await client.query(visitInsertQuery, [zoneId, m.cus_kodemember, scheduledDate]);
    }

    // 3. Audit Log
    await client.query(`
      INSERT INTO audit_logs (user_id, role, action, target_id, created_at)
      VALUES ($1, $2, 'CREATE_ZONE', $3, $4)
    `, [userId, role, String(zoneId), now]);

    await client.query('COMMIT');
    return zoneId;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

const softDeleteZone = async (userId, role, zoneId) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const resZone = await client.query('SELECT id FROM zones WHERE id = $1 AND status = $2', [zoneId, 'active']);
    if (resZone.rows.length === 0) throw new Error('Zone not found or already deleted');

    await client.query(`UPDATE zones SET status = 'deleted' WHERE id = $1`, [zoneId]);
    
    await client.query(`
      INSERT INTO audit_logs (user_id, role, action, target_id, created_at)
      VALUES ($1, $2, 'DELETE_ZONE', $3, $4)
    `, [userId, role, String(zoneId), new Date().toISOString()]);
    
    await client.query('COMMIT');
    return true;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

module.exports = {
  checkConflict,
  getZoneByRadius,
  getZoneByKelurahan,
  createZoneTransaction,
  softDeleteZone
};
