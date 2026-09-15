// GateManager.js - Global Gate & Dungeon lifecycle manager (spawns, 3D gates, Ready Check, instances, floors)
import * as THREE from 'three'
import { GATE_RANKS, DUNGEON_THEMES, DUNGEON_MODIFIERS, DUNGEON_BOSSES } from './DungeonConfig.js'
import { DungeonGenerator } from './DungeonGenerator.js'
import { DungeonBossAI } from './DungeonBossAI.js'
import { DungeonRewards } from './DungeonRewards.js'
import { progressGuildMissions, progressQuest, updateGuildRank } from '../rpgSystems.js'

const GLOBAL_GATE_PERIOD_MS = 30 * 60 * 1000
const GLOBAL_GATE_SLOTS = [
  { rankKey:'E', x:120, z:90 }, { rankKey:'D', x:-170, z:80 },
  { rankKey:'C', x:210, z:-170 }, { rankKey:'B', x:-260, z:-130 }
]
const gateRoll = seed => Math.abs(Math.sin(seed * 12.9898) * 43758.5453) % 1

export class GateManager {
  constructor(game) {
    this.game = game
    this.generator = new DungeonGenerator()
    this.bossAI = new DungeonBossAI(game)
    this.activeGates = []
    this.activeInstance = null
    this.globalCycle = null
    this.closedGateIds = new Set()
  }

  init() {
    this.spawnInitialGates()
  }

  spawnInitialGates() {
    this.globalCycle = Math.floor(Date.now() / GLOBAL_GATE_PERIOD_MS)
    for (let slot = 0; slot < GLOBAL_GATE_SLOTS.length; slot++) {
      const base = GLOBAL_GATE_SLOTS[slot]
      const id = `global-gate-${this.globalCycle}-${slot}`
      if (!this.closedGateIds.has(id)) this.spawnGate({ rankKey: base.rankKey, pos:{x:base.x,z:base.z}, silent:true, shared:{cycle:this.globalCycle,slot} })
    }
    this.syncGatesToState()
  }

  update(dt, t) {
    const cycle = Math.floor(Date.now() / GLOBAL_GATE_PERIOD_MS)
    if (cycle !== this.globalCycle) {
      for (const gate of this.activeGates) gate.mesh?.parent?.remove?.(gate.mesh)
      this.activeGates = []
      this.closedGateIds.clear()
      this.spawnInitialGates()
    }

    const now = Date.now()
    for (let i = this.activeGates.length - 1; i >= 0; i--) {
      const gate = this.activeGates[i]
      
      // Update visual animations
      if (gate.mesh && gate.mesh.visible) {
        if (gate.ring) gate.ring.rotation.z += 0.012 * (gate.rankConfig.id === 'S' ? 2.2 : 1.0)
        if (gate.core) gate.core.rotation.z -= 0.007
        if (gate.particles) {
          for (let p = 0; p < gate.particles.length; p++) {
            const pt = gate.particles[p]
            const angle = t * 1.8 + pt.userData.phase
            const r = pt.userData.radius || 1.6
            pt.position.set(Math.cos(angle) * r, 1.8 + Math.sin(angle * 1.4) * 0.8, Math.sin(angle) * 0.3)
          }
        }
      }

      // Check expiration
      if (gate.state === 'ACTIVE' && now >= gate.expiresAt) {
        this.expireGate(gate, i)
      }
    }

    // Update active dungeon instance if player is inside
    if (this.activeInstance) {
      this.updateInstance(dt, t)
    }
  }

  spawnGate({ rankKey = 'C', pos = null, silent = false, shared = null }) {
    const rank = GATE_RANKS[rankKey] || GATE_RANKS.C
    const themes = Object.keys(DUNGEON_THEMES)
    const seed = shared ? shared.cycle * 31 + shared.slot * 17 + 7 : Math.random() * 999999
    const themeKey = themes[Math.floor(gateRoll(seed) * themes.length)]
    const theme = DUNGEON_THEMES[themeKey]

    // Find candidate position in world
    let p = pos
    if (!p) {
      p = this.findValidGateSpawn()
    }
    if (!p) return null

    const zone = this.game.zoneAt ? this.game.zoneAt(p.x, p.z, this.game.ZONES || []) : { name: 'Ermos de Asterra', id: 'wild' }
    const dungeonLevel = Math.round(rank.levelRange[0] + gateRoll(seed + 1) * (rank.levelRange[1] - rank.levelRange[0]))
    const totalRounds = Math.round((rank.rounds?.[0] || 3) + gateRoll(seed + 2) * ((rank.rounds?.[1] || 4) - (rank.rounds?.[0] || 3)))
    const totalFloors = totalRounds

    // Check for rare anomaly (Unstable Gate)
    const isUnstable = gateRoll(seed + 3) < 0.12
    const modifiers = []
    if (rankKey !== 'E' || isUnstable) {
      const mod = DUNGEON_MODIFIERS[Math.floor(gateRoll(seed + 4) * DUNGEON_MODIFIERS.length)]
      modifiers.push(mod)
    }

    const gateId = shared ? `global-gate-${shared.cycle}-${shared.slot}` : `gate_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const durationMs = (rank.lifetimeMinutes || 30) * 60000

    const gate = {
      id: gateId,
      seed: Math.floor(seed * 999999),
      x: p.x,
      z: p.z,
      zoneName: zone.name || 'Asterra',
      rankKey,
      rankConfig: rank,
      themeKey,
      theme,
      dungeonLevel,
      totalFloors,
      totalRounds,
      modifiers,
      isUnstable,
      state: 'ACTIVE',
      spawnedAt: shared ? shared.cycle * GLOBAL_GATE_PERIOD_MS : Date.now(),
      expiresAt: shared ? (shared.cycle + 1) * GLOBAL_GATE_PERIOD_MS : Date.now() + durationMs,
      shared: !!shared,
      name: `Portal Rank ${rankKey} — ${theme.name}${isUnstable ? ' [INSTÁVEL]' : ''}`
    }

    // Build 3D mesh in world
    const meshGroup = this.buildGate3D(gate)
    meshGroup.position.set(p.x, 0, p.z)
    this.game.worldRoot.add(meshGroup)
    gate.mesh = meshGroup

    this.activeGates.push(gate)
    this.game.clearWorldResourcesAround?.(gate.x, gate.z, 10)

    // Global announcement banner (only for runtime spawns, lasts strictly 3 seconds)
    if (!silent) {
      const isHighRank = rankKey === 'S' || rankKey === 'A'
      const title = isHighRank ? '🚨 EVENTO MUNDIAL — PRESENÇA PODEROSA DETECTADA' : '⚠ NOVA MASMORRA DETECTADA'
      this.game.toast?.(`${title}: ${gate.name} em ${gate.zoneName}!`)
      if (this.game.state) {
        this.game.state.gateAnnouncement = {
          id: gate.id,
          title,
          gateName: gate.name,
          rank: gate.rankKey,
          rankColor: gate.rankConfig.color,
          levelRange: `${gate.rankConfig.levelRange[0]}–${gate.rankConfig.levelRange[1]}`,
          zoneName: gate.zoneName,
          floors: gate.totalFloors,
          rounds: gate.totalRounds,
          x: gate.x,
          z: gate.z,
          expiresAt: gate.expiresAt,
          timestamp: Date.now()
        }
        this.game.emitHud?.()
        setTimeout(() => {
          if (this.game.state?.gateAnnouncement?.id === gate.id) {
            this.game.state.gateAnnouncement = null
            this.game.emitHud?.()
          }
        }, 3000)
      }
    }

    // Sync to state for Minimap / World Map markers
    this.syncGatesToState()

    return gate
  }

  getNearbyGate(dist = 4.8) {
    if (this.activeInstance || !this.game.player) return null
    const px = this.game.player.position.x
    const pz = this.game.player.position.z
    return this.activeGates.find(g => Math.hypot(g.x - px, g.z - pz) <= dist) || null
  }

  getInteractionPrompt() {
    if (this.activeInstance) {
      const inst = this.activeInstance
      const px = this.game.player.position.x
      const pz = this.game.player.position.z

      // Check chests
      if (inst.floorData?.chests) {
        for (const chest of inst.floorData.chests) {
          if (!chest.opened && Math.hypot(chest.x - px, chest.z - pz) < 3.2) {
            return {
              prompt: `E — Abrir ${chest.name || 'Baú de Masmorra'}`,
              action: { type: 'dungeon_chest', label: 'Abrir Baú', icon: '🎁', chest }
            }
          }
        }
      }

      // Check exit portal/stairs
      if (inst.floorData?.exitPos && !inst.floorData.isFinalFloor) {
        const d = Math.hypot(px - inst.floorData.exitPos.x, pz - inst.floorData.exitPos.z)
        if (d < 3.5) {
          const aliveEnemies = this.game.enemies.filter(e => !e.dead).length
          if (aliveEnemies > 0) {
            return {
              prompt: `⚠️ Derrote os inimigos restantes (${aliveEnemies}) para liberar o próximo andar`,
              action: { type: 'dungeon_exit_locked', label: 'Andar Bloqueado', icon: '🔒' }
            }
          }
          return {
            prompt: `E — Avançar para o Andar ${inst.currentFloor + 1}`,
            action: { type: 'dungeon_exit', label: `Andar ${inst.currentFloor + 1}`, icon: '🪜' }
          }
        }
      }

      return null
    }

    const gate = this.getNearbyGate(4.8)
    if (gate) {
      return {
        prompt: `E — Inspecionar Portal [Rank ${gate.rankKey}]`,
        action: { type: 'gate', label: `Masmorra Rank ${gate.rankKey}`, icon: '🌀', gate }
      }
    }

    return null
  }

  onInteract() {
    if (this.activeInstance) {
      const inst = this.activeInstance
      const px = this.game.player.position.x
      const pz = this.game.player.position.z

      // 1. Check chests
      if (inst.floorData?.chests) {
        for (const chest of inst.floorData.chests) {
          if (!chest.opened && Math.hypot(chest.x - px, chest.z - pz) < 3.2) {
            this.openDungeonChest(chest)
            return true
          }
        }
      }

      // 2. Check floor advance
      if (inst.floorData?.exitPos && !inst.floorData.isFinalFloor) {
        const d = Math.hypot(px - inst.floorData.exitPos.x, pz - inst.floorData.exitPos.z)
        if (d < 3.5) {
          const aliveEnemies = this.game.enemies.filter(e => !e.dead).length
          if (aliveEnemies > 0) {
            this.game.toast?.(`⚠️ O portal está selado! Elimine todos os monstros deste andar primeiro.`)
            return true
          }
          this.advanceFloor()
          return true
        }
      }

      return false
    }

    const gate = this.getNearbyGate(4.8)
    if (gate) {
      this.openGateModal(gate)
      return true
    }

    return false
  }

  openDungeonChest(chest) {
    chest.opened = true
    if (chest.mesh) {
      chest.mesh.rotation.y += Math.PI / 4
      if (chest.mesh.material) {
        chest.mesh.material.color.setHex(0x555555)
      }
    }

    const rankKey = this.activeInstance?.rank || 'C'
    const reward = DungeonRewards.rollChestLoot(rankKey, this.activeInstance?.level || 20)
    
    // Give loot
    if (reward.gold) {
      this.game.state.gold = (this.game.state.gold || 0) + reward.gold
    }
    if (reward.xp) {
      this.game.gainXp?.(reward.xp)
    }
    if (reward.item) {
      this.game.addInventoryItem?.(reward.item)
      this.game.toast?.(`🎁 Baú Aberto: ${reward.item.name} (${reward.item.rarity})! +${reward.gold}◈`)
    } else {
      this.game.toast?.(`🎁 Baú Aberto: +${reward.gold}◈ Ouro e +${reward.xp} XP!`)
    }

    this.game.spawnAbilityRing?.(0xfacc15, 3.0, 0.8)
  }

  openGateModal(gate) {
    if (!gate) return
    const party = this.game.state.party || { members: [] }
    const members = (party.members && party.members.length > 0)
      ? party.members.map(m => ({ id: m.id, name: m.name, level: m.level, ready: false }))
      : [{ id: 'me', name: this.game.state.playerName || 'Aventureiro', level: this.game.state.level || 1, ready: true }]

    this.game.state.dungeonModal = {
      gate,
      members,
      readyCountdown: null,
      isPartyCheck: false,
      readyAll: false
    }
    this.game.suspendCombatForUI?.()
  }

  closeGateModal() {
    if (this.game.state) {
      this.game.state.dungeonModal = null
    }
  }

  startPartyReadyCheck(gate) {
    if (!this.game.state?.dungeonModal) return
    const modal = this.game.state.dungeonModal
    modal.isPartyCheck = true
    modal.members = modal.members.map(m => ({ ...m, ready: m.id === 'me' || m.name === this.game.state.playerName }))
    
    this.game.toast?.('📢 Ready Check iniciado! Aguardando confirmação da equipe...')
    
    // Simulate/sync party members readiness
    if (this.game.multiplayer?.connected) {
      this.game.multiplayer.send({ type: 'dungeon_ready_check', gateId: gate.id, rank: gate.rankKey })
    }

    // Check if solo party or auto-confirm bots
    setTimeout(() => {
      if (!this.game.state?.dungeonModal) return
      modal.members = modal.members.map(m => ({ ...m, ready: true }))
      this.triggerEnterCountdown(gate, false)
    }, 1200)
  }

  confirmPartyReady(gate) {
    if (!this.game.state?.dungeonModal) return
    this.triggerEnterCountdown(gate, false)
  }

  confirmSoloEntry(gate) {
    if (!this.canEnterGate(gate)) return
    this.triggerEnterCountdown(gate, true)
  }

  canEnterGate(gate) {
    const requiredLevel = gate?.rankConfig?.levelRange?.[0] || 1
    if ((this.game.state?.level || 1) >= requiredLevel) return true
    this.game.toast?.(`Portal Rank ${gate.rankKey} requer nível ${requiredLevel}.`)
    return false
  }

  triggerEnterCountdown(gate, isSolo = true) {
    const modal = this.game.state?.dungeonModal
    if (!modal) return

    modal.readyCountdown = 3
    let count = 3
    const interval = setInterval(() => {
      count--
      if (!this.game.state?.dungeonModal) {
        clearInterval(interval)
        return
      }
      modal.readyCountdown = count
      if (count <= 0) {
        clearInterval(interval)
        this.closeGateModal()
        if (isSolo) {
          this.startSoloDungeon(gate)
        } else {
          this.startPartyDungeon(gate)
        }
      }
    }, 900)
  }

  setDestinationMarker(gate) {
    if (!gate || !this.game.state) return
    const rank = gate.rank || gate.rankKey || gate.rarity || 'E'
    const color = gate.color || gate.rankConfig?.color || '#38bdf8'
    const name = gate.name || `Portal Rank ${rank}`
    this.game.state.destinationMarker = {
      id: gate.id,
      x: gate.x,
      z: gate.z,
      name,
      label: name.includes('Rank') ? name : `Portal Rank ${rank}`,
      rank,
      color
    }
    this.game.toast?.(`📍 Destino marcado para ${name}! Siga o indicador no HUD.`)
  }

  clearDestinationMarker() {
    if (this.game.state) {
      this.game.state.destinationMarker = null
      this.game.toast?.('Destino desmarcado.')
    }
  }

  onEnemyKilled(e) {
    if (!this.activeInstance) return
    this.activeInstance.kills = (this.activeInstance.kills || 0) + 1
    if (e.isElite) {
      this.activeInstance.elites = (this.activeInstance.elites || 0) + 1
    }
  }

  getMapGates() {
    const now = Date.now()
    return this.activeGates.map(g => ({
      id: g.id,
      name: g.name,
      x: g.x,
      z: g.z,
      zoneName: g.zoneName,
      rank: g.rankKey || 'E',
      rankKey: g.rankKey || 'E',
      color: g.rankConfig?.color || '#38bdf8',
      level: g.dungeonLevel,
      floors: g.totalFloors,
      rounds: g.totalRounds || g.totalFloors || 4,
      isUnstable: g.isUnstable,
      expiresInMinutes: Math.max(0, Math.ceil((g.expiresAt - now) / 60000)),
      recommendedMinLevel: g.rankConfig?.levelRange?.[0] || 1,
      recommendedMaxLevel: g.rankConfig?.levelRange?.[1] || 10
    }))
  }

  findValidGateSpawn() {
    // Generate candidate coordinates away from roads, cities and water
    for (let attempt = 0; attempt < 30; attempt++) {
      const angle = Math.random() * Math.PI * 2
      const dist = 75 + Math.random() * 320
      const gx = Math.cos(angle) * dist
      const gz = Math.sin(angle) * dist

      if (this.game.isInsideCitySafeZone?.(gx, gz, 45)) continue
      if (this.game.isOnRoad?.(gx, gz, 15)) continue

      // Don't spawn too close to another gate
      const tooClose = this.activeGates.some(g => Math.hypot(g.x - gx, g.z - gz) < 55)
      if (tooClose) continue

      return { x: Math.round(gx), z: Math.round(gz) }
    }
    return { x: 120, z: 85 }
  }

  buildGate3D(gate) {
    const g = new THREE.Group()
    g.name = `GateMesh_${gate.id}`

    const rank = gate.rankConfig
    const col = new THREE.Color(gate.isUnstable ? 0xf43f5e : rank.colorHex)
    const glowCol = new THREE.Color(gate.isUnstable ? 0xfb7185 : rank.glowHex)

    // 1. Monolithic pillars/horns flanking the gate
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1f242d, roughness: 0.9, metalness: 0.2 })
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 4.2, 0.7), pillarMat)
    p1.position.set(-2.2, 2.1, 0)
    p1.rotation.z = -0.08
    const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 4.2, 0.7), pillarMat)
    p2.position.set(2.2, 2.1, 0)
    p2.rotation.z = 0.08
    g.add(p1, p2)

    // 2. Central energy vortex ring
    const ringScale = rank.id === 'S' ? 2.6 : rank.id === 'A' ? 2.3 : rank.id === 'B' ? 2.0 : 1.7
    const ringMat = new THREE.MeshStandardMaterial({
      color: col,
      emissive: glowCol,
      emissiveIntensity: rank.id === 'S' ? 2.5 : 1.6,
      roughness: 0.2,
      metalness: 0.6
    })
    const ring = new THREE.Mesh(new THREE.TorusGeometry(ringScale, 0.24, 12, 36), ringMat)
    ring.position.y = ringScale + 0.3
    g.add(ring)
    gate.ring = ring

    // 3. Dark interior event horizon
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x05070f,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88
    })
    const core = new THREE.Mesh(new THREE.CircleGeometry(ringScale * 0.95, 32), coreMat)
    core.position.y = ringScale + 0.3
    g.add(core)
    gate.core = core

    // 4. Orbiting particles
    const particles = []
    const count = rank.id === 'S' ? 14 : rank.id === 'A' ? 10 : 6
    for (let i = 0; i < count; i++) {
      const pMesh = new THREE.Mesh(new THREE.SphereGeometry(0.08 + (i % 2) * 0.04, 6, 6), new THREE.MeshBasicMaterial({ color: glowCol }))
      pMesh.userData = { phase: (i / count) * Math.PI * 2, radius: ringScale + 0.2 }
      g.add(pMesh)
      particles.push(pMesh)
    }
    gate.particles = particles

    // 5. Overhead Rank Nameplate Billboard
    const c = document.createElement('canvas')
    c.width = 480
    c.height = 120
    const ctx = c.getContext('2d')
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(7, 15, 27, 0.92)'
    ctx.strokeStyle = rank.color
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.roundRect?.(10, 10, 460, 100, 24)
    if (!ctx.roundRect) ctx.rect(10, 10, 460, 100)
    ctx.fill()
    ctx.stroke()

    ctx.font = '900 36px Inter,Arial'
    ctx.fillStyle = rank.color
    ctx.fillText(`[PORTAL ${rank.label.toUpperCase()}]`, 240, 42)

    ctx.font = '700 22px Inter,Arial'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(`Nv. ${gate.dungeonLevel} • ${gate.totalFloors} Andar${gate.totalFloors > 1 ? 'es' : ''}`, 240, 84)

    const tx = new THREE.CanvasTexture(c)
    tx.minFilter = THREE.LinearFilter
    tx.colorSpace = THREE.SRGBColorSpace
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthTest: false, depthWrite: false }))
    tag.position.y = ringScale * 2 + 1.2
    tag.scale.set(3.8, 0.95, 1)
    tag.renderOrder = 35
    g.add(tag)

    return g
  }

  expireGate(gate, index) {
    // Gate collapsed or expired
    if (gate.mesh) {
      this.game.worldRoot.remove(gate.mesh)
    }
    this.activeGates.splice(index, 1)

    // Rare Dungeon Break event: spawn a wandering elite mob
    if (!gate.shared && Math.random() < 0.35) {
      this.game.toast?.(`⚠️ RUPTURA DE PORTAL! Feras da Masmorra escaparam para ${gate.zoneName}!`)
      if (this.game.enemies) {
        const mob = this.game.makeEnemy(gate.x, gate.z, gate.dungeonLevel + 2, `Fera Escapada [${gate.rankKey}]`, false, null, null, `break_${Date.now()}`)
        this.game.enemies.push(mob)
      }
    }

    this.syncGatesToState()
  }

  syncGatesToState() {
    if (!this.game.state) return
    this.game.state.activeGates = this.activeGates.map(g => ({
      id: g.id,
      name: g.name,
      x: g.x,
      z: g.z,
      zoneName: g.zoneName,
      rank: g.rankKey,
      rankColor: g.rankConfig.color,
      level: g.dungeonLevel,
      floors: g.totalFloors,
      isUnstable: g.isUnstable,
      expiresInMinutes: Math.max(0, Math.ceil((g.expiresAt - Date.now()) / 60000))
    }))
  }

  startSoloDungeon(gate) {
    this.createDungeonInstance(gate, { isSolo: true })
  }

  startPartyDungeon(gate) {
    this.createDungeonInstance(gate, { isSolo: false })
  }

  createDungeonInstance(gate, { isSolo = true }) {
    if (!gate || !this.canEnterGate(gate)) return
    // Clean up open world entities and clear stale waypoint
    this.game.state.destinationMarker = null
    this.game.state.mount.active = false
    this.game.mountModel.visible = false
    this.game.dungeonReturnPosition = { x: this.game.player.position.x, z: this.game.player.position.z }
    this.game.clearEnemies()
    this.game.setWorldVisible(false)

    const totalRounds = gate.totalRounds || gate.totalFloors || 4
    const instanceId = `dungeon_inst_${Date.now()}`
    this.activeInstance = {
      id: instanceId,
      gateId: gate.id,
      seed: gate.seed,
      rank: gate.rankKey || gate.rank || 'E',
      level: gate.dungeonLevel,
      rankConfig: gate.rankConfig || GATE_RANKS[gate.rankKey] || GATE_RANKS.E,
      themeKey: gate.themeKey,
      totalRounds,
      currentRound: 1,
      roundState: 'ACTIVE',
      breakTimer: 0,
      isBossRound: false,
      isSolo,
      startedAt: Date.now(),
      kills: 0,
      elites: 0,
      bossKilled: false,
      floorData: null,
      floorGroup: null
    }

    // Prepare state for HUD
    this.game.activeWorld = 'dungeon'
    this.game.state.dungeon = {
      instanceId,
      name: gate.name,
      rank: gate.rankKey || gate.rank || 'E',
      color: gate.rankConfig?.color || '#38bdf8',
      level: gate.dungeonLevel,
      round: 1,
      totalRounds,
      enemiesAlive: 0,
      roundState: 'ACTIVE',
      breakTimer: 0,
      theme: gate.theme?.name || 'Masmorra Sombria',
      worldSeed: gate.seed,
      isSolo
    }

    this.loadDungeonArena()
  }

  loadDungeonArena() {
    const inst = this.activeInstance
    if (!inst) return

    if (inst.floorGroup) {
      this.game.scene.remove(inst.floorGroup)
    }
    this.game.clearEnemies()

    // Generate grand dungeon arena
    const floorData = this.generator.generateFloor({
      seed: inst.seed,
      floor: 1,
      totalFloors: 1,
      rank: inst.rank,
      themeKey: inst.themeKey
    })

    inst.floorData = floorData
    inst.floorGroup = floorData.group
    inst.floorGroup.userData ||= {}
    inst.floorGroup.userData.dungeonInstanceId = inst.id
    this.game.scene.add(floorData.group)

    // Teleport player to safe spawn
    this.game.player.position.set(floorData.spawnPos.x, 0, floorData.spawnPos.z)
    this.game.verticalVelocity = 0
    this.game.grounded = true

    // Set atmosphere
    this.game.scene.background.set(floorData.theme.fogColor)
    this.game.scene.fog.color.set(floorData.theme.fogColor)
    this.game.scene.fog.near = 16
    this.game.scene.fog.far = 52

    // Start wave 1
    this.startRound(1)
  }

  startRound(roundNumber) {
    const inst = this.activeInstance
    if (!inst) return

    inst.roundState = 'ACTIVE'
    inst.currentRound = roundNumber
    this.game.clearEnemies()

    if (roundNumber >= inst.totalRounds) {
      // Final Boss Round!
      inst.isBossRound = true
      this.game.toast?.(`⚠️ ROUND FINAL: PRESENÇA PODEROSA DETECTADA!`)
      this.spawnBossRound()
    } else {
      inst.isBossRound = false
      this.game.toast?.(`⚔️ ROUND ${roundNumber}/${inst.totalRounds} INICIADO! Derrote a horda!`)
      this.spawnRoundMobs(roundNumber)
    }

    const alive = this.game.enemies.filter(e => !e.dead && e.isDungeonMob).length
    inst.enemiesAlive = alive
    if (this.game.state?.dungeon) {
      this.game.state.dungeon.round = roundNumber
      this.game.state.dungeon.totalRounds = inst.totalRounds
      this.game.state.dungeon.enemiesAlive = alive
      this.game.state.dungeon.roundState = 'ACTIVE'
      this.game.state.dungeon.breakTimer = 0
    }
  }

  spawnRoundMobs(roundNumber) {
    const inst = this.activeInstance
    if (!inst || !inst.floorData) return

    const theme = inst.floorData.theme
    const rooms = inst.floorData.rooms.filter(r => r.type !== 'spawn')
    const activeRooms = rooms.length > 0 ? rooms : [inst.floorData.rooms[0]]

    // Total mobs scales with round (e.g. 5, 7, 9...)
    const totalMobs = 4 + roundNumber * 2
    for (let i = 0; i < totalMobs; i++) {
      const room = activeRooms[i % activeRooms.length]
      const angle = (i / totalMobs) * Math.PI * 2
      const dist = 2.0 + Math.random() * Math.max(1, (room.w || 10) / 2 - 2)
      const mx = room.x + Math.cos(angle) * dist
      const mz = room.z + Math.sin(angle) * dist

      const mobName = theme.mobs[Math.floor(Math.random() * theme.mobs.length)]
      const isElite = roundNumber >= 2 && Math.random() < (0.15 + roundNumber * 0.08)
      const mob = this.game.makeEnemy(
        mx,
        mz,
        inst.level + Math.floor(roundNumber * 0.8),
        isElite ? `[ELITE] ${mobName}` : mobName,
        isElite,
        null,
        null,
        `dungeon_mob_r${roundNumber}_${i}`
      )
      mob.isDungeonMob = true
      const rankConfig = inst.rankConfig || GATE_RANKS.E
      mob.maxHp = Math.round(mob.maxHp * (rankConfig.baseHpMult || 1))
      mob.hp = mob.maxHp
      mob.atk = Math.round(mob.atk * (rankConfig.baseAtkMult || 1))
      mob.def = Math.round((mob.def || 0) * (rankConfig.baseDefMult || 1))

      if (isElite) {
        mob.maxHp = Math.round(mob.maxHp * 2.2)
        mob.hp = mob.maxHp
        mob.atk = Math.round(mob.atk * 1.35)
        mob.isElite = true
      }

      this.game.enemies.push(mob)
    }
  }

  spawnBossRound() {
    const inst = this.activeInstance
    if (!inst || !inst.floorData) return

    const rooms = inst.floorData.rooms
    const bossRoom = rooms.find(r => r.type === 'boss') || rooms[rooms.length - 1]
    const boss = this.bossAI.createBossEntity({
      x: bossRoom.x,
      z: bossRoom.z,
      level: inst.level + 2,
      themeKey: inst.themeKey,
      rank: inst.rank
    })
    boss.isDungeonBoss = true
    boss.isDungeonMob = true
    this.game.enemies.push(boss)
  }

  updateInstance(dt, t) {
    const inst = this.activeInstance
    if (!inst) return

    const aliveEnemies = this.game.enemies.filter(e => !e.dead && e.isDungeonMob).length
    inst.enemiesAlive = aliveEnemies

    if (this.game.state?.dungeon) {
      this.game.state.dungeon.round = inst.currentRound
      this.game.state.dungeon.totalRounds = inst.totalRounds
      this.game.state.dungeon.enemiesAlive = aliveEnemies
      this.game.state.dungeon.roundState = inst.roundState
      this.game.state.dungeon.breakTimer = Math.max(0, Math.ceil(inst.breakTimer || 0))
    }

    if (inst.roundState === 'ACTIVE') {
      if (inst.isBossRound) {
        const boss = this.game.enemies.find(e => e.isDungeonBoss && !e.dead)
        if (boss) {
          this.bossAI.update(boss, dt)
        } else if (!inst.bossKilled) {
          inst.bossKilled = true
          this.onBossDefeated()
        }
      } else if (aliveEnemies === 0) {
        // Round cleared!
        if (inst.currentRound < inst.totalRounds) {
          inst.roundState = 'BREAK'
          inst.breakTimer = 4.0
          this.game.toast?.(`✨ ROUND ${inst.currentRound} CONCLUÍDO! Próximo round em 4s...`)
          this.game.spawnAbilityRing?.(0x38bdf8, 5, 1.2)
        }
      }
    } else if (inst.roundState === 'BREAK') {
      inst.breakTimer -= dt
      if (inst.breakTimer <= 0) {
        inst.currentRound++
        this.startRound(inst.currentRound)
      }
    }
  }

  advanceFloor() {
    const inst = this.activeInstance
    if (!inst || inst.currentFloor >= inst.totalFloors) return

    inst.currentFloor++
    this.game.state.dungeon.floor = inst.currentFloor
    this.loadFloor(inst.currentFloor)
  }

  onBossDefeated() {
    const inst = this.activeInstance
    if (!inst || inst.completed) return
    inst.completed = true

    const durationSeconds = (Date.now() - inst.startedAt) / 1000
    const rewards = DungeonRewards.calculateCompletionReward({
      rank: inst.rank,
      level: inst.level,
      durationSeconds,
      kills: inst.kills || 28,
      elites: inst.elites || 3,
      bosses: 1
    })

    // Mark completion before the legacy dungeon loop can process this instance.
    if (this.game.state.dungeon) this.game.state.dungeon.transition = true

    // Award the instance once, then consume its source gate so it disappears from the map.
    this.game.gainXp?.(rewards.xp)
    this.game.state.gold = (this.game.state.gold || 0) + rewards.gold
    this.game.state.guildPoints = (this.game.state.guildPoints || 0) + rewards.guildXp
    const guildRankAdvanced = updateGuildRank(this.game.state)
    this.game.state.stats.dungeons = (this.game.state.stats.dungeons || 0) + 1
    progressQuest(this.game.state, 'dungeon', 'clear', 1)
    progressGuildMissions(this.game.state, 'dungeon', 'clear', 1)

    for (const item of rewards.loot) {
      this.game.addInventoryItem?.(item)
    }

    this.removeGate(inst.gateId, { broadcast:true })
    this.game.state.dungeonCompletion = { ...rewards, guildRankAdvanced }
    this.game.toast?.(`🏆 MASMORRA CONCLUÍDA! +${rewards.xp} XP, +${rewards.gold}◈ e +${rewards.guildXp} XP da Guilda!`)
  }

  removeGate(gateId, { broadcast=false } = {}) {
    const index = this.activeGates.findIndex(gate => gate.id === gateId)
    if (index < 0) return null
    const [gate] = this.activeGates.splice(index, 1)
    gate.mesh?.parent?.remove?.(gate.mesh)
    if (gate.shared) this.closedGateIds.add(gate.id)
    if (this.game.state?.destinationMarker?.id === gate.id) this.game.state.destinationMarker = null
    this.syncGatesToState()
    if (broadcast && gate.shared) this.game.multiplayer?.send({type:'gate_closed', gateId:gate.id, cycle:this.globalCycle})
    return gate
  }

  requestSharedGateState() {
    this.game.multiplayer?.send({type:'gate_sync_request', cycle:this.globalCycle})
  }

  handleMultiplayerEvent(event = {}) {
    if (event.type === 'gate_sync_request' && event.from && event.cycle === this.globalCycle) {
      this.game.multiplayer?.send({type:'gate_sync_state', to:event.from, cycle:this.globalCycle, closedGateIds:[...this.closedGateIds]})
      return
    }
    if (event.type === 'gate_sync_state' && event.to === this.game.multiplayer?.playerId && event.cycle === this.globalCycle) {
      for (const id of event.closedGateIds || []) this.removeGate(String(id), { broadcast:false })
      return
    }
    if (event.type === 'gate_closed' && event.cycle === this.globalCycle) this.removeGate(String(event.gateId || ''), { broadcast:false })
  }

  leaveDungeon() {
    const inst = this.activeInstance
    if (!inst) return

    this.clearDungeonGeometry(inst.id)
    this.game.clearEnemies()

    // Restore open world
    this.activeInstance = null
    this.game.state.dungeon = null
    this.game.state.dungeonCompletion = null
    this.game.activeWorld = 'open'
    this.game.dungeonArena.visible = false
    this.game.setWorldVisible(true)

    // Return player to position before entering
    const ret = this.game.dungeonReturnPosition || { x: 0, z: 20 }
    this.game.player.position.set(ret.x, 0, ret.z)
    this.game.repopulateVisibleChunks?.()

    // Restore open world fog
    this.game.scene.background.set(0x8bc8ee)
    this.game.scene.fog.color.set(0x8bc8ee)
    this.game.scene.fog.near = 65
    this.game.scene.fog.far = 155

    this.game.toast?.('Você retornou ao mundo de Asterra.')
  }

  clearDungeonGeometry(instanceId) {
    for (const child of [...this.game.scene.children]) {
      if (child.userData?.dungeonInstanceId === instanceId) this.game.scene.remove(child)
    }
    this.game.dungeonArena?.children?.forEach(child => {
      if (child.userData?.__modernDungeonDynamic) child.visible = false
    })
  }
}
