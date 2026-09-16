// Requested gameplay fixes: guild progression, caravan combat/loot, damage balance,
// unique mob drops, merchant stock/category coverage and companion pets.
// Loaded by runtimePatches.js and applied once the ShadowGame instance exists.

import { GUILD_RANKS } from './config.js'
import {
  guildRankRequirement,
  merchantStock,
  shopRefreshInfo,
  refreshGuildBoard,
  makeItem,
  makeResourceDrop,
} from './rpgSystems.js'

const normalizeKey = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim()

const DROP_TABLE = {
  'javali de musgo': ['Presa Musgosa', '#84cc16', 18, 2.05],
  'slime lumen': ['Núcleo Lúmen Viscoso', '#34d399', 16, 1.95],
  'guardiao da aurora': ['Coração do Guardião da Aurora', '#facc15', 110, 4.8],
  'lobo lumen': ['Presa Lúmen Alfa', '#a3e635', 26, 2.35],
  'besouro couracado': ['Carapaça Couraçada', '#65a30d', 30, 2.55],
  'raposa runica': ['Cauda Rúnica', '#22c55e', 34, 2.75],
  'alfa lumen': ['Olho do Alfa Lúmen', '#eab308', 165, 5.4],
  'treant jovem': ['Casca Viva Cinérea', '#65a30d', 44, 3.05],
  'corvo cinzento': ['Pena Cinérea', '#94a3b8', 48, 3.2],
  'aranha de casca': ['Seda de Casca', '#a78bfa', 52, 3.35],
  'cervo espectral': ['Galhada Espectral', '#c084fc', 220, 6.0],
  'caranguejo runico': ['Pinça Rúnica Safira', '#38bdf8', 68, 3.8],
  'serpente de mare': ['Escama de Maré', '#06b6d4', 74, 4.0],
  'gaivota abissal': ['Pena Abissal', '#0ea5e9', 80, 4.2],
  'leviata de espuma': ['Núcleo do Leviatã', '#22d3ee', 320, 6.9],
  'leviata': ['Núcleo do Leviatã', '#22d3ee', 320, 6.9],
  'golem de xisto': ['Núcleo de Xisto', '#94a3b8', 96, 4.65],
  'harpia de veyra': ['Pluma de Veyra', '#cbd5e1', 104, 4.85],
  'bode de cristal': ['Chifre de Cristal', '#67e8f9', 112, 5.05],
  'roc tempestuoso': ['Pena do Roc Tempestuoso', '#60a5fa', 430, 7.8],
  'lagarto de brasa': ['Escama de Brasa', '#fb923c', 128, 5.5],
  'cavaleiro oco': ['Fragmento de Armadura Oca', '#f97316', 138, 5.75],
  'escorpiao magmatico': ['Ferrão Magmático', '#ef4444', 150, 6.0],
  'colosso rubro': ['Coração do Colosso Rubro', '#dc2626', 570, 8.9],
  'sentinela umbral': ['Sigilo da Sentinela Umbral', '#8b5cf6', 174, 6.55],
  'fera do vazio': ['Garra do Vazio', '#a855f7', 188, 6.8],
  'mimico sombrio': ['Dente do Mímico Sombrio', '#7c3aed', 202, 7.05],
  'arconte sem nome': ['Essência do Arconte Sem Nome', '#c084fc', 760, 10.2],
  'serafim partido': ['Pluma do Serafim Partido', '#e2e8f0', 226, 7.55],
  'dragao nevoa': ['Escama do Dragão Névoa', '#bfdbfe', 242, 7.85],
  'cavaleiro celeste': ['Insígnia Celeste', '#f8fafc', 258, 8.1],
  'soberano celeste': ['Fragmento da Coroa Soberana', '#fde68a', 980, 12.0],
  'slime': ['Núcleo Gelatinoso', '#34d399', 14, 1.8],
  'goblin': ['Orelha de Goblin', '#84cc16', 18, 2.0],
  'esqueleto': ['Osso Rúnico', '#e2e8f0', 24, 2.25],
  'golem': ['Pedra de Núcleo', '#94a3b8', 34, 2.7],
  'espectro': ['Essência Espectral', '#a78bfa', 40, 2.9],
}

function deterministicFallback(source, level) {
  const key = normalizeKey(source) || 'criatura'
  let hash = 2166136261
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  const hue = Math.abs(hash) % 360
  const base = 20 + (Math.abs(hash >>> 3) % 90)
  const scale = 2 + (Math.abs(hash >>> 7) % 35) / 10
  return [`Troféu de ${source || 'Criatura'}`, `hsl(${hue} 68% 62%)`, base, scale, Math.max(1, level)]
}

export function applyUniqueMobDrop(item = {}) {
  if (!item || item.subtype !== 'monster-drop') return item
  const source = String(item.source || 'Criatura')
  const key = normalizeKey(source)
  const direct = DROP_TABLE[key]
  let profile = direct
  if (!profile) {
    const partial = Object.entries(DROP_TABLE).find(([mob]) => key.includes(mob) || mob.includes(key))
    profile = partial?.[1] || deterministicFallback(source, item.level || 1)
  }
  const [name, color, base, scale] = profile
  const level = Math.max(1, Math.round(Number(item.level) || 1))
  return {
    ...item,
    name: `${name} Nv.${level}`,
    color,
    value: Math.max(1, Math.round(base + level * scale)),
    source,
    description: `Espólio exclusivo de ${source}. O valor varia conforme o nível da criatura.`,
  }
}

export function earlyGuildPromotionStatus(state = {}) {
  const currentIndex = Math.max(0, Math.min(GUILD_RANKS.length - 1, Number(state.guildRankIndex) || 0))
  const nextIndex = currentIndex + 1
  const next = GUILD_RANKS[nextIndex]
  if (!next) return { eligible: false, oneLevelEarly: false, currentIndex, nextIndex: null, next: null }
  const level = Math.max(1, Number(state.level) || 1)
  const guildPoints = Math.max(0, Number(state.guildPoints) || 0)
  const requirement = guildRankRequirement(nextIndex)
  const oneLevelEarly = level === Math.max(1, next.minLevel - 1)
  const eligible = oneLevelEarly && guildPoints >= requirement
  return {
    eligible,
    oneLevelEarly,
    currentIndex,
    nextIndex,
    next,
    level,
    guildPoints,
    requirement,
    missingGuildPoints: Math.max(0, requirement - guildPoints),
    bonusXp: Math.max(50, Math.round(180 * next.mult)),
    bonusGold: Math.max(80, Math.round(240 * next.mult)),
  }
}

function maintainEarlyRankContractAccess(game) {
  const state = game?.state
  if (!state?.guildEarlyPromotionRank) return
  const current = GUILD_RANKS[state.guildRankIndex || 0]
  if (!current || current.id !== state.guildEarlyPromotionRank || (state.level || 1) >= current.minLevel) {
    state.guildEarlyPromotionRank = null
    return
  }
  for (const mission of state.guildMissions || []) {
    if ((mission.rankIndex || 0) <= (state.guildRankIndex || 0)) {
      mission.minLevel = Math.min(Number(mission.minLevel) || state.level, state.level)
    }
  }
}

export function promoteGuildEarly(game) {
  const state = game?.state
  if (!state) return null
  const status = earlyGuildPromotionStatus(state)
  if (!status.eligible) return null

  state.guildRankIndex = status.nextIndex
  state.guildRank = status.next.id
  state.guildEarlyPromotionRank = status.next.id
  state.gold = Math.max(0, Number(state.gold) || 0) + status.bonusGold
  state.guildMissionCycle = null
  refreshGuildBoard(state)
  maintainEarlyRankContractAccess(game)

  // XP bonus is real player XP. Because the rank was already changed above, the normal
  // rank updater cannot grant the same promotion twice.
  game.gainXp?.(status.bonusXp, 'Promoção antecipada')
  game.saveGame?.()
  game.saveCloudGame?.({ force: true })
  game.toast?.(`⭐ Rank ${status.next.id} antecipado! +${status.bonusXp} XP e +${status.bonusGold}◈ por subir 1 nível antes.`)
  return status
}

export function balancedAttackInput(amount, target = {}) {
  const raw = Math.max(1, Number(amount) || 1)
  const defense = Math.max(0, Number(target?.def) || 0)
  if (!defense) return raw
  // The engine still applies its original mitigation (DEF × 5). Compensate the input so
  // effective mitigation becomes a gentle DEF × 0.5 instead, keeping displayed DAMAGE
  // close to the number players actually see floating over ordinary mobs.
  const oldDenominator = 100 + defense * 5
  const newDenominator = 100 + defense * 0.5
  return raw * oldDenominator / newDenominator
}

export function petPowerProfile(name = '') {
  const key = normalizeKey(name)
  if (/brasa|magmat|rubro|fogo|dragao/.test(key)) return { name: 'Explosão Ígnea', type: 'fire', multiplier: 1.65, radius: 3.1, color: 0xf97316 }
  if (/mare|safira|espuma|caranguejo|serpente|leviata/.test(key)) return { name: 'Impacto das Marés', type: 'water', multiplier: 1.48, radius: 2.7, color: 0x38bdf8 }
  if (/umbral|vazio|sombr|espectral|arconte|mimico/.test(key)) return { name: 'Rasgo Umbral', type: 'shadow', multiplier: 1.72, radius: 2.8, color: 0xa855f7 }
  if (/lumen|runic|cristal|celeste|serafim|roc/.test(key)) return { name: 'Pulso Rúnico', type: 'arcane', multiplier: 1.56, radius: 2.9, color: 0x67e8f9 }
  if (/golem|xisto|colosso|couracad|cavaleiro/.test(key)) return { name: 'Impacto Sísmico', type: 'earth', multiplier: 1.62, radius: 3.3, color: 0x94a3b8 }
  if (/lobo|javali|raposa|fera|cervo|bode|treant|aranha/.test(key)) return { name: 'Investida Selvagem', type: 'beast', multiplier: 1.5, radius: 2.4, color: 0x84cc16 }
  return { name: `Poder de ${name || 'Criatura'}`, type: 'physical', multiplier: 1.42, radius: 2.4, color: 0x60a5fa }
}

function enrichPet(pet) {
  if (!pet) return pet
  const power = petPowerProfile(pet.name)
  pet.specialName = power.name
  pet.specialType = power.type
  pet.specialMultiplier = power.multiplier
  pet.specialRadius = power.radius
  pet.specialColor = power.color
  return pet
}

function normalizeRequestedTrials(game) {
  const state = game?.state
  if (!state?.quests) return

  const oath = state.quests.find(q => q.id === 'rider_oath')
  if (oath) {
    // Saves from before this change may already have 3/3 completed. Keep the completion,
    // but normalize it to 5/5 so the UI never shows a completed 3/5 trial.
    if (oath.status === 'done') {
      oath.progress = 5
    } else if (!oath.bossTrialV2) {
      oath.progress = 0
      if (oath.status === 'ready') oath.status = 'active'
      oath.bossTrialV2 = true
    }
    oath.type = 'boss'
    oath.target = 'any'
    oath.goal = 5
    oath.text = 'Elimine 5 bosses do mapa para concluir a Provação e receber a Permissão Real de Domação.'
  }

  for (const q of state.quests) {
    if (!String(q.id || '').startsWith('ascension_rank_')) continue
    q.type = 'boss'
    q.target = 'any'
    q.goal = 5
    if (q.status === 'done') q.progress = 5
    q.text = 'Elimine 5 bosses do mapa para concluir a Prova Obrigatória de evolução de classe.'
  }
}

function ensureCaravanCargo(caravan) {
  if (!caravan) return caravan
  if (!Array.isArray(caravan.cargo) || caravan.cargo.length === 0) {
    caravan.cargo = [
      { name: 'Caixa de Suprimentos da Caravana', type: 'material', value: 70, qty: 6 },
      { name: 'Mercadoria Selada', type: 'material', value: 110, qty: 3 },
      { name: 'Poção de Viagem', type: 'potion', value: 65, qty: 2 },
    ]
  }
  if (!Number.isFinite(Number(caravan.cargoGold)) || Number(caravan.cargoGold) <= 0) caravan.cargoGold = 450
  return caravan
}

function patchCaravans(game) {
  const manager = game?.caravanManager
  if (!manager || manager.__requestedGameplayPatched) return
  manager.__requestedGameplayPatched = true
  for (const caravan of manager.caravans || []) ensureCaravanCargo(caravan)

  const originalCreate = manager.createCaravan?.bind(manager)
  if (originalCreate) {
    manager.createCaravan = (...args) => {
      const caravan = originalCreate(...args)
      ensureCaravanCargo(caravan)
      return caravan
    }
  }

  const originalOpen = manager.openCaravanInfoModal?.bind(manager)
  if (originalOpen) {
    manager.openCaravanInfoModal = caravan => {
      ensureCaravanCargo(caravan)
      const result = originalOpen(caravan)
      if (game.state?.caravanModal) {
        game.state.caravanModal.goods = (caravan?.cargo || []).map(item => ({
          name: item.name,
          qty: Math.max(1, Number(item.qty) || 1),
          value: Math.max(1, Number(item.value) || 1),
        }))
        game.state.caravanModal.cargoCount = (caravan?.cargo || []).reduce((sum, item) => sum + Math.max(1, Number(item.qty) || 1), 0)
        game.state.caravanModal.cargoGold = Math.max(0, Number(caravan?.cargoGold) || 0)
      }
      return result
    }
  }

  const originalLoot = manager.lootCaravan?.bind(manager)
  if (originalLoot) {
    manager.lootCaravan = caravan => {
      ensureCaravanCargo(caravan)
      return originalLoot(caravan)
    }
  }

  const escort = manager.escortAI
  if (escort) {
    // CaravanManager calls updateGuardNameplate, while the escort class originally exposes
    // updateGuardHPBar. This alias fixes the old "hits do not damage guards" interruption.
    escort.updateGuardNameplate = guard => escort.updateGuardHPBar?.(guard)

    const melee = escort.executeGuardAttack?.bind(escort)
    if (melee) {
      escort.executeGuardAttack = (guard, threat, speedMult = 1) => {
        if (threat !== game.player) return melee(guard, threat, speedMult)
        guard.attackCooldown = 1.1 * speedMult
        const dealt = game.damagePlayer?.(guard.atk) ?? Math.max(1, Number(guard.atk) || 1)
        game.toast?.(`⚔️ ${guard.name} atingiu você por ${dealt} de dano!`)
        game.spawnAbilityRing?.(0xef4444, 1.6, 0.3)
        if ((game.state?.hp || 0) <= 0) game.respawnPlayerAt?.(guard.caravan?.originCityId || 'aurora-city')
        return dealt
      }
    }

    const ranged = escort.executeGuardRangedAttack?.bind(escort)
    if (ranged) {
      escort.executeGuardRangedAttack = (guard, threat) => {
        if (threat !== game.player) return ranged(guard, threat)
        guard.shootCooldown = 1.8
        const targetPos = game.player?.position
        if (targetPos && game.spawnProjectile) game.spawnProjectile(guard.mesh.position, targetPos, guard.cls?.id === 'mage' ? 'arcane' : 'arrow')
        const dealt = game.damagePlayer?.(guard.atk) ?? Math.max(1, Number(guard.atk) || 1)
        game.toast?.(`🏹 ${guard.name} disparou contra você: -${dealt} HP!`)
        return dealt
      }
    }
  }
}

function patchTrialDom(game) {
  if (typeof document === 'undefined') return
  const box = document.querySelector('.oath-objectives')
  if (!box) return
  const quest = game?.state?.quests?.find?.(q => q.id === 'rider_oath')
  if (!quest) return
  const objective = box.querySelector('.oath-counter span')
  const count = box.querySelector('.oath-counter strong')
  const fill = box.querySelector('.bar .questbar')
  if (objective && objective.textContent !== 'Eliminar 5 bosses do mapa:') objective.textContent = 'Eliminar 5 bosses do mapa:'
  const progress = quest.status === 'done' ? 5 : Math.min(5, Number(quest.progress) || 0)
  const expectedCount = `${progress} / 5`
  if (count && count.textContent !== expectedCount) count.textContent = expectedCount
  if (fill) fill.style.width = `${Math.min(100, progress / 5 * 100)}%`
}

function ensureWeaponFamilies(stock = [], game, cycle) {
  const zoneId = game?.currentMerchantZoneId || game?.state?.zoneId || 'aurora'
  const level = Math.max(1, Number(game?.state?.level) || 1)
  const rarity = level >= 140 ? 'Épica' : level >= 70 ? 'Rara' : level >= 25 ? 'Incomum' : 'Comum'
  const families = [
    ['sword', 'Espada do Arsenal'],
    ['bow', 'Arco do Arsenal'],
    ['dagger', 'Adaga do Arsenal'],
    ['spellbook', 'Cetro Arcano do Arsenal'],
    ['axe', 'Machado de Guerra do Arsenal'],
  ]
  const result = [...stock]
  for (const [subtype, name] of families) {
    if (result.some(item => item?.type === 'weapon' && item?.subtype === subtype)) continue
    const item = makeItem('weapon', level, rarity, `${name} Nv.${level}`, subtype)
    result.push({
      ...item,
      id: `shop-requested-${cycle}-${zoneId}-${subtype}`,
      zoneId,
      value: Math.max(1, Math.round(item.value * 1.08)),
    })
  }
  return result
}

function ensureMerchantResources(stock = [], game, cycle) {
  const zoneId = game?.currentMerchantZoneId || game?.state?.zoneId || 'aurora'
  const result = [...stock]
  const resources = [makeResourceDrop('wood', 4), makeResourceDrop('coal', 4), makeResourceDrop('iron', 3)]
  for (const resource of resources) {
    if (result.some(item => item?.type === resource.type && item?.subtype === resource.subtype)) continue
    result.push({
      ...resource,
      id: `shop-resource-${cycle}-${zoneId}-${resource.subtype}`,
      zoneId,
      value: Math.max(1, Math.round((resource.value || 10) * 1.35)),
    })
  }
  return result
}

function comprehensiveShopStock(game, kind) {
  const info = shopRefreshInfo()
  const all = merchantStock(
    game.state.level,
    game.currentMerchantZoneMin || 1,
    info.cycle,
    'all',
    game.currentMerchantZoneId || 'aurora',
    game.currentMerchantZoneMax || 300,
  )
  let stock = ensureWeaponFamilies(all, game, info.cycle)
  stock = ensureMerchantResources(stock, game, info.cycle)
  if (kind === 'blacksmith') {
    stock = stock.filter(item => ['weapon', 'armor', 'boots', 'talisman', 'tool'].includes(item.type))
  }
  return { info, stock }
}

function installMerchantCoverage(game) {
  const originalRefresh = game.refreshShop?.bind(game)
  if (!originalRefresh) return
  game.refreshShop = function patchedRefreshShop(kind = this.state.uiPanel) {
    const result = originalRefresh(kind)
    if (kind === 'merchant' || kind === 'blacksmith' || this.state.uiPanel === 'merchant' || this.state.uiPanel === 'blacksmith') {
      const actualKind = kind === 'blacksmith' || this.state.uiPanel === 'blacksmith' ? 'blacksmith' : 'merchant'
      const { info, stock } = comprehensiveShopStock(this, actualKind)
      this.state.shopRefresh = info
      this.state.merchant = stock
    }
    return result
  }
}

function itemCategory(item) {
  if (!item) return 'other'
  if (item.type === 'weapon') return 'weapons'
  if (['armor', 'boots', 'talisman'].includes(item.type)) return 'armor'
  if (item.type === 'tool' || ['axe', 'pickaxe'].includes(item.subtype)) return 'tools'
  if (item.type === 'consumable' || ['potion', 'grimoire', 'pet_food'].includes(item.subtype)) return 'consumables'
  if (item.type === 'material' || item.type === 'resource' || ['monster-drop', 'wood', 'coal', 'iron', 'fish'].includes(item.subtype)) return 'drops'
  return 'other'
}

function applyMerchantDomFilter(game) {
  if (typeof document === 'undefined') return
  const root = document.querySelector('.merchant-modern')
  if (!root) return
  const custom = root.dataset.requestedCategory
  if (!custom) return
  const mode = root.querySelector('.merchant-mode-tabs button.active')?.textContent?.includes('VENDER') ? 'sell' : 'buy'
  const source = mode === 'sell' ? (game.state?.inventory || []) : (game.state?.merchant || [])
  const cards = [...root.querySelectorAll('.merchant-grid-list .merchant-card')]
  for (const card of cards) {
    const name = card.querySelector('.mc-name')?.textContent?.trim()
    const item = source.find(entry => entry?.name === name)
    card.style.display = itemCategory(item) === custom ? '' : 'none'
  }
  const empty = root.querySelector('.merchant-empty')
  const visible = cards.some(card => card.style.display !== 'none')
  if (empty) empty.style.display = visible ? 'none' : ''
}

function patchMerchantCategoryDom(game) {
  if (typeof document === 'undefined') return
  const root = document.querySelector('.merchant-modern')
  if (!root) return
  const modeButtons = [...root.querySelectorAll('.merchant-mode-tabs button')]
  for (const btn of modeButtons) {
    if (btn.dataset.requestedResetInstalled) continue
    btn.dataset.requestedResetInstalled = '1'
    btn.addEventListener('click', () => { root.dataset.requestedCategory = '' })
  }

  const tabs = root.querySelector('.shop-category-tabs')
  if (!tabs) return
  const activeMode = root.querySelector('.merchant-mode-tabs button.active')?.textContent?.includes('VENDER') ? 'sell' : 'buy'

  // Keep the wording and category set aligned with the inventory.
  for (const button of tabs.querySelectorAll('button')) {
    const text = button.textContent || ''
    if (/^Drops$/i.test(text.replace(/^[^A-Za-zÀ-ÿ]+/, '').trim())) button.textContent = '🐟 Drops & Recursos'
    if (!button.dataset.requestedResetInstalled) {
      button.dataset.requestedResetInstalled = '1'
      button.addEventListener('click', () => { root.dataset.requestedCategory = '' })
    }
  }

  const wanted = activeMode === 'buy'
    ? { category: 'drops', label: '🐟 Drops & Recursos' }
    : { category: 'consumables', label: '🧪 Consumíveis' }
  let custom = tabs.querySelector(`button[data-requested-category="${wanted.category}"]`)
  if (!custom) {
    custom = document.createElement('button')
    custom.type = 'button'
    custom.dataset.requestedCategory = wanted.category
    custom.textContent = wanted.label
    custom.addEventListener('click', event => {
      event.preventDefault()
      event.stopPropagation()
      const all = [...tabs.querySelectorAll('button')].find(button => !button.dataset.requestedCategory && /^Todos/i.test((button.textContent || '').trim()))
      all?.click()
      root.dataset.requestedCategory = wanted.category
      window.setTimeout(() => {
        for (const b of tabs.querySelectorAll('button')) b.classList.remove('active')
        custom.classList.add('active')
        applyMerchantDomFilter(game)
      }, 0)
    })
    tabs.appendChild(custom)
  }
  custom.textContent = wanted.label
  applyMerchantDomFilter(game)
}

function patchBlacksmithArmorDom(game) {
  if (typeof document === 'undefined') return
  const list = document.querySelector('.window-blacksmith .smith-stock.shop-scroll-list') || document.querySelector('.smith-stock.shop-scroll-list')
  if (!list) return
  const extras = (game.state?.merchant || []).filter(item => ['boots', 'talisman'].includes(item.type))
  let section = list.querySelector('.requested-smith-armor-extra')
  if (!extras.length) {
    section?.remove()
    return
  }
  if (!section) {
    section = document.createElement('div')
    section.className = 'requested-smith-armor-extra'
    section.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.12)'
    list.appendChild(section)
  }
  section.innerHTML = '<small style="color:#94a3b8;font-weight:800;letter-spacing:.06em">BOTAS • ARMADURAS • TALISMÃS</small>'
  for (const item of extras) {
    const row = document.createElement('article')
    row.className = 'shop-scroll-card requested-extra-card'
    row.style.setProperty('--rarity', item.color || '#94a3b8')
    row.innerHTML = `<div class="item-card compact" style="--rarity:${item.color || '#94a3b8'}"><div class="item-orb">${item.type === 'boots' ? '⬒' : '✦'}</div><b>${item.name}</b><small style="color:${item.color || '#94a3b8'}">${item.rarity || 'Comum'} • Nv.${item.level || 1}</small><span>${item.stats?.defense ? `+${Math.round(item.stats.defense)} DEF` : item.type === 'boots' ? 'Botas' : 'Talismã'}</span></div>`
    const buy = document.createElement('button')
    buy.type = 'button'
    buy.disabled = (game.state?.gold || 0) < (item.value || 0)
    buy.textContent = `Comprar • ${item.value || 0}◈`
    buy.addEventListener('click', () => game.buyItem?.(item.id))
    row.appendChild(buy)
    section.appendChild(row)
  }
}

function patchGuildPanelDom(game) {
  if (typeof document === 'undefined') return
  const card = document.querySelector('.window-guild .guild-rank-card') || document.querySelector('.guild-layout .guild-rank-card')
  if (!card) return
  const status = earlyGuildPromotionStatus(game.state)
  let button = card.querySelector('.requested-early-rank-btn')
  if (!status.next || !status.oneLevelEarly) {
    button?.remove()
    return
  }
  if (!button) {
    button = document.createElement('button')
    button.type = 'button'
    button.className = 'requested-early-rank-btn'
    button.style.cssText = 'width:100%;margin-top:10px;padding:9px 10px;border-radius:9px;border:1px solid #facc15;background:rgba(250,204,21,.12);color:#fde68a;font-weight:900;cursor:pointer'
    button.addEventListener('click', () => game.promoteGuildEarly?.())
    card.appendChild(button)
  }
  button.disabled = !status.eligible
  button.style.cursor = status.eligible ? 'pointer' : 'not-allowed'
  button.style.opacity = status.eligible ? '1' : '.65'
  button.textContent = status.eligible
    ? `⭐ Subir cedo para Rank ${status.next.id} • +${status.bonusXp} XP +${status.bonusGold}◈`
    : `Promoção antecipada Rank ${status.next.id}: faltam ${status.missingGuildPoints} XP da Guilda`
}

export function installRequestedGameplayFixes(game) {
  if (!game || game.__requestedGameplayFixesInstalled) return false
  game.__requestedGameplayFixesInstalled = true
  normalizeRequestedTrials(game)
  if (Array.isArray(game.state?.inventory)) game.state.inventory = game.state.inventory.map(applyUniqueMobDrop)
  installMerchantCoverage(game)
  patchCaravans(game)

  game.guildEarlyPromotionStatus = () => earlyGuildPromotionStatus(game.state)
  game.promoteGuildEarly = () => {
    const status = earlyGuildPromotionStatus(game.state)
    if (!status.next) {
      game.toast?.('Você já está no Rank máximo da Guilda.')
      return null
    }
    if (!status.oneLevelEarly) {
      game.toast?.(`Promoção antecipada disponível somente no Nv.${Math.max(1, status.next.minLevel - 1)}.`)
      return null
    }
    if (!status.eligible) {
      game.toast?.(`Faltam ${status.missingGuildPoints} XP da Guilda para subir cedo ao Rank ${status.next.id}.`)
      return null
    }
    return promoteGuildEarly(game)
  }

  const originalAddInventoryItem = game.addInventoryItem?.bind(game)
  if (originalAddInventoryItem) game.addInventoryItem = item => originalAddInventoryItem(applyUniqueMobDrop(item))

  const originalDamageEnemy = game.damageEnemy?.bind(game)
  if (originalDamageEnemy) {
    game.damageEnemy = (target, amount, options = {}) => {
      if (target?.isCaravanGuard || target?.isCaravanCart || target?.adventurer) return originalDamageEnemy(target, amount, options)
      return originalDamageEnemy(target, balancedAttackInput(amount, target), options)
    }
  }

  // Normal rank-ups still refresh the board immediately. Early promotion itself is manual
  // via the guild panel button, matching the requested "pode upar de rank" behavior.
  const originalGainXp = game.gainXp?.bind(game)
  if (originalGainXp) {
    game.gainXp = (amount, ...args) => {
      const beforeRank = Number(game.state?.guildRankIndex) || 0
      const result = originalGainXp(Math.max(0, Number(amount) || 0), ...args)
      const afterRank = Number(game.state?.guildRankIndex) || 0
      if (afterRank !== beforeRank) {
        game.state.guildMissionCycle = null
        refreshGuildBoard(game.state)
        maintainEarlyRankContractAccess(game)
        game.saveGame?.()
      }
      return result
    }
  }

  const originalTryTame = game.tryTamePet?.bind(game)
  if (originalTryTame) {
    game.tryTamePet = enemy => {
      const ok = originalTryTame(enemy)
      if (ok) {
        const pet = enrichPet(game.activePet?.())
        if (pet) game.saveGame?.()
      }
      return ok
    }
  }

  for (const pet of game.state?.pets?.owned || []) enrichPet(pet)

  const originalPetAttack = game.petAttackTarget?.bind(game)
  if (originalPetAttack) {
    game.petAttackTarget = enemy => {
      const pet = enrichPet(game.activePet?.())
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
      const specialDue = !!pet && (Number(pet.nextSpecialAt) || 0) <= now
      const result = originalPetAttack(enemy)
      if (specialDue && pet && enemy && !enemy.dead && Number(enemy.hp) > 0) {
        pet.nextSpecialAt = now + 5200
        const profile = petPowerProfile(pet.name)
        const specialDamage = Math.max(1, Math.round((Number(pet.damage) || 1) * profile.multiplier))
        const nearby = profile.radius > 2.5
          ? (game.enemies || []).filter(e => !e.dead && e.g?.visible && e.g.position.distanceTo(enemy.g.position) <= profile.radius)
          : [enemy]
        const targets = nearby.length ? nearby : [enemy]
        const seen = new Set()
        for (const target of targets) {
          if (!target || seen.has(target) || target.dead) continue
          seen.add(target)
          game.damageEnemy?.(target, specialDamage, { knockback: 0.25, fromPet: true })
        }
        game.spawnAbilityRing?.(profile.color, profile.radius, 0.4)
      }
      return result
    }
  }

  const originalUpdatePets = game.updatePets?.bind(game)
  if (originalUpdatePets) {
    game.updatePets = dt => {
      const pet = enrichPet(game.activePet?.())
      if (pet && Number(pet.recoverUntil) > 0 && Number(pet.recoverUntil) <= Date.now()) {
        pet.recoverUntil = 0
        pet.hp = Math.max(1, Number(pet.maxHp) || 1)
        pet.nextHurtAt = 0
        game.petTarget = null
        game.petVisualKey = ''
        game.toast?.(`🐾 ${pet.name} se recuperou e voltou com a vida cheia!`)
        game.saveGame?.()
      }
      return originalUpdatePets(dt)
    }
  }

  const originalOnHud = game.onHud
  if (typeof originalOnHud === 'function') {
    game.onHud = hud => {
      normalizeRequestedTrials(game)
      maintainEarlyRankContractAccess(game)
      return originalOnHud(hud)
    }
  }

  const uiTimer = typeof window !== 'undefined' ? window.setInterval(() => {
    if (window.game !== game) {
      window.clearInterval(uiTimer)
      return
    }
    patchTrialDom(game)
    patchCaravans(game)
    patchGuildPanelDom(game)
    patchMerchantCategoryDom(game)
    patchBlacksmithArmorDom(game)
  }, 350) : null
  game.__requestedGameplayUiTimer = uiTimer
  return true
}

function installWhenReady() {
  if (typeof window === 'undefined') return
  if (window.game) {
    installRequestedGameplayFixes(window.game)
    return
  }
  const timer = window.setInterval(() => {
    if (!window.game) return
    window.clearInterval(timer)
    installRequestedGameplayFixes(window.game)
  }, 100)
  window.setTimeout(() => window.clearInterval(timer), 60000)
}

installWhenReady()
