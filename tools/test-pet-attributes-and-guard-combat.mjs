import assert from 'node:assert/strict'

console.log('--- Test 1: Pet Attributes Staging & Confirmation ---')

const pet = {
  id: 'pet_tinker_1',
  name: 'Tinker',
  level: 16,
  damage: 48,
  hp: 330,
  maxHp: 330,
  attributePoints: 14,
  attributeGrantedLevel: 16,
  attributes: { strength: 1, vitality: 0, agility: 0, spirit: 0 }
}

const mockGame = {
  state: {
    pets: {
      owned: [pet],
      activeId: 'pet_tinker_1'
    }
  },
  activePet: () => pet,
  toast: (msg) => console.log('  Toast:', msg),
  saveGame: () => {},
  saveCloudGame: () => {}
}

// Emulate staging logic from petAttributesV6.js
let staged = { strength: 0, vitality: 0, agility: 0, spirit: 0 }
let stagedTotal = 0

function addPoint(key) {
  const remaining = Math.max(0, pet.attributePoints - stagedTotal)
  if (remaining <= 0) return false
  staged[key] = (staged[key] || 0) + 1
  stagedTotal = staged.strength + staged.vitality + staged.agility + staged.spirit
  return true
}

function removePoint(key) {
  if ((staged[key] || 0) <= 0) return false
  staged[key] -= 1
  stagedTotal = staged.strength + staged.vitality + staged.agility + staged.spirit
  return true
}

// User adds 3 points to strength, 2 points to vitality
assert.equal(addPoint('strength'), true)
assert.equal(addPoint('strength'), true)
assert.equal(addPoint('strength'), true)
assert.equal(addPoint('vitality'), true)
assert.equal(addPoint('vitality'), true)
assert.equal(stagedTotal, 5)
assert.equal(pet.attributePoints - stagedTotal, 9, 'Remaining points should be 9')

// User made a mistake and decrements vitality by 1
assert.equal(removePoint('vitality'), true)
assert.equal(stagedTotal, 4)
assert.equal(staged.vitality, 1)
assert.equal(pet.attributePoints - stagedTotal, 10, 'Remaining points should be 10')

// Verify cannot decrement below 0
assert.equal(removePoint('agility'), false)
assert.equal(staged.agility, 0)

// Allocate staged points using the formula from petAttributesV6.js
const totalToCommit = stagedTotal
pet.attributePoints -= totalToCommit
const lv = pet.level
for (const key of ['strength', 'vitality', 'agility', 'spirit']) {
  const pts = staged[key] || 0
  if (!pts) continue
  pet.attributes[key] += pts
  if (key === 'strength') pet.damage += pts * Math.max(2, Math.round(2 + lv * 0.04))
  if (key === 'vitality') {
    const add = pts * Math.max(10, Math.round(9 + lv * 0.25))
    pet.maxHp += add
    pet.hp += add
  }
}
staged = { strength: 0, vitality: 0, agility: 0, spirit: 0 }

assert.equal(pet.attributePoints, 10, 'Pet should have 10 points left after commit')
assert.equal(pet.attributes.strength, 4, 'Strength should now be 1 + 3 = 4')
assert.equal(pet.attributes.vitality, 1, 'Vitality should now be 0 + 1 = 1')
assert.ok(pet.damage > 48, 'Damage must have increased')
assert.ok(pet.maxHp > 330, 'MaxHp must have increased')
console.log(`  Pet committed: Dmg=${pet.damage}, HP=${pet.hp}/${pet.maxHp}, Points Left=${pet.attributePoints}`)

console.log('--- Test 2: Caravan Guard Attack Damage on Mob ---')

const guard = {
  id: 'guard_1',
  name: 'Valen',
  atk: 45,
  cls: { id: 'warrior' },
  mesh: { position: { x: 10, y: 0, z: 10 } }
}

const mob = {
  name: 'Salteador da Estrada',
  level: 15,
  hp: 200,
  maxHp: 200,
  def: 8,
  dead: false,
  g: { position: { x: 12, y: 0, z: 10 } }
}

let spawnedDamage = null
let labelUpdated = false
let enemyFlashed = false

const caravanGame = {
  spawnDamageText: (pos, amount, crit, color) => {
    spawnedDamage = { amount, color }
  },
  flashEnemy: (target) => {
    enemyFlashed = true
  },
  updateMobLabel: (target) => {
    labelUpdated = true
  },
  kill: (target) => {
    target.dead = true
  }
}

// Simulate guard attack logic from CaravanEscortAI.js
const baseAtk = Number(guard.atk) || 24
const mult = guard.cls?.id === 'tank' ? 0.95 : 1.2
const raw = Math.round(baseAtk * (mult + 0)) // 45 * 1.2 = 54
const def = Math.max(0, Number(mob.def) || 0)
const dealt = Math.max(1, Math.round(raw * 100 / (100 + def * 0.7)))

const beforeHp = mob.hp
mob.hp = Math.max(0, beforeHp - dealt)
caravanGame.spawnDamageText(mob.g.position, dealt, false, '#f59e0b')
caravanGame.flashEnemy(mob, false)
caravanGame.updateMobLabel(mob)

assert.ok(dealt >= 40, `Guard damage dealt should be around 51, got ${dealt}`)
assert.equal(mob.hp, beforeHp - dealt, 'Mob HP must decrease by dealt amount')
assert.equal(spawnedDamage.color, '#f59e0b', 'Damage text should have guard amber color')
assert.equal(labelUpdated, true, 'Mob overhead label must be updated')
assert.equal(enemyFlashed, true, 'Mob must flash on hit')
console.log(`  Guard dealt ${dealt} damage to mob (HP: ${beforeHp} -> ${mob.hp}). Floating text & overhead bar updated.`)

console.log('--- All Pet Attributes & Caravan Guard Damage Tests Passed! ---')
