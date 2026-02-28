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

  const today = dayjs().format('YYYYMMDD');
  const backupFilename = `visits_${today}.sqlite`;
  const backupPath = path.join(BACKUP_DIR, backupFilename);

  // 1. Backup visits.db into /backup
  fs.copyFileSync(DB_PATH, backupPath);

  // 2. Clear visit_logs
  // Use a transaction for safety
  const clearDb = db.transaction(() => {
    db.prepare('DELETE FROM visit_logs').run();
    // Optional: Reset autoincrement
    db.prepare(`UPDATE sqlite_sequence SET seq = 0 WHERE name = 'visit_logs'`).run();
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
