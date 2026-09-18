// CaravanManager.js - Central Living Caravan Ecosystem, lifecycle, 3D cart, 2-tier LOD, crime and looting
import * as THREE from 'three'
import { CITIES } from '../config.js'
import { CARAVAN_STATES, CARAVAN_CATEGORIES, ROUTE_SECURITY, CITY_CARGO_SPECIALTIES, CARAVAN_SETTINGS } from './CaravanConfig.js'
import { WorldRoadGraph } from './WorldRoadGraph.js'
import { CaravanEscortAI } from './CaravanEscortAI.js'

export class CaravanManager {
  constructor(game) {
    this.game = game
    this.roadGraph = new WorldRoadGraph(game)
    this.escortAI = new CaravanEscortAI(game)
    this.caravans = []
    this.routeRaidStats = new Map() // routeKey -> number of successful raids
    this.nearDistanceThreshold = 120 // 120m for full 3D simulation LOD
  }

  init() {
    this.spawnInitialCaravans()
  }

  spawnInitialCaravans() {
    if (this.caravans.length) return
    for (const city of CITIES.slice(0, CARAVAN_SETTINGS.maxActiveCaravans)) {
      const destinationId = this.roadGraph.getRandomDestination(city.id)
      this.createCaravan({ originId: city.id, destinationId })
    }
  }

  createCaravan({ originId, destinationId, categoryKey = 'COMMERCIAL' }) {
    const originCity = CITIES.find(c => c.id === originId)
    const destCity = CITIES.find(c => c.id === destinationId)
    if (!originCity || !destCity || this.caravans.length >= CARAVAN_SETTINGS.maxActiveCaravans) return null
    if (this.caravans.some(c => c.originCityId === originId && c.destinationCityId === destinationId && c.state !== CARAVAN_STATES.DESTROYED)) return null

    const category = CARAVAN_CATEGORIES[categoryKey] || CARAVAN_CATEGORIES.COMMERCIAL
    const cityPath = this.roadGraph.findCityPath(originId, destinationId)
    const waypoints = this.roadGraph.buildWaypointsForRoute(cityPath)
    if (waypoints.length === 0) return null

    const routeKey = this.roadGraph.getRouteKey(originId, destinationId)
    const raidCount = this.routeRaidStats.get(routeKey) || 0
    const security = raidCount >= 3 ? ROUTE_SECURITY.CRITICAL : raidCount >= 1 ? ROUTE_SECURITY.DANGEROUS : ROUTE_SECURITY.SAFE

    const specialty = CITY_CARGO_SPECIALTIES[originId] || CITY_CARGO_SPECIALTIES['aurora-city']
    const cargo = specialty.goods.map(g => ({
      ...g,
      qty: Math.round(g.qtyRange[0] + Math.random() * (g.qtyRange[1] - g.qtyRange[0]))
    }))
    const gold = Math.round(specialty.goldRange[0] + Math.random() * (specialty.goldRange[1] - specialty.goldRange[0]))

    const caravanId = `caravan_${originId}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`
    const spawnPos = { x: waypoints[0].x, z: waypoints[0].z }

    // Calculate escort count and level based on city and route security
    const guardCount = Math.min(8, category.guardCount + security.guardBonus)
    const baseLevel = Math.max(1, (originCity.zoneId === 'aurora' ? 10 : originCity.zoneId === 'meadow' ? 20 : 35) + security.levelBonus)
    const isElite = Math.random() < security.eliteChance

    const caravan = {
      id: caravanId,
      name: `Caravana de ${originCity.name}`,
      originCityId: originId,
      destinationCityId: destinationId,
      originCityName: originCity.name,
      destCityName: destCity.name,
      category,
      security,
      routeKey,
      state: CARAVAN_STATES.TRAVELING,
      waypoints,
      currentWaypointIdx: 0,
      position: new THREE.Vector3(spawnPos.x, 0, spawnPos.z),
      heading: 0,
      speed: CARAVAN_SETTINGS.travelSpeed,
      hp: CARAVAN_SETTINGS.cartMaxHp,
      maxHp: CARAVAN_SETTINGS.cartMaxHp,
      cargo,
      cargoGold: gold,
      attackedByPlayer: false,
      stuckTimer: 0,
      stateTimer: 0,
      meshGroup: null,
      wheels: [],
      guards: [],
      lootAvailable: false
    }

    // Build 3D mesh (cart, horse, merchant)
    this.buildCaravanMesh(caravan)
    caravan.guards = this.escortAI.createEscortGuards(caravan, guardCount, baseLevel, isElite)

    this.caravans.push(caravan)
    return caravan
  }

  buildCaravanMesh(caravan) {
    const g = new THREE.Group()
    g.name = `CaravanMesh_${caravan.id}`

    // 1. Wooden Wagon Body
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.85, metalness: 0.1 })
    const cartBody = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.1, 4.2), woodMat)
    cartBody.position.y = 1.2
    cartBody.castShadow = true
    g.add(cartBody)

    // 2. Cloth Canopy (white/tan fabric)
    const clothMat = new THREE.MeshStandardMaterial({ color: 0xe2d8c3, roughness: 0.9, side: THREE.DoubleSide })
    const canopy = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 4.0, 16, 1, false, 0, Math.PI), clothMat)
    canopy.position.set(0, 1.75, 0)
    canopy.rotation.z = Math.PI / 2
    canopy.rotation.y = Math.PI / 2
    g.add(canopy)

    // 3. Cargo crates and barrels in back
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x785338, roughness: 0.9 })
    const crate1 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), crateMat)
    crate1.position.set(0.5, 1.4, -0.8)
    const crate2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), crateMat)
    crate2.position.set(-0.5, 1.35, -0.6)
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.7 })
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.7, 10), barrelMat)
    barrel.position.set(0, 1.4, -1.2)
    g.add(crate1, crate2, barrel)

    // 4. Rotating Wooden Wheels
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x332211, metalness: 0.2, roughness: 0.8 })
    const wheelGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.18, 12)
    wheelGeo.rotateZ(Math.PI / 2)

    const wheelOffsets = [
      [-1.25, 0.55, 1.2],
      [1.25, 0.55, 1.2],
      [-1.25, 0.55, -1.2],
      [1.25, 0.55, -1.2]
    ]

    const wheels = []
    for (const [wx, wy, wz] of wheelOffsets) {
      const w = new THREE.Mesh(wheelGeo, wheelMat)
      w.position.set(wx, wy, wz)
      w.castShadow = true
      g.add(w)
      wheels.push(w)
    }
    caravan.wheels = wheels

    // 5. Draft Horse in front
    const horseGroup = new THREE.Group()
    horseGroup.position.set(0, 0, 3.2)
    const horseMat = new THREE.MeshStandardMaterial({ color: 0x4a2e18, roughness: 0.7 })
    const horseBody = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 1.8), horseMat)
    horseBody.position.y = 1.0
    const horseHead = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.8), horseMat)
    horseHead.position.set(0, 1.7, 0.7)
    horseHead.rotation.x = 0.35
    horseGroup.add(horseBody, horseHead)

    // Harness poles connecting to cart
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x222222 })
    const pole1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.6), poleMat)
    pole1.position.set(-0.6, 0.8, -0.9)
    const pole2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.6), poleMat)
    pole2.position.set(0.6, 0.8, -0.9)
    horseGroup.add(pole1, pole2)
    g.add(horseGroup)

    // 6. Merchant NPC seated in front
    const merchantMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8 })
    const merchantBody = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.4), merchantMat)
    merchantBody.position.set(0, 1.8, 1.5)
    const merchantHead = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), new THREE.MeshStandardMaterial({ color: 0xe0a980 }))
    merchantHead.position.set(0, 2.2, 1.5)
    g.add(merchantBody, merchantHead)

    // 7. Overhead Nameplate
    const nameplate = this.buildCaravanNameplate(caravan)
    nameplate.position.y = 3.2
    g.add(nameplate)
    caravan.nameplate = nameplate

    g.position.copy(caravan.position)
    this.game.worldRoot.add(g)
    caravan.meshGroup = g
  }

  buildCaravanNameplate(caravan) {
    const canvas = document.createElement('canvas')
    canvas.width = 440
    canvas.height = 90
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = 'rgba(7, 15, 27, 0.9)'
    ctx.strokeStyle = caravan.category.color
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.roundRect?.(4, 4, 432, 82, 16)
    if (!ctx.roundRect) ctx.rect(4, 4, 432, 82)
    ctx.fill()
    ctx.stroke()

    ctx.font = 'bold 22px Inter, Arial'
    ctx.fillStyle = caravan.category.color
    ctx.textAlign = 'center'
    ctx.fillText(`${caravan.category.icon} ${caravan.name}`, 220, 32)

    ctx.font = '14px Inter, Arial'
    ctx.fillStyle = '#cbd5e1'
    ctx.fillText(`Destino: ${caravan.destCityName} • [${caravan.security.label}]`, 220, 56)

    // HP Bar
    ctx.fillStyle = '#1e293b'
    ctx.fillRect(20, 66, 400, 12)
    ctx.fillStyle = '#22c55e'
    ctx.fillRect(20, 66, 400, 12)

    const texture = new THREE.CanvasTexture(canvas)
    texture.minFilter = THREE.LinearFilter
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }))
    sprite.scale.set(4.4, 0.9, 1)
    sprite.renderOrder = 30
    return sprite
  }

  updateCaravanHPBar(caravan) {
    if (!caravan.nameplate || !caravan.nameplate.material?.map?.image) return
    const canvas = caravan.nameplate.material.map.image
    const ctx = canvas.getContext('2d')
    const pct = Math.max(0, Math.min(1, caravan.hp / caravan.maxHp))

    ctx.fillStyle = 'rgba(7, 15, 27, 0.9)'
    ctx.strokeStyle = caravan.category.color
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.roundRect?.(4, 4, 432, 82, 16)
    if (!ctx.roundRect) ctx.rect(4, 4, 432, 82)
    ctx.fill()
    ctx.stroke()

    ctx.font = 'bold 22px Inter, Arial'
    ctx.fillStyle = caravan.category.color
    ctx.textAlign = 'center'
    ctx.fillText(`${caravan.category.icon} ${caravan.name}`, 220, 32)

    ctx.font = '14px Inter, Arial'
    ctx.fillStyle = '#cbd5e1'
    ctx.fillText(`Destino: ${caravan.destCityName} • [${caravan.security.label}]`, 220, 56)

    ctx.fillStyle = '#1e293b'
    ctx.fillRect(20, 66, 400, 12)
    ctx.fillStyle = pct > 0.5 ? '#22c55e' : pct > 0.25 ? '#f59e0b' : '#ef4444'
    ctx.fillRect(20, 66, 400 * pct, 12)

    caravan.nameplate.material.map.needsUpdate = true
  }

  update(dt, t) {
    const playerPos = this.game.player ? this.game.player.position : new THREE.Vector3()

    for (let i = this.caravans.length - 1; i >= 0; i--) {
      const c = this.caravans[i]
      const distToPlayer = c.position.distanceTo(playerPos)
      const isNear = distToPlayer < this.nearDistanceThreshold

      // LOD Simulation
      if (c.meshGroup) {
        c.meshGroup.visible = isNear && !this.game.state?.dungeon
      }
      for (const g of c.guards) {
        if (g.mesh) g.mesh.visible = isNear && !g.dead && !this.game.state?.dungeon
      }

      // Check state machine
      switch (c.state) {
        case CARAVAN_STATES.TRAVELING:
          this.updateTraveling(c, dt, isNear)
          break
        case CARAVAN_STATES.UNDER_ATTACK:
          this.updateUnderAttack(c, dt, isNear)
          break
        case CARAVAN_STATES.BROKEN_DOWN:
          this.updateBrokenDown(c, dt)
          break
        case CARAVAN_STATES.ARRIVED:
        case CARAVAN_STATES.UNLOADING:
        case CARAVAN_STATES.RESTOCKING:
          this.updateCityCycle(c, dt)
          break
        case CARAVAN_STATES.ROBBED:
        case CARAVAN_STATES.RETREATING:
          this.updateRetreating(c, dt, isNear)
          break
        case CARAVAN_STATES.DESTROYED:
          this.cleanupCaravan(c, i)
          break
      }

      // Update escort AI if near
      if (isNear && c.guards.length > 0) {
        this.escortAI.updateGuards(c, dt)
      }
    }
  }

  updateTraveling(c, dt, isNear) {
    const targetWp = c.waypoints[c.currentWaypointIdx]
    if (!targetWp) {
      // Arrived at destination
      c.state = CARAVAN_STATES.ARRIVED
      c.stateTimer = 0
      return
    }

    const dx = targetWp.x - c.position.x
    const dz = targetWp.z - c.position.z
    const dist = Math.hypot(dx, dz)

    if (dist < 2.8) {
      c.currentWaypointIdx++
      c.stuckTimer = 0
      return
    }

    // Anti-stuck watchdog: if cart fails to advance to next waypoint within 5.5s, skip to next
    c.stuckTimer = (c.stuckTimer || 0) + dt
    if (c.stuckTimer > 5.5) {
      c.currentWaypointIdx++
      c.stuckTimer = 0
      return
    }

    // Advance along route steadily
    const speed = Math.max(3.8, c.speed || 4.8)
    const step = Math.min(dist, speed * dt)
    c.position.x += (dx / dist) * step
    c.position.z += (dz / dist) * step
    c.heading = Math.atan2(dx, dz)

    if (isNear && c.meshGroup) {
      c.meshGroup.position.copy(c.position)
      c.meshGroup.rotation.y = c.heading

      // Spin wheels
      for (const w of c.wheels) {
        w.rotation.x += step * 1.8
      }
    }

    // Check wandering monsters or player threats
    this.checkCaravanAmbush(c, isNear)
  }

  updateUnderAttack(c, dt, isNear) {
    c.stateTimer += dt

    // Check if guards survived or if all dead
    const aliveGuards = c.guards.filter(g => !g.dead).length

    if (aliveGuards === 0 && c.hp > 0) {
      // Escort neutralized! Caravan can now be looted
      c.state = CARAVAN_STATES.ROBBED
      c.lootAvailable = true
      this.game.toast?.(`💰 A escolta da ${c.name} foi derrotada! A carga está desprotegida!`)
      return
    }

    if (c.hp <= 0) {
      c.state = CARAVAN_STATES.ROBBED
      c.lootAvailable = true
      return
    }

    // Check if threats are still actively nearby
    let threatsNearby = false
    if (c.attackedByPlayer && this.game.player) {
      if (c.position.distanceTo(this.game.player.position) < 18) threatsNearby = true
    }
    if (!threatsNearby && this.game.enemies) {
      for (const mob of this.game.enemies) {
        if (!mob.dead && mob.g?.visible && (mob.hp === undefined || mob.hp > 0)) {
          if (c.position.distanceTo(mob.g.position) < 14) {
            threatsNearby = true
            break
          }
        }
      }
    }

    // Return to traveling after threats clear or safety timeout
    if (!threatsNearby && c.stateTimer > 4) {
      c.state = CARAVAN_STATES.TRAVELING
      c.stateTimer = 0
      c.attackedByPlayer = false
      for (const g of c.guards) g.target = null
      this.game.state.wantedLevel = Math.max(0, (this.game.state.wantedLevel || 0) - 1)
    } else if (c.stateTimer > 15) {
      c.state = CARAVAN_STATES.TRAVELING
      c.stateTimer = 0
      c.attackedByPlayer = false
      for (const g of c.guards) g.target = null
    }
  }

  updateBrokenDown(c, dt) {
    c.stateTimer -= dt
    if (c.stateTimer <= 0) {
      c.state = CARAVAN_STATES.TRAVELING
    }
  }

  updateCityCycle(c, dt) {
    c.stateTimer += dt

    if (c.state === CARAVAN_STATES.ARRIVED && c.stateTimer > 6) {
      c.state = CARAVAN_STATES.UNLOADING
      c.stateTimer = 0
    } else if (c.state === CARAVAN_STATES.UNLOADING && c.stateTimer > 12) {
      c.state = CARAVAN_STATES.RESTOCKING
      c.stateTimer = 0
    } else if (c.state === CARAVAN_STATES.RESTOCKING && c.stateTimer > CARAVAN_SETTINGS.restTimeSeconds) {
      // Start next journey: origin is now current city, pick next destination
      const newOrigin = c.destinationCityId
      if (this.caravans.some(other => other !== c && other.originCityId === newOrigin && other.state === CARAVAN_STATES.TRAVELING)) return
      const newDest = this.roadGraph.getRandomDestination(newOrigin)
      const newPath = this.roadGraph.findCityPath(newOrigin, newDest)
      const newWaypoints = this.roadGraph.buildWaypointsForRoute(newPath)

      c.originCityId = newOrigin
      c.destinationCityId = newDest
      const originCity = CITIES.find(ci => ci.id === newOrigin)
      const destCity = CITIES.find(ci => ci.id === newDest)
      c.originCityName = originCity ? originCity.name : 'Asterra'
      c.destCityName = destCity ? destCity.name : 'Asterra'
      c.routeKey = this.roadGraph.getRouteKey(newOrigin, newDest)
      const raids = this.routeRaidStats.get(c.routeKey) || 0
      c.security = raids >= 3 ? ROUTE_SECURITY.CRITICAL : raids >= 1 ? ROUTE_SECURITY.DANGEROUS : ROUTE_SECURITY.SAFE
      c.waypoints = newWaypoints
      c.currentWaypointIdx = 0
      c.hp = c.maxHp
      c.state = CARAVAN_STATES.TRAVELING
      c.stateTimer = 0
      c.lootAvailable = false
      c.attackedByPlayer = false

      // Refresh cargo and respawn fallen guards
      const specialty = CITY_CARGO_SPECIALTIES[newOrigin] || CITY_CARGO_SPECIALTIES['aurora-city']
      c.cargo = specialty.goods.map(g => ({
        ...g,
        qty: Math.round(g.qtyRange[0] + Math.random() * (g.qtyRange[1] - g.qtyRange[0]))
      }))
      c.cargoGold = Math.round(specialty.goldRange[0] + Math.random() * (specialty.goldRange[1] - specialty.goldRange[0]))

      for (const g of c.guards) {
        g.dead = false
        g.hp = g.maxHp
        if (g.mesh) g.mesh.visible = true
      }

      this.updateCaravanHPBar(c)
    }
  }

  updateRetreating(c, dt, isNear) {
    c.stateTimer += dt
    // Survivors march back to origin city or dissipate after 25s
    if (c.stateTimer > 35) {
      c.state = CARAVAN_STATES.DESTROYED
    }
  }

  checkCaravanAmbush(c, isNear) {
    if (!this.game.enemies) return

    for (const mob of this.game.enemies) {
      if (mob.dead || !mob.g?.visible || (mob.hp !== undefined && mob.hp <= 0)) continue
      const d = c.position.distanceTo(mob.g.position)
      if (d < 9.5) {
        c.state = CARAVAN_STATES.UNDER_ATTACK
        c.stateTimer = 0
        if (isNear) {
          this.game.toast?.(`⚠️ A ${c.name} está sendo atacada por feras na estrada!`)
        }
        break
      }
    }
  }

  onPlayerAttackCaravan(caravan, damage = 40) {
    if (!caravan) return

    if (!caravan.attackedByPlayer) {
      caravan.attackedByPlayer = true
      caravan.state = CARAVAN_STATES.UNDER_ATTACK
      caravan.stateTimer = 0

      // Route raid count increases (escalating route danger!)
      const currentRaids = this.routeRaidStats.get(caravan.routeKey) || 0
      this.routeRaidStats.set(caravan.routeKey, currentRaids + 1)

      // Crime alert toast
      this.game.toast?.(`🚨 CRIME! Você atacou a ${caravan.name}! Os guardas retaliarão!`)
      this.game.state.wantedLevel = Math.min(5, (this.game.state.wantedLevel || 0) + 1)
      this.game.haptic?.(50)
    }

    caravan.hp = Math.max(0, caravan.hp - damage)
    this.updateCaravanHPBar(caravan)

    if (caravan.hp <= 0 && !caravan.lootAvailable) {
      caravan.state = CARAVAN_STATES.ROBBED
      caravan.lootAvailable = true
      this.game.toast?.(`💥 A carroça da ${caravan.name} quebrou! Saqueie a carga com [E]!`)
    }
  }

  getCaravanDistance(c, playerPos) {
    if (!c || !playerPos) return 999
    const h = c.heading || 0
    const fx = Math.sin(h), fz = Math.cos(h)
    const ax = c.position.x - fx * 2.4, az = c.position.z - fz * 2.4
    const bx = c.position.x + fx * 3.6, bz = c.position.z + fz * 3.6
    const abx = bx - ax, abz = bz - az
    const lenSq = abx * abx + abz * abz || 1
    const t = Math.max(0, Math.min(1, ((playerPos.x - ax) * abx + (playerPos.z - az) * abz) / lenSq))
    const cx = ax + abx * t, cz = az + abz * t
    return Math.hypot(playerPos.x - cx, playerPos.z - cz)
  }

  getInteractionPrompt() {
    const playerPos = this.game.player ? this.game.player.position : new THREE.Vector3()

    for (const c of this.caravans) {
      const d = this.getCaravanDistance(c, playerPos)
      if (d < 5.8) {
        const canLoot = c.lootAvailable || c.hp <= 0 || c.guards.every(g => g.dead)
        if (canLoot) {
          c.lootAvailable = true
          return {
            prompt: `E — Saquear Carga da ${c.name}`,
            action: { type: 'caravan_loot', label: 'Saquear Caravana', icon: '💰', caravan: c }
          }
        }
        if (c.state === CARAVAN_STATES.UNDER_ATTACK) {
          return {
            prompt: `⚔ ${c.attackedByPlayer ? 'Destrua a carroça da' : 'Defenda ou Ataque a'} ${c.name}!`,
            action: { type: 'caravan_attack', label: 'Atacar / Inspecionar', icon: '⚔️', caravan: c }
          }
        }
        return {
          prompt: `E — Inspecionar Carga da ${c.name} [→ ${c.destCityName}]`,
          action: { type: 'caravan_info', label: c.name, icon: '🚚', caravan: c }
        }
      }
    }
    return null
  }

  onInteract() {
    const playerPos = this.game.player ? this.game.player.position : new THREE.Vector3()

    for (const c of this.caravans) {
      const d = this.getCaravanDistance(c, playerPos)
      if (d < 5.8) {
        const canLoot = c.lootAvailable || c.hp <= 0 || c.guards.every(g => g.dead)
        if (canLoot) {
          c.lootAvailable = true
          this.lootCaravan(c)
          return true
        }
        // Open inspection modal
        this.openCaravanInfoModal(c)
        return true
      }
    }
    return false
  }

  lootCaravan(caravan) {
    if (!caravan) return

    caravan.lootAvailable = false
    const goldGained = caravan.cargoGold || 450
    this.game.state.gold = (this.game.state.gold || 0) + goldGained

    let itemsGained = 0
    for (const item of caravan.cargo) {
      if (this.game.addInventoryItem?.({
        id: `cargo_${Date.now()}_${Math.random()}`,
        name: item.name,
        type: item.type === 'potion' ? 'consumable' : item.type,
        subtype: item.type === 'potion' ? 'potion' : 'material',
        value: item.value,
        qty: item.qty || 5,
        rarity: 'Comum'
      })) {
        itemsGained++
      }
    }

    this.game.toast?.(`💰 Carga saqueada: +${goldGained}◈ Ouro e ${itemsGained} tipos de mercadorias!`)
    this.game.spawnAbilityRing?.(0xf59e0b, 3.5, 0.8)
    caravan.state = CARAVAN_STATES.RETREATING
    caravan.stateTimer = 0
  }

  openCaravanInfoModal(caravan) {
    if (!this.game.state) return
    const canLoot = caravan.lootAvailable || caravan.hp <= 0 || caravan.guards.every(g => g.dead)
    if (canLoot) caravan.lootAvailable = true

    this.game.state.caravanModal = {
      caravanId: caravan.id,
      title: caravan.name,
      type: canLoot ? 'loot' : 'info',
      text: canLoot
        ? `💥 A carroça quebrou e a carga está vulnerável! Saqueie ${caravan.cargo.length} tipos de mercadorias e ${caravan.cargoGold}◈ ouro.`
        : `${caravan.originCityName} → ${caravan.destCityName} • ${caravan.guards.filter(g => !g.dead).length}/${caravan.guards.length} guardas ativos. Ataque a carroça com sua arma ou use o botão abaixo para iniciar o saque!`,
      goods: caravan.cargo.map(item => ({name:item.name,qty:item.qty||1})),
      origin: caravan.originCityName,
      destination: caravan.destCityName,
      category: caravan.category.name,
      security: caravan.security.label,
      guardsAlive: caravan.guards.filter(g => !g.dead).length,
      totalGuards: caravan.guards.length,
      hp: caravan.hp,
      maxHp: caravan.maxHp,
      cargoCount: caravan.cargo.reduce((acc, it) => acc + (it.qty || 1), 0),
      cargoGold: caravan.cargoGold
    }
    this.game.suspendCombatForUI?.()
  }

  closeCaravanModal() {
    if (this.game.state) {
      this.game.state.caravanModal = null
    }
  }

  lootCaravanById(id) {
    const caravan=this.caravans.find(c=>c.id===id)
    if (!caravan || !caravan.lootAvailable) return false
    this.lootCaravan(caravan)
    this.closeCaravanModal()
    return true
  }

  onMonsterKilledNearCaravan(monster) {
    // Reward player if they help defend a caravan under attack
    const playerPos = this.game.player ? this.game.player.position : new THREE.Vector3()
    for (const c of this.caravans) {
      if (c.state === CARAVAN_STATES.UNDER_ATTACK && c.position.distanceTo(playerPos) < 28) {
        this.game.gainXp?.(CARAVAN_SETTINGS.defenseRewardXP)
        this.game.state.gold = (this.game.state.gold || 0) + CARAVAN_SETTINGS.defenseRewardGold
        this.game.toast?.(`🛡 DEFESA DE CARAVANA: Inimigo eliminado! +${CARAVAN_SETTINGS.defenseRewardXP} XP e +${CARAVAN_SETTINGS.defenseRewardGold}◈ Ouro!`)
        break
      }
    }
  }

  cleanupCaravan(c, index) {
    if (c.meshGroup) {
      this.game.worldRoot.remove(c.meshGroup)
    }
    for (const g of c.guards) {
      if (g.mesh) this.game.worldRoot.remove(g.mesh)
    }
    this.caravans.splice(index, 1)

    // Respawn new caravan from origin city after delay
    setTimeout(() => {
      this.createCaravan({ originId: c.originCityId, destinationId: this.roadGraph.getRandomDestination(c.originCityId) })
    }, 25000)
  }

  getMapCaravans() {
    return this.caravans.map(c => ({
      id: c.id,
      name: c.name,
      x: c.position.x,
      z: c.position.z,
      origin: c.originCityName,
      destination: c.destCityName,
      state: c.state,
      category: c.category.name,
      icon: c.category.icon,
      color: c.category.color,
      security: c.security.label,
      guardsAlive: c.guards.filter(g => !g.dead).length,
      totalGuards: c.guards.length
    }))
  }

  getAttackableTargets() {
    const targets = []
    for (const c of this.caravans) {
      if (c.maxHp > 600) { c.maxHp = 480; c.hp = Math.min(c.hp, 480) }
      if (c.meshGroup && c.meshGroup.visible && c.hp > 0) {
        targets.push({
          g: c.meshGroup,
          hp: c.hp,
          maxHp: c.maxHp,
          name: c.name,
          level: 25,
          boss: false,
          isCaravanCart: true,
          caravan: c
        })
      }
      for (const g of c.guards) {
        if (g.mesh && g.mesh.visible && !g.dead) {
          targets.push({
            g: g.mesh,
            hp: g.hp,
            maxHp: g.maxHp,
            name: `${g.name} [Guarda]`,
            level: g.level,
            boss: g.isElite,
            isCaravanGuard: true,
            guard: g,
            caravan: c
          })
        }
      }
    }
    return targets
  }

  flashCaravanMesh(caravan, crit = false) {
    if (!caravan.meshGroup) return
    caravan.meshGroup.traverse(child => {
      if (child.isMesh && child.material && !child.material.map) {
        if (!child.userData.origColor) child.userData.origColor = child.material.color.clone()
        child.material.color.setHex(crit ? 0xffea79 : 0xff4444)
        setTimeout(() => {
          if (child.material && child.userData.origColor) {
            child.material.color.copy(child.userData.origColor)
          }
        }, 120)
      }
    })
  }

  onDamageCaravanEntity(e, amount, { crit = false, knockback = 0.35 } = {}) {
    const dealt = Math.max(1, Math.round(amount))
    this.game.enterCombat?.(8)

    if (e.isCaravanCart) {
      const caravan = e.caravan
      this.onPlayerAttackCaravan(caravan, dealt)
      e.hp = caravan.hp
      this.flashCaravanMesh(caravan, crit)
      const p = caravan.position.clone(); p.y += 2.2
      this.game.spawnDamageText?.(p, dealt, crit, '#fbbf24')
      this.game.spawnAbilityRing?.(0xf59e0b, 1.8, 0.3)
      this.game.haptic?.(crit ? 35 : 18)
      this.game.state.target = {
        name: caravan.name,
        level: 25,
        hp: Math.max(0, caravan.hp),
        maxHp: caravan.maxHp,
        boss: false,
        crit
      }
      return dealt
    }

    if (e.isCaravanGuard) {
      const guard = e.guard
      const caravan = e.caravan
      if (!guard || guard.dead) return 0

      if (!caravan.attackedByPlayer) {
        caravan.attackedByPlayer = true
        caravan.state = CARAVAN_STATES.UNDER_ATTACK
        caravan.stateTimer = 0
        const currentRaids = this.routeRaidStats.get(caravan.routeKey) || 0
        this.routeRaidStats.set(caravan.routeKey, currentRaids + 1)
        this.game.state.wantedLevel = Math.min(5, (this.game.state.wantedLevel || 0) + 1)
        this.game.toast?.(`🚨 PROCURADO ${this.game.state.wantedLevel}/5: você atacou a escolta de ${caravan.name}!`)
        this.game.haptic?.(40)
      }

      guard.hp -= dealt
      e.hp = guard.hp
      guard.target = this.game.player
      this.game.spawnDamageText?.(guard.mesh.position, dealt, crit)
      this.escortAI.updateGuardNameplate(guard)

      this.game.state.target = {
        name: `${guard.name} [Guarda]`,
        level: guard.level,
        hp: Math.max(0, guard.hp),
        maxHp: guard.maxHp,
        boss: guard.isElite,
        crit
      }

      if (knockback && guard.mesh && this.game.player) {
        guard.mesh.position.addScaledVector(
          guard.mesh.position.clone().sub(this.game.player.position).normalize(),
          knockback
        )
      }

      if (guard.hp <= 0) {
        guard.dead = true
        if (guard.mesh) guard.mesh.visible = false
        const xp = Math.round(25 + guard.level * 6)
        this.game.awardCombatXp?.(xp)
        this.game.state.gold = (this.game.state.gold || 0) + Math.round(15 + guard.level * 1.5)
        this.game.toast?.(`⚔️ Guarda derrotado! +${xp} XP`)

        // If all guards dead, caravan can now be looted
        const aliveGuards = caravan.guards.filter(g => !g.dead).length
        if (aliveGuards === 0) {
          caravan.state = CARAVAN_STATES.ROBBED
          caravan.lootAvailable = true
          this.game.toast?.(`💰 A escolta da ${caravan.name} foi derrotada! Pressione [E] para saquear a carga!`)
          this.game.spawnAbilityRing?.(0x22c55e, 3.8, 0.6)
        }
      }
      return dealt
    }
    return 0
  }
}
