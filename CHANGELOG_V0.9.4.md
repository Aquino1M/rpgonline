# Shadow Ascension V0.9.4

## Mobile
- Todos os menus do PC disponíveis por toque.
- Botão Ajuda no menu mobile.
- Ação contextual grande para loja, NPC, forja, estábulo, viajante, portal, coleta e pesca.
- Botão de interação muda de ícone/texto conforme o alvo.
- Botão de montaria mostra MONTAR/DESMONTAR e usa feedback háptico.
- Layout de celular/tablet reforçado para safe-area e telas pequenas.

## Montaria
- Modelo procedural estável (sem dependência de FBX externo).
- Sela, manta, crina, rabo e rédeas novos.
- Pose do jogador sentada e altura corrigida.
- Câmera recua automaticamente ao montar.
- Bloqueio de invocação dentro da água.
- Estado da montaria sincronizado e mostrado nos jogadores remotos.

## Multiplayer
- Atualização HTTP mais rápida em primeiro plano e econômica em segundo plano.
- Reconexão com backoff + jitter.
- Reconexão ao voltar para o app/aba.
- Medição de latência e indicador de qualidade.
- Sequência (`seq`) para ignorar pacotes antigos/fora de ordem.
- Ping/Pong em LAN WebSocket e Vercel HTTP.
- Vite local em `5173/4173` tenta automaticamente o servidor LAN em `8765`.
- Servidor LAN atualizado para V0.9.4.

## Compatibilidade
- Mantidas as otimizações de chunks, pesca e gráficos da V0.9.3.
- Mantido save local e save no servidor configurado.
