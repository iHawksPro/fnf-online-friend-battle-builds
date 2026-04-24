@echo off
setlocal
cd /d "%~dp0"
set PORT=8787
set PUBLIC_HOST=127.0.0.1
echo Starting FNF Online Friend Battle relay...
echo.
echo Server URL for players:
echo ws://127.0.0.1:8787
echo.
echo Keep this window open while playing.
echo If Windows Firewall asks, allow Node.js on private networks.
echo.
node server.js
echo.
echo Server stopped. Press any key to close.
pause >nul
