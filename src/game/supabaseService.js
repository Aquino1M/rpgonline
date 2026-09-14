import { createClient } from '@supabase/supabase-js'

const DEFAULT_ANON_KEY = 'sb_publishable_zB3YmZc3TNkKCHzHWQ-X5g_kKRvlkRI'
const DEFAULT_PROJECT_URL = 'https://kfnlcrsnvckexzmhbyoy.supabase.co'

export function getSupabaseConfig() {
  const envUrl = typeof import.meta !== 'undefined' && import.meta.env ? (import.meta.env.VITE_SUPABASE_URL || '') : ''
  const envKey = typeof import.meta !== 'undefined' && import.meta.env ? (import.meta.env.VITE_SUPABASE_ANON_KEY || '') : ''
  const localUrl = typeof window !== 'undefined' ? (window.localStorage.getItem('shadow-ascension-supabase-url') || '') : ''
  const localKey = typeof window !== 'undefined' ? (window.localStorage.getItem('shadow-ascension-supabase-key') || '') : ''

  const url = (localUrl || envUrl || DEFAULT_PROJECT_URL).trim()
  const key = (localKey || envKey || DEFAULT_ANON_KEY).trim()

  return { url, key }
}

export function isSupabaseConfigured() {
  const { url, key } = getSupabaseConfig()
  return Boolean(url && /^https?:\/\//i.test(url) && !url.includes('seu-projeto') && key)
}

export function saveSupabaseConfig(url, key) {
  if (typeof window === 'undefined') return
  if (url !== undefined) {
    if (url) window.localStorage.setItem('shadow-ascension-supabase-url', url.trim())
    else window.localStorage.removeItem('shadow-ascension-supabase-url')
  }
  if (key !== undefined) {
    if (key) window.localStorage.setItem('shadow-ascension-supabase-key', key.trim())
    else window.localStorage.removeItem('shadow-ascension-supabase-key')
  }
}

let cachedClient = null
let currentClientUrl = ''
let currentClientKey = ''

export function getSupabaseClient() {
  const { url, key } = getSupabaseConfig()
  if (!url || !key || !/^https?:\/\//i.test(url) || url.includes('seu-projeto')) return null

  if (cachedClient && currentClientUrl === url && currentClientKey === key) {
    return cachedClient
  }

  try {
    cachedClient = createClient(url, key, {
      realtime: {
        params: {
          eventsPerSecond: 20
        }
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })
    currentClientUrl = url
    currentClientKey = key
    return cachedClient
  } catch (err) {
    console.error('[Supabase] Falha ao inicializar client:', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// CLOUD DATABASE SAVE / LOAD
// ---------------------------------------------------------------------------

export async function loadCloudProfile(playerId) {
  const client = getSupabaseClient()
  if (!client || !playerId) return null

  try {
    const { data, error } = await client
      .from('player_profiles')
      .select('*')
      .eq('id', playerId)
      .maybeSingle()

    if (error) {
      console.warn('[Supabase] Erro ao carregar perfil:', error.message)
      return null
    }

    if (!data) return null

    return {
      id: data.id,
      name: data.name,
      level: data.level,
      guildRank: data.guild_rank,
      lastLobby: data.last_lobby,
      updatedAt: data.updated_at ? new Date(data.updated_at).getTime() : 0,
      game: data.game_data || null
    }
  } catch (err) {
    console.warn('[Supabase] Exceção ao ler perfil:', err)
    return null
  }
}

export async function saveCloudProfile({ id, name, game, lastLobby = 'asterra-01', level = 1, guildRank = 'E', updatedAt = Date.now() }) {
  const client = getSupabaseClient()
  if (!client || !id) return { ok: false, error: 'not_configured' }

  try {
    const payload = {
      id,
      name: String(name || 'Aventureiro').slice(0, 32),
      level: Number(level) || 1,
      guild_rank: String(guildRank || 'E').slice(0, 8),
      last_lobby: String(lastLobby || 'asterra-01'),
      game_data: game || null,
      updated_at: new Date(updatedAt || Date.now()).toISOString()
    }

    const { error } = await client
      .from('player_profiles')
      .upsert(payload, { onConflict: 'id' })

    if (error) {
      console.warn('[Supabase] Erro ao salvar perfil:', error.message)
      return { ok: false, error: error.message }
    }

    return { ok: true, updatedAt }
  } catch (err) {
    console.warn('[Supabase] Exceção ao salvar perfil:', err)
    return { ok: false, error: String(err?.message || err) }
  }
}

// ---------------------------------------------------------------------------
// REALTIME MULTIPLAYER CHANNEL
// ---------------------------------------------------------------------------

export class SupabaseRealtimeTransport {
  constructor({ room, playerId, name = 'Aventureiro', onEvent = () => {} }) {
    this.room = room
    this.playerId = playerId
    this.name = name
    this.onEvent = onEvent
    this.channel = null
    this.client = null
    this.connected = false
    this.latencyMs = 0
    this.lastPingTime = 0
    this.pingTimer = null
    this.roster = new Map()
  }

  connect() {
    this.disconnect()
    this.client = getSupabaseClient()
    if (!this.client) {
      this.onEvent({
        type: 'connection',
        connected: false,
        transport: 'supabase',
        room: this.room,
        reason: 'URL do Supabase não configurada no .env ou nas Opções.'
      })
      return false
    }

    const channelName = `rpg_room_${this.room}`
    const channel = this.client.channel(channelName, {
      config: {
        presence: {
          key: this.playerId
        },
        broadcast: {
          self: false
        }
      }
    })

    // Presence: rastreio de jogadores conectados no mesmo lobby
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const currentIds = new Set()
        const players = []

        for (const [key, presences] of Object.entries(state)) {
          if (!presences || !presences.length) continue
          const p = presences[presences.length - 1]
          if (p && p.id && p.id !== this.playerId) {
            currentIds.add(p.id)
            players.push(p)
            this.roster.set(p.id, p)
            this.onEvent({ type: 'state', player: p })
          }
        }

        // Jogadores que saíram
        for (const [id] of this.roster.entries()) {
          if (!currentIds.has(id)) {
            this.roster.delete(id)
            this.onEvent({ type: 'leave', id })
          }
        }

        this.onEvent({
          type: 'roster_sync',
          players,
          count: this.roster.size
        })
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        for (const p of newPresences || []) {
          if (p && p.id && p.id !== this.playerId) {
            this.roster.set(p.id, p)
            this.onEvent({ type: 'state', player: p })
          }
        }
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        for (const p of leftPresences || []) {
          if (p && p.id) {
            this.roster.delete(p.id)
            this.onEvent({ type: 'leave', id: p.id })
          }
        }
      })

    // Broadcast: eventos rápidos (ataques, posições contínuas, dano, equipe, troca)
    channel.on('broadcast', { event: 'game_event' }, ({ payload }) => {
      if (!payload) return
      if (payload.from === this.playerId) return
      if (payload.to && payload.to !== this.playerId) return

      if (payload.type === 'state' && payload.player) {
        this.roster.set(payload.player.id, payload.player)
        this.onEvent({ type: 'state', player: payload.player })
        return
      }

      if (payload.type === 'ping_req' && payload.targetId === this.playerId) {
        this.send({
          type: 'pong_res',
          to: payload.from,
          reqTime: payload.time
        })
        return
      }

      if (payload.type === 'pong_res' && payload.reqTime) {
        this.latencyMs = Math.max(1, Date.now() - payload.reqTime)
        this.onEvent({
          type: 'network',
          latencyMs: this.latencyMs,
          quality: this.latencyMs < 90 ? 'excelente' : this.latencyMs < 180 ? 'boa' : 'media'
        })
        return
      }

      this.onEvent(payload)
    })

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        this.connected = true
        this.onEvent({
          type: 'connection',
          connected: true,
          transport: 'supabase',
          room: this.room,
          url: currentClientUrl
        })
        this.onEvent({
          type: 'welcome',
          id: this.playerId,
          room: this.room,
          players: Array.from(this.roster.values())
        })

        // Rastrear presença inicial
        channel.track({
          id: this.playerId,
          name: this.name,
          lastSeen: Date.now()
        })

        this._startPing()
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        this.connected = false
        this.onEvent({
          type: 'connection',
          connected: false,
          transport: 'supabase',
          room: this.room,
          reason: `Canal ${status.toLowerCase()}`
        })
      } else if (status === 'CLOSED') {
        this.connected = false
      }
    })

    this.channel = channel
    return true
  }

  _startPing() {
    clearInterval(this.pingTimer)
    this.pingTimer = setInterval(() => {
      if (!this.connected || !this.roster.size) return
      const firstPeer = this.roster.keys().next().value
      if (!firstPeer) return
      this.send({
        type: 'ping_req',
        from: this.playerId,
        targetId: firstPeer,
        time: Date.now()
      })
    }, 6000)
  }

  send(msg) {
    if (!this.channel || !this.connected) return
    try {
      this.channel.send({
        type: 'broadcast',
        event: 'game_event',
        payload: {
          ...msg,
          from: this.playerId,
          room: this.room,
          ts: Date.now()
        }
      })
    } catch (err) {
      console.warn('[Supabase] Falha ao enviar broadcast:', err)
    }
  }

  sync(state) {
    if (!this.channel || !this.connected) return
    const payload = {
      ...state,
      id: this.playerId,
      name: this.name,
      lastSeen: Date.now()
    }

    // Enviar broadcast rápido para movimentação suave
    this.send({
      type: 'state',
      player: payload
    })

    // Atualizar periodicamente o presence
    if (!this._lastPresenceTrack || Date.now() - this._lastPresenceTrack > 3000) {
      this._lastPresenceTrack = Date.now()
      this.channel.track(payload).catch(() => {})
    }
  }

  disconnect() {
    clearInterval(this.pingTimer)
    this.pingTimer = null
    if (this.channel) {
      try {
        if (this.client) {
          this.client.removeChannel(this.channel)
        }
      } catch {}
      this.channel = null
    }
    this.connected = false
    this.roster.clear()
  }
}
