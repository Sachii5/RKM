const fs = require('fs');
const path = require('path');
const db = require('../db/pg_ops');
const dayjs = require('dayjs');

const BACKUP_DIR = path.resolve(__dirname, '../../backup');

const performResetAndBackup = async () => {
  // Ensure backup directory exists
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const today = dayjs().format('YYYYMMDD_HHmmss');
  const backupFilename = `visits_${today}.json`;
  const backupPath = path.join(BACKUP_DIR, backupFilename);

  // Security: Validate backup path stays within backup directory (prevent path traversal)
  const resolvedBackup = path.resolve(backupPath);
  if (!resolvedBackup.startsWith(path.resolve(BACKUP_DIR))) {
    throw new Error('Invalid backup path');
  }

  // 1. Fetch data from PostgreSQL
  const resZones = await db.query('SELECT * FROM zones');
  const resMembers = await db.query('SELECT * FROM zone_members');
  const resVisits = await db.query('SELECT * FROM visit_logs');

  const backupData = {
    zones: resZones.rows,
    zone_members: resMembers.rows,
    visit_logs: resVisits.rows
  };

  // Write backup data to JSON file
  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));

  // 2. Clear all active zone data in a transaction
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM visit_logs');
    await client.query('DELETE FROM zone_members');
    await client.query('DELETE FROM zones');
    
    // Reset sequences in PostgreSQL
    await client.query('ALTER SEQUENCE zones_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE zone_members_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE visit_logs_id_seq RESTART WITH 1');
    
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  // 3. Delete backups older than 365 days
  cleanupOldBackups();

  return backupFilename;
};

const cleanupOldBackups = () => {
  if (!fs.existsSync(BACKUP_DIR)) return;

  const now = dayjs();
  const files = fs.readdirSync(BACKUP_DIR);

  files.forEach(file => {
    if (file.startsWith('visits_') && (file.endsWith('.sqlite') || file.endsWith('.json'))) {
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
