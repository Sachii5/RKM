const db = require('../db/pg_ops');

/**
 * Membuat tabel partisi visit_logs untuk 3 bulan ke depan (termasuk bulan ini).
 * Berjalan aman dengan klausa CREATE TABLE IF NOT EXISTS.
 */
const createNextPartitions = async () => {
  try {
    const today = new Date();
    
    // Mengecek/membuat partisi untuk bulan ini, bulan depan, dan bulan depannya lagi (3 bulan)
    for (let i = 0; i < 3; i++) {
      const targetDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const year = targetDate.getFullYear();
      const month = String(targetDate.getMonth() + 1).padStart(2, '0');
      
      const nextMonthDate = new Date(today.getFullYear(), today.getMonth() + i + 1, 1);
      const nextYear = nextMonthDate.getFullYear();
      const nextMonth = String(nextMonthDate.getMonth() + 1).padStart(2, '0');

      const tableName = `visit_logs_${year}_${month}`;
      const startDate = `${year}-${month}-01`;
      const endDate = `${nextYear}-${nextMonth}-01`;

      const query = `
        CREATE TABLE IF NOT EXISTS ${tableName} 
        PARTITION OF visit_logs 
        FOR VALUES FROM ('${startDate}') TO ('${endDate}');
      `;

      await db.query(query);
      console.log(`[PartitionManager] Partisi berhasil dicek/dibuat: ${tableName} (Range: ${startDate} s/d ${endDate})`);
    }
  } catch (error) {
    console.error('[PartitionManager] Gagal membuat partisi otomatis:', error.message);
  }
};

module.exports = {
  createNextPartitions
};
