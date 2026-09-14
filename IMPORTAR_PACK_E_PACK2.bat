@echo off
setlocal
cd /d "%~dp0"
title Shadow Ascension - Importar PACK + PACK2

echo ============================================================
echo  SHADOW ASCENSION - IMPORTAR PACK + PACK2
 echo  SOMENTE MOBS E CENARIO. O PLAYER NAO SERA ALTERADO.
echo ============================================================
where node >nul 2>nul || (echo [ERRO] Node.js nao encontrado.& pause & exit /b 1)

set "PACK1=%~dp0PACK"
set "PACK2=%~dp0PACK2"
if not exist "%PACK1%" echo [AVISO] PACK nao encontrada em "%PACK1%"
if not exist "%PACK2%" echo [AVISO] PACK2 nao encontrada em "%PACK2%"

node tools\import-packs.mjs "%PACK1%" "%PACK2%"
if errorlevel 1 (
  echo.
  echo [ERRO] Nao foi possivel importar. Veja as mensagens acima.
  pause
  exit /b 1
)

echo.
echo [OK] Assets importados para public\models\packs
 echo [OK] Veja PACKS_RELATORIO.txt para saber exatamente o que entrou.
 echo [INFO] Personagens/NPCs dos packs sao ignorados de proposito.
pause
