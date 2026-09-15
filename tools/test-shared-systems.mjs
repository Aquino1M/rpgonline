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
assert.deepEqual(alpha.activeGates.map(g=>[g.id,g.x,g.z,g.themeKey,g.dungeonLevel]), beta.activeGates.map(g=>[g.id,g.x,g.z,g.themeKey,g.dungeonLevel]), 'portais devem ser iguais para todos')
const closed=alpha.removeGate(alpha.activeGates[0].id,{broadcast:true})
beta.handleMultiplayerEvent({...sent.at(-1),from:'alpha'})
assert.equal(beta.activeGates.some(g=>g.id===closed.id), false, 'fechamento deve chegar ao outro jogador')

const awards=[], broadcasts=[]
const party=new MultiplayerClient({name:'Alpha',onEvent:event=>awards.push(event)})
party.playerId='alpha'; party.id='alpha'; party.connected=true; party.transport='supabase'; party.party={id:'party-1',leaderId:'alpha',members:['alpha','beta','gamma'],totalXP:0}; party._broadcast=(_, event)=>{broadcasts.push(event);return true}
party.send({type:'party_xp',amount:10})
assert.equal(awards.find(event=>event.type==='party_xp_award')?.amount,4)
assert.deepEqual(broadcasts.map(event=>event.amount),[3,3])

console.log('shared gates and party XP: ok')
