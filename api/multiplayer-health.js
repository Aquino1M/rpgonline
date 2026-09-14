// Vercel diagnostics endpoint for Shadow Ascension multiplayer.
// It never returns keys/secrets. GET /api/multiplayer-health
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method !== 'GET') return res.status(405).json({ok:false, error:'method_not_allowed'})

  const url = String(
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ''
  ).trim()
  const key = String(
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''
  ).trim()

  const result = {
    ok:false,
    mode:'supabase-realtime',
    room:'asterra-global',
    urlConfigured:!!url,
    publicKeyConfigured:!!key,
    restReachable:false,
    status:null,
    now:Date.now()
  }

  if (!url || !key) {
    return res.status(503).json({...result, error:'supabase_env_missing'})
  }

  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 4500)
    let r = await fetch(`${url.replace(/\/$/,'')}/auth/v1/health`, {
      headers:{apikey:key},
      cache:'no-store',
      signal:ctrl.signal
    }).catch(() => null)
    if (!r || !r.ok) {
      r = await fetch(`${url.replace(/\/$/,'')}/rest/v1/player_profiles?select=count`, {
        headers:{apikey:key, Authorization:`Bearer ${key}`},
        cache:'no-store',
        signal:ctrl.signal
      }).catch(() => null)
    }
    if (!r) {
      r = await fetch(`${url.replace(/\/$/,'')}/rest/v1/`, {
        headers:{apikey:key, Authorization:`Bearer ${key}`},
        cache:'no-store',
        signal:ctrl.signal
      })
    }
    clearTimeout(timer)
    result.restReachable = r.ok
    result.status = r.status
    result.ok = r.ok
    return res.status(r.ok ? 200 : 502).json(result)
  } catch (err) {
    return res.status(502).json({...result, error:'supabase_unreachable', message:String(err?.message||err)})
  }
}
