@echo off
title WiFi Manager - Next.js Server
cd /d "%~dp0web"
echo Starting WiFi Manager Dashboard on http://localhost:3000 ...
npx next start -H 0.0.0.0 -p 3000
pause
