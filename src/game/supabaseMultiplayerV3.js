// Shadow Ascension Multiplayer Hotfix V3
// One authenticated global lobby + native Supabase Realtime Presence/Broadcast.
// No new npm dependency: uses the Supabase Realtime Phoenix WebSocket protocol directly.
//
// Required Vercel build env:
//   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
//   VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
//
// NEVER expose SUPABASE_SERVICE_ROLE_KEY in this client file.

import { getSupabaseClient } from './supabaseService.js'

export const GLOBAL_MULTIPLAYER_ROOM = 'asterra-global'
const REMOTE_LEAVE_GRACE_MS = 15_000
const PRESENCE_RENEW_MS = 20_000
const HEARTBEAT_INTERVAL_MS = 25_000
const HEARTBEAT_TIMEOUT_MS = 10_000

const storage = typeof window !== 'undefined' ? window.localStorage : null
export const DEFAULT_SUPABASE_PROJECT_URL = 'https://kfnlcrsnvckexzmhbyoy.supabase.co'
export const DEFAULT_SUPABASE_PUBLIC_KEY = 'sb_publishable_zB3YmZc3TNkKCHzHWQ-X5g_kKRvlkRI'

const env = import.meta.env || {}
const SUPABASE_URL = String(env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_PROJECT_URL).trim()
const SUPABASE_KEY = String(
  env.VITE_SUPABASE_ANON_KEY ||
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  DEFAULT_SUPABASE_PUBLIC_KEY
).trim()

const hasSupabase = () => /^https:\/\/.+\.supabase\.co\/?$/i.test(SUPABASE_URL) && SUPABASE_KEY.length > 20
const realtimeAccessToken = async () => {
  try {
    const { data } = await getSupabaseClient()?.auth.getSession()
    return String(data?.session?.access_token || '')
  } catch {
    return ''
  }
}
const makeId = () => {
  if (typeof window !== 'undefined') {
    let tabId = null
    try { tabId = window.sessionStorage?.getItem('shadow-ascension-tab-client-id') } catch {}
    if (!tabId) {
      tabId = `player-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
      try { window.sessionStorage?.setItem('shadow-ascension-tab-client-id', tabId) } catch {}
    }
    return tabId
  }
  return `player-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}
const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`
const cleanName = v => String(v || 'Aventureiro')
  .normalize('NFKC')
  .replace(/[^\p{L}\p{N} _.\-]/gu, '')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 24) || 'Aventureiro'
const safeNumber = (v, d=0, min=-1e9, max=1e9) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : d
}
const now = () => Date.now()
const safePlayer = (raw={}, id='') => ({
  id: String(id || raw.id || '').slice(0, 90),
  name: cleanName(raw.name),
  x: safeNumber(raw.x, 0, -5000, 5000),
  y: safeNumber(raw.y, 0, -30, 100),
  z: safeNumber(raw.z, 0, -5000, 5000),
  r: safeNumber(raw.r, 0, -Math.PI*8, Math.PI*8),
  level: safeNumber(raw.level, 1, 1, 300),
  hp: safeNumber(raw.hp, 120, 0, 1e9),
  maxHp: safeNumber(raw.maxHp, 120, 1, 1e9),
  motion: String(raw.motion || 'idle').slice(0, 24),
  world: String(raw.world || 'open').slice(0, 90),
  guildRank: String(raw.guildRank || 'E').slice(0, 8),
  mountActive: !!raw.mountActive,
  classId: String(raw.classId || 'mercenary_swordsman').slice(0, 48),
  seq: safeNumber(raw.seq, 0, 0, 0xffffffff),
  lastSeen: safeNumber(raw.lastSeen, now(), 0, Number.MAX_SAFE_INTEGER)
})

function isLocalGameHost() {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  return /^(localhost|127\.0\.0\.1)$/.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
}

function supabaseWsUrl() {
  if (!hasSupabase()) return ''
  const u = new URL(SUPABASE_URL)
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'
  u.pathname = '/realtime/v1/websocket'
  u.search = ''
  u.searchParams.set('apikey', SUPABASE_KEY)
  u.searchParams.set('vsn', '1.0.0')
  return u.toString()
}

class NativeSupabaseRealtime {
  constructor({playerId, onSubscribed, onClosed, onBroadcast, onPresence}) {
    this.playerId = playerId
    this.topic = `realtime:shadow-ascension:${GLOBAL_MULTIPLAYER_ROOM}`
    this.onSubscribed = onSubscribed
    this.onClosed = onClosed
    this.onBroadcast = onBroadcast
    this.onPresence = onPresence
    this.ws = null
    this.ref = 0
    this.joinRef = null
    this.joined = false
    this.heartbeat = null
    this.heartbeatRef = null
    this.heartbeatDeadline = null
    this.lastMessageAt = 0
    this.presence = new Map()
    this.reconnectTimer = null
    this.wanted = false
    this.reconnectAttempts = 0
    this.openVersion = 0
  }

  connect() {
    this.wanted = true
    clearTimeout(this.reconnectTimer)
    this._open()
  }

  _nextRef() { return String(++this.ref) }

  _push(event, payload={}, topic=this.topic, ref=null) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return null
    const msgRef = ref || this._nextRef()
    this.ws.send(JSON.stringify({
      topic,
      event,
      payload,
      ref:msgRef,
      join_ref:this.joinRef
    }))
    return msgRef
  }

  async _open() {
    if (!this.wanted) return
    const openVersion = ++this.openVersion
    const url = supabaseWsUrl()
    if (!url) {
      this.onClosed?.('supabase_env_missing')
      return
    }
    const accessToken = await realtimeAccessToken()
    if (!this.wanted || openVersion !== this.openVersion) return
    if (!accessToken) {
      this.onClosed?.('authentication_required')
      this._scheduleReconnect(4000)
      return
    }
    try {
      const ws = this.ws = new WebSocket(url)
      ws.addEventListener('open', () => {
        if (ws !== this.ws) return
        const ref = this._nextRef()
        this.joinRef = ref
        ws.send(JSON.stringify({
          topic:this.topic,
          event:'phx_join',
          payload:{
            config:{
              broadcast:{ack:false,self:false},
              presence:{key:this.playerId},
              postgres_changes:[],
              private:true
            },
            access_token:accessToken
          },
          ref,
          join_ref:null
        }))
      })
      ws.addEventListener('message', e => {
        if (ws !== this.ws) return
        this.lastMessageAt = now()
        let m
        try { m = JSON.parse(e.data) } catch { return }
        if (!m || m.topic !== this.topic && m.topic !== 'phoenix') return

        if (m.event === 'phx_reply') {
          if (m.ref === this.joinRef) {
            if (m.payload?.status === 'ok') {
              this.joined = true
              this.reconnectAttempts = 0
              this._startHeartbeat()
              this.onSubscribed?.()
            } else {
              this._restart(`join_${m.payload?.status || 'error'}`)
            }
            return
          }
          if (m.ref === this.heartbeatRef) {
            clearTimeout(this.heartbeatDeadline)
            this.heartbeatDeadline = null
            this.heartbeatRef = null
            return
          }
        }

        if (m.event === 'presence_state') {
          this._applyPresenceState(m.payload || {})
          this.onPresence?.(this.snapshotPresence())
          return
        }
        if (m.event === 'presence_diff') {
          this._applyPresenceDiff(m.payload || {})
          this.onPresence?.(this.snapshotPresence())
          return
        }
        if (m.event === 'broadcast') {
          const ev = m.payload?.event
          if (ev) this.onBroadcast?.(ev, m.payload?.payload)
          return
        }
        if (m.event === 'phx_error' || m.event === 'phx_close') {
          this._restart(m.event)
        }
      })
      ws.addEventListener('close', () => {
        if (ws !== this.ws) return
        this.ws = null
        this.joined = false
        this._stopHeartbeat()
        this.onClosed?.('closed')
        this._scheduleReconnect()
      })
      ws.addEventListener('error', () => {})
    } catch (err) {
      this.onClosed?.(String(err?.message || err))
    }
  }

  _extractMetas(entry) {
    if (Array.isArray(entry)) return entry
    if (Array.isArray(entry?.metas)) return entry.metas
    return []
  }

  _applyPresenceState(state) {
    this.presence.clear()
    for (const [key, entry] of Object.entries(state || {})) {
      this.presence.set(key, this._extractMetas(entry))
    }
  }

  _applyPresenceDiff(diff) {
    for (const [key, entry] of Object.entries(diff.joins || {})) {
      const current = this.presence.get(key) || []
      const incoming = this._extractMetas(entry)
      const refs = new Set(current.map(x => x?.phx_ref || x?.presence_ref).filter(Boolean))
      for (const meta of incoming) {
        const r = meta?.phx_ref || meta?.presence_ref
        if (!r || !refs.has(r)) current.push(meta)
      }
      this.presence.set(key, current)
    }
    for (const [key, entry] of Object.entries(diff.leaves || {})) {
      const current = this.presence.get(key) || []
      const leaving = new Set(this._extractMetas(entry).map(x => x?.phx_ref || x?.presence_ref).filter(Boolean))
      const next = leaving.size ? current.filter(x => !leaving.has(x?.phx_ref || x?.presence_ref)) : []
      if (next.length) this.presence.set(key, next)
      else this.presence.delete(key)
    }
  }

  snapshotPresence() {
    const out = {}
    for (const [key, metas] of this.presence.entries()) out[key] = metas
    return out
  }

  track(payload) {
    if (!this.joined) return
    this._push('presence', {type:'presence', event:'track', payload})
  }

  broadcast(event, payload) {
    if (!this.joined) return false
    this._push('broadcast', {type:'broadcast', event, payload})
    return true
  }

  _startHeartbeat() {
    this._stopHeartbeat()
    const beat = () => {
      const ref = this._push('heartbeat', {}, 'phoenix')
      if (!ref) return this._restart('heartbeat_socket_closed')
      this.heartbeatRef = ref
      clearTimeout(this.heartbeatDeadline)
      this.heartbeatDeadline = setTimeout(() => {
        if (this.heartbeatRef === ref) this._restart('heartbeat_timeout')
      }, HEARTBEAT_TIMEOUT_MS)
    }
    beat()
    this.heartbeat = setInterval(beat, HEARTBEAT_INTERVAL_MS)
  }

  _stopHeartbeat() {
    clearInterval(this.heartbeat)
    clearTimeout(this.heartbeatDeadline)
    this.heartbeat = null
    this.heartbeatRef = null
    this.heartbeatDeadline = null
  }

  _scheduleReconnect(delay) {
    if (!this.wanted) return
    clearTimeout(this.reconnectTimer)
    const wait = Number.isFinite(delay) ? delay : Math.min(12000, 700 * Math.pow(1.7, this.reconnectAttempts++))
    this.reconnectTimer = setTimeout(() => this._open(), wait)
  }

  _restart(reason, delay) {
    if (!this.wanted) return
    const ws = this.ws
    this.ws = null
    this.joined = false
    this._stopHeartbeat()
    this.onClosed?.(reason)
    try { ws?.close() } catch {}
    this._scheduleReconnect(delay)
  }

  ensureHealthy() {
    if (!this.wanted) return
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.joined) {
      this._restart('resume', 0)
      return
    }
    if (now() - this.lastMessageAt > HEARTBEAT_INTERVAL_MS + HEARTBEAT_TIMEOUT_MS) this._restart('resume_stale', 0)
  }

  close() {
    this.wanted = false
    this.openVersion++
    clearTimeout(this.reconnectTimer)
    this._stopHeartbeat()
    try {
      if (this.joined) this._push('phx_leave', {})
    } catch {}
    const ws = this.ws
    this.ws = null
    try { ws?.close() } catch {}
    this.joined = false
    this.presence.clear()
  }
}

export const multiplayerLobbies = () => [GLOBAL_MULTIPLAYER_ROOM]
export const sameOriginMultiplayerUrl = () => ''
export const sameOriginHttpMultiplayerUrl = () => hasSupabase() ? 'supabase://realtime' : ''

export class MultiplayerClient {
  constructor({url='', room='', name='Aventureiro', onEvent=()=>{}}={}) {
    this.playerId = makeId()
    this.id = this.playerId
    this.room = GLOBAL_MULTIPLAYER_ROOM
    this.name = cleanName(name)
    this.onEvent = onEvent
    this.url = hasSupabase() ? 'supabase://realtime' : ''
    this.connected = false
    this.wanted = false
    this.transport = 'offline'
    this.latencyMs = 0
    this.lastPacketAt = 0
    this.lastSend = 0
    this.seq = 0
    this.lastPresenceTrack = 0
    this.lastState = safePlayer({name:this.name}, this.playerId)
    this.presenceIds = new Set()
    this.remoteState = new Map()
    this.pendingRemoteLeaves = new Map()
    this.seenEventIds = new Set()
    this.party = null
    this.authoritativeEconomy = false
    this.rt = null
    this._connectToken = 0
    storage?.setItem('shadow-ascension-last-lobby', GLOBAL_MULTIPLAYER_ROOM)
  }

  setIdentity(name) {
    this.name = cleanName(name)
    this.lastState.name = this.name
    if (this.transport === 'supabase' && this.connected) this._trackPresence(true)
  }

  setRoom(_room, {reconnect=true}={}) {
    this.room = GLOBAL_MULTIPLAYER_ROOM
    storage?.setItem('shadow-ascension-last-lobby', GLOBAL_MULTIPLAYER_ROOM)
    if (reconnect && this.wanted && !this.connected) this.connect()
    this.onEvent({type:'lobby', room:GLOBAL_MULTIPLAYER_ROOM})
    return GLOBAL_MULTIPLAYER_ROOM
  }

  setPlayerId(id) {
    if (!id) return
    const changed = this.playerId !== id
    this.playerId = id
    this.id = id
    if (this.lastState) this.lastState.id = id
    if (changed && this.connected) {
      this.connect()
    }
  }

  connect() {
    this.wanted = true
    this.room = GLOBAL_MULTIPLAYER_ROOM
    storage?.setItem('shadow-ascension-last-lobby', GLOBAL_MULTIPLAYER_ROOM)
    this.url = hasSupabase() ? 'supabase://realtime' : ''
    const token = ++this._connectToken
    this._teardown()

    if (hasSupabase()) {
      this._connectSupabase(token)
      return
    }
    this._emitConnection(false, 'Nenhum transporte multiplayer configurado.')
  }

  _connectSupabase(token) {
    this.transport = 'supabase'
    this.url = 'supabase://realtime'
    this.rt = new NativeSupabaseRealtime({
      playerId:this.playerId,
      onSubscribed:() => {
        if (token !== this._connectToken) return
        this.connected = true
        this.id = this.playerId
        this.lastPacketAt = now()
        this._trackPresence(true)
        this._emitConnection(true)
        this.onEvent({type:'welcome', id:this.playerId, room:GLOBAL_MULTIPLAYER_ROOM, players:[...this.remoteState.values()]})
        this.onEvent({type:'presence_count', count:this.remoteState.size + 1, players:[...this.remoteState.values()]})
        this._emitNetwork(true)
      },
      onClosed:reason => {
        if (token !== this._connectToken) return
        const was = this.connected
        this.connected = false
        if (was || reason !== 'closed') this._emitConnection(false, `Supabase Realtime: ${reason}`)
      },
      onBroadcast:(event, payload) => {
        if (token !== this._connectToken) return
        if (event === 'state') {
          const p = payload?.player
          if (!p?.id || p.id === this.playerId) return
          this.lastPacketAt = now()
          this._upsertRemote(p)
        } else if (event === 'game') {
          this._receiveGameEvent(payload)
        }
      },
      onPresence:state => {
        if (token !== this._connectToken) return
        this._presenceSync(state)
      }
    })
    this.rt.connect()
  }

  _emitConnection(connected, reason='') {
    this.onEvent({type:'connection', connected, reconnecting:this.wanted && !connected, url:this.url, transport:this.transport, room:GLOBAL_MULTIPLAYER_ROOM, reason})
  }

  _emitNetwork(force=false) {
    this.onEvent({
      type:'network',
      latencyMs:this.latencyMs,
      quality:this.connected ? 'realtime' : 'offline',
      lastPacketAt:this.lastPacketAt || now(),
      reconnecting:this.wanted && !this.connected,
      force
    })
  }

  _trackPresence(force=false) {
    if (!this.rt || !this.connected) return
    const t = now()
    if (!force && t - this.lastPresenceTrack < PRESENCE_RENEW_MS) return
    this.lastPresenceTrack = t
    const player = safePlayer({...this.lastState, name:this.name, lastSeen:t}, this.playerId)
    this.rt.track({player, online_at:new Date(t).toISOString(), room:GLOBAL_MULTIPLAYER_ROOM})
  }

  _upsertRemote(player) {
    this.pendingRemoteLeaves.delete(player.id)
    this.remoteState.set(player.id, player)
    this.onEvent({type:'state', player})
  }

  _pruneRemoteLeaves(t=now()) {
    for (const [id, expiresAt] of this.pendingRemoteLeaves) {
      if (expiresAt > t) continue
      this.pendingRemoteLeaves.delete(id)
      this.remoteState.delete(id)
      this.onEvent({type:'leave', id})
    }
  }

  _presenceSync(state={}) {
    const t = now()
    this._pruneRemoteLeaves(t)
    const next = new Set()
    for (const [key, entries] of Object.entries(state || {})) {
      if (key === this.playerId) continue
      const list = Array.isArray(entries) ? entries : Array.isArray(entries?.metas) ? entries.metas : []
      const meta = list[list.length-1]
      const p = meta?.player
      if (!p?.id) continue
      next.add(p.id)
      this._upsertRemote(p)
    }
    for (const oldId of this.presenceIds) {
      if (!next.has(oldId)) {
        this.pendingRemoteLeaves.set(oldId, t + REMOTE_LEAVE_GRACE_MS)
      }
    }
    this.presenceIds = next
    this.lastPacketAt = t
    this.onEvent({type:'presence_count', count:this.remoteState.size + 1, players:[...this.remoteState.values()]})
    this._emitNetwork()
  }

  _rememberEvent(eventId) {
    if (!eventId) return false
    if (this.seenEventIds.has(eventId)) return true
    this.seenEventIds.add(eventId)
    if (this.seenEventIds.size > 500) {
      const first = this.seenEventIds.values().next().value
      this.seenEventIds.delete(first)
    }
    return false
  }

  _receiveGameEvent(payload) {
    if (!payload || payload.from === this.playerId) return
    if (payload.to && payload.to !== this.playerId) return
    if (this._rememberEvent(payload.eventId)) return
    this.lastPacketAt = now()

    if (payload.type === 'party_join_request') {
      if (payload.to !== this.playerId) return
      if (!this.party) this.party = {id:`party-${uid().slice(0,8)}`, leaderId:this.playerId, members:[this.playerId], totalXP:0}
      if (!this.party.members.includes(payload.from) && this.party.members.length < 4) this.party.members.push(payload.from)
      this._publishParty()
      return
    }
    if (payload.type === 'party_state_wire') {
      const party = payload.party
      if (party?.members?.includes(this.playerId)) {
        this.party = party
        this.onEvent({type:'party_state', party})
      } else if (this.party?.id === party?.id) {
        this.party = null
        this.onEvent({type:'party_state', party:null})
      }
      return
    }
    this.onEvent(payload)
  }

  _broadcast(event, payload) {
    return !!this.rt?.broadcast(event, payload)
  }

  _publishParty() {
    if (!this.party) {
      this.onEvent({type:'party_state', party:null})
      return
    }
    this.party.members = [...new Set(this.party.members)].slice(0,4)
    this.onEvent({type:'party_state', party:this.party})
    this._broadcast('game', {type:'party_state_wire', eventId:uid(), from:this.playerId, party:this.party})
  }

  send(message={}) {
    if (!this.connected || this.transport !== 'supabase') return
    const m = {...message}

    if (m.type === 'party_create') {
      this.party = {id:`party-${uid().slice(0,8)}`, leaderId:this.playerId, members:[this.playerId], totalXP:0}
      this._publishParty()
      return
    }
    if (m.type === 'party_join') {
      const targetId = String(m.targetId || '')
      if (!targetId) return
      this._broadcast('game', {type:'party_join_request', eventId:uid(), from:this.playerId, fromName:this.name, to:targetId})
      return
    }
    if (m.type === 'party_leave') {
      if (this.party) {
        this.party.members = this.party.members.filter(id => id !== this.playerId)
        if (this.party.leaderId === this.playerId) this.party.leaderId = this.party.members[0] || null
        if (this.party.members.length) this._broadcast('game', {type:'party_state_wire', eventId:uid(), from:this.playerId, party:this.party})
      }
      this.party = null
      this.onEvent({type:'party_state', party:null})
      return
    }
    if (m.type === 'rename') {
      this.setIdentity(m.name)
      this.onEvent({type:'renamed', name:this.name})
      return
    }
    if (m.type === 'ping') {
      this.onEvent({type:'pong', clientTime:m.clientTime, serverTime:now()})
      return
    }
    // Realtime is for presence and animation only. It must never carry a value
    // that changes inventory, currency, XP, enemy HP, or global world state.
    if (!['combat', 'ability', 'dungeon_ready_check'].includes(m.type)) return
    this._broadcast('game', {...m, eventId:m.eventId || uid(), from:this.playerId, fromName:this.name, room:GLOBAL_MULTIPLAYER_ROOM})
  }

  sync(state, timestamp=performance.now()) {
    if (!this.connected || this.transport !== 'supabase') return
    this._pruneRemoteLeaves()
    const hidden = typeof document !== 'undefined' && document.hidden
    const interval = hidden ? 900 : 130
    if (timestamp - this.lastSend < interval) return
    this.lastSend = timestamp
    this.seq = (this.seq + 1) >>> 0
    const player = safePlayer({...this.lastState, ...state, id:this.playerId, name:this.name, seq:this.seq, lastSeen:now()}, this.playerId)
    this.lastState = player
    this._broadcast('state', {player})
    this._trackPresence(false)
  }

  saveProfile(game, updatedAt=Date.now(), force=false) {
    // Realtime Presence/Broadcast is not a durable database.
    // Preserve local cache but keep serverSave=false so the HUD never lies.
    try { storage?.setItem('shadow-ascension-profile-cache-v3', JSON.stringify({updatedAt, game})) } catch {}
    this.onEvent({type:'profile_saved', ok:false, localOnly:true, updatedAt})
  }

  getDiagnostics() {
    return {
      mode:this.transport,
      connected:this.connected,
      room:GLOBAL_MULTIPLAYER_ROOM,
      playerId:this.playerId,
      onlineOthers:this.remoteState.size,
      supabaseConfigured:hasSupabase(),
      supabaseUrl:SUPABASE_URL ? SUPABASE_URL.replace(/^(https:\/\/[^.]+).*/, '$1…') : '',
      lastPacketAt:this.lastPacketAt,
      channelTopic:`shadow-ascension:${GLOBAL_MULTIPLAYER_ROOM}`
    }
  }

  disconnect() {
    this.wanted = false
    this._connectToken++
    this._teardown()
    this.connected = false
    this.transport = 'offline'
    this._emitConnection(false)
  }

  _teardown() {
    try { this.rt?.close?.() } catch {}
    this.rt = null
    this.presenceIds.clear()
    this.remoteState.clear()
    this.pendingRemoteLeaves.clear()
  }

  ensureConnected() {
    if (!this.wanted) return
    if (this.transport === 'supabase') {
      this.rt?.ensureHealthy?.()
      if (!this.rt) this.connect()
      return
    }
    if (!this.connected) this.connect()
  }
}
