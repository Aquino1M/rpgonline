# Logs e diagnóstico

Ao iniciar `INICIAR_SERVIDOR_LAN.bat`, todos os arquivos ficam em `logs/`.

Principais arquivos:

- `launcher-*.log` — cada etapa do launcher e o motivo exato de falha.
- `build-*.log` — saída da build Vite.
- `npm-install-*.log` — instalação das dependências quando necessária.
- `server-stdout-*.log` — saída normal do servidor Node.
- `server-stderr-*.log` — erros escritos no stderr pelo Node.
- `server-runtime-AAAA-MM-DD.log` — eventos internos do servidor, WebSocket, banco de jogadores e exceções.
- `client-errors-AAAA-MM-DD.log` — erros JavaScript enviados pelos navegadores de PC, tablet e celular.
- `diagnostico-*.txt` — IPs, rotas, porta, PID, netstat, firewall, Node/NPM e testes HTTP/TCP.

Se der erro, execute `GERAR_PACOTE_DE_LOGS.bat` e envie o ZIP `ShadowAscension_LOGS_*.zip`.

Também existe `DIAGNOSTICO_REDE.bat` para gerar um diagnóstico mesmo com o servidor fechado.
