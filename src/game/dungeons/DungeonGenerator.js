// DungeonGenerator.js - procedural dungeon layouts + optimized coliseum arena
import * as THREE from 'three'
import { DUNGEON_THEMES } from './DungeonConfig.js'

function prng(seed) {
  let s = Math.abs(Math.floor(seed)) || 1234567
  return function () {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

export class DungeonGenerator {
  constructor() {}

  generateFloor({ seed = 12345, floor = 1, totalFloors = 3, rank = 'C', themeKey = 'cavern' }) {
    const theme = DUNGEON_THEMES[themeKey] || DUNGEON_THEMES.cavern

    // GateManager runs the modern dungeon loop as a single arena with several rounds.
    // Keep the old procedural layout available for any legacy/multi-floor caller.
    if (totalFloors === 1) {
      return this.generateColiseumArena({ seed, floor, totalFloors, rank, theme })
    }

    return this.generateProceduralFloor({ seed, floor, totalFloors, rank, theme })
  }

  generateColiseumArena({ seed, floor, totalFloors, rank, theme }) {
    const rand = prng(seed + 739)
    const radiusX = 38
    const radiusZ = 31
    const spawnRadiusX = 31.5
    const spawnRadiusZ = 24.5
    const spawnPos = { x: 0, y: 0, z: 0 }

    // The spawn room is logical only: the actual arena center stays completely clear.
    const rooms = [{
      id: 'spawn',
      type: 'spawn',
      x: 0,
      z: 0,
      w: 14,
      d: 14,
      explored: true
    }]

    // Eight edge spawn sectors make every wave enter from the perimeter instead of
    // materializing near the player. GateManager already distributes round mobs
    // through all non-spawn rooms, so this plugs directly into the existing runtime.
    const sectors = 8
    for (let i = 0; i < sectors; i++) {
      const angle = -Math.PI / 2 + (i / sectors) * Math.PI * 2
      rooms.push({
        id: `arena_gate_${i}`,
        type: 'combat',
        x: Math.cos(angle) * spawnRadiusX,
        z: Math.sin(angle) * spawnRadiusZ,
        w: 8,
        d: 8,
        explored: true,
        arenaEdge: true,
        gateIndex: i
      })
    }

    // Boss has a dedicated grand gate on the opposite/north side.
    const bossRoom = {
      id: 'boss',
      type: 'boss',
      x: 0,
      z: -spawnRadiusZ - 1.5,
      w: 10,
      d: 10,
      explored: true,
      arenaEdge: true,
      bossGate: true
    }
    rooms.push(bossRoom)

    const group = this.buildColiseumGeometry({ theme, radiusX, radiusZ, rand })

    return {
      seed,
      floor,
      totalFloors,
      isFinalFloor: true,
      isArena: true,
      theme,
      rooms,
      corridors: [],
      group,
      spawnPos,
      exitPos: bossRoom,
      arena: {
        radiusX,
        radiusZ,
        safeRadius: 10,
        mobSpawnRadiusX: spawnRadiusX,
        mobSpawnRadiusZ: spawnRadiusZ
      }
    }
  }

  buildColiseumGeometry({ theme, radiusX, radiusZ, rand }) {
    const group = new THREE.Group()
    group.name = 'GrandColiseumDungeonArena'

    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x8a6b43,
      roughness: 0.94,
      metalness: 0.02
    })
    const stoneMat = new THREE.MeshStandardMaterial({
      color: theme.wallColor,
      roughness: 0.86,
      metalness: 0.08
    })
    const darkStoneMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(theme.wallColor).multiplyScalar(0.58),
      roughness: 0.9,
      metalness: 0.04
    })
    const accentMat = new THREE.MeshStandardMaterial({
      color: theme.accentColor,
      emissive: theme.accentColor,
      emissiveIntensity: 1.7,
      roughness: 0.28,
      metalness: 0.18
    })
    const sandRingMat = new THREE.MeshStandardMaterial({
      color: 0xb6915c,
      roughness: 1,
      metalness: 0
    })

    // Arena floor: one low-poly ellipse, intentionally clear in the center.
    const floorGeo = new THREE.CylinderGeometry(1, 1, 0.38, 64, 1, false)
    const floor = new THREE.Mesh(floorGeo, floorMat)
    floor.scale.set(radiusX, 1, radiusZ)
    floor.position.y = -0.2
    floor.receiveShadow = true
    group.add(floor)

    const combatRing = new THREE.Mesh(new THREE.RingGeometry(9.5, 10, 64), sandRingMat)
    combatRing.rotation.x = -Math.PI / 2
    combatRing.position.y = 0.015
    combatRing.scale.z = radiusZ / radiusX
    combatRing.receiveShadow = true
    group.add(combatRing)

    // Perimeter walls and three seating tiers use InstancedMesh to keep draw calls low.
    const segments = 56
    const gateAngles = [0, Math.PI / 2, Math.PI, Math.PI * 1.5]
    const isNearGate = angle => gateAngles.some(g => {
      let d = Math.atan2(Math.sin(angle - g), Math.cos(angle - g))
      return Math.abs(d) < 0.12
    })

    const wallGeo = new THREE.BoxGeometry(3.7, 6.5, 1.55)
    const wallCount = Array.from({ length: segments }, (_, i) => (i / segments) * Math.PI * 2)
      .filter(a => !isNearGate(a)).length
    const wallInstances = new THREE.InstancedMesh(wallGeo, stoneMat, wallCount)
    wallInstances.name = 'ColiseumOuterWalls'
    wallInstances.castShadow = false
    wallInstances.receiveShadow = true

    const dummy = new THREE.Object3D()
    let wi = 0
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2
      if (isNearGate(angle)) continue
      const x = Math.cos(angle) * (radiusX + 1.4)
      const z = Math.sin(angle) * (radiusZ + 1.4)
      dummy.position.set(x, 3.25, z)
      dummy.rotation.set(0, -angle, 0)
      dummy.scale.set(1, 1 + (i % 5 === 0 ? 0.12 : 0), 1)
      dummy.updateMatrix()
      wallInstances.setMatrixAt(wi++, dummy.matrix)
    }
    wallInstances.instanceMatrix.needsUpdate = true
    group.add(wallInstances)

    const seatGeo = new THREE.BoxGeometry(3.5, 1.05, 2.3)
    for (let tier = 0; tier < 3; tier++) {
      const seatRadiusX = radiusX + 4.0 + tier * 2.55
      const seatRadiusZ = radiusZ + 4.0 + tier * 2.55
      const seatInstances = new THREE.InstancedMesh(seatGeo, tier === 2 ? darkStoneMat : stoneMat, segments)
      seatInstances.name = `ColiseumSeatsTier${tier + 1}`
      seatInstances.castShadow = false
      seatInstances.receiveShadow = true

      for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2
        const x = Math.cos(angle) * seatRadiusX
        const z = Math.sin(angle) * seatRadiusZ
        dummy.position.set(x, 1.0 + tier * 1.15, z)
        dummy.rotation.set(0, -angle, 0)
        dummy.scale.set(1, 1, 1)
        dummy.updateMatrix()
        seatInstances.setMatrixAt(i, dummy.matrix)
      }
      seatInstances.instanceMatrix.needsUpdate = true
      group.add(seatInstances)
    }

    // Four side tunnels / gates. Their mouths sit exactly at the mob perimeter.
    const gateData = [
      { angle: 0, label: 'east' },
      { angle: Math.PI / 2, label: 'south' },
      { angle: Math.PI, label: 'west' },
      { angle: Math.PI * 1.5, label: 'boss' }
    ]
    for (const gate of gateData) {
      const gx = Math.cos(gate.angle) * (radiusX + 0.2)
      const gz = Math.sin(gate.angle) * (radiusZ + 0.2)
      const gateGroup = new THREE.Group()
      gateGroup.name = `ArenaGate_${gate.label}`
      gateGroup.position.set(gx, 0, gz)
      gateGroup.rotation.y = -gate.angle

      const postGeo = new THREE.BoxGeometry(1.25, 6.6, 2.1)
      const postL = new THREE.Mesh(postGeo, darkStoneMat)
      const postR = new THREE.Mesh(postGeo, darkStoneMat)
      postL.position.set(-3.2, 3.3, 0)
      postR.position.set(3.2, 3.3, 0)
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(7.7, 1.2, 2.15), stoneMat)
      lintel.position.set(0, 6.05, 0)
      const portalGlow = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 4.7), new THREE.MeshBasicMaterial({
        color: theme.accentColor,
        transparent: true,
        opacity: gate.label === 'boss' ? 0.24 : 0.13,
        side: THREE.DoubleSide,
        depthWrite: false
      }))
      portalGlow.position.set(0, 3.0, 0.6)
      gateGroup.add(postL, postR, lintel, portalGlow)
      group.add(gateGroup)
    }

    // Runes/crystals provide strong visual lighting without hundreds of dynamic lights.
    const crystalGeo = new THREE.OctahedronGeometry(0.42, 0)
    const crystalCount = 16
    const crystals = new THREE.InstancedMesh(crystalGeo, accentMat, crystalCount)
    crystals.name = 'ArenaMagicLights'
    for (let i = 0; i < crystalCount; i++) {
      const angle = (i / crystalCount) * Math.PI * 2
      dummy.position.set(
        Math.cos(angle) * (radiusX - 1.8),
        4.4 + (i % 2) * 0.35,
        Math.sin(angle) * (radiusZ - 1.8)
      )
      dummy.rotation.set(rand() * 0.4, angle, rand() * 0.4)
      dummy.scale.set(1, 1.35, 1)
      dummy.updateMatrix()
      crystals.setMatrixAt(i, dummy.matrix)
    }
    crystals.instanceMatrix.needsUpdate = true
    group.add(crystals)

    // Arena-local lights: deliberately few, bright and shadow-free for mobile/PC.
    const hemi = new THREE.HemisphereLight(0xfff5dc, 0x30283f, 2.25)
    hemi.name = 'ArenaHemiLight'
    group.add(hemi)

    const key = new THREE.DirectionalLight(0xffe8c2, 2.55)
    key.position.set(16, 28, 8)
    key.castShadow = false
    key.name = 'ArenaKeyLight'
    group.add(key)

    const lightPositions = [
      [radiusX * 0.55, 7.5, 0],
      [-radiusX * 0.55, 7.5, 0],
      [0, 7.5, radiusZ * 0.55],
      [0, 7.5, -radiusZ * 0.55]
    ]
    for (const [x, y, z] of lightPositions) {
      const light = new THREE.PointLight(theme.accentColor, 14, 34, 1.7)
      light.position.set(x, y, z)
      light.castShadow = false
      group.add(light)
    }

    // Decorative championship ring near the boss gate.
    const bossRing = new THREE.Mesh(new THREE.TorusGeometry(4.7, 0.22, 8, 32), accentMat)
    bossRing.rotation.x = Math.PI / 2
    bossRing.position.set(0, 0.08, -24.5)
    group.add(bossRing)

    group.userData.arenaBounds = { radiusX, radiusZ, safeRadius: 10 }
    return group
  }

  generateProceduralFloor({ seed, floor, totalFloors, rank, theme }) {
    const rand = prng(seed + floor * 997)
    const isFinalFloor = floor === totalFloors
    const roomTarget = isFinalFloor ? 4 : Math.min(8, 4 + Math.floor(rand() * 3) + (rank === 'S' ? 2 : rank === 'A' ? 1 : 0))

    let rooms = []
    let corridors = []
    let attempts = 0

    while (attempts < 50) {
      attempts++
      rooms = []
      corridors = []

      const spawnRoom = {
        id: 'spawn',
        type: 'spawn',
        x: 0,
        z: 14,
        w: 12,
        d: 12,
        explored: true
      }
      rooms.push(spawnRoom)

      if (isFinalFloor) {
        corridors.push({ x1: 0, z1: 8, x2: 0, z2: -4, w: 4 })
        rooms.push({
          id: 'boss',
          type: 'boss',
          x: 0,
          z: -24,
          w: 28,
          d: 28,
          explored: false
        })
        break
      }

      let lastRoom = spawnRoom
      for (let i = 1; i < roomTarget; i++) {
        const angle = (rand() - 0.5) * Math.PI * 0.85 - Math.PI / 2
        const dist = 16 + rand() * 8
        const rw = 10 + Math.floor(rand() * 6)
        const rd = 10 + Math.floor(rand() * 6)
        const rx = Math.round(lastRoom.x + Math.cos(angle) * dist)
        const rz = Math.round(lastRoom.z + Math.sin(angle) * dist)

        const isExit = i === roomTarget - 1
        const isSecret = !isExit && rand() < 0.35
        const isTreasure = !isExit && !isSecret && rand() < 0.4
        const type = isExit ? 'exit' : isSecret ? 'secret' : isTreasure ? 'treasure' : 'combat'

        const newRoom = { id: `room_${i}`, type, x: rx, z: rz, w: rw, d: rd, explored: false }
        corridors.push({ x1: lastRoom.x, z1: lastRoom.z, x2: newRoom.x, z2: newRoom.z, w: 3.5 })
        rooms.push(newRoom)
        lastRoom = newRoom
      }

      if (rooms.length >= 3 && rand() < 0.6) {
        const branchFrom = rooms[1]
        const sideRoom = {
          id: 'side_secret',
          type: rand() < 0.5 ? 'secret' : 'treasure',
          x: branchFrom.x + (rand() < 0.5 ? 18 : -18),
          z: branchFrom.z + (rand() - 0.5) * 8,
          w: 9,
          d: 9,
          explored: false
        }
        corridors.push({ x1: branchFrom.x, z1: branchFrom.z, x2: sideRoom.x, z2: sideRoom.z, w: 3 })
        rooms.push(sideRoom)
      }

      if (this.validateLayout(rooms, corridors)) break
    }

    const group = this.build3DGeometry(rooms, corridors, theme, isFinalFloor)
    return {
      seed,
      floor,
      totalFloors,
      isFinalFloor,
      theme,
      rooms,
      corridors,
      group,
      spawnPos: { x: rooms[0].x, y: 0, z: rooms[0].z },
      exitPos: rooms.find(r => r.type === 'exit' || r.type === 'boss') || rooms[rooms.length - 1]
    }
  }

  validateLayout(rooms, corridors) {
    if (rooms.length < 2) return false
    for (const r of rooms) {
      const connected = corridors.some(c =>
        Math.hypot(c.x1 - r.x, c.z1 - r.z) < r.w || Math.hypot(c.x2 - r.x, c.z2 - r.z) < r.w
      )
      if (!connected && r.id !== 'spawn') return false
    }
    return true
  }

  build3DGeometry(rooms, corridors, theme, isFinalFloor) {
    const group = new THREE.Group()
    group.name = 'ProceduralDungeonFloor'

    const wallMat = new THREE.MeshStandardMaterial({ color: theme.wallColor, roughness: 0.88, metalness: 0.12 })
    const floorMat = new THREE.MeshStandardMaterial({ color: theme.floorColor, roughness: 0.75, metalness: 0.08 })
    const accentMat = new THREE.MeshStandardMaterial({
      color: theme.accentColor,
      emissive: theme.accentColor,
      emissiveIntensity: 0.85,
      roughness: 0.3
    })

    for (const room of rooms) {
      const fMesh = new THREE.Mesh(new THREE.BoxGeometry(room.w, 0.4, room.d), floorMat)
      fMesh.position.set(room.x, -0.2, room.z)
      fMesh.receiveShadow = true
      group.add(fMesh)

      const wallH = isFinalFloor && room.type === 'boss' ? 7.5 : 4.5
      const wallThick = 0.8
      const nsGeo = new THREE.BoxGeometry(room.w + wallThick * 2, wallH, wallThick)
      const wallN = new THREE.Mesh(nsGeo, wallMat)
      wallN.position.set(room.x, wallH / 2, room.z - room.d / 2 - wallThick / 2)
      const wallS = new THREE.Mesh(nsGeo, wallMat)
      wallS.position.set(room.x, wallH / 2, room.z + room.d / 2 + wallThick / 2)

      const ewGeo = new THREE.BoxGeometry(wallThick, wallH, room.d)
      const wallE = new THREE.Mesh(ewGeo, wallMat)
      wallE.position.set(room.x + room.w / 2 + wallThick / 2, wallH / 2, room.z)
      const wallW = new THREE.Mesh(ewGeo, wallMat)
      wallW.position.set(room.x - room.w / 2 - wallThick / 2, wallH / 2, room.z)
      group.add(wallN, wallS, wallE, wallW)

      const corners = [
        [room.x - room.w / 2 + 1, room.z - room.d / 2 + 1],
        [room.x + room.w / 2 - 1, room.z - room.d / 2 + 1],
        [room.x - room.w / 2 + 1, room.z + room.d / 2 - 1],
        [room.x + room.w / 2 - 1, room.z + room.d / 2 - 1]
      ]
      for (const [cx, cz] of corners) {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 2.4, 6), wallMat)
        pillar.position.set(cx, 1.2, cz)
        const flame = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), accentMat)
        flame.position.set(cx, 2.5, cz)
        group.add(pillar, flame)
      }

      if (room.type === 'treasure' || room.type === 'secret') {
        const chest = new THREE.Group()
        chest.position.set(room.x, 0, room.z)
        const chestBox = new THREE.Mesh(
          new THREE.BoxGeometry(1.2, 0.7, 0.8),
          new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.6 })
        )
        chestBox.position.y = 0.35
        const chestTrim = new THREE.Mesh(
          new THREE.BoxGeometry(1.24, 0.12, 0.84),
          new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.8, roughness: 0.2 })
        )
        chestTrim.position.y = 0.68
        const runeGlow = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), accentMat)
        runeGlow.position.set(0, 0.5, 0.42)
        chest.add(chestBox, chestTrim, runeGlow)
        chest.userData = { isChest: true, roomId: room.id, type: room.type, opened: false }
        group.add(chest)
      }

      if (room.type === 'exit') {
        const exitPad = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.8, 0.4, 16), accentMat)
        exitPad.position.set(room.x, 0.2, room.z)
        const exitRing = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.16, 8, 24), accentMat)
        exitRing.rotation.x = Math.PI / 2
        exitRing.position.set(room.x, 1.4, room.z)
        exitPad.userData = { isFloorExit: true, targetRoomId: room.id }
        group.add(exitPad, exitRing)
      }

      if (room.type === 'boss') {
        const arenaRing = new THREE.Mesh(new THREE.TorusGeometry(10.5, 0.35, 8, 36), accentMat)
        arenaRing.rotation.x = Math.PI / 2
        arenaRing.position.set(room.x, 0.1, room.z)
        group.add(arenaRing)
      }
    }

    for (const c of corridors) {
      const dx = c.x2 - c.x1
      const dz = c.z2 - c.z1
      const len = Math.hypot(dx, dz)
      if (len < 0.1) continue

      const angle = Math.atan2(dx, dz)
      const midX = (c.x1 + c.x2) / 2
      const midZ = (c.z1 + c.z2) / 2
      const cMesh = new THREE.Mesh(new THREE.BoxGeometry(c.w, 0.38, len), floorMat)
      cMesh.position.set(midX, -0.19, midZ)
      cMesh.rotation.y = angle
      cMesh.receiveShadow = true
      group.add(cMesh)
    }

    return group
  }
}
