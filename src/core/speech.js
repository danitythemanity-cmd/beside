// Speech: text to speech for the patient's voice, speech to text for live
// captions. Captions use the browser's recognizer when it has one, and Whisper
// (via /api/transcribe) everywhere else.
import { useEffect, useState } from 'react'
import { useAi, transcribeReady, transcribe } from './ai.js'

export const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window
const Recognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null
const canRecord = typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)

/** Can this device caption speech right now? Re-renders when the AI connection changes. */
export function useCanListen() {
  const ai = useAi()
  return Boolean(Recognition) || (canRecord && ai.transcribe)
}

export function speak(text, { rate = 1, voiceURI = null, onEnd } = {}) {
  if (!canSpeak || !text) return
  const synth = window.speechSynthesis
  synth.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.rate = Math.min(1.6, Math.max(0.6, rate))
  if (voiceURI) {
    const v = synth.getVoices().find((x) => x.voiceURI === voiceURI)
    if (v) u.voice = v
  }
  if (onEnd) u.onend = onEnd
  synth.speak(u)
}

export function stopSpeaking() {
  if (canSpeak) window.speechSynthesis.cancel()
}

export const isSpeaking = () => canSpeak && window.speechSynthesis.speaking

// English voices first, deduplicated by name.
export function useVoices() {
  const [voices, setVoices] = useState(() => (canSpeak ? window.speechSynthesis.getVoices() : []))
  useEffect(() => {
    if (!canSpeak) return
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
