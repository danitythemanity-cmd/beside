// Vercel serverless function: ICE servers for WebRTC (live sync and video).
//
// Devices on different networks (mobile data and Wi-Fi, most offices and
// schools) can't reach each other directly; their traffic must go through a
// TURN relay. This hands the browser short-lived relay credentials.
//
//   CLOUDFLARE_TURN_KEY_ID + CLOUDFLARE_TURN_KEY_API_TOKEN   Cloudflare TURN (free tier)
//   TURN_URLS + TURN_USERNAME + TURN_CREDENTIAL             any other TURN provider
//
// GET /api/ice -> { iceServers: RTCIceServer[], relay: boolean }

const STUN = [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }]

async function cloudflare(id, token) {
  const res = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(id)}/credentials/generate-ice-servers`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ttl: 86400 }),
  })
  if (!res.ok) throw new Error(`Cloudflare TURN ${res.status}`)
  const data = await res.json()
  // The API has returned both a list and a single object over time.
  const servers = Array.isArray(data.iceServers) ? data.iceServers : [data.iceServers]
  // Browsers reject port 53, which Cloudflare sometimes includes.
  return servers
    .filter(Boolean)
    .map((s) => ({ ...s, urls: [].concat(s.urls).filter((u) => !/:53(\?|$)/.test(u)) }))
    .filter((s) => s.urls.length)
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Use GET' })
  res.setHeader('Cache-Control', 'no-store')

  const { CLOUDFLARE_TURN_KEY_ID: cfId, CLOUDFLARE_TURN_KEY_API_TOKEN: cfToken, TURN_URLS, TURN_USERNAME, TURN_CREDENTIAL } = process.env
  try {
    if (cfId && cfToken) {
      const servers = await cloudflare(cfId, cfToken)
      return res.status(200).json({ iceServers: servers, relay: servers.some((s) => s.credential) })
    }
    if (TURN_URLS && TURN_USERNAME && TURN_CREDENTIAL) {
      const turn = { urls: TURN_URLS.split(',').map((u) => u.trim()).filter(Boolean), username: TURN_USERNAME, credential: TURN_CREDENTIAL }
      return res.status(200).json({ iceServers: [...STUN, turn], relay: true })
    }
  } catch (err) {
    console.error('[ice]', err.message)
  }
  // No relay configured: devices on the same network still connect.
  return res.status(200).json({ iceServers: STUN, relay: false })
}
