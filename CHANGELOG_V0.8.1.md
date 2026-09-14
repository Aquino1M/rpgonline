# Shadow Ascension Web3D — V0.8.1

## Atributos
1. Pontos deixaram de ser gastos instantaneamente ao tocar em +1.
2. Distribuição passa a ser temporária até confirmar.
3. Botão **Confirmar** aplica todos os pontos pendentes de uma vez.
4. Botão **Limpar** zera a distribuição pendente sem perder pontos.
5. Botão **−** permite corrigir um atributo individual antes de confirmar.
6. Contador mostra pontos ainda disponíveis e pontos aguardando confirmação.
7. Engine valida a soma no momento da confirmação para evitar gastar mais pontos que o jogador possui.

## Personagem humano / PACK2
8. `player.glb` só substitui o fallback se o modelo parecer humano rigado/animado.
9. Props incompatíveis (como árvore/cenário) deixam de poder virar o jogador.
10. Fallback humano recebeu olhos e túnica mais definida para melhorar a silhueta.
11. Adicionado `IMPORTAR_PACK2.bat`.
12. Adicionado scanner `tools/import-pack2.mjs`.
13. O importador classifica GLBs em personagens, mobs e cenário.
14. O importador gera `public/models/pack2/manifest.json`.
15. O importador gera `PACK2_RELATORIO.txt` com o inventário encontrado.
16. FBX/OBJ/BLEND são listados como pendentes de conversão para GLB, em vez de quebrar o navegador.
17. Engine procura automaticamente personagem/montaria/mobs no manifesto PACK2.
18. Até 8 mobs PACK2 podem ser carregados como variantes de criaturas.
19. Até 8 props PACK2 podem participar da decoração procedural por chunks.
20. Clips de mobs são classificados em Idle/Walk/Run/Attack/Special e trocados durante a IA quando disponíveis.

## Mapa
21. Zoom do mapa grande de 100% a 400%.
22. Botões `−` e `+`.
23. Botão de reset para 100%.
24. Roda do mouse controla o zoom.
25. Pinça de dois dedos controla o zoom no celular/tablet.
26. Zoom fica centralizado no jogador.
27. Terreno, fog-of-war, cidades, serviços, bosses, portais e aventureiros usam a mesma transformação de zoom.
28. Elementos fora da viewport são ignorados no desenho para economizar trabalho.
29. Terreno usa recorte do cache em vez de regenerar todo o mapa a cada nível de zoom.
30. Toolbar explica os controles de zoom.
