# Assets e referências — Shadow Ascension V0.4

## Direção do projeto

Shadow Ascension usa nomes, mundo, NPCs, mobs e geometria próprios. A direção é de aventura 3D estilizada/anime, sem copiar personagens, mapas, história ou assets de Zelda, Solo Leveling ou Sword Art Online.

## Free3D

Categoria solicitada: https://free3d.com/pt/3d-models/personagens

O projeto contém integração opcional para `player.glb`, `mount.glb`, `wolf.glb` e `dragon.glb` em `public/models/`.

Durante a revisão, vários modelos gratuitos/animados encontrados no Free3D estavam identificados pelo próprio site como **Personal Use License**. Por isso seus bytes não são redistribuídos neste pacote público de GitHub/Vercel. O jogo usa fallbacks procedurais e fica pronto para receber os GLBs quando houver licença de redistribuição apropriada.

## Repositórios usados como referências de arquitetura

- https://github.com/gdquest-demos/godot-open-rpg — referência conceitual de separação de sistemas de RPG, inventário, progressão e UI.
- https://github.com/michalczemierowski/Unity--mirror-multiplayer-rpg — referência conceitual de sistemas de inventário/equipamento e organização de RPG 3D.
- https://github.com/kimgoetzke/game-muffin — referência conceitual de organização de action RPG.

Não foram copiados assets desses projetos. O código desta build foi implementado em React/Vite/Three.js para uso no navegador/Vercel.
