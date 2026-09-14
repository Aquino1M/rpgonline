
## V0.9.3 — Pesca + desempenho

- Árvores, minérios e mobs terrestres não aparecem mais dentro da água.
- Peixes animados aparecem em lagos e costa. Aproxime-se e use **E** ou **F** para pescar.
- Peixes ficam no inventário e podem ser vendidos em qualquer mercador.
- A espada agora aponta para frente e o golpe avança/corta na direção do alvo.
- Streaming incremental separa terreno e criação de mobs em frames diferentes para reduzir travadas ao explorar.
- Presets **Leve / Equilibrado / Bonito** ficam em Opções.
- O padrão recomendado é Equilibrado: 3 chunks no PC e 2 no mobile.

# Shadow Ascension — Web 3D V0.9.9

RPG 3D original em React + Vite + Three.js, com progressão até nível 300, mundo aberto por zonas, cidades, economia regional, guilda, dungeons, bosses, multiplayer LAN, mobile/tablet e aventureiros IA.

## Mobile V0.9.5 — paridade com PC

- Joystick esquerdo, ataque, bloqueio, esquiva, correr, pular, poção, 3 habilidades e montaria ficam disponíveis por toque.
- Botão contextual grande aparece ao chegar perto de mercador, ferreiro, estábulo, viajante, NPC, portal, recurso ou peixe.
- Menus de inventário, classes/grimório, missões, guilda, troca, atributos, mapa, opções e ajuda estão no HUD mobile.
- Montaria usa pose sentada, câmera afastada, bloqueio de invocação na água e sincronização visual entre jogadores.
- O HUD mostra estado ONLINE, quantidade de jogadores e latência. Reconexão é automática após perda temporária de rede ou retorno ao app.

## V0.8.0 — Mundo vivo

- Spawn inicial seguro na Cidadela Aurora, longe do poço central.
- Pulo no `Espaço` (desktop) e botão `PULAR` no mobile/tablet.
- `Ctrl` corre no PC; botão `CORRER` funciona como toggle no touch.
- Mira over-the-shoulder: personagem fica mais à esquerda e a mira em aproximadamente 56% da largura.
- Mobs também existem na região da Vila/Cidadela Aurora, mas não nascem dentro da zona segura da muralha.
- Respawn de mobs normais entre 18–34 s; bosses ~210 s; aventureiros IA retornam ~65 s depois de morrer.
- 8 economias regionais. Cada cidade vende equipamento dentro da faixa de nível da sua região e paga bônus por drops locais.
- 10 aventureiros IA caçam monstros, ganham XP/nível/rank, patrulham as regiões, revidam agressões e podem derrubar equipamento quando derrotados.
- Equipes da guilda para até 4 jogadores conectados; XP de combate é colocado em pool e dividido entre membros elegíveis no mesmo mundo/instância.
- Aventureiros IA aparecem no minimapa e no mapa-múndi.
- Save V0.8 com migração dos saves V0.7/V0.6/V0.5/V0.4/V0.3.

## Executar no Windows / LAN

Execute `INICIAR_SERVIDOR_LAN.bat`. O launcher compila o cliente, escolhe uma porta livre a partir de 8765, inicia o servidor e mostra o endereço para PC/celular.

## Controles PC

- `WASD`: mover
- `Espaço`: pular
- `Ctrl`: correr
- `Q`: modo combate / cursor
- Mouse esquerdo: ataque no modo combate
- Mouse direito: bloquear no combate; fora do combate, segure e arraste para orbitar a câmera
- `Shift`: esquiva
- `1/2/3`: habilidades
- `E`: interagir
- `R`: poção
- `H`: montaria
- `I/J/G/K/M/O`: inventário, missões, guilda, atributos, mapa, opções

## Multiplayer LAN

O servidor salva perfis em `server/data/players.json`. A aba Guilda permite criar/entrar em equipe com outros jogadores online. Veja `MULTIPLAYER.md`.

## Logs

Em caso de erro, use `GERAR_PACOTE_DE_LOGS.bat` e envie o ZIP gerado. Veja `LOGS_E_DIAGNOSTICO.md`.

## GitHub

O projeto está preparado para `https://github.com/Aquino1M/rpgonline.git`. Use `PUBLICAR_GITHUB_RPG.bat` para publicar/atualizar a `main`. O script não usa `--force` e não sobrescreve histórico remoto à força.


## V0.9.5 — Mobile + Multiplayer
- Paridade mobile: inventário, grimório, missões, guilda, atributos, troca, mapa, opções e ajuda acessíveis por toque.
- Botão contextual grande ao aproximar de mercadores, ferreiro, estábulo, viajante, portais, recursos e peixes.
- Montaria procedural corrigida, pose sentada, câmera mais confortável e sincronização da montaria no multiplayer.
- Multiplayer LAN automático no desenvolvimento: Vite em `:5173` tenta `ws://IP:8765/ws`.
- Multiplayer HTTP/Vercel com polling adaptativo, reconexão, latência/qualidade no HUD e proteção contra estados fora de ordem.
- PC e celular compartilham a mesma sala `asterra` quando apontam para o mesmo servidor.


## V0.9.9
O último lobby multiplayer fica persistido no perfil do servidor e no dispositivo. A loja e o inventário usam controles touch confiáveis e a câmera vertical segue o padrão de terceira pessoa tipo Roblox.

### Publicação rápida no GitHub
No Windows, execute `PUBLICAR_RPGONLINE.bat`. O script aponta o projeto para `https://github.com/Aquino1M/rpgonline`, cria/atualiza a branch `main` e envia a V0.9.9. É necessário estar autenticado no Git Credential Manager.


## V0.9.11 — Mobile menus compactos

Todos os modais de celular/tablet foram compactados e ganharam scroll interno por toque. Em aparelhos landscape como Galaxy A55/S20 FE, as janelas deixam margem ao redor do jogo e os layouts de Atributos, Troca, Ferreiro, Missões, Configurações, Inventário, Guilda, Mercado, Viagens, Mapa e Estábulo foram reorganizados para não bloquear os controles. Mantém as correções V0.9.10 de mercado no PC e câmera configurável.
