// DungeonConfig.js - Complete configuration for the Gate & Dungeon System (Solo Leveling inspired)

export const GATE_RANKS = {
  E: {
    id: 'E',
    label: 'Rank E',
    color: '#38bdf8',
    colorHex: 0x38bdf8,
    borderHex: 0x0284c7,
    glowHex: 0x7dd3fc,
    levelRange: [1, 12],
    floors: [1, 1],
    baseHpMult: 0.9,
    baseAtkMult: 0.85,
    baseDefMult: 0.8,
    eliteChance: 0.08,
    minibossChance: 0.0,
    secretRoomChance: 0.25,
    xpMult: 1.0,
    goldMult: 1.0,
    lifetimeMinutes: 25,
    respawnTimerMs: 120000,
    recommendedParty: '1 - 2 Caçadores'
  },
  D: {
    id: 'D',
    label: 'Rank D',
    color: '#22c55e',
    colorHex: 0x22c55e,
    borderHex: 0x16a34a,
    glowHex: 0x86efac,
    levelRange: [12, 24],
    floors: [1, 2],
    baseHpMult: 1.15,
    baseAtkMult: 1.1,
    baseDefMult: 1.05,
    eliteChance: 0.16,
    minibossChance: 0.2,
    secretRoomChance: 0.35,
    xpMult: 1.35,
    goldMult: 1.3,
    lifetimeMinutes: 28,
    respawnTimerMs: 150000,
    recommendedParty: '1 - 3 Caçadores'
  },
  C: {
    id: 'C',
    label: 'Rank C',
    color: '#3b82f6',
    colorHex: 0x3b82f6,
    borderHex: 0x1d4ed8,
    glowHex: 0x93c5fd,
    levelRange: [24, 40],
    floors: [2, 3],
    baseHpMult: 1.45,
    baseAtkMult: 1.35,
    baseDefMult: 1.3,
    eliteChance: 0.28,
    minibossChance: 0.45,
    secretRoomChance: 0.45,
    xpMult: 1.8,
    goldMult: 1.7,
    lifetimeMinutes: 32,
    respawnTimerMs: 180000,
    recommendedParty: '2 - 4 Caçadores'
  },
  B: {
    id: 'B',
    label: 'Rank B',
    color: '#a855f7',
    colorHex: 0xa855f7,
    borderHex: 0x7e22ce,
    glowHex: 0xd8b4fe,
    levelRange: [40, 60],
    floors: [3, 4],
    baseHpMult: 1.85,
    baseAtkMult: 1.65,
    baseDefMult: 1.55,
    eliteChance: 0.42,
    minibossChance: 0.7,
    secretRoomChance: 0.6,
    xpMult: 2.5,
    goldMult: 2.3,
    lifetimeMinutes: 38,
    respawnTimerMs: 220000,
    recommendedParty: '3 - 4 Caçadores'
  },
  A: {
    id: 'A',
    label: 'Rank A',
    color: '#ef4444',
    colorHex: 0xef4444,
    borderHex: 0xb91c1c,
    glowHex: 0xfca5a5,
    levelRange: [60, 85],
    floors: [4, 5],
    baseHpMult: 2.4,
    baseAtkMult: 2.1,
    baseDefMult: 1.9,
    eliteChance: 0.6,
    minibossChance: 0.9,
    secretRoomChance: 0.75,
    xpMult: 3.5,
    goldMult: 3.2,
    lifetimeMinutes: 45,
    respawnTimerMs: 280000,
    recommendedParty: 'Raid de 4 Caçadores'
  },
  S: {
    id: 'S',
    label: 'Rank S',
    color: '#f59e0b',
    colorHex: 0xf59e0b,
    borderHex: 0xb45309,
    glowHex: 0xfde68a,
    levelRange: [85, 130],
    floors: [5, 5],
    baseHpMult: 3.2,
    baseAtkMult: 2.75,
    baseDefMult: 2.4,
    eliteChance: 0.8,
    minibossChance: 1.0,
    secretRoomChance: 0.9,
    xpMult: 5.5,
    goldMult: 5.0,
    lifetimeMinutes: 60,
    respawnTimerMs: 360000,
    recommendedParty: 'Raid Elite Máxima (4 Caçadores)'
  }
}

export const DUNGEON_THEMES = {
  cavern: {
    id: 'cavern',
    name: 'Caverna Espectral',
    wallColor: 0x2b2e38,
    floorColor: 0x181a21,
    ambientLight: 0x0e1726,
    fogColor: 0x0b111a,
    accentColor: 0x06b6d4,
    mobs: ['Morcego Sombrio', 'Aranha de Cristal', 'Troll das Cavernas', 'Rastejante da Penumbra']
  },
  catacomb: {
    id: 'catacomb',
    name: 'Catacumbas Antigas',
    wallColor: 0x3d352e,
    floorColor: 0x201a15,
    ambientLight: 0x1f1710,
    fogColor: 0x140e08,
    accentColor: 0xa855f7,
    mobs: ['Esqueleto Renegado', 'Espectro Errante', 'Necromante das Sombras', 'Cavaleiro Ossudo']
  },
  ruins: {
    id: 'ruins',
    name: 'Ruínas do Império Caído',
    wallColor: 0x374151,
    floorColor: 0x1f2937,
    ambientLight: 0x111827,
    fogColor: 0x090d14,
    accentColor: 0x3b82f6,
    mobs: ['Sentinela de Pedra', 'Golem Rúnico', 'Guerreiro Autômato', 'Vigília Eterna']
  },
  void: {
    id: 'void',
    name: 'Dimensão Umbral',
    wallColor: 0x24143a,
    floorColor: 0x12081f,
    ambientLight: 0x1e0b36,
    fogColor: 0x0c0417,
    accentColor: 0xc084fc,
    mobs: ['Sombra Devoradora', 'Assassino Umbral', 'Colosso do Vazio', 'Alma em Tormento']
  },
  abyss: {
    id: 'abyss',
    name: 'Abismo Carmesim',
    wallColor: 0x451a1a,
    floorColor: 0x240c0c,
    ambientLight: 0x2b0d0d,
    fogColor: 0x180505,
    accentColor: 0xef4444,
    mobs: ['Cão Magmático', 'Elemental de Chamas', 'Demônio da Forja', 'Vanguarda Infernal']
  },
  temple: {
    id: 'temple',
    name: 'Santuário Proibido',
    wallColor: 0x423828,
    floorColor: 0x261f14,
    ambientLight: 0x241a08,
    fogColor: 0x140f04,
    accentColor: 0xfbbf24,
    mobs: ['Fanático Cego', 'Gárgula Solar', 'Guardião do Selo', 'Inquisidor Dourado']
  }
}

export const DUNGEON_MODIFIERS = [
  { id: 'shadow_mist', name: 'Névoa Sombria', desc: 'Visibilidade da masmorra reduzida pela névoa densa.', icon: '🌫️' },
  { id: 'frenzy', name: 'Fúria dos Monstros', desc: 'Inimigos desferem +18% de dano.', icon: '🔥', atkMult: 1.18 },
  { id: 'fortified', name: 'Couraça Rúnica', desc: 'Monstros e elites possuem +22% de armadura.', icon: '🛡️', defMult: 1.22 },
  { id: 'hunter_senses', name: 'Alerta Predatório', desc: 'Inimigos detectam os caçadores a distâncias maiores.', icon: '👁️' },
  { id: 'cursed_treasure', name: 'Tesouro Amaldiçoado', desc: 'Inimigos mais letais (+20% ATK), porém com +40% de chance de itens raros.', icon: '💎', atkMult: 1.2, lootBonus: 1.4 },
  { id: 'vitality_surge', name: 'Vigor Abissal', desc: 'Monstros possuem +20% de HP máximo.', icon: '❤️', hpMult: 1.2 }
]

export const ELITE_AFFIXES = [
  { id: 'frenetic', name: 'Frenético', title: '[Elite: Frenético]', color: '#f87171', speedMult: 1.35, atkMult: 1.2 },
  { id: 'vampiric', name: 'Vampírico', title: '[Elite: Vampírico]', color: '#dc2626', lifesteal: 0.25 },
  { id: 'armored', name: 'Blindado', title: '[Elite: Blindado]', color: '#fbbf24', defMult: 1.5, knockbackResist: 0.8 },
  { id: 'swift', name: 'Veloz', title: '[Elite: Veloz]', color: '#38bdf8', speedMult: 1.45 },
  { id: 'arcane', name: 'Arcano', title: '[Elite: Arcano]', color: '#a855f7', shootsOrbs: true },
  { id: 'explosive', name: 'Explosivo', title: '[Elite: Explosivo]', color: '#f97316', explodeOnDeath: true }
]

export const DUNGEON_BOSSES = {
  cavern: {
    name: 'Kragor, o Devorador de Cristal',
    title: 'Monarca da Rocha Profunda',
    scale: 2.4,
    color: 0x06b6d4,
    phaseThresholds: [0.70, 0.35],
    skills: ['Queda Sísmica', 'Cuspe Cristalino', 'Fúria Tectônica']
  },
  catacomb: {
    name: 'Malakor, o Arquinecromante',
    title: 'Soberano das Almas Penadas',
    scale: 2.2,
    color: 0xa855f7,
    phaseThresholds: [0.70, 0.35],
    skills: ['Orbe da Agonia', 'Exército de Cinzas', 'Cataclismo Umbral']
  },
  ruins: {
    name: 'Centurião Titânico Alpha',
    title: 'Guardião Ancestral Mecanizado',
    scale: 2.6,
    color: 0x3b82f6,
    phaseThresholds: [0.70, 0.35],
    skills: ['Golpe Demolidor', 'Feixe Arcano Central', 'Sobrecarga Rúnica']
  },
  void: {
    name: 'Ignis-Veyl, o Monarca das Sombras',
    title: 'Entidade do Vazio Primordial',
    scale: 2.7,
    color: 0xc084fc,
    phaseThresholds: [0.70, 0.35],
    skills: ['Lâminas da Noite', 'Devoração Cósmica', 'Dominância do Eclipse']
  },
  abyss: {
    name: 'Ignazur, o Tirano Ígneo',
    title: 'Lorde do Núcleo Fundido',
    scale: 2.5,
    color: 0xef4444,
    phaseThresholds: [0.70, 0.35],
    skills: ['Erupção de Magma', 'Investida Calcinante', 'Chuva de Meteoros']
  },
  temple: {
    name: 'Aurelius, o Julgador Sagrado',
    title: 'Voz da Penitência Dourada',
    scale: 2.3,
    color: 0xfbbf24,
    phaseThresholds: [0.70, 0.35],
    skills: ['Pilar da Salvação', 'Condenação Divina', 'Veredito Implacável']
  }
}
