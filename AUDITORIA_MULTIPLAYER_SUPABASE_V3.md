# Auditoria Multiplayer — Shadow Ascension / Vercel / Supabase — Hotfix V3

Data da auditoria: 2026-09-14

## Escopo auditado

A auditoria foi feita sobre o pacote `RPG_v0.9.11_mobile_menus_corrigidos.zip` disponível no histórico do projeto, mais o comportamento real informado: dois dispositivos abrindo o mesmo site Vercel não enxergam um ao outro e o HUD mostra `ONLINE 0 (SUPABASE)`.

Arquivos inspecionados:
- `src/game/multiplayer.js`
- `src/game/engine.js`
- `src/App.jsx`
- `api/multiplayer.js`
- `server/server.js`
- `vercel.json`
- documentação de Vercel/LAN

## Resultado principal

O problema não é apenas visual. Há uma divergência de arquitetura e uma causa direta de separação dos usuários.

### CRÍTICO 1 — seis lobbies + lobby padrão aleatório por playerId

O cliente V0.9.11 define:
- `asterra-01`
- `asterra-02`
- `asterra-03`
- `asterra-04`
- `asterra-05`
- `asterra-06`

Quando não há um lobby salvo/selecionado, `defaultLobbyFor(playerId)` usa um hash do ID do dispositivo para escolher um dos seis lobbies.

Consequência: dois dispositivos novos têm IDs diferentes e, na maioria dos casos, são colocados automaticamente em salas diferentes. Mesmo estando no mesmo domínio Vercel, eles não entram no mesmo roster.

**Correção V3:** existe somente `asterra-global`. `setRoom()` ignora salas antigas e migra `shadow-ascension-last-lobby` para a sala global.

### CRÍTICO 2 — o backend Vercel auditado não usa Supabase

No pacote V0.9.11, `api/multiplayer.js` usa:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- fallback `KV_REST_API_URL` / `KV_REST_API_TOKEN`

Ou seja: o backend Vercel auditado é Redis/Upstash por polling HTTP. Não existe Supabase no caminho de rede desse pacote.

Ao mesmo tempo, o teste atual mostra HUD com `SUPABASE`.

Isso indica **drift entre o código/deploy atual e o pacote auditável** ou apenas troca de rótulo no HUD sem substituição total do transporte. Um indicador `SUPABASE` não prova que o roster realmente está vindo do Supabase Realtime.

**Correção V3:** o frontend de produção passa a usar diretamente Supabase Realtime Presence + Broadcast (protocolo WebSocket/Phoenix nativo, sem nova dependência npm). O backend Redis antigo fica apenas como fallback legado.

### CRÍTICO 3 — `/api/multiplayer` depende de Redis configurado

O endpoint antigo retorna 503 se as variáveis Redis não existirem. Se o deploy foi migrado para Supabase mas o engine ainda inicializa `/api/multiplayer`, o jogo pode ficar em um estado contraditório: UI dizendo online/Supabase enquanto o roster antigo continua vazio.

**Correção V3:** em produção, com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`, o cliente não depende de `/api/multiplayer` para presença/movimento.

### ALTO 4 — o mesmo domínio Vercel não garante a mesma sala

A URL do site ser a mesma não garante sala igual quando o cliente escolhe room por dispositivo. O room faz parte da chave/namespace do roster.

**Correção V3:** um único tópico Realtime:
`shadow-ascension:asterra-global`

### ALTO 5 — ausência de prova objetiva de saúde do Supabase

O HUD mostra apenas um status agregado. Isso não diferencia:
- env ausente;
- chave errada;
- Realtime desconectado;
- canal inscrito mas Presence vazio;
- usuário realmente sozinho.

**Correção V3:** `api/multiplayer-health.js` informa:
- se URL está configurada;
- se public key está configurada;
- se REST do Supabase responde;
- modo esperado;
- sala global.

Além disso:
`window.game.multiplayer.getDiagnostics()`
retorna transporte, connected, room, playerId, quantidade de outros presentes, URL mascarada e tópico do canal.

## Arquitetura V3

### Produção / Vercel
- Supabase Realtime
- Presence = roster/online
- Broadcast `state` = posição/rotação/animação
- Broadcast `game` = combate, skills, enemy events, troca e controle básico de party
- 1 lobby global

### LAN
- continua usando servidor WebSocket legado quando o jogo é aberto em IP local

### Fallback
- se Supabase não estiver configurado, o cliente ainda pode usar o transporte HTTP legado.

## Segurança

- `VITE_SUPABASE_ANON_KEY` é chave pública e pode ir ao navegador.
- **NUNCA** usar `SUPABASE_SERVICE_ROLE_KEY` no Vite/client.
- Presence/Broadcast não requer tabela para funcionar.
- Se futuramente salvar perfis no Postgres, criar tabela + RLS separadamente.

## Configuração obrigatória no Vercel

Em Project Settings → Environment Variables, para Production e Preview:

```text
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_ANON_PUBLICA
```

Depois fazer novo deploy. Variáveis `VITE_*` são injetadas no bundle no build; apenas alterá-las sem redeploy não atualiza o frontend.

## Teste de aceitação

### Teste A — saúde
Abrir:
`https://SEU-DOMINIO.vercel.app/api/multiplayer-health`

Esperado:
```json
{
  "ok": true,
  "mode": "supabase-realtime",
  "room": "asterra-global",
  "urlConfigured": true,
  "publicKeyConfigured": true,
  "restReachable": true
}
```

### Teste B — dois dispositivos
1. Abrir o mesmo deploy no Dispositivo A.
2. Abrir no Dispositivo B.
3. Usar contas/nicks diferentes.
4. Ambos devem mostrar `Asterra Global`.
5. A deve ver B e B deve ver A.
6. Contador deve ser `ONLINE 1` em ambos (1 outro jogador).
7. Movimento deve aparecer no outro aparelho.
8. Fechar A; B deve remover A do roster após Presence leave.

### Teste C — console
No console:
```js
window.game.multiplayer.getDiagnostics()
```

Esperado nos dois:
- `mode: "supabase"`
- `connected: true`
- `room: "asterra-global"`
- `supabaseConfigured: true`
- `onlineOthers: 1`

## Status por item

- Um único lobby: **IMPLEMENTADO NO HOTFIX**
- Descoberta cross-device: **IMPLEMENTADO NO HOTFIX**
- Supabase Presence: **IMPLEMENTADO NO HOTFIX**
- Supabase Broadcast de estado: **IMPLEMENTADO NO HOTFIX**
- Reconnect do Realtime: **reconnect nativo com WebSocket/Phoenix heartbeat + resubscribe**
- LAN WebSocket: **PRESERVADO**
- Troca entre jogadores: **broadcast direto preservado**
- Party: **modo peer básico implementado; precisa teste real**
- Save durável no Supabase: **NÃO IMPLEMENTADO neste hotfix**; permanece separado do Realtime
- Teste físico 2 dispositivos no deploy do usuário: **PENDENTE após redeploy**
- Supabase do projeto do usuário realmente configurado: **NÃO É POSSÍVEL confirmar sem acesso ao projeto/variáveis; o endpoint de health foi criado exatamente para isso**

## Observação importante

Não considerar `ONLINE 0 (SUPABASE)` como prova de funcionamento. O PASS real exige:
- canal `SUBSCRIBED`;
- Presence contendo o segundo player;
- avatar remoto criado;
- movimento chegando por Broadcast.

