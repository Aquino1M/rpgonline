@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
title Shadow Ascension V0.9.11 - Publicar no GitHub

echo ==========================================================
echo   SHADOW ASCENSION V0.9.11 - PUBLICAR GITHUB
echo   https://github.com/Aquino1M/rpgonline
echo ==========================================================
echo.

where git >nul 2>&1 || (
  echo [ERRO] Git nao encontrado. Instale o Git for Windows.
  pause
  exit /b 1
)

if not exist ".git" (
  echo [1/7] Inicializando repositorio local...
  git init || goto :fail
)

git remote get-url origin >nul 2>&1
if errorlevel 1 (
  git remote add origin https://github.com/Aquino1M/rpgonline.git || goto :fail
) else (
  git remote set-url origin https://github.com/Aquino1M/rpgonline.git || goto :fail
)

echo [2/7] Preparando branch main...
git checkout -B main || goto :fail

echo [3/7] Adicionando arquivos...
git add -A || goto :fail

git diff --cached --quiet
if errorlevel 1 (
  echo [4/7] Criando commit...
  git commit -m "feat(v0.9.11): mobile menus, camera, lobbies, fast travel and multiplayer" || goto :fail
) else (
  echo [4/7] Nenhuma alteracao nova para commitar.
)

echo [5/7] Atualizando referencia do GitHub...
git fetch origin main
if errorlevel 1 (
  echo.
  echo [AVISO] Nao foi possivel buscar origin/main.
  echo Se abrir uma janela do navegador, faca login no GitHub e autorize o Git Credential Manager.
  goto :authfail
)

echo [6/7] Conferindo acesso ao repositorio...
git ls-remote --exit-code origin refs/heads/main >nul 2>&1
if errorlevel 1 goto :authfail

echo [7/7] Enviando V0.9.11 para main com protecao force-with-lease...
REM O repositorio remoto contem somente os commits bootstrap gerados anteriormente.
REM Primeiro fazemos fetch e depois force-with-lease, que recusa o envio caso o remoto mude novamente.
git push -u origin main --force-with-lease
if errorlevel 1 goto :pushfail

echo.
echo ==========================================================
echo [OK] PUBLICADO COM SUCESSO
echo https://github.com/Aquino1M/rpgonline
echo ==========================================================
start "" "https://github.com/Aquino1M/rpgonline"
pause
exit /b 0

:authfail
echo.
echo [ERRO] O Git nao conseguiu confirmar o acesso ao GitHub.
echo O Brave pode ser usado normalmente. O Git Credential Manager abre o navegador padrao.
echo Se aparecer a tela do GitHub no Brave, entre na conta Aquino1M e autorize.
echo Depois execute este arquivo novamente.
pause
exit /b 2

:pushfail
echo.
echo [ERRO] O push foi recusado mesmo depois do fetch.
echo Tente novamente. Se outro commit tiver sido criado no GitHub entre o fetch e o push,
echo o force-with-lease bloqueia de proposito para nao apagar alteracoes novas.
echo.
echo Comandos manuais equivalentes:
echo   git fetch origin main
echo   git push -u origin main --force-with-lease
pause
exit /b 3

:fail
echo.
echo [ERRO] Falha ao preparar o repositorio local.
pause
exit /b 1
