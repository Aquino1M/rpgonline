# Validação V0.8.4

## Assets

- Manifest bundled PACK/PACK2 presente.
- Player continua fora do manifesto de mobs/cenário.
- Arquivos GLB/FBX reais permanecem em `public/models/bundled`.

## Multiplayer

- `api/multiplayer.js`: `node --check` PASS.
- `src/game/multiplayer.js`: `node --check` PASS.
- `src/game/engine.js`: `node --check` PASS.
- `server/server.js`: `node --check` PASS.
- Teste simulado Redis com dois jogadores: PASS.
- Jogador 2 recebeu jogador 1 pela mesma sala: PASS.
- Estado de posição/level do jogador 1 chegou ao poll do jogador 2: PASS.
- Dano de mob foi persistido e retornou em `enemyStates`: PASS.
- Endpoint de status com Redis simulado: PASS.

## Vercel

O endpoint exige Redis/Upstash real no deploy. Sem as variáveis de ambiente, retorna HTTP 503 com `redis_not_configured` em vez de fingir que existe um servidor compartilhado.

## Build Vite

A tentativa de `npm install --no-audit --no-fund` neste sandbox expirou por timeout de rede; `vite` não ficou disponível localmente. A sintaxe de todos os JS críticos e JSX foi validada separadamente.
