// Sistema de Economia Regional V0.8.0 — 8 Cidades com Drops, Materiais e Especialidades
import { ZONES, RARITIES } from './config.js'
import { makeItem } from './rpgSystems.js'

export const REGIONAL_ECONOMIES = {
  aurora: {
    city: 'Vila Aurora',
    zoneId: 'aurora',
    minLevel: 1,
    maxLevel: 10,
    primaryMaterial: 'Essência Lúmen',
    specialty: 'Consumíveis & Equipamentos Básicos',
    buyMultiplier: 1.0,
    sellMultiplier: 0.50,
    localBonus: 1.30,
    icon: '🌾',
    color: '#b6df7e'
  },
  meadow: {
    city: 'Posto da Pradaria',
    zoneId: 'meadow',
    minLevel: 8,
    maxLevel: 30,
    primaryMaterial: 'Couro de Vento',
    specialty: 'Botas Leves & Arcos Ágeis',
    buyMultiplier: 1.05,
    sellMultiplier: 0.52,
    localBonus: 1.30,
    icon: '🍃',
    color: '#d8f58e'
  },
  forest: {
    city: 'Refúgio dos Druidas',
    zoneId: 'forest',
    minLevel: 25,
    maxLevel: 60,
    primaryMaterial: 'Madeira Fóssil',
    specialty: 'Cetros Arcanos & Talismãs da Floresta',
    buyMultiplier: 1.10,
    sellMultiplier: 0.55,
    localBonus: 1.30,
    icon: '🌲',
    color: '#80a58a'
  },
  coast: {
    city: 'Porto Safira',
    zoneId: 'coast',
    minLevel: 55,
    maxLevel: 95,
    primaryMaterial: 'Pérola Safira',
    specialty: 'Talismãs Oceânicos & Armaduras de Maré',
    buyMultiplier: 1.15,
    sellMultiplier: 0.58,
    localBonus: 1.30,
    icon: '🌊',
    color: '#4bc1df'
  },
  highlands: {
    city: 'Cidadela das Nuvens',
    zoneId: 'highlands',
    minLevel: 90,
    maxLevel: 145,
    primaryMaterial: 'Cristal de Xisto',
    specialty: 'Escudos Reforçados & Couraças Pesadas',
    buyMultiplier: 1.20,
    sellMultiplier: 0.60,
    localBonus: 1.30,
    icon: '🏔️',
    color: '#c7d2c6'
  },
  ember: {
    city: 'Fortaleza de Brasas',
    zoneId: 'ember',
    minLevel: 140,
    maxLevel: 205,
    primaryMaterial: 'Cinza Vulcânica',
    specialty: 'Armas Magmáticas & Forja Flamejante',
    buyMultiplier: 1.28,
    sellMultiplier: 0.62,
    localBonus: 1.30,
    icon: '🌋',
    color: '#ef8650'
  },
  void: {
    city: 'Santuário Umbral',
    zoneId: 'void',
    minLevel: 200,
    maxLevel: 265,
    primaryMaterial: 'Fragmento do Vazio',
    specialty: 'Grimórios do Despertar & Itens Épicos',
    buyMultiplier: 1.35,
    sellMultiplier: 0.65,
    localBonus: 1.30,
    icon: '🌌',
    color: '#9c86d6'
  },
  crown: {
    city: 'Altar Celeste',
    zoneId: 'crown',
    minLevel: 260,
    maxLevel: 300,
    primaryMaterial: 'Pluma Astral',
    specialty: 'Equipamentos Lendários & Éter Puro',
    buyMultiplier: 1.50,
    sellMultiplier: 0.70,
    localBonus: 1.30,
    icon: '👑',
    color: '#e8f2ff'
  }
}

// Gera o estoque de loja respeitando estritamente o teto e piso da região
export function getRegionalMerchantStock(zoneId = 'aurora', playerLevel = 1) {
  const eco = REGIONAL_ECONOMIES[zoneId] || REGIONAL_ECONOMIES.aurora
  // Clamp estrito do nível: jogador Nv.300 não força itens fora do teto da cidade
  const itemLevel = Math.max(eco.minLevel, Math.min(eco.maxLevel, playerLevel))

  const stock = [
    {
      id: `shop-grimoire-${zoneId}`,
      name: 'Grimório do Despertar',
      type: 'consumable',
      subtype: 'grimoire',
      rarity: 'Rara',
      color: '#a855f7',
      level: 1,
      power: 0,
      qty: 1,
      zoneId: eco.zoneId,
      value: Math.round(220 * eco.buyMultiplier)
    },
    {
      id: `shop-potion-${zoneId}`,
      name: `Poção de ${eco.city.split(' ')[0]}`,
      type: 'consumable',
      subtype: 'potion',
      rarity: 'Comum',
      color: '#cbd5e1',
      level: itemLevel,
      power: 45 + itemLevel * 3,
      qty: 1,
      zoneId: eco.zoneId,
      value: Math.round(45 * eco.buyMultiplier)
    },
    {
      ...makeItem('weapon', itemLevel, itemLevel > 15 ? 'Rara' : 'Incomum', `Lâmina de ${eco.city.split(' ')[0]} Nv.${itemLevel}`),
      id: `shop-wep-${zoneId}`,
      zoneId: eco.zoneId,
      regionalMaterial: eco.primaryMaterial,
      value: Math.round((140 + itemLevel * 14) * eco.buyMultiplier)
    },
    {
      ...makeItem('armor', itemLevel, itemLevel > 15 ? 'Rara' : 'Incomum', `Couraça de ${eco.city.split(' ')[0]} Nv.${itemLevel}`),
      id: `shop-arm-${zoneId}`,
      zoneId: eco.zoneId,
      regionalMaterial: eco.primaryMaterial,
      value: Math.round((130 + itemLevel * 12) * eco.buyMultiplier)
    },
    {
      ...makeItem('boots', itemLevel, 'Comum', `Botas de ${eco.city.split(' ')[0]} Nv.${itemLevel}`),
      id: `shop-bts-${zoneId}`,
      zoneId: eco.zoneId,
      regionalMaterial: eco.primaryMaterial,
      value: Math.round((95 + itemLevel * 9) * eco.buyMultiplier)
    },
    {
      id: `shop-mat-${zoneId}`,
      name: eco.primaryMaterial,
      type: 'material',
      subtype: 'regional_material',
      rarity: 'Incomum',
      color: eco.color,
      level: itemLevel,
      qty: 1,
      zoneId: eco.zoneId,
      regionalMaterial: eco.primaryMaterial,
      value: Math.round(75 * eco.buyMultiplier)
    }
  ]

  return stock
}

// Cálculo de preço de venda com bônus regional
export function calculateSellPrice(item, currentZoneId = 'aurora') {
  const eco = REGIONAL_ECONOMIES[currentZoneId] || REGIONAL_ECONOMIES.aurora
  const baseValue = item.value || 30
  let sellPrice = Math.max(1, Math.round(baseValue * eco.sellMultiplier))

  // Se o item é originário desta mesma cidade, concede +30% de bônus!
  const isLocal = item.zoneId === currentZoneId || item.regionalMaterial === eco.primaryMaterial
  if (isLocal) {
    sellPrice = Math.round(sellPrice * eco.localBonus)
  }

  return {
    price: sellPrice,
    isLocalBonus: isLocal,
    bonusPercent: isLocal ? 30 : 0
  }
}
