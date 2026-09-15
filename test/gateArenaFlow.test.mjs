import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import { GateManager } from '../src/game/dungeons/GateManager.js'
import { DUNGEON_THEMES, GATE_RANKS } from '../src/game/dungeons/DungeonConfig.js'

function makeGame() {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color()
  scene.fog = new THREE.Fog(0, 1, 2)
  const game = {
    state: { mount: {} },
    player: { position: new THREE.Vector3(12, 0, 12) },
    mountModel: { visible: true },
    dungeonArena: new THREE.Group(),
    scene,
    enemies: [],
    clearEnemies() { this.enemies = [] },
    setWorldVisible() {},
    toast() {},
    makeEnemy(x, z, level, name, boss) {
      const g = new THREE.Group()
      g.position.set(x, 0, z)
      this.dungeonArena.add(g)
      return { g, level, name, boss, dead: false, hp: 100, maxHp: 100, atk: 10 }
    }
  }
  return game
}

test('gate entry uses the center coliseum and delayed edge wave', () => {
  const game = makeGame()
  const manager = new GateManager(game)
  manager.createDungeonInstance({
    id: 'test-gate', seed: 3, rankKey: 'E', rankConfig: GATE_RANKS.E,
    dungeonLevel: 1, totalRounds: 3, themeKey: 'cavern', theme: DUNGEON_THEMES.cavern, name: 'Teste'
  })

  assert.deepEqual(game.player.position.toArray(), [0, 0, 0])
  assert.equal(manager.activeInstance.roundState, 'BREAK')
  assert.equal(game.enemies.length, 0)
  manager.updateInstance(1.8, 0)
  assert.equal(manager.activeInstance.currentRound, 1)
  assert.ok(game.enemies.every(enemy => Math.hypot(enemy.g.position.x, enemy.g.position.z) > 7))
})
