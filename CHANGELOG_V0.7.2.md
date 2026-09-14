# Shadow Ascension Web3D — V0.7.3

## Correções de HUD, nameplates e câmera

1. HUD passa a calcular escala efetiva pelo tamanho real da janela.
2. Escala manual continua funcionando, mas é limitada para evitar sobreposição.
3. Menus agora recebem escala própria (`--menu-scale`).
4. Janelas de inventário/configurações usam fontes maiores.
5. Menu lateral deixa de sobrepor o card do jogador em janelas baixas.
6. Em 1600×900/1600×738, menu lateral passa para grade 2×3 quando necessário.
7. Quickbar reposicionada automaticamente em janelas de pouca altura.
8. Minimapa sobe quando necessário para não colidir com a quickbar.
9. Nameplate do jogador reduzido para proporção de RPG.
10. Nick agora é a primeira linha do nameplate.
11. Level e Rank aparecem juntos na segunda linha.
12. HP tem barra dedicada e valor numérico.
13. Canvas do nameplate usa SRGB.
14. Sprite de nameplate usa `toneMapped:false` para preservar as cores da UI.
15. Removida dependência de `roundRect` no nameplate para compatibilidade maior.
16. Nameplate local e remoto ficam mais próximos da cabeça.
17. Ao entrar no modo combate, câmera alinha com a direção atual do personagem.
18. Câmera de combate ganha transição suave.
19. Câmera de combate usa leve deslocamento de ombro.
20. Alvo da câmera é projetado à frente no modo combate.
21. Sensibilidade de mouse ajustada para reduzir giro exagerado.
22. Pitch vertical do combate limitado para evitar ângulos quebrados.
23. A/D viram strafe no modo combate.
24. Personagem permanece virado para a mira durante strafe.
25. Fora do combate, rotação de movimento continua livre.
