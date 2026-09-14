# Auditoria Mobile + Tablet + Masmorras V2 — Shadow Ascension

Data: 2026-09-14
Projeto alvo: `Aquino1M/rpgonline`

## Escopo auditado

- HUD mobile/tablet
- classificação phone/tablet/desktop
- escala global da interface
- minimapa
- menu recolhível
- joystick
- ataque, defesa, esquiva, interagir, correr e pular
- skills, poção e montaria
- overlays/janelas
- inventário e equipamento
- loja/mercador
- ferreiro
- HUD da masmorra
- spawn/visibilidade/aggro/ataque dos mobs
- progressão de quantidade por round
- limites da arena e interferência do mundo aberto

## Evidências visuais recebidas

1. HUD da masmorra no canto superior direito sobreposto ao minimapa.
2. Coliseu carregado no desktop, mas sem mobs visíveis apesar de o HUD contar inimigos restantes.
3. Tablet físico 1200x1600 da foto: controles pequenos/brancos, sem o mesmo skin do celular.
4. Emulação iPad Pro 13 (1376x1032): jogo classificado como desktop e exibindo sidebar + quickbar de PC.
5. Galaxy A55 800x360: referência correta desejada — joystick à esquerda, ações circulares à direita, skills inferiores e HUD compacto.

## Falhas-raiz encontradas

### 1. iPad/tablet podia virar “desktop”

A heurística antiga dependia demais de UA, largura e `pointer:fine`. Em iPad/emulação grande ela podia concluir `isDesktop=true`, por isso o tablet mostrava os controles de PC e não o layout do A55.

**Correção V2:** classificação por lado curto + `maxTouchPoints` + `pointer:coarse` + `any-pointer:coarse` + touch event. A55 800x360 continua phone; iPad 1376x1032 e tablet 1200x2000 entram em tablet/touch.

### 2. “Equipar” e outros botões podiam perder o click em painel rolável

Os tabs já usavam `pointerup`, mas o botão `Equipar` dependia só de `onClick`. Em alguns Android/iPad/WebView, um tap dentro de `overflow` pode terminar sem o click sintético esperado.

**Correção V2:** bridge de touch apenas para botões de janela/menu. Ele espera o click nativo e só dispara `button.click()` quando o click realmente não chegou. Não cria um segundo inventário nem um segundo sistema de equipamento: continua chamando o mesmo `equipItem(id)` existente.

### 3. Escala da UI não chegava ao conjunto inteiro

O `uiScale` alimentava principalmente variáveis do HUD/menu, enquanto joystick, botões, minimapa e várias janelas tinham pixels fixos em regras CSS posteriores.

**Correção V2:** `syncUiScale()` gera variáveis `--t-*` para HUD, minimapa, joystick, knob, ações, skills, menu, hit target, tipografia e janelas. A mesma escala passa a ser aplicada ao ecossistema touch inteiro, com adaptação para caber na tela.

### 4. Mobs modernos da masmorra eram filhos de um root invisível

O sistema novo (`GateManager`) monta o coliseu diretamente em `scene`, mas o `makeEnemy()` legado ainda parenta inimigos de dungeon em `dungeonArena`. Esse root legado permanecia `visible=false`.

Resultado observado: o HUD dizia “Inimigos restantes: 3/4”, mas a arena estava visualmente vazia.

**Correção V2:** durante a instância moderna, o root dinâmico fica visível e apenas a decoração da dungeon antiga permanece escondida. Mobs/effects modernos são explicitamente visíveis.

### 5. Spawn nas bordas ficava fora do raio de aggro

A IA legada começa perseguição somente em aproximadamente `<16u`. O novo coliseu coloca os mobs a aproximadamente 20–32u do centro. Logo eles podiam nascer corretamente e nunca iniciar a aproximação.

**Correção V2:** pré-aggro de arena leva cada mob da borda em direção ao jogador até entrar no raio da IA original; depois a própria IA existente assume.

### 6. Arena centrada em 0,0 colidia semanticamente com Aurora

A arena moderna também usa coordenadas próximas de 0,0. Funções do mundo aberto como `cityAt`, `canOccupy` e `isInsideCitySafeZone` podiam interpretar a arena como a região segura da cidade. Isso podia bloquear deslocamento do mob e, principalmente, impedir dano ao jogador.

**Correção V2:** durante a instância moderna de dungeon:

- safe-zone de cidade não é aplicada;
- `cityAt` não interfere;
- `canOccupy` usa a elipse do coliseu;
- jogador e inimigos ficam contidos nos limites da arena.

### 7. Quantidade por round

A lógica existente já usa `4 + round * 2`, mas a V2 reforça a regra e adiciona bônus leve por rank, com teto de 22 inimigos simultâneos para não destruir desempenho mobile.

Exemplo base: R1 6, R2 8, R3 10, R4 12… antes de bônus de rank. O boss continua em round final.

### 8. HUD da masmorra disputava o canto do minimapa

**Correção V2:** `dungeon-card` fica no centro da parte superior da tela em desktop/landscape; em portrait touch desce para abaixo da faixa superior para evitar HUD/minimapa. O target é empurrado para baixo.

## Rework touch aplicado

O mesmo desenho é usado por phone e tablet:

- joystick circular à esquerda;
- bloco 3×2 de ações à direita;
- ATTACK com skin vermelho;
- DEFESA, ESQUIVA, USAR, CORRER e PULAR com skins escuras;
- skills/poção/montaria no centro inferior;
- menu hambúrguer recolhível próximo ao minimapa;
- minimapa no canto superior direito;
- HUD do personagem no canto superior esquerdo;
- sem sidebar/quickbar desktop em dispositivo touch.

Nenhum botão mobile/tablet depende do estilo branco padrão do navegador.

## Inventário, loja e ferreiro

- hit target mínimo aumentado;
- botões com `touch-action: manipulation`;
- conteúdo com scroll interno;
- inventário mantém o mesmo state/equip actions do desktop;
- filtros/tabs continuam no mesmo componente funcional;
- grids se adaptam entre landscape/portrait/tablet;
- loja mantém COMPRAR/VENDER e categorias com controles tocáveis;
- ferreiro mantém melhorar/reparar e usa layout responsivo.

## Validação executada neste pacote

- `node --check src/game/mobileTabletDungeonV2.js`: PASS
- `python -m py_compile APLICAR_HOTFIX.py`: PASS
- balanço de chaves do CSS: PASS
- patcher aplicado em cópia V0.9.11: PASS para `main.jsx` e `getViewportState()`
- imagens fornecidas foram comparadas com os breakpoints alvo

## O que ainda precisa de teste físico depois de aplicar

Não marcar como PASS físico até abrir a versão corrigida:

- Galaxy A55 800x360: andar + câmera + ataque simultaneamente
- iPad Pro 13 / 1376x1032: confirmar que NÃO aparece layout desktop
- tablet 1200x2000 portrait: atacar/pular/esquivar e abrir menu
- Equipar/Desequipar no inventário por toque
- Comprar/Vender no mercador
- Melhorar/Reparar no ferreiro
- slider de escala: confirmar que HUD + minimapa + joystick + ações + menus + janelas crescem juntos
- dungeon: mobs visíveis, caminham da borda, causam dano, quantidade cresce a cada round
- boss final e saída da dungeon

## Arquivos do hotfix

- `src/game/mobileTabletDungeonV2.js`
- `src/mobileTabletV2.css`
- alteração automática de `src/main.jsx`
- alteração automática da classificação em `src/App.jsx`

Use `APLICAR_HOTFIX.bat` ou `python APLICAR_HOTFIX.py <pasta-do-rpgonline>`.
