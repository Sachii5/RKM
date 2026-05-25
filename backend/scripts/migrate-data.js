const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbPath = process.argv[2];

if (!dbPath) {
  console.error('Harap berikan path file SQLite sebagai argumen.');
  console.error('Contoh: node scripts/migrate-data.js backups/visits_20260312.sqlite');
  process.exit(1);
}

const absoluteDbPath = path.resolve(process.cwd(), dbPath);

if (!fs.existsSync(absoluteDbPath)) {
  console.error(`File tidak ditemukan: ${absoluteDbPath}`);
  process.exit(1);
}

// TAHAP 1: Konfigurasi Input Dinamis & Koneksi
const sqliteDb = new Database(absoluteDbPath, { readonly: true });

const pgPool = new Pool({
  host: process.env.DB_OPS_HOST || 'localhost',
  port: process.env.DB_OPS_PORT || 5432,
  user: process.env.DB_OPS_USER || 'postgres',
  password: process.env.DB_OPS_PASS || '',
  database: process.env.DB_OPS_NAME || 'rkmspi',
});

// Helper for dynamic insert with Parameterized Query ($1, $2)
async function insertRow(client, tableName, row) {
  const columns = Object.keys(row);
  const values = Object.values(row);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
  return client.query(sql, values);
}

// Translasi Tipe Data 0/1 menjadi boolean true/false
function translateRow(row, table, context = {}) {
  const newRow = { ...row };
  const boolCols = ['is_approved', 'visited', 'first_login'];
  
  for (const col of boolCols) {
    if (newRow[col] !== undefined && newRow[col] !== null) {
      newRow[col] = (newRow[col] === 1 || newRow[col] === '1' || newRow[col] === true);
    }
  }

  // Handle NULL partition key in visit_logs
  if (table === 'visit_logs' && !newRow.visited_at) {
    if (newRow.zone_id && context.zonesCache[newRow.zone_id]) {
      newRow.visited_at = context.zonesCache[newRow.zone_id];
    } else {
      // Fallback if zone not found
      newRow.visited_at = new Date().toISOString().replace('T', ' ').substring(0, 19);
    }
  }

  return newRow;
}

async function migrate() {
  const client = await pgPool.connect();
  try {
    console.log(`Memulai migrasi dari ${absoluteDbPath}...`);
    
    // TAHAP 3.1: Finalisasi & Keamanan Transaksi (Bungkus ke dalam BEGIN)
    await client.query('BEGIN');

    // TAHAP 2: Logika Migrasi Tabel (Berurutan)
    // Cache zone scheduled_dates for visit_logs partition keys
    const zonesCache = {};
    try {
      const zRows = sqliteDb.prepare('SELECT id, scheduled_date FROM zones').all();
      for (const z of zRows) {
        zonesCache[z.id] = z.scheduled_date;
      }
    } catch (e) {}

    const tablesToMigrate = ['users_local', 'zones', 'zone_members', 'visit_logs'];

    for (const table of tablesToMigrate) {
      let rows;
      try {
        rows = sqliteDb.prepare(`SELECT * FROM ${table}`).all();
      } catch (e) {
        console.warn(`[!] Tabel ${table} tidak ditemukan di SQLite, melewati...`);
        continue;
      }

      if (table === 'visit_logs') {
        // PARTISI OTOMATIS: Buat tabel partisi bulanan menggunakan JS (lebih robust format tanggal)
        const distinctMonths = new Set();
        
        for (const row of rows) {
          const vDate = row.visited_at || zonesCache[row.zone_id];
          if (vDate) {
            const date = new Date(vDate);
            if (!isNaN(date.getTime())) {
              const y = date.getFullYear();
              const m = String(date.getMonth() + 1).padStart(2, '0');
              distinctMonths.add(`${y}_${m}`);
            }
          }
        }

        console.log(`[visit_logs] Menyiapkan ${distinctMonths.size} partisi bulanan...`);
        for (const month_str of distinctMonths) {
          const [y, m] = month_str.split('_');
          const start_date = `${y}-${m}-01`;
          
          // Kalkulasi bulan depan
          const nextMonth = new Date(parseInt(y), parseInt(m), 1);
          const end_date = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;
          
          const partitionName = `visit_logs_${month_str}`;
          try {
            await client.query(`
              CREATE TABLE IF NOT EXISTS ${partitionName} 
              PARTITION OF visit_logs 
              FOR VALUES FROM ('${start_date}') TO ('${end_date}')
            `);
          } catch (e) {
            console.warn(`[!] Gagal membuat partisi ${partitionName}: ${e.message}`);
          }
        }
      }

      let inserted = 0;
      for (const rawRow of rows) {
        const row = translateRow(rawRow, table, { zonesCache });
        const res = await insertRow(client, table, row);
        if (res.rowCount > 0) inserted++;
      }
      
      console.log(`[${table}] Berhasil diproses: ${inserted} insert, ${rows.length - inserted} diabaikan (duplikat/conflict).`);
    }

    console.log('\nMemperbaiki urutan sequence...');
    
    // TAHAP 3.2: Sequence Fixing
    const sequences = [
      { table: 'users_local', seq: 'users_local_id_seq' },
      { table: 'zones', seq: 'zones_id_seq' },
      { table: 'zone_members', seq: 'zone_members_id_seq' }
    ];

    for (const { table, seq } of sequences) {
      try {
        await client.query(`SELECT setval('${seq}', COALESCE((SELECT MAX(id) FROM ${table}), 1))`);
        console.log(`- Sequence ${seq} diperbarui berdasarkan MAX(id).`);
      } catch (err) {
        console.log(`- Melewati sequence ${seq} (mungkin tabel pivot tanpa ID primer).`);
      }
    }

    // TAHAP 3.1: COMMIT
    await client.query('COMMIT');
    console.log('\n[SUCCESS] Migrasi selesai dan berhasil disimpan (COMMIT).');
  } catch (error) {
    // TAHAP 3.1: ROLLBACK
    await client.query('ROLLBACK');
    console.error('\n[ERROR] Terjadi kesalahan selama migrasi, melakukan ROLLBACK.', error);
  } finally {
    client.release();
    sqliteDb.close();
    await pgPool.end();
  }
}

migrate();
