export default function clientLog(req, res) {
  res.setHeader('Allow', 'POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' })

  const body = req.body && typeof req.body === 'object' ? req.body : {}
  console.info('[client-log]', JSON.stringify({
    type: String(body.type || 'client').slice(0, 80),
    message: String(body.message || '').slice(0, 4000),
    url: String(body.url || '').slice(0, 1000),
    line: Number(body.line) || 0,
    column: Number(body.column) || 0
  }))
  return res.status(200).json({ ok: true })
}
