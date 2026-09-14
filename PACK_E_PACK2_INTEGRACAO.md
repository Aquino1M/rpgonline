# Integração PACK + PACK2 — V0.8.2

Coloque as pastas `PACK` e/ou `PACK2` na raiz do projeto, no mesmo nível de `package.json`.

Execute `IMPORTAR_PACK_E_PACK2.bat` ou simplesmente inicie o jogo pelo launcher LAN/local: a importação é feita automaticamente quando essas pastas existem.

## Regra obrigatória da V0.8.2

**PACK e PACK2 NÃO alteram o personagem jogável.**

O importador usa apenas:

- mobs / monstros / criaturas / animais / bosses;
- cenário / natureza / pedras / casas / muralhas / ruínas / estradas / props.

Modelos identificados como player, hero, personagem jogável, aventureiro, NPC, mercador, ferreiro ou aldeão são ignorados.

## Formato

O navegador usa `.glb`. FBX, OBJ, BLEND, DAE e outros formatos aparecem em `PACKS_RELATORIO.txt` como arquivos que precisam ser convertidos para GLB.

## Saída

- `public/models/packs/*.glb`
- `public/models/packs/manifest.json`
- `PACKS_RELATORIO.txt`

O manifesto guarda tags do mob e categoria do cenário para o engine escolher um visual coerente com cada zona.
