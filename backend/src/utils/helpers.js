const dayjs = require('dayjs');

// Validation utilities
const VALID_SALESMEN = ['DND', 'DPT', 'FRL', 'LID'];

const isValidSalesman = (code) => VALID_SALESMEN.includes(code);

const parseCoordinates = (coordString) => {
  if (!coordString || typeof coordString !== 'string') return null;
  const parts = coordString.split(',');
  if (parts.length !== 2) return null;
  
  const lat = parseFloat(parts[0].trim());
  const lng = parseFloat(parts[1].trim());

  if (isNaN(lat) || isNaN(lng)) return null;
  
  // Basic lat/lng bounds validation (for Indonesia typical, but broadly applying valid math bounds)
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return { lat, lng };
};

// Haversine formula
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c;
  return d;
};

// Date helper
const getTodayDateString = () => dayjs().format('YYYY-MM-DD');

module.exports = {
  isValidSalesman,
  parseCoordinates,
  calculateDistance,
  getTodayDateString,
  VALID_SALESMEN
};
