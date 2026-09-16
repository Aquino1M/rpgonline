import assert from 'node:assert/strict'
import { ShadowGame } from '../src/game/engine.js'

function player(id,name,inventory,gold){
  const outbox=[]
  return {
    id,name,outbox,
    state:{inventory,gold,trade:null},
    multiplayer:{connected:true,send:message=>outbox.push(message)},
    remotePlayers:new Map(),
    currentWorldId:()=> 'open', toast:()=>{}, saveGame:()=>{},
    addInventoryItem(item){if(this.state.inventory.length>=40)return false;this.state.inventory.unshift(item);return true},
    submitTradeOffer:ShadowGame.prototype.submitTradeOffer,
    confirmTrade:ShadowGame.prototype.confirmTrade,
    completeTrade:ShadowGame.prototype.completeTrade,
    cancelTrade:ShadowGame.prototype.cancelTrade,
    onMultiplayerEvent:ShadowGame.prototype.onMultiplayerEvent,
  }
}

const aquino=player('aquino','Aquino',[{id:'sword',name:'Espada',type:'weapon',qty:1}],100)
const mizuki=player('mizuki','Mizuki',[{id:'amulet',name:'Amuleto',type:'talisman',qty:1}],80)
aquino.remotePlayers.set(mizuki.id,{data:{name:mizuki.name}})
mizuki.remotePlayers.set(aquino.id,{data:{name:aquino.name}})

assert.equal(aquino.submitTradeOffer({partnerId:mizuki.id,itemIds:['sword'],gold:10}),false)
assert.equal(mizuki.submitTradeOffer({partnerId:aquino.id,itemIds:['amulet'],gold:7}),false)
assert.equal(aquino.outbox.length,0,'itens e ouro não podem viajar por Realtime')
assert.equal(mizuki.outbox.length,0,'itens e ouro não podem viajar por Realtime')
assert.deepEqual(aquino.state.inventory.map(item=>item.name),['Espada'])
assert.deepEqual(mizuki.state.inventory.map(item=>item.name),['Amuleto'])
assert.equal(aquino.state.gold,100)
assert.equal(mizuki.state.gold,80)
console.log('trade safety block: ok')
