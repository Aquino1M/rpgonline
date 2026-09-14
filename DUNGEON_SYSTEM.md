# Sistema Global de Portais & Masmorras (Dungeon System)

Documentação técnica do sistema completo de Portais e Masmorras implementado para o RPG Shadow Ascension.

---

## 1. Visão Geral da Arquitetura
O sistema é composto por módulos desacoplados no diretório `src/game/dungeons/`, integrando-se de forma reativa com o loop 3D (`src/game/engine.js`) e com a interface React / Canvas (`src/App.jsx`, `src/ui/Minimap.jsx`, `src/ui/WorldMap.jsx`).

### Módulos Principais
1. **`DungeonConfig.js`**
   - Ranks globais: **E**, **D**, **C**, **B**, **A**, **S**.
   - Configurações de andares (1 a 5 andares máximos), faixas de nível recomendadas, multiplicadores de HP/ATK/DEF, chances de mobs Elites e Minibosses.
   - Temas procedurais: **Caverna**, **Catacumbas**, **Ruínas Antigas**, **Abismo**, **Vazio Arcano**, **Templo Esquecido**.
   - Modificadores aleatórios: Névoa Sombria, Fúria, Fortificados, Caçadores, Tesouro Amaldiçoado.
   - Tabelas de bosses e habilidades.

2. **`GateManager.js`**
   - Ciclo de vida dos Portais: `SPAWNING` → `ACTIVE` → `READY_CHECK` → `IN_PROGRESS` → `CLEARED` → `COLLAPSING` → `CLOSED`.
   - Geração de portais físicos 3D no mundo com colunas monolíticas, vórtice de toróide pulsante, núcleo dimensional escuro, partículas orbitantes com LOD adaptativo e billboard de rank em canvas 2D.
   - Validação geográfica de spawn: nunca gera dentro de cidades seguras, em estradas ou dentro de lagos.
   - Anomalias raras: Portais Instáveis (`ANOMALIA DETECTADA`) e Rupturas de Masmorra (`RUPTURA DE PORTAL - Feras Escapadas`).
   - Gerenciamento de instâncias isoladas (Solo e Equipe) e transição de andares.

3. **`DungeonGenerator.js`**
   - Gerador procedural determinístico baseado em Seed (`prng`).
   - Estrutura de andares: Sala de Entrada (Spawn) → Corredores → Salas de Combate / Tesouro / Especiais → Portal de Saída (ou Arena do Chefe no último andar).
   - Validação automática: garante que o spawn e o portal de saída / arena do chefe estão conectados, sem geometria de passagem bloqueada.
   - 100% de aprovação em testes de seeds automatizados.

4. **`DungeonBossAI.js`**
   - Controla os chefes das masmorras com **3 fases progressivas**:
     - Fase 1 (100% - 70% HP): Ataques normais e golpes em cone.
     - Fase 2 (70% - 35% HP): Velocidade aumentada, círculos de aviso no chão (*telegraphs* vermelhos) e invocação de servos rúnicos.
     - Fase 3 (35% - 0% HP): Estado frenético/berserk, dano crítico aumentado e pulsos de choque abissal.

5. **`DungeonRewards.js`**
   - Cálculo de recompensa com base no tempo de conclusão, número de inimigos e elites derrotados.
   - Drops de equipamentos exclusivos de Masmorra (armas, armaduras pesadas/leves, anéis e runas lendárias).
   - Suporte a itens com probabilidade configurável e Baú do Guardião.

6. **`XPFeedbackManager.js`**
   - Agrupamento sequencial de abates rápidos (janela de 380ms para evitar sobreposição excessiva de textos).
   - Notificações flutuantes `+XP` animadas na HUD.
   - Bônus de Equipe explícito quando compartilhado via multiplayer.
   - Celebração de **LEVEL UP** central com partículas, onda radiante dourada e atualização suave de estatísticas.

---

## 2. Ranks das Masmorras

| Rank | Nível Recomendado | Andares | Cores | Dificuldade |
|:---:|:---:|:---:|:---:|:---:|
| **E** | 1 – 10 | 1 | Cinza / Prata (`#94a3b8`) | Moderada |
| **D** | 10 – 20 | 1 – 2 | Verde Esmeralda (`#22c55e`) | Desafiadora |
| **C** | 20 – 35 | 2 – 3 | Azul Céu (`#0ea5e9`) | Perigosa |
| **B** | 35 – 50 | 3 – 4 | Roxo Místico (`#a855f7`) | Muito Perigosa |
| **A** | 50 – 70 | 4 – 5 | Vermelho Carmesim (`#ef4444`) | Extrema |
| **S** | 70+ | 5 | Dourado Solar (`#eab308`) | Mortal |

---

## 3. Fluxo de Entrada e Ready Check

1. **Aproximação**: Ao se aproximar do portal no mundo aberto (distância < 4.8m), surge o prompt interativo `E — Inspecionar Portal [Rank X]`.
2. **Janela de Inspeção**:
   - Detalhes da masmorra: Rank, Nível, Andares, Modificadores e Recompensas possíveis.
   - Lista de integrantes da equipe com status: `✅ Pronto` ou `⏳ Aguardando`.
3. **Entrada Solo**:
   - O jogador escolhe `⚔ ENTRAR SOLO`.
   - É disparada a contagem regressiva: **3... 2... 1...** antes da transição da instância.
4. **Entrada em Equipe (Multiplayer)**:
   - O líder ou membro clica em `🛡 READY CHECK EQUIPE`.
   - Todos os integrantes recebem a requisição e confirmam individualmente.
   - Ao completarem, todos os jogadores são transportados de forma sincronizada para a mesma instância compartilhada.

---

## 4. Marcação no Mapa e Orientação
- **Minimap e World Map**:
  - Os portais ativos são renderizados com círculo de energia da cor do rank e letra centralizada correspondente.
  - No World Map, a barra lateral lista todos os portais ativos com tempo restante até a expiração.
- **Botão MARCAR DESTINO**:
  - Ao clicar em `🎯 Marcar Destino`, é fixado um rastreador no topo do HUD mostrando a distância em metros até o portal (`📍 Destino: Portal Rank B — 450m`) com botão para desmarcar.

---

## 5. Como Estender o Sistema

### Como Adicionar um Novo Tema
Abra `src/game/dungeons/DungeonConfig.js` e adicione uma nova chave ao objeto `DUNGEON_THEMES`:
```js
meu_novo_tema: {
  name: 'Cidadela Congelada',
  floorColor: 0x1e293b,
  wallColor: 0x334155,
  fogColor: 0x0f172a,
  mobs: ['Lobo Glacial', 'Golem de Gelo', 'Espectro das Neves']
}
```

### Como Adicionar um Novo Chefe
Em `src/game/dungeons/DungeonConfig.js`, adicione à lista `DUNGEON_BOSSES`:
```js
{
  id: 'frost_titan',
  name: 'Titã das Neves Eternas',
  title: 'Guardião dos Picos Gelados',
  theme: 'meu_novo_tema',
  minRank: 'A',
  hpMult: 3.8,
  atkMult: 1.6,
  color: 0x38bdf8
}
```

### Como Adicionar Loot Exclusivo
Em `src/game/dungeons/DungeonRewards.js`, adicione à lista `EXCLUSIVE_DUNGEON_DROPS`:
```js
{
  name: 'Cetro do Vórtice Glacial',
  type: 'weapon',
  subtype: 'spellbook',
  rarity: 'Mítico',
  color: '#f43f5e',
  minRank: 'S',
  atkBonus: 55,
  critBonus: 22,
  desc: 'Canaliza o zero absoluto dos confins do portal.'
}
```
