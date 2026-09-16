import assert from 'node:assert/strict'
import { ShadowGame } from '../src/game/engine.js'

const game = { state:{ hp:100, stamina:20, blocking:true }, enterCombat:()=>{}, toast:()=>{} }
assert.equal(ShadowGame.prototype.damagePlayer.call(game, 100), 45)
assert.equal(game.state.stamina, 12)
assert.equal(ShadowGame.prototype.damagePlayer.call(game, 100), 45)
assert.equal(game.state.stamina, 4)
assert.equal(ShadowGame.prototype.damagePlayer.call(game, 100), 100)

console.log('manual combat defense: ok')
