// DungeonGenerator.js - Procedural dungeon floor generator with rooms, corridors, secrets and 3D geometry
import * as THREE from 'three'
import { DUNGEON_THEMES } from './DungeonConfig.js'

function prng(seed) {
  let s = Math.abs(Math.floor(seed)) || 1234567
  return function() {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

export class DungeonGenerator {
  constructor() {}

  generateFloor({ seed = 12345, floor = 1, totalFloors = 3, rank = 'C', themeKey = 'cavern' }) {
    const theme = DUNGEON_THEMES[themeKey] || DUNGEON_THEMES.cavern
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

      // Room 1: Entrance / Spawn
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
        // Pre-boss corridor + Great Boss Arena
        const preCorridor = { x1: 0, z1: 8, x2: 0, z2: -4, w: 4 }
        corridors.push(preCorridor)

        const bossArena = {
          id: 'boss',
          type: 'boss',
          x: 0,
          z: -24,
          w: 28,
          d: 28,
          explored: false
        }
        rooms.push(bossArena)
        break
      }

      // Normal multi-room floor layout
      let lastRoom = spawnRoom
      for (let i = 1; i < roomTarget; i++) {
        const angle = (rand() - 0.5) * Math.PI * 0.85 - Math.PI / 2
        const dist = 16 + rand() * 8
        const rw = 10 + Math.floor(rand() * 6)
        const rd = 10 + Math.floor(rand() * 6)
        const rx = Math.round(lastRoom.x + Math.cos(angle) * dist)
        const rz = Math.round(lastRoom.z + Math.sin(angle) * dist)

        // Type of room
        const isExit = i === roomTarget - 1
        const isSecret = !isExit && rand() < 0.35
        const isTreasure = !isExit && !isSecret && rand() < 0.4
        const type = isExit ? 'exit' : isSecret ? 'secret' : isTreasure ? 'treasure' : 'combat'

        const newRoom = {
          id: `room_${i}`,
          type,
          x: rx,
          z: rz,
          w: rw,
          d: rd,
          explored: false
        }

        // Corridor between lastRoom and newRoom
        corridors.push({
          x1: lastRoom.x,
          z1: lastRoom.z,
          x2: newRoom.x,
          z2: newRoom.z,
          w: 3.5
        })

        rooms.push(newRoom)
        lastRoom = newRoom
      }

      // Add a side branch secret/treasure room if possible
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
        corridors.push({
          x1: branchFrom.x,
          z1: branchFrom.z,
          x2: sideRoom.x,
          z2: sideRoom.z,
          w: 3.0
        })
        rooms.push(sideRoom)
      }

      // Validate connection
      if (this.validateLayout(rooms, corridors)) {
        break
      }
    }

    // Build 3D mesh representation
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
    // Ensure all rooms have at least one corridor connected
    for (const r of rooms) {
      const connected = corridors.some(c => 
        (Math.hypot(c.x1 - r.x, c.z1 - r.z) < r.w || Math.hypot(c.x2 - r.x, c.z2 - r.z) < r.w)
      )
      if (!connected && r.id !== 'spawn') return false
    }
    return true
  }

  build3DGeometry(rooms, corridors, theme, isFinalFloor) {
    const group = new THREE.Group()
    group.name = 'ProceduralDungeonFloor'

    const wallMat = new THREE.MeshStandardMaterial({
      color: theme.wallColor,
      roughness: 0.88,
      metalness: 0.12
    })
    const floorMat = new THREE.MeshStandardMaterial({
      color: theme.floorColor,
      roughness: 0.75,
      metalness: 0.08
    })
    const accentMat = new THREE.MeshStandardMaterial({
      color: theme.accentColor,
      emissive: theme.accentColor,
      emissiveIntensity: 0.85,
      roughness: 0.3
    })

    // Ambient torch/brazier light colors
    const torchColor = theme.accentColor

    // 1. Build Rooms
    for (const room of rooms) {
      // Floor
      const fGeo = new THREE.BoxGeometry(room.w, 0.4, room.d)
      const fMesh = new THREE.Mesh(fGeo, floorMat)
      fMesh.position.set(room.x, -0.2, room.z)
      fMesh.receiveShadow = true
      group.add(fMesh)

      // Outer Walls
      const wallH = isFinalFloor && room.type === 'boss' ? 7.5 : 4.5
      const wallThick = 0.8

      // North & South walls
      const nsGeo = new THREE.BoxGeometry(room.w + wallThick * 2, wallH, wallThick)
      const wallN = new THREE.Mesh(nsGeo, wallMat)
      wallN.position.set(room.x, wallH / 2, room.z - room.d / 2 - wallThick / 2)
      const wallS = new THREE.Mesh(nsGeo, wallMat)
      wallS.position.set(room.x, wallH / 2, room.z + room.d / 2 + wallThick / 2)

      // East & West walls
      const ewGeo = new THREE.BoxGeometry(wallThick, wallH, room.d)
      const wallE = new THREE.Mesh(ewGeo, wallMat)
      wallE.position.set(room.x + room.w / 2 + wallThick / 2, wallH / 2, room.z)
      const wallW = new THREE.Mesh(ewGeo, wallMat)
      wallW.position.set(room.x - room.w / 2 - wallThick / 2, wallH / 2, room.z)

      group.add(wallN, wallS, wallE, wallW)

      // Torches in room corners
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

      // Special Room props
      if (room.type === 'treasure' || room.type === 'secret') {
        // Treasure Chest Base
        const chest = new THREE.Group()
        chest.position.set(room.x, 0, room.z)
        const chestBox = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.8), new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.6 }))
        chestBox.position.y = 0.35
        const chestTrim = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.12, 0.84), new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.8, roughness: 0.2 }))
        chestTrim.position.y = 0.68
        const runeGlow = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), accentMat)
        runeGlow.position.set(0, 0.5, 0.42)
        chest.add(chestBox, chestTrim, runeGlow)
        chest.userData = { isChest: true, roomId: room.id, type: room.type, opened: false }
        group.add(chest)
      }

      if (room.type === 'exit') {
        // Portal / Staircase to next floor
        const exitPad = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.8, 0.4, 16), accentMat)
        exitPad.position.set(room.x, 0.2, room.z)
        const exitRing = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.16, 8, 24), accentMat)
        exitRing.rotation.x = Math.PI / 2
        exitRing.position.set(room.x, 1.4, room.z)
        exitPad.userData = { isFloorExit: true, targetRoomId: room.id }
        group.add(exitPad, exitRing)
      }

      if (room.type === 'boss') {
        // Large ceremonial boss ring
        const arenaRing = new THREE.Mesh(new THREE.TorusGeometry(10.5, 0.35, 8, 36), accentMat)
        arenaRing.rotation.x = Math.PI / 2
        arenaRing.position.set(room.x, 0.1, room.z)
        group.add(arenaRing)
      }
    }

    // 2. Build Corridors
    for (const c of corridors) {
      const dx = c.x2 - c.x1
      const dz = c.z2 - c.z1
      const len = Math.hypot(dx, dz)
      if (len < 0.1) continue

      const angle = Math.atan2(dx, dz)
      const midX = (c.x1 + c.x2) / 2
      const midZ = (c.z1 + c.z2) / 2

      // Corridor Floor
      const cGeo = new THREE.BoxGeometry(c.w, 0.38, len)
      const cMesh = new THREE.Mesh(cGeo, floorMat)
      cMesh.position.set(midX, -0.19, midZ)
      cMesh.rotation.y = angle
      cMesh.receiveShadow = true
      group.add(cMesh)
    }

    return group
  }
}
