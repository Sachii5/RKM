const db = require('../db/pg_ops');
const { calculateDistance } = require('../utils/helpers');

const getTodayRoute = async (salesmanCode, scheduledDate) => {
  // 1. Load active zone for today
  const resZone = await db.query(`
    SELECT id, center_lat, center_lng 
    FROM zones 
    WHERE salesman_code = $1 AND scheduled_date = $2 AND status = 'active'
  `, [salesmanCode.toUpperCase(), scheduledDate]);

  const zone = resZone.rows[0];

  if (!zone) return { zone: null, route: [] };

  // 2. Get zone_members & visit state
  const resMembers = await db.query(`
    SELECT zm.member_code, zm.member_name, zm.lat, zm.lng, zm.alamat_snapshot, zm.hp_snapshot, zm.email_snapshot, v.visited, v.is_closed, v.visited_at, v.is_approved
    FROM zone_members zm
    JOIN visit_logs v ON zm.zone_id = v.zone_id AND zm.member_code = v.member_code
    WHERE zm.zone_id = $1
      AND v.visited_at >= DATE_TRUNC('month', $2::timestamp)
      AND v.visited_at < DATE_TRUNC('month', $2::timestamp) + INTERVAL '1 month'
  `, [zone.id, scheduledDate]);

  const members = resMembers.rows;

  if (members.length === 0) return { zone, route: [] };

  // 3. Nearest Neighbor Heuristic
  const unvisited = members.filter(m => m.visited === false && m.lat !== null && m.lng !== null);
  const visited = members.filter(m => m.visited === true || m.lat === null || m.lng === null); // invalid coords thrown to end/visited

  // Sort unvisited with NN
  let route = [];
  
  if (unvisited.length > 0) {
    // Start point: Map center or first unvisited member
    let currentPoint = { lat: zone.center_lat, lng: zone.center_lng };
    if (!currentPoint.lat || !currentPoint.lng) {
      currentPoint = { lat: unvisited[0].lat, lng: unvisited[0].lng };
    }

    let remaining = [...unvisited];
    while (remaining.length > 0) {
      // Find closest
      let nextIndex = 0;
      let minDistance = Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const d = calculateDistance(currentPoint.lat, currentPoint.lng, remaining[i].lat, remaining[i].lng);
        if (d < minDistance) {
          minDistance = d;
          nextIndex = i;
        }
      }

      const nextMember = remaining.splice(nextIndex, 1)[0];
      route.push(nextMember);
      currentPoint = { lat: nextMember.lat, lng: nextMember.lng };
    }
  }

  // Combine visited (at start or end)
  const fullRoute = [...visited, ...route];

  return { zone, route: fullRoute };
};

module.exports = {
  getTodayRoute
};
