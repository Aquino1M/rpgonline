# Shadow Ascension Web3D — V0.7.3

## HUD, menus, nameplates, câmera e mobile

1. Removido o uso de `transform: scale()`/`zoom` como mecanismo principal de escala do HUD.
2. HUD agora calcula tamanhos reais pela resolução disponível e pela escala escolhida pelo jogador.
3. Card do jogador reserva espaço real no layout e não invade menus vizinhos.
4. Menu lateral recebe largura, altura, ícones e textos responsivos.
5. Quickbar recebe slots responsivos e limite de largura por viewport.
6. Minimap usa largura responsiva própria.
7. Notebook/janela baixa reorganiza o menu lateral em 2 colunas para evitar sobreposição vertical.
8. Janelas de inventário/configuração mantêm tamanho do viewport e aumentam conteúdo internamente.
9. Slider de escala agora aumenta texto e controles dos menus, não apenas o contêiner visual.
10. Fontes de configurações, inventário, loja e ferreiro obedecem à escala de menus.
11. Detecção de viewport separa celular e tablet.
12. Detecção touch é independente da largura da tela.
13. Resize, rotação e `visualViewport` recalculam a UI automaticamente.
14. Layout touch de tablet é separado do layout de celular.
15. Tablet mantém joystick, ações, poderes, menu e minimapa em zonas diferentes.
16. Celular em paisagem usa HUD compacto e controles em zonas sem sobreposição.
17. Celular em retrato empilha HUD e menu e esconde apenas o minimapa pequeno, mantendo o botão Mapa.
18. Overlays touch usam quase toda a viewport com safe areas.
19. Modo combate em touch fica permanentemente ativo.
20. Abrir menus em touch não desativa mais o modo combate.
21. Pointer-lock nunca é solicitado em celular/tablet.
22. Evento `pointerlockchange` não derruba o combate em touch.
23. Botão CORRER adicionado ao mobile como toggle visível.
24. Botão CORRER ganha estado visual ativo (`CORRENDO`).
25. Joystick no limite não ativa corrida sozinho no touch.
26. Câmera de combate realinha o yaw ao personagem ao entrar no modo combate.
27. Pitch de entrada em combate é normalizado para evitar saltos de câmera.
28. Câmera de combate foi recentralizada atrás do personagem, sem offset lateral instável.
29. Transição entre câmera livre e câmera de combate ficou suavizada.
30. Colisão da câmera usa mais amostras entre jogador e posição desejada.
31. Nameplate do jogador foi redesenhado em alta resolução.
32. Nick aparece na primeira linha acima da cabeça.
33. LV e Rank aparecem na segunda linha.
34. Barra de HP vermelha aparece abaixo do LV/Rank.
35. Valor `HP atual / HP máximo` aparece sobre a barra.
36. Nameplate usa `SRGBColorSpace` e material sem tone mapping para manter as cores da interface.
37. Nameplate local foi aproximado da cabeça e reduzido para proporção de RPG.
38. Escape em dispositivo touch fecha o painel em vez de tentar desligar o combate fixo.
39. Texto da configuração LAN não fixa mais a porta 8080 como única opção.
40. Launcher/servidor identificados como V0.7.3.
