# Auditoria V0.7

A auditoria foi feita sobre cliente React/Three.js, `engine.js`, multiplayer, servidor LAN, launcher Windows e responsividade mobile.

## Problemas de maior impacto corrigidos

1. Servidor WebSocket sem servidor HTTP para o jogo.
2. Ausência de perfil persistente no host.
3. Ausência de nick configurável.
4. Nameplate remoto estático.
5. Falta de Level/HP/Rank nos jogadores.
6. Falta de reconexão automática.
7. Clientes fantasmas após queda de rede.
8. Save local sem cópia no servidor.
9. Risco de conflito entre save local e save do host.
10. Itens perdidos silenciosamente com inventário cheio.
11. Compra e desequipar sem validação do limite de slots.
12. URL antiga de multiplayer impedindo conexão LAN automática.
13. Texturas de nameplate remoto sem dispose ao sair.
14. Câmera atravessando colisores do cenário.
15. Mobile sem tratamento adequado de safe-area/notch.
16. Pouco feedback visual ao causar dano.
17. Falta de efeito visual das habilidades.
18. Falta de feedback tátil no touch.
19. Dano em mobs não era compartilhado entre jogadores próximos.
20. Configuração de deploy Node não gerava `dist`.

## Validações executadas

- `node --check` em `server/server.js`.
- `node --check` em `src/game/multiplayer.js`.
- `node --check` em `src/game/engine.js`.
- Smoke test dos sistemas de guilda, loja, atributos, ranks, cidades e XP via módulos ES.

A build Vite completa depende do `npm install`. Neste ambiente de criação a instalação do registro npm expirou, então o launcher Windows foi configurado para instalar e **parar com mensagem clara se a build falhar**, em vez de iniciar um servidor quebrado.
