# Progressão RPG — V0.7

A progressão foi ampliada com conceitos gerais de RPG de nível, sem copiar código de mods externos.

## Nível e XP

- Nível máximo: **300**.
- XP de monstros usa o nível do inimigo, diferença para o nível do jogador, boss e overrides configuráveis.
- Inimigos próximos ao nível do jogador dão melhor eficiência de XP.
- Bosses podem ter nível/XP fixos por override.
- Overrides de dungeon têm prioridade sobre overrides do mundo aberto.

## Atributos

Cada level-up concede **1 ponto de atributo**. Os pontos são gastos no menu `K`:

- **Força:** aumenta ATK.
- **Vitalidade:** aumenta HP e DEF.
- **Agilidade:** aumenta velocidade, crítico e vigor.
- **Intelecto:** aumenta vigor e dano de habilidades.

## Guilda

Ranks disponíveis, do menor para o maior:

`E, D, C, B, A, S, S+, SS, SS+, SSS, SSS+, EX, EX+, Z, Z+, ZZ, ZZ+, ZZZ, ZZZ+`

As missões da guilda são repetíveis. O rank define nível mínimo, dificuldade, XP, ouro e pontos de guilda. Ao atingir os requisitos de nível e pontos, o jogador sobe de rank.

## Overrides

Edite `ENTITY_LEVEL_OVERRIDES` em `src/game/config.js` para forçar nível/XP de mobs ou bosses. O jogo suporta:

- level fixo;
- XP fixo;
- desativar penalidade/bonus de level gap (`disableLevelScaling`);
- configuração separada para mundo aberto e dungeon.

