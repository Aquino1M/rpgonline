import assert from 'node:assert/strict'
import { generateGuildMissions, makeMaterialDrop, normalizeSaveState } from '../src/game/rpgSystems.js'

const rankE=generateGuildMissions({level:30,guildRankIndex:0},123)
const rankC=generateGuildMissions({level:30,guildRankIndex:2},123)
assert.ok(Math.max(...rankC.map(m=>m.reward.xp))>Math.max(...rankE.map(m=>m.reward.xp)))
assert.ok(rankC.some(m=>m.rankIndex>=2))
assert.match(makeMaterialDrop(20,'Slime Verde').name,/Gelatinoso/)
assert.match(makeMaterialDrop(20,'Golem de Xisto').name,/Pedra Rúnica/)
const saved=normalizeSaveState({inventory:[],pets:{owned:Array.from({length:7},(_,i)=>({id:`p${i}`})),activeId:'p4'}})
assert.equal(saved.pets.owned.length,5)
assert.equal(saved.pets.activeId,'p4')

console.log('guild contracts, mob drops and pet saves: ok')
