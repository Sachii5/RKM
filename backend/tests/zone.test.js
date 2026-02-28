const db = require('../src/db/sqlite');
const { createZoneTransaction, softDeleteZone, checkConflict } = require('../src/services/zone.service');
const { performResetAndBackup } = require('../src/services/backup.service');
const fs = require('fs');
const path = require('path');

// Clean DB state before transactions
beforeAll(() => {
  db.prepare('DELETE FROM audit_logs').run();
  db.prepare('DELETE FROM visit_logs').run();
  db.prepare('DELETE FROM zone_members').run();
  db.prepare('DELETE FROM zones').run();
});

describe('Zone & DB Services Tests', () => {

  const dummyMembers = [
    {cus_kodemember: 'M1', cus_namamember: 'N1', lat: 1, lng: 1},
    {cus_kodemember: 'M2', cus_namamember: 'N2', lat: 1, lng: 1}
  ];

  test('3. Zone conflict detection and immutable transactions', () => {
    // Creates initial zone
    const zoneId = createZoneTransaction('TEST_USR', 'SUPERVISOR', 'DND', '2023-11-01', 'kelurahan', 'TEST_VAL', dummyMembers);
    expect(zoneId).toBeGreaterThan(0);
    
    // Checks conflict positively
    expect(() => {
      createZoneTransaction('TEST_USR', 'SUPERVISOR', 'DND', '2023-11-01', 'radius', 5, dummyMembers);
    }).toThrow(/Conflict/);
    
    // Deletes and verifies soft delete conflict handling natively
    softDeleteZone('TEST_USR', 'SUPERVISOR', zoneId);
    
    expect(checkConflict('DND', '2023-11-01')).toBe(false);
  });

  test('4. Transaction rollback test', () => {
    // Assuming schema forces members to NOT NULL, an active error inside transaction handles natively via better-sqlite3 exceptions
    expect(() => {
      createZoneTransaction('TEST_USR', 'SUPERVISOR', 'DND', '2023-11-02', 'kelurahan', 'TEST_VAL', [{}]); 
      // Emptystring objects bypass parameter assignments cleanly causing native constraints to throw
    }).toThrow();
    
    // Assert zone was rolled back via zone query missing
    const res = db.prepare(`SELECT * FROM zones WHERE scheduled_date = '2023-11-02'`).all();
    expect(res.length).toBe(0);
  });

  test('8. Backup retention cleanup test', () => {
    const backupDir = path.resolve(__dirname, '../backup');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Creating fake old backup manually for structural testing
    const oldFilePath = path.join(backupDir, 'visits_old_fake.sqlite');
    fs.writeFileSync(oldFilePath, 'fake data');
    
    // Back-date file via touch
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 400); // 400 days old
    fs.utimesSync(oldFilePath, pastDate, pastDate);

    performResetAndBackup();

    expect(fs.existsSync(oldFilePath)).toBe(false); // Validating native sweep deletion cleanly.
  });

});
