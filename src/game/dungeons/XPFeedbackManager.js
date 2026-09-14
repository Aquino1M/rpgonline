// XPFeedbackManager.js - Enhanced XP animations, grouping sequential kills, and Level Up celebrations

export class XPFeedbackManager {
  constructor(game) {
    this.game = game
    this.accumulatedXP = 0
    this.accumulateTimer = null
    this.floatingNotifications = []
  }

  awardXP(amount, { isPartyBonus = false, bonusText = '' } = {}) {
    if (!amount || amount <= 0) return

    // Sequence grouping: accumulate XP within 420ms window to avoid visual spam
    this.accumulatedXP += amount

    if (this.accumulateTimer) {
      clearTimeout(this.accumulateTimer)
    }

    this.accumulateTimer = setTimeout(() => {
      this.flushAccumulatedXP(isPartyBonus, bonusText)
    }, 380)
  }

  flushAccumulatedXP(isPartyBonus, bonusText) {
    const total = this.accumulatedXP
    this.accumulatedXP = 0
    this.accumulateTimer = null

    if (total <= 0) return

    // Trigger visual feedback in game state for HUD rendering
    const isBig = total >= 1500
    const notice = {
      id: `xp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      amount: total,
      text: `+${total.toLocaleString('pt-BR')} XP${isPartyBonus ? ' (Bônus de Equipe)' : bonusText ? ` (${bonusText})` : ''}`,
      isBig,
      timestamp: Date.now()
    }

    // Expose on game state so React HUD can display the animated toast near the XP bar
    if (this.game.state) {
      this.game.state.xpNotifications = [...(this.game.state.xpNotifications || []).slice(-3), notice]
      this.game.state.lastXpGain = notice
    }

    // Also spawn a 3D damage-text-style floating XP above player head in green/gold
    if (this.game.player && this.game.spawnDamageText) {
      const pos = this.game.player.position.clone()
      pos.y += 0.8
      this.game.spawnDamageText(pos, `+${total} XP`, isBig, isBig ? '#facc15' : '#4ade80')
    }
  }

  triggerLevelUp(newLevel) {
    if (!this.game.state) return

    this.game.state.levelUpCelebration = {
      id: `lvlup_${Date.now()}`,
      level: newLevel,
      title: `LEVEL UP!`,
      subtitle: `Você alcançou o Nível ${newLevel}`,
      timestamp: Date.now()
    }

    // Spawn radiant ring at player position
    if (this.game.spawnAbilityRing) {
      this.game.spawnAbilityRing(0xfacc15, 4.5, 1.8)
    }
    this.game.haptic?.(75)

    // Auto-clear celebration after 3.5s
    setTimeout(() => {
      if (this.game.state?.levelUpCelebration?.level === newLevel) {
        this.game.state.levelUpCelebration = null
      }
    }, 3500)
  }
}
