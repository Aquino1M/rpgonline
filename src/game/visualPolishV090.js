import * as THREE from 'three'
import { MODEL_MANIFEST } from './config.js'
import { ShadowGame } from './engine.js'

const PATCH_FLAG = Symbol.for('shadow-ascension.visual-polish.v090')

// Broken imported weapon FBX files are cosmetic only. Disable them so the player
// always uses the game's own procedural weapon designs instead of a mismatched mesh.
for (const key of ['arrow', 'bow', 'dagger', 'shield', 'spear', 'spellbook', 'sword_1h', 'sword_2h', 'wand']) {
  if (key in MODEL_MANIFEST) MODEL_MANIFEST[key] = ''
}

const norm = (value = '') => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim()

const MOB_PRESENTATION = new Map(Object.entries({
  'javali de musgo': ['Goblin', 'Goblin de Musgo'],
  'slime lumen': ['Slime', 'Slime Lúmen'],
  'guardiao da aurora': ['Gigante', 'Gigante da Aurora'],

  'lobo lumen': ['Goblin', 'Goblin Lúmen'],
  'besouro couracado': ['Bruto', 'Brutamontes Couraçado'],
  'raposa runica': ['Goblin', 'Goblin Rúnico'],
  'alfa lumen': ['Gigante', 'Gigante Alfa Lúmen'],

  'treant jovem': ['Golem', 'Golem de Raiz'],
  'corvo cinzento': ['Fantasma', 'Espectro Cinéreo'],
  'aranha de casca': ['Esqueleto', 'Esqueleto de Casca'],
  'cervo espectral': ['Fantasma', 'Fantasma Espectral'],

  'caranguejo runico': ['Golem', 'Golem Safira'],
  'serpente de mare': ['Fantasma', 'Espectro da Maré'],
  'gaivota abissal': ['Fantasma', 'Espectro Abissal'],
  'leviata de espuma': ['Yeti', 'Yeti das Marés'],

  'golem de xisto': ['Golem', 'Golem de Xisto'],
  'harpia de veyra': ['Yeti', 'Yeti de Veyra'],
  'bode de cristal': ['Anão', 'Anão de Cristal'],
  'roc tempestuoso': ['Dragão', 'Dragão Tempestuoso'],

  'lagarto de brasa': ['Cactoro', 'Cactoro de Brasa'],
  'cavaleiro oco': ['Cavaleiro', 'Cavaleiro Negro'],
  'escorpiao magmatico': ['Cactoro', 'Cactoro Magmático'],
  'colosso rubro': ['Gigante', 'Gigante Rubro'],

  'sentinela umbral': ['Cavaleiro', 'Cavaleiro Umbral'],
  'fera do vazio': ['Bruto', 'Brutamontes do Vazio'],
  'mimico sombrio': ['Fantasma', 'Fantasma Sombrio'],
  'arconte sem nome': ['Cavaleiro', 'Cavaleiro Arconte'],

  'serafim partido': ['Mago', 'Mago Celeste'],
  'dragao nevoa': ['Dragão', 'Dragão Névoa'],
  'cavaleiro celeste': ['Cavaleiro', 'Cavaleiro Celeste'],
  'soberano celeste': ['Rei', 'Rei Sombrio Celeste'],
}))

const colorOf = (item, fallback = 0xb9c7d8) => {
  try { return new THREE.Color(item?.color || fallback) } catch { return new THREE.Color(fallback) }
}

const metalMat = (color, emissive = null) => new THREE.MeshStandardMaterial({
  color,
  metalness: .82,
  roughness: .24,
  ...(emissive ? { emissive, emissiveIntensity: .22 } : {}),
})
const leatherMat = (color = 0x4a2d1c) => new THREE.MeshStandardMaterial({ color, roughness: .86, metalness: .04 })
const gemMat = (color) => new THREE.MeshStandardMaterial({ color, roughness: .18, metalness: .22, emissive: color, emissiveIntensity: .35 })

const mesh = (geometry, material) => {
  const m = new THREE.Mesh(geometry, material)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

const removeTaggedChildren = (anchor, tag) => {
  if (!anchor) return
  for (const child of [...anchor.children]) {
    if (child.userData?.[tag]) anchor.remove(child)
  }
}

function makeSword(item) {
  const root = new THREE.Group()
  const tier = Math.max(0, Number(item?.rarityTier) || 0)
  const accent = colorOf(item, 0xcbd5e1)
  const silver = new THREE.Color(0xdde6ef).lerp(accent, Math.min(.48, tier * .08))
  const bladeMat = metalMat(silver, tier >= 3 ? accent.clone().multiplyScalar(.42) : null)
  const accentMat = metalMat(accent)
  const gripMat = leatherMat(tier >= 4 ? 0x23182b : 0x4a2d1c)

  const blade = mesh(new THREE.BoxGeometry(.12, 1.02, .052), bladeMat)
  blade.position.y = -.48
  root.add(blade)
  const fuller = mesh(new THREE.BoxGeometry(.025, .78, .058), accentMat)
  fuller.position.set(0, -.46, .006)
  root.add(fuller)

  const tip = mesh(new THREE.ConeGeometry(.085, .22, 4), bladeMat)
  tip.rotation.z = Math.PI
  tip.position.y = -1.095
  root.add(tip)

  const guard = mesh(new THREE.BoxGeometry(.48, .075, .12), accentMat)
  guard.position.y = .06
  root.add(guard)
  const guardL = mesh(new THREE.ConeGeometry(.07, .24, 5), accentMat)
  guardL.rotation.z = -Math.PI / 2
  guardL.position.set(-.28, .06, 0)
  root.add(guardL)
  const guardR = guardL.clone()
  guardR.rotation.z = Math.PI / 2
  guardR.position.x = .28
  root.add(guardR)

  const grip = mesh(new THREE.CylinderGeometry(.045, .052, .32, 8), gripMat)
  grip.position.y = .26
  root.add(grip)
  const pommel = mesh(new THREE.OctahedronGeometry(.095, 0), accentMat)
  pommel.position.y = .46
  root.add(pommel)

  if (tier >= 2) {
    const gem = mesh(new THREE.OctahedronGeometry(.055, 0), gemMat(accent))
    gem.position.set(0, .06, .07)
    root.add(gem)
  }
  root.rotation.z = -.05
  return root
}

function makeDagger(item) {
  const root = new THREE.Group()
  const accent = colorOf(item, 0xcbd5e1)
  const blade = mesh(new THREE.BoxGeometry(.11, .58, .045), metalMat(new THREE.Color(0xe3e9ef).lerp(accent, .18)))
  blade.position.y = -.27
  root.add(blade)
  const tip = mesh(new THREE.ConeGeometry(.072, .17, 4), blade.material)
  tip.rotation.z = Math.PI
  tip.position.y = -.64
  root.add(tip)
  const guard = mesh(new THREE.BoxGeometry(.34, .07, .11), metalMat(accent))
  guard.position.y = .08
  root.add(guard)
  const grip = mesh(new THREE.CylinderGeometry(.043, .048, .28, 7), leatherMat())
  grip.position.y = .25
  root.add(grip)
  const gem = mesh(new THREE.OctahedronGeometry(.065, 0), gemMat(accent))
  gem.position.y = .43
  root.add(gem)
  return root
}


function makeAxe(item) {
  const root = new THREE.Group()
  const accent = colorOf(item, 0xb87333)
  const handle = mesh(new THREE.CylinderGeometry(.045, .052, .82, 8), leatherMat(0x53331f))
  handle.position.y = -.28
  root.add(handle)
  const head = mesh(new THREE.BoxGeometry(.38, .22, .10), metalMat(new THREE.Color(0xc9d2dc).lerp(accent, .18)))
  head.position.set(.10, -.70, 0)
  head.rotation.z = -.10
  root.add(head)
  const edge = mesh(new THREE.ConeGeometry(.16, .26, 4), metalMat(accent))
  edge.position.set(.32, -.70, 0)
  edge.rotation.z = -Math.PI / 2
  root.add(edge)
  const pommel = mesh(new THREE.OctahedronGeometry(.06, 0), gemMat(accent))
  pommel.position.y = .17
  root.add(pommel)
  return root
}

function makeBow(item) {
  const root = new THREE.Group()
  const accent = colorOf(item, 0x8b5a2b)
  const wood = leatherMat(new THREE.Color(0x7b4a27).lerp(accent, .22))
  const limbGeo = new THREE.CylinderGeometry(.035, .05, .62, 8)
  const upper = mesh(limbGeo, wood)
  upper.position.set(.12, -.2, 0)
  upper.rotation.z = -.38
  root.add(upper)
  const lower = mesh(limbGeo, wood)
  lower.position.set(.12, -.78, 0)
  lower.rotation.z = .38
  root.add(lower)
  const topTip = mesh(new THREE.CylinderGeometry(.025, .035, .28, 8), metalMat(accent))
  topTip.position.set(.28, .18, 0)
  topTip.rotation.z = -.62
  root.add(topTip)
  const bottomTip = mesh(new THREE.CylinderGeometry(.025, .035, .28, 8), metalMat(accent))
  bottomTip.position.set(.28, -1.17, 0)
  bottomTip.rotation.z = .62
  root.add(bottomTip)
  const grip = mesh(new THREE.CylinderGeometry(.05, .05, .22, 8), leatherMat(0x2b1b13))
  grip.position.set(0, -.49, 0)
  root.add(grip)

  const pts = [
    new THREE.Vector3(.36, .31, 0),
    new THREE.Vector3(-.05, -.49, 0),
    new THREE.Vector3(.36, -1.30, 0),
  ]
  const string = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xe6edf5 }))
  root.add(string)
  root.rotation.z = .05
  return root
}

function makeSpellbook(item) {
  const root = new THREE.Group()
  const accent = colorOf(item, 0x8b5cf6)
  const cover = leatherMat(new THREE.Color(0x2b1f3d).lerp(accent, .22))
  const pages = new THREE.MeshStandardMaterial({ color: 0xf4ead5, roughness: .9 })
  const body = mesh(new THREE.BoxGeometry(.42, .55, .16), cover)
  body.position.set(0, -.35, 0)
  body.rotation.z = -.18
  root.add(body)
  const pageBlock = mesh(new THREE.BoxGeometry(.35, .47, .135), pages)
  pageBlock.position.set(.015, -.35, .018)
  pageBlock.rotation.z = -.18
  root.add(pageBlock)
  const rune = mesh(new THREE.TorusGeometry(.085, .018, 6, 12), gemMat(accent))
  rune.position.set(-.05, -.34, .095)
  rune.rotation.x = Math.PI / 2
  root.add(rune)
  return root
}

function buildOriginalWeapon(game, item) {
  const pivot = game.weaponVisual
  if (!pivot) return

  if (pivot.userData?.attachedMesh) {
    pivot.remove(pivot.userData.attachedMesh)
    pivot.userData.attachedMesh = null
  }
  removeTaggedChildren(pivot, 'v090Weapon')
  for (const part of pivot.userData?.proceduralParts || []) part.visible = false
  pivot.userData.currentAttachedKey = null

  if (!item) {
    for (const part of pivot.userData?.proceduralParts || []) part.visible = true
    return
  }

  const subtype = item.subtype || 'sword'
  const weapon = subtype === 'bow'
    ? makeBow(item)
    : subtype === 'spellbook'
      ? makeSpellbook(item)
      : subtype === 'dagger'
        ? makeDagger(item)
        : subtype === 'axe'
          ? makeAxe(item)
          : makeSword(item)

  weapon.userData.v090Weapon = true
  weapon.name = `OriginalWeapon:${subtype}`
  pivot.add(weapon)
  pivot.userData.v090WeaponSignature = `${item.id || item.name}:${item.upgrade || 0}:${item.rarity || ''}:${subtype}`
}

function clearOriginalArmor(game) {
  removeTaggedChildren(game.rig?.hips, 'v090Armor')
  removeTaggedChildren(game.rig?.shoulderL, 'v090Armor')
  removeTaggedChildren(game.rig?.shoulderR, 'v090Armor')
  removeTaggedChildren(game.rig?.legL, 'v090Armor')
  removeTaggedChildren(game.rig?.legR, 'v090Armor')
}

function buildOriginalArmor(game, item) {
  clearOriginalArmor(game)
  if (!item || !game.rig?.hips) return

  const tier = Math.max(0, Number(item.rarityTier) || 0)
  const accent = colorOf(item, 0x7a8b9a)
  const steel = new THREE.Color(0x667585).lerp(accent, Math.min(.58, .16 + tier * .07))
  const dark = new THREE.Color(0x1c2630).lerp(accent, .08)
  const steelMat = metalMat(steel, tier >= 3 ? accent.clone().multiplyScalar(.25) : null)
  const darkMat = metalMat(dark)
  const accentMat = metalMat(accent)

  const torsoRoot = new THREE.Group()
  torsoRoot.userData.v090Armor = true
  const breast = mesh(new THREE.BoxGeometry(.76, .66, .22), steelMat)
  breast.position.set(0, .42, .31)
  torsoRoot.add(breast)
  const center = mesh(new THREE.BoxGeometry(.12, .54, .245), accentMat)
  center.position.set(0, .42, .325)
  torsoRoot.add(center)
  const waist = mesh(new THREE.BoxGeometry(.82, .15, .28), darkMat)
  waist.position.set(0, .08, .08)
  torsoRoot.add(waist)
  const collar = mesh(new THREE.TorusGeometry(.24, .045, 6, 14, Math.PI), accentMat)
  collar.position.set(0, .77, .19)
  collar.rotation.set(Math.PI / 2, 0, Math.PI)
  torsoRoot.add(collar)
  if (tier >= 2) {
    const crest = mesh(new THREE.OctahedronGeometry(.09, 0), gemMat(accent))
    crest.position.set(0, .47, .46)
    torsoRoot.add(crest)
  }
  game.rig.hips.add(torsoRoot)

  const makeShoulder = (side) => {
    const r = new THREE.Group()
    r.userData.v090Armor = true
    const plate = mesh(new THREE.BoxGeometry(.30, .18, .40), steelMat)
    plate.position.set(side * .02, -.02, .01)
    plate.rotation.z = side * .14
    r.add(plate)
    const trim = mesh(new THREE.BoxGeometry(.32, .055, .42), accentMat)
    trim.position.set(side * .02, .07, .01)
    trim.rotation.z = side * .14
    r.add(trim)
    return r
  }
  game.rig.shoulderL?.add(makeShoulder(-1))
  game.rig.shoulderR?.add(makeShoulder(1))

  const makeGreave = () => {
    const r = new THREE.Group()
    r.userData.v090Armor = true
    const plate = mesh(new THREE.BoxGeometry(.24, .42, .24), steelMat)
    plate.position.set(0, -.58, .09)
    r.add(plate)
    const trim = mesh(new THREE.BoxGeometry(.26, .07, .26), accentMat)
    trim.position.set(0, -.42, .09)
    r.add(trim)
    return r
  }
  game.rig.legL?.add(makeGreave())
  game.rig.legR?.add(makeGreave())
  game.rig.hips.userData.v090ArmorSignature = `${item.id || item.name}:${item.upgrade || 0}:${item.rarity || ''}`
}

function alignImportedMob(enemy) {
  const imported = enemy?.customMesh
  if (!imported || !enemy?.g) return
  try {
    enemy.g.updateWorldMatrix?.(true, true)
    imported.updateWorldMatrix?.(true, true)
    const box = new THREE.Box3().setFromObject(imported)
    if (!Number.isFinite(box.min.y)) return
    const world = new THREE.Vector3()
    enemy.g.getWorldPosition(world)
    const clearance = /slime/i.test(enemy.displayName || enemy.name || '') ? .10 : .035
    const delta = world.y + clearance - box.min.y
    if (Number.isFinite(delta) && Math.abs(delta) < 12) {
      imported.position.y += delta
      imported.updateMatrixWorld?.(true)
      imported.userData ||= {}
      imported.userData.v090GroundY = imported.position.y
      if (imported.userData.fallbackMobAnimation) imported.userData.fallbackMobAnimation.baseY = imported.position.y
    }
  } catch {}
}

if (!ShadowGame.prototype[PATCH_FLAG]) {
  const proto = ShadowGame.prototype
  Object.defineProperty(proto, PATCH_FLAG, { value: true })

  const previousMakeEnemy = proto.makeEnemy
  proto.makeEnemy = function polishedEnemy(x, z, level, name, boss, zone, chunkKey = null, netId = null) {
    const originalName = name
    const presentation = MOB_PRESENTATION.get(norm(name))
    const visualName = presentation?.[0] || name
    const enemy = previousMakeEnemy.call(this, x, z, level, visualName, boss, zone, chunkKey, netId)
    if (!enemy) return enemy

    enemy.name = originalName
    enemy.displayName = presentation?.[1] || originalName
    enemy.visualName = visualName
    enemy.groundFixFrames = 12
    alignImportedMob(enemy)
    this.updateMobLabel?.(enemy)
    return enemy
  }

  proto.updateMobLabel = function polishedMobLabel(e) {
    const l = e?.label
    if (!l) return
    const ctx = l.canvas.getContext('2d')
    const pct = Math.max(0, Math.min(1, e.hp / e.maxHp))
    const displayName = e.displayName || e.name
    ctx.clearRect(0, 0, 320, 82)
    ctx.fillStyle = 'rgba(3,8,14,.88)'
    ctx.roundRect(4, 4, 312, 72, 12)
    ctx.fill()
    ctx.strokeStyle = e.boss ? '#d78cff' : 'rgba(180,220,245,.42)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.font = '700 24px Inter,Arial'
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.fillText(`${e.boss ? '★ ' : ''}${displayName}  •  Lv.${e.level}`, 160, 31)
    ctx.fillStyle = '#141b24'
    ctx.fillRect(22, 43, 276, 18)
    ctx.fillStyle = e.boss ? '#b746e0' : '#e54d5d'
    ctx.fillRect(22, 43, 276 * pct, 18)
    ctx.strokeStyle = 'rgba(255,255,255,.5)'
    ctx.strokeRect(22, 43, 276, 18)
    ctx.font = '700 13px Inter,Arial'
    ctx.fillStyle = '#fff'
    ctx.fillText(`${Math.max(0, Math.ceil(e.hp))} / ${Math.ceil(e.maxHp)}`, 160, 57)
    l.texture.needsUpdate = true
    l.lastHp = e.hp
    l.lastLevel = e.level
  }

  const previousUpdateEnemies = proto.updateEnemies
  proto.updateEnemies = function polishedEnemyUpdate(dt, t) {
    const result = previousUpdateEnemies.call(this, dt, t)
    for (const enemy of this.enemies || []) {
      if (!enemy?.customMesh || enemy.dead) continue
      if ((enemy.groundFixFrames || 0) > 0) {
        alignImportedMob(enemy)
        enemy.groundFixFrames -= 1
      }
    }
    return result
  }

  const previousUpdateEquipmentVisuals = proto.updateEquipmentVisuals
  proto.updateEquipmentVisuals = function polishedEquipmentVisuals(...args) {
    const result = previousUpdateEquipmentVisuals?.apply(this, args)
    const eq = this.state?.equipment || {}

    const weaponSig = eq.weapon ? `${eq.weapon.id || eq.weapon.name}:${eq.weapon.upgrade || 0}:${eq.weapon.rarity || ''}:${eq.weapon.subtype || 'sword'}` : 'none'
    if (this.weaponVisual?.userData?.v090WeaponSignature !== weaponSig) {
      buildOriginalWeapon(this, eq.weapon || null)
      if (this.weaponVisual) this.weaponVisual.userData.v090WeaponSignature = weaponSig
    } else if (this.weaponVisual?.userData?.attachedMesh) {
      this.weaponVisual.remove(this.weaponVisual.userData.attachedMesh)
      this.weaponVisual.userData.attachedMesh = null
    }

    const armorSig = eq.armor ? `${eq.armor.id || eq.armor.name}:${eq.armor.upgrade || 0}:${eq.armor.rarity || ''}` : 'none'
    if (this.rig?.hips?.userData?.v090ArmorSignature !== armorSig) {
      buildOriginalArmor(this, eq.armor || null)
      if (this.rig?.hips) this.rig.hips.userData.v090ArmorSignature = armorSig
    }
    return result
  }

  const previousLoadExternalVisuals = proto.loadExternalVisuals
  proto.loadExternalVisuals = async function polishedExternalVisuals(...args) {
    const result = await previousLoadExternalVisuals.apply(this, args)
    // Never allow a late-loaded external weapon to replace the original designs.
    for (const key of ['arrow', 'bow', 'dagger', 'shield', 'spear', 'spellbook', 'sword_1h', 'sword_2h', 'wand']) {
      if (this.externalModels && key in this.externalModels) this.externalModels[key] = null
    }
    this.updateEquipmentVisuals()
    for (const enemy of this.enemies || []) {
      enemy.groundFixFrames = Math.max(enemy.groundFixFrames || 0, 12)
      alignImportedMob(enemy)
      this.updateMobLabel(enemy)
    }
    return result
  }
}
