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

function relay(from,to){
  for(const message of from.outbox.splice(0))to.onMultiplayerEvent({...message,from:from.id,fromName:from.name})
}

const aquino=player('aquino','Aquino',[{id:'sword',name:'Espada',type:'weapon',qty:1}],100)
const mizuki=player('mizuki','Mizuki',[{id:'amulet',name:'Amuleto',type:'talisman',qty:1}],80)
aquino.remotePlayers.set(mizuki.id,{data:{name:mizuki.name}})
mizuki.remotePlayers.set(aquino.id,{data:{name:aquino.name}})

assert.equal(aquino.submitTradeOffer({partnerId:mizuki.id,itemIds:['sword'],gold:10}),true)
assert.equal(aquino.state.inventory.length,1,'a proposta não transfere itens antes da confirmação')
relay(aquino,mizuki)
assert.equal(mizuki.state.trade.remoteOffer.items[0].name,'Espada')

assert.equal(mizuki.submitTradeOffer({partnerId:aquino.id,itemIds:['amulet'],gold:7}),true)
relay(mizuki,aquino)
assert.equal(aquino.state.trade.remoteOffer.items[0].name,'Amuleto')

assert.equal(aquino.confirmTrade(),true)
relay(aquino,mizuki)
assert.equal(mizuki.state.trade.remoteConfirmed,true)
assert.equal(mizuki.confirmTrade(),true)
relay(mizuki,aquino)

assert.equal(aquino.state.trade.status,'completed')
assert.equal(mizuki.state.trade.status,'completed')
assert.deepEqual(aquino.state.inventory.map(item=>item.name),['Amuleto'])
assert.deepEqual(mizuki.state.inventory.map(item=>item.name),['Espada'])
assert.equal(aquino.state.gold,97)
assert.equal(mizuki.state.gold,83)
console.log('trade confirmation protocol: ok')
