// mobVisualOverhaul.js - Rich Procedural Mob Models & Animations for Asterra
// Replaces generic biped capsules with distinct creature anatomies:
// 1. Quadrupeds (Wolves, Foxes, Boars, Stags, Goats)
// 2. Invertebrates/Arthropods (Spiders, Scorpions, Beetles, Crabs)
// 3. Gelatinous (Slimes with squash & stretch)
// 4. Heavy Golems & Treants (Rock Titans, Tree Ents, Magma Colossi)
// 5. Armored Humanoids & Undead (Knights, Skeletons, Sentinels)
// 6. Flyers & Serpentine (Crows, Harpies, Sea Serpents, Dragons)
import * as THREE from 'three'
import { ShadowGame } from './engine.js'

const OVERHAUL_FLAG = Symbol.for('shadow-ascension.mob-visual-overhaul.v110')

// --- Helpers & Materials ---
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({
  color,
  roughness: 0.72,
  metalness: 0.1,
  ...extra,
})

const mesh = (geo, material) => {
  const m = new THREE.Mesh(geo, material)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

const norm = (str = '') => String(str)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim()

// Classification of mobs into anatomical archetypes
export function classifyMobArchetype(rawName, zoneId = '') {
  const n = norm(rawName)
  if (n.includes('slime')) return 'slime'
  if (n.includes('aranha') || n.includes('spider')) return 'spider'
  if (n.includes('escorpiao') || n.includes('scorpion')) return 'scorpion'
  if (n.includes('besouro') || n.includes('beetle')) return 'beetle'
  if (n.includes('caranguejo') || n.includes('crab')) return 'crab'
  if (n.includes('lobo') || n.includes('wolf') || n.includes('alfa')) return 'wolf'
  if (n.includes('raposa') || n.includes('fox')) return 'fox'
  if (n.includes('javali') || n.includes('boar')) return 'boar'
  if (n.includes('cervo') || n.includes('stag') || n.includes('bode') || n.includes('goat')) return 'cervid'
  if (n.includes('golem') || n.includes('treant') || n.includes('colosso') || n.includes('xisto')) return 'golem'
  if (n.includes('corvo') || n.includes('crow') || n.includes('gaivota') || n.includes('gull') || n.includes('harpia') || n.includes('roc')) return 'bird'
  if (n.includes('dragao') || n.includes('dragon') || n.includes('serpente') || n.includes('leviata')) return 'dragon'
  if (n.includes('cavaleiro') || n.includes('knight') || n.includes('sentinela') || n.includes('arconte') || n.includes('esqueleto') || n.includes('skeleton')) return 'knight'
  if (n.includes('mago') || n.includes('serafim') || n.includes('espectro') || n.includes('fantasma') || n.includes('mimico')) return 'wraith'
  
  // Zone fallbacks
  if (zoneId === 'forest') return 'wolf'
  if (zoneId === 'ember') return 'scorpion'
  if (zoneId === 'highlands') return 'golem'
  if (zoneId === 'coast') return 'crab'
  return 'wolf'
}

// ==========================================
// 1. QUADRUPED BEASTS (Wolves, Boars, Stags, Foxes)
// ==========================================
function buildQuadrupedMesh(name, scale, zoneId, boss) {
  const g = new THREE.Group()
  const n = norm(name)
  const isBoar = n.includes('javali')
  const isFox = n.includes('raposa')
  const isStag = n.includes('cervo')
  const isGoat = n.includes('bode')
  const s = scale * (boss ? 1.4 : 1.0)

  // Color selection
  let bodyColor = 0x64748b // slate default wolf
  let underColor = 0x94a3b8
  let eyeColor = 0x38bdf8

  if (isBoar) {
    bodyColor = 0x3f3226
    underColor = 0x22543d // mossy belly
    eyeColor = 0xf59e0b
  } else if (isFox) {
    bodyColor = 0xd97706
    underColor = 0xfef3c7
    eyeColor = 0x38bdf8
  } else if (isStag) {
    bodyColor = 0x475569
    underColor = 0x818cf8
    eyeColor = 0xa78bfa
  } else if (isGoat) {
    bodyColor = 0x94a3b8
    underColor = 0xc7d2fe
    eyeColor = 0x67e8f9
  } else if (boss) {
    bodyColor = 0x4338ca
    underColor = 0x6366f1
    eyeColor = 0xf43f5e
  }

  // Torso (Horizontal capsule/box)
  const torsoL = (isBoar ? 0.95 : isStag ? 1.1 : 1.0) * s
  const torsoR = (isBoar ? 0.42 : isFox ? 0.28 : 0.32) * s
  const torsoGeo = new THREE.CapsuleGeometry(torsoR, torsoL, 4, 8)
  const torsoMat = mat(bodyColor, { flatShading: true })
  const torso = mesh(torsoGeo, torsoMat)
  torso.rotation.x = Math.PI / 2
  const bodyY = (isBoar ? 0.65 : isStag ? 0.9 : 0.72) * s
  torso.position.set(0, bodyY, 0)
  g.add(torso)

  // Chest / Hump
  if (isBoar) {
    const hump = mesh(new THREE.DodecahedronGeometry(0.38 * s, 1), mat(0x2d4a3e, { flatShading: true }))
    hump.position.set(0, bodyY + 0.22 * s, 0.2 * s)
    hump.scale.set(1.1, 0.9, 1.3)
    g.add(hump)
  }

  // Neck & Head
  const neck = new THREE.Group()
  neck.position.set(0, bodyY + (isStag ? 0.35 : 0.15) * s, (torsoL * 0.5 + 0.1) * s)
  g.add(neck)

  const headGeo = new THREE.DodecahedronGeometry((isFox ? 0.22 : isBoar ? 0.32 : 0.26) * s, 0)
  const head = mesh(headGeo, torsoMat)
  head.position.set(0, (isStag ? 0.25 : 0.12) * s, 0.15 * s)
  neck.add(head)

  // Snout / Muzzle
  const muzzleL = (isBoar ? 0.35 : 0.38) * s
  const muzzleR = (isBoar ? 0.18 : 0.11) * s
  const muzzle = mesh(new THREE.CylinderGeometry(muzzleR * 0.7, muzzleR, muzzleL, 6), mat(underColor))
  muzzle.rotation.x = Math.PI / 2
  muzzle.position.set(0, (isStag ? 0.2 : 0.08) * s, (isBoar ? 0.38 : 0.36) * s)
  neck.add(muzzle)

  // Boar Tusks
  if (isBoar) {
    for (const side of [-1, 1]) {
      const tusk = mesh(new THREE.ConeGeometry(0.06 * s, 0.28 * s, 5), mat(0xfef08a, { roughness: 0.4 }))
      tusk.rotation.x = -Math.PI / 3
      tusk.rotation.z = side * 0.45
      tusk.position.set(side * 0.18 * s, 0.08 * s, 0.42 * s)
      neck.add(tusk)
    }
  }

  // Ears
  for (const side of [-1, 1]) {
    const earGeo = new THREE.ConeGeometry((isFox ? 0.12 : 0.09) * s, (isFox ? 0.26 : 0.18) * s, 4)
    const ear = mesh(earGeo, mat(underColor))
    ear.position.set(side * 0.16 * s, (isStag ? 0.42 : 0.3) * s, 0.08 * s)
    ear.rotation.z = -side * 0.3
    ear.rotation.x = -0.2
    neck.add(ear)
  }

  // Horns / Antlers for Cervids or Goats
  if (isStag) {
    for (const side of [-1, 1]) {
      const antler = new THREE.Group()
      antler.position.set(side * 0.14 * s, 0.42 * s, 0.05 * s)
      const mainBranch = mesh(new THREE.CylinderGeometry(0.035 * s, 0.05 * s, 0.55 * s, 5), mat(0x94a3b8, { emissive: 0x6366f1, emissiveIntensity: 0.3 }))
      mainBranch.rotation.z = side * 0.5
      mainBranch.rotation.x = -0.3
      mainBranch.position.y = 0.25 * s
      antler.add(mainBranch)
      const subBranch = mesh(new THREE.CylinderGeometry(0.02 * s, 0.035 * s, 0.3 * s, 4), mainBranch.material)
      subBranch.rotation.z = -side * 0.6
      subBranch.position.set(side * 0.12 * s, 0.32 * s, 0)
      antler.add(subBranch)
      neck.add(antler)
    }
  } else if (isGoat) {
    for (const side of [-1, 1]) {
      const horn = mesh(new THREE.ConeGeometry(0.08 * s, 0.48 * s, 6), mat(0x67e8f9, { roughness: 0.2, metalness: 0.6, emissive: 0x0891b2, emissiveIntensity: 0.4 }))
      horn.rotation.x = -Math.PI / 3
      horn.rotation.z = side * 0.2
      horn.position.set(side * 0.14 * s, 0.35 * s, -0.05 * s)
      neck.add(horn)
    }
  }

  // Glowing Eyes
  const eyeMat = new THREE.MeshBasicMaterial({ color: eyeColor })
  for (const side of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(0.045 * s, 6, 4), eyeMat)
    eye.position.set(side * 0.16 * s, (isStag ? 0.26 : 0.18) * s, 0.28 * s)
    neck.add(eye)
  }

  // Tail
  const tail = new THREE.Group()
  tail.position.set(0, bodyY + 0.15 * s, -torsoL * 0.45 * s)
  const tailL = (isFox ? 0.65 : isBoar ? 0.22 : 0.42) * s
  const tailR = (isFox ? 0.16 : 0.07) * s
  const tailMesh = mesh(new THREE.CylinderGeometry(tailR * 0.4, tailR, tailL, 6), mat(isFox ? 0xfef3c7 : bodyColor))
  tailMesh.position.set(0, -tailL * 0.4, -tailL * 0.3)
  tailMesh.rotation.x = -0.7
  tail.add(tailMesh)
  g.add(tail)

  // 4 Legs (Front Left, Front Right, Back Left, Back Right)
  const legLen = (isBoar ? 0.48 : isStag ? 0.72 : 0.58) * s
  const legR = (isBoar ? 0.11 : 0.08) * s
  const legGeo = new THREE.CylinderGeometry(legR * 0.7, legR, legLen, 6)
  const legMat = mat(0x27272a, { roughness: 0.85 })

  const legPositions = [
    [-0.26 * s, bodyY - 0.05 * s, 0.36 * s],  // FL
    [0.26 * s, bodyY - 0.05 * s, 0.36 * s],   // FR
    [-0.24 * s, bodyY - 0.05 * s, -0.34 * s], // BL
    [0.24 * s, bodyY - 0.05 * s, -0.34 * s],  // BR
  ]

  const legs = []
  for (let i = 0; i < 4; i++) {
    const hip = new THREE.Group()
    hip.position.set(...legPositions[i])
    const lMesh = mesh(legGeo, legMat)
    lMesh.position.y = -legLen * 0.5
    hip.add(lMesh)
    g.add(hip)
    legs.push(hip)
  }

  return {
    group: g,
    type: 'quadruped',
    legs,
    head: neck,
    body: torso,
    tail,
    baseY: 0,
    strideScale: 1.0,
  }
}

// ==========================================
// 2. INVERTEBRATES & ARTHROPODS (Spiders, Scorpions, Beetles, Crabs)
// ==========================================
function buildArthropodMesh(name, scale, zoneId, boss) {
  const g = new THREE.Group()
  const n = norm(name)
  const isScorpion = n.includes('escorpiao') || n.includes('scorpion')
  const isCrab = n.includes('caranguejo') || n.includes('crab')
  const isBeetle = n.includes('besouro') || n.includes('beetle')
  const isSpider = !isScorpion && !isCrab && !isBeetle
  const s = scale * (boss ? 1.35 : 1.0)

  let shellColor = 0x3f3d3c // Bark spider default
  let accentColor = 0xef4444
  if (isScorpion) {
    shellColor = 0x451a03
    accentColor = 0xf97316
  } else if (isCrab) {
    shellColor = 0x0284c7
    accentColor = 0x38bdf8
  } else if (isBeetle) {
    shellColor = 0x1e293b
    accentColor = 0x10b981
  }

  const shellMat = mat(shellColor, { roughness: 0.6, metalness: isBeetle ? 0.65 : 0.2 })
  const accentMat = mat(accentColor, { emissive: accentColor, emissiveIntensity: 0.5 })

  // Low Cephalothorax / Main Body
  const bodyH = 0.35 * s
  const bodyW = (isCrab ? 0.65 : 0.42) * s
  const bodyL = (isCrab ? 0.5 : 0.58) * s
  const thorax = mesh(new THREE.BoxGeometry(bodyW * 2, bodyH, bodyL * 2), shellMat)
  thorax.position.y = bodyH * 0.9
  g.add(thorax)

  // Abdomen (Rear bulb)
  const abdomen = mesh(new THREE.SphereGeometry((isSpider ? 0.52 : 0.38) * s, 8, 7), shellMat)
  abdomen.scale.set(isSpider ? 1.1 : 0.9, 0.8, isSpider ? 1.3 : 1.0)
  abdomen.position.set(0, bodyH * 1.1, -bodyL * 1.2 * s)
  g.add(abdomen)

  // Scorpion Stinger Tail
  let tailRig = null
  if (isScorpion) {
    tailRig = new THREE.Group()
    tailRig.position.set(0, bodyH, -bodyL * 1.2 * s)
    // 5 articulated segments arched upwards
    let prev = tailRig
    const tailSegs = []
    for (let i = 0; i < 5; i++) {
      const seg = new THREE.Group()
      seg.position.set(0, 0.18 * s, (i === 0 ? -0.15 : i > 2 ? 0.14 : -0.05) * s)
      seg.rotation.x = i === 0 ? -0.4 : 0.5
      const segMesh = mesh(new THREE.CylinderGeometry(0.11 * s * (1 - i * 0.12), 0.14 * s * (1 - i * 0.1), 0.22 * s, 6), shellMat)
      seg.add(segMesh)
      prev.add(seg)
      prev = seg
      tailSegs.push(seg)
    }
    // Stinger tip
    const bulb = mesh(new THREE.SphereGeometry(0.12 * s, 6, 6), accentMat)
    bulb.position.y = 0.18 * s
    prev.add(bulb)
    const stinger = mesh(new THREE.ConeGeometry(0.05 * s, 0.22 * s, 5), accentMat)
    stinger.rotation.x = Math.PI / 2
    stinger.position.set(0, 0.2 * s, 0.14 * s)
    prev.add(stinger)
    g.add(tailRig)
  }

  // Pincers / Claws (Crab / Scorpion)
  if (isCrab || isScorpion) {
    for (const side of [-1, 1]) {
      const pincerArm = new THREE.Group()
      pincerArm.position.set(side * (bodyW + 0.1 * s), bodyH * 0.8, bodyL * 0.7 * s)
      const armMesh = mesh(new THREE.CylinderGeometry(0.08 * s, 0.1 * s, 0.45 * s, 6), shellMat)
      armMesh.rotation.z = -side * 0.8
      armMesh.rotation.y = side * 0.4
      pincerArm.add(armMesh)

      // Claw
      const clawGeo = new THREE.ConeGeometry((isCrab ? 0.16 : 0.1) * s, (isCrab ? 0.42 : 0.32) * s, 5)
      const clawA = mesh(clawGeo, accentMat)
      clawA.rotation.x = Math.PI / 2
      clawA.rotation.z = side * 0.3
      clawA.position.set(side * 0.35 * s, 0.1 * s, 0.25 * s)
      pincerArm.add(clawA)
      g.add(pincerArm)
    }
  }

  // Beetle Horn
  if (isBeetle) {
    const horn = mesh(new THREE.ConeGeometry(0.09 * s, 0.55 * s, 5), shellMat)
    horn.rotation.x = -Math.PI / 3
    horn.position.set(0, bodyH * 1.4, bodyL * 1.1 * s)
    g.add(horn)
  }

  // Spider Glowing Cluster Eyes
  const eyeMat = new THREE.MeshBasicMaterial({ color: accentColor })
  for (const ex of [-0.14, -0.06, 0.06, 0.14]) {
    const eye = mesh(new THREE.SphereGeometry(0.035 * s, 6, 4), eyeMat)
    eye.position.set(ex * s, bodyH * 1.1, bodyL * 0.95 * s)
    g.add(eye)
  }

  // Legs: 8 legs for Spiders, 6 for Scorpions/Beetles/Crabs
  const legCount = isSpider ? 8 : 6
  const legs = []
  const half = legCount / 2

  for (let side of [-1, 1]) {
    for (let i = 0; i < half; i++) {
      const legRoot = new THREE.Group()
      const zOffset = (i / (half - 1) - 0.5) * bodyL * 1.6 * s
      legRoot.position.set(side * (bodyW + 0.04 * s), bodyH * 0.7, zOffset)

      // Upper joint (angled up/out)
      const upperL = (isSpider ? 0.48 : 0.36) * s
      const upper = mesh(new THREE.CylinderGeometry(0.04 * s, 0.055 * s, upperL, 5), shellMat)
      upper.position.set(side * upperL * 0.45, upperL * 0.3, 0)
      upper.rotation.z = -side * 0.75
      upper.rotation.y = (i - 1) * 0.25
      legRoot.add(upper)

      // Lower joint (pointing down to ground)
      const lowerL = (isSpider ? 0.52 : 0.38) * s
      const lower = mesh(new THREE.CylinderGeometry(0.025 * s, 0.04 * s, lowerL, 4), mat(0x18181b))
      lower.position.set(side * upperL * 0.9, -lowerL * 0.25, 0)
      lower.rotation.z = side * 0.45
      legRoot.add(lower)

      g.add(legRoot)
      legs.push({ root: legRoot, side, index: i })
    }
  }

  return {
    group: g,
    type: 'arthropod',
    legs,
    body: thorax,
    head: thorax,
    tailRig,
    baseY: 0,
    strideScale: 1.2,
  }
}

// ==========================================
// 3. GELATINOUS (Slime Lúmen)
// ==========================================
function buildSlimeMesh(name, scale, zoneId, boss) {
  const g = new THREE.Group()
  const s = scale * (boss ? 1.5 : 1.0)

  const isLumen = norm(name).includes('lumen') || zoneId === 'meadow' || zoneId === 'aurora'
  const baseColor = isLumen ? 0x10b981 : 0x06b6d4 // emerald / cyan
  const innerColor = isLumen ? 0x34d399 : 0x38bdf8

  // Outer jelly dome (semi-transparent, soft)
  const slimeMat = new THREE.MeshStandardMaterial({
    color: baseColor,
    roughness: 0.15,
    metalness: 0.05,
    transparent: true,
    opacity: 0.82,
    emissive: baseColor,
    emissiveIntensity: 0.35,
  })

  const domeGeo = new THREE.SphereGeometry(0.65 * s, 16, 12)
  const dome = mesh(domeGeo, slimeMat)
  dome.scale.set(1.2, 0.9, 1.2)
  dome.position.y = 0.55 * s
  g.add(dome)

  // Floating inner glowing magical core
  const coreMat = new THREE.MeshStandardMaterial({
    color: innerColor,
    emissive: innerColor,
    emissiveIntensity: 1.4,
    roughness: 0.2,
  })
  const core = mesh(new THREE.OctahedronGeometry(0.24 * s, 1), coreMat)
  core.position.y = 0.58 * s
  g.add(core)

  // Big glossy anime-like slime eyes
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0f172a })
  const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff })
  for (const side of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(0.08 * s, 8, 8), eyeMat)
    eye.scale.set(1, 1.3, 0.4)
    eye.position.set(side * 0.22 * s, 0.65 * s, 0.65 * s)
    const glint = mesh(new THREE.SphereGeometry(0.028 * s, 6, 6), glintMat)
    glint.position.set(side * 0.24 * s, 0.69 * s, 0.72 * s)
    g.add(eye, glint)
  }

  // Droplet crown for boss slimes
  if (boss) {
    const crown = mesh(new THREE.TorusGeometry(0.35 * s, 0.07 * s, 6, 16), coreMat)
    crown.rotation.x = Math.PI / 2
    crown.position.y = 1.15 * s
    g.add(crown)
  }

  return {
    group: g,
    type: 'slime',
    body: dome,
    head: dome,
    core,
    legs: [],
    baseY: 0,
    strideScale: 1.0,
  }
}

// ==========================================
// 4. GOLEMS & TREANTS (Heavy Elemental Titans)
// ==========================================
function buildGolemMesh(name, scale, zoneId, boss) {
  const g = new THREE.Group()
  const n = norm(name)
  const isTreant = n.includes('treant') || n.includes('raiz')
  const isColossus = n.includes('colosso') || zoneId === 'ember'
  const s = scale * (boss ? 1.6 : 1.15)

  let stoneColor = 0x475569
  let glowColor = 0x38bdf8
  if (isTreant) {
    stoneColor = 0x3f2e1e // dark bark
    glowColor = 0x4ade80 // verdant green
  } else if (isColossus) {
    stoneColor = 0x292524 // obsidian
    glowColor = 0xf97316 // burning lava
  }

  const rockMat = mat(stoneColor, { roughness: 0.9, flatShading: true })
  const glowMat = new THREE.MeshStandardMaterial({
    color: glowColor,
    emissive: glowColor,
    emissiveIntensity: 0.9,
    roughness: 0.3,
  })

  // Massive Torso
  const torso = mesh(new THREE.DodecahedronGeometry(0.72 * s, 1), rockMat)
  torso.scale.set(1.3, 1.1, 0.95)
  torso.position.y = 1.45 * s
  g.add(torso)

  // Glowing Core in chest
  const chestCore = mesh(new THREE.OctahedronGeometry(0.22 * s, 0), glowMat)
  chestCore.position.set(0, 1.48 * s, 0.62 * s)
  g.add(chestCore)

  // Head (Recessed boulder on top)
  const head = mesh(new THREE.DodecahedronGeometry(0.38 * s, 0), rockMat)
  head.position.set(0, 2.2 * s, 0.12 * s)
  g.add(head)

  // Glowing Eye slits
  for (const side of [-1, 1]) {
    const eye = mesh(new THREE.BoxGeometry(0.08 * s, 0.04 * s, 0.12 * s), glowMat)
    eye.position.set(side * 0.14 * s, 2.22 * s, 0.42 * s)
    g.add(eye)
  }

  // Foliage for Treant or Spikes for Colossus
  if (isTreant) {
    const leavesMat = mat(0x15803d, { flatShading: true })
    for (const [lx, ly, lz] of [[-0.4, 2.4, 0], [0.4, 2.5, -0.1], [0, 2.6, 0.2]]) {
      const foliage = mesh(new THREE.IcosahedronGeometry(0.32 * s, 0), leavesMat)
      foliage.position.set(lx * s, ly * s, lz * s)
      g.add(foliage)
    }
  } else if (isColossus || boss) {
    for (const side of [-1, 1]) {
      const spike = mesh(new THREE.ConeGeometry(0.14 * s, 0.65 * s, 5), glowMat)
      spike.rotation.z = -side * 0.5
      spike.rotation.x = -0.2
      spike.position.set(side * 0.72 * s, 2.1 * s, 0)
      g.add(spike)
    }
  }

  // Heavy Arms with Boulder Fists
  const arms = []
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group()
    shoulder.position.set(side * 0.95 * s, 1.8 * s, 0)

    const pauldron = mesh(new THREE.DodecahedronGeometry(0.42 * s, 0), rockMat)
    shoulder.add(pauldron)

    const bicep = mesh(new THREE.CylinderGeometry(0.18 * s, 0.22 * s, 0.62 * s, 6), rockMat)
    bicep.position.set(0, -0.42 * s, 0)
    shoulder.add(bicep)

    const fist = mesh(new THREE.BoxGeometry(0.38 * s, 0.44 * s, 0.42 * s), rockMat)
    fist.position.set(0, -0.85 * s, 0.1 * s)
    shoulder.add(fist)

    g.add(shoulder)
    arms.push(shoulder)
  }

  // Heavy Stumpy Pillar Legs
  const legs = []
  for (const side of [-1, 1]) {
    const legHip = new THREE.Group()
    legHip.position.set(side * 0.45 * s, 0.85 * s, 0)

    const leg = mesh(new THREE.CylinderGeometry(0.24 * s, 0.3 * s, 0.85 * s, 7), rockMat)
    leg.position.y = -0.42 * s
    legHip.add(leg)

    const foot = mesh(new THREE.BoxGeometry(0.42 * s, 0.22 * s, 0.52 * s), rockMat)
    foot.position.set(0, -0.8 * s, 0.1 * s)
    legHip.add(foot)

    g.add(legHip)
    legs.push(legHip)
  }

  return {
    group: g,
    type: 'golem',
    legs,
    arms,
    body: torso,
    head,
    baseY: 0,
    strideScale: 0.8,
  }
}

// ==========================================
// 5. ARMORED HUMANOIDS & UNDEAD (Knights, Skeletons, Wraiths)
// ==========================================
function buildKnightMesh(name, scale, zoneId, boss) {
  const g = new THREE.Group()
  const n = norm(name)
  const isSkeleton = n.includes('esqueleto') || n.includes('skeleton')
  const s = scale * (boss ? 1.45 : 1.05)

  const armorColor = isSkeleton ? 0xe2e8f0 : zoneId === 'void' ? 0x3b0764 : 0x334155
  const glowColor = isSkeleton ? 0xa855f7 : zoneId === 'void' ? 0xc084fc : 0x38bdf8

  const armorMat = mat(armorColor, {
    metalness: isSkeleton ? 0.05 : 0.75,
    roughness: isSkeleton ? 0.9 : 0.35,
  })
  const glowMat = new THREE.MeshBasicMaterial({ color: glowColor })

  // Torso / Cuirass
  const torso = mesh(new THREE.BoxGeometry(0.62 * s, 0.78 * s, 0.38 * s), armorMat)
  torso.position.y = 1.25 * s
  g.add(torso)

  // Helmet / Skull
  const head = mesh(new THREE.DodecahedronGeometry(0.28 * s, 1), armorMat)
  head.position.y = 1.88 * s
  g.add(head)

  // Glowing Visor Slit
  const visor = mesh(new THREE.BoxGeometry(0.28 * s, 0.06 * s, 0.12 * s), glowMat)
  visor.position.set(0, 1.88 * s, 0.25 * s)
  g.add(visor)

  // Horns / Crown for boss
  if (boss) {
    for (const side of [-1, 1]) {
      const horn = mesh(new THREE.ConeGeometry(0.08 * s, 0.45 * s, 5), armorMat)
      horn.rotation.z = -side * 0.45
      horn.position.set(side * 0.28 * s, 2.22 * s, 0)
      g.add(horn)
    }
  }

  // Pauldrons (Shoulder pads)
  for (const side of [-1, 1]) {
    const pauldron = mesh(new THREE.IcosahedronGeometry(0.24 * s, 0), armorMat)
    pauldron.scale.set(1.2, 0.7, 1.2)
    pauldron.position.set(side * 0.45 * s, 1.62 * s, 0)
    g.add(pauldron)
  }

  // Weapon: Dark Sword in right hand
  const swordArm = new THREE.Group()
  swordArm.position.set(0.48 * s, 1.45 * s, 0)
  const armMesh = mesh(new THREE.CylinderGeometry(0.08 * s, 0.1 * s, 0.6 * s, 6), armorMat)
  armMesh.position.y = -0.3 * s
  swordArm.add(armMesh)

  const blade = mesh(new THREE.BoxGeometry(0.08 * s, 0.95 * s, 0.04 * s), mat(0x94a3b8, { metalness: 0.85, roughness: 0.2 }))
  blade.position.set(0, -0.65 * s, 0.3 * s)
  blade.rotation.x = Math.PI / 4
  swordArm.add(blade)
  g.add(swordArm)

  // Shield on left hand
  const shield = mesh(new THREE.BoxGeometry(0.42 * s, 0.65 * s, 0.08 * s), armorMat)
  shield.position.set(-0.48 * s, 1.25 * s, 0.22 * s)
  g.add(shield)

  // 2 Greaved Legs
  const legs = []
  for (const side of [-1, 1]) {
    const hip = new THREE.Group()
    hip.position.set(side * 0.22 * s, 0.75 * s, 0)
    const legMesh = mesh(new THREE.CylinderGeometry(0.11 * s, 0.13 * s, 0.75 * s, 6), armorMat)
    legMesh.position.y = -0.38 * s
    hip.add(legMesh)
    g.add(hip)
    legs.push(hip)
  }

  return {
    group: g,
    type: 'knight',
    legs,
    body: torso,
    head,
    weaponArm: swordArm,
    baseY: 0,
    strideScale: 1.0,
  }
}

// ==========================================
// 6. FLYERS & SERPENTINE (Crows, Harpies, Dragons, Serpents)
// ==========================================
function buildFlyerMesh(name, scale, zoneId, boss) {
  const g = new THREE.Group()
  const n = norm(name)
  const isDragon = n.includes('dragao') || n.includes('dragon') || n.includes('serpente')
  const s = scale * (boss ? 1.5 : 1.1)

  const bodyColor = isDragon ? 0x0f766e : 0x334155
  const wingColor = isDragon ? 0x14b8a6 : 0x1e293b
  const eyeColor = isDragon ? 0xf43f5e : 0x38bdf8

  const bodyMat = mat(bodyColor, { roughness: 0.7 })
  const wingMat = mat(wingColor, { roughness: 0.8, side: THREE.DoubleSide })

  // Floating body elevated above terrain
  const hoverHeight = (isDragon ? 2.2 : 1.8) * s

  const body = mesh(new THREE.CapsuleGeometry(0.24 * s, (isDragon ? 1.2 : 0.6) * s, 4, 8), bodyMat)
  body.rotation.x = Math.PI / 2.6
  body.position.y = hoverHeight
  g.add(body)

  // Head & Beak / Jaws
  const head = mesh(new THREE.ConeGeometry(0.18 * s, 0.45 * s, 5), bodyMat)
  head.rotation.x = -Math.PI / 2.4
  head.position.set(0, hoverHeight + 0.22 * s, (isDragon ? 0.75 : 0.45) * s)
  g.add(head)

  // Glowing eyes
  const eyeMat = new THREE.MeshBasicMaterial({ color: eyeColor })
  for (const side of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(0.045 * s, 5, 4), eyeMat)
    eye.position.set(side * 0.12 * s, hoverHeight + 0.26 * s, (isDragon ? 0.68 : 0.38) * s)
    g.add(eye)
  }

  // 2 Large Flapping Wings
  const wings = []
  for (const side of [-1, 1]) {
    const wingJoint = new THREE.Group()
    wingJoint.position.set(side * 0.22 * s, hoverHeight + 0.1 * s, 0)

    const wingShape = mesh(new THREE.BoxGeometry((isDragon ? 1.4 : 0.9) * s, 0.04 * s, (isDragon ? 0.8 : 0.5) * s), wingMat)
    wingShape.position.x = side * (isDragon ? 0.7 : 0.45) * s
    wingJoint.add(wingShape)
    g.add(wingJoint)
    wings.push({ joint: wingJoint, side })
  }

  // Tail feathers / Dragon tail
  const tail = mesh(new THREE.ConeGeometry(0.12 * s, (isDragon ? 1.1 : 0.5) * s, 5), bodyMat)
  tail.rotation.x = Math.PI / 2.2
  tail.position.set(0, hoverHeight - 0.15 * s, -(isDragon ? 0.9 : 0.45) * s)
  g.add(tail)

  return {
    group: g,
    type: 'flyer',
    wings,
    body,
    head,
    legs: [],
    baseY: hoverHeight,
    strideScale: 1.0,
  }
}

// Master Creator Dispatcher
export function createCustomMobModel(name, scale, zoneId, boss) {
  const archetype = classifyMobArchetype(name, zoneId)
  switch (archetype) {
    case 'slime':
      return buildSlimeMesh(name, scale, zoneId, boss)
    case 'spider':
    case 'scorpion':
    case 'beetle':
    case 'crab':
      return buildArthropodMesh(name, scale, zoneId, boss)
    case 'wolf':
    case 'fox':
    case 'boar':
    case 'cervid':
      return buildQuadrupedMesh(name, scale, zoneId, boss)
    case 'golem':
      return buildGolemMesh(name, scale, zoneId, boss)
    case 'bird':
    case 'dragon':
      return buildFlyerMesh(name, scale, zoneId, boss)
    case 'knight':
    case 'wraith':
    default:
      return buildKnightMesh(name, scale, zoneId, boss)
  }
}

// ==========================================
// ANIMATION UPDATE ENGINE FOR ALL ARCHETYPES
// ==========================================
export function animateOverhaulMob(mob, dt, t) {
  const rig = mob.overhaulRig
  if (!rig) return

  const isMoving = Boolean(mob.isMoving || (mob.lastDist && mob.lastDist > 1.8))
  const lunge = mob.attackAnim > 0 ? Math.sin(Math.min(1, mob.attackAnim / 0.34) * Math.PI) * 0.32 : 0

  if (rig.type === 'quadruped') {
    // 4 legs trot (diagonal pairs: FL & BR vs FR & BL)
    const speed = isMoving ? 9 : 3
    const phase = t * speed + (mob.phase || 0)
    const legSwing = Math.sin(phase) * (isMoving ? 0.65 : 0.15)
    if (rig.legs.length >= 4) {
      rig.legs[0].rotation.x = legSwing      // FL
      rig.legs[1].rotation.x = -legSwing     // FR
      rig.legs[2].rotation.x = -legSwing     // BL
      rig.legs[3].rotation.x = legSwing      // BR
    }
    // Subtle spine sway and head breathing
    if (rig.body) {
      rig.body.position.y = (rig.body.userData?.baseY || rig.body.position.y) + Math.abs(Math.sin(phase)) * 0.04
      rig.body.rotation.z = Math.sin(phase * 0.5) * 0.04
    }
    if (rig.head) {
      rig.head.rotation.x = Math.sin(t * 3) * 0.05 + (mob.attackAnim > 0 ? -0.35 : 0)
    }
    if (rig.tail) {
      rig.tail.rotation.y = Math.sin(t * 7) * 0.25
    }
  } else if (rig.type === 'arthropod') {
    // Multi-leg ripple gait
    const speed = isMoving ? 14 : 4
    const phase = t * speed + (mob.phase || 0)
    for (let i = 0; i < rig.legs.length; i++) {
      const leg = rig.legs[i]
      const step = Math.sin(phase + leg.index * 1.3 + (leg.side > 0 ? Math.PI : 0))
      leg.root.rotation.x = step * (isMoving ? 0.35 : 0.08)
      leg.root.position.y = (leg.root.userData?.baseY || leg.root.position.y) + Math.max(0, step) * 0.06
    }
    // Scorpion tail strike in attack animation
    if (rig.tailRig) {
      rig.tailRig.rotation.x = Math.sin(t * 2.5) * 0.08 + (mob.attackAnim > 0 ? 0.6 : 0)
    }
  } else if (rig.type === 'slime') {
    // Squash and stretch jelly bounce
    const bounceSpeed = isMoving ? 8 : 3.5
    const cycle = (t * bounceSpeed + (mob.phase || 0)) % (Math.PI * 2)
    const sinB = Math.sin(cycle)
    const squash = 1.0 + sinB * 0.28
    const stretch = 1.0 - sinB * 0.2
    if (rig.body) {
      rig.body.scale.set(squash, stretch, squash)
      rig.body.position.y = (rig.baseY || 0.55) + Math.max(0, -sinB) * 0.4
    }
    if (rig.core) {
      rig.core.rotation.y += dt * 1.5
      rig.core.rotation.x += dt * 0.8
    }
  } else if (rig.type === 'flyer') {
    // Wing flapping & hover bobbing
    const flapSpeed = isMoving ? 16 : 9
    const flap = Math.sin(t * flapSpeed) * 0.45
    for (const w of rig.wings) {
      w.joint.rotation.z = w.side * flap
    }
    if (rig.body) {
      rig.body.position.y = (rig.baseY || 1.8) + Math.sin(t * 3.5) * 0.15
    }
  } else if (rig.type === 'golem') {
    // Heavy slow stomp
    const step = Math.sin(t * 5 + (mob.phase || 0)) * (isMoving ? 0.5 : 0.1)
    if (rig.legs.length >= 2) {
      rig.legs[0].rotation.x = step
      rig.legs[1].rotation.x = -step
    }
    if (rig.arms && rig.arms.length >= 2) {
      rig.arms[0].rotation.x = -step * 0.8 + (mob.attackAnim > 0 ? -0.8 : 0)
      rig.arms[1].rotation.x = step * 0.8
    }
  } else if (rig.type === 'knight') {
    const gait = Math.sin(t * 7 + (mob.phase || 0)) * (isMoving ? 0.55 : 0.1)
    if (rig.legs.length >= 2) {
      rig.legs[0].rotation.x = gait
      rig.legs[1].rotation.x = -gait
    }
    if (rig.weaponArm) {
      rig.weaponArm.rotation.x = (mob.attackAnim > 0 ? -0.9 : 0) + Math.sin(t * 3) * 0.05
    }
  }
}

// ==========================================
// ENGINE MONKEY-PATCH FOR CLEAN INTEGRATION
// ==========================================
if (!ShadowGame.prototype[OVERHAUL_FLAG]) {
  const proto = ShadowGame.prototype
  Object.defineProperty(proto, OVERHAUL_FLAG, { value: true })

  const prevMakeEnemy = proto.makeEnemy
  proto.makeEnemy = function overhauledMakeEnemy(x, z, level, name, boss, zone, chunkKey = null, netId = null) {
    const enemy = prevMakeEnemy.call(this, x, z, level, name, boss, zone, chunkKey, netId)
    if (!enemy || !enemy.g) return enemy

    // Hide old primitive capsule & dodecahedron head & 2 stick legs
    if (enemy.body) enemy.body.visible = false
    if (enemy.head) enemy.head.visible = false
    if (enemy.legs) {
      for (const leg of enemy.legs) leg.visible = false
    }

    // Build dedicated custom 3D model
    const scale = boss ? 1.55 : 1.0
    const overhaul = createCustomMobModel(name, scale, zone?.id || '', boss)
    enemy.g.add(overhaul.group)
    enemy.overhaulRig = overhaul

    // Add boss crown aura if boss
    if (boss) {
      const auraRing = mesh(
        new THREE.RingGeometry(1.6 * scale, 1.95 * scale, 24),
        new THREE.MeshBasicMaterial({ color: 0xec4899, side: THREE.DoubleSide, transparent: true, opacity: 0.65 })
      )
      auraRing.rotation.x = -Math.PI / 2
      auraRing.position.y = 0.06
      enemy.g.add(auraRing)
      enemy.bossAuraRing = auraRing
    }

    return enemy
  }

  const prevUpdateEnemies = proto.updateEnemies
  proto.updateEnemies = function overhauledUpdateEnemies(dt, t) {
    const res = prevUpdateEnemies.call(this, dt, t)
    for (const e of this.enemies || []) {
      if (!e || e.dead || !e.g?.visible) continue
      if (e.overhaulRig) {
        animateOverhaulMob(e, dt, t)
      }
      if (e.bossAuraRing) {
        e.bossAuraRing.rotation.z += dt * 1.5
      }
    }
    return res
  }
}
