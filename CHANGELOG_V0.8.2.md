# Shadow Ascension Web3D — V0.8.2

## PACK + PACK2 focados em mobs e cenário

- O personagem jogável foi **congelado**: PACK/PACK2 nunca substituem o player, roupa, rig, cabeça ou animações do usuário.
- Novo importador `IMPORTAR_PACK_E_PACK2.bat` lê as duas pastas ao mesmo tempo.
- Arquivos GLB de personagens jogáveis/NPCs são ignorados de propósito.
- Modelos reconhecidos como monstros, criaturas, animais, bosses, mortos-vivos etc. entram no catálogo de mobs.
- Elementos de natureza, rochas, casas, muralhas, ruínas, estradas, props e elementos costeiros entram no catálogo de cenário.
- O importador gera `public/models/packs/manifest.json` e `PACKS_RELATORIO.txt`.
- Mobs são escolhidos por tags e por região; lobo procura lobo, dragão procura dragão, mobs costeiros favorecem modelos marítimos etc.
- Bosses favorecem modelos classificados como boss/giant/colossus/king/lord.
- Dungeons também podem usar os mobs importados.
- Cenário externo é escolhido por bioma: floresta favorece natureza, Ember favorece rocha/ruína, Costa favorece costa/natureza/rocha, Umbral favorece ruína/fortificação etc.
- Os props importados recebem collider aproximado calculado pela bounding box do modelo.
- Quando o carregamento dos modelos termina, os chunks já visíveis são recriados para que o jogador veja PACK/PACK2 sem precisar caminhar para outra região.
- O launcher LAN e `JOGAR_LOCAL.bat` importam PACK/PACK2 automaticamente antes de iniciar/buildar quando as pastas existem.
- Compatibilidade mantida com o antigo `IMPORTAR_PACK2.bat` e com o manifesto legado `public/models/pack2/manifest.json`.
