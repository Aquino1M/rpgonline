# Shadow Ascension Web 3D — V0.7 LAN Profiles

## 30 melhorias novas desta versão

1. **Servidor LAN unificado**: a mesma porta 8080 entrega o site e o multiplayer WebSocket.
2. **URL do jogo no navegador** impressa automaticamente no launcher: `http://IP-DO-PC:8080`.
3. **Detecção automática de IPv4 privado** no Windows para facilitar PC/celular na mesma rede.
4. **Abertura automática do jogo local** em `http://localhost:8080` ao iniciar o servidor.
5. **Auto-conexão multiplayer** quando o jogo é aberto pelo servidor LAN, sem digitar WebSocket manualmente.
6. **Compatibilidade PC + celular simultânea** usando a mesma URL e a mesma sala LAN.
7. **ID persistente por navegador/dispositivo**, independente do nick, para identificar saves corretamente.
8. **Tela inicial de criação de nick** na primeira vez que o jogador entra.
9. **Alteração de nick pelas Opções** com sincronização imediata para os outros jogadores.
10. **Persistência de perfil no servidor** em `server/data/players.json`.
11. **Gravação atômica do banco local** (`.tmp` + rename) para reduzir risco de corromper saves.
12. **Conflito de save resolvido por timestamp**: o perfil mais novo entre navegador e servidor vence.
13. **Autosave também no servidor** junto com o autosave local do jogo.
14. **Save ao esconder a aba/fechar a página**, reduzindo perda de progresso em mobile e PC.
15. **Reconexão automática com backoff** quando Wi-Fi/rede cai por alguns segundos.
16. **Heartbeat WebSocket** para limpar conexões mortas e jogadores fantasmas.
17. **Endpoint `/api/status`** com versão, uptime, jogadores online e quantidade de perfis salvos.
18. **Endpoint `/api/players`** para inspecionar jogadores online na LAN.
19. **Nameplate do jogador local** com Nick, Level, Rank da Guilda e barra de HP.
20. **Nameplate dos outros jogadores** com Nick, Level, Rank da Guilda e HP em tempo real.
21. **Cor visual do avatar remoto por faixa de rank da guilda**, deixando jogadores avançados reconhecíveis.
22. **Culling de nameplates remotos por distância**, evitando poluição visual e custo desnecessário.
23. **Sincronização cooperativa de dano em mobs próximos** entre clientes no mesmo mundo/andar de dungeon.
24. **Números de dano flutuantes** com destaque especial para crítico.
25. **Flash visual ao acertar inimigos**, reforçando o feedback do combate.
26. **Anéis de energia nas três habilidades**, com cores diferentes por poder.
27. **Feedback háptico no celular** em ataque, habilidade e bloqueio quando o aparelho suporta vibração.
28. **Colisão da câmera com árvores/rochas/cidade**, reduzindo câmera atravessando objetos sólidos.
29. **UI mobile com safe-area**, melhorando aparelhos com notch, barra de gestos e landscape.
30. **HUD de identidade/online remodelado**, mostrando nick, rank e estado do multiplayer sem abrir menus.

## Correções de bugs incluídas

- O servidor anterior mostrava só `ws://IP:8080` e não hospedava o jogo; agora serve a build web completa.
- O multiplayer usava nomes temporários e não tinha persistência por jogador.
- Nameplates remotos não atualizavam HP/nível/nome depois do spawn.
- Avatares remotos podiam permanecer na tela após queda de conexão.
- URL antiga de WebSocket salva no navegador podia impedir auto-conexão na LAN; a URL same-origin agora tem prioridade quando aberta em `:8080`.
- Um perfil antigo do servidor podia sobrescrever um save local mais novo; agora há comparação de timestamp.
- Um save de servidor podia substituir a URL LAN ativa por uma URL antiga; a conexão viva é preservada.
- Inventário cheio podia descartar silenciosamente o item mais antigo por causa de `slice(0,40)`; agora a coleta é bloqueada com aviso.
- Comprar item com mochila cheia podia ultrapassar o limite de slots; agora a compra é impedida.
- Desequipar com mochila cheia podia ultrapassar o limite; agora é bloqueado com mensagem.
- Texturas de nameplate remoto eram mantidas após o jogador sair; agora são descartadas.
- Queda temporária de Wi-Fi exigia reconectar manualmente; agora reconecta automaticamente.
- Conexões mortas podiam ficar ocupando sala no servidor; heartbeat limpa clientes sem resposta.
- Porta 8080 ocupada gerava erro pouco claro; agora o servidor explica que a porta está em uso.
- Configuração do Render só instalava dependências; agora também cria a build web e expõe `/api/status` como health check.

> Não existe forma séria de garantir “zero bugs” em um jogo em desenvolvimento. Esta versão corrige os problemas reproduzíveis encontrados na auditoria atual e adiciona validações para reduzir regressões.

### Ajustes finais de perfil

- Removido envio duplicado de evento de renomeação ao trocar o nick.
- Perfil antigo do servidor agora recupera o nick mesmo quando o snapshot salvo ainda não possui `playerName`.
