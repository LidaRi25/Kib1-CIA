@echo off
chcp 65001 >nul
title KIB1 - CIA Incidentu laboratorija
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js nav instalēts. Lejupielādē: https://nodejs.org  ^(LTS versija^)
  echo.
  pause
  exit /b 1
)

if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo  Izveidots .env fails. Nomaini tajā ADMIN_PASSWORD!
)

if not exist "node_modules" (
  echo  Instalē atkarības ^(tikai pirmo reizi^)...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo  npm install neizdevās. Pārbaudi interneta savienojumu.
    pause
    exit /b 1
  )
)

node server.js
pause
