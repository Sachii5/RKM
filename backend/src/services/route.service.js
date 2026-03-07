const db = require('../db/sqlite');
const { calculateDistance } = require('../utils/helpers');

const getTodayRoute = (salesmanCode, scheduledDate) => {
  // 1. Load active zone for today
  const zone = db.prepare(`
    SELECT id, center_lat, center_lng 
    FROM zones 
    WHERE salesman_code = ? AND scheduled_date = ? AND status = 'active'
  `).get(salesmanCode.toUpperCase(), scheduledDate);

  if (!zone) return { zone: null, route: [] };

  // 2. Get zone_members & visit state
  const members = db.prepare(`
    SELECT zm.member_code, zm.member_name, zm.lat, zm.lng, zm.alamat_snapshot, zm.hp_snapshot, zm.email_snapshot, v.visited, v.visited_at, v.is_approved
    FROM zone_members zm
    JOIN visit_logs v ON zm.zone_id = v.zone_id AND zm.member_code = v.member_code
    WHERE zm.zone_id = ?
  `).all(zone.id);

  if (members.length === 0) return { zone, route: [] };

  // 3. Nearest Neighbor Heuristic
  const unvisited = members.filter(m => m.visited === 0 && m.lat !== null && m.lng !== null);
  const visited = members.filter(m => m.visited === 1 || m.lat === null || m.lng === null); // invalid coords thrown to end/visited

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
