# GitHub / Vercel / Multiplayer — V0.7

## Frontend no Vercel

```bash
npm install
npm run build
```

Suba o repositório ao GitHub e importe no Vercel. O frontend funciona normalmente em single-player.

## Multiplayer

WebSocket permanente não deve depender do runtime serverless do Vercel. Use uma destas opções:

- Servidor LAN: `INICIAR_SERVIDOR_LAN.bat`.
- Render/Railway/Fly.io/VPS para internet 24h.

O `render.yaml` cria a build Vite e inicia `server/server.js`.

### Render

O serviço expõe:

- `/` — jogo web compilado.
- `/api/status` — health/status.
- `/api/players` — jogadores online.
- `/ws` — WebSocket.

Em HTTPS use `wss://SEU-HOST/ws`.

## Commit sugerido

```bash
git add .
git commit -m "Shadow Ascension Web3D V0.7 LAN profiles"
git push
```

Não versione `server/data/players.json`; ele contém saves locais dos jogadores.
