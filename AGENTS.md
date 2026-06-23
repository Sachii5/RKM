# AGENTS.md

## Ringkasan Project

RKM (Rute Kunjungan Mingguan) adalah aplikasi full-stack untuk membuat zona/rute kunjungan salesman, menetapkan member, melacak kunjungan harian, mengunggah bukti foto dan survey, serta melihat analytics performa kunjungan.

Stack utama:
- Backend: Node.js, Express, PostgreSQL.
- Frontend: Vue 3, Vite, Pinia, Vue Router.
- UI/geospasial: Leaflet.
- Analytics/export: Chart.js, vue-chartjs, xlsx.
- Auth: JWT, bcryptjs.
- Upload: multer.

Aplikasi memakai dua koneksi PostgreSQL:
- Master/member/order DB melalui `backend/src/db/pg.js` dengan env `PG_HOST`, `PG_USER`, `PG_PASS`, `PG_DB`, `PG_PORT`.
- Operational RKM DB melalui `backend/src/db/pg_ops.js` dengan env `DB_OPS_HOST`, `DB_OPS_USER`, `DB_OPS_PASS`, `DB_OPS_NAME`, `DB_OPS_PORT`.

## Struktur Folder Penting

```text
backend/
  server.js                  # Entry point Express API
  database/schema.sql        # Schema PostgreSQL operasional RKM
  src/controllers/           # Controller analytics
  src/db/                    # Koneksi PostgreSQL master dan operasional
  src/middleware/            # Middleware auth JWT dan role guard
  src/routes/                # Route API utama, auth, dan users
  src/services/              # Logic zoning, route, auth, backup
  src/utils/                 # Helper, JWT, crypto, partition manager
  tests/                     # Jest tests backend

frontend/
  index.html                 # Template Vite
  vite.config.js             # Konfigurasi Vite dan proxy API
  src/main.js                # Entry point Vue
  src/App.vue                # Layout aplikasi dan sidebar role-based
  src/router/index.js        # Route dan guard frontend
  src/stores/auth.js         # Pinia auth store
  src/pages/                 # Halaman utama aplikasi
  src/components/            # Komponen reusable
  src/assets/                # CSS/assets

web_rkm.bat                  # Launcher Windows untuk backend, frontend, dan Tailscale Funnel
README.md                    # Dokumentasi project
```

## Command Development, Test, Lint, Typecheck, Build

Jalankan install dependency per folder:

```bash
cd backend
npm install

cd ../frontend
npm install
```

Backend commands yang tersedia di `backend/package.json`:

```bash
cd backend
npm run dev
npm start
npm test
npm run db:init
```

Catatan:
- `npm run dev` menjalankan `nodemon server.js`.
- `npm start` menjalankan `node server.js`.
- `npm test` menjalankan `jest --coverage`.
- `npm run db:init` menjalankan schema SQL ke database yang tertulis di script package.

Frontend commands yang tersedia di `frontend/package.json`:

```bash
cd frontend
npm run dev
npm run build
npm run preview
```

Catatan:
- `npm run dev` menjalankan Vite dengan host `0.0.0.0`.
- `npm run build` menjalankan `vite build`.
- `npm run preview` menjalankan `vite preview`.

Tidak ada script lint atau typecheck yang tersedia di `backend/package.json` maupun `frontend/package.json`. Jangan menginstruksikan `npm run lint` atau `npm run typecheck` kecuali script tersebut ditambahkan lebih dulu.

## Convention Kode Yang Terlihat

- Backend memakai CommonJS: `require(...)` dan `module.exports`.
- Frontend memakai ES modules dan Vue SFC.
- Backend route Express dipisah ke:
  - `backend/src/routes/api.js`
  - `backend/src/routes/auth.js`
  - `backend/src/routes/users.js`
- Logic bisnis backend dipisah ke service, misalnya:
  - `zone.service.js`
  - `route.service.js`
  - `auth.service.js`
  - `backup.service.js`
- Akses database memakai `pg` Pool dan query parameterized untuk input dinamis.
- Auth backend memakai middleware `authenticate` dan role guard dari `role.middleware.js`.
- Frontend memakai Pinia untuk state auth dan Vue Router guard untuk pembatasan role.
- API frontend dipanggil dengan `axios`.
- Role yang terlihat di aplikasi: `ADMIN`, `SUPERVISOR`, `SALESMAN`.
- Style kode campuran tanpa formatter eksplisit; ikuti gaya file sekitar saat mengubah kode.
- Komentar dalam repo banyak memakai bahasa Indonesia. Gunakan komentar singkat hanya bila membantu memahami logic yang tidak langsung jelas.

## Aturan Perubahan Kode

- Jaga perubahan tetap kecil dan sesuai scope permintaan.
- Jangan mengubah file konfigurasi, schema, atau script package tanpa alasan langsung.
- Jangan menghapus atau mengganti endpoint lama tanpa mengecek pemakaian di frontend.
- Saat menambah endpoint backend, pastikan:
  - route memakai middleware auth yang sesuai,
  - role guard sesuai kebutuhan,
  - input divalidasi,
  - query database memakai parameterized query.
- Saat menambah halaman/frontend call, pastikan endpoint backend benar-benar tersedia.
- Jangan mengandalkan command lint/typecheck yang belum ada di package scripts.
- Jangan mengubah data credential atau menambahkan secret ke repository.
- Jika menyentuh flow auth, zoning, visit, upload, reset, atau analytics, cek dampaknya ke frontend dan backend sekaligus.

## Aturan Testing

- Backend memiliki Jest tests di `backend/tests/`.
- Command test backend yang tersedia:

```bash
cd backend
npm test
```

- Test backend dapat bergantung pada database operasional dan bisa melakukan operasi data seperti delete/insert. Pastikan environment test aman sebelum menjalankannya.
- Frontend belum memiliki script test di `frontend/package.json`.
- Tidak ada script lint/typecheck yang tersedia saat ini.
- Untuk perubahan backend service/helper, tambahkan atau sesuaikan Jest test bila memungkinkan.
- Untuk perubahan frontend, minimal verifikasi dengan `npm run build` dari folder `frontend` bila perubahan menyentuh build path.

## Aturan Keamanan

- Jangan commit `.env`, credential, token, password, atau data produksi.
- Backend JWT harus memakai `JWT_SECRET` dari environment untuk environment non-development.
- Jangan memperluas CORS tanpa kebutuhan jelas. CORS saat ini didefinisikan di `backend/server.js`.
- Upload file hanya boleh menerima gambar dan sudah dibatasi ukuran oleh multer. Jika mengubah upload, pertahankan validasi mimetype dan batas ukuran.
- Jangan membocorkan stack trace ke client; error handler backend saat ini mengembalikan pesan generik.
- Gunakan bcrypt untuk password lokal, mengikuti `backend/src/utils/crypto.js`.
- Hindari SQL string interpolation untuk input user. Gunakan parameterized query.
- Role guard wajib dipasang pada endpoint yang mengakses data user, zona, visit, reset, upload, atau analytics.
- Hati-hati dengan endpoint reset karena melakukan backup dan soft-delete zona aktif.

## Definition of Done

Sebuah perubahan dianggap selesai bila:

- Perubahan sesuai scope permintaan dan mengikuti struktur repo yang ada.
- Backend dan frontend yang terkait sudah konsisten, terutama nama endpoint dan payload.
- Command yang relevan dan tersedia sudah dijalankan bila aman:
  - Backend: `npm test`
  - Frontend: `npm run build`
- Jika command tidak dijalankan, alasannya dicatat.
- Tidak ada secret atau credential baru di repository.
- Tidak ada command/convention baru yang didokumentasikan tanpa dukungan di repo.
- Perubahan auth/role sudah mempertahankan akses `ADMIN`, `SUPERVISOR`, dan `SALESMAN` sesuai flow yang ada.
- Perubahan database mempertimbangkan schema dan partisi `visit_logs`.
- UI yang memakai API tetap memakai token Authorization saat endpoint membutuhkan auth.
