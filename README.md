# Shadow Ascension

RPG 3D desenvolvido em React, Vite e Three.js. Possui mundo aberto com biomas vivos, sistema de caravanas dinâmicas, masmorras dimensionais, progressão por atributos e guildas, multiplayer cooperativo em tempo real e controles otimizados para PC (mouse/teclado) e dispositivos móveis (touch/gamepad).

## Como Executar

```bash
npm install
npm run dev
npm run build
```

Para hospedar ou testar em rede local (LAN):
```bash
npm run server:lan
```
Para rodar a suíte completa de testes automatizados:
```bash
npm run test:multiplayer
npm run test:systems
npm run test:combat
```

## Controles

- **PC (Teclado/Mouse)**:
  - `W, A, S, D`: Movimentação
  - `Q`: Alternar entre Modo Combate (mira travada) e Cursor Livre (menus/inventário)
  - `Botão Esquerdo do Mouse`: Ataque básico (funciona tanto na mira travada quanto no cursor livre)
  - `Botão Direito do Mouse`: Bloqueio com escudo (ou girar câmera livremente com botão direito)
  - `Espaço`: Pulo
  - `Shift`: Esquiva / Dash
  - `E`: Interagir (NPCs, Portais, Coleta de Recursos, Saquear Caravanas)
  - `1, 2, 3` ou `F`: Habilidades ativas e golpes especiais
  - `R`: Poção de cura
  - `H`: Montaria (Cavalo)
  - `I, K, J, U, M, O`: Menus (Inventário, Atributos, Missões, Guilda, Mapa, Configurações)

- **Mobile / Touch**:
  - Joystick virtual flutuante para movimento
  - Botões dedicados de Ataque, Defesa, Esquiva, Pulo e Correr
  - Botão de ação contextual proeminente (Interagir, Coletar, Saquear)
  - Botões de habilidades rápidas e poção

## Documentação do Projeto

- [Sistemas de Jogo (Masmorras, Progressão e Caravanas)](GAME_SYSTEMS.md)
- [Multiplayer e Autenticação Supabase](MULTIPLAYER.md)
- [Guia de Modelos 3D e Assets](ASSETS.md)
- [Histórico de Alterações](CHANGELOG.md)

## Diagnóstico

- `GET /api/multiplayer-health`: Valida a conectividade do Supabase Realtime e status das variáveis de ambiente.
- Logs de erro do cliente em tempo de execução ficam armazenados no `localStorage` sob a chave `shadow-ascension-client-errors-v1`.
