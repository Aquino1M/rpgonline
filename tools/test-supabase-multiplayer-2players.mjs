import WebSocket from 'ws'

const URL = 'wss://kfnlcrsnvckexzmhbyoy.supabase.co/realtime/v1/websocket?apikey=sb_publishable_zB3YmZc3TNkKCHzHWQ-X5g_kKRvlkRI&vsn=1.0.0'
const TOPIC = 'realtime:shadow-ascension:asterra-global'
const KEY = 'sb_publishable_zB3YmZc3TNkKCHzHWQ-X5g_kKRvlkRI'

console.log('=====================================================================')
console.log('   TESTE REAL SUPABASE MULTIPLAYER: 2 CONTAS NO MESMO SERVIDOR')
console.log('=====================================================================')
console.log('Servidor Realtime:', URL.split('?')[0])
console.log('Lobby Global:', TOPIC)

function createTestClient(playerId, playerName, startPos) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(URL)
    let ref = 0
    let joined = false

    const nextRef = () => String(++ref)

    const client = {
      ws,
      playerId,
      playerName,
      otherPlayersSeen: new Set(),
      broadcastsReceived: [],
      trackPresence() {
        const r = nextRef()
        ws.send(JSON.stringify({
          topic: TOPIC,
          event: 'presence',
          payload: {
            type: 'presence',
            event: 'track',
            payload: {
              id: playerId,
              name: playerName,
              x: startPos.x,
              y: startPos.y,
              z: startPos.z,
              level: 10,
              hp: 120,
              maxHp: 120,
              motion: 'idle',
              world: 'open',
              guildRank: 'C',
              classId: 'mercenary_swordsman',
              onlineAt: Date.now()
            }
          },
          ref: r,
          join_ref: '1'
        }))
      },
      sendBroadcast(event, payload) {
        const r = nextRef()
        ws.send(JSON.stringify({
          topic: TOPIC,
          event: 'broadcast',
          payload: {
            type: 'broadcast',
            event,
            payload
          },
          ref: r,
          join_ref: '1'
        }))
      }
    }

    ws.on('open', () => {
      console.log(`[${playerName}] Conectado ao Supabase Realtime WS. Enviando phx_join...`)
      ws.send(JSON.stringify({
        topic: TOPIC,
        event: 'phx_join',
        payload: {
          config: {
            broadcast: { ack: false, self: false },
            presence: { key: playerId },
            postgres_changes: [],
            private: false
          },
          access_token: KEY
        },
        ref: '1',
        join_ref: null
      }))
    })

    ws.on('message', (raw) => {
      let msg
      try { msg = JSON.parse(raw.toString()) } catch { return }

      if (msg.event === 'phx_reply' && msg.ref === '1' && msg.payload.status === 'ok') {
        joined = true
        console.log(`[${playerName}] phx_reply OK! Entrou no canal global. Enviando presence track...`)
        client.trackPresence()
      } else if (msg.event === 'presence_state') {
        const state = msg.payload || {}
        for (const [key, presences] of Object.entries(state)) {
          if (key !== playerId) {
            client.otherPlayersSeen.add(key)
            console.log(`[${playerName}] Detectou jogador ativo no presence_state: ${key}`)
          }
        }
      } else if (msg.event === 'presence_diff') {
        const joins = msg.payload?.joins || {}
        for (const [key, presences] of Object.entries(joins)) {
          if (key !== playerId) {
            client.otherPlayersSeen.add(key)
            console.log(`[${playerName}] Detectou entrada de jogador via presence_diff: ${key}`)
          }
        }
      } else if (msg.event === 'broadcast') {
        const b = msg.payload
        client.broadcastsReceived.push(b)
        console.log(`[${playerName}] Recebeu broadcast '${b.event}':`, b.payload)
      }
    })

    ws.on('error', (err) => {
      console.error(`[${playerName}] Erro WS:`, err.message)
      reject(err)
    })

    const timeout = setTimeout(() => {
      if (!joined) reject(new Error(`Timeout ao conectar ${playerName}`))
    }, 8000)

    const check = setInterval(() => {
      if (joined) {
        clearInterval(check)
        clearTimeout(timeout)
        resolve(client)
      }
    }, 50)
  })
}

async function main() {
  console.log('\n--- 1. Conectando Conta 1: Guerreiro Alpha ---')
  const account1 = await createTestClient('player_alpha_001', 'Guerreiro Alpha', { x: 10, y: 0, z: -20 })

  console.log('\n--- 2. Conectando Conta 2: Mago Beta ---')
  const account2 = await createTestClient('player_beta_002', 'Mago Beta', { x: 12, y: 0, z: -18 })

  // Wait for presence propagation
  await new Promise(r => setTimeout(r, 1500))

  console.log('\n--- 3. Testando Broadcast de Movimento: Alpha -> Mundo ---')
  account1.sendBroadcast('state', {
    player: {
      id: 'player_alpha_001',
      name: 'Guerreiro Alpha',
      x: 15.0,
      y: 0,
      z: -15.0,
      r: 1.57,
      motion: 'run',
      level: 10
    }
  })

  await new Promise(r => setTimeout(r, 1000))

  console.log('\n--- 4. Testando Broadcast de Habilidade: Beta -> Mundo ---')
  account2.sendBroadcast('game', {
    kind: 'ability',
    abilityId: 'fireball',
    from: 'player_beta_002',
    name: 'Mago Beta',
    position: { x: 12, y: 0, z: -18 }
  })

  await new Promise(r => setTimeout(r, 1500))

  console.log('\n======================= RESULTADOS DA VERIFICACAO =======================')
  const alphaSawBeta = account1.otherPlayersSeen.has('player_beta_002')
  const betaSawAlpha = account2.otherPlayersSeen.has('player_alpha_001')
  const betaGotMove = account2.broadcastsReceived.some(b => b.event === 'state' && b.payload?.player?.id === 'player_alpha_001')
  const alphaGotAbility = account1.broadcastsReceived.some(b => b.event === 'game' && b.payload?.from === 'player_beta_002')

  console.log(`[PASS] Alpha enxergou Beta na Presença: ${alphaSawBeta ? 'SIM (OK)' : 'NAO (FALHA)'}`)
  console.log(`[PASS] Beta enxergou Alpha na Presença: ${betaSawAlpha ? 'SIM (OK)' : 'NAO (FALHA)'}`)
  console.log(`[PASS] Beta recebeu sincronização de movimento do Alpha: ${betaGotMove ? 'SIM (OK)' : 'NAO (FALHA)'}`)
  console.log(`[PASS] Alpha recebeu evento de combate/habilidade do Beta: ${alphaGotAbility ? 'SIM (OK)' : 'NAO (FALHA)'}`)

  account1.ws.close()
  account2.ws.close()

  if (alphaSawBeta && betaSawAlpha && betaGotMove && alphaGotAbility) {
    console.log('\n>>> SUCESSO: 2 CONTAS SE ENCONTRARAM E SINCRONIZARAM VIA SUPABASE REALTIME COM SUCESSO! <<<\n')
    process.exit(0)
  } else {
    console.error('\n>>> FALHA: Nem todas as sincronizacoes foram concluidas.\n')
    process.exit(1)
  }
}

main().catch(err => {
  console.error('Erro na execucao:', err)
  process.exit(1)
})
