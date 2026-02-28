# Sistem Zoning & Kunjungan Penjualan Internal V2

Aplikasi web internal untuk manajemen zona kunjungan dan penugasan rute salesman, dilengkapi dengan kendali berbasis peran, integrasi peta interaktif, dan penjadwalan zona yang **immutable** (tidak bisa diubah setelah dikunci).

---

## Arsitektur Sistem

```
RKM/
├── backend/              # Node.js + Express API Server
│   ├── src/
│   │   ├── db/           # pg.js (PostgreSQL readonly), sqlite.js (local state)
│   │   ├── middleware/   # auth.middleware.js, role.middleware.js
│   │   ├── routes/       # api.js, auth.js
│   │   ├── services/     # zone.service.js, route.service.js, backup.service.js, auth.service.js
│   │   └── utils/        # helpers.js, crypto.js, jwt.js
│   ├── tests/            # Jest test suite
│   └── server.js
├── frontend/             # Vue 3 + Vite SPA
│   └── src/
│       ├── pages/        # Dashboard, MapZoning, SalesmanRoute, ZoneList, Reset, ChangePassword
│       ├── stores/       # auth.js (Pinia)
│       └── router/       # index.js (Vue Router dengan guard RBAC)
└── visits.db             # Database SQLite lokal (state & auth)
```

---

## Stack Teknologi

| Komponen | Teknologi |
|---|---|
| Frontend | Vue 3 + Vite |
| Backend | Node.js + Express |
| Database Utama (READ ONLY) | PostgreSQL |
| Database Lokal (state & auth) | SQLite (better-sqlite3) |
| Autentikasi | JWT (jsonwebtoken) + bcrypt |
| Peta | Leaflet.js (Vanilla) dengan OpenStreetMap tiles |
| Testing | Jest + Supertest |

---

## Instalasi & Setup

### Prasyarat

- Node.js v18+
- Akses ke server PostgreSQL (READ ONLY)
- NPM

### Backend

```bash
cd backend
npm install
cp .env.example .env   # isi variabel PG_HOST, PG_USER, PG_PASS, PG_DB, JWT_SECRET
npm run dev            # nodemon server.js → port 3000
```

### Frontend

```bash
cd frontend
npm install
npm run dev            # vite dev server → port 5173
```

---

## Peran Pengguna & Hak Akses

| Fitur | Admin | Supervisor | Salesman |
|---|:---:|:---:|:---:|
| Login | ✅ | ✅ | ✅ |
| Peta Zoning Interaktif | ✅ | ✅ | ❌ |
| Buat Zona (Radius / Kecamatan) | ✅ | ✅ | ❌ |
| Hapus Zona | ✅ | ✅ | ❌ |
| Daftar Zona (semua salesman) | ✅ | ✅ | ❌ |
| Daftar Zona (milik sendiri) | ❌ | ❌ | ✅ |
| Rute Kunjungan Harian | ❌ | ❌ | ✅ |
| Tandai / Batalkan Kunjungan | ❌ | ❌ | ✅ |
| Reset Sistem | ✅ | ❌ | ❌ |

---

## Fitur Detail

### 1. Peta Zoning Interaktif (Admin & Supervisor)

**Mode Radius:** Klik peta → atur radius (km) → preview member dalam radius

**Mode Kecamatan:** Pilih kecamatan → sistem otomatis urutkan member terdekat dari **SPI KUNINGAN** (`-6.945995, 108.489238`)

**Aturan Kuota & Eksklusivitas:**
- Batas kuota per zona: **18 member**
- Member yang **sudah masuk zona aktif** otomatis di-exclude (pin biru di peta)
- Jika member di kecamatan/radius < 18, otomatis diisi dari member terdekat di luar area
- Member luar kecamatan ditampilkan pin **kuning** dengan badge "OUTSIDE"

**Warna Pin:**
- 🔵 Biru = Sudah masuk zona aktif
- ⚪ Abu-abu = Tersedia
- 🟢 Hijau = Terpilih (dalam kecamatan/radius)
- 🟡 Kuning = Terpilih dari luar kecamatan
- 🔴 Merah = Titik pusat

### 2. Rute Kunjungan Harian (Salesman)

- Rute dioptimalkan otomatis (algoritma Nearest Neighbor)
- Detail kontak member (HP + email) bisa diklik
- Tombol **Tandai Dikunjungi** dan **Batalkan Kunjungan**

### 3. Daftar Zona Kunjungan

- Admin/Supervisor: semua zona dengan filter per salesman + progress bar
- Salesman: hanya zona miliknya sendiri

---

## Endpoint API

| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| POST | `/api/auth/login` | Semua | Login |
| POST | `/api/auth/change-password` | Salesman | Ganti password |
| GET | `/api/members` | Admin/Supervisor | Semua member |
| POST | `/api/zone/radius` | Admin/Supervisor | Preview zona by radius |
| POST | `/api/zone/kelurahan` | Admin/Supervisor | Preview zona by kecamatan |
| POST | `/api/zone/create` | Admin/Supervisor | Kunci zona |
| DELETE | `/api/zone/:id` | Admin/Supervisor | Hapus zona |
| GET | `/api/zones` | Admin/Supervisor | Daftar semua zona |
| GET | `/api/zones/mine` | Salesman | Zona milik sendiri |
| GET | `/api/zones/member-codes` | Admin/Supervisor | Member yang sudah ter-zona |
| GET | `/api/route/today` | Salesman | Rute hari ini |
| POST | `/api/visit/mark` | Salesman | Tandai dikunjungi |
| POST | `/api/visit/cancel` | Salesman | Batalkan kunjungan |
| POST | `/api/reset` | Admin | Reset sistem |

---

## Akun Testing

| Role | Username | Password |
|---|---|---|
| Admin | `ALB` | `321321` |
| Supervisor | `FDL` | `123456` |
| Salesman | `DND` | `dnd123` |
