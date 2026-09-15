import * as THREE from 'three'
import { ShadowGame } from './engine.js'
import { ZONES } from './config.js'

const CAMPS = [
  { id: 'camp-meadow', name: 'Acampamento dos Lobos', x: 120, z: 92, level: 8, count: 4, names: ['Lobo Lúmen', 'Besouro Couraçado'] },
  { id: 'camp-forest', name: 'Acampamento Cinéreo', x: -132, z: 108, level: 26, count: 5, names: ['Aranha de Casca', 'Corvo Cinzento'] },
  { id: 'camp-coast', name: 'Acampamento da Maré', x: 76, z: 208, level: 56, count: 5, names: ['Caranguejo Rúnico', 'Serpente de Maré'] },
  { id: 'camp-ember', name: 'Acampamento de Cinzas', x: 306, z: -122, level: 142, count: 6, names: ['Lagarto de Brasa', 'Escorpião Magmático'] },
]

const zoneAtCamp = (camp) => ZONES.find(zone => camp.x >= zone.x0 && camp.x <= zone.x1 && camp.z >= zone.z0 && camp.z <= zone.z1) || ZONES[0]
const material = (color, emissive = color) => new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: .12, roughness: .78 })

class EncounterCampManager {
  constructor(game) {
    this.game = game
    this.camps = []
  }

  init() {
    this.game.state.campProgress ||= {}
    for (const definition of CAMPS) this.camps.push(this.createCamp(definition))
  }

  createCamp(definition) {
    const group = new THREE.Group()
    group.name = definition.name
    group.position.set(definition.x, 0, definition.z)
    const wood = material(0x5f3d25), cloth = material(0x8c3232), stone = material(0x4b5563)
    for (const [x, z] of [[-5, -4], [5, -4], [-5, 4], [5, 4]]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, 1.1, 6), wood)
      post.position.set(x, .55, z)
      group.add(post)
    }
    const tent = new THREE.Mesh(new THREE.ConeGeometry(2.4, 2.5, 4), cloth)
    tent.position.set(-1.6, 1.25, .8)
    tent.rotation.y = Math.PI / 4
    group.add(tent)
    const fire = new THREE.Mesh(new THREE.ConeGeometry(.35, .9, 7), material(0xf59e0b, 0xea580c))
    fire.position.set(2.2, .45, -1.8)
    group.add(fire)
    const chest = new THREE.Group()
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, .62, .76), material(0x84521e))
    base.position.y = .34
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.24, .28, .8), material(0xc58b36))
    lid.position.set(0, .78, -.04)
    chest.add(base, lid)
    chest.position.set(2.5, 0, 2.2)
    group.add(chest)
    this.game.worldRoot.add(group)
    this.game.clearWorldResourcesAround?.(definition.x, definition.z, 12)
    const progress = this.game.state.campProgress[definition.id] ||= { cleared: false, opened: false }
    chest.visible = !!progress.cleared && !progress.opened
    return { ...definition, group, chest, lid, zone: zoneAtCamp(definition) }
  }

  update() {
    const inWorld = !this.game.state.dungeon
    for (const camp of this.camps) {
      const distance = Math.hypot(camp.x - this.game.player.position.x, camp.z - this.game.player.position.z)
      camp.group.visible = inWorld && distance < 210
      const progress = this.game.state.campProgress[camp.id]
      camp.chest.visible = camp.group.visible && !!progress?.cleared && !progress?.opened
      if (inWorld && !progress?.cleared && distance < 150) this.spawnMobs(camp)
    }
  }

  spawnMobs(camp) {
    if (this.game.enemies.some(enemy => !enemy.dead && enemy.campId === camp.id)) return
    for (let index = 0; index < camp.count; index++) {
      const angle = index / camp.count * Math.PI * 2
      const enemy = this.game.makeEnemy(
        camp.x + Math.cos(angle) * (4.3 + index % 2),
        camp.z + Math.sin(angle) * (4.3 + index % 2),
        camp.level + index,
        camp.names[index % camp.names.length],
        false,
        camp.zone,
        null,
        `camp:${camp.id}:${index}`,
      )
      enemy.campId = camp.id
      this.game.enemies.push(enemy)
    }
  }

  onEnemyKilled(enemy) {
    const camp = this.camps.find(item => item.id === enemy?.campId)
    if (!camp || this.game.enemies.some(item => !item.dead && item.campId === camp.id)) return
    const progress = this.game.state.campProgress[camp.id]
    if (!progress || progress.cleared) return
    progress.cleared = true
    camp.chest.visible = true
    this.game.toast(`🏕️ ${camp.name} limpo! O baú foi liberado.`)
    this.game.saveGame?.()
  }

  nearestChest() {
    let best = null
    for (const camp of this.camps) {
      const progress = this.game.state.campProgress[camp.id]
      const distance = Math.hypot(camp.chest.position.x + camp.x - this.game.player.position.x, camp.chest.position.z + camp.z - this.game.player.position.z)
      if (distance < 3.4 && (!best || distance < best.distance)) best = { camp, progress, distance }
    }
    return best
  }

  getInteractionPrompt() {
    if (this.game.state.dungeon) return null
    const hit = this.nearestChest()
    if (!hit) return null
    if (!hit.progress?.cleared) return { prompt: `⚔ Elimine os guardas de ${hit.camp.name}`, action: { type: 'camp', label: 'Baú bloqueado', icon: '🔒', blocked: true } }
    if (hit.progress.opened) return null
    return { prompt: 'E — Abrir Baú do Acampamento', action: { type: 'camp', label: 'Abrir Baú', icon: '🎁' } }
  }

  onInteract() {
    const hit = this.nearestChest()
    if (!hit) return false
    if (!hit.progress?.cleared) {
      this.game.toast('Elimine todos os guardas para liberar o baú.')
      return true
    }
    if (hit.progress.opened) return true
    hit.progress.opened = true
    hit.camp.chest.visible = false
    hit.camp.lid.rotation.x = -.75
    const xp = Math.round(42 + hit.camp.level * 7)
    const gold = Math.round(55 + hit.camp.level * 8)
    const reward = { id: `camp-loot-${hit.camp.id}`, name: `Insígnia de ${hit.camp.name}`, type: 'material', subtype: 'monster-drop', rarity: hit.camp.level >= 55 ? 'Rara' : 'Comum', color: '#f6c453', icon: '🎁', qty: 1, value: gold, description: 'Recompensa obtida ao limpar um acampamento hostil.' }
    this.game.gainXp(xp)
    this.game.state.gold = (this.game.state.gold || 0) + gold
    this.game.state.ores = (this.game.state.ores || 0) + Math.max(1, Math.floor(hit.camp.level / 45))
    this.game.addInventoryItem(reward)
    this.game.toast(`🎁 Baú aberto! +${xp} XP, +${gold}◈ e ${reward.name}.`)
    this.game.saveGame?.()
    return true
  }

  setVisible(visible) {
    for (const camp of this.camps) camp.group.visible = !!visible && !this.game.state.dungeon
  }
}

const FLAG = Symbol.for('shadow-ascension.encounter-camps.v1')
if (!ShadowGame.prototype[FLAG]) {
  const proto = ShadowGame.prototype
  Object.defineProperty(proto, FLAG, { value: true })
  const init = proto.init
  proto.init = function initEncounterCamps(...args) {
    const result = init.apply(this, args)
    this.campManager = new EncounterCampManager(this)
    this.campManager.init()
    return result
  }
  const setWorldVisible = proto.setWorldVisible
  proto.setWorldVisible = function setCampWorldVisible(visible, ...args) {
    const result = setWorldVisible.call(this, visible, ...args)
    this.campManager?.setVisible(visible)
    return result
  }
  const updateInteractions = proto.updateInteractions
  proto.updateInteractions = function updateCampInteractions(...args) {
    const result = updateInteractions.apply(this, args)
    const prompt = this.campManager?.getInteractionPrompt()
    if (prompt) { this.state.interactionPrompt = prompt.prompt; this.state.actionButton = prompt.action }
    return result
  }
  const interact = proto.interact
  proto.interact = function interactWithCamp(...args) {
    if (!this.state.uiPanel && this.campManager?.onInteract()) return true
    return interact.apply(this, args)
  }
  const kill = proto.kill
  proto.kill = function killCampMob(enemy, ...args) {
    const result = kill.call(this, enemy, ...args)
    this.campManager?.onEnemyKilled(enemy)
    return result
  }
  const updateEnemies = proto.updateEnemies
  proto.updateEnemies = function updateCampMobs(dt, t) {
    this.campManager?.update()
    return updateEnemies.call(this, dt, t)
  }
}
