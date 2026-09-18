// AmbientAtmosphere.js - Rich environmental ambiance, biome atmospheric particles,
// roadside campfires, night lighting, and organic ground flora for Asterra.
import * as THREE from 'three'
import { ZONES, CITIES, ROADS } from '../config.js'
import { zoneAt } from '../utils.js'

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({
  color,
  roughness: 0.8,
  metalness: 0.1,
  ...extra,
})

const mesh = (geo, material) => {
  const m = new THREE.Mesh(geo, material)
  m.castShadow = false
  m.receiveShadow = true
  return m
}

export class AmbientAtmosphere {
  constructor(game) {
    this.game = game
    this.root = new THREE.Group()
    this.root.name = 'AmbientAtmosphere'

    this.particleCount = game.isTouchDevice ? 320 : 650
    this.particles = null
    this.particleData = []
    this.currentZoneId = 'aurora'
    this.targetZoneId = 'aurora'

    this.campfires = []
    this.nightLamps = []
    this.floraGroups = new Map() // chunkKey -> Group

    this.lastDayState = null
  }

  init() {
    this.game.worldRoot.add(this.root)
    this.initAtmosphericParticles()
    this.buildRoadsideCampfires()
    this.registerNightLamps()
    this.buildWaterReeds()
  }

  // =========================================================================
  // 1. BIOME ATMOSPHERIC PARTICLES (GPU BufferGeometry Points)
  // =========================================================================
  initAtmosphericParticles() {
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(this.particleCount * 3)
    const cols = new Float32Array(this.particleCount * 3)
    const sizes = new Float32Array(this.particleCount)

    this.particleData = []
    for (let i = 0; i < this.particleCount; i++) {
      const x = (Math.random() - 0.5) * 48
      const y = 0.5 + Math.random() * 12
      const z = (Math.random() - 0.5) * 48

      pos[i * 3] = x
      pos[i * 3 + 1] = y
      pos[i * 3 + 2] = z

      cols[i * 3] = 0.95
      cols[i * 3 + 1] = 0.9
      cols[i * 3 + 2] = 0.6

      sizes[i] = 0.12 + Math.random() * 0.18

      this.particleData.push({
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.3,
        vz: (Math.random() - 0.5) * 0.4,
        phase: Math.random() * Math.PI * 2,
        baseSize: sizes[i],
        life: Math.random(),
      })
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3))

    // Canvas particle texture for smooth round glowing motes
    const canvas = document.createElement('canvas')
    canvas.width = 32
    canvas.height = 32
    const ctx = canvas.getContext('2d')
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16)
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)')
    grad.addColorStop(0.35, 'rgba(255, 255, 255, 0.85)')
    grad.addColorStop(0.7, 'rgba(255, 255, 255, 0.25)')
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 32, 32)
    const pTex = new THREE.CanvasTexture(canvas)

    const pMat = new THREE.PointsMaterial({
      size: 0.28,
      map: pTex,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })

    this.particles = new THREE.Points(geo, pMat)
    this.particles.frustumCulled = false
    this.root.add(this.particles)
  }

  // Get RGB color palette for current biome and time of day
  getBiomeColor(zoneId, isNight, t) {
    if (zoneId === 'ember') {
      // Fiery embers
      const r = 1.0, g = 0.3 + Math.sin(t * 3) * 0.15, b = 0.05
      return [r, g, b]
    }
    if (zoneId === 'forest') {
      // Mystical green / autumn spores
      const r = 0.4 + Math.sin(t) * 0.15, g = 0.88, b = 0.45
      return [r, g, b]
    }
    if (zoneId === 'void') {
      // Ethereal purple
      const r = 0.65, g = 0.2 + Math.sin(t * 2) * 0.1, b = 0.95
      return [r, g, b]
    }
    if (zoneId === 'coast') {
      // Salty sea mist
      return [0.4, 0.85, 0.98]
    }
    if (zoneId === 'highlands') {
      // Alpine crisp white/silver
      return [0.85, 0.92, 1.0]
    }
    if (zoneId === 'crown') {
      // Celestial star gold
      return [0.98, 0.92, 0.55]
    }
    // Aurora & Meadow:
    if (isNight) {
      // Glowing greenish fireflies
      const blink = (Math.sin(t * 4) + 1) * 0.5
      return [0.55 * blink, 0.95 * blink, 0.25 * blink]
    }
    // Daytime golden sunlight motes
    return [0.98, 0.88, 0.42]
  }

  updateAtmosphericParticles(dt, t) {
    if (!this.particles || this.game.state.dungeon) {
      if (this.particles) this.particles.visible = false
      return
    }
    this.particles.visible = true

    const playerPos = this.game.player.position
    this.particles.position.set(playerPos.x, 0, playerPos.z)

    const curZone = zoneAt(playerPos.x, playerPos.z, ZONES)
    this.currentZoneId = curZone ? curZone.id : 'aurora'

    const hour = this.game.dayHours || 12
    const isNight = hour < 5.8 || hour > 18.5

    const [tr, tg, tb] = this.getBiomeColor(this.currentZoneId, isNight, t)

    const pos = this.particles.geometry.attributes.position.array
    const cols = this.particles.geometry.attributes.color.array

    const isEmber = this.currentZoneId === 'ember'
    const isVoid = this.currentZoneId === 'void'
    const isHighland = this.currentZoneId === 'highlands'

    for (let i = 0; i < this.particleCount; i++) {
      const p = this.particleData[i]
      const idx = i * 3

      // Movement logic per biome
      if (isEmber || isVoid) {
        // Ascending embers / void wisps
        pos[idx + 1] += dt * (1.2 + p.life * 1.5)
        pos[idx] += Math.sin(t * 1.5 + p.phase) * dt * 0.8
        pos[idx + 2] += Math.cos(t * 1.5 + p.phase) * dt * 0.8
        if (pos[idx + 1] > 14) {
          pos[idx + 1] = 0.3
          pos[idx] = (Math.random() - 0.5) * 44
          pos[idx + 2] = (Math.random() - 0.5) * 44
        }
      } else if (isHighland) {
        // High wind streaks drifting horizontally
        pos[idx] += dt * 3.8
        pos[idx + 1] -= dt * 0.4
        pos[idx + 2] += Math.sin(t + p.phase) * dt * 0.4
        if (pos[idx] > 24) pos[idx] = -24
        if (pos[idx + 1] < 0.2) pos[idx + 1] = 9
      } else {
        // Gentle floating motes / fireflies
        pos[idx] += Math.sin(t * 0.8 + p.phase) * dt * (isNight ? 1.1 : 0.4)
        pos[idx + 1] += Math.cos(t * 0.6 + p.phase) * dt * (isNight ? 0.6 : 0.25)
        pos[idx + 2] += Math.sin(t * 0.7 + p.phase * 1.5) * dt * (isNight ? 1.1 : 0.4)

        if (pos[idx + 1] < 0.2) pos[idx + 1] = 7.5
        if (pos[idx + 1] > 8.5) pos[idx + 1] = 0.5
      }

      // Smooth color shift
      cols[idx] += (tr - cols[idx]) * dt * 2.0
      cols[idx + 1] += (tg - cols[idx + 1]) * dt * 2.0
      cols[idx + 2] += (tb - cols[idx + 2]) * dt * 2.0
    }

    this.particles.geometry.attributes.position.needsUpdate = true
    this.particles.geometry.attributes.color.needsUpdate = true
  }

  // =========================================================================
  // 2. ROADSIDE CAMPFIRES & WAYPOINTS
  // =========================================================================
  buildRoadsideCampfires() {
    const campGroup = new THREE.Group()
    campGroup.name = 'RoadCampfires'

    const stoneMat = mat(0x4b5563, { roughness: 0.9, flatShading: true })
    const woodMat = mat(0x3e2723, { roughness: 0.85 })
    const emberMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xef4444,
      emissiveIntensity: 1.2,
      roughness: 0.4,
    })

    // Place campfires at midpoint of long roads
    for (const road of ROADS) {
      const cityA = CITIES.find(c => c.id === road.a)
      const cityB = CITIES.find(c => c.id === road.b)
      if (!cityA || !cityB) continue

      const midX = (cityA.x + cityB.x) * 0.5
      const midZ = (cityA.z + cityB.z) * 0.5
      const dx = cityB.x - cityA.x
      const dz = cityB.z - cityA.z
      const dist = Math.hypot(dx, dz)
      const normX = -dz / (dist || 1)
      const normZ = dx / (dist || 1)

      // Place 5.5m beside the road
      const cx = midX + normX * 5.5
      const cz = midZ + normZ * 5.5

      const camp = new THREE.Group()
      camp.position.set(cx, 0, cz)

      // Ring of small stones
      for (let s = 0; s < 7; s++) {
        const ang = (s / 7) * Math.PI * 2
        const stone = mesh(new THREE.DodecahedronGeometry(0.18, 0), stoneMat)
        stone.position.set(Math.cos(ang) * 0.65, 0.12, Math.sin(ang) * 0.65)
        camp.add(stone)
      }

      // Crossed logs
      for (let l = 0; l < 3; l++) {
        const log = mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.95, 5), woodMat)
        log.rotation.z = Math.PI / 2
        log.rotation.y = (l * Math.PI) / 3
        log.position.y = 0.14
        camp.add(log)
      }

      // Glowing ember core
      const emberCore = mesh(new THREE.DodecahedronGeometry(0.28, 1), emberMat)
      emberCore.position.y = 0.22
      camp.add(emberCore)

      // Rest log bench nearby
      const bench = mesh(new THREE.CylinderGeometry(0.18, 0.2, 2.2, 6), woodMat)
      bench.rotation.z = Math.PI / 2
      bench.rotation.y = Math.atan2(dx, dz)
      bench.position.set(normX * 1.8, 0.18, normZ * 1.8)
      camp.add(bench)

      // Smoke point sprite
      const smokeMat = new THREE.MeshBasicMaterial({
        color: 0xd1d5db,
        transparent: true,
        opacity: 0.35,
      })
      const smokeWisps = []
      for (let sm = 0; sm < 4; sm++) {
        const wisp = mesh(new THREE.SphereGeometry(0.12 + sm * 0.05, 5, 5), smokeMat)
        wisp.position.set((Math.random() - 0.5) * 0.2, 0.4 + sm * 0.35, (Math.random() - 0.5) * 0.2)
        camp.add(wisp)
        smokeWisps.push(wisp)
      }

      campGroup.add(camp)
      this.campfires.push({ camp, emberCore, smokeWisps, cx, cz })
    }

    this.root.add(campGroup)
  }

  updateCampfires(dt, t) {
    for (const cf of this.campfires) {
      // Ember flicker
      const pulse = 1.0 + Math.sin(t * 7 + cf.cx) * 0.35
      cf.emberCore.material.emissiveIntensity = pulse

      // Smoke rise & wander
      for (let s = 0; s < cf.smokeWisps.length; s++) {
        const w = cf.smokeWisps[s]
        w.position.y += dt * 0.35
        w.position.x += Math.sin(t * 1.5 + s) * dt * 0.15
        if (w.position.y > 1.8) {
          w.position.y = 0.45
          w.position.x = (Math.random() - 0.5) * 0.1
        }
      }
    }
  }

  // =========================================================================
  // 3. NIGHT LIGHTING (Streetlamps & Torchglow)
  // =========================================================================
  registerNightLamps() {
    this.nightLamps = []

    // Collect city streetlamps
    for (const city of this.game.cityGroups || []) {
      city.group.traverse(o => {
        if (o.isMesh && o.material?.color?.getHex() === 0xffcf76) {
          this.nightLamps.push(o)
        }
      })
    }

    // Collect bridge lanterns from WorldEnvironment
    if (this.game.worldEnv?.envGroup) {
      this.game.worldEnv.envGroup.traverse(o => {
        if (o.isMesh && o.material?.color?.getHex() === 0xfde047) {
          this.nightLamps.push(o)
        }
      })
    }
  }

  updateNightLighting() {
    const hour = this.game.dayHours || 12
    const isNight = hour < 5.8 || hour > 18.5

    if (this.lastDayState === isNight) return
    this.lastDayState = isNight

    for (const lamp of this.nightLamps) {
      if (lamp.material) {
        lamp.material.color.setHex(isNight ? 0xfff3a0 : 0x78623b)
      }
    }
  }

  // =========================================================================
  // 4. WATER REEDS & SHORELINE POLISH
  // =========================================================================
  buildWaterReeds() {
    const reedGroup = new THREE.Group()
    reedGroup.name = 'WaterShoreReeds'

    const reedMat = mat(0x2d6a4f, { roughness: 0.85 })
    const cattailMat = mat(0x4a2810, { roughness: 0.9 })

    // Build clusters of reeds near bridges and water crossings
    const spots = [
      { x: 92, z: 66 },
      { x: -80, z: 114 },
      { x: 140, z: -66 },
    ]

    for (const sp of spots) {
      const cluster = new THREE.Group()
      cluster.position.set(sp.x, 0, sp.z)

      for (let i = 0; i < 9; i++) {
        const rx = (Math.random() - 0.5) * 3.5
        const rz = (Math.random() - 0.5) * 3.5
        const h = 1.2 + Math.random() * 0.7

        const stalk = mesh(new THREE.CylinderGeometry(0.02, 0.03, h, 4), reedMat)
        stalk.position.set(rx, h * 0.5, rz)
        stalk.rotation.z = (Math.random() - 0.5) * 0.2
        cluster.add(stalk)

        if (i % 2 === 0) {
          const brownTip = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.26, 5), cattailMat)
          brownTip.position.set(rx, h * 0.85, rz)
          cluster.add(brownTip)
        }
      }
      reedGroup.add(cluster)
    }

    this.root.add(reedGroup)
  }

  // =========================================================================
  // 5. CHUNK GROUND FLORA (Instanced Wildflowers & Grass Clumps)
  // =========================================================================
  decorateChunkFlora(cx, cz, chunkKey, chunkGroup, zone) {
    if (this.floraGroups.has(chunkKey)) return

    const floraGroup = new THREE.Group()
    floraGroup.name = `Flora_${chunkKey}`

    const isMeadow = zone.id === 'aurora' || zone.id === 'meadow'
    const isForest = zone.id === 'forest'
    const isCoast = zone.id === 'coast'

    const count = this.game.isTouchDevice ? 10 : 20
    const flowerGeo = new THREE.ConeGeometry(0.1, 0.22, 5)
    const flowerColor = isMeadow ? 0xfef08a : isForest ? 0x60a5fa : isCoast ? 0x93c5fd : 0xf97316
    const flowerMat = new THREE.MeshStandardMaterial({
      color: flowerColor,
      roughness: 0.6,
      emissive: isForest ? 0x1d4ed8 : 0x000000,
      emissiveIntensity: isForest ? 0.45 : 0,
    })

    const grassMat = mat(zone.ground ? zone.ground : 0x4d7c0f, { flatShading: true })

    const size = 48
    for (let i = 0; i < count; i++) {
      const rx = (Math.random() - 0.5) * size * 0.82
      const rz = (Math.random() - 0.5) * size * 0.82
      const gx = cx * size + rx
      const gz = cz * size + rz

      if (this.game.isInsideCitySafeZone(gx, gz, 34) || this.game.isOnRoad(gx, gz, 5.5)) continue

      // Clump of 3 grass blades
      const clump = new THREE.Group()
      clump.position.set(rx, 0, rz)
      for (let b = 0; b < 3; b++) {
        const blade = mesh(new THREE.ConeGeometry(0.04, 0.35 + Math.random() * 0.2, 3), grassMat)
        blade.position.set((b - 1) * 0.08, 0.18, 0)
        blade.rotation.z = (b - 1) * 0.25
        clump.add(blade)
      }

      // Flower in center
      if (Math.random() > 0.4) {
        const fl = mesh(flowerGeo, flowerMat)
        fl.position.set(0, 0.26, 0)
        clump.add(fl)
      }

      floraGroup.add(clump)
    }

    chunkGroup.add(floraGroup)
    this.floraGroups.set(chunkKey, floraGroup)
  }

  // Frame tick
  update(dt, t) {
    this.updateAtmosphericParticles(dt, t)
    this.updateCampfires(dt, t)
    this.updateNightLighting()
  }
}
