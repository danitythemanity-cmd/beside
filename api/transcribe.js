// Vercel serverless function: speech to text with Whisper on Groq.
// Used for live captions in browsers without built-in speech recognition.
//
// POST /api/transcribe { audio: base64, mime: 'audio/webm', lang?: 'en' } -> { text }

const ENDPOINT = 'https://api.groq.com/openai/v1/audio/transcriptions'
// Whisper's well-known inventions on silence or noise.
const PHANTOMS = /^(thank you\.?|thanks for watching!?|thank you for watching\.?|you|bye\.?|\.+)$/i

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' })
  const key = process.env.GROQ_API_KEY
  if (!key) return res.status(503).json({ error: 'Transcription needs GROQ_API_KEY' })

  const { audio, mime = 'audio/webm', lang } = req.body ?? {}
  if (typeof audio !== 'string' || !audio || audio.length > 3_500_000) return res.status(400).json({ error: 'Missing or oversized audio' })

  const type = String(mime).split(';')[0]
  const ext = type.includes('mp4') ? 'mp4' : type.includes('ogg') ? 'ogg' : type.includes('wav') ? 'wav' : 'webm'
  const form = new FormData()
  form.append('file', new Blob([Buffer.from(audio, 'base64')], { type }), `speech.${ext}`)
  form.append('model', process.env.GROQ_STT_MODEL || 'whisper-large-v3-turbo')
  form.append('response_format', 'verbose_json')
  form.append('temperature', '0')
  if (typeof lang === 'string' && /^[a-z]{2}$/.test(lang)) form.append('language', lang)

  try {
    const r = await fetch(ENDPOINT, { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form })
    if (!r.ok) {
      console.error('[transcribe]', r.status, (await r.text().catch(() => '')).slice(0, 200))
      return res.status(502).json({ error: 'Transcription failed' })
    }
    const data = await r.json()
    // Drop segments Whisper itself thinks are not speech.
    const segments = Array.isArray(data.segments) ? data.segments : null
    let text = segments ? segments.filter((s) => (s.no_speech_prob ?? 0) < 0.6 && (s.avg_logprob ?? 0) > -1.2).map((s) => s.text).join(' ') : data.text
    text = String(text ?? '').replace(/\s+/g, ' ').trim()
    if (PHANTOMS.test(text)) text = ''
    return res.status(200).json({ text })
  } catch (err) {
    console.error('[transcribe]', err.message)
    return res.status(502).json({ error: 'Transcription failed' })
  }
}
