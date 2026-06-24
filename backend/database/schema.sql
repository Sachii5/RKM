CREATE TABLE IF NOT EXISTS users_local (
    id SERIAL PRIMARY KEY,
    userid VARCHAR(50) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL,
    password_hash TEXT NOT NULL,
    first_login BOOLEAN DEFAULT TRUE
);

-- Pastikan kolom fullname ditambahkan jika tabel users_local sudah dibuat pada versi sebelumnya
ALTER TABLE users_local ADD COLUMN IF NOT EXISTS fullname VARCHAR(150);

CREATE TABLE IF NOT EXISTS zones (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50) NOT NULL,
    salesman_code VARCHAR(50) NOT NULL,
    zone_type VARCHAR(20) NOT NULL,
    center_lat DOUBLE PRECISION,
    center_lng DOUBLE PRECISION,
    radius_km DOUBLE PRECISION,
    kelurahan VARCHAR(100),
    scheduled_date DATE NOT NULL,
    total_member INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS zone_members (
    id SERIAL PRIMARY KEY,
    zone_id INTEGER NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
    member_code VARCHAR(50) NOT NULL,
    member_name VARCHAR(150),
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    alamat_snapshot TEXT,
    hp_snapshot VARCHAR(20),
    email_snapshot VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS visit_logs (
    id SERIAL,
    zone_id INTEGER NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
    member_code VARCHAR(50) NOT NULL,
    visited BOOLEAN DEFAULT FALSE,
    is_closed BOOLEAN DEFAULT FALSE,
    visited_at TIMESTAMP,
    is_approved BOOLEAN DEFAULT FALSE,
    approved_at TIMESTAMP,
    reject_reason TEXT,
    PRIMARY KEY (id, visited_at)
) PARTITION BY RANGE (visited_at);

-- Pastikan kolom reject_reason ditambahkan jika tabel visit_logs sudah dibuat pada versi sebelumnya
ALTER TABLE visit_logs ADD COLUMN IF NOT EXISTS reject_reason TEXT;

CREATE TABLE IF NOT EXISTS visit_logs_2026_05 PARTITION OF visit_logs FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS visit_logs_2026_06 PARTITION OF visit_logs FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    role VARCHAR(20) NOT NULL,
    action VARCHAR(100) NOT NULL,
    target_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS visit_surveys (
    id SERIAL PRIMARY KEY,
    visit_id INTEGER NOT NULL,
    member_code VARCHAR(50) NOT NULL,
    advisor_name VARCHAR(100),
    kendala_belanja JSONB,
    produk_mahal JSONB,
    produk_belum_ada TEXT,
    sumber_info_promo JSONB,
    promo_menarik VARCHAR(150),
    perlu_kunjungan_rutin TEXT,
    saran_kritik TEXT,
    berhasil_order TEXT,
    foto_kunjungan_url VARCHAR(255),
    visit_lat DOUBLE PRECISION,
    visit_lng DOUBLE PRECISION,
    visit_accuracy_m DOUBLE PRECISION,
    visit_captured_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Perlu longgar karena pilihan "Lainnya" bisa berisi alasan bebas dari user lapangan
ALTER TABLE visit_surveys ALTER COLUMN perlu_kunjungan_rutin TYPE TEXT;
ALTER TABLE visit_surveys ALTER COLUMN berhasil_order TYPE TEXT;
ALTER TABLE visit_surveys ADD COLUMN IF NOT EXISTS visit_lat DOUBLE PRECISION;
ALTER TABLE visit_surveys ADD COLUMN IF NOT EXISTS visit_lng DOUBLE PRECISION;
ALTER TABLE visit_surveys ADD COLUMN IF NOT EXISTS visit_accuracy_m DOUBLE PRECISION;
ALTER TABLE visit_surveys ADD COLUMN IF NOT EXISTS visit_captured_at TIMESTAMP;

-- Indexes for performance optimization (Safe & Zero Downtime for existing data)
CREATE INDEX IF NOT EXISTS idx_visit_surveys_created_at ON visit_surveys(created_at);
CREATE INDEX IF NOT EXISTS idx_visit_surveys_visit_id ON visit_surveys(visit_id);

CREATE INDEX IF NOT EXISTS idx_zones_salesman ON zones(salesman_code);
CREATE INDEX IF NOT EXISTS idx_zones_status ON zones(status);
CREATE INDEX IF NOT EXISTS idx_zones_date ON zones(scheduled_date);

CREATE INDEX IF NOT EXISTS idx_zone_members_zone_id ON zone_members(zone_id);
CREATE INDEX IF NOT EXISTS idx_zone_members_code ON zone_members(member_code);

CREATE INDEX IF NOT EXISTS idx_visit_logs_zone_member ON visit_logs(zone_id, member_code);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
