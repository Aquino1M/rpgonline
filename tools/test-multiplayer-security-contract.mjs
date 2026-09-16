import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/game/supabaseMultiplayerV3.js', import.meta.url), 'utf8')
const migration = await readFile(new URL('../supabase/migrations/20260916090000_lock_down_profiles_and_realtime.sql', import.meta.url), 'utf8')

assert.match(source, /private:SUPABASE_PRIVATE_REALTIME/, 'o canal deve usar o modo privado após a migration')
assert.match(source, /authentication_required/, 'o canal deve exigir sessão autenticada')
assert.match(source, /\['combat', 'ability', 'dungeon_ready_check'\]/, 'somente eventos cosméticos podem sair pelo Realtime')
assert.match(migration, /alter table public\.player_profiles enable row level security/i)
assert.match(migration, /realtime\.topic\(\) = 'realtime:shadow-ascension:asterra-global'/)
console.log('multiplayer security contract: ok')
