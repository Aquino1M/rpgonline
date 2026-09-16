import assert from 'node:assert/strict'
import {
  applyUniqueMobDrop,
  balancedAttackInput,
  earlyGuildPromotionStatus,
  petPowerProfile,
} from '../src/game/requestedGameplayFixes.js'
import { CLASSES_LIST } from '../src/game/classesData.js'

const javali = applyUniqueMobDrop({ subtype:'monster-drop', source:'Javali de Musgo', level:8, value:1 })
const slime = applyUniqueMobDrop({ subtype:'monster-drop', source:'Slime Lúmen', level:8, value:1 })
assert.notEqual(javali.name, slime.name)
assert.notEqual(javali.value, slime.value)
assert.ok(javali.value > 1 && slime.value > 1)

const early = earlyGuildPromotionStatus({ guildRankIndex:0, level:7, guildPoints:999 })
assert.equal(early.eligible, true)
assert.equal(early.next.id, 'D')
assert.ok(early.bonusXp > 0 && early.bonusGold > 0)
assert.equal(earlyGuildPromotionStatus({ guildRankIndex:0, level:6, guildPoints:999 }).eligible, false)

const adjusted = balancedAttackInput(64, { def:8 })
const finalDamage = Math.round(adjusted * 100 / (100 + 8 * 5))
assert.ok(finalDamage >= 60 && finalDamage <= 63, `expected ~62 final damage, got ${finalDamage}`)

assert.notEqual(petPowerProfile('Lagarto de Brasa').name, petPowerProfile('Fera do Vazio').name)
assert.ok(petPowerProfile('Lagarto de Brasa').multiplier > 1)

assert.ok(CLASSES_LIST.length > 0)
for (const cls of CLASSES_LIST) {
  assert.ok(cls.skill?.name, `${cls.id} must have its own active skill name`)
  assert.ok(cls.skill?.type, `${cls.id} must have an active skill type`)
}

console.log('requested gameplay fixes: OK')
