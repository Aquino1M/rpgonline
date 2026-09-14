@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
echo Criando diagnostico completo de rede...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$d='%~dp0logs';New-Item -ItemType Directory -Force -Path $d^|Out-Null;$f=Join-Path $d ('diagnostico-manual-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.txt');'=== DATA ===' ^| Set-Content $f;Get-Date ^| Out-File $f -Append;'=== IPCONFIG /ALL ===' ^| Out-File $f -Append;ipconfig /all ^| Out-File $f -Append;'=== ROTAS ===' ^| Out-File $f -Append;route print -4 ^| Out-File $f -Append;'=== PORTAS 8765-8849 ===' ^| Out-File $f -Append;netstat -ano ^| Select-String ':87[6-9][0-9]^|:88[0-4][0-9]' ^| Out-File $f -Append;'=== FIREWALL SHADOW ===' ^| Out-File $f -Append;Get-NetFirewallRule -DisplayName 'Shadow Ascension LAN TCP *' -ErrorAction SilentlyContinue ^| Format-List * ^| Out-File $f -Append;'=== NODE ===' ^| Out-File $f -Append;where.exe node ^| Out-File $f -Append;node --version ^| Out-File $f -Append;Write-Host ('Salvo em: '+$f) -ForegroundColor Green"
pause
