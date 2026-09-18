# Guia de Modelos 3D e Assets

Diretrizes e arquitetura de modelos 3D em **Shadow Ascension**.

---

## 1. Sistema Procedural 3D Nativo

O jogo opera de forma 100% autônoma **sem necessidade de arquivos 3D externos pesados**. Todos os personagens, NPCs, montarias, cenários e monstros possuem geradores procedurais nativos em Three.js:

- **6 Famílias Anatômicas de Monstros** (`src/game/mobVisualOverhaul.js`):
  1. *Quadrúpedes*: Lobos, javalis com presas, cervos com galhadas, raposas com cauda dinâmica.
  2. *Artrópodes*: Aranhas com 8 patas, escorpiões com cauda articulada, besouros couraçados, caranguejos com pinças.
  3. *Gelatinosos*: Slimes translúcidos com núcleo rúnico giratório e física elástica de quique.
  4. *Golens e Treants*: Colossos de blocos de rocha, juntas de lava e treants de casca viva.
  5. *Cavaleiros e Sentinelas*: Armaduras de placas, elmos estilizados, espadas e escudos.
  6. *Voadores*: Aves de rapina, harpias, serpentes marinhas e dragões com asas batendo.

- **Atmosfera e Cenários** (`src/game/world/AmbientAtmosphere.js`):
  - Partículas GPU por bioma (vaga-lumes noturnos, pólen dourado, cinzas vulcânicas, névoa marinha).
  - Fogueiras de descanso e iluminação noturna nas estradas.

---

## 2. Inclusão Opcional de Modelos Externos (GLB / GLTF)

Se você desejar utilizar modelos 3D adicionais com licença de uso adequada, salve os arquivos `.glb` no diretório `public/models/`:

- `public/models/player.glb` — Substitui o modelo procedural do personagem jogável.
- `public/models/mount.glb` — Substitui o cavalo da montaria.
- `public/models/wolf.glb` — Substitui criaturas da família lobo.
- `public/models/dragon.glb` — Substitui chefes da família dragão.

> [!TIP]
> Modelos externos devem estar preferencialmente no formato `.glb` otimizado (com materiais embutidos e malhas indexadas). O carregador detecta e aplica animações de `idle`, `walk`, `run` e `attack` automaticamente caso existam no arquivo.
