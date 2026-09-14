# Shadow Ascension Web3D — V0.7.6

## Diagnóstico e logs LAN

- Corrigido o health check do launcher: saiu `Invoke-WebRequest` silencioso e entrou teste TCP + HTTP bruto sem proxy.
- O launcher agora verifica se o processo Node terminou prematuramente e registra o ExitCode.
- Logs por execução em `logs/launcher-AAAAmmdd-HHmmss.log`.
- Saída e erros do Node separados em `server-stdout-*` e `server-stderr-*`.
- Diagnóstico de `ipconfig`, rotas, netstat, PID, porta, firewall, Node e NPM em `diagnostico-*.txt`.
- O servidor gera `server-runtime-AAAA-MM-DD.log`.
- Erros JavaScript do navegador/PC/mobile são enviados para `client-errors-AAAA-MM-DD.log`.
- `/api/status` agora informa host, porta, PID e caminhos dos logs.
- Criado `DIAGNOSTICO_REDE.bat` para diagnóstico manual.
- Criado `GERAR_PACOTE_DE_LOGS.bat` para compactar a pasta `logs` e facilitar o envio dos bugs.
- O launcher abre automaticamente a pasta de logs se falhar.

## Por que a V0.7.5 podia acusar erro falso

A V0.7.5 iniciava o Node corretamente, mas validava a inicialização usando `Invoke-WebRequest` e descartava a exceção. Em algumas configurações de PowerShell/proxy/Windows isso pode falhar mesmo com a porta aberta. A V0.7.6 valida primeiro a conexão TCP e depois envia um `GET /api/status` diretamente pelo socket, sem proxy do Windows.
