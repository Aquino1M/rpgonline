import assert from 'node:assert/strict'
import { MultiplayerClient } from '../src/game/supabaseMultiplayerV3.js'

const events = []
const client = new MultiplayerClient({ onEvent:event => events.push(event) })
const remote = { id:'remote-1', name:'Mizuki', x:4, y:0, z:8, level:3, hp:100, maxHp:100 }

client._presenceSync({ 'remote-1':[{ player:remote }] })
client._presenceSync({})
assert.equal(client.remoteState.has(remote.id), true, 'presence leave must keep the avatar during the grace period')
assert.equal(events.some(event => event.type === 'leave'), false, 'presence leave must not emit an immediate removal')

client._upsertRemote({ ...remote, x:5 })
client._pruneRemoteLeaves(Date.now() + 16_000)
assert.equal(client.remoteState.has(remote.id), true, 'a position broadcast must cancel a pending removal')

client._presenceSync({ 'remote-1':[{ player:remote }] })
client._presenceSync({})
client._pruneRemoteLeaves(Date.now() + 16_000)
assert.equal(client.remoteState.has(remote.id), false, 'a player absent for 15 seconds must be removed')
assert.equal(events.filter(event => event.type === 'leave').length, 1, 'the remote player must emit one final removal')
console.log('multiplayer presence grace: ok')
