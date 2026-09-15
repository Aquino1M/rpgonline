import { isSupabaseConfigured, getSupabaseConfig, SupabaseRealtimeTransport, loadCloudProfile, saveCloudProfile } from './supabaseService.js'

const storage = typeof window !== 'undefined' ? window.localStorage : null
const makeId = () => {
  const existing = storage?.getItem('shadow-ascension-player-id')
  if (existing) return existing
  const id = (globalThis.crypto?.randomUUID?.() || `player-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`)
  storage?.setItem('shadow-ascension-player-id', id)
  return id
}
export const DEFAULT_MULTIPLAYER_ROOM = 'asterra-global'
const MULTIPLAYER_LOBBIES = [DEFAULT_MULTIPLAYER_ROOM]
const cleanRoom = () => DEFAULT_MULTIPLAYER_ROOM
const defaultLobbyFor = () => DEFAULT_MULTIPLAYER_ROOM
export const multiplayerLobbies = () => [...MULTIPLAYER_LOBBIES]

export function sameOriginMultiplayerUrl() {
  if (typeof window === 'undefined') return ''
  const { protocol, hostname, host, port } = window.location
  const isPrivate = /^(10\.|192\.168\.|127\.|localhost$)/.test(hostname) || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  if (isPrivate && ['5173', '4173'].includes(port)) return `${protocol === 'https:' ? 'wss' : 'ws'}://${hostname}:8765/ws`
  if (port === '8080' || port === '8765' || (isPrivate && port)) return `${protocol === 'https:' ? 'wss' : 'ws'}://${host}/ws`
  return ''
}

export function sameOriginHttpMultiplayerUrl() {
  if (typeof window === 'undefined') return ''
  const { hostname, port } = window.location
  const localDev = /^(127\.|localhost$)/.test(hostname) && ['5173', '4173'].includes(port)
  if (localDev) return ''
  return `${window.location.origin}/api/multiplayer`
}

const isHttpUrl = u => /^https?:\/\//i.test(u) || u.startsWith('/api/')
const normalizedHttpUrl = u => u.startsWith('/api/') ? `${window.location.origin}${u}` : u
const jitter = (n) => Math.round(n * (.88 + Math.random() * .24))
const qualityOf = (ms) => !Number.isFinite(ms) || ms <= 0 ? 'offline' : ms < 90 ? 'excelente' : ms < 180 ? 'boa' : ms < 350 ? 'media' : 'fraca'

export class MultiplayerClient {
  constructor({ url = '', room = '', name = 'Aventureiro', onEvent = () => {} } = {}) {
    const wsAuto = sameOriginMultiplayerUrl()
    const httpAuto = !wsAuto ? sameOriginHttpMultiplayerUrl() : ''
    this.playerId = makeId()
    const remembered = cleanRoom(storage?.getItem('shadow-ascension-last-lobby'))
    this.room = cleanRoom(room) || remembered || defaultLobbyFor(this.playerId)
    storage?.setItem('shadow-ascension-last-lobby', this.room)
    this.url = url || wsAuto || httpAuto
    this.name = name
    this.onEvent = onEvent
    this.ws = null
    this.supabaseTransport = null
    this.id = null
    this.connected = false
    this.lastSend = 0
    this.lastProfileSave = 0
    this.wanted = false
    this.reconnectTimer = null
    this.reconnectAttempts = 0
    this.transport = 'offline'
    this.pollTimer = null
    this.pollBusy = false
    this.lastPollAt = 0
    this.httpRoster = new Set()
    this.abortController = null
    this.lastHttpError = ''
    this.seenEventIds = new Set()
    this.seq = 0
    this.latencyMs = 0
    this.lastPacketAt = 0
    this.lastNetworkEmit = 0
    this.httpFailures = 0
    this.pingTimer = null
    this.pendingPingAt = 0
  }

  setIdentity(name) {
    this.name = String(name || 'Aventureiro').slice(0, 24)
    if (this.supabaseTransport) this.supabaseTransport.name = this.name
    if (this.connected) this.send({ type: 'rename', name: this.name })
  }

  setRoom(room, { reconnect = true } = {}) {
    const next = cleanRoom(room) || defaultLobbyFor(this.playerId)
    if (next === this.room) {
      storage?.setItem('shadow-ascension-last-lobby', next)
      return next
    }
    this.room = next
    storage?.setItem('shadow-ascension-last-lobby', next)
    this.httpRoster.clear()
    this.lastPollAt = 0
    this.seenEventIds.clear()
    if (reconnect && this.wanted) {
      this.connect(this.url)
    }
    this.onEvent({ type: 'lobby', room: this.room })
    return this.room
  }

  _emitNetwork(extra = {}) {
    const now = Date.now()
    if (!extra.force && now - this.lastNetworkEmit < 900) return
    this.lastNetworkEmit = now
    this.onEvent({
      type: 'network',
      latencyMs: this.latencyMs,
      quality: qualityOf(this.latencyMs),
      lastPacketAt: this.lastPacketAt || now,
      reconnecting: this.wanted && !this.connected,
      ...extra
    })
  }

  connect(url = this.url) {
    this.wanted = true
    clearTimeout(this.reconnectTimer)
    this._stopTransport()

    // 1. Se Supabase estiver configurado e não houver forçação explícita de WebSocket local
    const isExplicitWs = url && (url.startsWith('ws:') || url.startsWith('wss:'))
    if (isSupabaseConfigured() && !isExplicitWs) {
      this._openSupabase()
      return
    }

    // 2. Fallbacks tradicionais: WS local ou HTTP Vercel
    this.url = url || sameOriginMultiplayerUrl() || sameOriginHttpMultiplayerUrl()
    if (!this.url) {
      // Se não há URL de WS/HTTP e nem Supabase, tenta carregar perfil em nuvem se possível
      if (isSupabaseConfigured()) {
        this._openSupabase()
      }
      return
    }

    if (isHttpUrl(this.url)) this._openHttp()
    else this._openWs()
  }

  _stopTransport() {
    clearTimeout(this.pollTimer)
    this.pollTimer = null
    clearInterval(this.pingTimer)
    this.pingTimer = null
    try { this.abortController?.abort() } catch {}
    this.abortController = null
    try { this.ws?.close() } catch {}
    this.ws = null
    try { this.supabaseTransport?.disconnect() } catch {}
    this.supabaseTransport = null
    this.pollBusy = false
  }

  _openSupabase() {
    this.transport = 'supabase'
    const { url } = getSupabaseConfig()
    this.supabaseTransport = new SupabaseRealtimeTransport({
      room: this.room,
      playerId: this.playerId,
      name: this.name,
      onEvent: (e) => {
        if (e.type === 'connection') {
          this.connected = e.connected
          if (e.connected) {
            this.id = this.playerId
            this.reconnectAttempts = 0
            // Carregar save do jogador na nuvem (Supabase DB)
            loadCloudProfile(this.playerId).then(profile => {
              if (profile && profile.game) {
                this.onEvent({ type: 'profile', profile })
              }
            }).catch(() => {})
          }
        }
        if (e.type === 'network') {
          this.latencyMs = e.latencyMs || this.latencyMs
        }
        this.onEvent(e)
        this._emitNetwork()
      }
    })

    const started = this.supabaseTransport.connect()
    if (!started) {
      this.connected = false
      this._scheduleReconnect(() => this.connect(this.url), 2000, 15000)
    }
  }

  _scheduleReconnect(fn, base = 900, max = 12000) {
    if (!this.wanted) return
    clearTimeout(this.reconnectTimer)
    const wait = jitter(Math.min(max, base * Math.pow(1.55, this.reconnectAttempts++)))
    this._emitNetwork({ reconnecting: true, force: true })
    this.reconnectTimer = setTimeout(fn, wait)
  }

  _startPing() {
    clearInterval(this.pingTimer)
    this.pingTimer = setInterval(() => {
      if (!this.connected) return
      this.pendingPingAt = performance.now()
      this.send({ type: 'ping', clientTime: Date.now() })
    }, 5000)
  }

  _openWs() {
    if (!this.wanted || !this.url) return
    this.transport = 'ws'
    try {
      const ws = this.ws = new WebSocket(this.url)
      ws.addEventListener('open', () => {
        if (ws !== this.ws) return
        this.connected = true
        this.reconnectAttempts = 0
        this.httpFailures = 0
        this.send({ type: 'hello', room: this.room, name: this.name, playerId: this.playerId })
        this.onEvent({ type: 'connection', connected: true, url: this.url, transport: 'ws', room: this.room })
        this.lastPacketAt = Date.now()
        this._emitNetwork({ force: true })
        this._startPing()
      })
      ws.addEventListener('message', e => {
        if (ws !== this.ws) return
        this.lastPacketAt = Date.now()
        try {
          const m = JSON.parse(e.data)
          if (m.type === 'welcome') {
            this.id = m.id
            if (m.room) {
              this.room = cleanRoom(m.room) || this.room
              storage?.setItem('shadow-ascension-last-lobby', this.room)
            }
          }
          if (m.type === 'pong') {
            if (this.pendingPingAt) this.latencyMs = Math.max(1, performance.now() - this.pendingPingAt)
            this._emitNetwork({ force: true })
            return
          }
          this.onEvent(m)
          this._emitNetwork()
        } catch {}
      })
      ws.addEventListener('close', () => {
        if (ws !== this.ws) return
        this.connected = false
        clearInterval(this.pingTimer)
        this.onEvent({ type: 'connection', connected: false, url: this.url, transport: 'ws', room: this.room })
        this._emitNetwork({ reconnecting: this.wanted, force: true })
        if (this.wanted) this._scheduleReconnect(() => this._openWs(), 700, 10000)
      })
      ws.addEventListener('error', () => {})
    } catch {
      this._scheduleHttpFallbackOrReconnect()
    }
  }

  _scheduleHttpFallbackOrReconnect() {
    if (isSupabaseConfigured()) {
      this._openSupabase()
      return
    }
    const http = sameOriginHttpMultiplayerUrl()
    if (http && !isHttpUrl(this.url)) {
      this.url = http
      this._openHttp()
      return
    }
    this._scheduleReconnect(() => this.connect(this.url), 900, 10000)
  }

  async _requestHttp(body) {
    const url = normalizedHttpUrl(this.url)
    const started = performance.now()
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, room: this.room, playerId: this.playerId, name: body.name ?? this.name }),
      cache: 'no-store',
      keepalive: body.type === 'leave'
    })
    let data = {}
    try { data = await r.json() } catch {}
    this.latencyMs = this.latencyMs ? this.latencyMs * .72 + (performance.now() - started) * .28 : (performance.now() - started)
    this.lastPacketAt = Date.now()
    if (!r.ok) {
      const err = new Error(data.message || data.error || `HTTP ${r.status}`)
      err.status = r.status
      err.data = data
      throw err
    }
    this._emitNetwork()
    return data
  }

  async _openHttp() {
    if (!this.wanted || !this.url) return
    this.transport = 'http'
    this.connected = false
    try {
      const data = await this._requestHttp({ type: 'hello' })
      if (!this.wanted) return
      this.id = data.id || this.playerId
      this.connected = true
      this.reconnectAttempts = 0
      this.httpFailures = 0
      this.lastHttpError = ''
      this.seenEventIds = new Set()
      if (data.room) {
        this.room = cleanRoom(data.room) || this.room
        storage?.setItem('shadow-ascension-last-lobby', this.room)
      }
      this.onEvent({ type: 'connection', connected: true, url: this.url, transport: 'http', room: this.room })
      this.onEvent({ type: 'welcome', id: this.id, room: this.room, players: data.players || [] })
      this.onEvent({ type: 'profile', profile: data.profile || null })
      this.httpRoster = new Set((data.players || []).map(p => p.id))
      this.lastPollAt = Number(data.now) || Date.now()
      this._emitNetwork({ force: true })
      this._schedulePoll(250)
    } catch (err) {
      this.connected = false
      this.lastHttpError = String(err?.message || err)
      this.onEvent({ type: 'connection', connected: false, url: this.url, transport: 'http', room: this.room, reason: this.lastHttpError, setupRequired: err?.status === 503 })
      this._emitNetwork({ reconnecting: this.wanted, force: true })
      if (this.wanted) this._scheduleReconnect(() => this._openHttp(), 1400, 15000)
    }
  }

  _schedulePoll(delay = null) {
    clearTimeout(this.pollTimer)
    if (!this.connected || !this.wanted) return
    const hidden = typeof document !== 'undefined' && document.hidden
    const base = hidden ? 1100 : 420
    this.pollTimer = setTimeout(() => this._pollHttp(), delay ?? base)
  }

  async _pollHttp() {
    if (!this.connected || this.pollBusy) {
      this._schedulePoll(300)
      return
    }
    this.pollBusy = true
    const started = performance.now()
    try {
      const url = new URL(normalizedHttpUrl(this.url))
      url.searchParams.set('room', this.room)
      url.searchParams.set('playerId', this.playerId)
      url.searchParams.set('since', String(Math.max(0, this.lastPollAt - 2)))
      const r = await fetch(url, { cache: 'no-store' })
      if (!r.ok) throw new Error(`poll_${r.status}`)
      const data = await r.json()
      this.httpFailures = 0
      const sample = performance.now() - started
      this.latencyMs = this.latencyMs ? this.latencyMs * .75 + sample * .25 : sample
      this.lastPacketAt = Date.now()
      const players = Array.isArray(data.players) ? data.players : []
      const next = new Set()
      for (const p of players) {
        if (!p || p.id === this.playerId) continue
        next.add(p.id)
        this.onEvent({ type: 'state', player: p })
      }
      for (const id of this.httpRoster) if (!next.has(id)) this.onEvent({ type: 'leave', id })
      this.httpRoster = next
      if (Array.isArray(data.enemyStates)) this.onEvent({ type: 'enemy_snapshot', states: data.enemyStates })
      for (const e of data.events || []) {
        if (e?.eventId) {
          if (this.seenEventIds.has(e.eventId)) continue
          this.seenEventIds.add(e.eventId)
          if (this.seenEventIds.size > 600) {
            const first = this.seenEventIds.values().next().value
            this.seenEventIds.delete(first)
          }
        }
        this.onEvent(e)
      }
      this.lastPollAt = Math.max(this.lastPollAt, Number(data.now) || Date.now())
      this._emitNetwork()
    } catch (err) {
      this.httpFailures++
      this.lastHttpError = String(err?.message || err)
      if (this.httpFailures >= 3) {
        this.connected = false
        this.onEvent({ type: 'connection', connected: false, url: this.url, transport: 'http', room: this.room, reason: this.lastHttpError })
        this._emitNetwork({ reconnecting: true, force: true })
        clearTimeout(this.pollTimer)
        this.pollTimer = null
        if (this.wanted) this._scheduleReconnect(() => this._openHttp(), 1000, 10000)
        this.pollBusy = false
        return
      }
    } finally {
      this.pollBusy = false
    }
    this._schedulePoll(this.httpFailures ? 700 : null)
  }

  send(m) {
    if (this.transport === 'supabase' && this.supabaseTransport) {
      this.supabaseTransport.send(m)
      return
    }
    if (this.transport === 'ws') {
      if (this.ws?.readyState === WebSocket.OPEN) {
        if (m?.type === 'state' && this.ws.bufferedAmount > 262144) return
        this.ws.send(JSON.stringify(m))
      }
      return
    }
    if (this.transport === 'http' && this.connected) {
      this._requestHttp(m).then(data => {
        if (data?.type) this.onEvent(data)
        if (data?.party !== undefined) this.onEvent({ type: 'party_state', party: data.party })
        if (data?.type === 'pong' && data.clientTime) {
          this.latencyMs = Math.max(1, Date.now() - Number(data.clientTime))
          this._emitNetwork({ force: true })
        }
      }).catch(() => {})
    }
  }

  sync(state, now = performance.now()) {
    if (!this.connected) return
    const hidden = typeof document !== 'undefined' && document.hidden

    if (this.transport === 'supabase' && this.supabaseTransport) {
      const interval = hidden ? 600 : 120
      if (now - this.lastSend < interval) return
      this.lastSend = now
      this.seq = (this.seq + 1) >>> 0
      this.supabaseTransport.sync({ seq: this.seq, clientTime: Date.now(), ...state })
      return
    }

    const interval = this.transport === 'http' ? (hidden ? 1200 : 360) : (hidden ? 500 : 85)
    if (now - this.lastSend < interval) return
    this.lastSend = now
    this.seq = (this.seq + 1) >>> 0
    this.send({ type: 'state', seq: this.seq, clientTime: Date.now(), name: this.name, ...state })
  }

  saveProfile(game, updatedAt = Date.now(), force = false) {
    const now = performance.now()
    if (!force && now - this.lastProfileSave < 4000) return
    this.lastProfileSave = now

    // Se Supabase estiver configurado, salva no PostgreSQL na nuvem
    if (isSupabaseConfigured() || this.transport === 'supabase') {
      saveCloudProfile({
        id: this.playerId,
        name: this.name,
        game,
        lastLobby: this.room,
        updatedAt
      }).then(res => {
        this.onEvent({ type: 'profile_saved', ok: res.ok, updatedAt: res.updatedAt })
      }).catch(() => {
        this.onEvent({ type: 'profile_saved', ok: false })
      })
    }

    // Se estiver conectado via WS ou HTTP Vercel, também envia para o backend correspondente
    if (this.transport === 'ws' || this.transport === 'http') {
      this.send({ type: 'profile_save', room: this.room, updatedAt, game })
    }
  }

  disconnect() {
    this.wanted = false
    clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
    if (this.transport === 'http' && this.connected) {
      try {
        fetch(normalizedHttpUrl(this.url), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'leave', room: this.room, playerId: this.playerId, name: this.name }),
          keepalive: true
        })
      } catch {}
    }
    this._stopTransport()
    this.connected = false
    this.transport = 'offline'
    this._emitNetwork({ reconnecting: false, force: true })
  }
}
