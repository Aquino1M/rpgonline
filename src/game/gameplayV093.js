import * as THREE from 'three'
import { ShadowGame } from './engine.js'
import { WORLD, MODEL_MANIFEST, SAFE_SPAWNS } from './config.js'
import { hash2, damp } from './utils.js'

const PATCH_FLAG = Symbol.for('shadow-ascension.gameplay-v093')

// V0.9.3 favors stable procedural enemies. The imported mob/boss files were the
// source of scale/origin bugs in previous builds, so gameplay no longer depends on them.
for (const key of ['slime','goblin','skeleton','golem','ghost','ghost_skull','brute','big_arm','cactoro','stone_golem','dark_knight','dwarf','dragon','giant','yeti']) {
  if (key in MODEL_MANIFEST) MODEL_MANIFEST[key] = ''
}

WORLD.renderDistanceMin = 1
WORLD.renderDistanceMax = 4
WORLD.mobDistance = 96
WORLD.decorDistance = 150
WORLD.waterDistance = 175

const markShared = (asset) => {
  if (asset?.userData) asset.userData.v093Shared = true
  return asset
}

const shared = {
  groundGeo: markShared(new THREE.PlaneGeometry(WORLD.chunkSize, WORLD.chunkSize, 1, 1)),
  waterGeo: markShared(new THREE.PlaneGeometry(WORLD.chunkSize * .86, WORLD.chunkSize * .42, 1, 1)),
  trunkGeo: markShared(new THREE.CylinderGeometry(.22, .4, 2.6, 5)),
  crownGeo: markShared(new THREE.IcosahedronGeometry(1, 1)),
  oreBaseGeo: markShared(new THREE.DodecahedronGeometry(1, 0)),
  oreGemGeo: markShared(new THREE.OctahedronGeometry(1, 0)),
  fishBodyGeo: markShared(new THREE.SphereGeometry(.22, 8, 6)),
  fishTailGeo: markShared(new THREE.ConeGeometry(.13, .24, 4)),
  fishFinGeo: markShared(new THREE.ConeGeometry(.07, .16, 3)),
  waterMat: markShared(new THREE.MeshStandardMaterial({
    color: 0x147bd1,
    transparent: true,
    opacity: .74,
    roughness: .10,
    metalness: .10,
    emissive: 0x062846,
    emissiveIntensity: .16,
    depthWrite: false,
  })),
  fishMat: markShared(new THREE.MeshStandardMaterial({color:0x5bc0eb,roughness:.38,metalness:.04})),
  fishFinMat: markShared(new THREE.MeshStandardMaterial({color:0x2788b9,roughness:.42,metalness:.02})),
  fishGoldMat: markShared(new THREE.MeshStandardMaterial({color:0xf6c453,roughness:.28,metalness:.28,emissive:0x5a3c05,emissiveIntensity:.18})),
}

const groundMaterials = new Map()
const treeMaterials = new Map()
const oreMaterials = new Map()
const getGroundMat = (hex) => {
  if (!groundMaterials.has(hex)) groundMaterials.set(hex, markShared(new THREE.MeshStandardMaterial({color:hex,roughness:.9,metalness:0})))
  return groundMaterials.get(hex)
}
const getTreeMat = (hex) => {
  if (!treeMaterials.has(hex)) treeMaterials.set(hex, markShared(new THREE.MeshStandardMaterial({color:hex,roughness:.78,flatShading:true})))
  return treeMaterials.get(hex)
}
const getOreMat = (key, material) => {
  if (!oreMaterials.has(key)) oreMaterials.set(key, markShared(material))
  return oreMaterials.get(key)
}

const makeMesh = (geo, material) => {
  const m = new THREE.Mesh(geo, material)
  m.castShadow = true
  m.receiveShadow = true
  m.userData.v093SharedMesh = true
  return m
}

const waterBounds = (cx, cz, margin = 0) => ({
  minX: cx * WORLD.chunkSize - WORLD.chunkSize * .43 - margin,
  maxX: cx * WORLD.chunkSize + WORLD.chunkSize * .43 + margin,
  minZ: cz * WORLD.chunkSize - WORLD.chunkSize * .21 - margin,
  maxZ: cz * WORLD.chunkSize + WORLD.chunkSize * .21 + margin,
})

const pointInBounds = (x, z, b) => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ

function disposeChunk(game, key) {
  const chunk = game.chunks?.get(key)
  if (!chunk) return
  game.worldRoot?.remove?.(chunk.group)
  chunk.group?.traverse?.((o) => {
    if (o.geometry && !o.geometry.userData?.v093Shared) o.geometry.dispose?.()
    if (Array.isArray(o.material)) {
      for (const material of o.material) if (material && !material.userData?.v093Shared) material.dispose?.()
    } else if (o.material && !o.material.userData?.v093Shared) o.material.dispose?.()
  })
  game.chunks.delete(key)
  game.enemies = (game.enemies || []).filter((enemy) => {
    if (enemy.chunkKey === key) {
      enemy.g?.parent?.remove?.(enemy.g)
      return false
    }
    return true
  })
  game.resourceNodes = (game.resourceNodes || []).filter((node) => {
    if (node.chunkKey === key) {
      if (node.durabilitySprite) game.scene?.remove?.(node.durabilitySprite)
      return false
    }
    return true
  })
  game.fishNodes = (game.fishNodes || []).filter((fish) => fish.chunkKey !== key)
  if (game._v093MobBuildQueue?.length) game._v093MobBuildQueue = game._v093MobBuildQueue.filter((job) => job.chunkKey !== key)
}

function fishNameFor(zone, golden = false) {
  if (golden) return 'Peixe Dourado'
  if (zone?.id === 'coast') return 'Peixe Safira'
  if (zone?.id === 'forest') return 'Truta Cinérea'
  if (zone?.id === 'highlands') return 'Truta de Veyra'
  if (zone?.id === 'crown') return 'Peixe Celeste'
  return 'Peixe de Lago'
}

function spawnFishForChunk(game, chunk) {
  if (!chunk?.hasWater || !chunk.group) return
  game.fishNodes ||= []
  const already = game.fishNodes.some((fish) => fish.chunkKey === chunk.key)
  if (already) return

  const count = game.isTouchDevice ? 3 : 5
  for (let i = 0; i < count; i++) {
    const seed = hash2(chunk.cx * 31 + i * 7, chunk.cz * 19 + i * 11)
    const seed2 = hash2(chunk.cx * 13 + i * 23, chunk.cz * 29 + i * 5)
    const golden = hash2(chunk.cx * 71 + i, chunk.cz * 43 - i) > .94
    const group = new THREE.Group()
    group.name = golden ? 'Peixe Dourado' : 'Peixe'

    const body = makeMesh(shared.fishBodyGeo, golden ? shared.fishGoldMat : shared.fishMat)
    body.castShadow = false
    body.scale.set(1.45, .72, .72)
    group.add(body)

    const tail = makeMesh(shared.fishTailGeo, golden ? shared.fishGoldMat : shared.fishFinMat)
    tail.castShadow = false
    tail.rotation.z = -Math.PI / 2
    tail.position.x = -.32
    group.add(tail)

    const fin = makeMesh(shared.fishFinGeo, golden ? shared.fishGoldMat : shared.fishFinMat)
    fin.castShadow = false
    fin.rotation.z = Math.PI
    fin.position.set(0, .10, 0)
    group.add(fin)

    const localX = (seed - .5) * WORLD.chunkSize * .68
    const localZ = (seed2 - .5) * WORLD.chunkSize * .30
    group.position.set(localX, .04, localZ)
    group.scale.setScalar(golden ? 1.12 : .9 + seed * .22)
    chunk.group.add(group)

    game.fishNodes.push({
      id: `fish:${chunk.key}:${i}`,
      chunkKey: chunk.key,
      g: group,
      zoneId: chunk.zone?.id || 'aurora',
      name: fishNameFor(chunk.zone, golden),
      golden,
      alive: true,
      caughtUntil: 0,
      phase: seed * Math.PI * 2,
      homeX: localX,
      homeZ: localZ,
      speed: .55 + seed2 * .55,
    })
  }
}

function queueChunkMobs(game, cx, cz, zone, chunkKey, waterBox = null) {
  game._v093MobBuildQueue ||= []
  const size = WORLD.chunkSize
  const n = 3 + Math.floor(hash2(cx + 70, cz + 90) * 3)
  for (let i = 0; i < n; i++) {
    const x = cx * size + (hash2(cx, i + 12) - .5) * size * .72
    const z = cz * size + (hash2(cz, i + 44) - .5) * size * .72
    const netId = `${chunkKey}:mob:${i}`
    if (game.isInsideCitySafeZone(x, z, zone.id === 'aurora' ? 12 : 9)) continue
    if (waterBox && pointInBounds(x, z, waterBox)) continue
    if ((game.respawnLocks.get(netId) || 0) > Date.now()) continue
    const level = Math.round(zone.min + hash2(i + cx, cz) * (zone.max - zone.min))
    game._v093MobBuildQueue.push({x,z,level,name:zone.mobs[i % zone.mobs.length],boss:false,zone,chunkKey,netId})
  }

  const bx = zone.x0 + (zone.x1 - zone.x0) * .78
  const bz = zone.z0 + (zone.z1 - zone.z0) * .72
  const bossCx = Math.floor(bx / size), bossCz = Math.floor(bz / size)
  const bossId = `${chunkKey}:boss`
  if (cx === bossCx && cz === bossCz && !game.isInsideCitySafeZone(bx, bz, 12) && !(waterBox && pointInBounds(bx, bz, waterBox)) && (game.respawnLocks.get(bossId) || 0) <= Date.now()) {
    game._v093MobBuildQueue.push({x:bx,z:bz,level:zone.max+5,name:zone.boss,boss:true,zone,chunkKey,netId:bossId})
  }
}

function drainMobBuildQueue(game, budget = 1) {
  const queue = game._v093MobBuildQueue || []
  let built = 0
  while (queue.length && built < budget) {
    const job = queue.shift()
    if (!job || !game.chunks?.has(job.chunkKey)) continue
    if ((game.respawnLocks.get(job.netId) || 0) > Date.now()) continue
    if (job.boss && game.enemies?.some((e) => !e.dead && e.boss && e.zoneId === job.zone?.id)) continue
    const enemy = game.makeEnemy(job.x, job.z, job.level, job.name, job.boss, job.zone, job.chunkKey, job.netId)
    if (enemy) game.enemies.push(enemy)
    built++
  }
  return built
}

function nearestFish(game, maxDistance = 5.2) {
  let nearest = null
  let best = maxDistance
  for (const fish of game.fishNodes || []) {
    if (!fish?.alive || !fish.g?.visible || !fish.g.parent) continue
    const wp = new THREE.Vector3()
    fish.g.getWorldPosition(wp)
    const d = Math.hypot(wp.x - game.player.position.x, wp.z - game.player.position.z)
    if (d < best) { best = d; nearest = {fish, world: wp, distance: d} }
  }
  return nearest
}

if (!ShadowGame.prototype[PATCH_FLAG]) {
  const proto = ShadowGame.prototype
  Object.defineProperty(proto, PATCH_FLAG, { value: true })

  // Lower-poly, shared-resource vegetation. It looks cleaner while eliminating a lot
  // of geometry/material allocation every time the player crosses a chunk boundary.
  proto.makeTree = function v093Tree(r, zone) {
    const g = new THREE.Group()
    g.userData.runtimeWorldTree = true
    const trunk = makeMesh(shared.trunkGeo, getTreeMat(zone?.id === 'forest' ? 0x4a3325 : 0x633d20))
    trunk.castShadow = true
    trunk.position.y = 1.3
    g.add(trunk)
    const color = zone?.id === 'forest' ? (r > .5 ? 0x315d3e : 0x274c34) : (r > .5 ? 0x43864b : 0x367642)
    const crown = makeMesh(shared.crownGeo, getTreeMat(color))
    const s = 1.18 + r * .62
    crown.scale.setScalar(s)
    crown.castShadow = false
    crown.position.y = 2.95
    g.add(crown)
    if (zone?.id === 'forest' && r > .35) {
      const c2 = makeMesh(shared.crownGeo, getTreeMat(color))
      c2.scale.setScalar(s * .66)
      c2.castShadow = false
      c2.position.set(.72, 3.32, .22)
      g.add(c2)
    }
    return g
  }

  proto.makeOreVein = function v093Ore(x, z, isIron, r) {
    const g = new THREE.Group()
    const baseMat = getOreMat(isIron ? 'ironBase' : 'coalBase', new THREE.MeshStandardMaterial({color:isIron?0x535a64:0x24262c,roughness:.84,metalness:.16}))
    const oreMat = getOreMat(isIron ? 'ironGem' : 'coalGem', new THREE.MeshStandardMaterial({
      color: isIron ? 0xc7a64b : 0x17181d,
      roughness: .32,
      metalness: isIron ? .82 : .18,
      emissive: isIron ? 0x3b2f0c : 0x242630,
      emissiveIntensity: .28,
    }))
    const rock = makeMesh(shared.oreBaseGeo, baseMat)
    rock.castShadow = false
    rock.scale.set(.72 + r * .88, .52 + r * .48, .72 + r * .88)
    rock.position.y = .38 + r * .18
    g.add(rock)
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * .67 + r
      const gem = makeMesh(shared.oreGemGeo, oreMat)
      gem.castShadow = false
      gem.scale.setScalar(.13 + i * .025)
      gem.position.set(Math.cos(a) * (.42 + r * .25), .38 + (i % 2) * .2, Math.sin(a) * (.42 + r * .25))
      gem.rotation.set(r * i, i * .8, r)
      g.add(gem)
    }
    g.position.set(x, 0, z)
    return g
  }

  // Build chunks with simple flat geometry and never place resources in water.
  proto.buildChunk = function v093BuildChunk(cx, cz, key) {
    if (this.chunks?.has(key)) return this.chunks.get(key)
    const size = WORLD.chunkSize
    const zone = this.zoneForChunk(cx, cz)
    const group = new THREE.Group()
    group.position.set(cx * size, 0, cz * size)
    group.userData.chunkKey = key

    const ground = new THREE.Mesh(shared.groundGeo, getGroundMat(zone.ground))
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    group.add(ground)

    const waterChance = hash2(cx, cz)
    const midX = cx * size, midZ = cz * size
    const nearRoad = this.isOnRoad?.(midX, midZ, size * 0.62)
    const nearCity = this.isInsideCitySafeZone?.(midX, midZ, 34)
    const hasWater = (zone.id === 'coast' || waterChance > .91) && !nearRoad && !nearCity
    let waterMesh = null
    if (hasWater) {
      waterMesh = new THREE.Mesh(shared.waterGeo, shared.waterMat)
      waterMesh.rotation.x = -Math.PI / 2
      waterMesh.position.y = .12
      waterMesh.receiveShadow = false
      waterMesh.userData.water = true
      waterMesh.userData.v093SharedMesh = true
      group.add(waterMesh)
    }

    // About half the previous prop count; shared geometry keeps the world detailed
    // without the large garbage-collection spikes of the old chunk builder.
    const baseCount = zone.id === 'void' ? 3 : 5 + Math.floor(hash2(cx + 11, cz + 5) * 5)
    const detailScale = this.isTouchDevice ? .70 : .90
    const decorCount = Math.max(3, Math.round(baseCount * detailScale))
    const colliders = []
    const wb = hasWater ? waterBounds(cx, cz, 1.6) : null

    for (let i = 0; i < decorCount; i++) {
      const rx = (hash2(cx * 19 + i, cz * 31) - .5) * size * .88
      const rz = (hash2(cx * 7, cz * 13 + i) - .5) * size * .88
      const gx = cx * size + rx
      const gz = cz * size + rz
      if (wb && pointInBounds(gx, gz, wb)) continue
      if (this.isInsideCitySafeZone(gx, gz, 42) || this.isOnRoad(gx, gz, 7.5) || this.isNearSafeSpawn?.(gx, gz, 18)) continue

      const rr = hash2(i, cx + cz)
      const isOreZone = zone.id === 'ember' || zone.id === 'crown' || zone.id === 'highlands' || rr > .67
      if (isOreZone) {
        const isIron = zone.id === 'highlands' || zone.id === 'crown' || hash2(gx * 7, gz * 13) > .5
        const oreMesh = this.makeOreVein(rx, rz, isIron, rr)
        group.add(oreMesh)
        const col = {x:gx,z:gz,r:.78 + rr * .42,type:'ore',active:true}
        colliders.push(col)
        this.resourceNodes.push({
          id:`res:${Math.round(gx)}:${Math.round(gz)}`,
          type:isIron?'ore_iron':'ore_coal',
          name:isIron?'Veio de Minério de Ferro':'Veio de Carvão Mineral',
          icon:isIron?'⚙️':'⚫',dropKind:isIron?'iron':'coal',gx,gz,
          hp:isIron?90:70,maxHp:isIron?90:70,mesh:oreMesh,collider:col,chunkKey:key,respawnAt:0,lastHit:0,
        })
      } else {
        const tree = this.makeTree(rr, zone)
        tree.position.set(rx, 0, rz)
        group.add(tree)
        const col = {x:gx,z:gz,r:.68,type:'tree',active:true}
        colliders.push(col)
        this.resourceNodes.push({
          id:`res:${Math.round(gx)}:${Math.round(gz)}`,type:'tree',
          name:zone.id==='forest'?'Carvalho Ancestral':'Carvalho Silvestre',icon:'🪵',dropKind:'wood',gx,gz,
          hp:zone.id==='forest'?80:60,maxHp:zone.id==='forest'?80:60,mesh:tree,collider:col,chunkKey:key,respawnAt:0,lastHit:0,
        })
      }
    }

    this.worldRoot.add(group)
    const chunk = {group,zone,cx,cz,key,hasWater,waterMesh,colliders}
    this.chunks.set(key, chunk)
    // Mob creation is queued one entity at a time. Creating enemy labels/canvases is
    // one of the biggest chunk-streaming spikes, so it is never done in the same
    // frame as a new terrain chunk.
    queueChunkMobs(this, cx, cz, zone, key, wb)
    spawnFishForChunk(this, chunk)
    return chunk
  }

  // Chunk streaming is incremental: nearby chunks are queued by distance and only a
  // small number are created per frame. This removes the large hitch when crossing borders.
  proto.ensureChunks = function v093EnsureChunks() {
    const setting = Math.max(1, Math.min(4, Number(this.settings?.renderDistance) || (this.isTouchDevice ? 2 : 3)))
    const shortSide = Math.min(window.innerWidth || 1280, window.innerHeight || 720)
    const rd = this.isTouchDevice ? Math.min(setting, shortSide < 700 ? 2 : 3) : setting
    const pcx = Math.floor(this.player.position.x / WORLD.chunkSize)
    const pcz = Math.floor(this.player.position.z / WORLD.chunkSize)
    const streamKey = `${pcx}:${pcz}:${rd}`

    if (this._v093StreamKey !== streamKey) {
      this._v093StreamKey = streamKey
      const need = new Set()
      const missing = []
      for (let dx = -rd; dx <= rd; dx++) {
        for (let dz = -rd; dz <= rd; dz++) {
          const cx = pcx + dx, cz = pcz + dz, key = `${cx},${cz}`
          need.add(key)
          if (!this.chunks.has(key)) missing.push({cx,cz,key,d2:dx*dx+dz*dz})
        }
      }
      missing.sort((a,b) => a.d2 - b.d2)
      this._v093Need = need
      this._v093BuildQueue = missing

      const keepRadius = rd + 1
      this._v093UnloadQueue = [...this.chunks.keys()].filter((key) => {
        const [cx,cz] = key.split(',').map(Number)
        return Math.abs(cx-pcx) > keepRadius || Math.abs(cz-pcz) > keepRadius
      })
    }

    const buildBudget = 1
    let built = 0
    while (built < buildBudget && this._v093BuildQueue?.length) {
      const next = this._v093BuildQueue.shift()
      if (!next || !this._v093Need?.has(next.key) || this.chunks.has(next.key)) continue
      this.buildChunk(next.cx, next.cz, next.key)
      built++
    }

    // Terrain and mob creation are deliberately split across frames.
    if (built === 0) drainMobBuildQueue(this, 1)

    // Unload one old chunk at a time so disposal itself cannot create a long frame.
    if (this._v093UnloadQueue?.length) {
      const key = this._v093UnloadQueue.shift()
      if (key && !this._v093Need?.has(key)) disposeChunk(this, key)
    }
  }

  proto.isWaterAt = function v093IsWaterAt(x, z, margin = 0) {
    const cx = Math.floor(x / WORLD.chunkSize)
    const cz = Math.floor(z / WORLD.chunkSize)
    const chunk = this.chunks?.get(`${cx},${cz}`)
    if (!chunk?.hasWater) return false
    return pointInBounds(x, z, waterBounds(cx, cz, margin))
  }

  // Any later respawn/repopulation also respects water, not just the first chunk build.
  const previousSpawnChunkMobs = proto.spawnChunkMobs
  proto.spawnChunkMobs = function v093SpawnChunkMobs(cx, cz, zone, chunkKey) {
    const before = new Set((this.enemies || []).map((enemy) => enemy.netId))
    const result = previousSpawnChunkMobs.call(this, cx, cz, zone, chunkKey)
    const chunk = this.chunks?.get(chunkKey)
    if (!chunk?.hasWater) return result
    const wb = waterBounds(cx, cz, .8)
    this.enemies = (this.enemies || []).filter((enemy) => {
      if (enemy.chunkKey !== chunkKey || before.has(enemy.netId)) return true
      if (!pointInBounds(enemy.g.position.x, enemy.g.position.z, wb)) return true
      enemy.g.parent?.remove?.(enemy.g)
      return false
    })
    return result
  }

  // Keep exact game names even though older visual patches used substitute model names.
  const previousMakeEnemy = proto.makeEnemy
  proto.makeEnemy = function v093Enemy(x, z, level, name, boss, zone, chunkKey = null, netId = null) {
    const enemy = previousMakeEnemy.call(this, x, z, level, name, boss, zone, chunkKey, netId)
    if (!enemy) return enemy
    if (enemy.customMesh) {
      enemy.customMesh.parent?.remove?.(enemy.customMesh)
      enemy.customMesh = null
      enemy.mixer = null
      if (enemy.body) enemy.body.visible = true
      if (enemy.head) enemy.head.visible = true
      for (const leg of enemy.legs || []) if (leg) leg.visible = true
    }
    enemy.name = name
    enemy.displayName = name
    enemy.visualName = name
    this.updateMobLabel?.(enemy)
    return enemy
  }

  const previousReadPacksManifest = proto.readPacksManifest
  proto.readPacksManifest = async function v093Packs(...args) {
    const manifest = await previousReadPacksManifest.apply(this, args)
    if (manifest) {
      manifest.mobs = []
      manifest.scenery = []
    }
    return manifest
  }

  const previousLoadExternalVisuals = proto.loadExternalVisuals
  proto.loadExternalVisuals = async function v093ExternalVisuals(...args) {
    const result = await previousLoadExternalVisuals.apply(this, args)
    if (this.externalModels) {
      for (const key of ['slime','goblin','skeleton','golem','ghost','ghost_skull','brute','big_arm','cactoro','stone_golem','dark_knight','dwarf','dragon','giant','yeti']) this.externalModels[key] = null
      this.externalModels.packMobs = []
      this.externalModels.packMobEntries = []
    }
    return result
  }

  proto.nearestFish = function v093NearestFish(maxDistance = 5.2) { return nearestFish(this, maxDistance) }

  proto.tryFish = function v093TryFish() {
    if (this.state.uiPanel || this.state.dungeon || (this._v093FishCooldown || 0) > performance.now()) return false
    const hit = nearestFish(this, 5.2)
    if (!hit) { this.toast('Chegue mais perto de um peixe para pescar.'); return false }
    const {fish, world} = hit
    this._v093FishCooldown = performance.now() + 850
    const dir = world.clone().sub(this.player.position); dir.y = 0
    if (dir.lengthSq()) this.player.rotation.y = Math.atan2(dir.x, dir.z)
    this.attackClock = Math.max(this.attackClock || 0, .48)
    this.player.userData.motion = 'attack'

    // Short fishing line visual; disposed quickly and never stored in the chunk.
    const start = this.player.position.clone().add(new THREE.Vector3(0, 1.55, 0))
    const lineGeo = new THREE.BufferGeometry().setFromPoints([start, world.clone().setY(.12)])
    const lineMat = new THREE.LineBasicMaterial({color:0xe6f4ff,transparent:true,opacity:.9})
    const line = new THREE.Line(lineGeo, lineMat)
    this.scene.add(line)
    setTimeout(() => { this.scene?.remove?.(line); lineGeo.dispose(); lineMat.dispose() }, 420)

    const splashGeo = new THREE.RingGeometry(.12, .34, 14)
    const splashMat = new THREE.MeshBasicMaterial({color:0xa8e5ff,transparent:true,opacity:.72,side:THREE.DoubleSide,depthWrite:false})
    const splash = new THREE.Mesh(splashGeo, splashMat)
    splash.rotation.x = -Math.PI / 2
    splash.position.copy(world).setY(.145)
    this.scene.add(splash)
    const splashStart = performance.now()
    const animateSplash = () => {
      const p = Math.min(1, (performance.now() - splashStart) / 420)
      splash.scale.setScalar(1 + p * 2.2)
      splashMat.opacity = .72 * (1 - p)
      if (p < 1) requestAnimationFrame(animateSplash)
      else { this.scene?.remove?.(splash); splashGeo.dispose(); splashMat.dispose() }
    }
    requestAnimationFrame(animateSplash)

    const success = Math.random() > .10
    if (!success) {
      fish.phase += 2.1
      this.toast('O peixe escapou! Tente novamente.')
      this.haptic?.(12)
      return true
    }

    fish.alive = false
    fish.g.visible = false
    fish.caughtUntil = Date.now() + 26000 + Math.floor(Math.random() * 18000)
    const value = fish.golden ? 90 : fish.zoneId === 'coast' ? 42 : 28
    const item = {
      id:`fish-drop-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      name:fish.name,type:'material',subtype:'fish',category:'fish',rarity:fish.golden?'Rara':'Comum',
      color:fish.golden?'#f6c453':'#5bc0eb',icon:'🐟',qty:1,value,zoneId:fish.zoneId,
      description:'Peixe fresco. Pode ser vendido em qualquer loja; mercados costeiros valorizam a pesca.'
    }
    if (this.addInventoryItem(item)) {
      this.state.stats ||= {}
      this.state.stats.fishCaught = (this.state.stats.fishCaught || 0) + 1
      this.gainXp?.(fish.golden ? 35 : 12)
      this.toast(`🐟 ${fish.name} pescado! Valor base: ${value} ouro`)
      this.spawnFloatingLootText?.(world, `+1 ${fish.name} 🐟`)
      this.saveGame?.()
    }
    this.haptic?.(24)
    return true
  }

  const previousInteractions = proto.updateInteractions
  proto.updateInteractions = function v093Interactions(...args) {
    const result = previousInteractions.apply(this, args)
    if (!this.state.interactionPrompt && !this.state.dungeon && nearestFish(this, 5.2)) {
      this.state.interactionPrompt = 'E ou F — Pescar peixe'
      this.state.actionButton = {type:'fish',label:'Pescar peixe',icon:'🐟'}
    }
    return result
  }

  const previousInteract = proto.interact
  proto.interact = function v093Interact(...args) {
    if (!this.state.uiPanel && this.state.actionButton?.type === 'fish') return this.tryFish()
    return previousInteract.apply(this, args)
  }

  const previousBind = proto.bind
  proto.bind = function v093Bind(...args) {
    const result = previousBind.apply(this, args)
    const fishKey = (event) => {
      if (event.code !== 'KeyF' || event.repeat || this.state?.needsNickname || this.state?.uiPanel || this.state?.dungeon) return
      if (!nearestFish(this, 5.2)) return
      event.preventDefault()
      event.stopImmediatePropagation()
      this.tryFish()
    }
    window.addEventListener('keydown', fishKey, {capture:true,passive:false})
    this._unbind ||= []
    this._unbind.push([window,'keydown',fishKey,{capture:true,passive:false}])
    return result
  }

  // Sword points forward at idle and performs a forward slash/thrust instead of hanging down.
  const previousAnimatePlayer = proto.animatePlayer
  proto.animatePlayer = function v093AnimatePlayer(dt, t, moving) {
    const result = previousAnimatePlayer.call(this, dt, t, moving)
    const pivot = this.rig?.swordPivot
    const subtype = this.state?.equipment?.weapon?.subtype || 'sword'
    if (!pivot || subtype === 'bow' || subtype === 'spellbook') return result
    const attacking = (this.attackClock || 0) > 0
    const progress = attacking ? Math.max(0, Math.min(1, 1 - this.attackClock / .34)) : 0
    const swing = attacking ? Math.sin(progress * Math.PI) : 0
    pivot.rotation.x = damp(pivot.rotation.x, -Math.PI / 2 - swing * .18, 18, dt)
    pivot.rotation.y = damp(pivot.rotation.y, swing * .34, 18, dt)
    pivot.rotation.z = damp(pivot.rotation.z, attacking ? (-.52 + swing * 1.12) : -.12, 20, dt)
    pivot.position.z = damp(pivot.position.z, .05 + swing * .22, 18, dt)
    return result
  }

  // Water/fish updates use direct references instead of traversing every object in every
  // chunk each frame. Also cull far resources to reduce draw calls.
  proto.updateWater = function v093Water(t) {
    this.fishNodes ||= []
    const now = Date.now()
    const perfNow = performance.now()
    if (this._v093FrameMark) {
      const frameMs = Math.min(50, Math.max(4, perfNow - this._v093FrameMark))
      this._v093FrameAvg = this._v093FrameAvg ? this._v093FrameAvg * .96 + frameMs * .04 : frameMs
    }
    this._v093FrameMark = perfNow
    if (!this._v093QualityAt || perfNow - this._v093QualityAt > 4200) {
      this._v093QualityAt = perfNow
      const cap = this.isTouchDevice ? 1.0 : 1.30
      const requested = Math.min(Number(this.settings?.pixelRatio) || 1, cap)
      let adaptive = Math.min(requested, this._v093AdaptiveDpr || requested)
      if ((this._v093FrameAvg || 16) > 21.5) adaptive = Math.max(.78, adaptive - .10)
      else if ((this._v093FrameAvg || 16) < 16.8) adaptive = Math.min(requested, adaptive + .05)
      if (Math.abs(adaptive - (this._v093AdaptiveDpr || requested)) > .02) {
        this._v093AdaptiveDpr = adaptive
        this.resize?.()
      } else this._v093AdaptiveDpr = adaptive
    }
    for (const chunk of this.chunks?.values?.() || []) {
      if (!chunk.group?.visible) continue
      if (chunk.waterMesh) chunk.waterMesh.position.y = .12 + Math.sin(t * 1.35 + chunk.cx * .7 + chunk.cz) * .018
    }
    for (const fish of this.fishNodes) {
      if (!fish?.g?.parent) continue
      if (!fish.alive) {
        if (now >= fish.caughtUntil) { fish.alive = true; fish.g.visible = true }
        else continue
      }
      const chunk = this.chunks?.get(fish.chunkKey)
      const worldX = (chunk?.group?.position.x || 0) + fish.homeX
      const worldZ = (chunk?.group?.position.z || 0) + fish.homeZ
      const fishMax = this.isTouchDevice ? 58 : 82
      const fdx = worldX - this.player.position.x, fdz = worldZ - this.player.position.z
      if (fdx*fdx + fdz*fdz > fishMax*fishMax) { fish.g.visible = false; continue }
      fish.g.visible = true
      const tt = t * fish.speed + fish.phase
      fish.g.position.x = fish.homeX + Math.cos(tt * .83) * 2.0
      fish.g.position.z = fish.homeZ + Math.sin(tt * .67) * 1.25
      fish.g.position.y = .035 + Math.sin(tt * 2.1) * .025
      fish.g.rotation.y = -tt * .83 + Math.PI / 2
      fish.g.children[1] && (fish.g.children[1].rotation.y = Math.sin(tt * 5) * .35)
    }

    if (!this._v093CullAt || performance.now() - this._v093CullAt > 260) {
      this._v093CullAt = performance.now()
      const px = this.player.position.x, pz = this.player.position.z
      const max = this.isTouchDevice ? 78 : 112
      const max2 = max * max
      for (const node of this.resourceNodes || []) {
        if (!node?.mesh || node.hp <= 0) continue
        const dx = node.gx - px, dz = node.gz - pz
        node.mesh.visible = dx*dx + dz*dz <= max2
      }
    }
  }

  const previousResize = proto.resize
  proto.resize = function v093Resize(...args) {
    const result = previousResize.apply(this, args)
    const cap = this.isTouchDevice ? 1.0 : 1.30
    const requested = Math.min(Number(this.settings?.pixelRatio) || 1, cap)
    const adaptive = Math.min(requested, this._v093AdaptiveDpr || requested)
    this.renderer?.setPixelRatio?.(Math.max(.78, adaptive))
    return result
  }

  const previousInit = proto.init
  proto.init = function v093Init(...args) {
    const storedRenderDistance = Number(localStorage.getItem('shadow-ascension-v093-render-distance'))
    const result = previousInit.apply(this, args)
    // The old v0.8.9 patch forced four chunks immediately. V0.9.3 starts balanced,
    // while the settings slider can still raise it to four if the player wants.
    const balancedDefault = this.isTouchDevice ? 2 : 3
    this.settings.renderDistance = Number.isFinite(storedRenderDistance) && storedRenderDistance >= 1 && storedRenderDistance <= 4
      ? storedRenderDistance
      : balancedDefault
    this.state.settings = this.settings
    if (this.renderer) {
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping
      this.renderer.toneMappingExposure = 1.08
      this.renderer.outputColorSpace = THREE.SRGBColorSpace
      this.renderer.shadowMap.enabled = this.settings.shadows !== false
    }
    if (this.sun?.shadow?.mapSize) {
      this.sun.shadow.mapSize.set(1024, 1024)
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose?.(); this.sun.shadow.map = null }
    }
    if (this.scene?.fog) {
      this.scene.fog.near = this.isTouchDevice ? 64 : 82
      this.scene.fog.far = this.isTouchDevice ? 190 : 235
    }
    if (this.camera) {
      this.camera.far = 700
      this.camera.updateProjectionMatrix?.()
    }
    this.resize?.()
    setTimeout(() => {
      const version = document.querySelector?.('.brand-row small')
      if (version) version.textContent = 'WEB 3D • V0.9.3 ONLINE'
    }, 80)
    return result
  }

  const previousApplySettings = proto.applySettings
  proto.applySettings = function v093ApplySettings(next = {}) {
    const safeNext = {...next}
    if (safeNext.renderDistance != null) safeNext.renderDistance = Math.max(1, Math.min(4, Number(safeNext.renderDistance) || 3))
    if (safeNext.pixelRatio != null) safeNext.pixelRatio = Math.max(.75, Math.min(1.3, Number(safeNext.pixelRatio) || 1))
    const result = previousApplySettings.call(this, safeNext)
    if (safeNext.renderDistance != null) localStorage.setItem('shadow-ascension-v093-render-distance', String(safeNext.renderDistance))
    this._v093StreamKey = null
    return result
  }
}
