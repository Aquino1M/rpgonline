import assert from 'node:assert/strict'
import test from 'node:test'
import { DungeonGenerator } from '../src/game/dungeons/DungeonGenerator.js'

test('coliseum keeps player center clear and mobs at the edge', () => {
  const arena = new DungeonGenerator().generateFloor({ seed: 1, themeKey: 'cavern' })

  assert.deepEqual(arena.spawnPos, { x: 0, y: 0, z: 0 })
  assert.equal(arena.spawnPoints.length, 8)
  assert.ok(arena.spawnPoints.every(point => Math.hypot(point.x, point.z) > arena.safeRadius))
  assert.ok(Math.hypot(arena.bossSpawn.x, arena.bossSpawn.z) > arena.safeRadius)
  assert.equal(arena.group.name, 'DungeonColiseum')
})
