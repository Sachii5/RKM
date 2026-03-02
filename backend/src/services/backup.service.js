const fs = require('fs');
const path = require('path');
const db = require('../db/sqlite');
const dayjs = require('dayjs');

const BACKUP_DIR = path.resolve(__dirname, '../../backup');
const DB_PATH = path.resolve(__dirname, '../../visits.db');

const performResetAndBackup = () => {
  // Ensure backup directory exists
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const today = dayjs().format('YYYYMMDD_HHmmss');
  const backupFilename = `visits_${today}.sqlite`;
  const backupPath = path.join(BACKUP_DIR, backupFilename);

  // Security: Validate backup path stays within backup directory (prevent path traversal)
  const resolvedBackup = path.resolve(backupPath);
  if (!resolvedBackup.startsWith(path.resolve(BACKUP_DIR))) {
    throw new Error('Invalid backup path');
  }

  // 1. Backup visits.db into /backup
  fs.copyFileSync(DB_PATH, backupPath);

  // 2. Clear all active zone data in a transaction
  const clearDb = db.transaction(() => {
    db.prepare('DELETE FROM visit_logs').run();
    db.prepare('DELETE FROM zone_members').run();
    db.prepare('DELETE FROM zones').run();
    
    // Reset autoincrement safely (table may not have entries in sqlite_sequence yet)
    try {
      db.prepare(`DELETE FROM sqlite_sequence WHERE name IN ('visit_logs', 'zone_members', 'zones')`).run();
    } catch (e) {
      // sqlite_sequence may not exist if no AUTOINCREMENT rows were inserted yet — safe to ignore
    }
  });
  
  clearDb();

  // 3. Delete backups older than 365 days
  cleanupOldBackups();

  return backupFilename;
};

const cleanupOldBackups = () => {
  if (!fs.existsSync(BACKUP_DIR)) return;

  const now = dayjs();
  const files = fs.readdirSync(BACKUP_DIR);

  files.forEach(file => {
    if (file.startsWith('visits_') && file.endsWith('.sqlite')) {
      const filePath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filePath);
      const mtime = dayjs(stats.mtime);
      const diffDays = now.diff(mtime, 'day');

      if (diffDays > 365) {
        fs.unlinkSync(filePath);
        console.log(`Deleted old backup: ${file}`);
      }
    }
  });
};

module.exports = {
  performResetAndBackup
};
