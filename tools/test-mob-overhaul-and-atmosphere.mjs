// test-mob-overhaul-and-atmosphere.mjs
import { ZONES } from '../src/game/config.js'
import { classifyMobArchetype, createCustomMobModel } from '../src/game/mobVisualOverhaul.js'

console.log('Testing mob archetype classification and procedural model generation...')

let totalMobs = 0
for (const zone of ZONES) {
  const allInZone = [...(zone.mobs || [])]
  if (zone.boss) allInZone.push(zone.boss)

  for (const mobName of allInZone) {
    totalMobs++
    const archetype = classifyMobArchetype(mobName, zone.id)
    if (!archetype) {
      throw new Error(`Failed to classify archetype for ${mobName} in ${zone.id}`)
    }

    const isBoss = mobName === zone.boss
    const model = createCustomMobModel(mobName, 1.0, zone.id, isBoss)
    if (!model || !model.group || !model.type) {
      throw new Error(`Failed to create 3D model for ${mobName} (${archetype})`)
    }

    console.log(`✓ [${zone.name}] ${mobName} -> Archetype: ${archetype} (type: ${model.type}, legs: ${model.legs?.length || 0})`)
  }
}

console.log(`All ${totalMobs} mobs and bosses successfully verified with rich procedural models!`)
