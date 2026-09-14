// Sistema de Viagem Rápida (Fast Travel) com o "Moço Viajante" (NPC Mercador de Viagens)
export const TRAVEL_NODES = [
  {
    id: 'aurora',
    name: 'Vila Aurora',
    title: 'Capital dos Despertos',
    zone: 'aurora',
    minLevel: 1,
    x: 0,
    z: 22,
    color: '#b6df7e',
    unlockedByDefault: true,
    desc: 'O coração seguro das terras conhecidas. Forjas, mercadores e o conselho de patrulha.'
  },
  {
    id: 'meadow',
    name: 'Posto da Pradaria',
    title: 'Acampamento do Vento Dourado',
    zone: 'meadow',
    minLevel: 8,
    x: 456,
    z: 64,
    color: '#d8f58e',
    unlockedByDefault: false,
    desc: 'Entreposto de caçadores onde caravanas trocam peles e vigiam os Lobos Lúmen.'
  },
  {
    id: 'forest',
    name: 'Refúgio dos Druidas',
    title: 'Bosque Cinéreo',
    zone: 'forest',
    minLevel: 25,
    x: -462,
    z: 10,
    color: '#80a58a',
    unlockedByDefault: false,
    desc: 'Cercado por raízes ancestrais e névoa viva. Ponto de repouso silencioso.'
  },
  {
    id: 'coast',
    name: 'Porto Safira',
    title: 'Costa Safira',
    zone: 'coast',
    minLevel: 55,
    x: 0,
    z: 766,
    color: '#4bc1df',
    unlockedByDefault: false,
    desc: 'Doca protegida por falésias arcanas de onde partem expedições marítimas.'
  },
  {
    id: 'highlands',
    name: 'Cidadela das Nuvens',
    title: 'Altos de Veyra',
    zone: 'highlands',
    minLevel: 90,
    x: 735,
    z: 685,
    color: '#c7d2c6',
    unlockedByDefault: false,
    desc: 'Fortaleza esculpida em picos escarpados acima das nuvens tempestuosas.'
  },
  {
    id: 'ember',
    name: 'Fortaleza de Brasas',
    title: 'Ermos Rubros',
    zone: 'ember',
    minLevel: 140,
    x: 810,
    z: -155,
    color: '#ef8650',
    unlockedByDefault: false,
    desc: 'Posto militar com muralhas de pedra vulcânica protegendo contra colossos e lava.'
  },
  {
    id: 'void',
    name: 'Santuário Umbral',
    title: 'Fronteira Umbral',
    zone: 'void',
    minLevel: 200,
    x: -840,
    z: 10,
    color: '#9c86d6',
    unlockedByDefault: false,
    desc: 'Monolito de éter resguardado contra aberrações do vácuo dimensional.'
  },
  {
    id: 'crown',
    name: 'Altar Celeste',
    title: 'Coroa Celeste',
    zone: 'crown',
    minLevel: 260,
    x: 0,
    z: -830,
    color: '#e8f2ff',
    unlockedByDefault: false,
    desc: 'Santuário lendário nas ruínas que tocam o infinito céu astral.'
  }
]

// Fórmula de Custo:
// Preço = (Distância entre Cidades * Multiplicador) + Taxa Fixa do NPC
// Custo de risco escala com o nível do destino
export function calculateTravelCost(currentPos, destination, hasVipPass = false) {
  if (hasVipPass) return 0
  const dist = Math.hypot(currentPos.x - destination.x, currentPos.z - destination.z)
  const riskMultiplier = 1 + (destination.minLevel / 45) * 0.35
  const baseNpcFee = 25
  const cost = Math.round(dist * 0.38 * riskMultiplier + baseNpcFee)
  return Math.max(15, cost)
}

// 4. Eventos Aleatórios na Estrada (5% de chance de emboscada)
export function rollRoadAmbush() {
  return Math.random() < 0.05
}

// Gera o estado inicial dos nós desbloqueados
export function defaultTravelState() {
  const nodes = {}
  TRAVEL_NODES.forEach(node => {
    nodes[node.id] = {
      unlocked: !!node.unlockedByDefault,
      vipPass: false
    }
  })
  return {
    nodes,
    ambushActive: null,
    vipCost: 5000
  }
}
