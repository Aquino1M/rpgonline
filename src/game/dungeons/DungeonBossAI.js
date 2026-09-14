// DungeonBossAI.js - 3-phase intelligent boss fight manager with telegraphs and abilities
import { DUNGEON_BOSSES } from './DungeonConfig.js'

export class DungeonBossAI {
  constructor(game) {
    this.game = game
  }

  createBossEntity({ x, z, level, themeKey = 'cavern', rank = 'C' }) {
    const template = DUNGEON_BOSSES[themeKey] || DUNGEON_BOSSES.cavern
    const boss = this.game.makeEnemy(x, z, level + 4, template.name, true, null, null, `dungeon_boss_${Date.now()}`)
    
    boss.isDungeonBoss = true
    boss.themeKey = themeKey
    boss.rank = rank
    boss.bossTemplate = template
    boss.currentPhase = 1
    boss.phaseThresholds = template.phaseThresholds || [0.70, 0.35]
    boss.specialCooldown = 5.0
    boss.specialTimer = 4.0
    boss.enraged = false

    // Scale up visual model for boss presence
    if (boss.g) {
      const sc = template.scale || 2.4
      boss.g.scale.set(sc, sc, sc)
    }

    // High stats reflecting boss rank
    boss.maxHp = Math.round(boss.maxHp * (rank === 'S' ? 4.2 : rank === 'A' ? 3.2 : rank === 'B' ? 2.4 : 1.8))
    boss.hp = boss.maxHp
    boss.atk = Math.round(boss.atk * 1.45)
    boss.def = Math.round(boss.def * 1.35)

    return boss
  }

  update(boss, dt) {
    if (!boss || boss.dead) return

    const hpPct = boss.hp / boss.maxHp
    const prevPhase = boss.currentPhase

    // Check phase transitions
    if (hpPct <= boss.phaseThresholds[1]) {
      boss.currentPhase = 3
    } else if (hpPct <= boss.phaseThresholds[0]) {
      boss.currentPhase = 2
    } else {
      boss.currentPhase = 1
    }

    // Trigger phase change effects
    if (boss.currentPhase !== prevPhase) {
      this.handlePhaseTransition(boss, boss.currentPhase)
    }

    // Boss special attack clock
    boss.specialTimer = (boss.specialTimer || 5) - dt
    if (boss.specialTimer <= 0) {
      this.executeBossSpecial(boss)
      const baseCd = boss.currentPhase === 3 ? 3.5 : boss.currentPhase === 2 ? 4.8 : 6.0
      boss.specialTimer = baseCd
    }
  }

  handlePhaseTransition(boss, newPhase) {
    const color = newPhase === 3 ? 0xef4444 : 0x8b5cf6
    this.game.spawnAbilityRing?.(color, 6.0, 1.2)
    this.game.haptic?.(50)

    if (newPhase === 2) {
      this.game.toast(`⚠️ ${boss.name} enfureceu-se! (Fase 2: Convocação do Éter)`)
      // Spawn 2 shadow minions around the boss
      this.spawnMinions(boss, 2)
    } else if (newPhase === 3) {
      boss.enraged = true
      boss.atk = Math.round(boss.atk * 1.25)
      this.game.toast(`☠️ ${boss.name} entrou em ESTADO CRÍTICO BERSERK! (Fase Final)`)
      this.spawnMinions(boss, 3)
    }
  }

  executeBossSpecial(boss) {
    const player = this.game.player
    if (!player) return

    const dist = boss.g.position.distanceTo(player.position)
    const phase = boss.currentPhase || 1

    if (phase === 1) {
      // Phase 1: Heavy Ground Slam with red ring telegraph
      this.game.spawnAbilityRing?.(0xef4444, 4.5, 0.9)
      this.game.toast(`⚠️ ${boss.name} prepara Golpe Sísmico!`)
      setTimeout(() => {
        if (boss.dead) return
        const d = boss.g.position.distanceTo(this.game.player.position)
        if (d < 4.5) {
          const dmg = Math.max(8, Math.round(boss.atk * 1.35 - this.game.state.def * 0.35))
          this.game.damagePlayer?.(this.game.state.blocking ? Math.round(dmg * 0.35) : dmg)
          this.game.haptic?.(45)
        }
      }, 900)
    } else if (phase === 2) {
      // Phase 2: Targeted Shockwave Blast
      const targetPos = player.position.clone()
      this.game.spawnAbilityRing?.(0xa855f7, 4.2, 1.1)
      this.game.toast(`⚡ ${boss.name} invocou Onda de Choque Rúnica!`)
      setTimeout(() => {
        if (boss.dead) return
        if (targetPos.distanceTo(this.game.player.position) < 4.2) {
          const dmg = Math.max(12, Math.round(boss.atk * 1.55 - this.game.state.def * 0.35))
          this.game.damagePlayer?.(dmg)
          this.game.haptic?.(55)
        }
      }, 1100)
    } else {
      // Phase 3: Apocalyptic Nova
      this.game.spawnAbilityRing?.(0xdc2626, 7.5, 1.4)
      this.game.toast(`🔥 ${boss.name} desencadeou CATACLISMO DO ABISMO!`)
      setTimeout(() => {
        if (boss.dead) return
        const d = boss.g.position.distanceTo(this.game.player.position)
        if (d < 7.5) {
          const dmg = Math.max(18, Math.round(boss.atk * 1.85 - this.game.state.def * 0.3))
          this.game.damagePlayer?.(dmg)
          this.game.haptic?.(70)
        }
      }, 1400)
    }
  }

  spawnMinions(boss, count = 2) {
    if (!this.game.enemies) return
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      const mx = boss.g.position.x + Math.cos(angle) * 4.0
      const mz = boss.g.position.z + Math.sin(angle) * 4.0
      const minion = this.game.makeEnemy(mx, mz, Math.max(1, boss.level - 2), `Sombra de ${boss.name}`, false, null, null, `minion_${Date.now()}_${i}`)
      minion.hp = Math.round(minion.hp * 0.6)
      minion.maxHp = minion.hp
      this.game.enemies.push(minion)
    }
  }
}
