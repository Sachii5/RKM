@echo off
title RKM Development Launcher
echo ===================================================
echo Memulai RKM mode DEVELOPMENT dengan Vite hot reload...
echo ===================================================

:: 1. Jalanin Backend di jendela CMD baru
echo [1/3] Menjalankan Backend Express dengan nodemon...
start "RKM Backend Dev" cmd /k "cd /d D:\PROJECT\RKM\backend && npm.cmd run dev"

:: Tunggu 3 detik biar backend nyala duluan
timeout /t 3 /nobreak >nul

:: 2. Jalanin Frontend Vite dev server
echo [2/3] Menjalankan Frontend Vite Dev Server...
start "RKM Frontend Dev" cmd /k "cd /d D:\PROJECT\RKM\frontend && npm.cmd run dev -- --host"

:: 3. Jalanin Tailscale Funnel minta akses Admin via PowerShell
echo [3/3] Menjalankan Tailscale Funnel (Silakan klik YES pada pop-up Admin)...
powershell -Command "Start-Process powershell -ArgumentList '-NoExit -Command tailscale funnel 5173' -Verb RunAs"

echo.
echo Semua service development sudah diluncurkan.
echo Mode ini memakai Vite hot reload dan bisa refresh saat file berubah.
echo Untuk pemakaian user lapangan, gunakan web_rkm.bat atau web_rkm_prod.bat.
echo.
pause
