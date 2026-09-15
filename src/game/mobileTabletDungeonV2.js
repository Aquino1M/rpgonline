// Mobile/Tablet + Dungeon runtime hardening V2
// Loaded after legacy gameplay patches and before App.jsx.
// Keeps the existing game systems and only patches the problematic integration seams.
import { ShadowGame } from './engine.js'
import { GateManager } from './dungeons/GateManager.js'

const PATCH = '__mobileTabletDungeonAuditV2'
const LEGACY = '__legacyDungeonDecorationV2'

function modernDungeon(game) {
  return !!(game?.state?.dungeon && game?.gateManager?.activeInstance)
}

function arenaData(game) {
  return game?.gateManager?.activeInstance?.floorData?.arena || null
}

function insideArena(game, x, z, padding = 0) {
  const arena = arenaData(game)
  if (!arena) return true
  const rx = Math.max(4, Number(arena.radiusX || 38) - 1.7 - padding)
  const rz = Math.max(4, Number(arena.radiusZ || 31) - 1.7 - padding)
  return (x * x) / (rx * rx) + (z * z) / (rz * rz) <= 1
}

function syncUiScale(game) {
  if (typeof document === 'undefined') return
  const raw = Math.max(.85, Math.min(2, Number(game?.settings?.uiScale) || 1.2))
  // Keep the user's 85%-200% setting meaningful, but cap the adaptive multiplier so
  // a phone in landscape never loses essential controls outside the viewport.
  const shortSide = typeof window !== 'undefined' ? Math.min(window.innerWidth || 0, window.innerHeight || 0) : 0
  const deviceBoost = shortSide >= 700 ? 1.12 : 1
  const k = Math.max(.72, Math.min(1.45, (raw / 1.2) * deviceBoost))
  const root = document.documentElement
  const app = document.querySelector('.app')
  const set = (name, value) => {
    root?.style?.setProperty(name, String(value))
    app?.style?.setProperty(name, String(value))
  }
  set('--user-ui-scale', raw)
  set('--touch-user-scale', raw)
  set('--touch-k', k)
  set('--t-gutter', `${Math.round(9 * k)}px`)
  set('--t-hud-w', `${Math.round(214 * k)}px`)
  set('--t-mini-w', `${Math.max(170, Math.round(205 * k))}px`)
  set('--t-stick', `${Math.round(112 * k)}px`)
  set('--t-stick-knob', `${Math.round(46 * k)}px`)
  set('--t-action', `${Math.max(58, Math.round(64 * k))}px`)
  set('--t-attack', `${Math.max(58, Math.round(64 * k))}px`)
  set('--t-action-gap', `${Math.max(10, Math.round(12 * k))}px`)
  set('--t-power', `${Math.round(52 * k)}px`)
  set('--t-menu', `${Math.max(48, Math.round(52 * k))}px`)
  set('--t-menu-cell', `${Math.round(58 * k)}px`)
  set('--t-hit', `${Math.max(40, Math.round(44 * k))}px`)
  set('--t-font', `${Math.max(12, Math.round(13 * k))}px`)
  set('--t-small', `${Math.max(10, Math.round(11 * k))}px`)
  set('--t-title', `${Math.max(16, Math.round(18 * k))}px`)
  set('--t-window-pad', `${Math.max(8, Math.round(12 * k))}px`)
}

function markLegacyDungeonDecor(game) {
  const root = game?.dungeonArena
  if (!root) return
  for (const child of root.children || []) {
    if (!child.userData?.__modernDungeonDynamic) {
      child.userData ||= {}
      child.userData[LEGACY] = true
    }
  }
}

function enableModernDungeonRoot(game) {
  const root = game?.dungeonArena
  if (!root || !modernDungeon(game)) return
  root.visible = true
  for (const child of root.children || []) {
    if (child.userData?.[LEGACY]) child.visible = false
  }
}

function restoreLegacyDungeonRoot(game) {
  const root = game?.dungeonArena
  if (!root) return
  for (const child of root.children || []) {
    if (child.userData?.[LEGACY]) child.visible = false
  }
  root.visible = false
}

function preChaseDungeonMobs(game, dt) {
  if (!modernDungeon(game) || !game?.player) return
  enableModernDungeonRoot(game)
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const round = Math.max(1, Number(game.gateManager?.activeInstance?.currentRound) || 1)

  for (const mob of game.enemies || []) {
    if (!mob || mob.dead || !mob.isDungeonMob || !mob.g) continue
    mob.g.visible = true
    if (mob.g.parent === game.dungeonArena) {
      mob.g.userData ||= {}
      mob.g.userData.__modernDungeonDynamic = true
    }
    if ((mob.dungeonAwakeAt || 0) > now) continue

    const px = game.player.position.x
    const pz = game.player.position.z
    const dx = px - mob.g.position.x
    const dz = pz - mob.g.position.z
    const d = Math.hypot(dx, dz)

    // The legacy enemy AI only aggroes below 16 units. Coliseum spawns are 20-32u away,
    // so move them toward the player until the original combat AI can take over.
    if (d > 14.75) {
      const nx = dx / Math.max(.001, d)
      const nz = dz / Math.max(.001, d)
      const speed = (mob.boss ? 2.55 : 3.15) + Math.min(1.05, round * .10)
      const step = Math.min(Math.max(0, d - 14.45), speed * Math.max(0, dt || 0))
      const nextX = mob.g.position.x + nx * step
      const nextZ = mob.g.position.z + nz * step
      if (insideArena(game, nextX, nextZ, mob.boss ? 1.2 : .6)) {
        mob.g.position.x = nextX
        mob.g.position.z = nextZ
      }
      mob.g.rotation.y = Math.atan2(nx, nz)
    }
  }
}

function installTouchClickBridge() {
  if (typeof window === 'undefined' || typeof document === 'undefined' || window.__shadowTouchClickBridgeV2) return
  window.__shadowTouchClickBridgeV2 = true
  const presses = new Map()
  const scopeSelector = '.window button, .mobile-menu-drawer button, .mobile-menu-toggle, .mobile-prominent-action'

  document.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return
    const button = e.target?.closest?.('button')
    if (!button || button.disabled || !button.matches(scopeSelector)) return
    presses.set(e.pointerId, {
      button,
      x: e.clientX,
      y: e.clientY,
      started: typeof performance !== 'undefined' ? performance.now() : Date.now(),
      nativeClick: false
    })
  }, true)

  document.addEventListener('click', e => {
    for (const rec of presses.values()) {
      if (rec.button === e.target || rec.button?.contains?.(e.target)) rec.nativeClick = true
    }
  }, true)

  const finish = e => {
    const rec = presses.get(e.pointerId)
    if (!rec) return
    if (e.type === 'pointercancel' || rec.button.disabled || !document.contains(rec.button)) {
      presses.delete(e.pointerId)
      return
    }
    const moved = Math.hypot(e.clientX - rec.x, e.clientY - rec.y)
    const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - rec.started
    if (moved > 16 || elapsed > 900) {
      presses.delete(e.pointerId)
      return
    }

    // Some Android/iPad WebViews cancel the delayed click inside overflow containers.
    // Keep the record alive briefly so the normal click can mark it as delivered.
    setTimeout(() => {
      if (!rec.nativeClick && !rec.button.disabled && document.contains(rec.button)) rec.button.click()
      presses.delete(e.pointerId)
    }, 90)
  }
  document.addEventListener('pointerup', finish, true)
  document.addEventListener('pointercancel', finish, true)
}

function patchShadowGame() {
  const p = ShadowGame?.prototype
  if (!p || p[PATCH]) return
  Object.defineProperty(p, PATCH, { value: true, configurable: false })

  // GateManager owns dungeons now. Keeping the retired portal route allowed its
  // old arena decor to be revived in the open world after returning from a gate.
  p.seedPortals = function disableLegacyPortalsV2() { this.portals = [] }

  if (typeof p.init === 'function') {
    const prev = p.init
    p.init = function mobileTabletInitV2(...args) {
      const result = prev.apply(this, args)
      syncUiScale(this)
      return result
    }
  }

  if (typeof p.applySettings === 'function') {
    const prev = p.applySettings
    p.applySettings = function mobileTabletApplySettingsV2(...args) {
      const result = prev.apply(this, args)
      syncUiScale(this)
      return result
    }
  }

  if (typeof p.emitHud === 'function') {
    const prev = p.emitHud
    p.emitHud = function mobileTabletEmitHudV2(...args) {
      const raw = Number(this?.settings?.uiScale) || 1.2
      if (this.__lastTouchUiScaleV2 !== raw) {
        this.__lastTouchUiScaleV2 = raw
        syncUiScale(this)
      }
      return prev.apply(this, args)
    }
  }

  if (typeof p.createDungeonArena === 'function') {
    const prev = p.createDungeonArena
    p.createDungeonArena = function mobileTabletCreateDungeonArenaV2(...args) {
      const result = prev.apply(this, args)
      markLegacyDungeonDecor(this)
      return result
    }
  }

  if (typeof p.makeEnemy === 'function') {
    const prev = p.makeEnemy
    p.makeEnemy = function mobileTabletMakeEnemyV2(...args) {
      const enemy = prev.apply(this, args)
      if (modernDungeon(this) && enemy?.g) {
        enableModernDungeonRoot(this)
        enemy.g.visible = true
        enemy.g.userData ||= {}
        enemy.g.userData.__modernDungeonDynamic = true
      }
      return enemy
    }
  }

  if (typeof p.isInsideCitySafeZone === 'function') {
    const prev = p.isInsideCitySafeZone
    p.isInsideCitySafeZone = function mobileTabletSafeZoneV2(...args) {
      // Modern dungeon coordinates are centered near the open-world city origin.
      // The open-world safe-zone check must never suppress dungeon damage.
      if (modernDungeon(this)) return false
      return prev.apply(this, args)
    }
  }

  if (typeof p.cityAt === 'function') {
    const prev = p.cityAt
    p.cityAt = function mobileTabletCityAtV2(...args) {
      if (modernDungeon(this)) return null
      return prev.apply(this, args)
    }
  }

  if (typeof p.canOccupy === 'function') {
    const prev = p.canOccupy
    p.canOccupy = function mobileTabletCanOccupyV2(x, z, radius = .55) {
      if (modernDungeon(this)) return insideArena(this, Number(x) || 0, Number(z) || 0, Number(radius) || 0)
      return prev.call(this, x, z, radius)
    }
  }

  if (typeof p.moveWithCollisions === 'function') {
    const prev = p.moveWithCollisions
    p.moveWithCollisions = function mobileTabletMoveDungeonV2(delta) {
      if (!modernDungeon(this)) return prev.call(this, delta)
      const pos = this.player?.position
      if (!pos || !delta) return
      const nx = pos.x + (delta.x || 0)
      const nz = pos.z + (delta.z || 0)
      if (insideArena(this, nx, nz, this.state?.mount?.active ? .85 : .55)) {
        pos.x = nx
        pos.z = nz
        return
      }
      if (insideArena(this, nx, pos.z, .55)) pos.x = nx
      if (insideArena(this, pos.x, nz, .55)) pos.z = nz
    }
  }

  if (typeof p.updateEnemies === 'function') {
    const prev = p.updateEnemies
    p.updateEnemies = function mobileTabletUpdateEnemiesV2(dt, t) {
      preChaseDungeonMobs(this, dt)
      return prev.call(this, dt, t)
    }
  }

  if (typeof p.setWorldVisible === 'function') {
    const prev = p.setWorldVisible
    p.setWorldVisible = function mobileTabletSetWorldVisibleV2(visible) {
      const result = prev.call(this, visible)
      if (visible && !this.state?.dungeon) restoreLegacyDungeonRoot(this)
      return result
    }
  }

  if (typeof p.spawnAbilityRing === 'function') {
    const prev = p.spawnAbilityRing
    p.spawnAbilityRing = function mobileTabletAbilityRingV2(...args) {
      if (modernDungeon(this)) enableModernDungeonRoot(this)
      const ring = prev.apply(this, args)
      if (modernDungeon(this) && ring) {
        ring.visible = true
        ring.userData ||= {}
        ring.userData.__modernDungeonDynamic = true
      }
      return ring
    }
  }

  if (typeof p.kill === 'function') {
    const prev = p.kill
    p.kill = function mobileTabletKillV2(enemy, ...args) {
      const parent = enemy?.g?.parent || null
      const result = prev.call(this, enemy, ...args)
      if (enemy?.dead && parent && enemy?.g?.parent === parent) parent.remove(enemy.g)
      return result
    }
  }
}

function patchGateManager() {
  const p = GateManager?.prototype
  if (!p || p[PATCH]) return
  Object.defineProperty(p, PATCH, { value: true, configurable: false })

  if (typeof p.loadDungeonArena === 'function') {
    const prev = p.loadDungeonArena
    p.loadDungeonArena = function mobileTabletLoadDungeonArenaV2(...args) {
      const result = prev.apply(this, args)
      enableModernDungeonRoot(this.game)
      const scene = this.game?.scene
      if (scene?.fog) {
        // Keep the huge coliseum readable on mobile/tablet instead of burying the stands in fog.
        scene.fog.near = Math.max(24, Number(scene.fog.near) || 24)
        scene.fog.far = Math.max(96, Number(scene.fog.far) || 96)
      }
      if (this.game?.renderer) this.game.renderer.toneMappingExposure = Math.max(1.12, Number(this.game.renderer.toneMappingExposure) || 1.12)
      return result
    }
  }

  if (typeof p.spawnRoundMobs === 'function') {
    const prev = p.spawnRoundMobs
    p.spawnRoundMobs = function mobileTabletSpawnRoundMobsV2(roundNumber, ...args) {
      const result = prev.call(this, roundNumber, ...args)
      const inst = this.activeInstance
      if (!inst || !inst.floorData) return result

      const rankBonus = { E: 0, D: 1, C: 2, B: 3, A: 4, S: 5 }[inst.rank] || 0
      const target = Math.min(22, 4 + Math.max(1, roundNumber) * 2 + rankBonus)
      const alive = () => (this.game.enemies || []).filter(e => !e.dead && e.isDungeonMob && !e.isDungeonBoss)
      let current = alive().length
      const arena = inst.floorData.arena
      const theme = inst.floorData.theme
      const wakeAt = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + (roundNumber === 1 ? 1600 : 550)

      // Existing GateManager already grows 4 + round*2. Add rank pressure only when needed,
      // while keeping a mobile-safe cap and always spawning on the perimeter.
      for (let i = current; i < target; i++) {
        const angle = (i / Math.max(1, target)) * Math.PI * 2 + (roundNumber % 2) * .19
        const rx = Number(arena?.mobSpawnRadiusX || 30)
        const rz = Number(arena?.mobSpawnRadiusZ || 24)
        const x = Math.cos(angle) * rx
        const z = Math.sin(angle) * rz
        const names = theme?.mobs?.length ? theme.mobs : ['Guardião da Arena']
        const mobName = names[(i + roundNumber) % names.length]
        const mob = this.game.makeEnemy(
          x,
          z,
          inst.level + Math.floor(roundNumber * .8),
          mobName,
          false,
          null,
          null,
          `dungeon_extra_r${roundNumber}_${i}_${Date.now()}`
        )
        mob.isDungeonMob = true
        mob.dungeonAwakeAt = wakeAt
        mob.g.visible = true
        this.game.enemies.push(mob)
      }

      for (const mob of alive()) {
        mob.dungeonAwakeAt = Math.max(mob.dungeonAwakeAt || 0, wakeAt)
        mob.g.visible = true
      }

      inst.roundMobTarget = Math.max(target, alive().length)
      if (this.game.state?.dungeon) this.game.state.dungeon.waveTarget = inst.roundMobTarget
      enableModernDungeonRoot(this.game)
      return result
    }
  }

  if (typeof p.spawnBossRound === 'function') {
    const prev = p.spawnBossRound
    p.spawnBossRound = function mobileTabletSpawnBossRoundV2(...args) {
      const result = prev.apply(this, args)
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + 850
      for (const mob of this.game?.enemies || []) {
        if (mob.isDungeonBoss || (mob.boss && mob.isDungeonMob)) {
          mob.dungeonAwakeAt = now
          if (mob.g) mob.g.visible = true
        }
      }
      enableModernDungeonRoot(this.game)
      return result
    }
  }

  if (typeof p.leaveDungeon === 'function') {
    const prev = p.leaveDungeon
    p.leaveDungeon = function mobileTabletLeaveDungeonV2(...args) {
      const result = prev.apply(this, args)
      restoreLegacyDungeonRoot(this.game)
      if (this.game?.renderer) this.game.renderer.toneMappingExposure = 1.05
      return result
    }
  }
}

installTouchClickBridge()
patchShadowGame()
patchGateManager()

export { syncUiScale }
