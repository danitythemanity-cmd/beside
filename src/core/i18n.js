// Languages. The interface is written in English; any other language is
// translated by the AI on first use and cached on the device. Captions and
// replies are translated live, per line. With no AI, everything stays English.
import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { ACCOMMODATIONS, BOARD, CARD_SECTIONS, DURATIONS, MODES, QUALITIES, REGIONS, SEVERITIES } from './catalog.js'
import { read, write } from './storage.js'

export const LANGS = [
  { code: 'en', name: 'English', native: 'English', voice: 'en-US' },
  { code: 'es', name: 'Spanish', native: 'Español', voice: 'es-US' },
  { code: 'zh', name: 'Chinese', native: '中文', voice: 'zh-CN' },
  { code: 'ar', name: 'Arabic', native: 'العربية', voice: 'ar-SA', dir: 'rtl' },
  { code: 'vi', name: 'Vietnamese', native: 'Tiếng Việt', voice: 'vi-VN' },
  { code: 'tl', name: 'Tagalog', native: 'Tagalog', voice: 'fil-PH' },
  { code: 'fr', name: 'French', native: 'Français', voice: 'fr-FR' },
  { code: 'ko', name: 'Korean', native: '한국어', voice: 'ko-KR' },
  { code: 'ru', name: 'Russian', native: 'Русский', voice: 'ru-RU' },
  { code: 'pt', name: 'Portuguese', native: 'Português', voice: 'pt-BR' },
  { code: 'ht', name: 'Haitian Creole', native: 'Kreyòl ayisyen', voice: 'fr-FR' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', voice: 'hi-IN' },
  { code: 'fa', name: 'Persian', native: 'فارسی', voice: 'fa-IR', dir: 'rtl' },
  { code: 'ja', name: 'Japanese', native: '日本語', voice: 'ja-JP' },
  { code: 'de', name: 'German', native: 'Deutsch', voice: 'de-DE' },
]

export const langInfo = (code) => LANGS.find((l) => l.code === code) ?? LANGS[0]
export const dirOf = (code) => langInfo(code).dir ?? 'ltr'

const UI = {
  'nav.home': 'Home',
  'nav.beside': 'Beside',
  'nav.decode': 'Decode',
  'nav.card': 'My card',
  'nav.visits': 'Visits',
  'common.next': 'Next',
  'common.back': 'Back',
  'common.skip': 'Skip',
  'common.done': 'Done',
  'common.edit': 'Edit',
  'common.save': 'Save',
  'common.close': 'Close',
  'common.cancel': 'Cancel',
  'common.settings': 'Settings',
  'common.step': 'Step {n} of {total}',
  'common.provided': 'Provided',
  'common.requested': 'Asked',
  'common.notYet': 'Not yet',
  'common.readAloud': 'Read it to me',
  'common.stop': 'Stop',
  'common.doctor': 'Doctor',
  'common.companion': 'Companion',

  'visit.with': 'Visit with {doctor}',
  'visit.connected': 'Connected',
  'visit.waiting': 'Waiting for clinician',
  'visit.code': 'Code {code}',
  'visit.end': 'End visit',
  'visit.endConfirm': 'End this visit and get your recap?',
  'tab.talk': 'Talk',
  'tab.board': 'Phrases',
  'tab.pain': 'Pain',
  'tab.card': 'My card',
  'talk.saying': '{who} is saying',
  'talk.captions': 'Captions',
  'talk.idle': 'When someone speaks, their words appear here.',
  'talk.translated': 'Translated from English',
  'talk.translating': 'Translating…',
  'talk.offlineTranslate': 'Translation needs the AI connection. Showing English in plain words.',
  'talk.showOriginal': 'Show original',
  'talk.hideOriginal': 'Hide original',
  'talk.plain': 'In plain words',
  'talk.simplifying': 'Making it simpler…',
  'talk.tapToSay': 'Tap to say',
  'talk.suggested': 'Suggested for you',
  'talk.noReplies': 'Answers appear here after a question.',
  'talk.simpler': 'Say it simpler',
  'talk.type': 'Type to say',
  'talk.typePlaceholder': 'Type what you want to say',
  'talk.speak': 'Speak',
  'talk.youSaid': 'You said',
  'talk.again': 'Say it again',
  'talk.listen': 'Live captions',
  'talk.listening': 'Listening',
  'talk.micOff': 'Captions off',
  'board.title': 'Tap a phrase to say it out loud',
  'call.start': 'Video call',
  'call.title': 'Video call with {name}',
  'call.calling': 'Calling {name}…',
  'call.connecting': 'Connecting…',
  'call.you': 'You',
  'call.live': 'Live',
  'call.mute': 'Mute microphone',
  'call.camera': 'Turn camera off',
  'call.end': 'End call',
  'call.incoming': '{name} is starting a video call',
  'call.incomingHint': 'Captions keep running during the call.',
  'call.joinVideo': 'Join with video',
  'call.joinAudio': 'Join without camera',
  'call.decline': 'Not now',
  'call.err.not-linked': 'The other device isn’t connected yet. Wait for “Connected”, then try again.',
  'call.err.media': 'Camera and microphone are blocked. Allow them in your browser, then try again.',
  'call.err.declined': 'The call was declined.',
  'call.err.no-answer': 'No answer. Try again in a moment.',
  'call.err.network': 'The video couldn’t get through between these networks. Try the same Wi-Fi or a phone hotspot.',
  'call.waitLink': 'Video calls start once the other device is connected.',
  'link.blocked': 'Can’t reach the clinician’s device from this network. Try the same Wi-Fi or a phone hotspot.',
  'pain.title': 'Show your pain',
  'pain.where': 'Tap where it hurts',
  'pain.hurts': 'Hurts: {region}',
  'pain.right': 'Your right',
  'pain.left': 'Your left',
  'pain.howBad': 'How bad?',
  'pain.feel': 'What does it feel like?',
  'pain.howLong': 'How long?',
  'pain.send': 'Send to {doctor}',
  'pain.sent': 'Sent. {doctor} can see it now.',
  'card.show': 'Show this to staff',
  'card.title': 'This is me',
  'card.shared': 'Shared with {doctor}',
  'card.share': 'Share my card',
  'card.asked': 'What I asked for',
  'card.empty': 'Your card is empty. Add a few words so staff know how to talk with you.',
  'recap.title': 'Visit recap',
  'recap.plain': 'In plain words',
  'recap.next': 'What happens next',
  'recap.asked': 'What you asked for',
  'recap.words': 'Words Beside explained',
  'recap.saved': 'Saved to your visits',
  'recap.waiting': 'Writing your recap…',
  'recap.noSteps': 'Ask the doctor what happens next, and ask them to write it down for you.',

  'home.hi': 'Hi, {name}',
  'home.ready': 'Ready when you are.',
  'home.start': 'Start a visit',
  'home.inProgress': 'Visit in progress',
  'home.return': 'Return to visit',
  'home.startHint': 'Your clinician joins with a 4-digit code.',
  'home.card': 'My card',
  'home.recent': 'Recent visits',
  'home.noVisits': 'No visits yet. Your recaps will be saved here.',
  'home.decode': 'Got confusing medical papers?',
  'home.decodeHint': 'Turn hard words into simple ones.',
  'start.title': 'Your visit code',
  'start.hint': 'Ask your clinician to open Beside and enter this code.',
  'start.openClinician': 'Open the clinician screen here',
  'start.shareCard': 'Share my card when the visit starts',
  'start.begin': 'Begin visit',
  'decode.title': 'Decode medical words',
  'decode.hint': 'Type or paste anything from a doctor, a letter, or a discharge paper.',
  'decode.placeholder': 'Example: Take ibuprofen PRN for acute pain. NPO after midnight before your procedure.',
  'decode.go': 'Make it simple',
  'decode.result': 'Simple version',
  'decode.changed': 'Words we changed',
  'decode.ai': 'Simplified by AI, in your language.',
  'decode.local': 'Simplified with Beside’s built-in dictionary.',
  'decode.none': 'No hard words found. It already looks simple.',
  'visits.title': 'Your visits',
  'visits.with': 'with {doctor}',

  'settings.title': 'Display and voice',
  'settings.text': 'Text size',
  'settings.theme': 'Theme',
  'settings.dark': 'Dark',
  'settings.light': 'Light',
  'settings.contrast': 'High contrast',
  'settings.motion': 'Reduce motion',
  'settings.language': 'Language',
  'settings.voice': 'Voice',
  'settings.voiceOn': 'Speak my words out loud',
  'settings.rate': 'Speaking speed',
  'settings.test': 'Test voice',
  'settings.testPhrase': 'Hello. This is my voice.',
  'settings.natural': 'Realistic voice',
  'settings.naturalHint': 'A lifelike AI voice speaks English. Other languages use this device’s voice.',
  'settings.naturalDown': 'The realistic voice isn’t available right now, so this device’s voice is speaking.',
  'settings.whichVoice': 'Which voice',
  'settings.deviceVoice': 'Device voice',
  'settings.autoVoice': 'Most natural on this device',
  'settings.reset': 'Reset this device',
  'settings.resetConfirm': 'Delete your card and visits from this device?',
  'settings.ai': 'AI connection',
  'settings.aiOn': 'Connected: smarter decoding, replies, and translation.',
  'settings.aiOff': 'Offline: built-in decoder and replies. English only.',
  'settings.translating': 'Translating Beside into {lang}…',
  'settings.translateFailed': 'Couldn’t translate right now. Showing English.',

  'ob.welcome': 'Be heard at every appointment.',
  'ob.welcomeBody': 'Beside gives you a voice at the doctor and helps staff talk with you, not around you.',
  'ob.language': 'Choose your language',
  'ob.setup': 'Set up my card',
  'ob.sample': 'Explore with a sample profile',
  'ob.private': 'Everything stays on this device.',
  'ob.about': 'About you',
  'ob.name': 'What should we call you?',
  'ob.pronouns': 'Pronouns (optional)',
  'ob.companion': 'Who usually comes with you? (optional)',
  'ob.companionName': 'Their name',
  'ob.companionRel': 'Relationship',
  'ob.how': 'How do you communicate?',
  'ob.howHint': 'Choose all that fit. This helps us suggest what to ask for.',
  'ob.card': 'This is me',
  'ob.cardHint': 'Staff see this before they talk to you. Use your own words.',
  'ob.tapToAdd': 'Tap to add',
  'ob.needs': 'What helps you?',
  'ob.needsHint': 'We picked some based on your answers. Beside will track whether you get them.',
  'ob.voice': 'Your voice',
  'ob.voiceHint': 'Beside speaks your words out loud to staff.',
  'ob.finish': 'Finish',
}

// Catalog labels join the same table, so one translation pass covers them.
function catalogStrings() {
  const out = {}
  for (const m of MODES) out[`mode.${m.id}`] = m.label
  for (const [id, a] of Object.entries(ACCOMMODATIONS)) out[`accom.${id}`] = a.need
  for (const s of CARD_SECTIONS) {
    out[`section.${s.id}`] = s.title
    out[`section.${s.id}.prompt`] = s.prompt
    s.suggestions.forEach((x, i) => (out[`sugg.${s.id}.${i}`] = x))
  }
  for (const b of BOARD) out[`board.${b.id}`] = b.label
  for (const [id, r] of Object.entries(REGIONS)) out[`region.${id}`] = r.label
  for (const q of QUALITIES) out[`quality.${q}`] = q
  for (const s of SEVERITIES) out[`severity.${s.value}`] = s.label
  for (const d of DURATIONS) out[`duration.${d}`] = d
  return out
}

export const SOURCE = { ...UI, ...catalogStrings() }
const VERSION = `v${Object.keys(SOURCE).length}-${JSON.stringify(SOURCE).length}`
const cacheKey = (lang) => `beside.i18n.${lang}.${VERSION}`

// ---------- Runtime translation store ----------

const tables = {}
const status = {}
const subs = new Set()
let snapshot = 0
const notify = () => {
  snapshot++
  subs.forEach((fn) => fn())
}

/**
 * Translate the interface into `lang` using the AI, once per device.
 * `translateStrings(map, lang)` is injected to keep this module free of fetch.
 */
export async function loadLanguage(lang, translateStrings) {
  if (lang === 'en' || tables[lang] || status[lang] === 'loading') return
  const cached = read(cacheKey(lang), null)
  if (cached) {
    tables[lang] = cached
    status[lang] = 'ready'
    return notify()
  }
  if (!translateStrings) return
  status[lang] = 'loading'
  notify()
  try {
    const entries = Object.entries(SOURCE)
    const chunks = []
    for (let i = 0; i < entries.length; i += 60) chunks.push(Object.fromEntries(entries.slice(i, i + 60)))
    const parts = await Promise.all(chunks.map((c) => translateStrings(c, lang)))
    const table = Object.assign({}, ...parts)
    tables[lang] = table
    status[lang] = 'ready'
    write(cacheKey(lang), table)
  } catch {
    status[lang] = 'failed'
  }
  notify()
}

export function translate(lang, key, vars) {
  let s = (lang !== 'en' && tables[lang]?.[key]) || SOURCE[key] || key
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v)
  return s
}

/** `t(key, vars)` for the given language, re-rendering when a translation lands. */
export function useT(lang) {
  useSyncExternalStore(
    (fn) => {
      subs.add(fn)
      return () => subs.delete(fn)
    },
    () => snapshot,
  )
  return useCallback((key, vars) => translate(lang, key, vars), [lang, snapshot]) // eslint-disable-line react-hooks/exhaustive-deps
}

export function useLanguageStatus(lang) {
  useSyncExternalStore(
    (fn) => {
      subs.add(fn)
      return () => subs.delete(fn)
    },
    () => snapshot,
  )
  return lang === 'en' ? 'ready' : status[lang] ?? 'idle'
}

/** Keep <html lang dir> in step with the patient's language. */
export function useDocumentLanguage(lang) {
  useEffect(() => {
    const root = document.documentElement
    const prev = { lang: root.lang, dir: root.dir }
    root.lang = lang === 'en' ? 'en' : lang
    root.dir = dirOf(lang)
    return () => {
      root.lang = prev.lang || 'en'
      root.dir = prev.dir || 'ltr'
    }
  }, [lang])
}
