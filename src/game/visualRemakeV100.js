import * as THREE from 'three'
import { ShadowGame } from './engine.js'

// Lightweight visual remake: procedural details keep the current gameplay and
// avoid shipping unlicensed/heavy models while the asset pipeline is offline.
const PATCH_FLAG = Symbol.for('shadow-ascension.visual-remake.v100')
const mesh = (geometry, material) => {
  const value = new THREE.Mesh(geometry, material)
  value.castShadow = true
  value.receiveShadow = true
  return value
}
const material = (color, extra = {}) => new THREE.MeshStandardMaterial({
  color,
  roughness: .62,
  ...extra,
})
const accentColor = (value, fallback = 0x7dd3fc) => {
  try { return new THREE.Color(value || fallback) } catch { return new THREE.Color(fallback) }
}

const QUALITY = {
  leve: { exposure: 1.0, fogNear: 70, fogFar: 210 },
  equilibrado: { exposure: 1.05, fogNear: 82, fogFar: 275 },
  bonito: { exposure: 1.1, fogNear: 92, fogFar: 340 },
}

function applyVisualQuality(game) {
  if (!game?.renderer) return
  const quality = QUALITY[game.settings?.visualQuality] || QUALITY.equilibrado
  game.renderer.shadowMap.type = THREE.PCFShadowMap
  game.renderer.shadowMap.enabled = game.settings?.shadows !== false && game.settings?.visualQuality !== 'leve'
  game.renderer.toneMappingExposure = quality.exposure
  if (game.scene?.fog) {
    game.scene.fog.near = quality.fogNear
    game.scene.fog.far = game.isTouchDevice ? Math.min(quality.fogFar, 250) : quality.fogFar
  }
}

function decoratePlayer(game, root) {
  if (!root || root.userData?.visualRemakeV100) return root
  root.userData ||= {}
  root.userData.visualRemakeV100 = true

  const visual = new THREE.Group()
  visual.name = 'VisualRemake'
  visual.userData.visualRemakeV100 = true
  root.add(visual)

  const accent = material(0x6ee7ff, { metalness: .35, roughness: .3, emissive: 0x075985, emissiveIntensity: .32 })
  const gold = material(0xf4c95d, { metalness: .72, roughness: .25, emissive: 0x7c4a03, emissiveIntensity: .18 })
  const dark = material(0x172033, { metalness: .28, roughness: .4 })

  const chestRune = mesh(new THREE.OctahedronGeometry(.11, 0), accent)
  chestRune.position.set(0, 1.56, .43)
  visual.add(chestRune)

  const clasp = mesh(new THREE.TorusGeometry(.1, .025, 6, 12), gold)
  clasp.position.set(0, 1.86, -.39)
  clasp.rotation.x = Math.PI / 2
  visual.add(clasp)

  const sash = mesh(new THREE.BoxGeometry(.78, .045, .08), gold)
  sash.position.set(0, 1.08, .23)
  visual.add(sash)

  for (const side of [-1, 1]) {
    const shoulder = mesh(new THREE.IcosahedronGeometry(.19, 0), dark)
    shoulder.scale.set(1.2, .6, 1)
    shoulder.position.set(side * .47, 1.72, 0)
    visual.add(shoulder)

    const bootTrim = mesh(new THREE.BoxGeometry(.3, .045, .5), gold)
    bootTrim.position.set(side * .2, .17, .16)
    visual.add(bootTrim)
  }
  return root
}

function decorateEnemy(enemy) {
  if (!enemy?.g || enemy.g.userData?.visualRemakeV100) return enemy
  enemy.g.userData ||= {}
  enemy.g.userData.visualRemakeV100 = true

  const color = accentColor(enemy.boss ? 0xf59e0b : enemy.zoneId === 'void' ? 0xa78bfa : enemy.zoneId === 'coast' ? 0x67e8f9 : 0xfb7185)
  const glow = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .92 })
  const eyeGeometry = new THREE.SphereGeometry(enemy.boss ? .065 : .045, 6, 4)
  for (const side of [-1, 1]) {
    const eye = mesh(eyeGeometry, glow)
    eye.position.set(side * (enemy.boss ? .14 : .1), enemy.boss ? 2.03 : 1.79, .29)
    enemy.g.add(eye)
  }

  const crest = mesh(
    new THREE.TetrahedronGeometry(enemy.boss ? .22 : .12, 0),
    material(color, { metalness: .35, roughness: .32, emissive: color, emissiveIntensity: enemy.boss ? .5 : .2 }),
  )
  crest.position.y = enemy.boss ? 2.62 : 2.07
  crest.rotation.z = Math.PI / 4
  enemy.g.add(crest)
  return enemy
}

function decorateNpc(npc) {
  if (!npc?.g || npc.g.userData?.visualRemakeV100) return npc
  npc.g.userData ||= {}
  npc.g.userData.visualRemakeV100 = true

  const roleColor = {
    merchant: 0x34d399,
    blacksmith: 0xfb923c,
    quest: 0x60a5fa,
    guild: 0xfbbf24,
    townhall: 0x93c5fd,
    stable: 0xa3e635,
    pets: 0xf472b6,
    traveler: 0x38bdf8,
  }[npc.def?.role] || 0xcbd5e1
  const badge = mesh(new THREE.OctahedronGeometry(.105, 0), material(roleColor, {
    metalness: .25,
    roughness: .3,
    emissive: roleColor,
    emissiveIntensity: .25,
  }))
  badge.position.set(0, 1.34, .34)
  npc.g.add(badge)

  const shoulder = mesh(new THREE.BoxGeometry(.64, .08, .12), material(roleColor, { metalness: .18, roughness: .46 }))
  shoulder.position.set(0, 1.53, 0)
  npc.g.add(shoulder)
  return npc
}

function decorateCity(group, city) {
  if (!group || group.userData?.visualRemakeV100) return group
  group.userData ||= {}
  group.userData.visualRemakeV100 = true

  const color = accentColor(city?.accent, 0x7dd3fc)
  const glow = material(color, { metalness: .32, roughness: .28, emissive: color, emissiveIntensity: .28 })
  const ring = mesh(new THREE.TorusGeometry(10.9, .075, 6, 24), glow)
  ring.position.y = .16
  ring.rotation.x = Math.PI / 2
  group.add(ring)

  for (const angle of [Math.PI / 4, 3 * Math.PI / 4, 5 * Math.PI / 4, 7 * Math.PI / 4]) {
    const pylon = mesh(new THREE.OctahedronGeometry(.22, 0), glow)
    pylon.position.set(Math.cos(angle) * 10.9, .42, Math.sin(angle) * 10.9)
    group.add(pylon)
  }
  return group
}

if (!ShadowGame.prototype[PATCH_FLAG]) {
  const proto = ShadowGame.prototype
  Object.defineProperty(proto, PATCH_FLAG, { value: true })

  const previousInit = proto.init
  proto.init = function visualRemakeInit(...args) {
    const result = previousInit.apply(this, args)
    applyVisualQuality(this)
    return result
  }

  const previousApplySettings = proto.applySettings
  proto.applySettings = function visualRemakeSettings(...args) {
    const result = previousApplySettings.apply(this, args)
    applyVisualQuality(this)
    return result
  }

  const previousMakePlayer = proto.makePlayer
  proto.makePlayer = function visualRemakePlayer(...args) {
    return decoratePlayer(this, previousMakePlayer.apply(this, args))
  }

  const previousMakeEnemy = proto.makeEnemy
  proto.makeEnemy = function visualRemakeEnemy(...args) {
    return decorateEnemy(previousMakeEnemy.apply(this, args))
  }

  const previousMakeNpc = proto.makeNpc
  proto.makeNpc = function visualRemakeNpc(...args) {
    return decorateNpc(previousMakeNpc.apply(this, args))
  }

  const previousMakeCity = proto.makeCity
  proto.makeCity = function visualRemakeCity(city, ...args) {
    return decorateCity(previousMakeCity.call(this, city, ...args), city)
  }
}

