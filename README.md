# RKM: Route Tracking & Order Evaluation System

<<<<<<< HEAD
isreport-v2 adalah sistem *Single Page Application* (SPA) yang dirancang untuk pelacakan rute kunjungan *salesman* (RKM) dan pemantauan evaluasi order di Stock Point Indogrosir. Aplikasi ini dibangun dengan pendekatan UI/UX *Mobile-First*, memastikan antarmuka yang responsif, ringan, dan sangat efisien saat digunakan oleh *salesman* langsung di lapangan.
=======
RKM adalah sistem *Single Page Application* (SPA) yang dirancang untuk pelacakan rute kunjungan *salesman* (RKM) dan pemantauan evaluasi order di Stock Point Indogrosir. Aplikasi ini dibangun dengan pendekatan UI/UX *Mobile-First*, memastikan antarmuka yang responsif, ringan, dan sangat efisien saat digunakan oleh *salesman* langsung di lapangan.
>>>>>>> 9354464e001ae6b3d4892caaf90c1aaaf34889d9

## Arsitektur Database

Sistem ini digerakkan oleh arsitektur **Dual-Database** untuk memisahkan lalu lintas operasional dengan data inti perusahaan:

- **Master Database (PostgreSQL - Jaringan Internal)**
  Bersifat *Read-Only*. Basis data ini digunakan sebagai *source of truth* untuk validasi data pelanggan dan riwayat transaksi (Order Closing).
- **Operational Database (PostgreSQL - Lokal)**
  Bersifat *Read-Write*. Basis data ini dikhususkan untuk menampung seluruh data operasional harian (Zoning, Visit Logs). Tabel log kunjungan (*visit_logs*) dirancang menggunakan mekanisme **Table Partitioning per bulan** guna mempertahankan performa operasi baca dan tulis yang optimal pada volume data besar.

## Tech Stack

Sistem dikembangkan di atas tumpukan teknologi berikut:

**Frontend:**
- Vue 3 (Composition API)
- Vite
- Pinia
- TailwindCSS
- Chart.js
- Leaflet

**Backend:**
- Node.js
- Express
- pg (PostgreSQL Client)
- JWT (JSON Web Tokens)

## Prasyarat (Prerequisites)

Pastikan lingkungan (*environment*) pengembangan berikut telah terpasang di sistem Anda:
- Node.js
- Git
- PostgreSQL Server aktif

## Panduan Instalasi & Setup Environment

Ikuti langkah-langkah bernomor berikut untuk menginisialisasi aplikasi dari nol:

1. **Clone Repository & Instalasi Dependensi**
   Kloning *repository* ke direktori lokal Anda, lalu jalankan `npm install` pada folder `frontend` dan `backend`.
   ```bash
<<<<<<< HEAD
   git clone <repository_url> isreport-v2
   cd isreport-v2/frontend
=======
   git clone <repository_url> RKM
   cd RKM/frontend
>>>>>>> 9354464e001ae6b3d4892caaf90c1aaaf34889d9
   npm install
   cd ../backend
   npm install
   ```

2. **Konfigurasi Environment**
   Buka folder `backend`, duplikasi file `.env.example` menjadi `.env`, lalu isi seluruh kredensial koneksi database untuk PostgreSQL operasional lokal dan PostgreSQL master (Internal).

3. **Pembuatan Database**
<<<<<<< HEAD
   Buat sebuah basis data (*database*) kosong bernama `isreport_ops` secara manual menggunakan *pgAdmin* atau CLI `psql`.
=======
   Buat sebuah basis data (*database*) kosong bernama `rkmspi` secara manual menggunakan *pgAdmin* atau CLI `psql`.
>>>>>>> 9354464e001ae6b3d4892caaf90c1aaaf34889d9

4. **Inisialisasi Tabel Operasional**
   Masih di dalam folder `backend`, jalankan perintah berikut untuk mengeksekusi migrasi skema tabel operasional dan pembuat partisi bulanannya:
   ```bash
   npm run db:init
   ```

## Injeksi Data Historis

Untuk memasukkan data log kunjungan lama ke dalam PostgreSQL lokal, jalankan perintah berikut di dalam folder `backend`:

```bash
npm run db:migrate-legacy <path_ke_file_historis>
```
*Catatan:* Proses ini beroperasi dengan mekanisme Anti-Duplikasi (`ON CONFLICT`). Oleh karena itu, perintah ini sangat aman untuk dijalankan berulang kali untuk melakukan sinkronisasi dengan *file* yang berbeda tanpa risiko adanya *row* atau entri ganda.

## Menjalankan Aplikasi

Untuk menjalankan *server backend* dan *frontend* secara bersamaan (mode *development*), eksekusi perintah berikut:

```bash
npm run dev
```
