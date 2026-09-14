// Sistema de Equipe da Guilda (Party System) V0.8.0
// Grupos de até 4 integrantes com partilha de XP e liderança dinâmica

export function defaultPartyState() {
  return {
    active: false,
    id: null,
    leaderId: 'player',
    xpPool: 0,
    members: [
      { id: 'player', name: 'Você', level: 1, isLeader: true, isPlayer: true }
    ]
  }
}

export function createParty(playerName = 'Você', playerLevel = 1) {
  return {
    active: true,
    id: `party_${Date.now()}`,
    leaderId: 'player',
    xpPool: 0,
    members: [
      { id: 'player', name: playerName, level: playerLevel, isLeader: true, isPlayer: true }
    ]
  }
}

export function addAiToParty(party, aiAdventurer) {
  if (!party || !party.active) return false
  if (party.members.length >= 4) return false
  if (party.members.some(m => m.id === aiAdventurer.id)) return false

  party.members.push({
    id: aiAdventurer.id,
    name: aiAdventurer.name,
    level: aiAdventurer.level,
    rank: aiAdventurer.rank,
    classTitle: aiAdventurer.classTitle,
    isLeader: false,
    isAi: true
  })

  aiAdventurer.isInParty = true
  return true
}

export function removeMemberFromParty(party, memberId) {
  if (!party || !party.active) return null
  party.members = party.members.filter(m => m.id !== memberId)

  // Se o líder saiu e ainda há membros, passa liderança
  if (party.leaderId === memberId && party.members.length > 0) {
    party.leaderId = party.members[0].id
    party.members[0].isLeader = true
  }

  // Se o grupo ficou vazio ou apenas 1 e quer fechar
  if (party.members.length === 0) {
    party.active = false
  }

  return party
}

export function distributePartyXp(party, rawXp) {
  if (!party || !party.active || party.members.length <= 1) {
    return rawXp // Sem bônus de grupo
  }

  // Bônus de grupo: +15% de XP total por membro adicional
  const partyBonus = 1 + (party.members.length - 1) * 0.15
  const totalXp = Math.round(rawXp * partyBonus)
  const sharedXp = Math.max(1, Math.round(totalXp / party.members.length))

  party.xpPool = (party.xpPool || 0) + totalXp
  return sharedXp
}
