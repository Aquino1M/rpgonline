import { createClient } from 'npm:@supabase/supabase-js@2'

const productionOrigin = 'https://rpgonline-orpin.vercel.app'
const isAllowedOrigin = (origin: string) => origin === productionOrigin || /^http:\/\/(localhost|127\.0\.0\.1)(?::\d+)?$/.test(origin)
const cors = (origin: string) => ({
  'Access-Control-Allow-Origin': isAllowedOrigin(origin) ? origin : productionOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
  'Vary': 'Origin'
})
const json = (body: unknown, status: number, origin: string) => new Response(JSON.stringify(body), { status, headers:cors(origin) })
const cleanUsername = (value: unknown) => String(value || '').normalize('NFKC').replace(/[^\p{L}\p{N} _.\-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 20)
const internalEmail = (username: string) => `u-${[...new TextEncoder().encode(username.toLocaleLowerCase())].map(x => x.toString(16).padStart(2, '0')).join('')}@rpgonline-orpin.vercel.app`

async function hash(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async req => {
  const origin = req.headers.get('origin') || ''
  if (req.method === 'OPTIONS') return new Response('ok', { headers:cors(origin) })
  if (req.method !== 'POST' || !isAllowedOrigin(origin)) return json({ error:'Requisição não permitida.' }, 403, origin)

  const body = await req.json().catch(() => null)
  const action = body?.action === 'register' ? 'register' : body?.action === 'login' ? 'login' : ''
  const username = cleanUsername(body?.username)
  const password = String(body?.password || '')
  if (!action || username.length < 3 || password.length < 8) return json({ error:'Nickname ou senha inválidos.' }, 400, origin)

  const url = Deno.env.get('SUPABASE_URL') || ''
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
  if (!url || !serviceRole || !anonKey) return json({ error:'Servidor de contas indisponível.' }, 503, origin)
  const admin = createClient(url, serviceRole, { auth:{ autoRefreshToken:false, persistSession:false } })
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const key = `${action}:${await hash(ip)}`
  const maxAttempts = action === 'register' ? 5 : 30
  const cutoff = new Date(Date.now() - 15 * 60_000).toISOString()
  const { data:old, error:readLimitError } = await admin.from('account_auth_limits').select('attempts, window_started_at').eq('id', key).maybeSingle()
  if (readLimitError) return json({ error:'Servidor de contas indisponível.' }, 503, origin)
  const attempts = old && old.window_started_at >= cutoff ? old.attempts + 1 : 1
  if (attempts > maxAttempts) return json({ error:'Muitas tentativas. Aguarde alguns minutos.' }, 429, origin)
  const { error:writeLimitError } = await admin.from('account_auth_limits').upsert({ id:key, attempts, window_started_at:attempts === 1 ? new Date().toISOString() : old.window_started_at })
  if (writeLimitError) return json({ error:'Servidor de contas indisponível.' }, 503, origin)

  const email = internalEmail(username)
  if (action === 'register') {
    const { data:userData, error } = await admin.auth.admin.createUser({ email, password, email_confirm:true, user_metadata:{ username } })
    if (error || !userData.user) return json({ error:'Nickname indisponível ou não foi possível criar a conta.' }, 409, origin)
    const { error:profileError } = await admin.from('player_profiles').insert({ id:userData.user.id, user_id:userData.user.id, name:username, level:1, guild_rank:'E', last_lobby:'asterra-global', game_data:null })
    if (profileError) {
      await admin.auth.admin.deleteUser(userData.user.id)
      return json({ error:'Não foi possível preparar o perfil da conta.' }, 500, origin)
    }
  }

  const signIn = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method:'POST', headers:{ apikey:anonKey, Authorization:`Bearer ${anonKey}`, 'Content-Type':'application/json' }, body:JSON.stringify({ email, password })
  })
  const session = await signIn.json().catch(() => null)
  if (!signIn.ok || !session?.access_token || !session?.refresh_token) return json({ error:'Nickname ou senha incorretos.' }, 401, origin)
  return json({ session:{ access_token:session.access_token, refresh_token:session.refresh_token } }, 200, origin)
})
