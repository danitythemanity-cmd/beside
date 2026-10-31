// Vercel serverless function: realistic text to speech (Orpheus on Groq).
// Every phrase Beside says aloud comes through here; the browser's built-in
// voice is only the fallback.
//
// POST /api/speak { text, voice? } -> audio/wav

const ENDPOINT = 'https://api.groq.com/openai/v1/audio/speech'
const MAX_CHARS = 400 // the app sends sentence-sized pieces; this only stops abuse

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' })
  const { text, voice } = req.body ?? {}
  const input = typeof text === 'string' ? text.trim().slice(0, MAX_CHARS) : ''
  if (!input) return res.status(400).json({ error: 'Nothing to say' })
  const key = process.env.GROQ_API_KEY
  if (!key) return res.status(503).json({ error: 'Realistic voice needs GROQ_API_KEY' })

  try {
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.GROQ_TTS_MODEL || 'canopylabs/orpheus-v1-english',
        voice: typeof voice === 'string' && /^[a-z-]{2,30}$/i.test(voice) ? voice : DEFAULT_VOICE,
        input,
        response_format: 'wav',
      }),
    })
    if (!r.ok) {
      const detail = await r.json().catch(() => ({}))
      console.error('[speak]', r.status, detail.error?.code ?? '', detail.error?.message?.slice(0, 160) ?? '')
      // 403/400 with code model_terms_required: the Groq account must accept the model's terms once.
      return res.status(r.status === 429 ? 429 : 502).json({ error: 'Voice unavailable', code: detail.error?.code ?? null })
    }
    const audio = tidyWav(Buffer.from(await r.arrayBuffer()))
    res.setHeader('Content-Type', 'audio/wav')
    res.setHeader('Cache-Control', 'private, max-age=86400')
    return res.end(audio)
  } catch (err) {
    console.error('[speak]', err.message)
    return res.status(502).json({ error: 'Voice unavailable' })
  }
}

export const DEFAULT_VOICE = 'hannah' // same as src/core/speech.js

// Groq streams WAV with unknown lengths (0xFFFFFFFF), which Safari won't play,
// and pads speech with up to a second of silence. Rewrite the clip with real
// lengths and the silence trimmed, so a tap is heard right away.
export function tidyWav(buf) {
  if (buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') return buf
  let fmt = -1
  let data = -1
  for (let at = 12; at + 8 <= buf.length; ) {
    const id = buf.toString('ascii', at, at + 4)
    const size = buf.readUInt32LE(at + 4)
    if (id === 'fmt ') fmt = at + 8
    if (id === 'data') {
      data = at + 8
      break
    }
    at += 8 + size + (size % 2)
  }
  if (data < 0) return buf
  let pcm = buf.subarray(data)
  const pcm16 = fmt > 0 && buf.readUInt16LE(fmt) === 1 && buf.readUInt16LE(fmt + 14) === 16
  if (pcm16) {
    const rate = buf.readUInt32LE(fmt + 4) * buf.readUInt16LE(fmt + 2)
    const n = pcm.length >> 1
    const loud = (i) => Math.abs(pcm.readInt16LE(i * 2)) > 500
    let first = 0
    while (first < n && !loud(first)) first++
    let last = n - 1
    while (last > first && !loud(last)) last--
    if (first < n) pcm = pcm.subarray(Math.max(0, first - Math.round(rate * 0.04)) * 2, Math.min(n, last + Math.round(rate * 0.15)) * 2)
  }
  const out = Buffer.concat([buf.subarray(0, data), pcm])
  out.writeUInt32LE(out.length - 8, 4)
  out.writeUInt32LE(pcm.length, data - 4)
  return out
}
