# Shadow Ascension Web3D — V0.7.4

## Câmera e controles

1. Câmera de terceira pessoa refeita para um comportamento estável estilo Roblox.
2. A câmera mantém altura mínima acima do jogador e não pode mais cair para o chão.
3. Distância mínima da câmera impede que ela entre dentro do personagem.
4. A órbita usa pitch limitado e distância horizontal separada da altura.
5. Colisão da câmera recebeu fallback seguro quando um obstáculo está muito perto.
6. Transição para o modo combate continua suave, sem deslocar a câmera para o chão.
7. No PC, fora do combate, segurar o botão direito do mouse gira a câmera livremente.
8. Soltar o botão direito encerra o free-look imediatamente.
9. Scroll continua controlando o zoom da câmera.
10. Sensibilidade horizontal/vertical recalibrada.

## Combate e interfaces

11. Abrir loja, ferreiro, conversa, missões ou outro painel suspende o modo combate.
12. No PC, pointer-lock é liberado ao abrir uma interface.
13. No touch, combate continua fixo durante gameplay, mas é pausado enquanto um menu/conversa está aberto.
14. Ao fechar a interface no mobile/tablet, o modo combate volta automaticamente.
15. Bloqueio é cancelado quando uma interface é aberta para evitar estado preso.
16. Free-look também é cancelado ao abrir interfaces.

## Mobile/tablet

17. Pixel ratio é limitado automaticamente em mobile/tablet para reduzir carga da GPU.
18. Mobile pequeno usa teto de pixel ratio mais baixo que tablet.
19. Render distance efetiva é limitada automaticamente em touch sem alterar o valor salvo do usuário.
20. Chuva usa menos partículas em mobile/tablet.
21. Minimap usa resolução menor em dispositivos touch.
22. Minimap em touch atualiza em frequência reduzida para economizar CPU/GPU.
23. Backdrop blur pesado é desligado no touch e substituído por painéis opacos leves.
24. Sombras e efeitos de interface do touch foram simplificados.
25. Layout landscape de celular ganhou faixas separadas para joystick, poderes e ações.
26. Em telas baixas o minimapa é ocultado para não cobrir os controles.
27. Botões touch mantêm área mínima de toque de 48px.
28. Tablet com pouca altura recebe HUD e controles mais compactos.
29. Botão CORRER continua em modo toggle e com estado visual CORRENDO.
30. Controles mobile continuam disponíveis com modo combate fixo durante o gameplay.
