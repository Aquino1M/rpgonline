# Shadow Ascension V0.7.5 — Multiplayer LAN + Perfis

## Jogar no PC e no celular ao mesmo tempo

1. No PC host, execute `INICIAR_SERVIDOR_LAN.bat`.
2. O launcher faz a build, detecta o IPv4 correto, escolhe uma porta livre (normalmente 8765), cria a regra do Firewall e inicia o servidor.
3. Ele espera o endpoint `/api/status` responder antes de abrir o navegador.
4. O PC abre o **mesmo endereço LAN** que deve ser usado no celular, por exemplo:

```text
http://192.168.1.5:8765
```

5. O WebSocket usa automaticamente `ws://192.168.1.5:8765/ws`.
6. O endereço atual também fica salvo em `ENDERECO_DO_JOGO.txt`.

**Não use `localhost:8080`**: `localhost` vale só para o próprio aparelho, e a porta 8080 já é de outro aplicativo no PC do projeto.

Se o celular ainda não abrir, confirme que ambos estão na mesma rede, aceite o UAC do Firewall, evite Wi-Fi Guest/Convidados e desligue VPN temporariamente.

## Saves dos jogadores

O navegador recebe um `playerId` persistente e o servidor salva o perfil em:

```text
server/data/players.json
```

O registro guarda nick e progresso do RPG. O nick pode mudar sem criar um save novo, porque a chave do perfil é o ID do dispositivo/navegador.

O jogo salva localmente e no servidor. Quando reconecta, compara o timestamp do perfil local e do servidor para não substituir progresso novo por um save antigo.

## Informações acima dos jogadores

Cada jogador mostra no mundo:

- Nick
- Level
- Rank da Guilda
- HP atual / HP máximo

Jogadores remotos também têm cor visual baseada no rank.

## Endpoints úteis

- `http://IP:PORTA/api/status` — status do servidor, uptime, jogadores e perfis.
- `http://IP:PORTA/api/players` — lista pública dos jogadores atualmente online.
- `ws://IP:PORTA/ws` — socket usado automaticamente pelo jogo.

## Servidor 24 horas

Um servidor dentro da sua casa só fica 24h online enquanto o PC host estiver ligado. Para deixar disponível sempre, publique o projeto/servidor em Render, Railway, Fly.io ou VPS. O `render.yaml` desta versão já executa a build do frontend e o Node server.

O frontend também pode continuar no Vercel, mas para WebSocket permanente use um host Node dedicado.


## Porta e Firewall

A V0.7.5 usa por padrão a faixa 8765–8849 e escolhe a primeira porta livre. O launcher também tenta criar automaticamente a regra do Firewall para `LocalSubnet`, portanto apenas dispositivos da rede local podem entrar nessa porta.


## V0.8 — Equipes da Guilda

A aba **Guilda** permite criar uma equipe ou selecionar outro aventureiro online. O servidor mantém equipes temporárias de até 4 jogadores. Quando um membro recebe XP de combate, o servidor divide o XP entre os integrantes conectados na mesma sala e no mesmo mundo/andar da dungeon. O pool acumulado fica visível no painel. Equipes são de sessão e não ficam gravadas no save.


## V0.9.5 — Mobile + estabilidade de rede

- PC e mobile usam o mesmo protocolo e a mesma sala (`asterra`).
- Em desenvolvimento local no Vite (`:5173`/`:4173`), o cliente tenta automaticamente `ws://IP_DO_PC:8765/ws`.
- WebSocket usa ping/pong, latência e reconexão com backoff e jitter.
- O modo HTTP/Vercel usa polling adaptativo: mais rápido com o app visível e mais econômico em segundo plano.
- Estados carregam número de sequência para descartar pacotes atrasados e incluem classe e estado da montaria.
- Ao voltar para o app depois de ficar em segundo plano, o cliente tenta reconectar automaticamente.
- No mobile, o HUD mostra conexão, jogadores e ping; montarias de jogadores remotos são renderizadas com um modelo procedural leve.
