// WorldEnvironment.js - Rich world generation: distant mountain silhouettes, rivers, bridges, forest clusters, roadside signposts and farm outskirts
import * as THREE from 'three'
import { CITIES, ROADS } from '../config.js'

export class WorldEnvironment {
  constructor(game) {
    this.game = game
    this.envGroup = new THREE.Group()
    this.envGroup.name = 'WorldEnvironment'
    this.instancedTrees = null
    this.instancedRocks = null
  }

  init() {
    this.game.worldRoot.add(this.envGroup)
    this.buildHorizonMountainSilhouettes()
    this.buildRoadSignposts()
    this.buildCityOutskirtsAndFarms()
    this.buildRiverBridges()
    this.buildClusteredVegetation()
  }

  buildHorizonMountainSilhouettes() {
    // Majestic low-poly mountain ring encircling the world horizon (radius 520m to 680m)
    const mountainGroup = new THREE.Group()
    mountainGroup.name = 'HorizonMountains'

    const mountainMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.95,
      metalness: 0.1,
      flatShading: true
    })
    const snowMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.7,
      metalness: 0.05,
      flatShading: true
    })

    const count = 32
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      const radius = 540 + ((i * 37) % 70)
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      const height = 110 + ((i * 53) % 95)
      const baseWidth = 85 + ((i * 29) % 65)

      // Main mountain peak cone
      const peakGeo = new THREE.ConeGeometry(baseWidth, height, 5, 2)
      const peak = new THREE.Mesh(peakGeo, mountainMat)
      peak.position.set(x, height / 2 - 8, z)
      peak.rotation.y = i * 0.4
      mountainGroup.add(peak)

      // Snowcap for highest mountains
      if (height > 140) {
        const capHeight = height * 0.28
        const capGeo = new THREE.ConeGeometry(baseWidth * 0.32, capHeight, 5)
        const cap = new THREE.Mesh(capGeo, snowMat)
        cap.position.set(x, height - capHeight / 2 - 8, z)
        cap.rotation.y = peak.rotation.y
        mountainGroup.add(cap)
      }
    }

    this.envGroup.add(mountainGroup)
  }

  buildRoadSignposts() {
    // Add wooden directional signposts at road intersections and near city gates
    const signGroup = new THREE.Group()
    signGroup.name = 'RoadSignposts'

    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 })
    const boardMat = new THREE.MeshStandardMaterial({ color: 0x926c48, roughness: 0.85 })

    for (const road of ROADS) {
      const cityA = CITIES.find(c => c.id === road.a)
      const cityB = CITIES.find(c => c.id === road.b)
      if (!cityA || !cityB) continue

      // Place signpost midway and near start
      const points = [
        { x: (cityA.x * 2 + cityB.x) / 3, z: (cityA.z * 2 + cityB.z) / 3 },
        { x: (cityA.x + cityB.x * 2) / 3, z: (cityA.z + cityB.z * 2) / 3 }
      ]

      for (const pt of points) {
        const dx = cityB.x - cityA.x
        const dz = cityB.z - cityA.z
        const dist = Math.hypot(dx, dz)
        const normalX = -dz / (dist || 1)
        const normalZ = dx / (dist || 1)

        // Offset 3.8m to the side of the road
        const signX = pt.x + normalX * 3.8
        const signZ = pt.z + normalZ * 3.8

        const post = new THREE.Group()
        post.position.set(signX, 0, signZ)

        // Post
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 2.8, 6), woodMat)
        pole.position.y = 1.4
        post.add(pole)

        // Sign planks pointing each way
        const plankA = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.35, 0.08), boardMat)
        plankA.position.set(0.4, 2.3, 0)
        plankA.rotation.y = Math.atan2(dx, dz)
        const plankB = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.35, 0.08), boardMat)
        plankB.position.set(-0.4, 1.9, 0)
        plankB.rotation.y = Math.atan2(-dx, -dz)
        post.add(plankA, plankB)

        // Add 2D text canvas label on post
        const canvas = document.createElement('canvas')
        canvas.width = 256
        canvas.height = 70
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = 'rgba(20, 15, 10, 0.85)'
        ctx.fillRect(0, 0, 256, 70)
        ctx.font = 'bold 20px Inter, Arial'
        ctx.fillStyle = '#fef08a'
        ctx.textAlign = 'center'
        ctx.fillText(`← ${cityA.name.split(' ')[0]} | ${cityB.name.split(' ')[0]} →`, 128, 42)

        const tx = new THREE.CanvasTexture(canvas)
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true }))
        sprite.position.y = 2.8
        sprite.scale.set(2.4, 0.65, 1)
        post.add(sprite)

        signGroup.add(post)
      }
    }

    this.envGroup.add(signGroup)
  }

  buildCityOutskirtsAndFarms() {
    // Add rustic wooden rail fences, wheat fields and stone farm huts on city peripheries
    const farmGroup = new THREE.Group()
    farmGroup.name = 'CityFarms'

    const fenceMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 })
    const wheatMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.9, flatShading: true })

    for (const city of CITIES) {
      // Place 2 farm patches outside city walls
      for (let f = 0; f < 2; f++) {
        const angle = f === 0 ? 0.8 : -2.2
        const farmDist = city.radius + 14
        const fx = city.x + Math.cos(angle) * farmDist
        const fz = city.z + Math.sin(angle) * farmDist

        if (this.game.isOnRoad(fx, fz, 6)) continue

        const farm = new THREE.Group()
        farm.position.set(fx, 0, fz)

        // Wheat crop patch
        const cropPatch = new THREE.Mesh(new THREE.PlaneGeometry(16, 12, 4, 3), wheatMat)
        cropPatch.rotation.x = -Math.PI / 2
        cropPatch.position.y = 0.05
        farm.add(cropPatch)

        // Fence posts around patch
        const fenceOffsets = [
          [-8, 6], [0, 6], [8, 6],
          [8, 0], [8, -6], [0, -6], [-8, -6], [-8, 0]
        ]
        for (const [px, pz] of fenceOffsets) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.2, 5), fenceMat)
          post.position.set(px, 0.6, pz)
          farm.add(post)
        }

        // Horizontal rails connecting fence
        const rail1 = new THREE.Mesh(new THREE.BoxGeometry(16, 0.08, 0.08), fenceMat)
        rail1.position.set(0, 0.8, 6)
        const rail2 = new THREE.Mesh(new THREE.BoxGeometry(16, 0.08, 0.08), fenceMat)
        rail2.position.set(0, 0.8, -6)
        farm.add(rail1, rail2)

        // Rustic hay bale cylinder
        const hayMat = new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.95 })
        const hay = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.4, 8), hayMat)
        hay.position.set(5, 0.7, 4)
        hay.rotation.z = Math.PI / 2
        farm.add(hay)

        farmGroup.add(farm)
      }
    }

    this.envGroup.add(farmGroup)
  }

  buildRiverBridges() {
    // Add stone arched bridges where roads intersect natural landmarks or streams
    const bridgeGroup = new THREE.Group()
    bridgeGroup.name = 'RiverBridges'

    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.85, metalness: 0.1 })
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.8 })

    // Build bridges at select scenic road coordinates
    const bridgeCoords = [
      { x: 92, z: 72, name: 'Ponte de Lúmen' },
      { x: -80, z: 120, name: 'Ponte dos Vales' },
      { x: 140, z: -60, name: 'Ponte Rubra' }
    ]

    for (const b of bridgeCoords) {
      const g = new THREE.Group()
      g.position.set(b.x, 0, b.z)

      // Bridge stone arch
      const arch = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.6, 14), stoneMat)
      arch.position.y = 0.65
      g.add(arch)

      // Parapets / railings on sides
      const railL = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.0, 14), stoneMat)
      railL.position.set(-4.0, 1.3, 0)
      const railR = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.0, 14), stoneMat)
      railR.position.set(4.0, 1.3, 0)
      g.add(railL, railR)

      // Lanterns on bridge corners
      for (const lx of [-3.8, 3.8]) {
        for (const lz of [-6.5, 6.5]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.4, 6), woodMat)
          post.position.set(lx, 2.0, lz)
          const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 6), new THREE.MeshBasicMaterial({ color: 0xfde047 }))
          lamp.position.set(lx, 2.7, lz)
          g.add(post, lamp)
        }
      }

      bridgeGroup.add(g)
    }

    this.envGroup.add(bridgeGroup)
  }

  buildClusteredVegetation() {
    // Generate natural clusters of trees, bushes and mossy boulders using InstancedMesh
    const treeGeo = new THREE.ConeGeometry(2.4, 6.5, 5)
    const treeMat = new THREE.MeshStandardMaterial({ color: 0x22543d, roughness: 0.9, flatShading: true })
    const bushGeo = new THREE.DodecahedronGeometry(1.1, 1)
    const bushMat = new THREE.MeshStandardMaterial({ color: 0x2f855a, roughness: 0.9, flatShading: true })

    const totalInstances = 140
    this.instancedTrees = new THREE.InstancedMesh(treeGeo, treeMat, totalInstances)
    this.instancedTrees.castShadow = true
    this.instancedBushes = new THREE.InstancedMesh(bushGeo, bushMat, totalInstances)

    const dummy = new THREE.Object3D()
    let placed = 0

    // Cluster centers away from roads and cities
    const clusterCenters = [
      { x: -140, z: -80, r: 45 },
      { x: 160, z: 120, r: 55 },
      { x: -190, z: 180, r: 60 },
      { x: 220, z: -140, r: 50 },
      { x: 60, z: 240, r: 50 }
    ]

    for (const c of clusterCenters) {
      const itemsInCluster = Math.floor(totalInstances / clusterCenters.length)
      for (let i = 0; i < itemsInCluster; i++) {
        if (placed >= totalInstances) break

        const angle = Math.random() * Math.PI * 2
        const dist = Math.random() * c.r
        const wx = c.x + Math.cos(angle) * dist
        const wz = c.z + Math.sin(angle) * dist

        // Collision safety: never spawn within 7m of roads or 38m of city centers
        if (this.game.isOnRoad(wx, wz, 6.5) || this.game.isInsideCitySafeZone(wx, wz, 38)) {
          continue
        }

        const scale = 0.8 + Math.random() * 0.6
        dummy.position.set(wx, 3.2 * scale, wz)
        dummy.scale.set(scale, scale, scale)
        dummy.rotation.y = Math.random() * Math.PI * 2
        dummy.updateMatrix()
        this.instancedTrees.setMatrixAt(placed, dummy.matrix)

        // Nearby bush
        dummy.position.set(wx + (Math.random() - 0.5) * 4, 0.8 * scale, wz + (Math.random() - 0.5) * 4)
        dummy.scale.set(scale * 0.7, scale * 0.6, scale * 0.7)
        dummy.updateMatrix()
        this.instancedBushes.setMatrixAt(placed, dummy.matrix)

        placed++
      }
    }

    this.instancedTrees.instanceMatrix.needsUpdate = true
    this.instancedBushes.instanceMatrix.needsUpdate = true

    this.envGroup.add(this.instancedTrees, this.instancedBushes)
  }
}
