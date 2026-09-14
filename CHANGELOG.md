# CHANGELOG — Shadow Ascension RPG

## Versão 0.9.12 — Expansão Global de Portais e Masmorras (Gates & Dungeons)

### 🚀 Novas Funcionalidades & Sistemas

1. **Sistema Global de Portais & Masmorras (Inspirado no conceito de Gates & Raids)**:
   - **Ranks de Portais (E a S)**: Classificação completa com cores próprias, multiplicadores de dificuldade, andares e faixas de nível recomendadas.
   - **Gate Manager**: Ciclo de vida dinâmico com surgimento de portais no mundo aberto, verificação de terreno válido (fora de cidades, estradas e corpos d'água).
   - **Portais 3D Físicos**: Estrutura monolítica com vórtice toróide rotativo, horizonte de eventos central, anel de partículas com LOD adaptativo e placa aérea 3D de rank.
   - **Alertas Globais**: Aviso discreto animado na interface quando uma nova masmorra é detectada (`⚠ NOVA MASMORRA DETECTADA`) ou anomalia mundial (`🚨 EVENTO MUNDIAL`).
   - **Marcação e Navegação**: Ícones de portais no Minimapa e Mapa-Múndi com letra e cor do rank; botão **MARCAR DESTINO** com bússola/rastreador de distância em metros no HUD.
   - **Janela de Inspeção e Ready Check**:
     - Detalhes do portal (Rank, Nível, Andares, Modificadores, Recompensas e Inimigos).
     - **Entrada Solo**: Com contagem regressiva imersiva (3... 2... 1...).
     - **Entrada em Equipe**: Validação sincronizada com verificação de prontidão (`✅ Pronto` / `⏳ Aguardando`).
   - **Geração Procedural de Masmorras (`DungeonGenerator`)**:
     - Até 5 andares gerados deterministicamente via seed.
     - Salas interligadas, corredores, salas secundárias, baús de tesouro e salas especiais.
     - 100% de aprovação em testes automatizados com 100 seeds aleatórias.
   - **Chefes de Masmorra em 3 Fases (`DungeonBossAI`)**:
     - Fases de combate dinâmicas (100-70%, 70-35%, 35-0%), círculos de telégrafo de ataque no chão, invocações e modo frenético.
   - **Recompensas Exclusivas e Baú do Guardião (`DungeonRewards`)**:
     - Tabela de drops exclusivos de masmorra (armas, armaduras, anéis e runas de raridade Rara, Épica e Lendária).
     - Tela de conclusão com resumo de combate (tempo, inimigos derrotados, elites, chefe, XP e Ouro).
   - **Eventos Raros**:
     - *Portais Instáveis*: Anomalia com modificadores mais difíceis e recompensas aumentadas.
     - *Ruptura de Portal (Dungeon Break)*: Monstros fugitivos que aparecem no mundo aberto perto de portais expirados.

2. **Aprimoramento Visual e Sonoro de XP & Level Up (`XPFeedbackManager`)**:
   - Agrupamento inteligente de abates sequenciais (janela de 380ms) acumulando múltiplos ganhos em um único texto animado.
   - Notificações flutuantes `+XP` com destaque dourado para grandes quantidades de experiência.
   - Bônus de Equipe explícito em partidas multiplayer.
   - Celebração épica de **LEVEL UP** na tela central com anel de luz radiante e resumo de ganhos.

3. **Correção de Spam de Notificações**:
   - Removidas notificações em excesso de guardas abatendo slimes distantes.
   - Avisos de combate e habilidades especiais limitados apenas a alvos que estejam ativamente engajados com o jogador.

4. **Separação Completa dos NPCs de Cidade**:
   - Prefeitura de Aurora dedicada ao **Lorde Aldrich** (`role: 'townhall'`).
   - Mestre da Guilda (**Mestre Kaelan**, `role: 'guild'`) e Capitã de Missões (**Capitã Lyra**, `role: 'quest'`) separados em tendas e pontos distintos com placas 3D identificadoras.

5. **Correção Geográfica dos Lagos sobre Estradas**:
   - O gerador de terreno agora valida faixas de segurança de estradas e cidades (`!this.isOnRoad(...)`), impedindo que planos de água atravessem caminhos de caravanas e portões das cidadelas.
