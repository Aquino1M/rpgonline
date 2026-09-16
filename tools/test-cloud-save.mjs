import assert from 'node:assert/strict'
import { ShadowGame } from '../src/game/engine.js'

let saved
const game={
  accountId:'account-1', localUpdatedAt:123, cloudSaveInFlight:null, cloudSaveQueued:false,
  state:{needsNickname:false,playerName:'Aquino',level:8,guildRank:'D',multiplayer:{}},
  profileSnapshot:()=>({multiplayerRoom:'asterra-global',state:{level:8}}),
  saveGame:()=>{}, persistCloudProfile:async payload=>{saved=payload;return {ok:true}}
}
assert.equal((await ShadowGame.prototype.saveCloudGame.call(game,{force:true})).ok,true)
assert.deepEqual(saved,{id:'account-1',name:'Aquino',game:{multiplayerRoom:'asterra-global',state:{level:8}},lastLobby:'asterra-global',level:8,guildRank:'D',updatedAt:123})
assert.equal(game.state.multiplayer.serverSave,true)
console.log('cloud profile checkpoint: ok')
