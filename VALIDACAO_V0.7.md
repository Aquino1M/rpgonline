# Validação V0.7

## Verificações executadas

- `node --check` em todos os módulos JavaScript do jogo e do servidor.
- Auditoria de multiplayer, save, inventário, LAN, reconexão, mobile, colisão da câmera e nameplates.
- Verificação dos dados de progressão: mundo 4×, 8 cidades, 19 ranks de guilda, atributos e estoque procedural.
- Remoção de descarte silencioso de itens quando a mochila está cheia.
- Comparação por timestamp entre save local e perfil salvo no host LAN.
- Compatibilidade da URL LAN: o mesmo `http://IP:8080` entrega o frontend e o WebSocket usa `/ws`.

## Limite desta validação

A instalação completa de dependências via npm excedeu o tempo disponível neste ambiente, então a build Vite final não foi executada aqui. O launcher `INICIAR_SERVIDOR_LAN.bat` executa `npm install` (quando necessário) e `npm run build` antes de abrir o servidor.

Esta auditoria corrige os bugs reproduzíveis encontrados; nenhum projeto em desenvolvimento pode ser garantido como livre de todos os bugs.
