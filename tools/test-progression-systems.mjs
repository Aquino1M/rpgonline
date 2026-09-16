import assert from 'node:assert/strict'
import { generateGuildMissions, makeMaterialDrop, normalizeSaveState, guildRankRequirement } from '../src/game/rpgSystems.js'
import { CITIES, NPC_DEFS } from '../src/game/config.js'
import { ShadowGame } from '../src/game/engine.js'
import { applyUniqueMobDrop, balancedAttackInput, earlyGuildPromotionStatus, petPowerProfile } from '../src/game/requestedGameplayFixes.js'

const rankE=generateGuildMissions({level:30,guildRankIndex:0},123)
const rankC=generateGuildMissions({level:30,guildRankIndex:2},123)
assert.ok(Math.max(...rankC.map(m=>m.reward.xp))>Math.max(...rankE.map(m=>m.reward.xp)))
assert.ok(rankC.some(m=>m.rankIndex>=2))
assert.match(makeMaterialDrop(20,'Slime Verde').name,/Gelatinoso/)
assert.match(makeMaterialDrop(20,'Golem de Xisto').name,/Pedra Rúnica/)

const earlyD=earlyGuildPromotionStatus({level:7,guildRankIndex:0,guildPoints:guildRankRequirement(1)})
assert.equal(earlyD.eligible,true)
assert.equal(earlyD.next.id,'D')
assert.ok(earlyD.bonusXp>0&&earlyD.bonusGold>0)
const tooEarly=earlyGuildPromotionStatus({level:6,guildRankIndex:0,guildPoints:guildRankRequirement(1)})
assert.equal(tooEarly.eligible,false)

const adjusted=balancedAttackInput(64,{def:8})
const effective=Math.round(adjusted*100/(100+8*5))
assert.ok(effective>=60&&effective<=64,`Displayed 64 DAMAGE should stay close to actual hit, got ${effective}`)

const slimeDrop=applyUniqueMobDrop({...makeMaterialDrop(12,'Slime Lúmen'),source:'Slime Lúmen',subtype:'monster-drop',level:12})
const golemDrop=applyUniqueMobDrop({...makeMaterialDrop(75,'Golem de Xisto'),source:'Golem de Xisto',subtype:'monster-drop',level:75})
assert.match(slimeDrop.name,/Núcleo Lúmen Viscoso/)
assert.match(golemDrop.name,/Núcleo de Xisto/)
assert.notEqual(slimeDrop.value,golemDrop.value)
assert.equal(petPowerProfile('Lagarto de Brasa').type,'fire')
assert.equal(petPowerProfile('Serpente de Maré').type,'water')
assert.equal(petPowerProfile('Sentinela Umbral').type,'shadow')

const saved=normalizeSaveState({inventory:[],pets:{owned:Array.from({length:7},(_,i)=>({id:`p${i}`})),activeId:'p4'}})
assert.equal(saved.pets.owned.length,5)
assert.equal(saved.pets.activeId,'p4')
const petKeeper=NPC_DEFS.find(n=>n.role==='pets')
assert.equal(petKeeper?.cityId,'aurora-city')
const nearestAuroraService=Math.min(...NPC_DEFS.filter(n=>n.cityId==='aurora-city'&&n.id!==petKeeper.id).map(n=>Math.hypot(n.x-petKeeper.x,n.z-petKeeper.z)))
assert.ok(nearestAuroraService>=12,'Pet keeper must have clear space from Aurora services')
const food={id:'shop-pet-food',name:'Ração de Domação',subtype:'pet_food',value:93,qty:1}
const buyer={state:{merchant:[food],gold:100,inventory:[]},inventoryCapacity:()=>40,toast:()=>{},saveGame:()=>{buyer.saved=true}}
assert.equal(ShadowGame.prototype.buyItem.call(buyer,food.id),true)
assert.equal(buyer.state.gold,7)
assert.equal(buyer.state.inventory[0].subtype,'pet_food')
assert.equal(buyer.saved,true)
buyer.state.pets={owned:[]}
assert.equal(ShadowGame.prototype.armPetTaming.call(buyer),true)
assert.equal(buyer.state.pets.tamingArmed,true)
const aurora=CITIES.find(city=>city.id==='aurora-city')
const cityHomes=[[-17,-10],[-17,11],[17,11],[18,-11],[-5,19],[6,-19]]
for(const id of ['aurora-townhall','aurora-traveler']){
  const service=aurora.services.find(entry=>entry.id===id)
  const nearestHouse=Math.min(...cityHomes.map(([x,z])=>Math.hypot(service.x-aurora.x-x,service.z-aurora.z-z)))
  assert.ok(nearestHouse>=7,`${id} must not overlap a city house`)
}
assert.ok(CITIES.every(city=>city.services.some(service=>service.role==='traveler')),'Every city must have a traveler')
const reputation=normalizeSaveState({inventory:[],cityReputation:{'aurora-city':140,'lumen-city':-4}}).cityReputation
assert.equal(reputation['aurora-city'],100)
assert.equal(reputation['lumen-city'],0)

console.log('guild contracts, early rank promotion, damage balance, unique drops, pet powers and city systems: ok')
