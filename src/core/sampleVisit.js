// The sample visit: a scripted appointment with Sam (fictional), played on the
// real patient and clinician screens through the same visit engine as a live
// visit. Each step waits `wait` ms (at 1x), then dispatches `event`.
// `focus` tells the theater which device to show on narrow screens.
import { SAMPLE_PROFILE, SAMPLE_CLINICIAN } from './catalog.js'
import { decode, findTerms } from './jargon.js'

// "palpate your abdomen" -> "[[gently press on|palpate]] your [[belly|abdomen]]",
// so translations keep plain words and the original term side by side.
const withMarkup = (text) =>
  decode(text, findTerms(text))
    .map((s) => (s.term ? `[[${s.plain}|${s.term}]]` : s.text))
    .join('')

export const FEATURES = [
  { id: 'card', label: 'This is me card' },
  { id: 'nudge', label: 'Talk-to-me nudge' },
  { id: 'captions', label: 'Live captions' },
  { id: 'replies', label: 'Reply prediction + voice' },
  { id: 'log', label: 'Accommodations log' },
  { id: 'pain', label: 'Pain translator' },
  { id: 'jargon', label: 'Jargon decoder' },
  { id: 'simpler', label: 'Say it simpler' },
  { id: 'meter', label: 'Understanding meter' },
  { id: 'recap', label: 'Recap + coaching' },
]

const doc = (id, text, extra = {}) => ({ type: 'line/add', id, who: 'clinician', to: 'patient', text, ...extra })
const sam = (id, text, extra = {}) => ({ type: 'line/add', id, who: 'patient', to: 'clinician', text, kind: 'reply', ...extra })
const mom = (id, text) => ({ type: 'line/add', id, who: 'caregiver', to: 'clinician', text })

export const SAMPLE_RECAP = {
  summary: 'Your belly hurts on the lower right side. Dr. Okafor wants to check if your appendix, a small part of your gut, is swollen.',
  nextSteps: [
    'A nurse will take a little blood from your arm. They will tell you before they touch you.',
    'You will get a belly scan. It does not hurt. The gel feels cold.',
    'Do not eat or drink until the doctor says it is okay.',
    'If the pain gets much worse, tell a nurse or your mom right away.',
  ],
  source: 'script',
}

export const SCRIPT = [
  {
    wait: 300,
    focus: 'both',
    narrate: 'Meet Sam, 24. Sam is autistic and doesn’t speak out loud, but understands everything. Today: urgent care for stomach pain, with their mom, Ana.',
    event: { type: 'visit/start', code: 'DEMO', patient: SAMPLE_PROFILE, clinician: SAMPLE_CLINICIAN },
  },
  {
    wait: 2800,
    focus: 'clinician',
    feature: 'card',
    narrate: 'Before the doctor walks in, Sam shares their “This is me” card. It lands on her tablet in Sam’s own words.',
    event: { type: 'card/share' },
  },
  {
    wait: 4400,
    focus: 'clinician',
    feature: 'nudge',
    narrate: 'The doctor asks Sam’s mom instead of Sam. Beside notices, and gently nudges her.',
    event: doc('s1', 'Hi, I’m Dr. Okafor. So, Mom, what’s going on with Sam today? How long have they been like this?', { to: 'caregiver' }),
  },
  { wait: 3800, focus: 'patient', event: mom('s2', 'You can ask Sam. They’ll answer you.') },
  {
    wait: 2600,
    focus: 'patient',
    feature: 'captions',
    narrate: 'Every word appears as large captions on Sam’s phone.',
    event: doc('s3', 'You’re right, I’m sorry. Sam, I’ll talk with you. What’s been bothering you?', {
      replies: ['My stomach hurts.', 'I feel sick and dizzy.', 'I’m scared.'],
    }),
  },
  {
    wait: 2600,
    focus: 'clinician',
    feature: 'replies',
    narrate: 'Beside suggests three likely answers. While Sam chooses, the doctor is reminded to wait.',
    event: { type: 'patient/composing', on: true },
  },
  { wait: 1600, focus: 'patient', event: { type: 'ui/press', target: 'reply-0' } },
  { wait: 700, narrate: 'One tap, and Sam’s voice says it out loud.', event: sam('s4', 'My stomach hurts.') },
  { wait: 2000, focus: 'patient', event: { type: 'ui/tab', tab: 'board' } },
  { wait: 1100, event: { type: 'ui/press', target: 'board-lights' } },
  { wait: 700, event: sam('s5', 'The lights are too bright for me.', { kind: 'need', accom: 'lights' }) },
  { wait: 1500, event: { type: 'ui/tab', tab: 'talk' } },
  { wait: 1100, focus: 'clinician', event: doc('s6', 'Thank you for telling me. I’ll turn them down right now.') },
  {
    wait: 1200,
    focus: 'clinician',
    feature: 'log',
    narrate: 'Every request is logged. The doctor checks this one off.',
    event: { type: 'accom/provide', accom: 'lights' },
  },
  {
    wait: 2800,
    focus: 'patient',
    feature: 'pain',
    narrate: 'The pain translator: Sam taps where it hurts and how it feels.',
    event: doc('s7', 'Can you show me where it hurts, and what it feels like?'),
  },
  { wait: 2000, event: { type: 'ui/tab', tab: 'pain' } },
  { wait: 1200, event: { type: 'pain/set', field: 'region', value: 'rlq' } },
  { wait: 900, event: { type: 'pain/set', field: 'quality', value: 'Sharp' } },
  { wait: 800, event: { type: 'pain/set', field: 'quality', value: 'Worse when I move' } },
  { wait: 900, event: { type: 'pain/set', field: 'severity', value: 7 } },
  { wait: 800, event: { type: 'pain/set', field: 'duration', value: '3 days' } },
  { wait: 900, event: { type: 'ui/press', target: 'pain-send' } },
  {
    wait: 600,
    focus: 'clinician',
    narrate: 'The doctor gets a clinical summary. Sam’s voice says it out loud.',
    event: { type: 'pain/send', id: 's8' },
  },
  { wait: 2600, focus: 'patient', event: { type: 'ui/tab', tab: 'talk' } },
  {
    wait: 900,
    focus: 'patient',
    feature: 'jargon',
    narrate: 'Medical jargon is highlighted on Sam’s screen and swapped for plain words.',
    event: doc(
      's9',
      'Okay. With right lower quadrant tenderness I’m concerned about appendicitis. I’d like to palpate your abdomen, then order a CBC and an abdominal ultrasound to rule it out.',
      { replies: ['Okay.', 'What does that mean?', 'Will it hurt?'] },
    ),
  },
  {
    wait: 5600,
    focus: 'patient',
    feature: 'simpler',
    narrate: 'Still too much? Sam taps “Say it simpler,” and Beside rewrites it in plain words.',
    event: { type: 'ui/press', target: 'simpler' },
  },
  { wait: 600, event: { type: 'patient/simpler', id: 's10' } },
  {
    wait: 1400,
    event: {
      type: 'line/plain',
      lineId: 's9',
      lang: 'en',
      source: 'script',
      plain: 'The doctor thinks a small part of your gut might be swollen. She wants to press on your belly, take a little blood, and take a picture inside your belly with sound waves.',
    },
  },
  { wait: 3600, focus: 'clinician', event: doc('s11', 'Sure. Palpation is a physical exam, and the CBC screens for inflammation.') },
  { wait: 2600, focus: 'patient', event: { type: 'ui/press', target: 'simpler' } },
  {
    wait: 600,
    focus: 'clinician',
    feature: 'meter',
    narrate: 'A second tap tells the doctor to slow down and rephrase.',
    event: { type: 'patient/simpler', id: 's12' },
  },
  {
    wait: 4200,
    focus: 'patient',
    event: doc(
      's13',
      'Let me slow down. I think a small part inside your belly might be swollen. I want to gently press on your belly, take a little blood, and take a picture of your belly with a scanner. Is that okay?',
      { rephrase: true, replies: ['Yes, that’s okay.', 'Please warn me before you touch me.', 'Can my mom stay?'] },
    ),
  },
  { wait: 3400, focus: 'clinician', event: { type: 'patient/composing', on: true } },
  { wait: 1300, focus: 'patient', event: { type: 'ui/press', target: 'reply-1' } },
  { wait: 700, event: sam('s14', 'Please warn me before you touch me.') },
  {
    wait: 2600,
    focus: 'patient',
    event: doc('s15', 'Of course. I’m going to press on the right side now. Three, two, one.', {
      replies: ['That’s the spot.', 'Stop, please.', 'It’s okay.'],
    }),
  },
  { wait: 900, focus: 'clinician', event: { type: 'accom/provide', accom: 'warn' } },
  { wait: 2200, focus: 'patient', event: { type: 'ui/press', target: 'reply-0' } },
  { wait: 600, event: sam('s16', 'That’s the spot.') },
  {
    wait: 2600,
    event: doc('s17', 'Thank you, Sam. You did great. A nurse will take a little blood, then you’ll get the scan. I’ll write everything down for you.', {
      replies: ['Thank you for listening to me.', 'How long will it take?', 'Can I have water?'],
    }),
  },
  { wait: 3400, event: { type: 'ui/press', target: 'reply-0' } },
  { wait: 700, narrate: 'Sam thanks the doctor, in their own voice.', event: sam('s18', 'Thank you for listening to me.') },
  { wait: 2800, focus: 'clinician', event: mom('s19', 'That’s the first time a doctor has asked Sam first.') },
  {
    wait: 3600,
    focus: 'both',
    feature: 'recap',
    narrate: 'The visit ends with a plain-language recap for Sam, and a communication summary for the doctor.',
    event: { type: 'visit/end', recap: SAMPLE_RECAP },
  },
]

export const SCRIPT_MS = SCRIPT.reduce((n, s) => n + s.wait, 0)

// Every English string a patient sees in the sample visit, for one-shot translation.
export function scriptStrings() {
  const out = {}
  for (const step of SCRIPT) {
    const e = step.event
    if (!e) continue
    if (e.type === 'line/add') {
      out[`l.${e.id}`] = e.who === 'patient' ? e.text : withMarkup(e.text)
      e.replies?.forEach((r, i) => (out[`r.${e.id}.${i}`] = r))
    }
    if (e.type === 'line/plain') out[`p.${e.lineId}`] = e.plain
  }
  out['recap.summary'] = SAMPLE_RECAP.summary
  SAMPLE_RECAP.nextSteps.forEach((s, i) => (out[`recap.${i}`] = s))
  for (const [id, body] of Object.entries(SAMPLE_PROFILE.card)) out[`card.${id}`] = body
  return out
}

// Attach translations to a scripted event (only the patient sees them).
export function localizeEvent(e, lang, tr) {
  if (!tr || lang === 'en') return e
  const pick = (k) => tr[k]
  if (e.type === 'line/add') {
    const local = pick(`l.${e.id}`)
    return {
      ...e,
      local: local ? { [lang]: local } : undefined,
      replies: e.replies?.map((r, i) => ({ en: r, [lang]: pick(`r.${e.id}.${i}`) ?? r })),
    }
  }
  if (e.type === 'line/plain') return { ...e, lang, plain: pick(`p.${e.lineId}`) ?? e.plain }
  if (e.type === 'visit/start') {
    const card = Object.fromEntries(Object.keys(e.patient.card).map((id) => [id, pick(`card.${id}`) ?? e.patient.card[id]]))
    return { ...e, patient: { ...e.patient, language: lang, cardLocal: { [lang]: card } } }
  }
  if (e.type === 'visit/end') {
    return {
      ...e,
      recap: {
        ...e.recap,
        local: {
          [lang]: {
            summary: pick('recap.summary') ?? e.recap.summary,
            nextSteps: e.recap.nextSteps.map((s, i) => pick(`recap.${i}`) ?? s),
          },
        },
      },
    }
  }
  return e
}
