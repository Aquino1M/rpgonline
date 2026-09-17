import assert from 'node:assert/strict'
import { isPetCombatTarget, findBestPetTarget } from '../src/game/petCombatV2.js'

console.log('Testing Pet Combat AI & Target Acquisition...')

// Mock target
const mockEnemy = {
  name: 'Lobo Alfa',
  level: 12,
  hp: 250,
  maxHp: 250,
  dead: false,
  g: {
    position: { x: 5, z: 5, distanceTo: (p) => Math.hypot(5 - p.x, 5 - p.z) },
    visible: true
  }
}

const mockEnemyFar = {
  name: 'Espectro Distante',
  level: 30,
  hp: 500,
  maxHp: 500,
  dead: false,
  g: {
    position: { x: 100, z: 100, distanceTo: (p) => Math.hypot(100 - p.x, 100 - p.z) },
    visible: true
  }
}

const mockGame = {
  player: { position: { x: 0, z: 0 } },
  enemies: [mockEnemyFar, mockEnemy],
  state: {
    target: null,
    inCombat: false
  },
  petTarget: null
}

// 1. isPetCombatTarget test
assert.equal(isPetCombatTarget(mockGame, mockEnemy), true, 'Enemy in 38m must be valid combat target')
assert.equal(isPetCombatTarget(mockGame, mockEnemyFar), false, 'Enemy >38m must not be valid combat target')

// 2. findBestPetTarget when player has a target
mockGame.state.target = mockEnemy
assert.equal(findBestPetTarget(mockGame), mockEnemy, 'Pet must acquire player state.target')

// 3. findBestPetTarget when player has no target but enemy is within 24m
mockGame.state.target = null
assert.equal(findBestPetTarget(mockGame), mockEnemy, 'Pet must proactively engage nearest enemy within 24m')

// 4. Target dying -> reacquisition
mockEnemy.dead = true
mockEnemy.hp = 0
assert.equal(findBestPetTarget(mockGame), null, 'Pet must release dead target when no other nearby enemies exist')

console.log('Pet combat AI and targeting tests: OK')
