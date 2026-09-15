import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/game/encounterCamps.js', import.meta.url), 'utf8')
assert.match(source, /const CAMPS = \[/, 'Camp definitions must exist')
assert.match(source, /camp\.chest\.visible = true/, 'Chest must unlock after the camp is cleared')
assert.match(source, /onInteract\(\)/, 'Chest must use the shared interaction flow')
assert.match(source, /this\.game\.addInventoryItem\(reward\)/, 'Chest must grant an inventory reward')
assert.match(source, /this\.game\.gainXp\(xp\)/, 'Chest must grant XP')
console.log('Encounter camp checks passed.')
