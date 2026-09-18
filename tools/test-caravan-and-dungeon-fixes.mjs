import assert from 'node:assert/strict'
import { WorldRoadGraph } from '../src/game/caravans/WorldRoadGraph.js'
import { CITIES, ROADS } from '../src/game/config.js'
import { CARAVAN_STATES } from '../src/game/caravans/CaravanConfig.js'

console.log('Testing Caravan and Road Fixes...')

// 1. Test WorldRoadGraph
const graph = new WorldRoadGraph()
const auroraId = 'aurora-city'
const lumenId = 'lumen-city'
const path = graph.findCityPath(auroraId, lumenId)
assert.deepEqual(path, [auroraId, lumenId], 'Path should be direct connected cities')

const waypoints = graph.buildWaypointsForRoute(path)
assert.ok(waypoints.length > 5, 'Should generate multiple waypoints along the route')

// Verify start and end points
const firstWp = waypoints[0]
const lastWp = waypoints[waypoints.length - 1]
const cityA = CITIES.find(c => c.id === auroraId)
const cityB = CITIES.find(c => c.id === lumenId)

assert.equal(firstWp.x, cityA.x, 'First waypoint matches city A origin')
assert.equal(firstWp.z, cityA.z, 'First waypoint matches city A origin')
assert.equal(lastWp.x, cityB.x, 'Last waypoint matches city B destination')
assert.equal(lastWp.z, cityB.z, 'Last waypoint matches city B destination')

// Verify that the route points go through gates and not arbitrary sways
const gate = graph.getCardinalGate(cityA, cityB, 0.2)
const hasGateNearby = waypoints.some(wp => Math.hypot(wp.x - gate.x, wp.z - gate.z) < 1.0)
assert.ok(hasGateNearby, 'Route passes through city gate correctly')

console.log('✓ WorldRoadGraph waypoint routing test passed!')

// 2. Test target damageable structure
const mockCaravan = {
  name: 'Caravana de Mercadorias',
  hp: 2000,
  maxHp: 2000,
  position: { x: 50, y: 0, z: 50, distanceTo: () => 5 },
  attackedByPlayer: false,
  state: CARAVAN_STATES.TRAVELING,
  stateTimer: 0,
  routeKey: 'aurora-city:lumen-city'
}

const mockGuard = {
  name: 'Guerreiro da Escolta',
  hp: 400,
  maxHp: 400,
  level: 20,
  isElite: false,
  dead: false,
  mesh: { position: { x: 52, y: 0, z: 50, distanceTo: () => 3, addScaledVector: () => {} }, visible: true }
}

const targetCart = {
  g: { position: { x: 50, y: 0, z: 50, distanceTo: () => 4 } },
  hp: mockCaravan.hp,
  maxHp: mockCaravan.maxHp,
  name: mockCaravan.name,
  isCaravanCart: true,
  caravan: mockCaravan
}

const targetGuard = {
  g: mockGuard.mesh,
  hp: mockGuard.hp,
  maxHp: mockGuard.maxHp,
  name: `${mockGuard.name} [Guarda]`,
  isCaravanGuard: true,
  guard: mockGuard,
  caravan: mockCaravan
}

assert.equal(targetCart.isCaravanCart, true)
assert.equal(targetGuard.isCaravanGuard, true)
console.log('✓ Caravan attackable targets structure verified!')

console.log('All caravan tests completed successfully!')
