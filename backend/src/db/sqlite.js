const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../../visits.db');

const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Note: In SQLite we cannot easily ALTER existing complex constraints, 
// so for a complete V2 upgrade we'll recreate tables via scripts.
// However, since visits.db might be empty or reset-able, we utilize IF NOT EXISTS.

try {
  // Check if visit_logs exists and has zone_id column
  const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='zone_members'").get();
  if (tableCheck) {
    db.prepare('SELECT hp_snapshot FROM zone_members LIMIT 1').get();
  }
} catch (e) {
  // If we catch an error, it means the V1 schema is active without zone_id. 
  // Drop the old tables to force a clean upgrade.
  db.exec(`
    DROP TABLE IF EXISTS visit_logs;
    DROP TABLE IF EXISTS zone_members;
    DROP TABLE IF EXISTS zones;
    DROP TABLE IF EXISTS audit_logs;
    DROP TABLE IF EXISTS users_local;
  `);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS users_local (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userid TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    first_login INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS zones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    created_by TEXT NOT NULL,
    salesman_code TEXT NOT NULL,
    zone_type TEXT NOT NULL,
    center_lat REAL,
    center_lng REAL,
    radius_km REAL,
    kelurahan TEXT,
    scheduled_date TEXT NOT NULL,
    total_member INTEGER NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'active'
  );

  CREATE TABLE IF NOT EXISTS zone_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    zone_id INTEGER NOT NULL,
    member_code TEXT NOT NULL,
    member_name TEXT,
    lat REAL,
    lng REAL,
    alamat_snapshot TEXT,
    hp_snapshot TEXT,
    email_snapshot TEXT,
    FOREIGN KEY(zone_id) REFERENCES zones(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS visit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    zone_id INTEGER NOT NULL,
    member_code TEXT NOT NULL,
    visited INTEGER DEFAULT 0,
    visited_at TEXT,
    is_approved INTEGER DEFAULT 0,
    approved_at TEXT,
    FOREIGN KEY(zone_id) REFERENCES zones(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    action TEXT NOT NULL,
    target_id TEXT,
    created_at TEXT NOT NULL
  );
`);

// Graceful migration step adding is_approved to visit_logs if missing
try {
  const columns = db.pragma("table_info(visit_logs)");
  const hasIsApproved = columns.some(col => col.name === 'is_approved');
  if (!hasIsApproved) {
    db.exec(`
      ALTER TABLE visit_logs ADD COLUMN is_approved INTEGER DEFAULT 0;
      ALTER TABLE visit_logs ADD COLUMN approved_at TEXT;
    `);
    console.log("Migration: Added is_approved column to visit_logs table");
  }
} catch (e) {
  console.log("Migration skipped or failed:", e.message);
}

module.exports = db;
