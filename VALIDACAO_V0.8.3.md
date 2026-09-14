# Validação — Shadow Ascension V0.8.3

## Arquivos reais analisados

Foram lidos os uploads `PACK2(2).zip` e `4(1).zip` fornecidos pelo usuário nesta conversa.

### PACK2(2).zip

- 15 arquivos GLB + 1 ZIP interno.
- O ZIP interno contém `Cactoro.fbx`.
- Foram detectados rigs/animações em Goblin, Skeleton, Giant, Yeti, Ghost, Ghost Skull, Goleling, King, Big Arm e Animated Wizard.
- `Castle Kit by Kenney` contém 159 nós nomeados, permitindo reutilizar peças específicas sem duplicar o GLB.

### 4(1).zip

- FBX de Dwarf, Stone, Knight e MarketPack.
- DAE de MarketPack.
- pacotes de armas e UnityPackages.
- RAR de NaturePack e SK_Mesh.
- O README do pacote identifica os personagens medievais como assets royalty-free para projetos pessoais/comerciais.

## Integração efetiva

- 16 entradas de mob/boss no manifesto bundled.
- 14 entradas de cenário no manifesto bundled.
- GLB/FBX copiados para `public/models/bundled/`.
- Nenhum asset dos packs é associado ao player.
- Castle Kit é referenciado por `nodeName`, então o mesmo GLB é carregado/cacheado uma única vez.
- `MarketPack.fbx` é usado como decoração de cidade.

## Testes

- `manifest.json`: PASS — todos os URLs existem.
- Todos os `nodeName` do Castle Kit: PASS — encontrados no GLB real.
- `assetLoader.js`: `node --check` PASS.
- `engine.js`: `node --check` PASS.
- `server/server.js`: `node --check` PASS.
- `App.jsx`: parser JSX PASS.
- `Minimap.jsx`: parser JSX PASS.
- `WorldMap.jsx`: parser JSX PASS.
- Política de player bloqueado: PASS.

## Build Vite

A tentativa de `npm install` no sandbox excedeu o limite de rede de 120 s, portanto a build Vite completa não pôde ser executada neste ambiente. Os launchers Windows continuam instalando dependências antes da build.
