// Shadow Ascension — Account isolation + inventory recovery hotfix V4
// Purpose:
// 1) force a one-time reset of legacy client-side account/save identity after deployment;
// 2) isolate save/nick/multiplayer identity per signed-in account;
// 3) prevent malformed inventory/profile data from crashing the inventory UI.
//
// This module intentionally does NOT contain Supabase service-role secrets and does NOT
// delete database rows from the browser. Database reset remains a one-time SQL/admin task.

import { ShadowGame } from './engine.js'

const RESET_MARKER = 'shadow-ascension-account-reset-2026-09-14-v4'
const ACTIVE_ACCOUNT_KEY = 'shadow-ascension-active-account-v4'
const PATCH_MARKER = '__accountInventoryHotfixV4'

const local = typeof window !== 'undefined' ? window.localStorage : null
const session = typeof window !== 'undefined' ? window.sessionStorage : null

// Capture native Storage methods before installing the account scope shim.
const StorageProto = typeof Storage !== 'undefined' ? Storage.prototype : null
const nativeGet = StorageProto?.getItem
const nativeSet = StorageProto?.setItem
const nativeRemove = StorageProto?.removeItem
const nativeKey = StorageProto?.key

const rawGet = (store, key) => {
  try { return nativeGet?.call(store, key) ?? null } catch { return null }
}
const rawSet = (store, key, value) => {
  try { nativeSet?.call(store, key, String(value)); return true } catch { return false }
}
const rawRemove = (store, key) => {
  try { nativeRemove?.call(store, key); return true } catch { return false }
}

function tinyHash(value) {
  let h = 2166136261 >>> 0
  const text = String(value || '')
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h.toString(36)
}

function accountTokenFrom(sessionValue, profile) {
  const user = sessionValue?.user || sessionValue?.session?.user || null
  const candidate =
    user?.id ||
    sessionValue?.user_id ||
    sessionValue?.account_id ||
    sessionValue?.player_id ||
    sessionValue?.id ||
    profile?.user_id ||
    profile?.account_id ||
    profile?.player_id ||
    profile?.id ||
    user?.email ||
    sessionValue?.email ||
    profile?.email ||
    profile?.username ||
    profile?.display_name ||
    profile?.name ||
    ''
  const normalized = String(candidate || '').normalize('NFKC').trim().toLowerCase()
  return normalized ? `acct-${tinyHash(normalized)}` : ''
}

function currentAccountToken() {
  return rawGet(local, ACTIVE_ACCOUNT_KEY) || 'guest'
}

function isScopedGameKey(key) {
  const k = String(key || '')
  return (
    /^shadow-ascension-save(?:-backup|-v\d+)?$/i.test(k) ||
    k === 'shadow-ascension-player-id' ||
    k === 'shadow-ascension-nick' ||
    k === 'shadow-ascension-profile-cache-v3' ||
    k === 'shadow-ascension-profile-cache-v4'
  )
}

function scopedKey(key) {
  return isScopedGameKey(key) ? `${String(key)}::${currentAccountToken()}` : String(key)
}

function removeLegacyClientAccountsOnce() {
  if (!local || rawGet(local, RESET_MARKER) === '1') return

  const shouldDelete = key => {
    const k = String(key || '')
    if (k === RESET_MARKER) return false
    if (/^sb-[a-z0-9_-]+-auth-token$/i.test(k)) return true
    if (/^shadow-ascension-save(?:-backup|-v\d+)?(?:::.+)?$/i.test(k)) return true
    if (/^shadow-ascension-(?:player-id|nick|profile-cache[^:]*|active-account[^:]*|account[^:]*|auth[^:]*|login[^:]*|user-session[^:]*)(?:::.+)?$/i.test(k)) return true
    return false
  }

  for (const store of [local, session]) {
    if (!store) continue
    const keys = []
    try {
      for (let i = 0; i < store.length; i++) {
        const k = nativeKey?.call(store, i)
        if (k) keys.push(k)
      }
    } catch {}
    for (const key of keys) if (shouldDelete(key)) rawRemove(store, key)
  }

  // Clear non-HttpOnly auth/account cookies that can keep a stale browser session alive.
  try {
    const cookies = String(document.cookie || '').split(';')
    for (const part of cookies) {
      const name = part.split('=')[0]?.trim()
      if (!name) continue
      if (/^(?:sb-|shadow-ascension)/i.test(name)) {
        document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`
      }
    }
  } catch {}

  rawRemove(local, ACTIVE_ACCOUNT_KEY)
  rawSet(local, RESET_MARKER, '1')
  console.info('[Shadow Ascension] Reset V4: identidades/saves locais antigos foram limpos uma vez.')
}

function installAccountScopedStorage() {
  if (!StorageProto || StorageProto.__shadowAccountScopeV4) return
  Object.defineProperty(StorageProto, '__shadowAccountScopeV4', { value: true, configurable: false })

  StorageProto.getItem = function shadowScopedGetItem(key) {
    return nativeGet.call(this, this === local ? scopedKey(key) : String(key))
  }
  StorageProto.setItem = function shadowScopedSetItem(key, value) {
    return nativeSet.call(this, this === local ? scopedKey(key) : String(key), value)
  }
  StorageProto.removeItem = function shadowScopedRemoveItem(key) {
    return nativeRemove.call(this, this === local ? scopedKey(key) : String(key))
  }
}

function safeText(value, fallback='') {
  if (typeof value === 'string') return value
  if (value == null) return fallback
  try { return String(value) } catch { return fallback }
}

function sanitizeOneItem(item, index=0, usedIds=null) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null
  const out = item
  let id = safeText(out.id).trim()
  if (!id || usedIds?.has(id)) {
    const base = safeText(out.name, 'item').normalize('NFKC').replace(/[^\p{L}\p{N}_-]/gu, '-').slice(0, 30) || 'item'
    id = `recovered-${base}-${index}-${tinyHash(`${base}:${index}:${safeText(out.level)}`)}`
    out.id = id
  }
  usedIds?.add(id)
  if (typeof out.name !== 'string' || !out.name.trim()) out.name = safeText(out.name, 'Item recuperado') || 'Item recuperado'
  if (out.type != null && typeof out.type !== 'string') out.type = safeText(out.type)
  if (out.subtype != null && typeof out.subtype !== 'string') out.subtype = safeText(out.subtype)
  if (out.rarity != null && typeof out.rarity !== 'string') out.rarity = safeText(out.rarity, 'Comum')
  if (!out.rarity) out.rarity = 'Comum'
  if (!out.stats || typeof out.stats !== 'object' || Array.isArray(out.stats)) out.stats = {}
  if (!Number.isFinite(Number(out.qty)) || Number(out.qty) <= 0) out.qty = 1
  if (out.level != null && !Number.isFinite(Number(out.level))) out.level = 1
  return out
}

function sanitizeGameInventory(game) {
  const state = game?.state
  if (!state) return false
  let repaired = false
  if (!Array.isArray(state.inventory)) {
    state.inventory = []
    repaired = true
  }
  const usedIds = new Set()
  const next = []
  for (let i = 0; i < state.inventory.length; i++) {
    const before = state.inventory[i]
    const item = sanitizeOneItem(before, i, usedIds)
    if (!item) { repaired = true; continue }
    next.push(item)
  }
  if (next.length !== state.inventory.length) repaired = true
  state.inventory = next

  if (!state.equipment || typeof state.equipment !== 'object' || Array.isArray(state.equipment)) {
    state.equipment = { weapon:null, armor:null, boots:null, talisman:null }
    repaired = true
  }
  for (const slot of ['weapon','armor','boots','talisman']) {
    const value = state.equipment[slot]
    if (value == null) { state.equipment[slot] = null; continue }
    const item = sanitizeOneItem(value, 1000 + ['weapon','armor','boots','talisman'].indexOf(slot), null)
    if (!item) { state.equipment[slot] = null; repaired = true }
    else state.equipment[slot] = item
  }

  if (repaired && !game.__inventoryRecoveryLoggedV4) {
    game.__inventoryRecoveryLoggedV4 = true
    console.warn('[Shadow Ascension] Inventário corrompido/incompatível foi saneado pelo Hotfix V4.')
  }
  return repaired
}

function activateAccountAndReload(nextToken) {
  if (!local || !nextToken) return false
  rawSet(local, ACTIVE_ACCOUNT_KEY, nextToken)
  try {
    // Ensure the next boot creates/loads a multiplayer identity scoped to the account.
    const playerKey = `shadow-ascension-player-id::${nextToken}`
    if (!rawGet(local, playerKey)) {
      const id = globalThis.crypto?.randomUUID?.() || `player-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`
      rawSet(local, playerKey, id)
    }
  } catch {}
  setTimeout(() => {
    try { window.location.reload() } catch {}
  }, 40)
  return true
}

function patchGamePrototype() {
  const p = ShadowGame?.prototype
  if (!p || p[PATCH_MARKER]) return
  Object.defineProperty(p, PATCH_MARKER, { value:true, configurable:false })

  for (const method of ['loadGame','applyServerProfile','emitHud','saveGame']) {
    if (typeof p[method] !== 'function') continue
    const prev = p[method]
    p[method] = function inventorySafeLifecycleV4(...args) {
      if (method === 'emitHud' || method === 'saveGame') sanitizeGameInventory(this)
      const result = prev.apply(this, args)
      if (method === 'loadGame' || method === 'applyServerProfile') sanitizeGameInventory(this)
      return result
    }
  }

  if (typeof p.togglePanel === 'function') {
    const prev = p.togglePanel
    p.togglePanel = function inventorySafeTogglePanelV4(panel, ...rest) {
      if (panel === 'inventory') sanitizeGameInventory(this)
      try {
        return prev.call(this, panel, ...rest)
      } catch (error) {
        console.error('[Shadow Ascension] Falha ao abrir painel:', panel, error)
        if (panel === 'inventory') {
          sanitizeGameInventory(this)
          this.state.uiPanel = 'inventory'
          this.state.dialogue = null
          return true
        }
        throw error
      }
    }
  }

  if (typeof p.equipItem === 'function') {
    const prev = p.equipItem
    p.equipItem = function safeEquipItemV4(id, ...rest) {
      sanitizeGameInventory(this)
      const cleanId = safeText(id).trim()
      if (!cleanId) return false
      const exists = this.state.inventory.some(item => item?.id === cleanId)
      if (!exists) {
        this.toast?.('Este item não está mais disponível na mochila.')
        return false
      }
      try {
        const result = prev.call(this, cleanId, ...rest)
        sanitizeGameInventory(this)
        return result ?? true
      } catch (error) {
        console.error('[Shadow Ascension] Erro ao equipar item:', error)
        this.toast?.('Não foi possível equipar este item. O inventário foi recuperado.')
        sanitizeGameInventory(this)
        return false
      }
    }
  }

  if (typeof p.unequip === 'function') {
    const prev = p.unequip
    p.unequip = function safeUnequipV4(slot, ...rest) {
      sanitizeGameInventory(this)
      try {
        const result = prev.call(this, slot, ...rest)
        sanitizeGameInventory(this)
        return result ?? true
      } catch (error) {
        console.error('[Shadow Ascension] Erro ao desequipar item:', error)
        sanitizeGameInventory(this)
        return false
      }
    }
  }

  // Current GitHub builds expose setPlayerAccount(session, profile). When a different
  // authenticated account is selected, persist the account token OUTSIDE the scoped
  // store and reload once. On the next boot all legacy save/nick/player-id calls are
  // automatically redirected to that account's own keys.
  if (typeof p.setPlayerAccount === 'function') {
    const prev = p.setPlayerAccount
    p.setPlayerAccount = function isolatedSetPlayerAccountV4(sessionValue, profile, ...rest) {
      const nextToken = accountTokenFrom(sessionValue, profile)
      const previousToken = rawGet(local, ACTIVE_ACCOUNT_KEY) || ''
      if (nextToken && previousToken !== nextToken) {
        // Switch the storage scope BEFORE the original account hook runs, so any
        // nickname/profile writes produced by it already land in the new account.
        rawSet(local, ACTIVE_ACCOUNT_KEY, nextToken)
        try { this.multiplayer?.disconnect?.() } catch {}
        const result = prev.call(this, sessionValue, profile, ...rest)
        activateAccountAndReload(nextToken)
        return result
      }
      const result = prev.call(this, sessionValue, profile, ...rest)
      sanitizeGameInventory(this)
      return result
    }
  }
}

removeLegacyClientAccountsOnce()
installAccountScopedStorage()
patchGamePrototype()

export const shadowAccountInventoryHotfixV4 = {
  version:'4',
  activeAccount:() => currentAccountToken(),
  sanitizeInventory:sanitizeGameInventory
}
