@echo off
title RKM Production Launcher
echo ===================================================
echo Memulai RKM mode PRODUCTION tanpa Vite hot reload...
echo ===================================================

:: 1. Jalanin Backend Express normal tanpa nodemon
echo [1/3] Menjalankan Backend Express...
start "RKM Backend" cmd /k "cd /d D:\PROJECT\RKM\backend && npm.cmd start"

:: Tunggu 3 detik biar backend nyala duluan
timeout /t 3 /nobreak >nul

:: 2. Build frontend lalu serve hasil build tanpa HMR di port 5173
echo [2/3] Build dan menjalankan Frontend Production Preview...
start "RKM Frontend Production" cmd /k "cd /d D:\PROJECT\RKM\frontend && npm.cmd run build && npm.cmd run preview -- --host 0.0.0.0 --port 5173"

:: 3. Jalanin Tailscale Funnel minta akses Admin via PowerShell
echo [3/3] Menjalankan Tailscale Funnel (Silakan klik YES pada pop-up Admin)...
powershell -Command "Start-Process powershell -ArgumentList '-NoExit -Command tailscale funnel 5173' -Verb RunAs"

echo.
echo Semua service production sudah diluncurkan.
echo Mode ini tidak memakai Vite dev hot reload, jadi form tidak akan refresh karena HMR.
echo Untuk development, gunakan web_rkm_dev.bat.
echo JANGAN TUTUP jendela-jendela hitam/biru yang baru kebuka biar webnya tetap jalan.
echo.
pause
