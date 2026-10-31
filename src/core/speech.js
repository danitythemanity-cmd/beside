// Speech: text to speech for the patient's voice, speech to text for live
// captions. Everything Beside says aloud uses a realistic AI voice (Orpheus on
// Groq, through /api/speak); common phrases ship pre-recorded in /voice, so
// they play instantly. Text in other languages, or any failure, falls back to
// this device's most natural voice. Captions use the browser's recognizer
// when it has one, and Whisper (via /api/transcribe) everywhere else.
import { useEffect, useState, useSyncExternalStore } from 'react'
import { useAi, transcribeReady, transcribe } from './ai.js'
import { langInfo } from './i18n.js'

export const canSpeak = typeof window !== 'undefined' && ('speechSynthesis' in window || typeof Audio !== 'undefined')
const canSynth = typeof window !== 'undefined' && 'speechSynthesis' in window
const Recognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null
const canRecord = typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)

/** Can this device caption speech right now? Re-renders when the AI connection changes. */
export function useCanListen() {
  const ai = useAi()
  return Boolean(Recognition) || (canRecord && ai.transcribe)
}

// ---------- The realistic voice ----------

/** Orpheus voices. Keep DEFAULT_VOICE in sync with api/speak.js. */
export const AI_VOICES = [
  { id: 'hannah', label: 'Hannah' },
  { id: 'autumn', label: 'Autumn' },
  { id: 'diana', label: 'Diana' },
  { id: 'troy', label: 'Troy' },
  { id: 'austin', label: 'Austin' },
  { id: 'daniel', label: 'Daniel' },
]
export const DEFAULT_VOICE = 'hannah'
const MAX_CHUNK = 190 // short pieces start playing sooner; the next loads while one plays
const clamp = (rate) => Math.min(1.6, Math.max(0.6, rate))
const PATIENCE = 4000 // a reply that takes longer is spoken by the device instead

// Set from the settings provider; per-call options override them.
let prefs = { natural: true, aiVoice: DEFAULT_VOICE, rate: 1, voiceURI: null }
export const setVoicePrefs = (p) => (prefs = { ...prefs, ...p })

// Natural voice status for the settings sheet: unknown → ready | down.
let status = 'unknown'
let downUntil = 0
const listeners = new Set()
const setStatus = (s) => {
  if (s === status) return
  status = s
  listeners.forEach((l) => l())
}
export const useVoiceStatus = () =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => status,
    () => status,
  )

// One shared player. iOS only lets an element play outside a tap once it has
// played inside one, so the first tap anywhere unlocks it with a moment of silence.
const player = typeof Audio !== 'undefined' ? new Audio() : null
if (player && typeof document !== 'undefined') {
  const unlock = () => {
    document.removeEventListener('pointerdown', unlock, true)
    document.removeEventListener('keydown', unlock, true)
    if (busy) return
    player.src = silence()
    player.play().then(() => !busy && player.pause(), () => {})
  }
  document.addEventListener('pointerdown', unlock, true)
  document.addEventListener('keydown', unlock, true)
}

function silence() {
  const n = 800
  const b = new DataView(new ArrayBuffer(44 + n))
  const tag = (o, t) => [...t].forEach((c, i) => b.setUint8(o + i, c.charCodeAt(0)))
  tag(0, 'RIFF'), b.setUint32(4, 36 + n, true), tag(8, 'WAVE'), tag(12, 'fmt '), b.setUint32(16, 16, true), b.setUint16(20, 1, true), b.setUint16(22, 1, true)
  b.setUint32(24, 8000, true), b.setUint32(28, 8000, true), b.setUint16(32, 1, true), b.setUint16(34, 8, true), tag(36, 'data'), b.setUint32(40, n, true)
  for (let i = 0; i < n; i++) b.setUint8(44 + i, 128)
  return URL.createObjectURL(new Blob([b], { type: 'audio/wav' }))
}

// Pre-recorded clips: /voice/index.json maps "voice|text" to a file.
let recorded = null
const recordings = () =>
  (recorded ??= fetch('/voice/index.json')
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}))) // a failed load is retried next session

// Audio for one chunk, as an object URL. Shared by playback and prefetch.
const clips = new Map()
function clip(text, voice) {
  const key = `${voice}|${text}`
  if (!clips.has(key)) {
    const p = recordings().then(async (index) => {
      const r = index[key]
        ? await fetch(`/voice/${index[key]}`)
        : await fetch('/api/speak', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, voice }) })
      if (!r.ok) throw new Error(`voice ${r.status}`)
      return URL.createObjectURL(await r.blob())
    })
    p.catch(() => clips.delete(key))
    clips.set(key, p)
    if (clips.size > 120) {
      const [oldest, url] = clips.entries().next().value
      clips.delete(oldest)
      url.then((u) => setTimeout(() => URL.revokeObjectURL(u), 60_000), () => {})
    }
  }
  return clips.get(key)
}

/** Split text into pieces the voice model accepts, at sentence breaks where possible. */
export function chunks(text) {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= MAX_CHUNK) return clean ? [clean] : []
  const out = []
  for (let s of clean.split(/(?<=[.!?。！？]["”’)]?) /)) {
    while (s.length > MAX_CHUNK) {
      const cut = Math.max(s.lastIndexOf(', ', MAX_CHUNK), s.lastIndexOf('; ', MAX_CHUNK), s.lastIndexOf(' ', MAX_CHUNK))
      const at = cut > 40 ? cut + 1 : MAX_CHUNK
      out.push(s.slice(0, at).trim())
      s = s.slice(at).trim()
    }
    if (!s) continue
    // Short sentences travel together, so the voice keeps its flow.
    const last = out.at(-1)
    if (last && last.length + s.length + 1 <= MAX_CHUNK) out[out.length - 1] = `${last} ${s}`
    else out.push(s)
  }
  return out
}

/** Fetch a phrase ahead of time so it plays the moment it is needed. */
export function prepareSpeech(text, { voice = prefs.aiVoice } = {}) {
  if (!text || !prefs.natural || !player || Date.now() < downUntil) return
  for (const c of chunks(text)) clip(c, voice).catch(() => {})
}

let gen = 0 // bumps on every speak/stop, so stale work stops itself
let busy = false // true from speak() until it finishes, including while fetching
let release = null // resolves the playback in progress when stopped

function play(url, rate) {
  return new Promise((resolve, reject) => {
    const done = (fn) => (e) => {
      player.onended = player.onerror = null
      release = null
      fn(e)
    }
    release = done(resolve)
    player.onended = done(resolve)
    player.onerror = done(() => reject(new Error('playback failed')))
    player.src = url
    player.defaultPlaybackRate = player.playbackRate = rate
    player.play().catch(done(reject))
  })
}

async function playNatural(text, rate, voice, id) {
  const parts = chunks(text)
  const ahead = parts.map((p, i) => (i < 2 ? clip(p, voice) : null))
  for (let i = 0; i < parts.length; i++) {
    let url
    try {
      // A slow network shouldn't leave the patient waiting: give up after a few
      // seconds (the clip keeps loading for next time).
      url = await Promise.race([ahead[i] ?? clip(parts[i], voice), new Promise((_, no) => setTimeout(() => no(new Error('voice too slow')), PATIENCE))])
      if (id !== gen) return
      if (i + 2 < parts.length) (ahead[i + 2] = clip(parts[i + 2], voice)).catch(() => {})
      await play(url, rate)
    } catch (err) {
      err.rest = parts.slice(i).join(' ')
      throw err
    }
    if (id !== gen) return
  }
}

/**
 * Say something out loud. English uses the realistic voice when it's on;
 * other languages, or any failure, use the device's voice.
 * @param {string} text
 * @param {{ lang?: string, rate?: number, voiceURI?: string|null, natural?: boolean, aiVoice?: string, onEnd?: () => void }} [opts]
 */
export function speak(text, opts = {}) {
  const { lang = 'en', rate = prefs.rate, voiceURI = prefs.voiceURI, natural = prefs.natural, aiVoice = prefs.aiVoice, onEnd } = opts
  stopSpeaking()
  const clean = typeof text === 'string' ? text.trim() : ''
  if (!clean) return onEnd?.()
  const id = ++gen
  busy = true
  const finish = () => {
    if (id !== gen) return
    busy = false
    onEnd?.()
  }
  const device = (t) => (id === gen ? deviceSpeak(t, { rate, voiceURI, lang, onEnd: finish }) : undefined)
  if (natural && player && lang.startsWith('en') && Date.now() >= downUntil) {
    playNatural(clean, clamp(rate), aiVoice, id).then(
      () => {
        setStatus('ready')
        finish()
      },
      (err) => {
        // Autoplay blocks aren't the voice's fault; network and server errors are.
        if (err?.name !== 'NotAllowedError' && err?.name !== 'AbortError') {
          downUntil = Date.now() + 60_000
          setStatus('down')
        }
        device(err?.rest || clean)
      },
    )
  } else device(clean)
}

function deviceSpeak(text, { rate, voiceURI, lang, onEnd }) {
  if (!canSynth) return onEnd()
  const u = new SpeechSynthesisUtterance(text)
  u.rate = clamp(rate)
  const voice = bestVoice(lang, voiceURI)
  u.lang = voice?.lang ?? langInfo(lang).voice
  if (voice) u.voice = voice
  u.onend = u.onerror = onEnd
  window.speechSynthesis.speak(u)
}

// The device voice that sounds most human for a language: the chosen one if
// it fits, otherwise neural/enhanced voices first.
function bestVoice(lang, voiceURI) {
  const all = canSynth ? window.speechSynthesis.getVoices() : []
  const want = langInfo(lang).voice.split('-')[0].toLowerCase()
  const fits = all.filter((v) => v.lang?.toLowerCase().split(/[-_]/)[0] === want)
  const chosen = voiceURI && fits.find((v) => v.voiceURI === voiceURI)
  if (chosen) return chosen
  const score = (v) =>
    (/natural|neural|premium|enhanced|siri/i.test(v.name) ? 8 : 0) +
    (/google/i.test(v.name) ? 4 : 0) +
    (/^(samantha|ava|allison|susan|zoe|evan|nathan|serena|karen|moira|tessa|daniel|aria|jenny|guy)\b/i.test(v.name) ? 2 : 0) +
    (v.localService === false ? 1 : 0) +
    (/novelty|whisper|zarvox|bells|bad news|boing|bubbles|cellos|jester|organ|superstar|trinoids|wobble|albert|fred|junior|ralph|kathy|grandma|grandpa|eddy|flo|reed|rocko|sandy|shelley/i.test(v.name) ? -20 : 0)
  return fits.sort((a, b) => score(b) - score(a))[0] ?? null
}

export function stopSpeaking() {
  gen++
  busy = false
  if (player && !player.paused) player.pause()
  release?.()
  if (canSynth) window.speechSynthesis.cancel()
}

/** True while Beside is talking (or about to), so captions ignore its own voice. */
export const isSpeaking = () => busy || (canSynth && window.speechSynthesis.speaking)

// Device voices, English first, deduplicated by name.
export function useVoices() {
  const [voices, setVoices] = useState(() => (canSynth ? window.speechSynthesis.getVoices() : []))
  useEffect(() => {
    if (!canSynth) return
    const update = () => setVoices(window.speechSynthesis.getVoices())
    update()
    window.speechSynthesis.addEventListener?.('voiceschanged', update)
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', update)
  }, [])
  const seen = new Set()
  return voices
    .filter((v) => (seen.has(v.name) ? false : seen.add(v.name)))
    .sort((a, b) => Number(b.lang.startsWith('en')) - Number(a.lang.startsWith('en')) || a.name.localeCompare(b.name))
}

/**
 * Continuous captions. Ignores speech while Beside itself is talking, so the
 * patient's synthesized voice is never captioned as the doctor.
 * Returns a stop function.
 */
export function startListening(opts) {
  if (Recognition) return startBrowserRecognition(opts)
  if (canRecord && transcribeReady()) return startWhisper(opts)
  opts.onError?.('Live captions are not available in this browser. You can type instead.')
  return () => {}
}

function startBrowserRecognition({ onInterim, onFinal, onError, onState }) {
  const rec = new Recognition()
  rec.continuous = true
  rec.interimResults = true
  rec.lang = navigator.language?.startsWith('en') ? navigator.language : 'en-US'
  let stopped = false
  rec.onstart = () => onState?.('listening')
  rec.onresult = (e) => {
    if (isSpeaking()) return
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i]
      const text = r[0].transcript.trim()
      if (!text) continue
      if (r.isFinal) onFinal(text.charAt(0).toUpperCase() + text.slice(1))
      else onInterim?.(text)
    }
  }
  rec.onerror = (e) => {
    if (e.error === 'no-speech' || e.error === 'aborted') return
    stopped = true
    onError?.(
      e.error === 'not-allowed' || e.error === 'service-not-allowed'
        ? 'Microphone access was blocked. Allow the microphone in your browser, or type instead.'
        : `Captions stopped (${e.error}). You can type instead.`,
    )
    onState?.('off')
  }
  rec.onend = () => {
    if (stopped) return onState?.('off')
    try {
      rec.start()
    } catch {
      /* already restarting */
    }
  }
  try {
    rec.start()
  } catch (err) {
    onError?.(err.message)
  }
  return () => {
    stopped = true
    try {
      rec.stop()
    } catch {
      /* ignore */
    }
    onState?.('off')
  }
}

/**
 * Whisper captions: record only while someone is talking (simple voice
 * activity detection), then transcribe each phrase.
 */
function startWhisper({ onFinal, onError, onState, onInterim, lang = 'en' }) {
  let stopped = false
  let stream = null
  let ctx = null
  let rec = null
  let raf = 0
  const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((m) => MediaRecorder.isTypeSupported?.(m)) ?? ''

  ;(async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
    } catch {
      onError?.('Microphone access was blocked. Allow the microphone in your browser, or type instead.')
      return onState?.('off')
    }
    if (stopped) return stream.getTracks().forEach((t) => t.stop())
    ctx = new AudioContext()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 1024
    ctx.createMediaStreamSource(stream).connect(analyser)
    const buf = new Float32Array(analyser.fftSize)
    let floor = 0.01
    let voiceAt = 0
    let startedAt = 0
    onState?.('listening')

    const begin = () => {
      // Each phrase gets its own recorder and buffer, so overlapping uploads never mix.
      const parts = []
      const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      rec = r
      r.ondataavailable = (e) => e.data.size && parts.push(e.data)
      r.onstop = async () => {
        const blob = new Blob(parts, { type: r.mimeType || mime || 'audio/webm' })
        if (blob.size < 2000) return
        try {
          const text = await transcribe(blob, lang)
          if (text && !stopped) onFinal(text.charAt(0).toUpperCase() + text.slice(1))
        } catch {
          /* drop this phrase; keep listening */
        }
      }
      r.start()
      startedAt = performance.now()
      onInterim?.('…')
    }

    const tick = (now) => {
      if (stopped) return
      analyser.getFloatTimeDomainData(buf)
      let sum = 0
      for (const v of buf) sum += v * v
      const rms = Math.sqrt(sum / buf.length)
      const talking = rms > Math.max(0.015, floor * 3) && !isSpeaking()
      if (!talking) floor = floor * 0.995 + rms * 0.005
      if (talking) voiceAt = now
      const recording = rec && rec.state === 'recording'
      if (talking && !recording) begin()
      // End the phrase after a short pause, or at 12 seconds.
      if (recording && (now - voiceAt > 900 || now - startedAt > 12000)) {
        rec.stop()
        onInterim?.('')
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
  })()

  return () => {
    stopped = true
    cancelAnimationFrame(raf)
    try {
      if (rec?.state === 'recording') rec.stop()
    } catch {
      /* ignore */
    }
    stream?.getTracks().forEach((t) => t.stop())
    ctx?.close().catch(() => {})
    onState?.('off')
  }
}
