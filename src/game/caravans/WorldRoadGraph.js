// WorldRoadGraph.js - Topological Road Graph, City Connections, Waypoint sampling and Pathfinding
import { CITIES, ROADS } from '../config.js'

export class WorldRoadGraph {
  constructor() {
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

  buildWaypointsForRoute(cityPath, spacing = 12) {
    const waypoints = []

    for (let i = 0; i < cityPath.length - 1; i++) {
      const cityA = this.cityMap.get(cityPath[i])
      const cityB = this.cityMap.get(cityPath[i + 1])
      if (!cityA || !cityB) continue

      const ax = cityA.x, az = cityA.z
      const bx = cityB.x, bz = cityB.z
      const dist = Math.hypot(bx - ax, bz - az)
      const steps = Math.max(3, Math.ceil(dist / spacing))

      for (let s = 0; s < steps; s++) {
        const t = s / steps
        // Linear road with subtle natural sway to avoid rigid grid look
        const sway = Math.sin(t * Math.PI) * 1.5
        const normalX = -(bz - az) / (dist || 1)
        const normalZ = (bx - ax) / (dist || 1)

        waypoints.push({
          x: ax + (bx - ax) * t + normalX * sway,
          z: az + (bz - az) * t + normalZ * sway,
          segmentFrom: cityA.id,
          segmentTo: cityB.id
        })
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
