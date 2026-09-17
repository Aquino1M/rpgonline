import assert from 'node:assert/strict'
import {
  REROLL_GOLD_COST,
  TELEPORT_TOTEM_BASE_COST,
  TELEPORT_TOTEM_SUBTYPE,
  durabilityAfterUpgrade,
  nearestCityForPosition,
  makeTeleportTotemItem,
} from '../src/game/awakeningEconomyNpcAuditV6.js'

assert.equal(REROLL_GOLD_COST, 6000, 'redespertar precisa custar 6000 de ouro')
assert.equal(TELEPORT_TOTEM_BASE_COST, 4000, 'totem precisa custar 4000 de ouro antes de descontos')
assert.equal(TELEPORT_TOTEM_SUBTYPE, 'town_teleport_totem')

const durability = durabilityAfterUpgrade(100, 60)
assert.deepEqual(durability, { maxDurability:108, durability:68, increase:8 }, 'upgrade precisa aumentar durabilidade maxima e atual')

const damaged = durabilityAfterUpgrade(200, 10)
assert.equal(damaged.maxDurability, 216)
assert.equal(damaged.durability, 26)
assert.equal(damaged.increase, 16)

assert.equal(nearestCityForPosition(0, 0)?.id, 'aurora-city', 'origem precisa resolver Aurora como cidade mais proxima')

const game = {
  currentMerchantCityId:'aurora-city',
  currentMerchantZoneId:'aurora',
  state:{ cityReputation:{'aurora-city':0} },
}
const fullPrice = makeTeleportTotemItem(game, 'aurora-city')
assert.equal(fullPrice.value, 4000)
assert.equal(fullPrice.qty, 1)
assert.equal(fullPrice.subtype, TELEPORT_TOTEM_SUBTYPE)

game.state.cityReputation['aurora-city'] = 100
const discounted = makeTeleportTotemItem(game, 'aurora-city')
assert.equal(discounted.value, 3000, 'reputacao 100 precisa aplicar 25% de desconto')

console.log('awakening/economy/NPC audit V6 tests ok')
