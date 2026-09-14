// Sistema de 15 Classes de RPG + Soberano do Caos com Roleta de Destino por Pesos Percentuais
export const CLASS_TIERS = {
  COMMON: { name: 'Comum', color: '#94a3b8', weight: 55.0, icon: '📖' },
  UNCOMMON: { name: 'Incomum', color: '#4ade80', weight: 28.0, icon: '📘' },
  RARE: { name: 'Raro', color: '#38bdf8', weight: 12.5, icon: '📙' },
  EPIC: { name: 'Épico', color: '#c084fc', weight: 4.0, icon: '📕' },
  LEGENDARY: { name: 'Lendário', color: '#f59e0b', weight: 0.5, icon: '👑' }
}

export const CLASSES_LIST = [
  // 📖 Nível Comum (55% de taxa global - 11% individual)
  {
    id: 'mercenary_swordsman',
    name: 'Espadachim Mercenário',
    tier: 'COMMON',
    lore: 'Focado em ataques rápidos e bloqueios sólidos. Escala puramente com Força (FOR).',
    stats: { atkMult: 1.25, defBonus: 6, spdBonus: 0.4, critChance: 0.08 },
    passive: {
      name: 'Instinto de Combate',
      desc: '+25% de dano físico e 10% de redução no custo de vigor ao bloquear.'
    },
    skill: {
      name: 'Corte Dilacerante',
      desc: 'Um golpe giratório veloz que atinge todos os inimigos à frente causando 220% de dano.',
      cooldown: 3.5,
      stamina: 18,
      type: 'melee_aoe'
    },
    auraColor: 0x94a3b8,
    trailColor: 0x94a3b8
  },
  {
    id: 'hunting_archer',
    name: 'Arqueiro de Caça',
    tier: 'COMMON',
    lore: 'Especialista em dano à distância com flechas certeiras. Bônus contra feras terrestres.',
    stats: { atkMult: 1.15, defBonus: 2, spdBonus: 0.8, critChance: 0.15 },
    passive: {
      name: 'Caçador de Feras',
      desc: 'Causa +35% de dano extra contra monstros terrestres e feras da natureza.'
    },
    skill: {
      name: 'Tiro Perfurante de Vento',
      desc: 'Dispara uma rajada veloz de flechas de vento em linha reta que perfura múltiplos inimigos.',
      cooldown: 4.0,
      stamina: 20,
      type: 'projectile_line'
    },
    auraColor: 0x86efac,
    trailColor: 0x4ade80
  },
  {
    id: 'rogue_thief',
    name: 'Gatuno (Ladino Básico)',
    tier: 'COMMON',
    lore: 'Alta evasão e velocidade de movimento. Abre baús e encontra tesouros escondidos.',
    stats: { atkMult: 1.12, defBonus: 1, spdBonus: 1.5, critChance: 0.20 },
    passive: {
      name: 'Pés de Pluma',
      desc: '+25% de chance de esquiva passiva e +30% de ouro encontrado em baús e inimigos.',
      evasionBonus: 0.25,
      goldBonus: 0.30
    },
    skill: {
      name: 'Passo Espectral',
      desc: 'Desaparece em fumaça cinzenta e ressurge em velocidade supersônica com golpe crítico.',
      cooldown: 4.2,
      stamina: 22,
      type: 'dash_strike'
    },
    auraColor: 0x64748b,
    trailColor: 0x475569
  },
  {
    id: 'light_adept',
    name: 'Adepto da Luz',
    tier: 'COMMON',
    lore: 'Portador da centelha sagrada. Concede sustentação e regeneração contínua de vida.',
    stats: { atkMult: 0.95, defBonus: 8, spdBonus: 0.2, critChance: 0.05 },
    passive: {
      name: 'Luz Serena',
      desc: 'Regenera 2.5% de HP máximo a cada 3 segundos continuamente.',
      hpRegen: 0.025
    },
    skill: {
      name: 'Onda Restauradora',
      desc: 'Emite um pulso radiante que cura 45% do HP máximo e afasta inimigos próximos com dano sagrado.',
      cooldown: 6.0,
      stamina: 25,
      type: 'heal_burst'
    },
    auraColor: 0xfef08a,
    trailColor: 0xffedd5
  },
  {
    id: 'arcane_apprentice',
    name: 'Aprendiz Arcano',
    tier: 'COMMON',
    lore: 'Dispara projéteis de mana bruta comprimida com alto dano de impacto.',
    stats: { atkMult: 1.30, defBonus: 2, spdBonus: 0.3, critChance: 0.12 },
    passive: {
      name: 'Ressonância Mística',
      desc: 'Acertos aumentam o alcance e velocidade dos ataques em 20%.',
      rangeBonus: 1.2
    },
    skill: {
      name: 'Saraivada de Mísseis Arcanos',
      desc: 'Conjura 4 esferas de mana brilhante teleguiadas que explodem nos alvos.',
      cooldown: 4.5,
      stamina: 24,
      type: 'multi_missile'
    },
    auraColor: 0x60a5fa,
    trailColor: 0x93c5fd
  },

  // 📘 Nível Incomum (28% de taxa global - 5.6% individual)
  {
    id: 'vanguard_defender',
    name: 'Defensor de Vanguarda',
    tier: 'UNCOMMON',
    lore: 'Tanque inabalável. Reduz e absorve dano frontal protegendo o grupo com escudos rúnicos.',
    stats: { atkMult: 1.10, defBonus: 18, spdBonus: -0.2, critChance: 0.05 },
    passive: {
      name: 'Escudo Físico Inabalável',
      desc: 'Absorve passivamente 15% de todo o dano recebido e +18 de Defesa base.',
      damageReduction: 0.15
    },
    skill: {
      name: 'Bastião Inquebrável',
      desc: 'Ergue uma muralha de escudos reluzentes que absorve dano total por 3s e devolve em onda de choque.',
      cooldown: 7.0,
      stamina: 30,
      type: 'shield_barrier'
    },
    auraColor: 0x38bdf8,
    trailColor: 0x0284c7
  },
  {
    id: 'beast_ranger',
    name: 'Patrulheiro das Feras',
    tier: 'UNCOMMON',
    lore: 'Mestre da fauna selvagem. Pode domar feras com HP baixo para lutar ao seu lado temporariamente.',
    stats: { atkMult: 1.20, defBonus: 8, spdBonus: 0.9, critChance: 0.14 },
    passive: {
      name: 'Vínculo Selvagem',
      desc: 'Chance de domesticar monstros enfraquecidos (<25% HP), transformando-os em aliados temporários.',
      tameChance: 0.35
    },
    skill: {
      name: 'Chamado da Alcateia',
      desc: 'Invoca uma fera espiritual feroz que ataca inimigos ao redor por 12 segundos.',
      cooldown: 10.0,
      stamina: 28,
      type: 'summon_beast'
    },
    auraColor: 0x4ade80,
    trailColor: 0x22c55e
  },
  {
    id: 'silent_assassin',
    name: 'Algoz Silencioso',
    tier: 'UNCOMMON',
    lore: 'Especialista em mortes silenciosas. Ataques nas costas do inimigo têm 100% de Acerto Crítico.',
    stats: { atkMult: 1.32, defBonus: 4, spdBonus: 1.4, critChance: 0.25 },
    passive: {
      name: 'Golpe Fatal nas Costas',
      desc: 'Golpes aplicados por trás têm 100% de Chance de Crítico e +80% de Dano Crítico.',
      backstabCrit: 1.0,
      critDamageBonus: 0.8
    },
    skill: {
      name: 'Passo das Sombras Mortais',
      desc: 'Teleporta instantaneamente para trás do inimigo mais próximo executando corte letal.',
      cooldown: 4.8,
      stamina: 25,
      type: 'teleport_backstab'
    },
    auraColor: 0xa855f7,
    trailColor: 0x7e22ce
  },
  {
    id: 'elementalist',
    name: 'Elementalista (Fogo / Gelo)',
    tier: 'UNCOMMON',
    lore: 'Manipulador dos elementos primordiais. Fogo causa queima contínua e Gelo aplica lentidão severa.',
    stats: { atkMult: 1.34, defBonus: 5, spdBonus: 0.5, critChance: 0.16 },
    passive: {
      name: 'Afinidade Elemental',
      desc: 'Alterna entre Chamas (Burn de 5% DPS) e Gelo (Slow de 50% de velocidade do inimigo).',
      elementalEffect: 'fire_ice'
    },
    skill: {
      name: 'Vórtice Térmico Cataclísmico',
      desc: 'Libera uma tempestade simultânea de chamas incandescentes e espinhos de gelo congelantes.',
      cooldown: 5.5,
      stamina: 26,
      type: 'elemental_storm'
    },
    auraColor: 0xf97316,
    trailColor: 0x38bdf8
  },
  {
    id: 'battle_cleric',
    name: 'Clérigo de Batalha',
    tier: 'UNCOMMON',
    lore: 'Guerreiro sagrado blindado. Converte 30% do dano que causa em cura em área restauradora.',
    stats: { atkMult: 1.18, defBonus: 14, spdBonus: 0.3, critChance: 0.10 },
    passive: {
      name: 'Golpe da Salvação',
      desc: 'Converte 30% de todo dano físico causado aos inimigos em cura para si mesmo e aliados.',
      lifeLeechPercent: 0.30
    },
    skill: {
      name: 'Martelo do Julgamento Divino',
      desc: 'Despenca uma coluna de luz solar esmagadora que causa 260% de dano e cura 30% de HP.',
      cooldown: 6.0,
      stamina: 28,
      type: 'holy_smite'
    },
    auraColor: 0xfacc15,
    trailColor: 0xfef08a
  },

  // 📙 Nível Raro (12.5% de taxa global - 4.16% individual)
  {
    id: 'rune_engineer',
    name: 'Engenheiro de Runas',
    tier: 'RARE',
    lore: 'Construtor de autômatos mecânico-arcanos. Implanta torretas e barreiras que atiram sozinhas.',
    stats: { atkMult: 1.28, defBonus: 12, spdBonus: 0.6, critChance: 0.14 },
    passive: {
      name: 'Engenharia Rúnica',
      desc: 'Suas construções e equipamentos recebem +25% de durabilidade e cadência de tiro.',
      turretCadence: 1.25
    },
    skill: {
      name: 'Implantar Sentinela Rúnica',
      desc: 'Planta uma torreta autônoma no chão que dispara lasers de plasma arcano nos inimigos por 16 segundos.',
      cooldown: 8.0,
      stamina: 32,
      type: 'deploy_turret'
    },
    auraColor: 0x06b6d4,
    trailColor: 0x22d3ee
  },
  {
    id: 'blood_mage',
    name: 'Mago de Sangue',
    tier: 'RARE',
    lore: 'Transmuta sua própria vitalidade em poder destrutivo. Roubo de vida massivo em estilo canhão de vidro.',
    stats: { atkMult: 1.55, defBonus: 3, spdBonus: 0.7, critChance: 0.22 },
    passive: {
      name: 'Pacto Carmesim (Life Steal)',
      desc: 'Causa +45% de dano extremo e rouba 35% do dano causado na forma de HP puro.',
      lifeStealPercent: 0.35,
      usesHpForSkills: true
    },
    skill: {
      name: 'Lança de Sangue Sacrificial',
      desc: 'Consome 12 de HP para arremessar uma foice de sangue fervente que causa dano colossal e devolve 30 HP.',
      cooldown: 3.8,
      stamina: 0,
      hpCost: 12,
      type: 'blood_spear'
    },
    auraColor: 0xef4444,
    trailColor: 0x991b1b
  },
  {
    id: 'rune_knight',
    name: 'Cavaleiro Rúnico',
    tier: 'RARE',
    lore: 'Fusão perfeita de Força e Inteligência. Seus golpes de espada disparam ondas cortantes arcanas à distância.',
    stats: { atkMult: 1.42, defBonus: 12, spdBonus: 0.8, critChance: 0.18 },
    passive: {
      name: 'Gume Encantado',
      desc: 'Todo ataque corpo a corpo emite uma lâmina de choque arcana que viaja até 12 metros atingindo alvos.',
      projectileOnSwing: true
    },
    skill: {
      name: 'Tempestade de Lâminas Rúnicas',
      desc: 'Gira sua espada mágica liberando 5 ondas cortantes cruzadas que estraçalham as linhas inimigas.',
      cooldown: 5.0,
      stamina: 26,
      type: 'rune_wave'
    },
    auraColor: 0x3b82f6,
    trailColor: 0x60a5fa
  },

  // 📕 Nível Épico (4.0% de taxa global - 2.0% individual)
  {
    id: 'shadow_master',
    name: 'Mestre das Sombras',
    tier: 'EPIC',
    lore: 'Comandante da escuridão. Ao derrotar inimigos de elite ou chefes, ergue suas sombras em lacaios leais permanentes.',
    stats: { atkMult: 1.48, defBonus: 10, spdBonus: 1.2, critChance: 0.24 },
    passive: {
      name: 'Extração de Sombra',
      desc: 'Ao abater um chefe ou monstro forte, conjura um Soldado das Sombras permanente que sobe de nível com você.',
      shadowExtract: true
    },
    skill: {
      name: 'Exército das Sombras (Erguer)',
      desc: 'Comanda todas as sombras ao redor a explodirem em tentáculos sombrios e marcharem contra os alvos.',
      cooldown: 9.0,
      stamina: 34,
      type: 'shadow_surge'
    },
    auraColor: 0x7c3aed,
    trailColor: 0x4c1d95
  },
  {
    id: 'time_arcanist',
    name: 'Arcanista do Tempo',
    tier: 'EPIC',
    lore: 'Manipulador supremo do fluxo temporal. Pode zerar recargas e congelar chefes e inimigos no tempo.',
    stats: { atkMult: 1.38, defBonus: 8, spdBonus: 1.6, critChance: 0.20 },
    passive: {
      name: 'Distorção Temporal',
      desc: 'Reduz o tempo de recarga de todas as habilidades em 40% e acelera o tempo de recuperação de vigor.',
      cooldownReduction: 0.40
    },
    skill: {
      name: 'Parada Temporal Suprema (Zawarudo)',
      desc: 'Congela completamente todos os monstros e chefes na arena por 3 segundos preciosos!',
      cooldown: 14.0,
      stamina: 35,
      type: 'time_freeze'
    },
    auraColor: 0x38bdf8,
    trailColor: 0xe0f2fe
  },

  // 👑 Nível Lendário (0.5% de taxa global)
  {
    id: 'chaos_sovereign',
    name: 'Soberano do Caos',
    tier: 'LEGENDARY',
    lore: 'A classe quebra-sistema ancestral. Seus atributos não têm teto e ele absorve 1% do poder de cada chefe derrotado infinitamente.',
    stats: { atkMult: 1.85, defBonus: 22, spdBonus: 2.0, critChance: 0.35 },
    passive: {
      name: 'Ascensão Infinita do Caos',
      desc: 'Absorve 1% do poder base de todo chefe derrotado permanentemente. Atributos sem teto de nível!',
      bossPowerSteal: 0.01,
      infiniteScaling: true
    },
    skill: {
      name: 'Devorador do Caos Cósmico',
      desc: 'Abre um buraco negro gravitacional caótico que suga todos os inimigos, causa 450% de dano e restaura HP.',
      cooldown: 11.0,
      stamina: 30,
      type: 'black_hole_aoe'
    },
    auraColor: 0xf59e0b,
    trailColor: 0xef4444
  }
]

// Roleta com Pesos Exatos (0.00 a 100.00):
// 0.00 a 55.00 => Comum (Classes 1 a 5)
// 55.01 a 83.00 => Incomum (Classes 6 a 10)
// 83.01 a 95.50 => Raro (Classes 11 a 13)
// 95.51 a 99.50 => Épico (Classes 14 a 15)
// 99.51 a 100.00 => Lendário (Soberano do Caos)
export function rollDestinyClass(fixedRoll = null) {
  const roll = fixedRoll !== null ? fixedRoll : Math.random() * 100

  let eligibleTier = 'COMMON'
  if (roll <= 55.00) {
    eligibleTier = 'COMMON'
  } else if (roll <= 83.00) {
    eligibleTier = 'UNCOMMON'
  } else if (roll <= 95.50) {
    eligibleTier = 'RARE'
  } else if (roll <= 99.50) {
    eligibleTier = 'EPIC'
  } else {
    eligibleTier = 'LEGENDARY'
  }

  const pool = CLASSES_LIST.filter(c => c.tier === eligibleTier)
  const pickedClass = pool[Math.floor(Math.random() * pool.length)] || CLASSES_LIST[0]

  return {
    roll: Number(roll.toFixed(2)),
    tierInfo: CLASS_TIERS[eligibleTier],
    cls: pickedClass
  }
}

// Sistema de Evolução / Upgrade de Classe (Graus de Mestria)
export const CLASS_RANKS = [
  { rank: 1, name: 'Grau I (Iniciado)', minLevel: 1, costGold: 0, costGrimoires: 0, atkBonus: 0, abilityBonus: 0, staminaDiscount: 0, critBonus: 0 },
  { rank: 2, name: 'Grau II (Veterano)', minLevel: 20, costGold: 450, costGrimoires: 1, atkBonus: 0.15, abilityBonus: 0.12, staminaDiscount: 0.10, critBonus: 2.5 },
  { rank: 3, name: 'Grau III (Desperto)', minLevel: 50, costGold: 1200, costGrimoires: 1, atkBonus: 0.32, abilityBonus: 0.25, staminaDiscount: 0.20, critBonus: 5.0 },
  { rank: 4, name: 'Grau IV (Mestre Ancestral)', minLevel: 90, costGold: 3500, costGrimoires: 2, atkBonus: 0.55, abilityBonus: 0.40, staminaDiscount: 0.30, critBonus: 8.0 },
  { rank: 5, name: 'Grau V (Divino/Soberano)', minLevel: 150, costGold: 8000, costGrimoires: 3, atkBonus: 0.85, abilityBonus: 0.60, staminaDiscount: 0.40, critBonus: 12.0 },
]

export function getClassRankInfo(currentRank = 1) {
  const current = CLASS_RANKS.find(r => r.rank === currentRank) || CLASS_RANKS[0]
  const next = CLASS_RANKS.find(r => r.rank === currentRank + 1) || null
  return { current, next }
}

