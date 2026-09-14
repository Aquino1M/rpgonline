# Shadow Ascension V0.9.3

## Gameplay
- Árvores, minério e outros recursos não nascem sobre a água nem na margem imediata.
- Peixes aparecem somente em trechos de água e nadam de forma contínua.
- Pesca com **E** ou **F** ao chegar perto de um peixe.
- Peixes comuns, regionais e raros/dourados podem ser coletados no inventário e vendidos em qualquer mercador.
- Pescar concede uma pequena quantidade de XP; peixe dourado vale mais.
- Mobs terrestres não surgem dentro de lagos.
- Espada fica apontada para frente em repouso e usa golpe de corte/estocada para frente durante o ataque.

## Gráficos e desempenho
- Streaming de chunks incremental: no máximo um chunk de terreno por frame.
- Criação dos mobs é separada da criação do terreno e processada gradualmente para reduzir travadas.
- Geometrias e materiais de terreno, água, árvores, minério e peixes são compartilhados.
- Árvores e minérios usam modelos low-poly estáveis e mais leves.
- Sombras de detalhes pequenos foram reduzidas para diminuir draw calls/custo de sombra.
- Peixes e recursos distantes deixam de ser renderizados.
- Resolução interna adapta-se suavemente quando a taxa de quadros cai.
- Água recebeu cor, brilho e transparência melhores sem aumentar a quantidade de polígonos.
- Renderização padrão: 3 chunks no PC e 2 no mobile, ajustável até 4.
- Modelos importados de mobs que causavam escala/origem incorretas foram removidos do pacote limpo; os mobs procedurais permanecem estáveis.

## Observações
- A venda de peixe usa o sistema normal de mercadores. Peixes da mesma região recebem o bônus regional de venda já existente.
- O botão **F** continua usando a habilidade normal quando não existe peixe próximo.
