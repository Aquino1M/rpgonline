# Shadow Ascension V0.8.3 — integração real PACK + PACK2

## Objetivo

Usar os arquivos reais enviados pelo usuário em `PACK2(2).zip` e `4(1).zip` somente para **mobs/bosses e cenário**, mantendo o personagem jogável sem alterações.

## Mobs incorporados

- Slime Verde — GLB
- Goblin — GLB com Idle/Walk/Run/Attack/Death
- Skeleton — GLB com Idle/Walk/Run/Attack/Death
- Ghost — GLB com Flying Idle/Fast Flying/Headbutt/Punch/Death
- Ghost Skull — GLB com animações de voo/combate
- Goleling Evolved — GLB com animações
- Giant — GLB com Idle/Walk/Run/Attack/Death
- Yeti — GLB com Idle/Walk/Run/Attack/Death
- Dragon Rigged — GLB rigado
- King — GLB com 24 animações
- Big Arm — GLB com Run/Punch/Run Attack/Death
- Animated Wizard — GLB com 15 animações, incluindo Spell1/Spell2/Staff Attack
- Cactoro — FBX
- Stone Golem (`stoneRIGGED.fbx`) — FBX
- Dwarf (`DwarfRIGGED.fbx`) — FBX
- Dark Knight (`KnightNORUG.fbx`) — FBX estático

## Cenário

- Kenney Castle Kit integrado como kit reutilizável.
- O arquivo de castelo é baixado/carregado uma única vez; entradas do manifesto escolhem nós específicos do mesmo GLB.
- Portões, muralhas, cantos, torres, bandeiras, escadas e pontes podem ser usados individualmente.
- `MarketPack.fbx` integrado como set-piece de mercado dentro das cidades.
- Cidades recebem portões/torres/bandeiras adicionais dos packs.
- Partes de castelo/ruínas entram na decoração procedural do mundo conforme a região.

## Engine / performance

- `AssetLibrary` agora suporta GLB/GLTF, FBX e DAE.
- Cache de carregamento e cache de Promises evita parse duplicado quando várias peças vêm do mesmo kit.
- `nodeName` no manifesto permite extrair uma peça específica de um GLB grande.
- Sombras são preparadas automaticamente nos modelos importados.
- Assets são normalizados por altura (`targetHeight`) e centralizados antes da clonagem.
- O player nunca é carregado a partir de PACK/PACK2.

## Animações

A classificação de clips foi corrigida para não usar `HitReact`, `ReceiveHit` ou `RecieveHit` como ataque. Ataques agora priorizam nomes como `Attack`, `Punch`, `Headbutt`, `Slash`, `Bite`, `Claw`, `Kick` e `Staff`.

## Arquivos deixados de fora de propósito

- `Monster Kit 1.0` e `Monster & Medieval Kits`: são cenas compostas com dezenas de malhas estáticas em um único GLB; os mobs standalone animados foram priorizados para qualidade e desempenho.
- `NaturePack_COLLADA.rar`: o conteúdo está encapsulado em RAR; não foi redistribuído no runtime desta build.
- Pacotes de armas/UnityPackage: não entram nesta atualização porque o escopo solicitado foi apenas mobs e cenário.
