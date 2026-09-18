# Sistemas de Jogo (Game Systems)

Este documento centraliza as regras e arquitetura dos sistemas de jogo de **Shadow Ascension**.

---

## 1. Masmorras e Portais Dimensionais (`src/game/dungeons/`)

### Ranks de Portais
Os portais surgem proceduralmente pelo mundo aberto com base no nível do bioma:
- **Rank E** (Nível 1–10) • `#94a3b8` (Prata)
- **Rank D** (Nível 10–20) • `#22c55e` (Verde Esmeralda)
- **Rank C** (Nível 20–35) • `#0ea5e9` (Azul Céu)
- **Rank B** (Nível 35–50) • `#a855f7` (Roxo Místico)
- **Rank A** (Nível 50–70) • `#ef4444` (Vermelho Carmesim)
- **Rank S** (Nível 70+) • `#eab308` (Dourado Solar)

### Mecânica de Arena do Coliseu
- As masmorras utilizam o sistema de **Arena do Coliseu** com ondas progressivas de monstros gerados nas extremidades da arena.
- O último round invoca o Chefe da Masmorra com telegrafias de área (círculos vermelhos no solo) e múltiplas fases de fúria.
- **Isolamento de Cena**: Ao sair, abandonar ou morrer na masmorra, todas as geometrias do coliseu são limpas da cena principal para garantir que nunca vazem para a Cidadela Aurora.

---

## 2. Progressão e Atributos (`src/game/config.js`)

### Nível do Jogador
- **Nível Máximo**: 300.
- Ganho de XP balanceado pela diferença de nível entre o jogador e a criatura derrotada.
- Cada nível concede **1 Ponto de Atributo** para distribuição no menu `K`:
  - **Força (STR)**: Aumenta o dano de ataque físico (ATK).
  - **Vitalidade (VIT)**: Aumenta a vida máxima (HP) e defesa (DEF).
  - **Agilidade (AGI)**: Aumenta chance de crítico, velocidade de movimento e regeneração de vigor.
  - **Intelecto (INT)**: Aumenta o dano de feitiços/habilidades e o vigor total.

### Guilda de Aventureiros
- **Ranks**: `E, D, C, B, A, S, S+, SS, SS+, SSS, SSS+, EX, EX+, Z, Z+, ZZ, ZZ+, ZZZ, ZZZ+`.
- Missões de caça e contratos de eliminação de chefes concedem XP, ouro e Pontos de Guilda para promoção.
- O painel da guilda (`U`) gerencia promoções e recompensas.

---

## 3. Caravanas Comerciais (`src/game/caravans/`)

### Rotas e Navegação
- As caravanas viajam entre as cidades de Asterra através da malha física de estradas (`game.roadMeshes`), saindo pelos portões murados e seguindo o pavimento de pedra até o destino.
- Cada caravana possui escolta de guardas treinados (Guerreiros, Escudeiros, Arqueiros e Magos).

### Combate e Saque de Caravanas
- **Vida da Carroça**: 480 HP base. Pode ser atingida por ataques corpo a corpo, flechas e habilidades em área.
- **Início do Ataque**: Atacar a carroça ou os guardas inicia o modo de ataque, aumentando o nível de Procurado (1 a 5).
- **Condições de Saque**:
  - Quando a carroça quebra (HP chega a 0) **OU** todos os guardas da escolta são derrotados, a carga fica vulnerável.
  - O jogador pode se aproximar da carroça e pressionar `E` (ou usar o botão contextual) para saquear todo o ouro e mercadorias raras.
- **Defesa de Caravana**: Ajudar a caravana a derrotar monstros que a atacam na estrada concede bônus de XP e ouro legal.
