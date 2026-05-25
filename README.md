# ISReport v2

Sistem Single Page Application (SPA) untuk tracking rute kunjungan salesman dan monitoring evaluasi order di Stock Point Indogrosir.

## Arsitektur Database

ISReport v2 menggunakan arsitektur **Dual-Database** untuk memisahkan beban baca data operasional dan master:

1. **Master Database (PostgreSQL - Kantor)**
   - Bersifat **Read-Only**.
   - Bertindak sebagai *Single Source of Truth* untuk data pelanggan, wilayah, dan riwayat transaksi (Order Closing).

2. **Operational Database (PostgreSQL - Lokal)**
   - Bersifat **Read-Write**.
   - Digunakan untuk menampung data operasional harian seperti Zoning, Rute Kunjungan, dan Visit Logs.
   - **Table Partitioning**: Tabel `visit_logs` menggunakan strategi partisi otomatis berbasis *range* (bulanan) pada kolom `visited_at`. Pendekatan ini memastikan tabel tetap ringan, pencarian data spesifik menjadi lebih cepat, dan *maintenance* arsip bulanan tidak membebani performa aplikasi secara keseluruhan.

## Tech Stack

Proyek ini dibangun di atas ekosistem modern berikut:

**Frontend:**
- **Vue 3** & **Vite**
- **Pinia** (State Management)
- **TailwindCSS** (Styling UI)
- **Chart.js** (Dashboard Visualisasi)
- **Leaflet** (Integrasi Peta Interaktif)

**Backend:**
- **Node.js** & **Express**
- **pg** (PostgreSQL Client)
- **JWT** (JSON Web Token Authentication)

## Prasyarat (Prerequisites)

Sebelum melakukan *deploy* atau pengembangan, pastikan *environment* telah memenuhi prasyarat berikut:
1. **Node.js** (v18.0 atau lebih baru)
2. **PostgreSQL** (v12.0 atau lebih baru)

## Cara Instalasi & Setup Environment

Ikuti langkah-langkah di bawah ini untuk menjalankan aplikasi dari awal:

1. **Clone repository dan Install Dependencies**
   Masuk ke folder `backend` dan `frontend`, kemudian jalankan `npm install` di masing-masing folder.
   ```bash
   cd backend
   npm install
   cd ../frontend
   npm install
   ```

2. **Konfigurasi Environment Backend**
   Masuk ke folder `backend`, lalu salin template `.env.example` menjadi `.env`.
   ```bash
   cd backend
   cp .env.example .env
   ```
   Buka file `.env` dan lengkapi kredensial database operasional Anda:
   ```env
   PORT=3000
   DB_OPS_HOST=localhost
   DB_OPS_PORT=5432
   DB_OPS_USER=postgres
   DB_OPS_PASS=password_anda
   DB_OPS_NAME=isreport_ops
   ```

3. **Inisialisasi Tabel (DDL Schema)**
   Pastikan PostgreSQL sudah menyala dan Anda telah membuat database `isreport_ops` yang kosong. Lalu jalankan perintah inisialisasi untuk mengeksekusi skema tabel ke dalam database:
   ```bash
   npm run db:init
   ```

## Cara Migrasi Data Historis (Legacy Data)

Apabila Anda perlu memindahkan data operasional dari versi lawas (berbasis file SQLite) ke database PostgreSQL operasional yang baru, gunakan perintah migrasi berikut pada direktori `backend/`:

```bash
npm run db:migrate-legacy <path_ke_file_sqlite_anda>
```
> **Penting:** Proses migrasi ini dirancang sangat aman untuk dieksekusi berkali-kali jika terjadi kegagalan sebagian (partial failure). Script ini sudah dilengkapi dengan mekanisme perlindungan **Anti-Duplikasi (ON CONFLICT DO NOTHING)** sehingga data yang sudah ada tidak akan tercatat ganda.

## Menjalankan Aplikasi

Jalankan perintah berikut di dua tab/jendela terminal yang terpisah agar *log* dapat terpantau dengan jelas.

**Terminal 1 (Backend):**
```bash
cd backend
npm run dev
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
```

Aplikasi web dapat diakses pada `http://localhost:5173`.
