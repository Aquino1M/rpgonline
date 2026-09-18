// WorldRoadGraph.js - Topological Road Graph, City Connections, Waypoint sampling and Pathfinding
import { CITIES, ROADS } from '../config.js'

export class WorldRoadGraph {
  constructor(game = null) {
    this.game = game
    this.cityMap = new Map()
    this.adjacency = new Map()
    this.initGraph()
  }

  initGraph() {
    for (const city of CITIES) {
      this.cityMap.set(city.id, city)
      this.adjacency.set(city.id, [])
    }

    for (const road of ROADS) {
      if (this.adjacency.has(road.a) && this.adjacency.has(road.b)) {
        this.adjacency.get(road.a).push(road.b)
        this.adjacency.get(road.b).push(road.a)
      }
    }
  }

  getConnectedCities(cityId) {
    return this.adjacency.get(cityId) || []
  }

  getRandomDestination(originCityId) {
    const connected = this.adjacency.get(originCityId) || []
    if (connected.length === 0) return 'aurora-city'
    // 70% pick immediate neighbor, 30% pick any valid reachable city
    if (Math.random() < 0.7) {
      return connected[Math.floor(Math.random() * connected.length)]
    }
    const allCities = CITIES.filter(c => c.id !== originCityId)
    return allCities[Math.floor(Math.random() * allCities.length)].id
  }

  findCityPath(startId, endId) {
    if (startId === endId) return [startId]

    // BFS shortest path in road network
    const queue = [[startId]]
    const visited = new Set([startId])

    while (queue.length > 0) {
      const path = queue.shift()
      const current = path[path.length - 1]

      if (current === endId) {
        return path
      }

      const neighbors = this.adjacency.get(current) || []
      for (const next of neighbors) {
        if (!visited.has(next)) {
          visited.add(next)
          queue.push([...path, next])
        }
      }
    }

    // Fallback direct
    return [startId, endId]
  }

  getCardinalGate(city, toward, extra = 0) {
    const dx = toward.x - city.x
    const dz = toward.z - city.z
    const r = Number(city.wallRadius) || Number(city.radius) || 30
    if (Math.abs(dx) >= Math.abs(dz)) {
      const sign = dx >= 0 ? 1 : -1
      return { x: city.x + sign * (r + extra), z: city.z }
    }
    const sign = dz >= 0 ? 1 : -1
    return { x: city.x, z: city.z + sign * (r + extra) }
  }

  getRoadKeyPoints(cityA, cityB) {
    // Check if the 3D road mesh points already exist in game runtime
    if (this.game?.roadMeshes) {
      const found = this.game.roadMeshes.find(
        r => (r.a?.id === cityA.id && r.b?.id === cityB.id) || (r.a?.id === cityB.id && r.b?.id === cityA.id)
      )
      if (found && Array.isArray(found.points) && found.points.length >= 2) {
        const pts = found.points.map(p => ({ x: p.x, z: p.z }))
        const oriented = (found.a?.id === cityA.id) ? pts : [...pts].reverse()
        return [
          { x: cityA.x, z: cityA.z },
          ...oriented,
          { x: cityB.x, z: cityB.z }
        ]
      }
    }

    // Deterministic canonical road geometry calculation matching worldTravelPolishV2
    const isFirstA = cityA.id < cityB.id
    const first = isFirstA ? cityA : cityB
    const second = isFirstA ? cityB : cityA

    const gateFirst = this.getCardinalGate(first, second, 0.2)
    const gateSecond = this.getCardinalGate(second, first, 0.2)
    const outsideFirst = this.getCardinalGate(first, second, 8.5)
    const outsideSecond = this.getCardinalGate(second, first, 8.5)

    const dx = outsideSecond.x - outsideFirst.x
    const dz = outsideSecond.z - outsideFirst.z
    const d = Math.hypot(dx, dz) || 1
    const perpX = -dz / d
    const perpZ = dx / d
    let hash = 0
    const key = `${first.id}:${second.id}`
    for (let i = 0; i < key.length; i++) hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0
    const bend = Math.min(18, Math.max(5, d * 0.025)) * ((Math.abs(hash) % 2) ? 1 : -1)
    const mid = {
      x: (outsideFirst.x + outsideSecond.x) * 0.5 + perpX * bend,
      z: (outsideFirst.z + outsideSecond.z) * 0.5 + perpZ * bend
    }

    const roadSegments = [gateFirst, outsideFirst, mid, outsideSecond, gateSecond]
    const orientedRoad = isFirstA ? roadSegments : [...roadSegments].reverse()

    return [
      { x: cityA.x, z: cityA.z },
      ...orientedRoad,
      { x: cityB.x, z: cityB.z }
    ]
  }

  buildWaypointsForRoute(cityPath, spacing = 6.5) {
    const waypoints = []

    for (let i = 0; i < cityPath.length - 1; i++) {
      const cityA = this.cityMap.get(cityPath[i])
      const cityB = this.cityMap.get(cityPath[i + 1])
      if (!cityA || !cityB) continue

      const keyPoints = this.getRoadKeyPoints(cityA, cityB)

      for (let k = 0; k < keyPoints.length - 1; k++) {
        const p1 = keyPoints[k]
        const p2 = keyPoints[k + 1]
        const segDist = Math.hypot(p2.x - p1.x, p2.z - p1.z)
        const steps = Math.max(1, Math.ceil(segDist / spacing))

        for (let s = 0; s < steps; s++) {
          const t = s / steps
          waypoints.push({
            x: p1.x + (p2.x - p1.x) * t,
            z: p1.z + (p2.z - p1.z) * t,
            segmentFrom: cityA.id,
            segmentTo: cityB.id
          })
        }
      }
    }

    // Add final destination center
    const finalCity = this.cityMap.get(cityPath[cityPath.length - 1])
    if (finalCity) {
      waypoints.push({
        x: finalCity.x,
        z: finalCity.z,
        segmentFrom: finalCity.id,
        segmentTo: finalCity.id
      })
    }

    return waypoints
  }

  calculateRouteLength(waypoints) {
    let total = 0
    for (let i = 0; i < waypoints.length - 1; i++) {
      total += Math.hypot(waypoints[i + 1].x - waypoints[i].x, waypoints[i + 1].z - waypoints[i].z)
    }
    return total
  }

  getRouteKey(cityAId, cityBId) {
    return [cityAId, cityBId].sort().join('--')
  }
}
