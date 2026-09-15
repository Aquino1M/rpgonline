import assert from 'node:assert/strict'
import * as THREE from 'three'
import { GateManager } from '../src/game/dungeons/GateManager.js'
import { MultiplayerClient } from '../src/game/supabaseMultiplayerV3.js'

const canvasContext = new Proxy({}, { get: () => () => {} })
globalThis.document = { createElement: () => ({ width:0, height:0, getContext: () => canvasContext }) }

function gateGame(id, sent) {
  return {
    worldRoot:new THREE.Group(), state:{}, zoneAt:()=>({name:'Ermos de Asterra'}), clearWorldResourcesAround:()=>{},
    multiplayer:{playerId:id,send:event=>sent.push(event)}
  }
}

const sent=[]
const alpha=new GateManager(gateGame('alpha',sent)), beta=new GateManager(gateGame('beta',[]))
alpha.init(); beta.init()
alpha.persistClosedGate = async () => []
assert.deepEqual(alpha.activeGates.map(g=>[g.id,g.x,g.z,g.themeKey,g.dungeonLevel]), beta.activeGates.map(g=>[g.id,g.x,g.z,g.themeKey,g.dungeonLevel]), 'portais devem ser iguais para todos')
const closed=alpha.removeGate(alpha.activeGates[0].id,{broadcast:true})
beta.handleMultiplayerEvent({...sent.at(-1),from:'alpha'})
assert.equal(beta.activeGates.some(g=>g.id===closed.id), false, 'fechamento deve chegar ao outro jogador')

const awards=[], broadcasts=[]
const party=new MultiplayerClient({name:'Alpha',onEvent:event=>awards.push(event)})
party.playerId='alpha'; party.id='alpha'; party.connected=true; party.transport='supabase'; party.party={id:'party-1',leaderId:'alpha',members:['alpha','beta','gamma'],totalXP:0}; party._broadcast=(_, event)=>{broadcasts.push(event);return true}
party.remoteState.set('beta',{world:'open'}); party.remoteState.set('gamma',{world:'open'})
party.send({type:'party_xp',amount:10})
assert.equal(awards.find(event=>event.type==='party_xp_award')?.amount,4)
assert.deepEqual(broadcasts.map(event=>event.amount),[3,3])

const localAwards=[], sameWorldBroadcasts=[]
const sameWorldParty=new MultiplayerClient({name:'Alpha',onEvent:event=>localAwards.push(event)})
sameWorldParty.playerId='alpha'; sameWorldParty.id='alpha'; sameWorldParty.connected=true; sameWorldParty.transport='supabase'; sameWorldParty.lastState={world:'open'}; sameWorldParty.party={id:'party-2',leaderId:'alpha',members:['alpha','beta','gamma'],totalXP:0}; sameWorldParty.remoteState.set('beta',{world:'open'}); sameWorldParty.remoteState.set('gamma',{world:'dungeon:other'}); sameWorldParty._broadcast=(_, event)=>{sameWorldBroadcasts.push(event);return true}
sameWorldParty.send({type:'party_xp',amount:9,world:'open'})
assert.equal(localAwards.find(event=>event.type==='party_xp_award')?.amount,5)
assert.deepEqual(sameWorldBroadcasts.map(event=>event.amount),[4])

console.log('shared gates and party XP: ok')
