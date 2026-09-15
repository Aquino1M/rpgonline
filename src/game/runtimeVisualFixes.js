import { SAFE_SPAWNS, WORLD } from './config.js'
import { ShadowGame } from './engine.js'

// V0.9.6 mobile/online visual build.
// PACK/PACK2 scenery is disabled completely because some kit nodes arrive with
// inherited transforms that can become enormous in the city. Mob models remain enabled.
// Render distance is also raised while keeping a lower cap on touch devices.
const PATCH_FLAG = Symbol.for('shadow-ascension.runtime-visual-fixes.v087')

// Wider world visibility. These values are consumed by the normal engine loop.
WORLD.renderDistance = Math.max(Number(WORLD.renderDistance) || 0, 4)
WORLD.renderDistanceMin = 1
WORLD.renderDistanceMax = Math.max(Number(WORLD.renderDistanceMax) || 0, 6)
WORLD.mobDistance = Math.max(Number(WORLD.mobDistance) || 0, 120)
WORLD.decorDistance = Math.max(Number(WORLD.decorDistance) || 0, 210)
WORLD.waterDistance = Math.max(Number(WORLD.waterDistance) || 0, 230)

if (!ShadowGame.prototype[PATCH_FLAG]) {
  const proto = ShadowGame.prototype
  Object.defineProperty(proto, PATCH_FLAG, { value: true })

  const disposeProceduralObject = (root) => {
    root?.traverse?.((o) => {
      o.geometry?.dispose?.()
      if (Array.isArray(o.material)) {
        for (const material of o.material) material?.dispose?.()
      } else {
        o.material?.dispose?.()
      }
    })
  }

  const protectedPointsFor = (game, playerRadius = 10, spawnRadius = 18) => {
    const points = []
    if (game?.player?.position) {
      points.push({ x: game.player.position.x, z: game.player.position.z, r: playerRadius })
    }
    for (const spawn of Object.values(SAFE_SPAWNS || {})) {
      if (Number.isFinite(spawn?.x) && Number.isFinite(spawn?.z)) {
        points.push({ x: spawn.x, z: spawn.z, r: spawnRadius })
      }
    }
    for (const gate of game?.gateManager?.activeGates || []) {
      points.push({ x: gate.x, z: gate.z, r: 10 })
    }
    for (const camp of game?.campManager?.camps || []) {
      points.push({ x: camp.x, z: camp.z, r: 12 })
    }
    return points
  }

  const isBlockedPoint = (game, x, z, playerRadius = 10, spawnRadius = 18) => {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return false
    return protectedPointsFor(game, playerRadius, spawnRadius)
      .some((point) => Math.hypot(x - point.x, z - point.z) < point.r)
  }

  proto.isNearSafeSpawn = function isNearSafeSpawn(x, z, pad = 18) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return false
    for (const spawn of Object.values(SAFE_SPAWNS || {})) {
      if (!Number.isFinite(spawn?.x) || !Number.isFinite(spawn?.z)) continue
      if (Math.hypot(x - spawn.x, z - spawn.z) < pad) return true
    }
    return false
  }

  proto.clearWorldResourcesAround = function clearWorldResourcesAround(x, z, radius = 10) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return 0
    const within = (gx, gz) => Number.isFinite(gx) && Number.isFinite(gz) && Math.hypot(gx - x, gz - z) < radius
    const removedIds = new Set()
    for (const node of this.resourceNodes || []) {
      if (!within(Number(node.gx), Number(node.gz))) continue
      removedIds.add(node.id)
      if (node.durabilitySprite) this.scene?.remove?.(node.durabilitySprite)
      node.mesh?.parent?.remove?.(node.mesh)
      disposeProceduralObject(node.mesh)
      if (node.collider) node.collider.active = false
    }
    if (removedIds.size) this.resourceNodes = (this.resourceNodes || []).filter(node => !removedIds.has(node?.id))
    let trees = 0
    for (const chunk of this.chunks?.values?.() || []) {
      for (const child of [...(chunk.group?.children || [])]) {
        if (!child?.userData?.runtimeWorldTree) continue
        const gx = (chunk.group.position?.x || 0) + child.position.x
        const gz = (chunk.group.position?.z || 0) + child.position.z
        if (!within(gx, gz)) continue
        chunk.group.remove(child)
        disposeProceduralObject(child)
        trees++
      }
      chunk.colliders = (chunk.colliders || []).filter(collider => !within(collider?.x, collider?.z))
    }
    return removedIds.size + trees
  }

  // Force a larger useful render distance even for old saves that still contain 2 chunks.
  const originalInit = proto.init
  proto.init = function patchedInit(...args) {
    const minimum = this.isTouchDevice ? 3 : 4
    const saved = Number(this.settings?.renderDistance) || minimum
    this.settings.renderDistance = Math.max(minimum, Math.min(WORLD.renderDistanceMax, saved))
    if (this.state) this.state.settings = this.settings

    const result = originalInit.apply(this, args)

    // The old fog ended at 155 units, hiding extra chunks even when they were loaded.
    if (this.scene?.fog) {
      this.scene.fog.near = this.isTouchDevice ? 72 : 88
      this.scene.fog.far = this.isTouchDevice ? 240 : 320
    }
    if (this.camera) {
      this.camera.far = 900
      this.camera.updateProjectionMatrix?.()
    }

    return result
  }

  // Same chunk streaming logic as the engine, but with larger desktop/mobile caps.
  proto.ensureChunks = function patchedEnsureChunks() {
    const requested = Math.max(
      WORLD.renderDistanceMin,
      Math.min(WORLD.renderDistanceMax, Number(this.settings?.renderDistance) || 4),
    )
    const shortSide = Math.min(window.innerWidth || 1280, window.innerHeight || 720)
    const rd = this.isTouchDevice
      ? Math.min(requested, shortSide < 700 ? 3 : 4)
      : Math.min(requested, 6)
    const pcx = Math.floor(this.player.position.x / WORLD.chunkSize)
    const pcz = Math.floor(this.player.position.z / WORLD.chunkSize)
    const need = new Set()

    for (let dx = -rd; dx <= rd; dx++) {
      for (let dz = -rd; dz <= rd; dz++) {
        const cx = pcx + dx
        const cz = pcz + dz
        const key = `${cx},${cz}`
        need.add(key)
        if (!this.chunks.has(key)) this.buildChunk(cx, cz, key)
      }
    }

    for (const [key, chunk] of [...this.chunks]) {
      if (need.has(key)) continue
      this.worldRoot.remove(chunk.group)
      chunk.group.traverse((o) => {
        o.geometry?.dispose?.()
        if (Array.isArray(o.material)) {
          for (const material of o.material) material?.dispose?.()
        } else {
          o.material?.dispose?.()
        }
      })
      this.chunks.delete(key)
      this.enemies = this.enemies.filter((enemy) => {
        if (enemy.chunkKey === key) {
          enemy.g.parent?.remove?.(enemy.g)
          return false
        }
        return true
      })
      this.resourceNodes = this.resourceNodes.filter((node) => {
        if (node.chunkKey === key) {
          if (node.durabilitySprite) this.scene.remove(node.durabilitySprite)
          return false
        }
        return true
      })
    }
  }

  // Mark procedural trees so streamed chunks can identify them reliably.
  const originalMakeTree = proto.makeTree
  proto.makeTree = function patchedMakeTree(...args) {
    const tree = originalMakeTree.apply(this, args)
    if (tree) {
      tree.userData ||= {}
      tree.userData.runtimeWorldTree = true
    }
    return tree
  }

  // Keep harvestable resources away from the player and all safe spawns.
  const originalBuildChunk = proto.buildChunk
  proto.buildChunk = function patchedBuildChunk(cx, cz, key) {
    const result = originalBuildChunk.call(this, cx, cz, key)
    const chunk = this.chunks?.get(key)
    if (!chunk?.group) return result

    const removedNodeIds = new Set()
    const removedPositions = []

    for (const node of this.resourceNodes || []) {
      if (node?.chunkKey !== key) continue
      const gx = Number(node.gx)
      const gz = Number(node.gz)
      if (!isBlockedPoint(this, gx, gz, 11, 19)) continue

      removedNodeIds.add(node.id)
      removedPositions.push({ x: gx, z: gz })
      if (node.durabilitySprite) this.scene?.remove?.(node.durabilitySprite)
      if (node.mesh?.parent) node.mesh.parent.remove(node.mesh)
      disposeProceduralObject(node.mesh)
      if (node.collider) node.collider.active = false
    }

    for (const child of [...chunk.group.children]) {
      if (!child?.userData?.runtimeWorldTree) continue
      const gx = chunk.group.position.x + child.position.x
      const gz = chunk.group.position.z + child.position.z
      if (!isBlockedPoint(this, gx, gz, 11, 19)) continue
      removedPositions.push({ x: gx, z: gz })
      chunk.group.remove(child)
      disposeProceduralObject(child)
    }

    if (removedNodeIds.size) {
      this.resourceNodes = (this.resourceNodes || []).filter((node) => !removedNodeIds.has(node?.id))
    }

    if (removedPositions.length) {
      const isRemoved = (x, z) => Number.isFinite(x) && Number.isFinite(z)
        && removedPositions.some((point) => Math.hypot(x - point.x, z - point.z) < 1.2)
      chunk.colliders = (chunk.colliders || []).filter((collider) => !isRemoved(collider?.x, collider?.z))
    }

    return result
  }

  const clearPackScenery = (game) => {
    for (const decor of game.packCityDecor || []) decor?.parent?.remove?.(decor)
    game.packCityDecor = []
    game.externalScenery = []
    game.externalSceneryEntries = []
    game.externalCitySceneryEntries = []
  }

  // Remove ALL PACK/PACK2 scenery from runtime. Mobs are intentionally preserved.
  // This is stronger than filtering by size and eliminates the broken giant geometry entirely.
  const originalReadPacksManifest = proto.readPacksManifest
  proto.readPacksManifest = async function patchedReadPacksManifest(...args) {
    const manifest = await originalReadPacksManifest.apply(this, args)
    if (manifest) {
      manifest.scenery = []
      this.packsManifest = manifest
      this.pack2Manifest = manifest
    }
    return manifest
  }

  proto.decorateCitiesWithPackAssets = function disabledPackCityDecor() {
    clearPackScenery(this)
    return false
  }

  proto.upgradeCityMarketStalls = function disabledExternalMarketSet() {
    // Keep only the normal procedural counter/canopy from makeCity().
    return false
  }

  proto.upgradeSceneryVisuals = function disabledExternalSceneryUpgrade() {
    return false
  }

  // Put merchants/blacksmiths behind their counters and keep them facing the shop.
  const originalMakeNpc = proto.makeNpc
  proto.makeNpc = function patchedMakeNpc(def) {
    const isShopNpc = def?.role === 'merchant' || def?.role === 'blacksmith'
    const offset = def?.role === 'merchant' ? 1.75 : def?.role === 'blacksmith' ? 1.55 : 0
    const adjusted = isShopNpc ? { ...def, z: def.z + offset } : def
    const npc = originalMakeNpc.call(this, adjusted)

    if (isShopNpc && npc?.g) {
      npc.g.userData ||= {}
      npc.g.userData.shopAnchor = { x: def.x, z: def.z }
      npc.g.lookAt(def.x, npc.g.position.y, def.z)
    }
    return npc
  }

  const originalUpdateNPCs = proto.updateNPCs
  proto.updateNPCs = function patchedUpdateNPCs(t, dt = 0.016) {
    const result = originalUpdateNPCs.call(this, t, dt)
    for (const npc of this.npcs || []) {
      const anchor = npc?.g?.userData?.shopAnchor
      if (anchor) npc.g.lookAt(anchor.x, npc.g.position.y, anchor.z)
    }
    return result
  }

  // GLB/FBX mobs with clips keep AnimationMixer; static models receive fallback motion.
  const originalMakeEnemy = proto.makeEnemy
  proto.makeEnemy = function patchedMakeEnemy(...args) {
    const enemy = originalMakeEnemy.apply(this, args)
    if (enemy?.mixer) enemy.mixer.timeScale = 1
    if (enemy?.customMesh && !enemy.mixer) {
      enemy.customMesh.userData ||= {}
      enemy.customMesh.userData.fallbackMobAnimation = {
        y: enemy.customMesh.position.y,
        rotX: enemy.customMesh.rotation.x,
        rotZ: enemy.customMesh.rotation.z,
      }
    }
    return enemy
  }

  const originalUpdateEnemies = proto.updateEnemies
  proto.updateEnemies = function patchedUpdateEnemies(dt, t) {
    const result = originalUpdateEnemies.call(this, dt, t)
    const time = Number.isFinite(t) ? t : performance.now() / 1000

    for (const enemy of this.enemies || []) {
      const mobMesh = enemy?.customMesh
      const base = mobMesh?.userData?.fallbackMobAnimation
      if (!mobMesh || !base || enemy.dead || !enemy.g?.visible) continue

      const playerDistance = this.player?.position ? enemy.g.position.distanceTo(this.player.position) : 99
      const moving = playerDistance < 16
      const speed = moving ? 6.4 : 2.4
      const phase = enemy.phase || 0
      const attack = enemy.attackAnim > 0
        ? Math.sin(Math.min(1, enemy.attackAnim / 0.65) * Math.PI)
        : 0

      mobMesh.position.y = base.y + Math.sin(time * speed + phase) * (moving ? 0.055 : 0.028)
      mobMesh.rotation.z = base.rotZ + Math.sin(time * speed * 0.5 + phase) * (moving ? 0.045 : 0.025)
      mobMesh.rotation.x = base.rotX - attack * 0.14
    }

    return result
  }

  // External models load asynchronously. Clear scenery again after loading and revalidate spawn.
  const originalLoadExternalVisuals = proto.loadExternalVisuals
  proto.loadExternalVisuals = async function patchedLoadExternalVisuals(...args) {
    const result = await originalLoadExternalVisuals.apply(this, args)
    clearPackScenery(this)
    this.ensureSafeSpawn?.()
    return result
  }
}
