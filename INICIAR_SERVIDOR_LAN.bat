@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
title Shadow Ascension - Jogo + Servidor LAN V0.8.0

where powershell >nul 2>&1
if errorlevel 1 (
  echo [ERRO] PowerShell nao foi encontrado no Windows.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server\start-lan.ps1"
set "ERR=%ERRORLEVEL%"
if not "%ERR%"=="0" (
  echo.
  echo [ERRO] O launcher LAN terminou com codigo %ERR%.
  echo.
  echo Abra a pasta LOGS e envie os arquivos mais recentes para diagnostico:
  echo %~dp0logs
  echo.
  if exist "%~dp0logs" start "" "%~dp0logs"
  pause
)
exit /b %ERR%
