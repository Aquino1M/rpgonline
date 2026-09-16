// World / travel polish V2.
// Normalizes city service positions, rebuilds external roads so they enter through gates,
// keeps fast-travel companions with the player, and shows a persistent tame-success banner.

import * as THREE from 'three'
import { CITIES, NPC_DEFS, ROADS, WORLD_MAP } from './config.js'
import { TRAVEL_NODES } from './fastTravel.js'

const ROLE_LAYOUT = {
  quest:      { x: -9.5, z:  7.5 },
  guild:      { x: -11.5,z:  0.0 },
  townhall:   { x:  9.5, z:  7.5 },
  merchant:   { x: -8.0, z: -7.5 },
  blacksmith: { x:  8.0, z: -7.5 },
  stable:     { x:  0.0, z:-11.0 },
  traveler:   { x:  0.0, z: 11.0 },
  pets:       { x: 11.5, z:  0.0 },
}

const FALLBACK_SLOTS = [
  {x:-7,z:10},{x:7,z:10},{x:-11,z:4},{x:11,z:4},
  {x:-11,z:-4},{x:11,z:-4},{x:-7,z:-10},{x:7,z:-10},
]

const ROAD_COLORS = {
  meadow: 0x9c8b69,
  forest: 0x756b56,
  coast: 0xb3a476,
  stone: 0x8b8b82,
  ember: 0x78513f,
  void: 0x50485d,
  crown: 0xaab4ba,
}

const ROAD_LINKS_V2 = [
  ['veyra-city','rubro-city'],
  ['noctis-city','celeste-city'],
]

function serviceSlot(service, index = 0) {
  return ROLE_LAYOUT[service?.role] || FALLBACK_SLOTS[index % FALLBACK_SLOTS.length]
}

function outwardStallPosition(city, local) {
  const length = Math.hypot(local.x, local.z) || 1
  const amount = 2.25
  return {
    x: city.x + local.x + local.x / length * amount,
    z: city.z + local.z + local.z / length * amount,
  }
}

function normalizeCityServices() {
  const npcById = new Map((NPC_DEFS || []).map(def => [def.id, def]))
  const mapCityById = new Map((WORLD_MAP?.cities || []).map(city => [city.id, city]))

  for (const city of CITIES || []) {
    const usedByRole = new Map()
    for (let i = 0; i < (city.services || []).length; i++) {
      const service = city.services[i]
      const base = serviceSlot(service, i)
      const sameRoleIndex = usedByRole.get(service.role) || 0
      usedByRole.set(service.role, sameRoleIndex + 1)
      const nudge = sameRoleIndex ? sameRoleIndex * 2.2 : 0
      const local = { x: base.x + nudge, z: base.z }
      const stall = outwardStallPosition(city, local)

      service.x = city.x + local.x
      service.z = city.z + local.z
      service.localX = local.x
      service.localZ = local.z
      service.stallX = stall.x
      service.stallZ = stall.z

      const npc = npcById.get(service.id)
      if (npc) {
        npc.x = service.x
        npc.z = service.z
        npc.localX = local.x
        npc.localZ = local.z
        npc.stallX = stall.x
        npc.stallZ = stall.z
      }

      const mapCity = mapCityById.get(city.id)
      const mapService = mapCity?.services?.find?.(entry => entry.id === service.id)
      if (mapService) {
        mapService.x = service.x
        mapService.z = service.z
      }
    }
  }

  // Keep travel arrivals on the main street, close to the traveler but never on top of an NPC/well.
  for (const node of TRAVEL_NODES || []) {
    const city = (CITIES || []).find(entry => entry.zoneId === node.zone)
    if (!city) continue
    node.x = city.x
    node.z = city.z + 6.8
    node.cityId = city.id
    node.name = city.name
  }

  // Complete the overland network so late-game settlements are not dead ends.
  for (const [a,b] of ROAD_LINKS_V2) {
    if (!(CITIES || []).some(city => city.id === a) || !(CITIES || []).some(city => city.id === b)) continue
    if ((ROADS || []).some(road => (road.a === a && road.b === b) || (road.a === b && road.b === a))) continue
    ROADS.push({ a, b, v2: true })
  }
}

// Apply before ShadowGame is constructed. runtimePatches.js is imported before new ShadowGame().
normalizeCityServices()

function roadMaterial(color, yOffset = 0) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 1,
    metalness: 0,
    polygonOffset: !!yOffset,
    polygonOffsetFactor: yOffset ? -1 : 0,
    polygonOffsetUnits: yOffset ? -1 : 0,
  })
}

function cardinalGate(city, toward, extra = 0) {
  const dx = toward.x - city.x
  const dz = toward.z - city.z
  const r = Number(city.wallRadius) || Number(city.radius) || 30
  if (Math.abs(dx) >= Math.abs(dz)) {
    const sign = dx >= 0 ? 1 : -1
    return new THREE.Vector3(city.x + sign * (r + extra), 0, city.z)
  }
  const sign = dz >= 0 ? 1 : -1
  return new THREE.Vector3(city.x, 0, city.z + sign * (r + extra))
}

function routePoints(a, b) {
  const gateA = cardinalGate(a, b, 0.2)
  const gateB = cardinalGate(b, a, 0.2)
  const outsideA = cardinalGate(a, b, 8.5)
  const outsideB = cardinalGate(b, a, 8.5)
  const dx = outsideB.x - outsideA.x
  const dz = outsideB.z - outsideA.z
  const d = Math.hypot(dx, dz) || 1
  const perpX = -dz / d
  const perpZ = dx / d
  let hash = 0
  const key = `${a.id}:${b.id}`
  for (let i = 0; i < key.length; i++) hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0
  const bend = Math.min(18, Math.max(5, d * 0.025)) * ((Math.abs(hash) % 2) ? 1 : -1)
  const mid = new THREE.Vector3(
    (outsideA.x + outsideB.x) * 0.5 + perpX * bend,
    0,
    (outsideA.z + outsideB.z) * 0.5 + perpZ * bend,
  )
  return [gateA, outsideA, mid, outsideB, gateB]
}

function segmentDistance2D(x, z, a, b) {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const l2 = dx * dx + dz * dz
  if (!l2) return Math.hypot(x - a.x, z - a.z)
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2))
  return Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t))
}

function addRoadSegment(group, a, b, color) {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const len = Math.hypot(dx, dz)
  if (len < 0.5) return 0
  const angle = Math.atan2(dx, dz)
  const mx = (a.x + b.x) * 0.5
  const mz = (a.z + b.z) * 0.5

  const base = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.065, len + 0.35), roadMaterial(color))
  base.position.set(mx, 0.035, mz)
  base.rotation.y = angle
  base.receiveShadow = true
  base.castShadow = false
  group.add(base)

  const trackColor = new THREE.Color(color).lerp(new THREE.Color(0xd8c9a3), 0.20)
  const track = new THREE.Mesh(new THREE.BoxGeometry(3.55, 0.025, len + 0.38), roadMaterial(trackColor.getHex(), 1))
  track.position.set(mx, 0.078, mz)
  track.rotation.y = angle
  track.receiveShadow = true
  track.castShadow = false
  group.add(track)
  return len
}

function addWayposts(group, points, color) {
  const postMat = new THREE.MeshStandardMaterial({ color: 0x544236, roughness: 0.95 })
  const glowMat = new THREE.MeshBasicMaterial({ color })
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i]
    const post = new THREE.Group()
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.1, 6), postMat)
    pole.position.y = 1.05
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 7), glowMat)
    lamp.position.y = 2.08
    post.add(pole, lamp)
    post.position.set(p.x + 3.5, 0, p.z + 3.5)
    group.add(post)
  }
}

function rebuildRoads(game) {
  if (!game?.worldRoot) return
  for (const road of game.roadMeshes || []) {
    road?.mesh?.parent?.remove?.(road.mesh)
    road?.mesh?.traverse?.(object => {
      object.geometry?.dispose?.()
      if (Array.isArray(object.material)) object.material.forEach(material => material?.dispose?.())
      else object.material?.dispose?.()
    })
  }

  const byId = new Map((CITIES || []).map(city => [city.id, city]))
  const polylines = []
  const roadMeshes = []
  for (const road of ROADS || []) {
    const a = byId.get(road.a)
    const b = byId.get(road.b)
    if (!a || !b) continue
    const points = routePoints(a, b)
    const group = new THREE.Group()
    group.name = `RoadV2:${a.id}:${b.id}`
    group.userData.worldRoadV2 = true
    const baseColor = ROAD_COLORS[a.style] || 0x918064
    let len = 0
    for (let i = 0; i < points.length - 1; i++) len += addRoadSegment(group, points[i], points[i + 1], baseColor)
    addWayposts(group, points, new THREE.Color(a.accent || '#f8d081').getHex())
    const midX = points.reduce((sum, p) => sum + p.x, 0) / points.length
    const midZ = points.reduce((sum, p) => sum + p.z, 0) / points.length
    group.visible = false
    game.worldRoot.add(group)
    roadMeshes.push({ mesh: group, a, b, midX, midZ, len, points })
    polylines.push(points)
  }
  game.roadMeshes = roadMeshes
  game.__worldRoadPolylines = polylines

  game.isOnRoad = (x, z, pad = 3.5) => {
    const threshold = 3.0 + Math.max(0, Number(pad) || 0)
    for (const points of game.__worldRoadPolylines || []) {
      for (let i = 0; i < points.length - 1; i++) {
        if (segmentDistance2D(x, z, points[i], points[i + 1]) <= threshold) return true
      }
    }
    for (const city of CITIES || []) {
      const d = Math.hypot(x - city.x, z - city.z)
      if (d <= city.radius + pad * 2) {
        if (Math.abs(x - city.x) <= 3.6 + pad || Math.abs(z - city.z) <= 3.6 + pad) return true
      }
    }
    return false
  }
}

function roleColor(role) {
  return role === 'guild' ? 0xeab308
    : role === 'merchant' ? 0x72f0ad
    : role === 'blacksmith' ? 0xff855e
    : role === 'traveler' ? 0x38bdf8
    : role === 'townhall' ? 0x60a5fa
    : role === 'pets' ? 0xf59e0b
    : role === 'stable' ? 0xa3e635
    : 0x7dd3fc
}

function addServiceWalkway(group, service, city) {
  const lx = service.x - city.x
  const lz = service.z - city.z
  const len = Math.max(2, Math.hypot(lx, lz) - 3.8)
  const angle = Math.atan2(lx, lz)
  const road = new THREE.Mesh(
    new THREE.BoxGeometry(2.25, 0.045, len),
    new THREE.MeshStandardMaterial({ color: ROAD_COLORS[city.style] || 0x918064, roughness: 1 }),
  )
  const factor = ((len * 0.5) + 2.2) / Math.max(1, Math.hypot(lx, lz))
  road.position.set(lx * factor, 0.085, lz * factor)
  road.rotation.y = angle
  road.receiveShadow = true
  road.userData.cityServiceWalkway = service.id
  group.add(road)

  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(1.8, 2.0, 0.055, 18),
    new THREE.MeshStandardMaterial({ color: roleColor(service.role), roughness: 0.95, transparent: true, opacity: 0.58 }),
  )
  pad.position.set(lx, 0.095, lz)
  pad.userData.cityServicePad = service.id
  group.add(pad)
}

function polishCitiesAndNpcs(game) {
  const npcById = new Map((game.npcs || []).map(npc => [npc?.def?.id, npc]))
  for (const entry of game.cityGroups || []) {
    const city = entry.city
    const group = entry.group
    if (!city || !group) continue

    const oldLayer = group.children.find(child => child?.userData?.worldLayoutV2Layer)
    if (oldLayer) group.remove(oldLayer)
    const layer = new THREE.Group()
    layer.userData.worldLayoutV2Layer = true
    group.add(layer)

    const stalls = [...group.children].filter(child => child?.userData?.service)
    const used = new Set()
    for (const service of city.services || []) {
      const npc = npcById.get(service.id)
      if (npc?.g) {
        npc.g.position.set(service.x, 0, service.z)
        if (npc.def) { npc.def.x = service.x; npc.def.z = service.z }
      }

      const stall = stalls.find(candidate => candidate.userData.service === service.role && !used.has(candidate))
      if (stall) {
        used.add(stall)
        const sx = Number(service.stallX) || service.x
        const sz = Number(service.stallZ) || service.z
        stall.position.set(sx - city.x, 0, sz - city.z)
        const dx = city.x - sx
        const dz = city.z - sz
        if (Math.hypot(dx, dz) > 0.01) stall.rotation.y = Math.atan2(dx, dz)
      }
      addServiceWalkway(layer, service, city)
    }
  }
}

function movePetBesidePlayer(game) {
  const pet = game?.activePet?.()
  if (!pet || Number(pet.recoverUntil) > Date.now()) return false
  game.petTarget = null
  game.syncPetVisual?.()
  const visual = game.petVisual
  if (!visual || !game.player?.position) return false
  const heading = Number(game.player.rotation?.y) || 0
  const sideX = Math.cos(heading) * 1.35
  const sideZ = -Math.sin(heading) * 1.35
  const backX = -Math.sin(heading) * 1.1
  const backZ = -Math.cos(heading) * 1.1
  visual.position.set(game.player.position.x + sideX + backX, 0.55, game.player.position.z + sideZ + backZ)
  game.syncPetVisual?.()
  return true
}

function showTameBanner(game, pet) {
  if (typeof document === 'undefined' || !pet) return
  document.querySelector('.pet-tamed-world-banner')?.remove?.()
  const banner = document.createElement('div')
  banner.className = 'pet-tamed-world-banner'
  banner.setAttribute('role', 'status')
  banner.style.cssText = [
    'position:fixed','left:50%','top:max(74px, env(safe-area-inset-top))','transform:translateX(-50%)',
    'z-index:99999','min-width:min(520px,calc(100vw - 28px))','max-width:720px','padding:14px 18px',
    'border:2px solid #f59e0b','border-radius:16px','background:rgba(4,12,22,.96)','color:#fff',
    'box-shadow:0 12px 38px rgba(0,0,0,.48),0 0 24px rgba(245,158,11,.32)',
    'font-family:Inter,Arial,sans-serif','text-align:center','pointer-events:none','transition:opacity .35s ease',
  ].join(';')
  const hp = Math.max(1, Math.round(Number(pet.hp) || Number(pet.maxHp) || 1))
  const maxHp = Math.max(hp, Math.round(Number(pet.maxHp) || hp))
  banner.innerHTML = `<div style="font-size:12px;font-weight:900;letter-spacing:.12em;color:#fbbf24">🐾 DOMAÇÃO CONCLUÍDA!</div><div style="font-size:18px;font-weight:900;margin-top:4px">${String(pet.name || 'Novo companheiro')}</div><div style="font-size:11px;color:#cbd5e1;margin-top:4px">Nv.${Math.max(1,Number(pet.level)||1)} • HP ${hp}/${maxHp} • Agora equipado e lutando ao seu lado.</div>`
  document.body.appendChild(banner)
  window.setTimeout(() => { banner.style.opacity = '0' }, 4300)
  window.setTimeout(() => banner.remove(), 4750)
  game.toast?.(`🐾 ${pet.name} foi domado e agora é seu companheiro!`)
}

function installTravelAndTamingFixes(game) {
  if (!game || game.__worldTravelPolishV2Installed) return false
  game.__worldTravelPolishV2Installed = true

  polishCitiesAndNpcs(game)
  rebuildRoads(game)

  const oldFastTravel = game.fastTravelTo?.bind(game)
  if (oldFastTravel) {
    game.fastTravelTo = nodeId => {
      const before = game.player?.position?.clone?.()
      const result = oldFastTravel(nodeId)
      if (before && game.player?.position && before.distanceTo(game.player.position) > 5) {
        movePetBesidePlayer(game)
        game.saveGame?.()
      }
      return result
    }
  }

  const oldTryTame = game.tryTamePet?.bind(game)
  if (oldTryTame) {
    game.tryTamePet = enemy => {
      const beforeIds = new Set((game.state?.pets?.owned || []).map(pet => pet.id))
      const result = oldTryTame(enemy)
      if (result) {
        const pet = (game.state?.pets?.owned || []).find(candidate => !beforeIds.has(candidate.id)) || game.activePet?.()
        if (pet) {
          movePetBesidePlayer(game)
          window.setTimeout(() => showTameBanner(game, pet), 40)
          game.saveCloudGame?.()
        }
      }
      return result
    }
  }

  // One final pass after visual packs finish attaching their city decoration.
  if (typeof window !== 'undefined') {
    window.setTimeout(() => polishCitiesAndNpcs(game), 1200)
    window.setTimeout(() => movePetBesidePlayer(game), 200)
  }
  return true
}

function installWhenReady() {
  if (typeof window === 'undefined') return
  const tryInstall = () => {
    if (!window.game) return false
    installTravelAndTamingFixes(window.game)
    return true
  }
  if (tryInstall()) return
  const timer = window.setInterval(() => {
    if (!tryInstall()) return
    window.clearInterval(timer)
  }, 100)
  window.setTimeout(() => window.clearInterval(timer), 60000)
}

installWhenReady()
