# Validação V0.9.6

Verificações feitas nesta entrega:

- `node --check` passou em `engine.js`, `gameplayV093.js`, `mobileOnlineV094.js`, `mobileGameplayV095.js`, `multiplayer.js`, `api/multiplayer.js` e `server/server.js`.
- Loja mantém trilho horizontal arrastável por mouse/toque e abas COMPRAR/VENDER.
- HUD mobile mantém menu recolhível, poderes na barra inferior e botão contextual para interações.
- Inventário mantém filtros por categoria/raridade, pilhas visíveis e durabilidade.
- Machado/picareta continuam obrigatórios para árvore/minério.
- Durabilidade cobre armas, ferramentas, armadura e agora também botas durante deslocamento/esquiva.
- Multiplayer ganhou proteção de fila WebSocket e troca real de itens/ouro nos transportes LAN/WebSocket e Vercel/HTTP.
- Montaria, pesca, câmera terceira pessoa e streaming incremental de chunks permanecem ativos.

Observação: a instalação de dependências via npm no ambiente de validação excedeu o limite de tempo da sessão, então a validação final de build deve ser repetida localmente com `npm install` e `npm run build` caso as dependências ainda não estejam instaladas.
