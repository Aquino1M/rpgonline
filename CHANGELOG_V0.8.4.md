# Shadow Ascension V0.8.4 — PACK/PACK2 reais + Multiplayer Vercel

## Assets reais mantidos

A integração da V0.8.3 permanece ativa usando os arquivos reais enviados pelo usuário:

- Goblin, Skeleton, Giant, Yeti, Ghost, Ghost Skull, Goleling, Slime, Dragon, King, Big Arm, Wizard e Cactoro.
- Stone Golem, Dwarf hostil e Knight do PACK.
- Kenney Castle Kit em portões, muralhas, torres, escadas, bandeiras e pontes.
- MarketPack nas cidades.
- O personagem jogável continua bloqueado e não usa PACK/PACK2.

## Multiplayer Vercel

- Novo endpoint `api/multiplayer.js`.
- Detecção automática do Vercel quando não existe WebSocket LAN.
- Transporte HTTP compartilhado com Redis/Upstash.
- Sala padrão `asterra`.
- Presença de jogadores, nick, level, HP, rank, posição, rotação, animação e mundo sincronizados.
- Perfil/save persistente no Redis.
- Eventos de combate e habilidades compartilhados.
- Dano de mobs compartilhado.
- Estado de HP/morte/respawn dos mobs persistido para jogadores que entram depois.
- Equipe da guilda e XP compartilhado no backend HTTP.
- Reconexão automática.
- Deduplicação de eventos no polling.

## LAN/VPS

- WebSocket existente preservado.
- `enemy_dead` agora também é transmitido no servidor WebSocket.

## Vercel

- `vercel.json` agora preserva rotas `/api/*` antes do fallback SPA.
- Novo guia `VERCEL_MULTIPLAYER.md`.
