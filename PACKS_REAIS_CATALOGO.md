# Catálogo dos PACK/PACK2 usados na V0.8.3

## PACK2(2).zip

### Mobs / bosses usados

| Asset | Formato | Uso no jogo | Animações detectadas |
|---|---|---|---|
| Simple Green Slime | GLB | Slime / zonas iniciais | estático |
| Goblin — Quaternius | GLB | mob inicial/intermediário | Attack, Death, Hit, Idle, Jump, Run, Walk |
| Skeleton — Quaternius | GLB | morto-vivo/cavaleiro | Attack, Death, Hit, Idle, Jump, Run, Walk |
| Giant — Quaternius | GLB | gigante/boss | Attack, Death, Hit, Idle, Jump, Run, Walk |
| Yeti — Quaternius | GLB | fera de altitude | Attack, Death, Hit, Idle, Jump, Run, Walk |
| Ghost — Quaternius | GLB | espectro/void | Death, Fast Flying, Flying Idle, Headbutt, Punch |
| Ghost Skull — Quaternius | GLB | morto-vivo/void | Death, Fast Flying, Flying Idle, Headbutt, Punch |
| Goleling Evolved — Quaternius | GLB | golem/alto nível | Death, Flying, Headbutt, Punch |
| Dragon Rigged | GLB | dragão/boss | rig presente; sem clips no GLB enviado |
| King — Quaternius | GLB | boss/cavaleiro superior | 24 clips, incluindo Sword Slash, Run, Roll, Punch e Kick |
| Big Arm — Quaternius | GLB | brutamontes/boss | Death, HitReact, Idle, Jump, Punch, Run, Run Attack, Walk |
| Animated Wizard — Quaternius | GLB | mago corrompido/boss | 15 clips, incluindo Spell1, Spell2 e Staff Attack |
| Cactoro — Quaternius | FBX | criatura de zonas áridas | carregado via FBXLoader |

### Cenário usado

**Castle Kit — Kenney** (`castle_kit.glb`) é carregado uma vez e reutilizado por nós individuais:

- gate
- wall
- wallCorner
- towerSquare
- towerSquareRoof
- towerBase
- towerTop
- flagBannerLong
- flagBannerShort
- stairsStone
- wallDoor
- metalGate
- bridge3

## 4(1).zip / PACK

### Mobs usados

- `stoneRIGGED.fbx` → golem/colosso
- `DwarfRIGGED.fbx` → inimigo humanoide secundário
- `KnightNORUG.fbx` → cavaleiro hostil/alto nível

### Cenário usado

- `MarketPack.fbx` → set-piece de mercado para enriquecer as cidades

## Proteção do personagem

Nenhum arquivo listado acima é associado ao player. `engine.js` carrega PACK/PACK2 apenas em `externalModels.packMobEntries`, `externalSceneryEntries` e `externalCitySceneryEntries`.
