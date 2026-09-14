@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
title Shadow Ascension - Publicar Aquino1M/rpgonline

echo ==========================================================
echo   PUBLICAR SHADOW ASCENSION V0.9.6 NO GITHUB
echo   https://github.com/Aquino1M/rpgonline.git
echo ==========================================================
echo.
where git >nul 2>&1 || (echo [ERRO] Git nao encontrado. Instale Git for Windows.& pause & exit /b 1)

if not exist ".git" (
  git init || goto :fail
)

git remote get-url origin >nul 2>&1
if errorlevel 1 (
  git remote add origin https://github.com/Aquino1M/rpgonline.git || goto :fail
) else (
  git remote set-url origin https://github.com/Aquino1M/rpgonline.git || goto :fail
)

git add -A || goto :fail
git diff --cached --quiet
if errorlevel 1 git commit -m "feat(v0.9.6): mobile complete, swipe shop, durability, camera and multiplayer" || goto :fail

git branch -M main || goto :fail
echo.
echo [INFO] Enviando para origin/main SEM force...
git push -u origin main
if errorlevel 1 (
  echo.
  echo [ERRO] O push nao foi aceito. Se o repositorio remoto ja tem commits,
  echo faça primeiro um pull/rebase ou use o GitHub Desktop para reconciliar.
  echo O script NAO usa --force para proteger arquivos que ja existam no repositorio.
  pause
  exit /b 2
)
echo.
echo [OK] Publicado em https://github.com/Aquino1M/rpgonline
pause
exit /b 0
:fail
echo.
echo [ERRO] Falha ao preparar o commit.
pause
exit /b 1
