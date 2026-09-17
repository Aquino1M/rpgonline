// Pet combat V2: real target chasing/attacking plus overhead HP/level/name UI.
// Loaded after requestedGameplayFixes.js so it replaces the older instant-damage pet flow.

import * as THREE from 'three'
import { petPowerProfile } from './requestedGameplayFixes.js'

const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

function activePet(game) {
  return game?.activePet?.() || null
}

function ensurePetStats(pet) {
  if (!pet) return null
  pet.level = Math.max(1, Math.round(Number(pet.level) || 1))
  pet.maxHp = Math.max(1, Math.round(Number(pet.maxHp) || Number(pet.hp) || 30))
  pet.hp = Math.max(0, Math.min(pet.maxHp, Math.round(Number(pet.hp) || pet.maxHp)))
  pet.damage = Math.max(1, Math.round(Number(pet.damage) || 4))
  pet.xp = Math.max(0, Math.round(Number(pet.xp) || 0))
  pet.nextXp = Math.max(20, Math.round(Number(pet.nextXp) || pet.level * 85))
  pet.recoverUntil = Math.max(0, Number(pet.recoverUntil) || 0)

  const now = nowMs()
  if (!Number.isFinite(pet.nextAttackAt) || pet.nextAttackAt > now + 3000 || pet.nextAttackAt < now - 30000) {
    pet.nextAttackAt = 0
  }
  if (!Number.isFinite(pet.nextSpecialAt) || pet.nextSpecialAt > now + 12000 || pet.nextSpecialAt < now - 60000) {
    pet.nextSpecialAt = 0
  }
  if (!Number.isFinite(pet.nextHurtAt) || pet.nextHurtAt > now + 3000 || pet.nextHurtAt < now - 30000) {
    pet.nextHurtAt = 0
  }

  const power = petPowerProfile(pet.name)
  pet.specialName = power.name
  pet.specialType = power.type
  pet.specialMultiplier = power.multiplier
  pet.specialRadius = power.radius
  pet.specialColor = power.color
  return pet
}

export function petNameplateSnapshot(pet = {}) {
  const safe = ensurePetStats({ ...pet })
  return {
    name: String(safe?.name || 'Companheiro'),
    level: Math.max(1, Number(safe?.level) || 1),
    hp: Math.max(0, Number(safe?.hp) || 0),
    maxHp: Math.max(1, Number(safe?.maxHp) || 1),
    xp: Math.max(0, Number(safe?.xp) || 0),
    nextXp: Math.max(1, Number(safe?.nextXp) || 1),
  }
}

export function isPetCombatTarget(game, target) {
  if (!game || !target || target.dead) return false
  if (!target.g?.position) return false
  if (target.g.visible === false) return false
  if (target.hp !== undefined && Number(target.hp) <= 0) return false
  if (!game.player?.position) return false
  return target.g.position.distanceTo(game.player.position) <= 38
}

function createPetNameplate() {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 72
  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  })
  const sprite = new THREE.Sprite(material)
  sprite.name = 'PetCombatNameplate'
  sprite.position.set(0, 0.96, 0)
  sprite.scale.set(1.35, 0.38, 1)
  sprite.renderOrder = 80
  sprite.userData.petCanvas = canvas
  sprite.userData.petTexture = texture
  sprite.userData.signature = ''
  return sprite
}

function drawPetNameplate(sprite, pet) {
  if (!sprite || !pet) return
  const snap = petNameplateSnapshot(pet)
  const recovering = Number(pet.recoverUntil) > Date.now()
  const signature = `${snap.name}|${snap.level}|${Math.round(snap.hp)}|${Math.round(snap.maxHp)}|${snap.xp}|${snap.nextXp}|${recovering}`
  if (sprite.userData.signature === signature) return
  sprite.userData.signature = signature

  const canvas = sprite.userData.petCanvas
  const texture = sprite.userData.petTexture
  const ctx = canvas?.getContext?.('2d')
  if (!ctx || !texture) return

  const hpPct = Math.max(0, Math.min(1, snap.hp / Math.max(1, snap.maxHp)))
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  ctx.fillStyle = 'rgba(5, 12, 22, 0.78)'
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function') ctx.roundRect(4, 4, 248, 64, 10)
  else ctx.rect(4, 4, 248, 64)
  ctx.fill()
  ctx.strokeStyle = recovering ? '#64748b' : '#38bdf8'
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.font = '900 16px Inter, Arial'
  ctx.fillStyle = recovering ? '#94a3b8' : '#ffffff'
  ctx.fillText(`🐾 ${snap.name} • Nv.${snap.level}`, 128, 26)

  ctx.fillStyle = '#0f172a'
  ctx.fillRect(20, 36, 216, 12)
  ctx.fillStyle = recovering ? '#64748b' : hpPct > 0.55 ? '#22c55e' : hpPct > 0.25 ? '#f59e0b' : '#ef4444'
  ctx.fillRect(20, 36, 216 * hpPct, 12)
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'
  ctx.lineWidth = 1
  ctx.strokeRect(20, 36, 216, 12)

  ctx.font = '800 11px Inter, Arial'
  ctx.fillStyle = '#e2e8f0'
  ctx.fillText(recovering ? 'RECUPERANDO...' : `HP ${Math.ceil(snap.hp)}/${Math.ceil(snap.maxHp)}`, 128, 60)

  texture.needsUpdate = true
}

export function findBestPetTarget(game) {
  if (!game) return null
  if (isPetCombatTarget(game, game.petTarget)) return game.petTarget

  const st = game.state?.target
  if (st && !st.dead) {
    const fromEnemies = (game.enemies || []).find(e => isPetCombatTarget(game, e) && (e === st || e.name === st.name || (e.boss && st.boss)))
    if (fromEnemies) return fromEnemies
  }

  const pPos = game.player?.position
  if (!pPos) return null
  const candidates = (game.enemies || []).filter(e => isPetCombatTarget(game, e) && e.g.position.distanceTo(pPos) <= 24)
  if (candidates.length) {
    candidates.sort((a, b) => a.g.position.distanceTo(pPos) - b.g.position.distanceTo(pPos))
    return candidates[0]
  }
  return null
}

function ensurePetNameplate(game, pet) {
  if (!game?.petVisual || !pet) return null
  let label = game.petNameplate
  if (!label || label.parent !== game.petVisual) {
    label = createPetNameplate()
    if (!label) return null
    game.petVisual.add(label)
    game.petNameplate = label
  }
  drawPetNameplate(label, pet)
  return label
}

function cleanupDetachedNameplate(game) {
  const label = game?.petNameplate
  if (!label) return
  if (label.parent) return
  label.userData?.petTexture?.dispose?.()
  label.material?.dispose?.()
  game.petNameplate = null
}

function followPoint(game) {
  const heading = Number(game?.player?.rotation?.y) || 0
  const side = new THREE.Vector3(Math.cos(heading), 0, -Math.sin(heading)).multiplyScalar(1.35)
  const back = new THREE.Vector3(-Math.sin(heading), 0, -Math.cos(heading)).multiplyScalar(1.15)
  return game.player.position.clone().add(side).add(back)
}

function moveVisualToward(game, point, speed, dt) {
  const visual = game?.petVisual
  if (!visual || !point) return 0
  const dx = point.x - visual.position.x
  const dz = point.z - visual.position.z
  const distance = Math.hypot(dx, dz)
  if (distance > 0.03) {
    const step = Math.min(distance, Math.max(0, speed * dt))
    visual.position.x += (dx / distance) * step
    visual.position.z += (dz / distance) * step
    visual.rotation.y = Math.atan2(dx, dz)
  }
  return distance
}

function gainPetAttackXp(game, pet, target) {
  const gain = Math.max(1, Math.round((Number(target?.level) || 1) * 0.7))
  pet.xp += gain
  let leveled = false
  while (pet.xp >= pet.nextXp) {
    pet.xp -= pet.nextXp
    pet.level += 1
    pet.nextXp = Math.max(20, Math.round(pet.nextXp * 1.28))
    pet.maxHp += Math.max(8, Math.round((Number(target?.level) || pet.level) * 2))
    pet.hp = pet.maxHp
    pet.damage += Math.max(2, Math.round((Number(target?.level) || pet.level) * 0.28))
    leveled = true
  }
  if (leveled) {
    game.toast?.(`🐾 ${pet.name} subiu para Nv.${pet.level}!`)
    game.saveGame?.()
    game.saveCloudGame?.()
  }
}

function pulsePetAttack(game, color = 0x60a5fa) {
  const visual = game?.petVisual
  if (!visual) return

  const pet = activePet(game)
  const stage = Math.max(0, Number(pet?.evolutionStage) || 0)
  // Growth bounded strictly to 2%-5% per evolution stage (3.5%)
  const baseScale = 1 + Math.min(stage, 10) * 0.035
  visual.userData.baseScale = baseScale

  if (visual.userData.pulseTimer) {
    window.clearTimeout(visual.userData.pulseTimer)
    visual.userData.pulseTimer = null
  }

  // Micro hit pulse (4%) that strictly snaps back to baseScale
  visual.scale.setScalar(baseScale * 1.04)

  const body = visual.children?.find?.(child => child?.material?.emissive)
  const oldEmissive = body?.material?.emissive?.clone?.()
  const oldIntensity = body?.material?.emissiveIntensity
  if (body?.material?.emissive) {
    body.material.emissive.setHex(color)
    body.material.emissiveIntensity = 1.15
  }
  visual.userData.pulseTimer = window.setTimeout(() => {
    if (visual) {
      visual.scale.setScalar(baseScale)
      visual.userData.pulseTimer = null
    }
    if (body?.material?.emissive && oldEmissive) {
      body.material.emissive.copy(oldEmissive)
      body.material.emissiveIntensity = oldIntensity ?? 0
    }
  }, 110)
}

function doPetSpecial(game, pet, target, profile, now) {
  if (!target || target.dead || Number(target.hp) <= 0) return
  pet.nextSpecialAt = now + 5200
  const specialDamage = Math.max(1, Math.round(pet.damage * profile.multiplier))
  const center = target.g?.position
  const enemies = profile.radius > 2.5 && center
    ? (game.enemies || []).filter(enemy => isPetCombatTarget(game, enemy) && enemy.g.position.distanceTo(center) <= profile.radius)
    : [target]
  const targets = enemies.length ? enemies : [target]
  const seen = new Set()
  for (const enemy of targets) {
    if (!enemy || enemy.dead || seen.has(enemy)) continue
    seen.add(enemy)
    const beforeHp = Number(enemy.hp)
    game.damageEnemy?.(enemy, specialDamage, { knockback: 0.22, fromPet: true })
    if (!enemy.dead && Number.isFinite(beforeHp) && Number(enemy.hp) >= beforeHp) {
      const def = Math.max(0, Number(enemy.def) || 0)
      const dealt = Math.max(1, Math.round(specialDamage * 100 / (100 + def * 0.6)))
      enemy.hp = Math.max(0, beforeHp - dealt)
      game.spawnDamageText?.(enemy.g?.position || enemy.position, dealt, true, '#38bdf8')
      game.flashEnemy?.(enemy, true)
      game.updateMobLabel?.(enemy)
      if (enemy.hp <= 0) game.kill?.(enemy)
    }
  }
  pulsePetAttack(game, profile.color)
  game.toast?.(`🐾 ${pet.name}: ${profile.name}!`)
}

function performPetAttack(game, pet, target, now) {
  if (!isPetCombatTarget(game, target)) return false
  if ((Number(pet.nextAttackAt) || 0) > now) {
    if ((Number(pet.nextAttackAt) || 0) > now + 3000) pet.nextAttackAt = 0
    else return false
  }
  pet.nextAttackAt = now + 920

  const damage = Math.max(1, Math.round(pet.damage * (0.9 + Math.random() * 0.2)))
  const hpBefore = Number(target.hp)
  const hit = game.damageEnemy?.(target, damage, { knockback: 0.12, fromPet: true })

  // Guaranteed damage fallback: if damageEnemy was swallowed or target hp was unchanged
  if (target && !target.dead && Number.isFinite(hpBefore) && Number(target.hp) >= hpBefore) {
    const def = Math.max(0, Number(target.def) || 0)
    const dealt = Math.max(1, Math.round(damage * 100 / (100 + def * 0.6)))
    target.hp = Math.max(0, hpBefore - dealt)
    game.spawnDamageText?.(target.g?.position || target.position, dealt, false, '#38bdf8')
    game.flashEnemy?.(target, false)
    game.updateMobLabel?.(target)
    if (game.state?.target && (game.state.target.name === target.name || game.state.target === target)) {
      game.state.target.hp = target.hp
    }
    if (target.hp <= 0) game.kill?.(target)
  }

  pulsePetAttack(game, pet.specialColor || 0x60a5fa)
  gainPetAttackXp(game, pet, target)

  if (!target.dead && Number(target.hp) > 0) {
    if ((Number(pet.nextSpecialAt) || 0) > now + 12000) pet.nextSpecialAt = 0
    if ((Number(pet.nextSpecialAt) || 0) <= now) {
      doPetSpecial(game, pet, target, petPowerProfile(pet.name), now)
    }
  }
  return true
}

function recoverPetIfReady(game, pet) {
  if (!pet || !pet.recoverUntil) return false
  if (pet.recoverUntil > Date.now()) return false
  pet.recoverUntil = 0
  pet.hp = pet.maxHp
  pet.nextHurtAt = 0
  pet.nextAttackAt = 0
  game.petTarget = null
  game.petVisualKey = ''
  game.toast?.(`🐾 ${pet.name} se recuperou e voltou com a vida cheia!`)
  game.saveGame?.()
  return true
}

function damagePetFromTarget(game, pet, target, now) {
  if (!target || !pet || (Number(pet.nextHurtAt) || 0) > now) return
  pet.nextHurtAt = now + 1500
  const enemyAttack = Math.max(6, Number(target.atk) || Number(target.damage) || 8)
  const received = Math.max(2, Math.round(enemyAttack * 0.32))
  pet.hp = Math.max(0, pet.hp - received)
  drawPetNameplate(game.petNameplate, pet)

  if (pet.hp <= 0) {
    pet.recoverUntil = Date.now() + 45000
    game.petTarget = null
    game.petVisualKey = ''
    game.toast?.(`🐾 ${pet.name} caiu! Ficará se recuperando por 45s.`)
    game.saveGame?.()
    game.syncPetVisual?.()
  }
}

export function installPetCombatV2(game) {
  if (!game || game.__petCombatV2Installed) return false
  game.__petCombatV2Installed = true

  const oldSyncPetVisual = game.syncPetVisual?.bind(game)
  if (oldSyncPetVisual) {
    game.syncPetVisual = () => {
      const previous = game.petVisual
      const result = oldSyncPetVisual()
      if (previous && previous !== game.petVisual && game.petNameplate?.parent === previous) {
        game.petNameplate = null
      }
      const pet = ensurePetStats(activePet(game))
      if (pet && game.petVisual && pet.recoverUntil <= Date.now()) ensurePetNameplate(game, pet)
      else cleanupDetachedNameplate(game)
      return result
    }
  }

  // Player hits now only COMMAND the pet. The actual pet hit happens when it reaches melee range.
  game.petAttackTarget = enemy => {
    const pet = ensurePetStats(activePet(game))
    if (!pet || pet.recoverUntil > Date.now() || !isPetCombatTarget(game, enemy)) return false
    game.petTarget = enemy
    pet.lastCommandAt = Date.now()
    game.syncPetVisual?.()
    return true
  }

  game.updatePets = dt => {
    const pet = ensurePetStats(activePet(game))
    if (!pet) {
      game.petTarget = null
      game.syncPetVisual?.()
      return
    }

    recoverPetIfReady(game, pet)
    game.syncPetVisual?.()
    if (!game.petVisual || pet.recoverUntil > Date.now()) return

    const now = nowMs()
    const visual = game.petVisual
    const home = followPoint(game)

    // Prevent a newly created pet mesh from travelling across the whole map from world origin.
    if (visual.position.distanceTo(game.player.position) > 28) {
      visual.position.copy(home)
      visual.position.y = 0.55
    }

    let target = findBestPetTarget(game)
    game.petTarget = target

    if (target && target.g?.position) {
      const targetPos = target.g.position
      const distance = Math.hypot(targetPos.x - visual.position.x, targetPos.z - visual.position.z)
      const targetRadius = Number(target.radius) || 1.1
      const attackRange = Math.max(2.8, targetRadius + 1.5)

      if (distance > attackRange) {
        moveVisualToward(game, targetPos, 11.2, dt)
      } else {
        const dx = targetPos.x - visual.position.x
        const dz = targetPos.z - visual.position.z
        if (Math.hypot(dx, dz) > 0.01) visual.rotation.y = Math.atan2(dx, dz)
        performPetAttack(game, pet, target, now)
        if (!target.dead && Number(target.hp) > 0) damagePetFromTarget(game, pet, target, now)
      }

      if (target.dead || Number(target.hp) <= 0) {
        game.petTarget = findBestPetTarget(game)
      }
    } else {
      moveVisualToward(game, home, 7.6, dt)
      pet.hp = Math.min(pet.maxHp, pet.hp + pet.maxHp * Math.max(0, dt) * 0.04)
    }

    const stage = Math.max(0, Number(pet.evolutionStage) || 0)
    const baseScale = 1 + Math.min(stage, 10) * 0.035
    visual.userData.baseScale = baseScale
    if (!visual.userData?.pulseTimer) visual.scale.setScalar(baseScale)

    visual.position.y = 0.55 + Math.sin(now * 0.004) * 0.08
    ensurePetNameplate(game, pet)
  }

  for (const pet of game.state?.pets?.owned || []) ensurePetStats(pet)
  game.petVisualKey = ''
  game.syncPetVisual?.()
  game.saveGame?.()
  return true
}

function installWhenReady() {
  if (typeof window === 'undefined') return
  const tryInstall = () => {
    const game = window.game
    if (!game) return false
    // requestedGameplayFixes also patches pet methods. Install this one a moment later so V2 wins.
    window.setTimeout(() => installPetCombatV2(game), 180)
    return true
  }
  if (tryInstall()) return
  const timer = window.setInterval(() => {
    if (!tryInstall()) return
    window.clearInterval(timer)
  }, 100)
  window.setTimeout(() => window.clearInterval(timer), 60000)
}

installWhenReady()
