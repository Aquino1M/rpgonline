# Multiplayer no Vercel — Shadow Ascension V0.8.4

A V0.8.4 tem dois transportes multiplayer:

- **LAN/VPS:** WebSocket (`ws://IP:PORTA/ws`), usando `server/server.js`.
- **Vercel:** HTTP polling compartilhado em `/api/multiplayer`.

## Por que antes cada aparelho parecia ter um jogo diferente?

O frontend Vite no Vercel é estático. O servidor WebSocket de `server/server.js` não fica residente dentro de uma função serverless do Vercel. Assim, dois aparelhos podiam abrir o mesmo site, mas sem um backend compartilhado entre eles.

A V0.8.4 resolve isso com uma API serverless + Redis compartilhado.

## Configuração no Vercel

1. Abra o projeto no Vercel.
2. Adicione um banco Redis/Upstash pelo Marketplace/Storage do projeto.
3. Garanta que estas variáveis estejam disponíveis para Production e Preview:

```text
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

Também são aceitas, por compatibilidade:

```text
KV_REST_API_URL
KV_REST_API_TOKEN
```

4. Faça um novo deploy.
5. Abra no navegador:

```text
https://SEU-SITE.vercel.app/api/multiplayer?action=status
```

Quando estiver correto, a resposta contém:

```json
{"ok":true,"configured":true,"mode":"vercel-http"}
```

## O que é compartilhado

- sala `asterra`;
- nick e ID persistente do dispositivo;
- posição e rotação;
- HP / HP máximo;
- level;
- rank da guilda;
- animação/movimento;
- mundo aberto / andar da dungeon;
- ataques e habilidades;
- dano, morte e respawn compartilhado dos mobs;
- perfil/save no Redis;
- equipe da guilda e XP compartilhado.

## Como testar em 2 aparelhos

1. Faça o deploy com Redis configurado.
2. Abra **a mesma URL Vercel** nos dois aparelhos.
3. Use nicks diferentes.
4. Os dois devem exibir `ONLINE` no HUD.
5. Em Opções, o transporte deve aparecer como `VERCEL/HTTP`.
6. Os personagens devem aparecer um para o outro quando estiverem no mesmo `world`/andar.

## Observação de desempenho

O modo Vercel sincroniza posição a cada ~500 ms e consulta a sala a cada ~700 ms. É menos imediato que WebSocket, mas funciona em hospedagem serverless. Para multiplayer de ação com latência menor, use `server/server.js` em Render/Railway/Fly.io/VPS e deixe o frontend no Vercel.
