# Shadow Ascension Web3D — V0.8.0

## Mundo e movimento
1. Spawn inicial movido para ponto seguro na Cidadela Aurora.
2. Saves antigos que colocavam o jogador sobre o poço são corrigidos automaticamente.
3. Pulo real com gravidade e estado grounded.
4. Pulo sincronizado visualmente no multiplayer.
5. Corrida desktop movida para Ctrl para liberar Espaço para pular.
6. Botão PULAR adicionado a mobile/tablet.
7. Corrida mobile continua como toggle independente.
8. Mira deslocada para 56% da tela.
9. Raycast do combate usa a mesma posição lateral da mira.
10. Câmera usa composição over-the-shoulder no combate.

## Mobs e respawn
11. Mobs passaram a nascer também na região Aurora.
12. Mobs continuam proibidos de nascer dentro das muralhas.
13. Mobs normais renascem entre 18 e 34 segundos.
14. Bosses usam respawn separado de aproximadamente 210 segundos.
15. Locks de respawn evitam duplicação ao descarregar/recarregar chunks.
16. Mortes sincronizadas por multiplayer também alimentam respawn local.
17. Boss da Aurora passou a poder aparecer no mapa-múndi quando descoberto.

## Economia regional
18. Oito economias regionais, uma por cidade.
19. Cada cidade tem material/drop característico.
20. Estoque da loja respeita o nível mínimo e máximo da região.
21. Jogadores de nível alto não forçam lojas iniciantes a vender gear de nível alto.
22. Ferreiros usam estoque temático da região.
23. Drops carregam zoneId para identificar origem.
24. Drops vendidos na cidade correspondente recebem bônus regional.
25. Multiplicadores de compra/venda variam por cidade.
26. Loja mostra descrição e especialidade da economia local.
27. Mapa de cidades exibe o material regional principal.

## Aventureiros IA
28. Dez aventureiros IA distribuídos entre as oito cidades.
29. Bots possuem nome, nível, HP, rank e equipamentos.
30. Bots patrulham o entorno da cidade natal.
31. Bots procuram mobs próximos e entram em combate.
32. Bots recebem XP e sobem de nível ao derrotar mobs.
33. Rank da guilda dos bots sobe de acordo com a progressão.
34. Bots ganham ouro ao caçar.
35. Se o jogador atacar um bot, ele se torna hostil e revida.
36. Bots podem ser atacados pela mesma mira/combate dos mobs.
37. Ao morrer, bots têm chance de soltar um equipamento que possuíam.
38. Aventureiros IA renascem após aproximadamente 65 segundos.
39. Mobs também podem atacar e derrotar aventureiros IA.
40. IA aparece no minimapa e no mapa-múndi.

## Equipe da guilda
41. Criação de equipe pela aba Guilda.
42. Entrada em equipe de outro jogador online.
43. Limite de quatro integrantes.
44. Líder da equipe é mostrado na interface.
45. Pool total de XP é mostrado na interface.
46. XP de combate é enviado ao servidor da equipe.
47. XP é dividido entre membros online elegíveis no mesmo mundo/instância.
48. Troca de líder automática se o líder sair.
49. Equipe é removida quando o último membro sai.
50. Estado de equipe não é persistido indevidamente no save.

## Correções e validação
51. Corrigido estoque Aurora gerando item Nv.11 em região Nv.1–10.
52. Corrigido preço exibido ao vender para refletir multiplicadores da economia.
53. Nameplate/target de aventureiro IA atualiza HP após ser atacado.
54. Inventário recebe zoneId em drops de equipamento.
55. Save atual passa a ser V0.8 e migra versões anteriores.
