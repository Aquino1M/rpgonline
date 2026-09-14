@echo off
chcp 65001 >nul
set "DEST=E:\PROJETOS SAAS\VSCODE PROJETOS\GAMES\ShadowAscension_Web3D"
echo ======================================================
echo   Shadow Ascension V0.8.0 - Atualizador da pasta local
echo ======================================================
echo.
echo Para multiplayer PC + celular, execute INICIAR_SERVIDOR_LAN.bat na pasta instalada.
echo Origem: %~dp0
echo Destino: %DEST%
echo.
if not exist "E:\" (
  echo [ERRO] Unidade E: nao encontrada.
  pause
  exit /b 1
)
if not exist "%DEST%" mkdir "%DEST%"
echo Copiando projeto...
robocopy "%~dp0" "%DEST%" /E /XD node_modules dist .git /XF INSTALAR_NA_PASTA_E.bat /R:2 /W:1
set RC=%ERRORLEVEL%
if %RC% GEQ 8 (
  echo [ERRO] Robocopy retornou codigo %RC%.
  pause
  exit /b %RC%
)
echo.
echo Projeto atualizado em:
echo %DEST%
echo.
echo Execute INICIAR_SERVIDOR_LAN.bat para jogar no PC/celular na rede ou JOGAR_LOCAL.bat para teste local.
pause
