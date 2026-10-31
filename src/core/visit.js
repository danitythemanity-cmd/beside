// The visit engine. A visit is an append-only log of events; every screen
// (patient phone, clinician tablet, the sample visit, history) reduces the same
// log to the same state. Events whose type starts with "ui/" are device-local
// and never synced.
import { ACCOMMODATIONS, REGIONS, SAMPLE_CLINICIAN } from './catalog.js'
import { findTerms, countTerms } from './jargon.js'

let seq = 0
export const newId = (prefix = 'e') => `${prefix}${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`

export const isLocalEvent = (e) => e.type.startsWith('ui/')

// Stamp an event with id and time if it doesn't have them yet.
export function stamp(e) {
  return { id: e.id ?? newId(), at: e.at ?? Date.now(), ...e }
}

const emptyPain = { region: null, qualities: [], severity: null, duration: null }

export function createVisit({ code = '', patient = null, clinician = SAMPLE_CLINICIAN, startedAt = null } = {}) {
  return {
    code,
    startedAt,
    endedAt: null,
    patient,
    clinician,
    cardShared: false,
    lines: [],
    replies: { forId: null, items: [], source: null },
    composing: false,
    simplerCount: 0,
    simplerTotal: 0,
    rephraseNeeded: false,
    rephrased: 0,
    directAcked: null,
    accoms: [],
    pain: emptyPain,
    painReports: [],
    recap: null,
    ended: false,
    ui: { tab: 'talk', press: null },
  }
}

function upsertAccom(list, id, patch) {
  const i = list.findIndex((a) => a.id === id)
  if (i === -1) {
    return [...list, { id, need: ACCOMMODATIONS[id]?.need ?? id, source: 'visit', status: 'requested', ...patch }]
  }
  return list.map((a, j) => (j === i ? { ...a, ...patch } : a))
}

export function lastLine(state, who) {
  for (let i = state.lines.length - 1; i >= 0; i--) {
    const l = state.lines[i]
    if (!who || (Array.isArray(who) ? who.includes(l.who) : l.who === who)) return l
  }
  return null
}

export function painSummary(p) {
  const region = REGIONS[p.region]?.clinical ?? 'unspecified site'
  const quality = p.qualities.filter((q) => q !== 'Worse when I move').map((q) => q.toLowerCase())
  return [
    `Patient-reported ${quality.length ? quality.join(', ') + ' ' : ''}pain, ${region}.`,
    p.severity ? `Severity ${p.severity}/10.` : null,
    p.duration ? `Duration: ${p.duration.toLowerCase()}.` : null,
    p.qualities.includes('Worse when I move') ? 'Aggravated by movement.' : null,
    'Reported non-verbally via body map; may not show typical pain behaviors (see card).',
  ]
    .filter(Boolean)
    .join(' ')
}

const STARTED = {
  Today: 'It started today.',
  '1–2 days': 'It started a day or two ago.',
  '3 days': 'It started 3 days ago.',
  'A week or more': 'It started a week or more ago.',
}

// What the patient's voice says when they send a pain report.
export function painSentence(p) {
  const where = REGIONS[p.region]?.label.toLowerCase() ?? 'my body'
  const feel = p.qualities.filter((q) => q !== 'Worse when I move').map((q) => q.toLowerCase())
  return [
    `It hurts in my ${where}.`,
    feel.length ? `It feels ${feel.join(' and ')}.` : null,
    p.severity ? `It’s ${p.severity} out of 10.` : null,
    p.qualities.includes('Worse when I move') ? 'It’s worse when I move.' : null,
    STARTED[p.duration] ?? null,
  ]
    .filter(Boolean)
    .join(' ')
}

export function reducer(state, e) {
  // Any synced event clears the scripted "press" highlight.
  const s = e.type === 'ui/press' || !state.ui.press ? state : { ...state, ui: { ...state.ui, press: null } }

  switch (e.type) {
    case 'visit/start':
      return createVisit({ code: e.code, patient: e.patient, clinician: e.clinician ?? SAMPLE_CLINICIAN, startedAt: e.at })

    case 'clinician/join':
      return { ...s, clinician: { ...s.clinician, ...e.clinician } }

    case 'card/share': {
      let accoms = s.accoms
      for (const id of s.patient?.accommodations ?? []) {
        if (!accoms.some((a) => a.id === id)) accoms = upsertAccom(accoms, id, { source: 'card', at: e.at })
      }
      return { ...s, cardShared: true, accoms }
    }

    case 'line/add': {
      const line = {
        id: e.id,
        at: e.at,
        who: e.who,
        to: e.to ?? (e.who === 'patient' ? 'clinician' : 'patient'),
        text: e.text,
        terms: e.terms ?? (e.who === 'patient' ? [] : findTerms(e.text)),
        kind: e.kind ?? 'speech',
        plain: {},
        local: e.local ?? {},
        source: e.source ?? 'script',
      }
      let next = { ...s, lines: [...s.lines, line] }
      if (line.who === 'clinician') {
        next.replies = { forId: line.id, items: e.replies ?? [], source: e.replies ? e.repliesSource ?? 'script' : null }
        const prev = lastLine(s, 'clinician')
        if (line.to === 'patient' && prev?.to === 'caregiver' && next.accoms.some((a) => a.id === 'direct')) {
          next.accoms = upsertAccom(next.accoms, 'direct', { status: 'provided', providedAt: e.at })
        }
        if (e.rephrase) {
          next.rephraseNeeded = false
          next.simplerCount = 0
          next.rephrased = s.rephrased + 1
        }
      }
      if (line.who === 'patient') {
        next.composing = false
        next.replies = { forId: s.replies.forId, items: [], source: null }
        // A real answer means the patient understood; the slow-down prompt can rest.
        if (line.kind !== 'simpler') next.rephraseNeeded = false
      }
      if (e.accom) next.accoms = upsertAccom(next.accoms, e.accom, { source: 'visit', at: e.at })
      return next
    }

    case 'line/update':
      return { ...s, lines: s.lines.map((l) => (l.id === e.lineId ? { ...l, ...e.patch } : l)) }

    // Plain-words rewrite after "Say it simpler", per language.
    case 'line/plain':
      return {
        ...s,
        lines: s.lines.map((l) => (l.id === e.lineId ? { ...l, plain: { ...l.plain, [e.lang ?? 'en']: e.plain }, plainSource: e.source ?? 'local' } : l)),
      }

    // Live translation of a line into the patient's language.
    case 'line/translate':
      return { ...s, lines: s.lines.map((l) => (l.id === e.lineId ? { ...l, local: { ...l.local, [e.lang]: e.text } } : l)) }

    case 'replies/set':
      if (e.forId && e.forId !== lastLine(s, 'clinician')?.id) return s
      return { ...s, replies: { forId: e.forId, items: e.items.slice(0, 3), source: e.source ?? 'ai' } }

    case 'patient/composing':
      return { ...s, composing: Boolean(e.on) }

    case 'patient/simpler': {
      const simplerCount = s.simplerCount + 1
      return {
        ...s,
        simplerCount,
        simplerTotal: s.simplerTotal + 1,
        rephraseNeeded: simplerCount >= 2,
        composing: false,
        lines: [
          ...s.lines,
          { id: e.id, at: e.at, who: 'patient', to: 'clinician', text: 'Can you say that more simply?', terms: [], kind: 'simpler', source: e.source ?? 'tap' },
        ],
      }
    }

    case 'nudge/ack':
      if (e.nudge === 'slow') return { ...s, rephraseNeeded: false, simplerCount: 0, rephrased: s.rephrased + 1 }
      if (e.nudge === 'direct') return { ...s, directAcked: lastLine(s, 'clinician')?.id ?? null }
      return s

    case 'accom/request':
      return { ...s, accoms: upsertAccom(s.accoms, e.accom, { source: e.source ?? 'visit', at: e.at, status: 'requested' }) }

    case 'accom/provide':
      return { ...s, accoms: upsertAccom(s.accoms, e.accom, { status: 'provided', providedAt: e.at }) }

    case 'accom/unprovide':
      return { ...s, accoms: upsertAccom(s.accoms, e.accom, { status: 'requested', providedAt: null }) }

    case 'pain/set': {
      const p = { ...s.pain }
      if (e.field === 'quality') {
        p.qualities = p.qualities.includes(e.value) ? p.qualities.filter((q) => q !== e.value) : [...p.qualities, e.value]
      } else {
        p[e.field] = p[e.field] === e.value && e.field !== 'region' ? null : e.value
      }
      return { ...s, pain: p }
    }

    case 'pain/send': {
      const p = s.pain
      if (!p.region) return s
      const report = { id: e.id, at: e.at, ...p, summary: painSummary(p) }
      return {
        ...s,
        pain: emptyPain,
        painReports: [...s.painReports, report],
        composing: false,
        replies: { ...s.replies, items: [] },
        lines: [...s.lines, { id: `${e.id}-l`, at: e.at, who: 'patient', to: 'clinician', text: painSentence(p), terms: [], kind: 'pain', painId: e.id, source: 'pain' }],
      }
    }

    case 'visit/end': {
      let accoms = s.accoms
      if (accoms.some((a) => a.id === 'written')) accoms = upsertAccom(accoms, 'written', { status: 'provided', providedAt: e.at })
      const clin = s.lines.filter((l) => l.who === 'clinician')
      const spokeDirectly = clin.some((l) => l.to === 'patient') && clin.at(-1)?.to !== 'caregiver'
      if (spokeDirectly && accoms.some((a) => a.id === 'direct' && a.status !== 'provided')) {
        accoms = upsertAccom(accoms, 'direct', { status: 'provided', providedAt: e.at })
      }
      return { ...s, ended: true, endedAt: e.at, recap: e.recap ?? null, accoms, composing: false, replies: { ...s.replies, items: [] } }
    }

    case 'ui/tab':
      return { ...s, ui: { ...s.ui, tab: e.tab } }

    case 'ui/press':
      return { ...s, ui: { ...s.ui, press: e.target } }

    default:
      return s
  }
}

export const reduceAll = (events, init = createVisit()) => events.reduce(reducer, init)

// ---------- Selectors ----------

export const currentCaption = (state) => lastLine(state, ['clinician', 'caregiver'])

export function nudges(state) {
  const out = []
  const last = lastLine(state, 'clinician')
  const name = state.patient?.name ?? 'the patient'
  if (last?.to === 'caregiver' && state.directAcked !== last.id && !state.ended) {
    out.push({
      id: 'direct',
      tone: 'warn',
      title: `Please speak directly to ${name}.`,
      body: `${name} understands you and answers by tapping. Their companion is here for support.`,
    })
  }
  if (state.rephraseNeeded && !state.ended) {
    out.push({
      id: 'slow',
      tone: 'warn',
      title: `${name} asked twice for simpler words.`,
      body: 'Slow down, use short sentences, and check in: “Does that make sense?”',
      ack: 'I’ll rephrase',
    })
  }
  if (state.composing && !state.ended) {
    out.push({ id: 'wait', tone: 'info', title: `${name} is answering…`, body: 'Give them a moment. Silence is okay.' })
  }
  return out
}

export function jargonCount(state) {
  return state.lines.filter((l) => l.who !== 'patient').reduce((n, l) => n + countTerms(l.text, l.terms), 0)
}

export function decodedGlossary(state) {
  const map = new Map()
  for (const l of state.lines) for (const t of l.terms ?? []) if (l.text.toLowerCase().includes(t.term.toLowerCase())) map.set(t.term.toLowerCase(), t.plain)
  return [...map].map(([term, plain]) => ({ term, plain }))
}

// Communication summary for the clinician after the visit.
export function metrics(state) {
  const clin = state.lines.filter((l) => l.who === 'clinician')
  const addressed = clin.filter((l) => l.to === 'patient' || l.to === 'caregiver')
  const direct = addressed.filter((l) => l.to === 'patient').length
  const accomsTotal = state.accoms.length
  const accomsProvided = state.accoms.filter((a) => a.status === 'provided').length
  const patientTurns = state.lines.filter((l) => l.who === 'patient' && l.kind !== 'simpler').length
  return {
    clinicianLines: clin.length,
    directPct: addressed.length ? Math.round((direct / addressed.length) * 100) : 100,
    toCaregiver: addressed.length - direct,
    jargon: jargonCount(state),
    simpler: state.simplerTotal,
    rephrased: state.rephrased,
    accomsProvided,
    accomsTotal,
    patientTurns,
    painReports: state.painReports.length,
    minutes: state.startedAt ? Math.max(1, Math.round(((state.endedAt ?? Date.now()) - state.startedAt) / 60000)) : 0,
  }
}

export function coachingTips(state) {
  const m = metrics(state)
  const name = state.patient?.name ?? 'the patient'
  const tips = []
  if (m.toCaregiver > 0) tips.push(`You addressed ${name}’s companion ${m.toCaregiver === 1 ? 'once' : `${m.toCaregiver} times`}. Speaking to ${name} first builds trust.`)
  if (m.jargon >= 4) tips.push(`Beside decoded ${m.jargon} medical terms. Leading with plain words saves ${name} a step.`)
  if (m.simpler > 0 && m.rephrased > 0) tips.push(`When ${name} asked for simpler words, you rephrased. That made the difference.`)
  const missing = state.accoms.filter((a) => a.status !== 'provided')
  if (missing.length) tips.push(`Not yet provided: ${missing.map((a) => a.need.toLowerCase()).join(', ')}.`)
  if (!tips.length) tips.push(`Great visit. ${name} was spoken to directly and every request was met.`)
  return tips
}

export const NO_STEPS = 'Ask the doctor what happens next, and ask them to write it down for you.'

// Offline recap: built from what was said, used when the AI is unavailable.
export function localRecap(state) {
  // Statements, not questions, are what the patient needs to remember.
  const said = state.lines.filter((l) => l.who === 'clinician' && !l.text.trim().endsWith('?'))
  const report = state.painReports.at(-1)
  const summary = report
    ? `You told the doctor where it hurts: ${REGIONS[report.region]?.label.toLowerCase()}, ${report.severity ?? '?'} out of 10.`
    : 'Here is what the doctor told you, in plain words.'
  const steps = said.slice(-4).map((l) => l.plain?.en || swapForRecap(l))
  return {
    summary,
    nextSteps: steps.length ? steps : [NO_STEPS],
    source: 'local',
  }
}

function swapForRecap(line) {
  let out = line.text
  for (const t of [...(line.terms ?? [])].sort((a, b) => b.term.length - a.term.length)) {
    out = out.replace(new RegExp(t.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), t.plain)
  }
  return out
}

export function formatClock(ms) {
  if (!ms || ms < 0) return '0:00'
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function makeCode() {
  return String(Math.floor(1000 + Math.random() * 9000))
}

// Snapshot saved to visit history when a visit ends.
export function historyEntry(state) {
  return {
    code: state.code,
    startedAt: state.startedAt,
    endedAt: state.endedAt,
    clinician: state.clinician,
    patientName: state.patient?.name,
    recap: state.recap,
    accoms: state.accoms,
    glossary: decodedGlossary(state),
    painReports: state.painReports,
    metrics: metrics(state),
    lines: state.lines.map(({ id, who, to, text, kind }) => ({ id, who, to, text, kind })),
  }
}
