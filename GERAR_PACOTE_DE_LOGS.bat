@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
if not exist "logs" (
  echo [ERRO] A pasta logs ainda nao existe. Execute o servidor LAN primeiro.
  pause
  exit /b 1
)
for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "STAMP=%%I"
set "OUT=ShadowAscension_LOGS_%STAMP%.zip"
if exist "%OUT%" del /q "%OUT%"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Compress-Archive -Path '%~dp0logs\*' -DestinationPath '%~dp0%OUT%' -Force"
if errorlevel 1 (
  echo [ERRO] Nao foi possivel criar o pacote.
  pause
  exit /b 2
)
echo.
echo [OK] Pacote criado:
echo %~dp0%OUT%
start "" "%~dp0"
pause
