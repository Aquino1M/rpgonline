$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Version = '0.8.0'
$BasePort = 8765
$MaxPort = 8849
$LogsDir = Join-Path $ProjectRoot 'logs'
New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$LogFile = Join-Path $LogsDir "launcher-$Stamp.log"
$DiagFile = Join-Path $LogsDir "diagnostico-$Stamp.txt"

function Log([string]$level,[string]$text,[ConsoleColor]$color=[ConsoleColor]::Gray) {
  $line = "[{0}] [{1}] {2}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss.fff'),$level,$text
  Add-Content -Path $LogFile -Value $line -Encoding UTF8
  Write-Host $line -ForegroundColor $color
}
function Write-Step([string]$text) { Write-Host "`n$text" -ForegroundColor Cyan; Add-Content -Path $LogFile -Value "`n$text" -Encoding UTF8 }
function Is-PrivateIPv4([string]$ip) { return $ip -match '^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)' }
function Get-LanIPv4s {
  $found = New-Object System.Collections.Generic.List[string]
  try {
    $routes = Get-NetRoute -AddressFamily IPv4 -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Sort-Object RouteMetric, InterfaceMetric
    foreach ($route in $routes) {
      $ips = Get-NetIPAddress -AddressFamily IPv4 -InterfaceIndex $route.InterfaceIndex -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -ne '127.0.0.1' -and $_.IPAddress -notlike '169.254.*' }
      foreach ($entry in $ips) { if ((Is-PrivateIPv4 $entry.IPAddress) -and -not $found.Contains($entry.IPAddress)) { $found.Add($entry.IPAddress) } }
    }
  } catch { Log 'WARN' "Get-NetRoute falhou: $($_.Exception.Message)" Yellow }
  try {
    $fallback = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object {
      (Is-PrivateIPv4 $_.IPAddress) -and $_.InterfaceAlias -notmatch 'Loopback|vEthernet|WSL|VirtualBox|VMware|Tailscale|Hamachi|ZeroTier' -and $_.IPAddress -notlike '169.254.*'
    } | Sort-Object InterfaceMetric
    foreach ($entry in $fallback) { if (-not $found.Contains($entry.IPAddress)) { $found.Add($entry.IPAddress) } }
  } catch { Log 'WARN' "Get-NetIPAddress fallback falhou: $($_.Exception.Message)" Yellow }
  return @($found)
}
function Test-PortFree([int]$port) {
  $listener = $null
  try { $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any,$port); $listener.Start(); return $true }
  catch { return $false }
  finally { if ($listener) { try { $listener.Stop() } catch {} } }
}
function Test-Tcp([string]$hostName,[int]$port,[int]$timeoutMs=1000) {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $iar = $client.BeginConnect($hostName,$port,$null,$null)
    if (-not $iar.AsyncWaitHandle.WaitOne($timeoutMs,$false)) { return $false }
    $client.EndConnect($iar); return $client.Connected
  } catch { return $false }
  finally { try { $client.Close() } catch {} }
}
function Test-RawHttp([string]$hostName,[int]$port,[string]$path='/api/status',[int]$timeoutMs=2500) {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $iar = $client.BeginConnect($hostName,$port,$null,$null)
    if (-not $iar.AsyncWaitHandle.WaitOne($timeoutMs,$false)) { return @{Ok=$false;Detail='TCP timeout'} }
    $client.EndConnect($iar)
    $client.ReceiveTimeout=$timeoutMs; $client.SendTimeout=$timeoutMs
    $stream=$client.GetStream(); $writer=[System.IO.StreamWriter]::new($stream,[Text.Encoding]::ASCII,1024,$true); $writer.NewLine="`r`n"
    $writer.Write("GET $path HTTP/1.1`r`nHost: ${hostName}:$port`r`nConnection: close`r`n`r`n"); $writer.Flush()
    $reader=[System.IO.StreamReader]::new($stream,[Text.Encoding]::UTF8,$true,1024,$true); $response=$reader.ReadToEnd()
    $first=($response -split "`r?`n")[0]
    $ok=$first -match '^HTTP/1\.[01] 2\d\d'
    return @{Ok=$ok;Detail=$first;Response=$response}
  } catch { return @{Ok=$false;Detail=$_.Exception.Message} }
  finally { try { $client.Close() } catch {} }
}
function Wait-Server($proc,[int]$port,[int]$seconds=35) {
  $deadline=(Get-Date).AddSeconds($seconds); $attempt=0; $last=''
  while((Get-Date) -lt $deadline) {
    $attempt++
    try { $proc.Refresh() } catch {}
    if ($proc.HasExited) { return @{Ok=$false;Reason="Processo Node terminou cedo (ExitCode=$($proc.ExitCode))";Attempt=$attempt} }
    $tcp=Test-Tcp '127.0.0.1' $port 800
    if ($tcp) {
      $raw=Test-RawHttp '127.0.0.1' $port '/api/status' 2000
      $last=$raw.Detail
      if ($raw.Ok) { return @{Ok=$true;Reason=$raw.Detail;Attempt=$attempt} }
    } else { $last='porta ainda nao aceita TCP' }
    if ($attempt -eq 1 -or $attempt % 5 -eq 0) { Log 'WAIT' "Tentativa $attempt: $last" DarkGray }
    Start-Sleep -Milliseconds 500
  }
  return @{Ok=$false;Reason="Timeout: $last";Attempt=$attempt}
}
function Ensure-FirewallRule([int]$port) {
  $ruleName = "Shadow Ascension LAN TCP $port"
  $command = "Remove-NetFirewallRule -DisplayName '$ruleName' -ErrorAction SilentlyContinue; New-NetFirewallRule -DisplayName '$ruleName' -Direction Inbound -Action Allow -Protocol TCP -LocalPort $port -RemoteAddress LocalSubnet -Profile Any | Out-Null"
  try {
    Log 'INFO' 'Abrindo permissao do Firewall para a rede local (pode aparecer o UAC)...' Yellow
    $encoded=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($command))
    $p=Start-Process -FilePath 'powershell.exe' -Verb RunAs -Wait -PassThru -ArgumentList "-NoProfile -ExecutionPolicy Bypass -EncodedCommand $encoded"
    if($p.ExitCode -eq 0){ Log 'OK' "Firewall liberado para TCP $port somente na rede local." Green; return $true }
    Log 'WARN' "PowerShell elevado terminou com ExitCode=$($p.ExitCode)." Yellow
  } catch { Log 'WARN' "Falha ao criar regra do Firewall: $($_.Exception.Message)" Yellow }
  return $false
}
function Write-Diagnostics([int]$port,$proc=$null) {
  $lines=New-Object System.Collections.Generic.List[string]
  $lines.Add("SHADOW ASCENSION V$Version - DIAGNOSTICO")
  $lines.Add("Data: $(Get-Date -Format o)")
  $lines.Add("Projeto: $ProjectRoot")
  $lines.Add("Porta: $port")
  $lines.Add("Node: $((Get-Command node -ErrorAction SilentlyContinue).Source)")
  try { $lines.Add("Node version: $(& node --version 2>&1)") } catch {}
  try { $lines.Add("NPM version: $(& npm --version 2>&1)") } catch {}
  if($proc){ try{$proc.Refresh();$lines.Add("Server PID: $($proc.Id) HasExited=$($proc.HasExited) ExitCode=$(if($proc.HasExited){$proc.ExitCode}else{'N/A'})")}catch{} }
  $lines.Add('')
  $lines.Add('=== IPCONFIG ===')
  try { $lines.Add((ipconfig /all | Out-String)) } catch { $lines.Add($_.Exception.Message) }
  $lines.Add('=== NETSTAT PORTA ===')
  try { $lines.Add((cmd /c "netstat -ano | findstr :$port" | Out-String)) } catch { $lines.Add($_.Exception.Message) }
  $lines.Add('=== GET-NETTCPCONNECTION ===')
  try { $lines.Add((Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Format-Table -AutoSize | Out-String)) } catch { $lines.Add($_.Exception.Message) }
  $lines.Add('=== TESTES ===')
  $lines.Add("TCP 127.0.0.1:$port = $(Test-Tcp '127.0.0.1' $port 1500)")
  $raw=Test-RawHttp '127.0.0.1' $port '/api/status' 3000; $lines.Add("HTTP RAW 127.0.0.1 = $($raw.Ok) / $($raw.Detail)")
  foreach($ip in (Get-LanIPv4s)){ $lines.Add("TCP ${ip}:$port = $(Test-Tcp $ip $port 1500)"); $r=Test-RawHttp $ip $port '/api/status' 3000; $lines.Add("HTTP RAW ${ip} = $($r.Ok) / $($r.Detail)") }
  $lines.Add('=== FIREWALL SHADOW ASCENSION ===')
  try { $lines.Add((Get-NetFirewallRule -DisplayName 'Shadow Ascension LAN TCP *' -ErrorAction SilentlyContinue | Format-Table DisplayName,Enabled,Profile,Direction,Action -AutoSize | Out-String)) } catch { $lines.Add($_.Exception.Message) }
  $lines | Set-Content -Path $DiagFile -Encoding UTF8
  Log 'INFO' "Diagnostico salvo em: $DiagFile" Cyan
}

try {
  Set-Location $ProjectRoot
  Log 'START' "Launcher V$Version iniciado em $ProjectRoot" Cyan
  if (-not (Get-Command node -ErrorAction SilentlyContinue) -or -not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'Node.js/NPM nao encontrado. Instale o Node.js LTS primeiro.' }

  Write-Step '[1/6] Dependencias'
  if(-not(Test-Path(Join-Path $ProjectRoot 'node_modules'))){ Log 'INFO' 'Executando npm install...' Cyan; & npm install 2>&1 | Tee-Object -FilePath (Join-Path $LogsDir "npm-install-$Stamp.log") -Append; if($LASTEXITCODE -ne 0){throw "Falha no npm install (codigo $LASTEXITCODE)."} }
  else { Log 'OK' 'node_modules encontrado.' Green }

  Write-Step '[2/6] Build do jogo'
  & npm run build 2>&1 | Tee-Object -FilePath (Join-Path $LogsDir "build-$Stamp.log") -Append
  if($LASTEXITCODE -ne 0){throw "A build Vite falhou (codigo $LASTEXITCODE)."}

  Write-Step '[3/6] Rede e porta'
  $lanIps=Get-LanIPv4s
  if(-not $lanIps -or $lanIps.Count -eq 0){throw 'Nao encontrei IPv4 de rede local (Wi-Fi/Ethernet).'}
  $port=$null; for($p=$BasePort;$p -le $MaxPort;$p++){if(Test-PortFree $p){$port=$p;break}}
  if(-not $port){throw "Nenhuma porta livre encontrada entre $BasePort e $MaxPort."}
  Log 'OK' "Porta escolhida: $port" Green
  Log 'INFO' 'Nao usamos a 8080 porque ela pertence a outro app neste PC.' Yellow
  Log 'OK' "IPv4 principal detectado: $($lanIps[0])" Green
  Log 'INFO' "Todos IPv4 LAN: $($lanIps -join ', ')" Gray

  Write-Step '[4/6] Firewall do Windows'
  $firewallOk=Ensure-FirewallRule $port

  Write-Step '[5/6] Iniciando Shadow Ascension'
  $nodeExe=(Get-Command node).Source; $serverScript=Join-Path $ProjectRoot 'server\server.js'
  $serverStdout=Join-Path $LogsDir "server-stdout-$Stamp.log"; $serverStderr=Join-Path $LogsDir "server-stderr-$Stamp.log"
  $serverProcess=Start-Process -FilePath $nodeExe -ArgumentList @($serverScript,'--host','0.0.0.0','--port',"$port") -WorkingDirectory $ProjectRoot -PassThru -RedirectStandardOutput $serverStdout -RedirectStandardError $serverStderr
  Log 'INFO' "Node PID=$($serverProcess.Id); stdout=$serverStdout; stderr=$serverStderr" Gray
  $health=Wait-Server $serverProcess $port 35
  if(-not $health.Ok){
    Log 'ERROR' "Servidor nao passou no health check: $($health.Reason)" Red
    Write-Diagnostics $port $serverProcess
    if(Test-Path $serverStdout){Write-Host "`n--- ULTIMAS LINHAS DO SERVIDOR ---" -ForegroundColor Yellow;Get-Content $serverStdout -Tail 40}
    if(Test-Path $serverStderr){Write-Host "`n--- ERROS DO SERVIDOR ---" -ForegroundColor Red;Get-Content $serverStderr -Tail 60}
    try{if(-not $serverProcess.HasExited){Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue}}catch{}
    throw "Servidor iniciou, mas nao respondeu corretamente na porta $port."
  }
  Log 'OK' "Servidor respondeu no health check em $($health.Attempt) tentativa(s): $($health.Reason)" Green

  $workingIp=$null
  foreach($ip in $lanIps){$r=Test-RawHttp $ip $port '/api/status' 3500;if($r.Ok){Log 'OK' "Interface LAN respondendo: http://${ip}:$port/api/status" Green;if(-not $workingIp){$workingIp=$ip}}else{Log 'WARN' "Interface LAN falhou: ${ip}:$port -> $($r.Detail)" Yellow}}
  if(-not $workingIp){$workingIp=$lanIps[0];Log 'WARN' 'Nenhum IP LAN respondeu ao teste local. O servidor esta localmente OK, mas o celular pode ser bloqueado por Firewall/roteador.' Yellow}

  $lanUrl="http://${workingIp}:$port";$wsUrl="ws://${workingIp}:$port/ws";$addressFile=Join-Path $ProjectRoot 'ENDERECO_DO_JOGO.txt'
  @"
SHADOW ASCENSION LAN V$Version

ABRA NO PC E NO CELULAR:
$lanUrl

WEBSOCKET (automatico):
$wsUrl

LOGS DESTA EXECUCAO:
$LogFile
$serverStdout
$serverStderr
$DiagFile

IMPORTANTE:
- NAO use localhost:8080. Essa porta pertence a outro aplicativo.
- PC por cabo e celular por Wi-Fi funcionam se estiverem na mesma LAN/sub-rede.
- Evite rede Guest/Convidados e desative AP/Client Isolation se necessario.
"@ | Set-Content -Path $addressFile -Encoding UTF8

  Write-Diagnostics $port $serverProcess
  Write-Step '[6/6] PRONTO'
  Write-Host '================================================================' -ForegroundColor DarkCyan
  Write-Host ' SHADOW ASCENSION - JOGO + MULTIPLAYER LAN' -ForegroundColor White
  Write-Host '================================================================' -ForegroundColor DarkCyan
  Write-Host ' ABRA ESTE MESMO ENDERECO NO PC E NO CELULAR:' -ForegroundColor Yellow
  Write-Host " $lanUrl" -ForegroundColor Green
  Write-Host " Status: $lanUrl/api/status" -ForegroundColor Gray
  Write-Host " Logs:   $LogsDir" -ForegroundColor Gray
  Write-Host '================================================================' -ForegroundColor DarkCyan
  if(-not $firewallOk){Write-Host 'AVISO: a regra automatica de Firewall nao foi confirmada.' -ForegroundColor Yellow}
  try{Start-Process $lanUrl}catch{}
  Wait-Process -Id $serverProcess.Id
  exit 0
}
catch {
  Log 'FATAL' $_.Exception.Message Red
  try { if($port){Write-Diagnostics $port $serverProcess} } catch {}
  Write-Host "`n[ERRO] O launcher terminou. Envie os arquivos da pasta logs para diagnostico." -ForegroundColor Red
  Write-Host "Pasta: $LogsDir" -ForegroundColor Yellow
  exit 3
}
