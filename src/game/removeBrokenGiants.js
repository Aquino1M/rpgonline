import * as THREE from 'three'
import { MODEL_MANIFEST } from './config.js'
import { ShadowGame } from './engine.js'

// V0.8.8: hard stop for the oversized green/imported objects seen in cities.
// Keep gameplay, mobs and the procedural world intact; only unsafe imported visuals
// are removed or replaced by the stable procedural fallback.
const PATCH_FLAG = Symbol.for('shadow-ascension.remove-broken-giants.v088')

// These legacy scenery kits are never required for gameplay and were able to bring
// inherited FBX/GLB scales into the live scene.
for (const key of ['market', 'castle_kit', 'medieval_kit']) {
  if (key in MODEL_MANIFEST) MODEL_MANIFEST[key] = ''
}

if (!ShadowGame.prototype[PATCH_FLAG]) {
  const proto = ShadowGame.prototype
  Object.defineProperty(proto, PATCH_FLAG, { value: true })

  const restoreProceduralNpcs = (game) => {
    for (const npc of game?.npcs || []) {
      if (!npc?.g) continue
      if (npc.g.userData?.hasModel) {
        const keep = new Set([npc.body, npc.head, npc.hair, npc.marker].filter(Boolean))
        for (const child of [...npc.g.children]) {
          if (!keep.has(child)) npc.g.remove(child)
        }
      }
      npc.g.userData ||= {}
      npc.g.userData.hasModel = false
      if (npc.body) npc.body.visible = true
      if (npc.head) npc.head.visible = true
      if (npc.hair) npc.hair.visible = true
      npc.mixer = null
    }
  }

  const sanitizeEnemyVisual = (enemy) => {
    const imported = enemy?.customMesh
    if (!imported) return enemy

    let bad = false
    try {
      imported.updateMatrixWorld?.(true)
      const size = new THREE.Vector3()
      new THREE.Box3().setFromObject(imported).getSize(size)
      const maxDim = Math.max(size.x, size.y, size.z)
      const limit = enemy.boss ? 8 : 4.5
      const source = `${imported.userData?.sourceUrl || ''} ${imported.name || ''}`
      bad = !Number.isFinite(maxDim) || maxDim <= 0 || maxDim > limit || /knight[_ -]?static/i.test(source)
    } catch {
      bad = true
    }

    if (!bad) return enemy

    imported.parent?.remove?.(imported)
    enemy.customMesh = null
    enemy.mixer = null
    if (enemy.body) enemy.body.visible = true
    if (enemy.head) enemy.head.visible = true
    for (const leg of enemy.legs || []) if (leg) leg.visible = true
    return enemy
  }

  // Imported NPC models are cosmetic only. Keep the reliable procedural NPCs in cities,
  // which prevents giant armatures from covering the player/camera.
  proto.upgradeNpcVisuals = function disabledUnsafeNpcModels() {
    restoreProceduralNpcs(this)
    return false
  }

  // Reject only imported enemy meshes whose final world bounds are clearly invalid.
  // The enemy itself remains and falls back to the normal procedural model.
  const previousMakeEnemy = proto.makeEnemy
  proto.makeEnemy = function guardedMakeEnemy(...args) {
    return sanitizeEnemyVisual(previousMakeEnemy.apply(this, args))
  }

  const previousUpdateEnemies = proto.updateEnemies
  proto.updateEnemies = function guardedUpdateEnemies(...args) {
    const result = previousUpdateEnemies.apply(this, args)
    for (const enemy of this.enemies || []) sanitizeEnemyVisual(enemy)
    return result
  }

  const previousLoadExternalVisuals = proto.loadExternalVisuals
  proto.loadExternalVisuals = async function guardedExternalVisuals(...args) {
    const result = await previousLoadExternalVisuals.apply(this, args)
    restoreProceduralNpcs(this)
    for (const enemy of this.enemies || []) sanitizeEnemyVisual(enemy)
    return result
  }
}
