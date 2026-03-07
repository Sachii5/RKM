const express = require('express');
const cors = require('cors');
require('dotenv').config();

const apiRoutes = require('./src/routes/api');
const authRoutes = require('./src/routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Security: Restrict CORS to frontend origins (localhost + LAN)
const allowedOrigins = [
  'http://localhost:5173',
  'http://172.26.11.6:5173',
  'https://edp-2k.tailcd68fc.ts.net'
];
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Security: Limit request body size to prevent payload attacks
app.use(express.json({ limit: '1mb' }));

// Security: Basic rate limiting for auth routes (brute-force protection)
const loginAttempts = new Map();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_LOGIN_ATTEMPTS = 10;

app.use('/api/auth/login', (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  if (!loginAttempts.has(ip)) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now });
    return next();
  }
  
  const record = loginAttempts.get(ip);
  
  // Reset window if expired
  if (now - record.firstAttempt > RATE_LIMIT_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now });
    return next();
  }
  
  record.count++;
  
  if (record.count > MAX_LOGIN_ATTEMPTS) {
    return res.status(429).json({ 
      error: 'Terlalu banyak percobaan login. Silakan coba lagi dalam 15 menit.' 
    });
  }
  
  next();
});

// Periodic cleanup of rate limit map (every 30 min)
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of loginAttempts) {
    if (now - record.firstAttempt > RATE_LIMIT_WINDOW_MS) {
      loginAttempts.delete(ip);
    }
  }
}, 30 * 60 * 1000);

// Security: Remove X-Powered-By header
app.disable('x-powered-by');

// Main API routes
app.use('/api', apiRoutes);
app.use('/api/auth', authRoutes);

// Error handling middleware — never leak stack traces to client
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on 0.0.0.0:${PORT}`);
});
