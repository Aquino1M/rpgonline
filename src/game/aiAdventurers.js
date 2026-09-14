// Sistema de Aventureiros IA Autônomos V0.8.0
// 10 Aventureiros que patrulham cidades, enfrentam monstros, sobem de nível e renascem após 65s

export const AI_ADVENTURERS_CONFIG = [
  {
    id: 'ai_kenneth',
    name: 'Sir Kenneth',
    city: 'Vila Aurora',
    zoneId: 'aurora',
    spawnX: 18,
    spawnZ: 14,
    level: 5,
    rank: 'Rank E',
    classTitle: 'Espadachim Aprendiz',
    color: 0x60a5fa,
    weaponType: 'sword'
  },
  {
    id: 'ai_jax',
    name: 'Jax o Andarilho',
    city: 'Vila Aurora',
    zoneId: 'aurora',
    spawnX: -14,
    spawnZ: 22,
    level: 8,
    rank: 'Rank E',
    classTitle: 'Ladino Explorador',
    color: 0x94a3b8,
    weaponType: 'dagger'
  },
  {
    id: 'ai_valeria',
    name: 'Valéria Lâmina-do-Vento',
    city: 'Posto da Pradaria',
    zoneId: 'meadow',
    spawnX: 165,
    spawnZ: 32,
    level: 16,
    rank: 'Rank D',
    classTitle: 'Arqueira da Pradaria',
    color: 0x4ade80,
    weaponType: 'bow'
  },
  {
    id: 'ai_mirael',
    name: 'Mirael a Caçadora',
    city: 'Posto da Pradaria',
    zoneId: 'meadow',
    spawnX: 142,
    spawnZ: 10,
    level: 24,
    rank: 'Rank D',
    classTitle: 'Patrulheira dos Ermos',
    color: 0x22c55e,
    weaponType: 'bow'
  },
  {
    id: 'ai_thorne',
    name: 'Thorne Machado-de-Pedra',
    city: 'Refúgio dos Druidas',
    zoneId: 'forest',
    spawnX: -145,
    spawnZ: 15,
    level: 38,
    rank: 'Rank C',
    classTitle: 'Guardião do Bosque',
    color: 0x15803d,
    weaponType: 'axe'
  },
  {
    id: 'ai_elora',
    name: 'Elora das Marés',
    city: 'Porto Safira',
    zoneId: 'coast',
    spawnX: 25,
    spawnZ: 260,
    level: 72,
    rank: 'Rank B',
    classTitle: 'Elementalista das Ondas',
    color: 0x38bdf8,
    weaponType: 'staff'
  },
  {
    id: 'ai_drake',
    name: 'Drake o Bastião',
    city: 'Cidadela das Nuvens',
    zoneId: 'highlands',
    spawnX: 230,
    spawnZ: 235,
    level: 115,
    rank: 'Rank A',
    classTitle: 'Cavaleiro das Alturas',
    color: 0xa855f7,
    weaponType: 'shield'
  },
  {
    id: 'ai_ignatius',
    name: 'Ignatius Fogo-Eterno',
    city: 'Fortaleza de Brasas',
    zoneId: 'ember',
    spawnX: 285,
    spawnZ: -30,
    level: 165,
    rank: 'Rank S',
    classTitle: 'Mago Magmático',
    color: 0xef4444,
    weaponType: 'staff'
  },
  {
    id: 'ai_vesper',
    name: 'Vesper a Lâmina Sombria',
    city: 'Santuário Umbral',
    zoneId: 'void',
    spawnX: -260,
    spawnZ: 12,
    level: 220,
    rank: 'Rank SS',
    classTitle: 'Algoz do Vazio',
    color: 0x7c3aed,
    weaponType: 'dual_blades'
  },
  {
    id: 'ai_aurelius',
    name: 'Aurelius o Soberano Astral',
    city: 'Altar Celeste',
    zoneId: 'crown',
    spawnX: 12,
    spawnZ: -270,
    level: 285,
    rank: 'Rank SSS',
    classTitle: 'Campeão Celeste',
    color: 0xf59e0b,
    weaponType: 'greatsword'
  }
]

// Instanciação de estado dos aventureiros IA
export function createAiAdventurersState() {
  return AI_ADVENTURERS_CONFIG.map(cfg => {
    const maxHp = 120 + cfg.level * 18
    return {
      ...cfg,
      x: cfg.spawnX,
      z: cfg.spawnZ,
      hp: maxHp,
      maxHp: maxHp,
      atk: 14 + cfg.level * 2.1,
      def: 6 + cfg.level * 0.9,
      speed: 6.2,
      gold: 50 + cfg.level * 12,
      xp: 0,
      nextXp: Math.round(150 * Math.pow(cfg.level, 1.25)),
      state: 'patrol', // 'patrol' | 'combat' | 'dead'
      targetMob: null,
      hostileToPlayerTimer: 0,
      attackCooldown: 0,
      patrolAngle: Math.random() * Math.PI * 2,
      patrolTimer: 2.0 + Math.random() * 3.0,
      respawnTimer: 0,
      mesh: null,
      isInParty: false
    }
  })
}

// Atualização de comportamento IA a cada frame
export function updateAiAdventurer(ai, dt, enemies, playerPos, onAiDefeatMob, onAiKilled) {
  // 1. Tratamento de Morte & Respawn (65 segundos)
  if (ai.state === 'dead') {
    ai.respawnTimer -= dt
    if (ai.respawnTimer <= 0) {
      ai.state = 'patrol'
      ai.hp = ai.maxHp
      ai.x = ai.spawnX
      ai.z = ai.spawnZ
      if (ai.mesh) {
        ai.mesh.visible = true
        ai.mesh.position.set(ai.x, 0, ai.z)
      }
    }
    return
  }

  // Se HP zerou, morre
  if (ai.hp <= 0) {
    ai.state = 'dead'
    ai.respawnTimer = 65.0 // Respawn após 65 segundos
    ai.targetMob = null
    ai.hostileToPlayerTimer = 0
    if (ai.mesh) ai.mesh.visible = false
    onAiKilled?.(ai)
    return
  }

  ai.attackCooldown = Math.max(0, ai.attackCooldown - dt)
  if (ai.hostileToPlayerTimer > 0) {
    ai.hostileToPlayerTimer -= dt
  }

  // 2. Prioridade: Se hostil ao jogador, ataca o jogador
  if (ai.hostileToPlayerTimer > 0) {
    const distToPlayer = Math.hypot(playerPos.x - ai.x, playerPos.z - ai.z)
    if (distToPlayer > 1.8) {
      const dirX = (playerPos.x - ai.x) / distToPlayer
      const dirZ = (playerPos.z - ai.z) / distToPlayer
      ai.x += dirX * ai.speed * dt
      ai.z += dirZ * ai.speed * dt
    } else if (ai.attackCooldown <= 0) {
      ai.attackCooldown = 1.2
      // Retorna dano para aplicar ao player
      return { damageToPlayer: Math.max(1, Math.round(ai.atk * 0.8)) }
    }
    return null
  }

  // 3. Procurar Mobs Próximos para combater
  let nearestMob = null
  let nearestDist = 18.0

  for (const e of enemies) {
    if (e.dead) continue
    const d = Math.hypot(e.g.position.x - ai.x, e.g.position.z - ai.z)
    if (d < nearestDist) {
      nearestMob = e
      nearestDist = d
    }
  }

  if (nearestMob) {
    ai.state = 'combat'
    ai.targetMob = nearestMob

    if (nearestDist > 1.9) {
      const dirX = (nearestMob.g.position.x - ai.x) / nearestDist
      const dirZ = (nearestMob.g.position.z - ai.z) / nearestDist
      ai.x += dirX * ai.speed * dt
      ai.z += dirZ * ai.speed * dt
    } else if (ai.attackCooldown <= 0) {
      ai.attackCooldown = 1.1
      const dmg = Math.floor(ai.atk * (0.8 + Math.random() * 0.4))
      nearestMob.hp -= dmg

      // Mob revida no IA
      const mobDmg = Math.max(1, Math.round(nearestMob.atk - ai.def * 0.4))
      ai.hp = Math.max(0, ai.hp - mobDmg)

      if (nearestMob.hp <= 0) {
        // IA derrotou o mob!
        const xpEarned = Math.round(35 + nearestMob.level * 8)
        const goldEarned = Math.round(10 + nearestMob.level * 2)
        ai.xp += xpEarned
        ai.gold += goldEarned

        if (ai.xp >= ai.nextXp && ai.level < 300) {
          ai.level++
          ai.xp -= ai.nextXp
          ai.nextXp = Math.round(150 * Math.pow(ai.level, 1.25))
          ai.maxHp += 18
          ai.hp = ai.maxHp
          ai.atk += 2
          ai.def += 1
          // Atualiza rank da guilda
          if (ai.level >= 250) ai.rank = 'Rank SSS'
          else if (ai.level >= 180) ai.rank = 'Rank SS'
          else if (ai.level >= 130) ai.rank = 'Rank S'
          else if (ai.level >= 90) ai.rank = 'Rank A'
          else if (ai.level >= 55) ai.rank = 'Rank B'
          else if (ai.level >= 25) ai.rank = 'Rank C'
          else if (ai.level >= 10) ai.rank = 'Rank D'
        }

        onAiDefeatMob?.(ai, nearestMob)
        ai.targetMob = null
        ai.state = 'patrol'
      }
    }
  } else {
    // 4. Patrulha ao redor do ponto de spawn da cidade (raio até 28m)
    ai.state = 'patrol'
    ai.targetMob = null
    ai.patrolTimer -= dt

    if (ai.patrolTimer <= 0) {
      ai.patrolTimer = 2.5 + Math.random() * 4.0
      ai.patrolAngle = Math.random() * Math.PI * 2
    }

    const distFromSpawn = Math.hypot(ai.x - ai.spawnX, ai.z - ai.spawnZ)
    if (distFromSpawn > 26) {
      // Retorna para perto do spawn
      const toSpawnX = (ai.spawnX - ai.x) / distFromSpawn
      const toSpawnZ = (ai.spawnZ - ai.z) / distFromSpawn
      ai.x += toSpawnX * (ai.speed * 0.65) * dt
      ai.z += toSpawnZ * (ai.speed * 0.65) * dt
    } else {
      ai.x += Math.cos(ai.patrolAngle) * (ai.speed * 0.5) * dt
      ai.z += Math.sin(ai.patrolAngle) * (ai.speed * 0.5) * dt
    }
  }

  // Atualiza posição da malha 3D
  if (ai.mesh) {
    ai.mesh.position.set(ai.x, 0, ai.z)
  }

  return null
}
