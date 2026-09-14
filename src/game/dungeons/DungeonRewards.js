// DungeonRewards.js - Loot tables, exclusive dungeon equipment and Guardian Chest rewards
import { GATE_RANKS } from './DungeonConfig.js'

export const EXCLUSIVE_DUNGEON_DROPS = [
  {
    name: 'Lâmina do Eclipse Sombrio',
    type: 'weapon',
    subtype: 'sword',
    rarity: 'Lendário',
    color: '#fbbf24',
    minRank: 'B',
    atkBonus: 38,
    critBonus: 14,
    desc: 'Forjada no coração de um Portal Rank A. Seus cortes deixam um rastro de trevas que rasga as defesas inimigas.'
  },
  {
    name: 'Machado da Fenda Abissal',
    type: 'weapon',
    subtype: 'axe',
    rarity: 'Épico',
    color: '#c084fc',
    minRank: 'C',
    atkBonus: 32,
    critBonus: 8,
    desc: 'Pesado e imbuído com magma comprimido. Desfere impactos esmagadores capazes de quebrar carapaças.'
  },
  {
    name: 'Arco do Caçador Etéreo',
    type: 'weapon',
    subtype: 'bow',
    rarity: 'Épico',
    color: '#38bdf8',
    minRank: 'C',
    atkBonus: 28,
    critBonus: 16,
    desc: 'Dispara flechas arcanas de alta penetração que atravessam armaduras rúnicas.'
  },
  {
    name: 'Adagas da Névoa Noturna',
    type: 'weapon',
    subtype: 'dagger',
    rarity: 'Raro',
    color: '#3b82f6',
    minRank: 'D',
    atkBonus: 20,
    critBonus: 18,
    desc: 'Empunhadas pelos assassinos das masmorras. Ataques com velocidade fulminante.'
  },
  {
    name: 'Couraça do Monarca das Sombras',
    type: 'armor',
    subtype: 'heavy',
    rarity: 'Lendário',
    color: '#fbbf24',
    minRank: 'A',
    defBonus: 30,
    hpBonus: 120,
    desc: 'Armadura completa dos nobres das profundezas. Reduz o dano recebido em masmorras e combates intensos.'
  },
  {
    name: 'Manto do Vácuo Umbral',
    type: 'armor',
    subtype: 'light',
    rarity: 'Épico',
    color: '#c084fc',
    minRank: 'C',
    defBonus: 18,
    hpBonus: 75,
    desc: 'Tecido com essência de monstros de elite. Concede esquiva e resistência a feitiços.'
  },
  {
    name: 'Anel do Olho do Abismo',
    type: 'talisman',
    subtype: 'ring',
    rarity: 'Épico',
    color: '#c084fc',
    minRank: 'C',
    atkBonus: 14,
    defBonus: 10,
    desc: 'Emite pulsações mágicas que aceleram a regeneração de vigor e aumentam o dano crítico.'
  },
  {
    name: 'Amuleto da Alma do Guardião',
    type: 'talisman',
    subtype: 'amulet',
    rarity: 'Raro',
    color: '#3b82f6',
    minRank: 'D',
    defBonus: 8,
    hpBonus: 50,
    desc: 'Cristalizado a partir da cinza de um chefe de masmorra. Protege o portador contra golpes letais.'
  }
]

export class DungeonRewards {
  static calculateCompletionReward({ rank = 'C', level = 25, durationSeconds = 300, kills = 25, elites = 2, bosses = 1 }) {
    const config = GATE_RANKS[rank] || GATE_RANKS.C
    
    // Base calculations scaled with rank and level
    const baseXP = Math.round((280 + level * 35) * config.xpMult)
    const bonusKillXP = kills * 14
    const bonusEliteXP = elites * 120
    const bonusBossXP = bosses * 450
    const totalXP = Math.round(baseXP + bonusKillXP + bonusEliteXP + bonusBossXP)

    const baseGold = Math.round((120 + level * 16) * config.goldMult)
    const bonusKillGold = kills * 5
    const totalGold = Math.round(baseGold + bonusKillGold + elites * 35 + bosses * 150)

    // Roll for exclusive loot
    const loot = []
    const dropsForRank = EXCLUSIVE_DUNGEON_DROPS.filter(d => {
      const order = ['E', 'D', 'C', 'B', 'A', 'S']
      return order.indexOf(rank) >= order.indexOf(d.minRank)
    })

    if (dropsForRank.length > 0) {
      const rolled = dropsForRank[Math.floor(Math.random() * dropsForRank.length)]
      const item = {
        id: `dungeon_drop_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: rolled.name,
        type: rolled.type,
        subtype: rolled.subtype,
        rarity: rolled.rarity,
        color: rolled.color,
        level: Math.max(1, level),
        value: Math.round(80 + level * 12),
        atk: rolled.atkBonus ? Math.round(12 + level * 1.5 + rolled.atkBonus) : undefined,
        def: rolled.defBonus ? Math.round(4 + level * 0.8 + rolled.defBonus) : undefined,
        critChance: rolled.critBonus || 0,
        hpBonus: rolled.hpBonus || 0,
        desc: rolled.desc,
        isDungeonExclusive: true
      }
      loot.push(item)
    }

    // Always grant 1-3 Dungeon Core Crystals
    const crystalCount = Math.max(1, Math.round(1 + (config.id === 'S' ? 4 : config.id === 'A' ? 3 : config.id === 'B' ? 2 : 1)))
    loot.push({
      id: `crystal_core_${Date.now()}`,
      name: 'Cristal do Núcleo da Masmorra',
      type: 'material',
      subtype: 'ore',
      rarity: rank === 'S' || rank === 'A' ? 'Lendário' : rank === 'B' ? 'Épico' : 'Raro',
      qty: crystalCount,
      value: 65 * crystalCount,
      desc: 'Material denso extraído de fendas ativas. Utilizado em refinamento e encantos de ponta.'
    })

    return {
      xp: totalXP,
      gold: totalGold,
      loot,
      kills,
      elites,
      bosses,
      rank,
      durationText: `${Math.floor(durationSeconds / 60)}:${String(Math.floor(durationSeconds % 60)).padStart(2, '0')}`
    }
  }
}
