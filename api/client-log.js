export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'method_not_allowed' })

  const body = typeof req.body === 'object' && req.body ? req.body : {}
  console.error('[client-log]', {
    type:String(body.type || 'unknown').slice(0,80),
    message:String(body.message || '').slice(0,500),
    url:String(body.url || '').slice(0,300),
    ts:String(body.ts || '').slice(0,40)
  })
  return res.status(204).end()
}
