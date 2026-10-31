// Client for /api/assist. The server picks the model provider (Hugging Face or
// Claude) from its environment; the browser never sees a key. Every call has an
// instant offline fallback, so Beside keeps working with no AI at all.
import { useSyncExternalStore } from 'react'
import { findTerms, swapText } from './jargon.js'
import { CARD_SECTIONS, ACCOMMODATIONS } from './catalog.js'

let status = { state: 'unknown', provider: null, model: null, transcribe: false }
const subs = new Set()
const setStatus = (next) => {
  status = { ...status, ...next }
  subs.forEach((fn) => fn())
}

export function useAi() {
  return useSyncExternalStore(
    (fn) => {
      subs.add(fn)
      return () => subs.delete(fn)
    },
    () => status,
  )
}

let pending = null
export function checkAi(force = false) {
  if (pending && !force) return pending
  setStatus({ state: 'checking' })
  pending = fetch('/api/assist', { headers: { accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : { ready: false }))
    .then((j) => setStatus({ state: j.ready ? 'ready' : 'offline', provider: j.provider ?? null, model: j.model ?? null, transcribe: Boolean(j.transcribe) }))
    .catch(() => setStatus({ state: 'offline', transcribe: false }))
  return pending
}

export const aiReady = () => status.state === 'ready'
export const transcribeReady = () => status.transcribe

/** Whisper speech to text for one short clip. */
export async function transcribe(blob, lang) {
  const buf = new Uint8Array(await blob.arrayBuffer())
  let bin = ''
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  const res = await fetch('/api/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio: btoa(bin), mime: blob.type || 'audio/webm', lang }),
  })
  if (!res.ok) throw new Error(`Transcribe ${res.status}`)
  return (await res.json()).text ?? ''
}

async function call(mode, payload, timeout = 15000) {
  if (!aiReady()) throw new Error('AI offline')
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeout)
  try {
    const res = await fetch('/api/assist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, ...payload }),
      signal: ctrl.signal,
    })
    if (res.status === 503) setStatus({ state: 'offline' })
    if (!res.ok) throw new Error(`AI ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

// What the server needs to know about the patient. Card text only, no identifiers.
export function patientContext(profile) {
  return {
    name: profile?.name ?? 'the patient',
    pronouns: profile?.pronouns ?? '',
    language: profile?.language ?? 'en',
    card: CARD_SECTIONS.map((s) => ({ title: s.title, body: profile?.card?.[s.id] ?? '' })).filter((c) => c.body),
    accommodations: (profile?.accommodations ?? []).map((id) => ACCOMMODATIONS[id]?.need).filter(Boolean),
  }
}

const historyOf = (lines) => lines.slice(-8).map(({ who, text }) => ({ who, text }))

/** Analyze a clinician utterance: speaker, addressee, jargon, replies, translation. */
export const aiTurn = ({ utterance, profile, lines, lang }) =>
  call('turn', { utterance, patient: patientContext(profile), history: historyOf(lines), lang })

/** Rewrite text in plain words (and the patient's language). */
export const aiSimplify = ({ text, profile, lang }) => call('simplify', { text, patient: patientContext(profile), lang }, 20000)

/** Translate the patient's own typed words into the clinician's language. */
export const aiTranslate = ({ text, from, to = 'en' }) => call('translate', { text, from, to })

/**
 * Translate a map of {key: English text} into `lang`. Keeps {placeholders}.
 * Used for the interface (cached per device) and for sample-visit lines.
 */
export async function aiStrings(strings, lang) {
  const res = await call('strings', { strings, lang }, 45000)
  const out = {}
  for (const [k, v] of Object.entries(res.strings ?? {})) if (k in strings && typeof v === 'string' && v.trim()) out[k] = v
  return out
}

/** End-of-visit recap in plain words, in the patient's language too. */
export const aiRecap = ({ profile, lines, accoms, lang }) =>
  call('recap', { patient: patientContext(profile), transcript: lines.map(({ who, text }) => ({ who, text })), accommodations: accoms.map((a) => `${a.need}: ${a.status}`), lang }, 30000)

// ---------- Offline fallbacks ----------

const TOUCH = /\b(touch|press|exam|examine|palpate|feel|needle|blood|shot|injection|swab|iv)\b/i

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Who is the clinician talking to? `strong` means the words leave no doubt
 * ("So Mom, …", "Does she …", "Sam, …", "your"), and may override the AI.
 */
export function addresseeOf(text, profile) {
  const t = text.toLowerCase()
  const name = escapeRe((profile?.name ?? '').toLowerCase())
  const second = /\byou(r|rs|rself)?\b/.test(t)
  const vocative = name ? new RegExp(`^((hi|hey|ok|okay|so|well|alright)[\\s,]+)?${name}\\b\\s*[,!.]`).test(t) : false
  const companion = /\b(mom|dad|mum|mother|father|caregiver|parent)\b/.test(t)
  const thirdPronoun = /\b(he|him|his|she|her|hers)\b/.test(t)
  const thirdName = name ? new RegExp(`\\b(does|is|has|did|can|will|was|how's|how is)\\s+${name}\\b|\\b${name}'s\\b`).test(t) : false
  if (companion && !vocative) return { addressee: 'caregiver', strong: true }
  if ((thirdPronoun || thirdName) && !second) return { addressee: 'caregiver', strong: true }
  return { addressee: 'patient', strong: vocative || second }
}

export function localTurn(text, profile) {
  const { addressee, strong } = addresseeOf(text, profile)
  return {
    speaker: 'clinician',
    addressee,
    strong,
    terms: findTerms(text),
    replies: localReplies(text, profile).map((en) => ({ en })),
  }
}

export function localReplies(text, profile) {
  const t = text.toLowerCase().trim()
  const wantsWarning = (profile?.accommodations ?? []).includes('warn') && TOUCH.test(t)
  let r
  if (/\bwhere\b/.test(t)) r = ['My stomach.', 'Let me show you on the body map.', 'It’s hard to say.']
  else if (/\bhow long\b|\bsince when\b|\bwhen did\b/.test(t)) r = ['Since today.', 'A few days.', 'More than a week.']
  else if (/\bhow (bad|much|severe)\b|\bscale\b|out of (ten|10)/.test(t)) r = ['A little.', 'It’s bad.', 'The worst pain I’ve had.']
  else if (/\bhow (are|do) you\b|\bfeeling\b/.test(t)) r = ['Not good.', 'A little better.', 'I’m scared.']
  else if (/^(do|does|is|are|can|could|will|would|have|has|did|should|may|any)\b/.test(t) || /\b(okay|ok|alright)\?$/.test(t))
    r = ['Yes.', 'No.', 'I’m not sure.']
  else if (/\b(i'm going to|i am going to|i'll|we'll|we need to|i'd like to)\b/.test(t)) r = ['Okay.', 'Will it hurt?', 'Can you explain why?']
  else r = ['Okay.', 'Can you say that more simply?', 'I have a question.']
  if (wantsWarning) r = [r[0], 'Please warn me before you touch me.', r[2]]
  return r
}

export const localSimplify = (text) => swapText(text, findTerms(text))
