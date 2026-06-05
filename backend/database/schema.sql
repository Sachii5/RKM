CREATE TABLE users_local (
    id SERIAL PRIMARY KEY,
    userid VARCHAR(50) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL,
    password_hash TEXT NOT NULL,
    first_login BOOLEAN DEFAULT TRUE
);

CREATE TABLE zones (
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

CREATE TABLE zone_members (
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

CREATE TABLE visit_logs (
    id SERIAL,
    zone_id INTEGER NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
    member_code VARCHAR(50) NOT NULL,
    visited BOOLEAN DEFAULT FALSE,
    is_closed BOOLEAN DEFAULT FALSE,
    visited_at TIMESTAMP,
    is_approved BOOLEAN DEFAULT FALSE,
    approved_at TIMESTAMP,
    PRIMARY KEY (id, visited_at)
) PARTITION BY RANGE (visited_at);

CREATE TABLE visit_logs_2026_05 PARTITION OF visit_logs FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE visit_logs_2026_06 PARTITION OF visit_logs FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    role VARCHAR(20) NOT NULL,
    action VARCHAR(100) NOT NULL,
    target_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE visit_surveys (
    id SERIAL PRIMARY KEY,
    visit_id INTEGER NOT NULL,
    member_code VARCHAR(50) NOT NULL,
    advisor_name VARCHAR(100),
    kendala_belanja JSONB,
    produk_mahal JSONB,
    produk_belum_ada TEXT,
    sumber_info_promo JSONB,
    promo_menarik VARCHAR(150),
    perlu_kunjungan_rutin VARCHAR(50),
    saran_kritik TEXT,
    berhasil_order VARCHAR(50),
    foto_kunjungan_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
