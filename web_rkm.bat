@echo off
title RKM Server Launcher
echo ===================================================
echo Memulai RKM Backend, Frontend, dan Tailscale Funnel...
echo ===================================================

:: 1. Jalanin Backend di jendela CMD baru
echo [1/3] Menjalankan Backend Express...
start "RKM Backend" cmd /k "cd /d D:\PROJECT\RKM\backend && npm run dev"

:: Tunggu 3 detik biar backend nyala duluan (opsional tapi disarankan)
timeout /t 3 /nobreak >nul

:: 2. Jalanin Frontend di jendela CMD baru
echo [2/3] Menjalankan Frontend Vite...
start "RKM Frontend" cmd /k "cd /d D:\PROJECT\RKM\frontend && npm run dev -- --host"

:: 3. Jalanin Tailscale Funnel minta akses Admin via PowerShell
echo [3/3] Menjalankan Tailscale Funnel (Silakan klik YES pada pop-up Admin)...
powershell -Command "Start-Process powershell -ArgumentList '-NoExit -Command tailscale funnel 5173' -Verb RunAs"

echo.
echo Semua service sudah diluncurkan di jendela masing-masing!
echo JANGAN TUTUP jendela-jendela hitam/biru yang baru kebuka biar webnya tetap jalan.
echo.
pause