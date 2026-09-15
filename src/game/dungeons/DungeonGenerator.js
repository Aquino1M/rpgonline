import * as THREE from 'three'
import { DUNGEON_THEMES } from './DungeonConfig.js'

const ARENA_RADIUS = 42
const PLAY_RADIUS = 34
const CAMERA_RADIUS = 38
const SPAWN_RADIUS = 31.5
const GATE_COUNT = 8

export class DungeonGenerator {
  generateFloor({ seed = 12345, floor = 1, totalFloors = 1, rank = 'E', themeKey = 'cavern' }) {
    const theme = DUNGEON_THEMES[themeKey] || DUNGEON_THEMES.cavern
    const spawnPoints = Array.from({ length: GATE_COUNT }, (_, index) => {
      const angle = (index / GATE_COUNT) * Math.PI * 2
      return { x: Math.cos(angle) * SPAWN_RADIUS, z: Math.sin(angle) * SPAWN_RADIUS, angle }
    })

    return {
      seed,
      floor,
      totalFloors,
      rank,
      theme,
      isFinalFloor: true,
      isArena: true,
      rooms: [{ id: 'coliseum', type: 'arena', x: 0, z: 0, w: ARENA_RADIUS * 2, d: ARENA_RADIUS * 2 }],
      spawnPos: { x: 0, y: 0, z: 0 },
      spawnPoints,
      bossSpawn: spawnPoints[Math.floor(GATE_COUNT * 0.75)],
      safeRadius: 7,
      playRadius: PLAY_RADIUS,
      cameraRadius: CAMERA_RADIUS,
      group: this.buildColiseum(theme)
    }
  }

  buildColiseum(theme) {
    const group = new THREE.Group()
    group.name = 'DungeonColiseum'

    const stone = new THREE.MeshStandardMaterial({ color: theme.wallColor, roughness: 0.9, metalness: 0.08, side: THREE.DoubleSide })
    const darkStone = new THREE.MeshStandardMaterial({ color: 0x111720, roughness: 1 })
    const sand = new THREE.MeshStandardMaterial({ color: new THREE.Color(theme.floorColor).lerp(new THREE.Color(0x8a6938), 0.72), roughness: 0.96 })
    const glow = new THREE.MeshStandardMaterial({ color: theme.accentColor, emissive: theme.accentColor, emissiveIntensity: 1.5, roughness: 0.35 })
    const add = (object, shadows = true) => {
      if (object.isMesh && shadows) {
        object.castShadow = true
        object.receiveShadow = true
      }
      group.add(object)
      return object
    }

    const foundation = add(new THREE.Mesh(new THREE.CylinderGeometry(ARENA_RADIUS + 2, ARENA_RADIUS + 2, 0.8, 64), stone))
    foundation.position.y = -0.5
    const floor = add(new THREE.Mesh(new THREE.CircleGeometry(ARENA_RADIUS - 1.2, 64), sand))
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -0.06
    const centerRing = add(new THREE.Mesh(new THREE.TorusGeometry(7, 0.16, 8, 48), glow), false)
    centerRing.rotation.x = Math.PI / 2
    centerRing.position.y = 0.08

    for (const [inner, outer, height] of [[36, 39, 0.6], [39, 42, 1.9], [42, 45, 3.3]]) {
      const tier = add(new THREE.Mesh(new THREE.RingGeometry(inner, outer, 64), stone))
      tier.rotation.x = -Math.PI / 2
      tier.position.y = height
      const rail = add(new THREE.Mesh(new THREE.TorusGeometry(outer - 0.35, 0.16, 6, 64), glow), false)
      rail.rotation.x = Math.PI / 2
      rail.position.y = height + 0.22
    }

    const wall = add(new THREE.Mesh(new THREE.CylinderGeometry(ARENA_RADIUS + 2, ARENA_RADIUS + 2, 9, 64, 1, true), stone))
    wall.position.y = 4.5

    for (let index = 0; index < GATE_COUNT; index++) {
      const angle = (index / GATE_COUNT) * Math.PI * 2
      const x = Math.cos(angle) * (ARENA_RADIUS - 0.8)
      const z = Math.sin(angle) * (ARENA_RADIUS - 0.8)
      const isBossGate = index === Math.floor(GATE_COUNT * 0.75)
      const width = isBossGate ? 8 : 5
      const opening = add(new THREE.Mesh(new THREE.BoxGeometry(width, 5.5, 0.36), darkStone), false)
      opening.position.set(x, 3, z)
      opening.rotation.y = -angle + Math.PI / 2

      for (const side of [-1, 1]) {
        const pillar = add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.58, 6.2, 8), stone))
        pillar.position.set(x - Math.sin(angle) * (width / 2 + 0.35) * side, 3.1, z + Math.cos(angle) * (width / 2 + 0.35) * side)
      }
      const lintel = add(new THREE.Mesh(new THREE.BoxGeometry(width + 1.4, 0.65, 0.9), stone))
      lintel.position.set(x, 6, z)
      lintel.rotation.y = -angle + Math.PI / 2

      const brazier = add(new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), glow), false)
      brazier.position.set(Math.cos(angle) * 36.7, 2.4, Math.sin(angle) * 36.7)
      const light = new THREE.PointLight(theme.accentColor, 18, 24, 2)
      light.position.copy(brazier.position)
      group.add(light)
    }

    const fill = new THREE.HemisphereLight(0xfff1c7, theme.ambientLight, 1.6)
    group.add(fill)
    return group
  }
}
