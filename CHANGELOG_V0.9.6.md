# Shadow Ascension V0.9.6 — Mobile Complete + Multiplayer Final

## Mobile / interface
- Mantém o HUD mobile compacto da V0.9.5 com menu recolhível, poderes na barra inferior e botões sem sobreposição.
- Ação contextual por toque para mercador, ferreiro, estábulo, viajante, NPC, portal, pesca e coleta.
- Loja com abas COMPRAR/VENDER e trilhos horizontais arrastáveis com dedo ou mouse.
- Menus e inventário reescalados para retrato e paisagem.

## Inventário / equipamentos
- Inventário por categoria e raridade, com raridades maiores primeiro.
- Drops/peixes/recursos/consumíveis iguais acumulam em pilhas e exibem quantidade.
- Durabilidade em armas, ferramentas, armadura e botas.
- Botas também gastam lentamente ao viajar e ao esquivar; ferreiro repara equipamentos.
- Somente machado corta árvores e somente picareta minera, com bônus de força no recurso correto.

## Combate
- Ataque segurado no mobile continua automático.
- Poderes ofensivos prontos são acionados automaticamente durante ataques básicos quando há alvo e vigor.
- Mobs preservam habilidades especiais e efeitos visuais leves.
- Câmera terceira pessoa centralizada e eixo vertical não invertido.

## Multiplayer
- Pacotes de movimento antigos continuam sendo descartados por sequência.
- WebSocket evita acumular pacotes de posição quando a rede mobile está congestionada.
- Troca entre jogadores agora transfere itens e ouro de verdade tanto no servidor LAN/WebSocket quanto no Vercel/HTTP.
- Montaria, classe, HP, nível e rank continuam sincronizados entre jogadores.
- Reconexão automática, ping/latência e save online permanecem ativos.
