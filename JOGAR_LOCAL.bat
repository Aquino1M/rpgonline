@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Shadow Ascension Web 3D V0.9.11
where npm >nul 2>&1
if errorlevel 1 (
  echo Node.js/NPM nao encontrado. Instale o Node.js LTS primeiro.
  pause
  exit /b 1
)
if not exist node_modules (
  echo [Shadow Ascension] Instalando dependencias...
  call npm install
  if errorlevel 1 (
    echo Erro ao instalar dependencias.
    pause
    exit /b 1
  )
)
echo [Shadow Ascension] Iniciando V0.9.11...
start "" http://localhost:5173
call npm run dev
