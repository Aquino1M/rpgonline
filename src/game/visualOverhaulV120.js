// visualOverhaulV120.js - Complete Visual Redesign & Polish for Shadow Ascension
// 1. NPC Visual Redesign (Unique 3D role outfits, accessories, props, faces & idle breathing)
// 2. Player Character Redesign (Heroic proportions, gauntlets, boots, cape physics & dynamic class aura)
// 3. Weapons Redesign & Ergonomic Hand Grip (Correct hand sockets, swords, bows in left hand, axes, daggers, spellbooks)
// 4. Armor Redesign (Sculpted cuirass, tiered pauldrons, gauntlets, greaves, rarity glow shaders)
// 5. Attack Effects (Luminous 3D crescent slash waves, impact sparks, critical bursts, bow release rings)
// 6. Defend Effects (Heroic guard stance, glowing hexagonal energy aegis barrier, deflection ripples & sparks)
// 7. Running Effects (Billowing ground dust puffs, sprint speed streaks, galloping dust trails)
// 8. Power & Ability Effects (Sacred runic mandalas, rising elemental geysers, orbiting magic motes)

import * as THREE from 'three'
import { ShadowGame } from './engine.js'
import { CLASSES_LIST } from './classesData.js'

const OVERHAUL_FLAG = Symbol.for('shadow-ascension.visual-overhaul.v120')

// --- Helper Functions & Shared Materials ---
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({
  color,
  roughness: 0.58,
  metalness: 0.22,
  ...extra,
})

const metalMat = (color, emissive = null, emissiveIntensity = 0.25) => new THREE.MeshStandardMaterial({
  color,
  roughness: 0.28,
  metalness: 0.85,
  ...(emissive ? { emissive, emissiveIntensity } : {}),
})

const glowMat = (color, opacity = 0.85) => new THREE.MeshBasicMaterial({
  color,
  transparent: true,
  opacity,
  side: THREE.DoubleSide,
  depthWrite: false,
})

const mesh = (geo, material) => {
  const m = new THREE.Mesh(geo, material)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

const removeTaggedChildren = (anchor, tag) => {
  if (!anchor) return
  for (const child of [...anchor.children]) {
    if (child.userData?.[tag]) {
      anchor.remove(child)
      child.traverse?.((o) => {
        o.geometry?.dispose?.()
        if (Array.isArray(o.material)) o.material.forEach((m) => m?.dispose?.())
        else o.material?.dispose?.()
      })
    }
  }
}

// -----------------------------------------------------------------------------
// 1. NPC VISUAL REDESIGN (Role-Specific Models, Props, Faces & Idle Life)
// -----------------------------------------------------------------------------

function createFaceDetails(skinColor = 0xe8b78f, eyeColor = 0x1e293b, hairColor = 0x2e1e17, hasBeard = false) {
  const faceGroup = new THREE.Group()
  faceGroup.name = 'FaceDetails'

  // Eyes with reflection speculars
  const eyeMat = new THREE.MeshBasicMaterial({ color: eyeColor })
  const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff })
  for (const side of [-1, 1]) {
    const sclera = mesh(new THREE.BoxGeometry(0.065, 0.045, 0.02), whiteMat)
    sclera.position.set(side * 0.085, 0.04, 0.245)
    faceGroup.add(sclera)

    const pupil = mesh(new THREE.BoxGeometry(0.038, 0.038, 0.022), eyeMat)
    pupil.position.set(side * 0.085, 0.04, 0.25)
    faceGroup.add(pupil)

    // Eyebrow
    const brow = mesh(new THREE.BoxGeometry(0.08, 0.02, 0.025), mat(hairColor))
    brow.position.set(side * 0.085, 0.08, 0.248)
    brow.rotation.z = side * -0.1
    faceGroup.add(brow)
  }

  // Nose bridge
  const nose = mesh(new THREE.BoxGeometry(0.04, 0.06, 0.06), mat(skinColor))
  nose.position.set(0, -0.01, 0.255)
  faceGroup.add(nose)

  // Beard for craftsman/elders
  if (hasBeard) {
    const beard = mesh(new THREE.BoxGeometry(0.24, 0.18, 0.14), mat(hairColor, { roughness: 0.85 }))
    beard.position.set(0, -0.15, 0.18)
    faceGroup.add(beard)
  }

  return faceGroup
}

function decorateNpcOverhaul(npc) {
  if (!npc?.g || npc.g.userData?.visualOverhaulV120) return npc
  npc.g.userData ||= {}
  npc.g.userData.visualOverhaulV120 = true

  const def = npc.def || {}
  const role = def.role || 'generic'
  const root = npc.g

  // Clean old basic procedural meshes if present
  removeTaggedChildren(root, 'npcOverhaulItem')

  const container = new THREE.Group()
  container.name = 'NpcOverhaulVisual'
  container.userData.npcOverhaulItem = true
  root.add(container)

  // Hide or adapt the legacy primitive body/hair if present
  if (npc.body) npc.body.visible = false
  if (npc.head) npc.head.visible = false
  if (npc.hair) npc.hair.visible = false

  const skinColor = def.id === 'brann' ? 0xd89f76 : def.role === 'quest' ? 0xf5d0b5 : 0xe6b38c
  const hairColor = def.id === 'brann' ? 0x6b301c : def.role === 'guild' ? 0xe2e8f0 : def.role === 'quest' ? 0x93c5fd : 0x2b1e16

  // 1. Natural Anatomy & Costumes
  const hips = new THREE.Group()
  hips.position.y = 1.02
  container.add(hips)

  // Torso / Tunics
  const torsoColor = def.color || 0x3b82f6
  const torso = mesh(new THREE.CapsuleGeometry(0.32, 0.72, 6, 12), mat(torsoColor, { roughness: 0.7 }))
  torso.position.y = 0.36
  hips.add(torso)

  // Belt with leather buckle
  const belt = mesh(new THREE.BoxGeometry(0.72, 0.12, 0.44), mat(0x452311))
  belt.position.y = 0.04
  hips.add(belt)
  const buckle = mesh(new THREE.BoxGeometry(0.18, 0.14, 0.46), metalMat(0xf4c95d))
  buckle.position.set(0, 0.04, 0.01)
  hips.add(buckle)

  // Neck & Head
  const neck = new THREE.Group()
  neck.position.y = 0.94
  hips.add(neck)
  const head = mesh(new THREE.SphereGeometry(0.26, 14, 12), mat(skinColor))
  head.position.y = 0.26
  neck.add(head)

  // Facial details
  const face = createFaceDetails(skinColor, 0x1e293b, hairColor, role === 'blacksmith' || role === 'townhall')
  head.add(face)

  // Arms & Hands
  const armL = new THREE.Group()
  const armR = new THREE.Group()
  armL.position.set(-0.44, 0.68, 0)
  armR.position.set(0.44, 0.68, 0)
  hips.add(armL, armR)

  const armMeshL = mesh(new THREE.CapsuleGeometry(0.1, 0.48, 4, 8), mat(torsoColor))
  armMeshL.position.y = -0.28
  armL.add(armMeshL)
  const armMeshR = mesh(new THREE.CapsuleGeometry(0.1, 0.48, 4, 8), mat(torsoColor))
  armMeshR.position.y = -0.28
  armR.add(armMeshR)

  const handL = mesh(new THREE.SphereGeometry(0.11, 8, 8), mat(skinColor))
  handL.position.y = -0.58
  armL.add(handL)
  const handR = mesh(new THREE.SphereGeometry(0.11, 8, 8), mat(skinColor))
  handR.position.y = -0.58
  armR.add(handR)

  // Legs & Boots
  const legL = new THREE.Group()
  const legR = new THREE.Group()
  legL.position.set(-0.19, -0.02, 0)
  legR.position.set(0.19, -0.02, 0)
  hips.add(legL, legR)

  const legMeshL = mesh(new THREE.CapsuleGeometry(0.13, 0.62, 4, 8), mat(0x1e293b))
  legMeshL.position.y = -0.44
  legL.add(legMeshL)
  const legMeshR = mesh(new THREE.CapsuleGeometry(0.13, 0.62, 4, 8), mat(0x1e293b))
  legMeshR.position.y = -0.44
  legR.add(legMeshR)

  const bootL = mesh(new THREE.BoxGeometry(0.24, 0.22, 0.42), mat(0x351f14))
  bootL.position.set(0, -0.85, 0.07)
  legL.add(bootL)
  const bootR = mesh(new THREE.BoxGeometry(0.24, 0.22, 0.42), mat(0x351f14))
  bootR.position.set(0, -0.85, 0.07)
  legR.add(bootR)

  // 2. Role-Specific Props and Outfits
  if (role === 'blacksmith') {
    // Heavy leather smithing apron
    const apron = mesh(new THREE.BoxGeometry(0.58, 0.72, 0.16), mat(0x522915, { roughness: 0.9 }))
    apron.position.set(0, 0.32, 0.22)
    hips.add(apron)

    // Arm sleeves rolled up, work bandanna
    const bandanna = mesh(new THREE.TorusGeometry(0.265, 0.04, 6, 16), mat(0x991b1b))
    bandanna.position.set(0, 0.36, 0)
    bandanna.rotation.x = Math.PI / 2
    head.add(bandanna)

    // Blacksmith Hammer in right hand
    const hammerShaft = mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.65, 8), mat(0x5a341e))
    hammerShaft.position.set(0, -0.15, 0.15)
    hammerShaft.rotation.x = 0.3
    handR.add(hammerShaft)

    const hammerHead = mesh(new THREE.BoxGeometry(0.16, 0.18, 0.34), metalMat(0x475569, 0xf97316, 0.45))
    hammerHead.position.set(0, -0.42, 0.24)
    hammerHead.rotation.x = 0.3
    handR.add(hammerHead)

    // Mini anvil beside blacksmith with soft embers
    const anvil = mesh(new THREE.BoxGeometry(0.48, 0.54, 0.36), metalMat(0x334155))
    anvil.position.set(0.72, 0.27, 0.35)
    container.add(anvil)
    const hotIngot = mesh(new THREE.BoxGeometry(0.16, 0.06, 0.28), mat(0xf97316, { emissive: 0xea580c, emissiveIntensity: 1.2 }))
    hotIngot.position.set(0.72, 0.57, 0.35)
    container.add(hotIngot)

    container.userData.animateIdle = (t) => {
      hotIngot.material.emissiveIntensity = 0.85 + Math.sin(t * 4) * 0.45
    }
  } else if (role === 'merchant') {
    // Grand trade backpack
    const backpack = mesh(new THREE.BoxGeometry(0.64, 0.76, 0.42), mat(0x5a341a))
    backpack.position.set(0, 0.48, -0.38)
    hips.add(backpack)

    const bedroll = mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.72, 10), mat(0x94a3b8))
    bedroll.rotation.z = Math.PI / 2
    bedroll.position.set(0, 0.92, -0.38)
    hips.add(bedroll)

    // Wide feather hat
    const hatBrim = mesh(new THREE.CylinderGeometry(0.44, 0.46, 0.04, 16), mat(0x1e3a5f))
    hatBrim.position.y = 0.44
    head.add(hatBrim)
    const hatCrown = mesh(new THREE.CylinderGeometry(0.25, 0.27, 0.22, 16), mat(0x1e3a5f))
    hatCrown.position.y = 0.54
    head.add(hatCrown)
    const feather = mesh(new THREE.ConeGeometry(0.045, 0.35, 4), mat(0xf59e0b))
    feather.position.set(-0.24, 0.65, 0)
    feather.rotation.z = -0.45
    head.add(feather)

    // Merchant coin pouch
    const coinPouch = mesh(new THREE.SphereGeometry(0.12, 8, 8), mat(0xb45309))
    coinPouch.position.set(-0.35, 0.04, 0.15)
    hips.add(coinPouch)
  } else if (role === 'quest') {
    // Wizard/Sage Hood & Mantle
    const cowl = mesh(new THREE.SphereGeometry(0.32, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.65), mat(0x2563eb))
    cowl.position.y = 0.3
    head.add(cowl)

    // Ornate Arcane Staff in right hand
    const staffShaft = mesh(new THREE.CylinderGeometry(0.03, 0.035, 1.8, 8), mat(0x382215))
    staffShaft.position.set(0, 0.2, 0.2)
    handR.add(staffShaft)

    const staffHead = mesh(new THREE.TorusGeometry(0.16, 0.035, 6, 16), metalMat(0xf59e0b))
    staffHead.position.set(0, 1.05, 0.2)
    handR.add(staffHead)

    const manaOrb = mesh(new THREE.SphereGeometry(0.09, 12, 10), mat(0x60a5fa, { emissive: 0x3b82f6, emissiveIntensity: 1.4 }))
    manaOrb.position.set(0, 1.05, 0.2)
    handR.add(manaOrb)

    // Floating Grimoire in left hand
    const book = new THREE.Group()
    book.position.set(-0.25, 0.15, 0.3)
    const cover = mesh(new THREE.BoxGeometry(0.28, 0.38, 0.1), mat(0x4c1d95))
    const pages = mesh(new THREE.BoxGeometry(0.24, 0.34, 0.08), mat(0xfef08a))
    pages.position.z = 0.02
    book.add(cover, pages)
    handL.add(book)

    container.userData.animateIdle = (t) => {
      manaOrb.material.emissiveIntensity = 1.0 + Math.sin(t * 3) * 0.5
      book.position.y = 0.15 + Math.sin(t * 2.5) * 0.04
      book.rotation.y = Math.sin(t * 1.5) * 0.15
    }
  } else if (role === 'guild') {
    // Gilded Commander Pauldrons
    for (const side of [-1, 1]) {
      const pauldron = mesh(new THREE.BoxGeometry(0.28, 0.18, 0.36), metalMat(0xd97706, 0xfbbf24, 0.3))
      pauldron.position.set(side * 0.04, 0.04, 0)
      pauldron.rotation.z = side * 0.2
      if (side === -1) armL.add(pauldron); else armR.add(pauldron)
    }

    // Royal Guild Crest Mantle
    const cape = mesh(new THREE.PlaneGeometry(0.68, 1.25), mat(0x991b1b, { side: THREE.DoubleSide }))
    cape.position.set(0, 0.48, -0.32)
    cape.rotation.x = 0.15
    hips.add(cape)

    // Sheathed Longsword at hip
    const scabbard = mesh(new THREE.BoxGeometry(0.08, 0.85, 0.05), mat(0x1e293b))
    scabbard.position.set(-0.36, -0.15, 0.05)
    scabbard.rotation.z = 0.25
    hips.add(scabbard)
    const hilt = mesh(new THREE.BoxGeometry(0.22, 0.06, 0.08), metalMat(0xf59e0b))
    hilt.position.set(-0.46, 0.28, 0.05)
    hips.add(hilt)
  } else if (role === 'townhall') {
    // Regal Doublet with fur trim
    const furCollar = mesh(new THREE.TorusGeometry(0.28, 0.07, 6, 16), mat(0xf8fafc, { roughness: 0.9 }))
    furCollar.position.set(0, 0.72, 0)
    furCollar.rotation.x = Math.PI / 2
    hips.add(furCollar)

    // Golden Chain of Office
    const medallion = mesh(new THREE.OctahedronGeometry(0.09, 0), metalMat(0xf59e0b, 0xd97706, 0.5))
    medallion.position.set(0, 0.46, 0.36)
    hips.add(medallion)

    // Royal Scroll in hands
    const scroll = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.42, 10), mat(0xfef3c7))
    scroll.rotation.z = Math.PI / 2
    scroll.position.set(0, 0.02, 0.22)
    handR.add(scroll)
  } else if (role === 'pets') {
    // Beastmaster outfit with taming satchel
    const satchel = mesh(new THREE.BoxGeometry(0.28, 0.32, 0.16), mat(0x78350f))
    satchel.position.set(0.32, 0.08, 0.15)
    hips.add(satchel)

    // Animated Companion Wisp (Mini glowing pet orbiting Kael)
    const wispPivot = new THREE.Group()
    wispPivot.position.set(0, 1.6, 0)
    container.add(wispPivot)

    const wispCore = mesh(new THREE.SphereGeometry(0.08, 10, 8), mat(0x38bdf8, { emissive: 0x0ea5e9, emissiveIntensity: 1.5 }))
    wispCore.position.set(0.72, 0.3, 0)
    wispPivot.add(wispCore)

    const wispRing = mesh(new THREE.TorusGeometry(0.12, 0.015, 6, 16), glowMat(0x7dd3fc, 0.8))
    wispRing.position.copy(wispCore.position)
    wispPivot.add(wispRing)

    container.userData.animateIdle = (t) => {
      wispPivot.rotation.y = t * 1.8
      wispCore.position.y = 0.3 + Math.sin(t * 3.5) * 0.1
      wispRing.position.y = wispCore.position.y
      wispRing.rotation.x = t * 2
    }
  } else if (role === 'stable') {
    // Straw Hat
    const strawHat = mesh(new THREE.CylinderGeometry(0.48, 0.5, 0.04, 16), mat(0xfde68a, { roughness: 0.9 }))
    strawHat.position.y = 0.44
    head.add(strawHat)
    const strawCrown = mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.18, 16), mat(0xfde68a, { roughness: 0.9 }))
    strawCrown.position.y = 0.52
    head.add(strawCrown)

    // Reins in hand
    const brush = mesh(new THREE.BoxGeometry(0.12, 0.08, 0.22), mat(0xb45309))
    brush.position.set(0, -0.05, 0.12)
    handR.add(brush)
  } else {
    // Traveler / Adventurer
    const cloak = mesh(new THREE.ConeGeometry(0.42, 0.95, 8, 1, true), mat(0x475569))
    cloak.position.set(0, 0.35, 0)
    hips.add(cloak)

    // Walking stick with warm lantern
    const stick = mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.7, 8), mat(0x5a341a))
    stick.position.set(0, 0.2, 0.2)
    handR.add(stick)

    const lantern = mesh(new THREE.BoxGeometry(0.14, 0.2, 0.14), metalMat(0x0f172a))
    lantern.position.set(0, 0.78, 0.32)
    handR.add(lantern)
    const bulb = mesh(new THREE.SphereGeometry(0.06, 8, 6), mat(0xfbbf24, { emissive: 0xf59e0b, emissiveIntensity: 1.6 }))
    bulb.position.copy(lantern.position)
    handR.add(bulb)
  }

  // Hook idle animation into NPC object
  npc.overhaulVisual = container
  npc.overhaulHips = hips
  npc.overhaulHead = head

  return npc
}

// -----------------------------------------------------------------------------
// 2. PLAYER CHARACTER VISUAL REDESIGN (Heroic Anatomy, Cape, Hands & Class Aura)
// -----------------------------------------------------------------------------

function decoratePlayerOverhaul(game, root) {
  if (!root || root.userData?.visualOverhaulV120) return root
  root.userData ||= {}
  root.userData.visualOverhaulV120 = true

  const rig = game.rig
  if (!rig) return root

  // Create or retrieve Hand Sockets for solid weapon grip
  if (!rig.shoulderR.userData?.handSocketR) {
    const handSocketR = new THREE.Group()
    handSocketR.name = 'RightHandSocket'
    handSocketR.position.set(0, -0.63, 0)
    rig.shoulderR.add(handSocketR)
    rig.shoulderR.userData.handSocketR = handSocketR
    rig.handSocketR = handSocketR
  }

  if (!rig.shoulderL.userData?.handSocketL) {
    const handSocketL = new THREE.Group()
    handSocketL.name = 'LeftHandSocket'
    handSocketL.position.set(0, -0.63, 0)
    rig.shoulderL.add(handSocketL)
    rig.shoulderL.userData.handSocketL = handSocketL
    rig.handSocketL = handSocketL
  }

  // Sculpted heroic gauntlets on hands
  for (const [shoulder, side] of [[rig.shoulderL, -1], [rig.shoulderR, 1]]) {
    removeTaggedChildren(shoulder, 'heroicGauntlet')
    const gauntlet = new THREE.Group()
    gauntlet.userData.heroicGauntlet = true
    gauntlet.position.set(0, -0.52, 0)

    const cuff = mesh(new THREE.CylinderGeometry(0.125, 0.115, 0.24, 8), metalMat(0x334155, 0x64748b, 0.2))
    gauntlet.add(cuff)
    const knuckleGuard = mesh(new THREE.BoxGeometry(0.14, 0.08, 0.16), metalMat(0x94a3b8))
    knuckleGuard.position.set(0, -0.11, 0.04)
    gauntlet.add(knuckleGuard)

    shoulder.add(gauntlet)
  }

  // Heroic Facial/Head Accents
  if (rig.head) {
    removeTaggedChildren(rig.head, 'heroicHeadAccents')
    const headAccents = new THREE.Group()
    headAccents.userData.heroicHeadAccents = true

    // Glowing Heroic Eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    for (const side of [-1, 1]) {
      const eye = mesh(new THREE.BoxGeometry(0.06, 0.035, 0.02), eyeMat)
      eye.position.set(side * 0.09, 0.02, 0.28)
      headAccents.add(eye)
    }

    // Hero Headband / Crown
    const circlet = mesh(new THREE.TorusGeometry(0.295, 0.025, 6, 18), metalMat(0xf59e0b, 0xd97706, 0.4))
    circlet.position.set(0, 0.08, 0)
    circlet.rotation.x = Math.PI / 2
    headAccents.add(circlet)

    rig.head.add(headAccents)
  }

  // Dynamic Class Aura Base
  removeTaggedChildren(root, 'classAura')
  const classAura = new THREE.Group()
  classAura.name = 'ClassAura'
  classAura.userData.classAura = true
  root.add(classAura)

  const auraRing = mesh(new THREE.RingGeometry(0.75, 1.15, 24), glowMat(0x38bdf8, 0.55))
  auraRing.rotation.x = -Math.PI / 2
  auraRing.position.y = 0.06
  classAura.add(auraRing)

  const auraRune = mesh(new THREE.TorusGeometry(0.95, 0.03, 6, 24), glowMat(0x38bdf8, 0.8))
  auraRune.rotation.x = -Math.PI / 2
  auraRune.position.y = 0.07
  classAura.add(auraRune)

  rig.classAura = classAura
  rig.auraRing = auraRing
  rig.auraRune = auraRune

  return root
}

// -----------------------------------------------------------------------------
// 3. WEAPONS REDESIGN & HAND POSITIONING (Swords, Bows in Left Hand, Axes, etc.)
// -----------------------------------------------------------------------------

function colorForRarity(tier = 0, fallback = 0xdde6ef) {
  const table = [0xdde6ef, 0x4ade80, 0x38bdf8, 0xc084fc, 0xf59e0b, 0xf43f5e]
  return new THREE.Color(table[Math.min(tier, table.length - 1)] || fallback)
}

function makeOverhaulSword(item) {
  const root = new THREE.Group()
  const tier = Math.max(0, Number(item?.rarityTier) || 0)
  const auraColor = colorForRarity(tier)
  const bladeSteel = new THREE.Color(0xdbe4ee).lerp(auraColor, 0.22)
  const bladeMat = metalMat(bladeSteel, tier >= 2 ? auraColor : null, tier >= 3 ? 0.75 : 0.35)
  const hiltGold = metalMat(tier >= 4 ? 0xfcd34d : 0x94a3b8)
  const gripLeather = mat(tier >= 3 ? 0x1e1b4b : 0x3e2315, { roughness: 0.85 })

  // 1. Grip / Handle (Centered directly inside hand at y = 0)
  const grip = mesh(new THREE.CylinderGeometry(0.038, 0.042, 0.26, 10), gripLeather)
  grip.position.y = 0
  root.add(grip)

  // Pommel counterweight below hand
  const pommel = mesh(new THREE.OctahedronGeometry(0.08, 0), hiltGold)
  pommel.position.y = -0.17
  root.add(pommel)

  // 2. Crossguard (Resting cleanly right above knuckles)
  const guard = mesh(new THREE.BoxGeometry(0.44, 0.065, 0.11), hiltGold)
  guard.position.y = 0.15
  root.add(guard)

  for (const side of [-1, 1]) {
    const quill = mesh(new THREE.ConeGeometry(0.055, 0.18, 5), hiltGold)
    quill.position.set(side * 0.24, 0.18, 0)
    quill.rotation.z = side * -0.65
    root.add(quill)
  }

  // Inset Gem in crossguard
  const gem = mesh(new THREE.OctahedronGeometry(0.055, 0), mat(auraColor, { emissive: auraColor, emissiveIntensity: 1.2 }))
  gem.position.set(0, 0.15, 0.06)
  root.add(gem)

  // 3. Double-edged Blade extending forward/upward
  const blade = mesh(new THREE.BoxGeometry(0.095, 1.15, 0.042), bladeMat)
  blade.position.y = 0.74
  root.add(blade)

  // Central Fuller / Blood Groove
  const fuller = mesh(new THREE.BoxGeometry(0.024, 0.85, 0.046), mat(auraColor, { emissive: auraColor, emissiveIntensity: tier >= 2 ? 0.8 : 0.2 }))
  fuller.position.set(0, 0.7, 0)
  root.add(fuller)

  // Sharp Diamond Tip
  const tip = mesh(new THREE.ConeGeometry(0.068, 0.24, 4), bladeMat)
  tip.position.y = 1.42
  root.add(tip)

  // Sword rotation for natural ready stance
  root.rotation.x = -Math.PI / 2
  root.rotation.z = 0

  return root
}

function makeOverhaulBow(item) {
  const root = new THREE.Group()
  const tier = Math.max(0, Number(item?.rarityTier) || 0)
  const auraColor = colorForRarity(tier, 0xa16207)
  const wood = mat(new THREE.Color(0x5c3317).lerp(auraColor, 0.2), { roughness: 0.7 })
  const hornMat = metalMat(auraColor, auraColor, 0.5)

  // 1. Central Riser / Ergonomic Grip (Held squarely in left hand at y = 0)
  const grip = mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.22, 10), mat(0x2b1810, { roughness: 0.9 }))
  grip.position.set(0, 0, 0)
  root.add(grip)

  // Arrow Rest / Shelf
  const shelf = mesh(new THREE.BoxGeometry(0.06, 0.04, 0.08), hornMat)
  shelf.position.set(0.04, 0.06, 0)
  root.add(shelf)

  // 2. Sculpted Upper & Lower Recurve Limbs
  for (const dir of [1, -1]) {
    const limbMid = mesh(new THREE.CylinderGeometry(0.038, 0.046, 0.55, 8), wood)
    limbMid.position.set(0.08, dir * 0.32, 0)
    limbMid.rotation.z = dir * -0.28
    root.add(limbMid)

    const limbTip = mesh(new THREE.CylinderGeometry(0.024, 0.036, 0.45, 8), wood)
    limbTip.position.set(0.22, dir * 0.72, 0)
    limbTip.rotation.z = dir * 0.42
    root.add(limbTip)

    // Horn / Metal Reinforcement Notch
    const notch = mesh(new THREE.ConeGeometry(0.035, 0.16, 6), hornMat)
    notch.position.set(0.32, dir * 0.96, 0)
    notch.rotation.z = dir * 0.65
    root.add(notch)
  }

  // 3. Taut Bowstring
  const pts = [
    new THREE.Vector3(0.32, 0.96, 0),
    new THREE.Vector3(-0.04, 0, 0),
    new THREE.Vector3(0.32, -0.96, 0),
  ]
  const stringGeo = new THREE.BufferGeometry().setFromPoints(pts)
  const stringMat = new THREE.LineBasicMaterial({ color: tier >= 2 ? auraColor.getHex() : 0xf8fafc, linewidth: 2 })
  const string = new THREE.Line(stringGeo, stringMat)
  root.add(string)

  // Position & Orientation: Held in left hand extending forward
  root.rotation.x = 0
  root.rotation.y = Math.PI / 2
  root.rotation.z = 0.15

  return root
}

function makeOverhaulAxe(item) {
  const root = new THREE.Group()
  const tier = Math.max(0, Number(item?.rarityTier) || 0)
  const auraColor = colorForRarity(tier, 0xb45309)
  const haftWood = mat(0x4a2a18, { roughness: 0.85 })
  const headSteel = metalMat(new THREE.Color(0xcfd8e3).lerp(auraColor, 0.2), auraColor, 0.35)

  // Grip at hand center
  const haft = mesh(new THREE.CylinderGeometry(0.038, 0.042, 0.95, 8), haftWood)
  haft.position.y = 0.12
  root.add(haft)

  // Heavy Bearded Axe Head
  const axeHead = mesh(new THREE.BoxGeometry(0.42, 0.28, 0.1), headSteel)
  axeHead.position.set(0.18, 0.52, 0)
  root.add(axeHead)

  // Curved Cutting Edge
  const cuttingEdge = mesh(new THREE.ConeGeometry(0.22, 0.38, 4), metalMat(auraColor, auraColor, 0.6))
  cuttingEdge.position.set(0.44, 0.52, 0)
  cuttingEdge.rotation.z = -Math.PI / 2
  root.add(cuttingEdge)

  // Back Spike
  const spike = mesh(new THREE.ConeGeometry(0.06, 0.22, 4), headSteel)
  spike.position.set(-0.16, 0.52, 0)
  spike.rotation.z = Math.PI / 2
  root.add(spike)

  root.rotation.x = -Math.PI / 2
  return root
}

function makeOverhaulDagger(item) {
  const root = new THREE.Group()
  const tier = Math.max(0, Number(item?.rarityTier) || 0)
  const auraColor = colorForRarity(tier, 0x94a3b8)
  const bladeSteel = metalMat(new THREE.Color(0xe2e8f0).lerp(auraColor, 0.25), auraColor, 0.4)

  const grip = mesh(new THREE.CylinderGeometry(0.032, 0.036, 0.22, 8), mat(0x1e1b4b))
  grip.position.y = 0
  root.add(grip)

  const guard = mesh(new THREE.BoxGeometry(0.28, 0.05, 0.08), metalMat(auraColor))
  guard.position.y = 0.12
  root.add(guard)

  const blade = mesh(new THREE.BoxGeometry(0.075, 0.58, 0.035), bladeSteel)
  blade.position.y = 0.42
  root.add(blade)

  const tip = mesh(new THREE.ConeGeometry(0.052, 0.18, 4), bladeSteel)
  tip.position.y = 0.78
  root.add(tip)

  root.rotation.x = -Math.PI / 2
  return root
}

function makeOverhaulSpellbook(item) {
  const root = new THREE.Group()
  const tier = Math.max(0, Number(item?.rarityTier) || 0)
  const auraColor = colorForRarity(tier, 0x8b5cf6)

  // Floating tome hovering gently above/beside hand
  const book = new THREE.Group()
  book.position.set(0.12, 0.25, 0.15)
  root.add(book)

  const cover = mesh(new THREE.BoxGeometry(0.36, 0.48, 0.12), mat(0x3b0764, { roughness: 0.6 }))
  const pages = mesh(new THREE.BoxGeometry(0.32, 0.44, 0.1), mat(0xfef9c3))
  pages.position.z = 0.015
  book.add(cover, pages)

  // Rotating Runic Mandala above open book
  const seal = mesh(new THREE.TorusGeometry(0.18, 0.018, 6, 16), glowMat(auraColor, 0.9))
  seal.rotation.x = Math.PI / 2
  seal.position.y = 0.28
  book.add(seal)

  root.userData.animateBook = (t) => {
    book.position.y = 0.25 + Math.sin(t * 3) * 0.04
    book.rotation.y = Math.sin(t * 1.5) * 0.15
    seal.rotation.z = t * 2
  }

  return root
}

function buildOverhaulWeapon(game, item) {
  const rig = game.rig
  if (!rig) return

  // Retrieve or create hand sockets
  const socketR = rig.handSocketR || rig.shoulderR
  const socketL = rig.handSocketL || rig.shoulderL

  removeTaggedChildren(socketR, 'overhaulWeapon')
  removeTaggedChildren(socketL, 'overhaulWeapon')
  if (game.weaponVisual) {
    for (const part of game.weaponVisual.userData?.proceduralParts || []) part.visible = false
  }

  if (!item) {
    if (game.weaponVisual) {
      for (const part of game.weaponVisual.userData?.proceduralParts || []) part.visible = true
    }
    return
  }

  const subtype = item.subtype || 'sword'
  const isBow = subtype === 'bow'
  const isSpellbook = subtype === 'spellbook'

  let weaponMesh = null
  let targetSocket = socketR

  if (isBow) {
    weaponMesh = makeOverhaulBow(item)
    targetSocket = socketL // Bow held firmly in left hand
  } else if (isSpellbook) {
    weaponMesh = makeOverhaulSpellbook(item)
    targetSocket = socketL // Spellbook levitates near off-hand
  } else if (subtype === 'axe') {
    weaponMesh = makeOverhaulAxe(item)
  } else if (subtype === 'dagger') {
    weaponMesh = makeOverhaulDagger(item)
  } else {
    weaponMesh = makeOverhaulSword(item)
  }

  weaponMesh.userData.overhaulWeapon = true
  weaponMesh.name = `OverhaulWeapon:${subtype}`
  targetSocket.add(weaponMesh)

  // Store active reference for animations
  game.activeOverhaulWeapon = weaponMesh
  game.activeOverhaulWeaponType = subtype
}

// -----------------------------------------------------------------------------
// 4. ARMOR REDESIGN (Sculpted Cuirass, Segmented Pauldrons & Greaves)
// -----------------------------------------------------------------------------

function buildOverhaulArmor(game, item) {
  const rig = game.rig
  if (!rig || !rig.hips) return

  removeTaggedChildren(rig.hips, 'overhaulArmor')
  removeTaggedChildren(rig.shoulderL, 'overhaulArmor')
  removeTaggedChildren(rig.shoulderR, 'overhaulArmor')
  removeTaggedChildren(rig.legL, 'overhaulArmor')
  removeTaggedChildren(rig.legR, 'overhaulArmor')

  if (!item) return

  const tier = Math.max(0, Number(item.rarityTier) || 0)
  const aura = colorForRarity(tier, 0x64748b)
  const steel = new THREE.Color(0x475569).lerp(aura, 0.25)
  const steelMat = metalMat(steel, tier >= 2 ? aura : null, tier >= 3 ? 0.5 : 0.2)
  const goldTrim = metalMat(tier >= 4 ? 0xf59e0b : 0x94a3b8)

  // 1. Layered Cuirass / Breastplate
  const cuirass = new THREE.Group()
  cuirass.userData.overhaulArmor = true
  cuirass.position.set(0, 0.38, 0)

  const chest = mesh(new THREE.BoxGeometry(0.78, 0.68, 0.24), steelMat)
  chest.position.set(0, 0.05, 0.21)
  cuirass.add(chest)

  const centralRidge = mesh(new THREE.BoxGeometry(0.14, 0.64, 0.28), goldTrim)
  centralRidge.position.set(0, 0.05, 0.21)
  cuirass.add(centralRidge)

  // Glowing Chest Rune Emblem
  const emblem = mesh(new THREE.OctahedronGeometry(0.11, 0), mat(aura, { emissive: aura, emissiveIntensity: 1.2 }))
  emblem.position.set(0, 0.12, 0.38)
  cuirass.add(emblem)

  // Armored Faulds / Tassets on Hips
  for (const side of [-1, 1]) {
    const tasset = mesh(new THREE.BoxGeometry(0.26, 0.28, 0.14), steelMat)
    tasset.position.set(side * 0.32, -0.28, 0.12)
    tasset.rotation.z = side * -0.15
    cuirass.add(tasset)
  }

  rig.hips.add(cuirass)

  // 2. Segmented Pauldrons (Shoulders)
  for (const [shoulder, side] of [[rig.shoulderL, -1], [rig.shoulderR, 1]]) {
    const pauldronGroup = new THREE.Group()
    pauldronGroup.userData.overhaulArmor = true

    const mainPlate = mesh(new THREE.BoxGeometry(0.34, 0.22, 0.42), steelMat)
    mainPlate.position.set(side * 0.03, 0.02, 0)
    mainPlate.rotation.z = side * 0.18
    pauldronGroup.add(mainPlate)

    const trimPlate = mesh(new THREE.BoxGeometry(0.36, 0.06, 0.44), goldTrim)
    trimPlate.position.set(side * 0.03, 0.12, 0)
    trimPlate.rotation.z = side * 0.18
    pauldronGroup.add(trimPlate)

    shoulder.add(pauldronGroup)
  }

  // 3. Armored Greaves & Knee Poleyns (Legs)
  for (const [leg, side] of [[rig.legL, -1], [rig.legR, 1]]) {
    const greaveGroup = new THREE.Group()
    greaveGroup.userData.overhaulArmor = true

    const poleyn = mesh(new THREE.BoxGeometry(0.22, 0.18, 0.14), goldTrim)
    poleyn.position.set(0, -0.32, 0.16)
    greaveGroup.add(poleyn)

    const shinPlate = mesh(new THREE.BoxGeometry(0.24, 0.44, 0.14), steelMat)
    shinPlate.position.set(0, -0.58, 0.14)
    greaveGroup.add(shinPlate)

    leg.add(greaveGroup)
  }
}

// -----------------------------------------------------------------------------
// 5. ATTACK, DEFEND, RUN & POWER VISUAL FX
// -----------------------------------------------------------------------------

// --- Attack Effects: 3D Crescent Slash Arc & Impact Sparks ---
function spawnSlashArcFX(game, color = 0x38bdf8, isBow = false) {
  if (!game?.player) return
  const scene = game.state.dungeon ? game.dungeonArena : game.scene
  if (!scene) return

  if (isBow) {
    // Sonic bow release shock ring
    const ringGeo = new THREE.RingGeometry(0.15, 0.35, 16)
    const ringMat = glowMat(color, 0.95)
    const ringMesh = new THREE.Mesh(ringGeo, ringMat)
    ringMesh.position.copy(game.player.position)
    ringMesh.position.y += 1.35
    ringMesh.rotation.y = game.player.rotation.y
    scene.add(ringMesh)

    game.effects.push({
      type: 'bowRelease',
      object: ringMesh,
      material: ringMat,
      life: 0.28,
      maxLife: 0.28,
    })
    return
  }

  // 3D Crescent Slash Arc Mesh
  const arcGeo = new THREE.RingGeometry(1.2, 1.75, 24, 1, 0, Math.PI * 0.85)
  const arcMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
  const arcMesh = new THREE.Mesh(arcGeo, arcMat)

  // Orient in front of the player along sword swing plane
  arcMesh.position.copy(game.player.position)
  arcMesh.position.y += 1.15
  arcMesh.rotation.y = game.player.rotation.y - Math.PI * 0.4
  arcMesh.rotation.x = 0.25
  scene.add(arcMesh)

  game.effects.push({
    type: 'slashArc',
    object: arcMesh,
    material: arcMat,
    life: 0.24,
    maxLife: 0.24,
  })
}

function spawnCombatSparks(game, position, color = 0xf59e0b, count = 12) {
  const scene = game.state.dungeon ? game.dungeonArena : game.scene
  if (!scene || !position) return

  const sparkMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, depthWrite: false })
  const sparkGeo = new THREE.BoxGeometry(0.06, 0.06, 0.12)

  for (let i = 0; i < count; i++) {
    const s = new THREE.Mesh(sparkGeo, sparkMat)
    s.position.copy(position)
    s.position.y += 0.3 + (Math.random() - 0.5) * 0.3

    const dir = new THREE.Vector3(
      (Math.random() - 0.5) * 4.5,
      Math.random() * 3.5 + 1.2,
      (Math.random() - 0.5) * 4.5
    )
    scene.add(s)

    game.effects.push({
      type: 'sparkParticle',
      object: s,
      dir,
      life: 0.35 + Math.random() * 0.15,
      maxLife: 0.5,
      material: sparkMat,
    })
  }
}

// --- Defend Effects: Glowing Hexagonal Energy Aegis Barrier ---
function updateDefendShieldFX(game, dt, isBlocking) {
  if (!game?.player) return

  if (!game.defendAegisShield) {
    // Create Hexagonal Energy Aegis
    const aegisGroup = new THREE.Group()
    aegisGroup.name = 'DefendAegis'

    const shieldMat = glowMat(0x38bdf8, 0.72)
    const shieldGeo = new THREE.CircleGeometry(0.95, 6)
    const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat)
    shieldMesh.position.set(0, 1.25, 0.75)
    aegisGroup.add(shieldMesh)

    // Glowing rim
    const rimGeo = new THREE.RingGeometry(0.92, 1.05, 6)
    const rimMat = glowMat(0x93c5fd, 0.95)
    const rimMesh = new THREE.Mesh(rimGeo, rimMat)
    rimMesh.position.set(0, 1.25, 0.76)
    aegisGroup.add(rimMesh)

    // Inner hex core
    const coreGeo = new THREE.CircleGeometry(0.42, 6)
    const coreMat = glowMat(0xffffff, 0.85)
    const coreMesh = new THREE.Mesh(coreGeo, coreMat)
    coreMesh.position.set(0, 1.25, 0.77)
    aegisGroup.add(coreMesh)

    game.player.add(aegisGroup)
    game.defendAegisShield = aegisGroup
    game.defendAegisShield.visible = false
    game.defendAegisMat = shieldMat
    game.defendAegisRimMat = rimMat
  }

  const aegis = game.defendAegisShield
  if (isBlocking) {
    aegis.visible = true
    const pulse = 0.7 + Math.sin(performance.now() * 0.008) * 0.22
    game.defendAegisMat.opacity = pulse
    aegis.scale.setScalar(0.95 + Math.sin(performance.now() * 0.006) * 0.06)
  } else {
    aegis.visible = false
  }
}

function spawnDefendHitFX(game) {
  if (!game?.player) return
  const scene = game.state.dungeon ? game.dungeonArena : game.scene
  if (!scene) return

  // Rapid ripple ring expanding across shield face
  const rippleGeo = new THREE.RingGeometry(0.2, 0.4, 6)
  const rippleMat = glowMat(0xffffff, 1.0)
  const rippleMesh = new THREE.Mesh(rippleGeo, rippleMat)

  const forward = new THREE.Vector3(Math.sin(game.player.rotation.y), 0, Math.cos(game.player.rotation.y))
  rippleMesh.position.copy(game.player.position).addScaledVector(forward, 0.75)
  rippleMesh.position.y += 1.25
  rippleMesh.rotation.y = game.player.rotation.y
  scene.add(rippleMesh)

  game.effects.push({
    type: 'defendRipple',
    object: rippleMesh,
    material: rippleMat,
    life: 0.28,
    maxLife: 0.28,
  })

  // Spark burst at shield contact
  spawnCombatSparks(game, rippleMesh.position, 0x93c5fd, 14)
}

// --- Running Effects: Billowing Dust Clouds & Speed Streaks ---
function updateRunningDustFX(game, dt, moving, isSprinting) {
  if (!game?.player || !moving || !game.grounded) return
  const scene = game.state.dungeon ? game.dungeonArena : game.scene
  if (!scene) return

  game._dustTimer = (game._dustTimer || 0) + dt
  const interval = isSprinting ? 0.09 : 0.16

  if (game._dustTimer >= interval) {
    game._dustTimer = 0

    // Spawn dust puff under feet
    const dustMat = glowMat(0xd4d4d8, 0.55)
    const dustGeo = new THREE.SphereGeometry(isSprinting ? 0.28 : 0.18, 6, 5)
    const dust = new THREE.Mesh(dustGeo, dustMat)

    const side = Math.random() > 0.5 ? -0.22 : 0.22
    const forward = new THREE.Vector3(Math.sin(game.player.rotation.y), 0, Math.cos(game.player.rotation.y))
    const right = new THREE.Vector3(forward.z, 0, -forward.x)

    dust.position.copy(game.player.position)
      .addScaledVector(forward, -0.4)
      .addScaledVector(right, side)
    dust.position.y = 0.12
    scene.add(dust)

    game.effects.push({
      type: 'dustPuff',
      object: dust,
      material: dustMat,
      life: 0.38,
      maxLife: 0.38,
      growRate: isSprinting ? 2.6 : 1.8,
    })
  }
}

// --- Power & Skill Effects: Multi-tiered Runic Mandala & Geysers ---
function spawnOverhaulAbilityFX(game, color = 0x38bdf8, radius = 4.0, duration = 0.65) {
  const scene = game.state.dungeon ? game.dungeonArena : game.scene
  if (!scene || !game?.player) return

  const origin = game.player.position.clone()

  // 1. Expanding Sacred Mandala Circle on Ground
  const mandalaGeo = new THREE.RingGeometry(0.2, 0.45, 24)
  const mandalaMat = glowMat(color, 0.95)
  const mandala = new THREE.Mesh(mandalaGeo, mandalaMat)
  mandala.rotation.x = -Math.PI / 2
  mandala.position.copy(origin)
  mandala.position.y = 0.14
  scene.add(mandala)

  // 2. Rising Elemental Light Pillar / Geyser
  const pillarGeo = new THREE.CylinderGeometry(radius * 0.65, radius * 0.85, 5.5, 16, 1, true)
  const pillarMat = glowMat(color, 0.65)
  const pillar = new THREE.Mesh(pillarGeo, pillarMat)
  pillar.position.copy(origin)
  pillar.position.y = 2.75
  scene.add(pillar)

  // 3. Orbiting Energy Motes
  for (let i = 0; i < 8; i++) {
    const moteGeo = new THREE.OctahedronGeometry(0.12, 0)
    const moteMat = glowMat(0xffffff, 0.9)
    const mote = new THREE.Mesh(moteGeo, moteMat)
    const angle = (i / 8) * Math.PI * 2
    mote.position.set(origin.x + Math.cos(angle) * radius * 0.6, origin.y + 0.8 + Math.random(), origin.z + Math.sin(angle) * radius * 0.6)
    scene.add(mote)

    game.effects.push({
      type: 'abilityMote',
      object: mote,
      material: moteMat,
      life: duration,
      maxLife: duration,
    })
  }

  game.effects.push({
    type: 'abilityMandala',
    object: mandala,
    material: mandalaMat,
    targetRadius: radius,
    life: duration,
    maxLife: duration,
  })

  game.effects.push({
    type: 'abilityPillar',
    object: pillar,
    material: pillarMat,
    life: duration * 0.85,
    maxLife: duration * 0.85,
  })
}

// -----------------------------------------------------------------------------
// 6. ENGINE PROTOTYPE PATCHES & LIFECYCLE
// -----------------------------------------------------------------------------

if (!ShadowGame.prototype[OVERHAUL_FLAG]) {
  const proto = ShadowGame.prototype
  Object.defineProperty(proto, OVERHAUL_FLAG, { value: true })

  // 1. Hook NPC Creation
  const previousMakeNpc = proto.makeNpc
  proto.makeNpc = function visualOverhaulMakeNpc(...args) {
    const npc = previousMakeNpc.apply(this, args)
    return decorateNpcOverhaul(npc)
  }

  // 2. Hook Player Creation
  const previousMakePlayer = proto.makePlayer
  proto.makePlayer = function visualOverhaulMakePlayer(...args) {
    const root = previousMakePlayer.apply(this, args)
    return decoratePlayerOverhaul(this, root)
  }

  // 3. Hook Equipment Updates (Weapons & Armor)
  const previousUpdateEquipmentVisuals = proto.updateEquipmentVisuals
  proto.updateEquipmentVisuals = function visualOverhaulEquipment(...args) {
    const result = previousUpdateEquipmentVisuals?.apply(this, args)
    const eq = this.state?.equipment || {}

    const weaponSig = eq.weapon ? `${eq.weapon.id || eq.weapon.name}:${eq.weapon.upgrade || 0}:${eq.weapon.rarity || ''}:${eq.weapon.subtype || 'sword'}` : 'none'
    if (this._lastOverhaulWeaponSig !== weaponSig) {
      this._lastOverhaulWeaponSig = weaponSig
      buildOverhaulWeapon(this, eq.weapon || null)
    }

    const armorSig = eq.armor ? `${eq.armor.id || eq.armor.name}:${eq.armor.upgrade || 0}:${eq.armor.rarity || ''}` : 'none'
    if (this._lastOverhaulArmorSig !== armorSig) {
      this._lastOverhaulArmorSig = armorSig
      buildOverhaulArmor(this, eq.armor || null)
    }

    return result
  }

  // 4. Hook Combat Attack with Slash Waves & Bow Stances
  const previousAttack = proto.attack
  proto.attack = function visualOverhaulAttack(...args) {
    const isBow = this.state?.equipment?.weapon?.subtype === 'bow'
    const color = this.state?.equipment?.weapon ? colorForRarity(this.state.equipment.weapon.rarityTier).getHex() : 0x38bdf8

    // Trigger visual slash wave or bow release
    if (this.state?.stamina >= (isBow ? 12 : 15)) {
      spawnSlashArcFX(this, color, isBow)
    }

    return previousAttack.apply(this, args)
  }

  // 5. Hook Enemy Damage for Hit Sparks
  const previousDamageEnemy = proto.damageEnemy
  proto.damageEnemy = function visualOverhaulDamageEnemy(enemy, amount, opts = {}) {
    const result = previousDamageEnemy.call(this, enemy, amount, opts)
    if (result && enemy?.g?.position) {
      const isCrit = opts.crit || false
      const sparkColor = isCrit ? 0xf59e0b : 0x60a5fa
      spawnCombatSparks(this, enemy.g.position, sparkColor, isCrit ? 22 : 14)
    }
    return result
  }

  // 6. Hook Damage Player for Defend / Block Feedback
  const previousDamagePlayer = proto.damagePlayer
  proto.damagePlayer = function visualOverhaulDamagePlayer(amount) {
    const wasBlocking = !!this.state?.blocking && this.state?.stamina >= 8
    const dealt = previousDamagePlayer.call(this, amount)
    if (wasBlocking) {
      spawnDefendHitFX(this)
    }
    return dealt
  }

  // 7. Hook Ability Casting for Spectacular 3D Geysers & Runic Mandalas
  const previousSpawnAbilityRing = proto.spawnAbilityRing
  proto.spawnAbilityRing = function visualOverhaulAbilityRing(color = 0x38bdf8, radius = 3.5, duration = 0.55) {
    spawnOverhaulAbilityFX(this, color, radius, duration)
    return previousSpawnAbilityRing.call(this, color, radius, duration)
  }

  // 8. Hook Player Animation Loop (Defend Stance, Bow Pull, Cape Wave & Dust FX)
  const previousAnimatePlayer = proto.animatePlayer
  proto.animatePlayer = function visualOverhaulAnimate(dt, t, moving) {
    previousAnimatePlayer.call(this, dt, t, moving)
    if (!this.rig) return

    const isBlocking = !!this.state?.blocking
    const isSprinting = (this.keys?.ControlLeft || this.state?.mobileRunning) && this.state?.stamina > 2
    const isBow = this.activeOverhaulWeaponType === 'bow'

    // 1. Defend Stance
    updateDefendShieldFX(this, dt, isBlocking)
    if (isBlocking) {
      // Raise left arm shield/guard forward and angle torso
      this.rig.shoulderL.rotation.x = -1.25
      this.rig.shoulderL.rotation.y = 0.45
      this.rig.shoulderR.rotation.x = -0.75
      this.rig.shoulderR.rotation.y = -0.3
    } else if (isBow && this.attackClock > 0) {
      // Archer Aim/Draw Stance: Left arm straight forward, right arm drawing string
      this.rig.shoulderL.rotation.x = -1.55
      this.rig.shoulderL.rotation.y = 0.25
      this.rig.shoulderR.rotation.x = -1.25
      this.rig.shoulderR.rotation.y = -0.45
    }

    // 2. Running Dust FX
    updateRunningDustFX(this, dt, moving, isSprinting)

    // 3. Class Aura Color & Pulse
    if (this.rig.classAura) {
      const activeId = this.state?.classState?.activeClassId || 'mercenary_swordsman'
      const cls = CLASSES_LIST?.find((c) => c.id === activeId)
      const auraColor = cls?.auraColor || 0x38bdf8

      if (this.rig.auraRing?.material) {
        this.rig.auraRing.material.color.setHex(auraColor)
        this.rig.auraRing.material.opacity = 0.45 + Math.sin(t * 3.5) * 0.2
      }
      if (this.rig.auraRune?.material) {
        this.rig.auraRune.material.color.setHex(auraColor)
        this.rig.auraRune.rotation.z = t * 1.2
      }
    }

    // 4. Active Spellbook Idle Float
    if (this.activeOverhaulWeapon?.userData?.animateBook) {
      this.activeOverhaulWeapon.userData.animateBook(t)
    }
  }

  // 9. Update Active Effects Loop
  const previousUpdateEffects = proto.updateEffects
  proto.updateEffects = function visualOverhaulEffects(dt) {
    previousUpdateEffects.call(this, dt)

    for (let i = this.effects.length - 1; i >= 0; i--) {
      const fx = this.effects[i]
      if (!fx) continue

      if (fx.type === 'slashArc') {
        const k = 1 - Math.max(0, fx.life) / fx.maxLife
        fx.object.scale.setScalar(1.0 + k * 0.65)
        fx.material.opacity = Math.max(0, 0.9 * (1 - k))
      } else if (fx.type === 'sparkParticle') {
        fx.object.position.addScaledVector(fx.dir, dt)
        fx.dir.y -= 9.8 * dt
        const k = 1 - Math.max(0, fx.life) / fx.maxLife
        fx.material.opacity = Math.max(0, 1 - k)
      } else if (fx.type === 'dustPuff') {
        const k = 1 - Math.max(0, fx.life) / fx.maxLife
        fx.object.position.y += dt * 0.35
        fx.object.scale.addScalar(dt * fx.growRate)
        fx.material.opacity = Math.max(0, 0.55 * (1 - k))
      } else if (fx.type === 'defendRipple') {
        const k = 1 - Math.max(0, fx.life) / fx.maxLife
        fx.object.scale.setScalar(1.0 + k * 2.4)
        fx.material.opacity = Math.max(0, 1 - k)
      } else if (fx.type === 'bowRelease') {
        const k = 1 - Math.max(0, fx.life) / fx.maxLife
        fx.object.scale.setScalar(1.0 + k * 2.8)
        fx.material.opacity = Math.max(0, 1 - k)
      } else if (fx.type === 'abilityMandala') {
        const k = 1 - Math.max(0, fx.life) / fx.maxLife
        const sc = 0.2 + (fx.targetRadius - 0.2) * k
        fx.object.scale.setScalar(sc)
        fx.material.opacity = Math.max(0, 0.95 * (1 - k))
        fx.object.rotation.z += dt * 2
      } else if (fx.type === 'abilityPillar') {
        const k = 1 - Math.max(0, fx.life) / fx.maxLife
        fx.object.scale.y = Math.min(1.0, k * 2.5)
        fx.material.opacity = Math.max(0, 0.65 * (1 - k))
      } else if (fx.type === 'abilityMote') {
        const k = 1 - Math.max(0, fx.life) / fx.maxLife
        fx.object.position.y += dt * 2.8
        fx.material.opacity = Math.max(0, 1 - k)
      }
    }
  }

  // 10. Update NPCs Idle Animations (Breathing, Pets, Forge, Orbs)
  const previousUpdateNpcs = proto.updateNpcs
  proto.updateNpcs = function visualOverhaulUpdateNpcs(dt, t) {
    if (previousUpdateNpcs) previousUpdateNpcs.call(this, dt, t)

    for (const npc of this.npcs || []) {
      if (!npc?.g) continue

      // Apply overhaul decoration if not yet decorated
      if (!npc.g.userData?.visualOverhaulV120) {
        decorateNpcOverhaul(npc)
      }

      // Idle breathing: slight rhythmic chest expansion and head motion
      if (npc.overhaulHips) {
        npc.overhaulHips.position.y = 1.02 + Math.sin(t * 2 + (npc.def?.x || 0)) * 0.018
      }

      // Role specific idle animations
      if (npc.overhaulVisual?.userData?.animateIdle) {
        npc.overhaulVisual.userData.animateIdle(t)
      }
    }
  }
}
