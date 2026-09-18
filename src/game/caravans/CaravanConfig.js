// CaravanConfig.js - Configurations, state machine, cargo tables and guard roles for caravans
export const CARAVAN_STATES = {
  PREPARING: 'PREPARING',
  RECRUITING: 'RECRUITING',
  DEPARTING: 'DEPARTING',
  TRAVELING: 'TRAVELING',
  UNDER_ATTACK: 'UNDER_ATTACK',
  BROKEN_DOWN: 'BROKEN_DOWN',
  ARRIVED: 'ARRIVED',
  UNLOADING: 'UNLOADING',
  RESTOCKING: 'RESTOCKING',
  ROBBED: 'ROBBED',
  RETREATING: 'RETREATING',
  DESTROYED: 'DESTROYED'
}

export const CARAVAN_CATEGORIES = {
  COMMERCIAL: { id: 'commercial', name: 'Comercial', icon: '📦', color: '#38bdf8', weight: 45, guardCount: 3, cartCount: 1 },
  MINING: { id: 'mining', name: 'Mineração', icon: '⛏️', color: '#f59e0b', weight: 22, guardCount: 4, cartCount: 1 },
  FOOD: { id: 'food', name: 'Alimentos', icon: '🌾', color: '#84cc16', weight: 18, guardCount: 3, cartCount: 1 },
  ARMS: { id: 'arms', name: 'Armas & Equipamentos', icon: '⚔️', color: '#ef4444', weight: 8, guardCount: 5, cartCount: 1 },
  NOBLE: { id: 'noble', name: 'Nobre & Luxo', icon: '👑', color: '#a855f7', weight: 5, guardCount: 5, cartCount: 2 },
  ROYAL: { id: 'royal', name: 'Caravana Real', icon: '⚜️', color: '#facc15', weight: 2, guardCount: 7, cartCount: 2 }
}

export const ROUTE_SECURITY = {
  SAFE: { id: 'safe', label: 'Segura', color: '#22c55e', guardBonus: 0, levelBonus: 0, eliteChance: 0.05 },
  DANGEROUS: { id: 'dangerous', label: 'Perigosa', color: '#f59e0b', guardBonus: 1, levelBonus: 5, eliteChance: 0.25 },
  CRITICAL: { id: 'critical', label: 'Crítica', color: '#ef4444', guardBonus: 2, levelBonus: 12, eliteChance: 0.65 }
}

export const GUARD_CLASSES = {
  WARRIOR: {
    id: 'warrior',
    name: 'Guerreiro da Escolta',
    role: 'melee',
    hpMult: 1.1,
    atkMult: 1.2,
    color: 0x3b82f6,
    behavior: 'engage_threat'
  },
  TANK: {
    id: 'tank',
    name: 'Guardião Escudeiro',
    role: 'tank',
    hpMult: 1.8,
    atkMult: 0.85,
    color: 0x64748b,
    behavior: 'protect_cart'
  },
  ARCHER: {
    id: 'archer',
    name: 'Arqueiro Patrulheiro',
    role: 'ranged',
    hpMult: 0.85,
    atkMult: 1.25,
    color: 0x10b981,
    behavior: 'keep_distance'
  },
  MAGE: {
    id: 'mage',
    name: 'Mago Mercenário',
    role: 'magic',
    hpMult: 0.75,
    atkMult: 1.45,
    color: 0x8b5cf6,
    behavior: 'support_ranged'
  }
}

// City specialized cargo commodities
export const CITY_CARGO_SPECIALTIES = {
  'aurora-city': {
    originName: 'Cidadela Aurora',
    goods: [
      { name: 'Sacos de Trigo Dourado', type: 'material', value: 35, qtyRange: [15, 30] },
      { name: 'Pães de Viagem Fermentados', type: 'material', value: 25, qtyRange: [20, 40] },
      { name: 'Poções de Cura de Aurora', type: 'potion', value: 50, qtyRange: [4, 10] },
      { name: 'Couro Bovino Curtido', type: 'material', value: 45, qtyRange: [10, 20] }
    ],
    goldRange: [400, 800]
  },
  'lumen-city': {
    originName: 'Lúmen do Bosque',
    goods: [
      { name: 'Essência Lúmen Refinada', type: 'material', value: 65, qtyRange: [12, 25] },
      { name: 'Madeira Fóssil Nobre', type: 'material', value: 55, qtyRange: [15, 30] },
      { name: 'Frascos de Seiva Luminosa', type: 'potion', value: 60, qtyRange: [5, 12] }
    ],
    goldRange: [500, 1000]
  },
  'safira-city': {
    originName: 'Porto Safira',
    goods: [
      { name: 'Pérolas Azuis do Maré', type: 'material', value: 95, qtyRange: [8, 16] },
      { name: 'Sal Marinho Cristalizado', type: 'material', value: 30, qtyRange: [25, 50] },
      { name: 'Tecidos de Seda Marinha', type: 'material', value: 80, qtyRange: [10, 22] },
      { name: 'Óleo de Baleia Astral', type: 'material', value: 70, qtyRange: [8, 15] }
    ],
    goldRange: [750, 1500]
  },
  'cinerea-city': {
    originName: 'Cidadela Cinérea',
    goods: [
      { name: 'Lingotes de Ferro Negro', type: 'material', value: 75, qtyRange: [16, 32] },
      { name: 'Carvão Mineral Puro', type: 'material', value: 35, qtyRange: [30, 60] },
      { name: 'Lâminas Brutas Forjadas', type: 'material', value: 110, qtyRange: [4, 10] }
    ],
    goldRange: [600, 1300]
  },
  'noctis-city': {
    originName: 'Fortaleza Noctis',
    goods: [
      { name: 'Cristal de Sombra Umbral', type: 'material', value: 140, qtyRange: [6, 14] },
      { name: 'Seda da Noite Eterna', type: 'material', value: 120, qtyRange: [8, 16] },
      { name: 'Elixir de Vigor do Abismo', type: 'potion', value: 90, qtyRange: [6, 12] }
    ],
    goldRange: [900, 2000]
  },
  'rubro-city': {
    originName: 'Bastião Rubro',
    goods: [
      { name: 'Minério de Enxofre Magmático', type: 'material', value: 125, qtyRange: [10, 22] },
      { name: 'Gemas de Fogo Bruto', type: 'material', value: 160, qtyRange: [5, 12] },
      { name: 'Placas de Aço Vulcânico', type: 'material', value: 145, qtyRange: [6, 12] }
    ],
    goldRange: [850, 1800]
  },
  'veyra-city': {
    originName: 'Veyra das Alturas',
    goods: [
      { name: 'Cristais de Xisto Alado', type: 'material', value: 110, qtyRange: [8, 18] },
      { name: 'Penas de Grifo Raras', type: 'material', value: 130, qtyRange: [6, 14] },
      { name: 'Lã Alpina Refinada', type: 'material', value: 65, qtyRange: [15, 30] }
    ],
    goldRange: [700, 1600]
  },
  'celeste-city': {
    originName: 'Santuário Celeste',
    goods: [
      { name: 'Fragmentos de Éter Celeste', type: 'material', value: 220, qtyRange: [4, 10] },
      { name: 'Água Sagrada do Oráculo', type: 'potion', value: 150, qtyRange: [6, 14] },
      { name: 'Manto Estelar Tecido', type: 'material', value: 260, qtyRange: [2, 6] }
    ],
    goldRange: [1200, 3000]
  }
}

export const CARAVAN_SETTINGS = {
  maxActiveCaravans: 5,        // keeps city hubs readable and prevents route stacking
  travelSpeed: 4.8,            // Units per second along the road
  restTimeSeconds: 45,         // Time spent in destination before starting next route
  recruitTimeSeconds: 15,      // Time spent gathering escort
  cartMaxHp: 480,              // Balanced wagon health for engaging combat raid (approx 8-12 player hits)
  breakdownChance: 0.08,       // Chance to experience a temporary mechanical breakdown on road
  monsterAmbushChance: 0.16,   // Chance for wandering monsters to attack caravan on dangerous routes
  playerCrimeInfamy: 50,       // Reputation hit when attacking caravan
  defenseRewardXP: 450,        // Bonus XP given to player for defending caravan from monsters
  defenseRewardGold: 260       // Bonus Gold given to player for defending caravan from monsters
}
