@echo off
echo Installing dependencies...
call npm install
echo.
echo Starting NCC Admin on http://localhost:3000
call npm run dev
