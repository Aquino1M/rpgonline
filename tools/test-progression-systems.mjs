import assert from 'node:assert/strict'
import { generateGuildMissions, makeMaterialDrop, normalizeSaveState } from '../src/game/rpgSystems.js'
import { NPC_DEFS } from '../src/game/config.js'

const rankE=generateGuildMissions({level:30,guildRankIndex:0},123)
const rankC=generateGuildMissions({level:30,guildRankIndex:2},123)
assert.ok(Math.max(...rankC.map(m=>m.reward.xp))>Math.max(...rankE.map(m=>m.reward.xp)))
assert.ok(rankC.some(m=>m.rankIndex>=2))
assert.match(makeMaterialDrop(20,'Slime Verde').name,/Gelatinoso/)
assert.match(makeMaterialDrop(20,'Golem de Xisto').name,/Pedra Rúnica/)
const saved=normalizeSaveState({inventory:[],pets:{owned:Array.from({length:7},(_,i)=>({id:`p${i}`})),activeId:'p4'}})
assert.equal(saved.pets.owned.length,5)
assert.equal(saved.pets.activeId,'p4')
const petKeeper=NPC_DEFS.find(n=>n.role==='pets')
assert.equal(petKeeper?.cityId,'aurora-city')
const nearestAuroraService=Math.min(...NPC_DEFS.filter(n=>n.cityId==='aurora-city'&&n.id!==petKeeper.id).map(n=>Math.hypot(n.x-petKeeper.x,n.z-petKeeper.z)))
assert.ok(nearestAuroraService>=12,'Pet keeper must have clear space from Aurora services')
const reputation=normalizeSaveState({inventory:[],cityReputation:{'aurora-city':140,'lumen-city':-4}}).cityReputation
assert.equal(reputation['aurora-city'],100)
assert.equal(reputation['lumen-city'],0)

console.log('guild contracts, mob drops, pet NPC and city reputation: ok')
