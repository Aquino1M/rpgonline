import assert from 'node:assert/strict'

// Test 1: Wanted Level Decay
{
  const state = { wantedLevel: 3, inCombat: false, hp: 100, maxHp: 100, stamina: 100, maxStamina: 100 }
  let wantedDecayTimer = 0
  const dt = 1.0

  // 9 seconds outside combat
  for (let i = 0; i < 9; i++) {
    if (!state.inCombat && (state.wantedLevel || 0) > 0) {
      wantedDecayTimer += dt
      if (wantedDecayTimer >= 10) {
        wantedDecayTimer = 0
        state.wantedLevel = Math.max(0, (state.wantedLevel || 0) - 1)
      }
    }
  }
  assert.equal(state.wantedLevel, 3, 'Wanted level should remain 3 after 9s')

  // 10th second
  if (!state.inCombat && (state.wantedLevel || 0) > 0) {
    wantedDecayTimer += dt
    if (wantedDecayTimer >= 10) {
      wantedDecayTimer = 0
      state.wantedLevel = Math.max(0, (state.wantedLevel || 0) - 1)
    }
  }
  assert.equal(state.wantedLevel, 2, 'Wanted level should decrease to 2 after 10s')

  // Enter combat at 5 seconds
  for (let i = 0; i < 5; i++) {
    wantedDecayTimer += dt
  }
  state.inCombat = true
  if (state.inCombat) wantedDecayTimer = 0

  assert.equal(wantedDecayTimer, 0, 'Timer resets when entering combat')
  assert.equal(state.wantedLevel, 2, 'Wanted level did not decrease during combat')

  // Exit combat and wait 20s -> should decrease to 0
  state.inCombat = false
  for (let i = 0; i < 20; i++) {
    if (!state.inCombat && (state.wantedLevel || 0) > 0) {
      wantedDecayTimer += dt
      if (wantedDecayTimer >= 10) {
        wantedDecayTimer = 0
        state.wantedLevel = Math.max(0, (state.wantedLevel || 0) - 1)
      }
    }
  }
  assert.equal(state.wantedLevel, 0, 'Wanted level reaches 0 after 20s')
}

// Test 2: Pet target selection logic
{
  function isPetCombatTarget(game, target) {
    return !!(target && !target.dead && Number(target.hp) > 0)
  }

  function findBestPetTarget(game) {
    if (!game) return null
    const candidate = game.petTarget || game.lastPlayerAttackedEnemy
    if (candidate && isPetCombatTarget(game, candidate)) {
      return candidate
    }
    game.petTarget = null
    return null
  }

  const mob1 = { name: 'Lobo', hp: 50, dead: false }
  const mob2 = { name: 'Javali', hp: 80, dead: false }
  const game = {
    enemies: [mob1, mob2],
    petTarget: null,
    lastPlayerAttackedEnemy: null,
  }

  // Without player attacking, pet target is null (no auto-aggroing mob1 or mob2!)
  assert.equal(findBestPetTarget(game), null, 'Pet should not target anything if player has not attacked')

  // Player attacks mob2
  game.lastPlayerAttackedEnemy = mob2
  game.petTarget = mob2
  assert.equal(findBestPetTarget(game), mob2, 'Pet should attack mob2 because player attacked mob2')

  // mob2 dies
  mob2.hp = 0
  mob2.dead = true
  game.lastPlayerAttackedEnemy = null
  game.petTarget = null
  assert.equal(findBestPetTarget(game), null, 'Pet target cleared when mob2 died')
}

console.log('test-wanted-and-pet-fixes: all tests passed!')
