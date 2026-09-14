# Shadow Ascension Web 3D — V0.6

## Interface e controles

- HUD desktop aumentado e textos/ícones mais legíveis.
- Menus laterais agora têm ícone, nome e tecla.
- Barra de poderes maior com teclas visíveis.
- Cooldown numérico e máscara visual nas habilidades.
- `Q` alterna entre **Modo Combate** (mouse preso/mira) e **Cursor Livre** (menus).
- Mira em X ampliada, com feedback ao alinhar um inimigo.
- Ataque prioriza um raycast disparado do centro da câmera.
- Poção movida para `R`; habilidades em `1`, `2`, `3`.
- Escala da interface configurável até 200%.

## Mobile

- Joystick virtual.
- Arrastar no cenário move a câmera.
- Botões touch para atacar, bloquear, esquivar e interagir.
- Botões touch para as três habilidades, poção e montaria.
- Inventário, missões, guilda, atributos, mapa e opções no mobile.

## Mundo

- Limites do mapa aumentados em **4×**.
- Densidade procedural de detalhes em **2×**.
- Cidades/reposições de landmarks afastadas em **3×**.
- Colisão com árvores, pedras, casas, poço, barracas e muralhas.
- Cidades continuam zonas seguras para impedir invasão simples dos mobs.
- Mapa/minimapa adaptados à nova escala.

## Combate

- HP, nível e nome sobre a cabeça dos mobs.
- Animação procedural de ataque dos mobs.
- Ataque especial de bosses.
- Animação de ataque/especial do personagem procedural e hooks para clips GLB.
- Três habilidades com custo de vigor e cooldown independente.

## Progressão

- 1 ponto de atributo por nível.
- Força, Vitalidade, Agilidade e Intelecto.
- XP por nível do mob e diferença de nível.
- Overrides de level/XP por entidade e por dungeon.
- Drop de equipamento escalado por nível e raridade.

## Guilda e lojas

- Ranks E até ZZZ+.
- Quadro de missões repetíveis por rank.
- Dificuldade e recompensa escalam com nível/rank.
- Armas/armaduras da forja são sorteadas novamente a cada **10 minutos**.
- Contador regressivo da próxima atualização da loja.

## Dungeon e multiplayer

- Entrar no portal troca para um mundo/arena de dungeon separado do mundo aberto.
- Andares e boss final continuam instanciados por portal.
- Servidor WebSocket Node para LAN.
- Cliente continua single-player se não houver servidor.
- Sincronização inicial de jogadores remotos: presença, posição, rotação, nível e HP.
- `INICIAR_SERVIDOR_LAN.bat` e documentação para host 24h externo.

