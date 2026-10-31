// High-level visit actions with their side effects: the patient's voice,
// instant offline analysis, then AI enrichment (analysis, translation, plain
// words) when connected. Shared by the patient app, the clinician app, and the
// sample visit, so all three behave identically.
import { aiReady, aiRecap, aiSimplify, aiTranslate, aiTurn, localSimplify, localTurn } from './ai.js'
import { findTerms } from './jargon.js'
import { speak } from './speech.js'
import { lastLine, localRecap, newId, painSentence } from './visit.js'
import { langInfo } from './i18n.js'

const asReply = (r) => (typeof r === 'string' ? { en: r } : r)

/**
 * @param {object} o
 * @param {(e: object) => object} o.dispatch
 * @param {() => object} o.getState
 * @param {{ voice: boolean, rate: number, voiceURI?: string }} o.voice  patient voice settings
 * @param {boolean} [o.ai=true]  false in the scripted sample visit
 */
export function createActions({ dispatch, getState, voice, ai = true }) {
  const patientLang = () => getState().patient?.language ?? 'en'
  const useAi = () => ai && aiReady()
  const talk = (text) => {
    if (voice?.voice !== false) speak(text, { rate: voice?.rate ?? 1, voiceURI: voice?.voiceURI })
  }

  const actions = {
    // ---------- Patient ----------

    /** Speak a reply. `item` is English text or {en, [lang]: text}. */
    say(item, { kind = 'reply', accom } = {}) {
      const r = asReply(item)
      const pl = patientLang()
      dispatch({ type: 'line/add', who: 'patient', to: 'clinician', text: r.en, kind, accom, local: r[pl] ? { [pl]: r[pl] } : undefined, source: 'tap' })
      talk(r.en)
    },

    /** Patient typed in their own language: translate for the clinician, then speak. */
    async sayTyped(text) {
      const clean = text.trim()
      if (!clean) return
      const pl = patientLang()
      let en = clean
      if (pl !== 'en' && langInfo(pl).code !== 'en' && useAi()) {
        try {
          en = (await aiTranslate({ text: clean, from: pl, to: 'en' })).translation || clean
        } catch {
          /* speak it as typed */
        }
      }
      dispatch({ type: 'line/add', who: 'patient', to: 'clinician', text: en, kind: 'typed', local: pl !== 'en' ? { [pl]: clean } : undefined, source: 'typed' })
      talk(en)
    },

    need(q) {
      actions.say(q.say, { kind: 'need', accom: q.accom })
    },

    replay(line) {
      talk(line.text)
    },

    /** "Say it simpler": tell the clinician, and rewrite the last line in plain words now. */
    async simpler() {
      const s = getState()
      const target = lastLine(s, ['clinician', 'caregiver'])
      dispatch({ type: 'patient/simpler' })
      talk('Can you say that more simply?')
      if (!target || !ai) return
      dispatch({ type: 'line/plain', lineId: target.id, lang: 'en', plain: localSimplify(target.text), source: 'local' })
      if (!useAi()) return
      const pl = patientLang()
      try {
        const r = await aiSimplify({ text: target.text, profile: s.patient, lang: pl })
        if (r.plain_en) dispatch({ type: 'line/plain', lineId: target.id, lang: 'en', plain: r.plain_en, source: 'ai' })
        if (r.plain && pl !== 'en') dispatch({ type: 'line/plain', lineId: target.id, lang: pl, plain: r.plain, source: 'ai' })
      } catch {
        /* the offline version is already showing */
      }
    },

    painSet(field, value) {
      dispatch({ type: 'pain/set', field, value })
    },

    sendPain() {
      const p = getState().pain
      if (!p.region) return
      dispatch({ type: 'pain/send' })
      talk(painSentence(p))
    },

    tab(tab) {
      dispatch({ type: 'ui/tab', tab })
    },

    composing(on) {
      if (getState().composing !== on) dispatch({ type: 'patient/composing', on })
    },

    shareCard() {
      dispatch({ type: 'card/share' })
    },

    // ---------- Clinician side (or any device that captions the room) ----------

    /** Someone in the room spoke. Caption instantly, then enrich with AI. */
    async hear(text, { who = 'clinician', source = 'mic' } = {}) {
      const clean = text.trim()
      if (!clean) return null
      const s = getState()
      const local = localTurn(clean, s.patient)
      const id = newId('l')
      dispatch({
        type: 'line/add',
        id,
        who,
        to: who === 'clinician' ? local.addressee : 'clinician',
        text: clean,
        terms: local.terms,
        replies: who === 'clinician' ? local.replies : undefined,
        repliesSource: 'local',
        source,
      })
      if (!useAi()) return id
      const pl = patientLang()
      try {
        const r = await aiTurn({ utterance: clean, profile: s.patient, lines: getState().lines, lang: pl })
        const speaker = who === 'clinician' && r.speaker === 'caregiver' ? 'caregiver' : who
        const patch = { who: speaker, terms: findTerms(clean, r.terms ?? []) }
        // Unambiguous wording ("So Mom, …", "Sam, …") wins; the model decides everything else.
        if (speaker === 'clinician' && r.addressee) patch.to = local.strong ? local.addressee : r.addressee === 'caregiver' ? 'caregiver' : 'patient'
        if (speaker !== 'clinician') patch.to = 'clinician'
        dispatch({ type: 'line/update', lineId: id, patch })
        if (r.translation && pl !== 'en') dispatch({ type: 'line/translate', lineId: id, lang: pl, text: r.translation })
        if (speaker === 'clinician' && r.replies?.length) {
          dispatch({
            type: 'replies/set',
            forId: id,
            source: 'ai',
            items: r.replies.map((x) => (typeof x === 'string' ? { en: x } : { en: x.en, ...(x.local && pl !== 'en' ? { [pl]: x.local } : {}) })),
          })
        }
      } catch {
        /* offline analysis stands */
      }
      return id
    },

    provide(accom) {
      dispatch({ type: 'accom/provide', accom })
    },

    unprovide(accom) {
      dispatch({ type: 'accom/unprovide', accom })
    },

    ack(nudge) {
      dispatch({ type: 'nudge/ack', nudge })
    },

    /** End the visit with a recap: AI when connected, otherwise built locally. */
    async end() {
      const s = getState()
      if (s.ended) return
      const pl = patientLang()
      let recap = null
      if (useAi()) {
        try {
          const r = await aiRecap({ profile: s.patient, lines: s.lines, accoms: s.accoms, lang: pl })
          recap = {
            summary: r.summary,
            nextSteps: r.next_steps ?? [],
            local: r.local && pl !== 'en' ? { [pl]: { summary: r.local.summary, nextSteps: r.local.next_steps ?? [] } } : undefined,
            source: 'ai',
          }
        } catch {
          /* fall through to the local recap */
        }
      }
      dispatch({ type: 'visit/end', recap: recap ?? localRecap(s) })
    },
  }
  return actions
}
