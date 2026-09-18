import assert from 'node:assert'

// Test comparison logic identical to src/App.jsx
function slotForItem(item) {
  if (!item) return null
  if (item.type === 'weapon' || item.type === 'tool') return 'weapon'
  if (item.type === 'armor') return 'armor'
  if (item.type === 'boots') return 'boots'
  if (item.type === 'talisman') return 'talisman'
  return null
}

function compareItemWithEquipped(item, equipment) {
  const slot = slotForItem(item)
  if (!slot || !equipment) return null
  const equipped = equipment[slot]
  if (!equipped) return { status: 'empty', diffText: '+Novo item', diffScore: 1 }

  const itemAtk = (item.stats?.attack || 0) + (item.attack || 0)
  const itemDef = (item.stats?.defense || 0) + (item.defense || 0)
  const itemHp = (item.stats?.hp || 0) + (item.hp || 0)
  const eqAtk = (equipped.stats?.attack || 0) + (equipped.attack || 0)
  const eqDef = (equipped.stats?.defense || 0) + (equipped.defense || 0)
  const eqHp = (equipped.stats?.hp || 0) + (equipped.hp || 0)

  const diffAtk = itemAtk - eqAtk
  const diffDef = itemDef - eqDef
  const diffHp = itemHp - eqHp
  const diffScore = diffAtk * 1.5 + diffDef * 1.2 + diffHp * 0.2

  if (diffScore < -0.01) {
    const mainDiff = diffAtk < 0 ? `${diffAtk} ATK` : diffDef < 0 ? `${diffDef} DEF` : `${diffHp} HP`
    return { status: 'inferior', diffText: `▼ Inferior (${mainDiff})`, diffScore, diffAtk, diffDef, diffHp, equipped }
  }
  if (diffScore > 0.01) {
    const mainDiff = diffAtk > 0 ? `+${diffAtk} ATK` : diffDef > 0 ? `+${diffDef} DEF` : `+${diffHp} HP`
    return { status: 'superior', diffText: `▲ Superior (${mainDiff})`, diffScore, diffAtk, diffDef, diffHp, equipped }
  }
  return { status: 'equal', diffText: '● Equivalente', diffScore: 0, diffAtk: 0, diffDef: 0, diffHp: 0, equipped }
}

// 1. Comparison test cases
const currentGear = {
  weapon: { name: 'Iron Sword', type: 'weapon', stats: { attack: 20 } },
  armor: { name: 'Steel Plate', type: 'armor', stats: { defense: 30, hp: 50 } }
}

const rustySword = { name: 'Rusty Dagger', type: 'weapon', stats: { attack: 8 } }
const legendarySword = { name: 'Excalibur', type: 'weapon', stats: { attack: 55 } }
const sameSword = { name: 'Training Sword', type: 'weapon', stats: { attack: 20 } }
const boots = { name: 'Leather Boots', type: 'boots', stats: { defense: 5 } }

const compRusty = compareItemWithEquipped(rustySword, currentGear)
assert.strictEqual(compRusty.status, 'inferior')
assert(compRusty.diffText.includes('▼ Inferior (-12 ATK)'), 'Shows negative diff')

const compLegendary = compareItemWithEquipped(legendarySword, currentGear)
assert.strictEqual(compLegendary.status, 'superior')
assert(compLegendary.diffText.includes('▲ Superior (+35 ATK)'), 'Shows positive diff')

const compSame = compareItemWithEquipped(sameSword, currentGear)
assert.strictEqual(compSame.status, 'equal')

const compBoots = compareItemWithEquipped(boots, currentGear)
assert.strictEqual(compBoots.status, 'empty')

// 2. Class Aura Upgrade formula:
// Rank 1 (base): 0 upgrades -> 0 circles
// Rank 2: 1 upgrade -> 1 circle
// Rank 3: 2 upgrades -> 2 circles
// Rank 5: 4 upgrades -> 4 circles
function getGroundCirclesCount(classRank) {
  const currentRank = Math.max(1, Number(classRank) || 1)
  return Math.max(0, currentRank - 1)
}

assert.strictEqual(getGroundCirclesCount(1), 0)
assert.strictEqual(getGroundCirclesCount(2), 1)
assert.strictEqual(getGroundCirclesCount(3), 2)
assert.strictEqual(getGroundCirclesCount(5), 4)

console.log('test-inventory-comparison-and-class-aura: ALL TESTS PASSED!')
