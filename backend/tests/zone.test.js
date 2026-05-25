const db = require('../src/db/pg_ops');
const { createZoneTransaction, softDeleteZone, checkConflict } = require('../src/services/zone.service');
const { performResetAndBackup } = require('../src/services/backup.service');
const fs = require('fs');
const path = require('path');

// Clean DB state before transactions
beforeAll(async () => {
  await db.query('DELETE FROM audit_logs');
  await db.query('DELETE FROM visit_logs');
  await db.query('DELETE FROM zone_members');
  await db.query('DELETE FROM zones');
});

afterAll(async () => {
  await db.end();
});

describe('Zone & DB Services Tests', () => {

  const dummyMembers = [
    {cus_kodemember: 'M1', cus_namamember: 'N1', lat: 1, lng: 1},
    {cus_kodemember: 'M2', cus_namamember: 'N2', lat: 1, lng: 1}
  ];

  test('3. Zone conflict detection and immutable transactions', async () => {
    // Creates initial zone
    const zoneId = await createZoneTransaction('TEST_USR', 'SUPERVISOR', 'DND', '2026-05-24', 'kelurahan', 'TEST_VAL', dummyMembers);
    expect(zoneId).toBeGreaterThan(0);
    
    // Checks conflict positively
    await expect(async () => {
      await createZoneTransaction('TEST_USR', 'SUPERVISOR', 'DND', '2026-05-24', 'radius', 5, dummyMembers);
    }).rejects.toThrow(/Conflict/);
    
    // Deletes and verifies soft delete conflict handling natively
    await softDeleteZone('TEST_USR', 'SUPERVISOR', zoneId);
    
    expect(await checkConflict('DND', '2026-05-24')).toBe(false);
  });

  test('4. Transaction rollback test', async () => {
    // Assuming schema forces members to NOT NULL, an active error inside transaction handles natively via exceptions
    await expect(async () => {
      await createZoneTransaction('TEST_USR', 'SUPERVISOR', 'DND', '2026-05-25', 'kelurahan', 'TEST_VAL', [{}]); 
      // Emptystring objects bypass parameter assignments cleanly causing native constraints to throw
    }).rejects.toThrow();
    
    // Assert zone was rolled back via zone query missing
    const res = await db.query(`SELECT * FROM zones WHERE scheduled_date = $1`, ['2026-05-25']);
    expect(res.rows.length).toBe(0);
  });

  test('8. Backup retention cleanup test', async () => {
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

    await performResetAndBackup();

    expect(fs.existsSync(oldFilePath)).toBe(false); // Validating native sweep deletion cleanly.
  });

});
