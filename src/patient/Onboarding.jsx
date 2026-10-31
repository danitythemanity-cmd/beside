// First-run setup and the card editor. Everything is stored on the device.
import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { Check, ArrowLeft, ArrowRight, Volume2, Sparkles, MessageCircle, Ear, Languages, Brain, Accessibility, Lock } from 'lucide-react'
import { MODES, ACCOMMODATIONS, MODE_SUGGESTIONS, CARD_SECTIONS, SAMPLE_PROFILE } from '../core/catalog.js'
import { LANGS, useT, loadLanguage } from '../core/i18n.js'
import { useAi, aiStrings } from '../core/ai.js'
import { useSettings } from '../core/settings.jsx'
import { speak } from '../core/speech.js'
import { newId } from '../core/visit.js'
import { Button, Field, Switch, LogoMark } from '../ui/kit.jsx'

const MODE_ICONS = { nonverbal: MessageCircle, autistic: Sparkles, deaf: Ear, speech: Languages, cognitive: Brain, other: Accessibility }

export const blankProfile = (language = 'en') => ({
  id: newId('p'),
  name: '',
  pronouns: '',
  modes: [],
  companion: { name: '', relation: '' },
  card: { communicate: '', overwhelm: '', pain: '', needs: '' },
  accommodations: [],
  language,
})

export function AboutFields({ draft, set, t }) {
  return (
    <div className="stack" style={{ '--gap': '16px' }}>
      <Field label={t('ob.name')}>
        <input className="input" value={draft.name} onChange={(e) => set({ name: e.target.value })} autoComplete="given-name" required />
      </Field>
      <Field label={t('ob.pronouns')}>
        <input className="input" value={draft.pronouns} onChange={(e) => set({ pronouns: e.target.value })} placeholder="they/them" />
      </Field>
      <fieldset className="pain-set">
        <legend>{t('ob.companion')}</legend>
        <div className="row" style={{ '--gap': '8px', flexWrap: 'nowrap' }}>
          <input className="input" aria-label={t('ob.companionName')} placeholder={t('ob.companionName')} value={draft.companion?.name ?? ''} onChange={(e) => set({ companion: { ...draft.companion, name: e.target.value } })} />
          <input className="input" aria-label={t('ob.companionRel')} placeholder={t('ob.companionRel')} value={draft.companion?.relation ?? ''} onChange={(e) => set({ companion: { ...draft.companion, relation: e.target.value } })} />
        </div>
      </fieldset>
    </div>
  )
}

export function ModesPicker({ draft, set, t }) {
  return (
    <div className="stack" style={{ '--gap': '8px' }} role="group" aria-label={t('ob.how')}>
      {MODES.map((m) => {
        const Icon = MODE_ICONS[m.id]
        const on = draft.modes.includes(m.id)
        return (
          <button
            key={m.id}
            type="button"
            className="ob-option"
            aria-pressed={on}
            onClick={() => set((d) => ({ modes: d.modes.includes(m.id) ? d.modes.filter((x) => x !== m.id) : [...d.modes, m.id] }))}
          >
            <Icon aria-hidden="true" />
            <span>{t(`mode.${m.id}`)}</span>
            <span className="ob-check" aria-hidden="true">
              {on && <Check />}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function CardFields({ draft, set, t }) {
  const add = (id, text) =>
    set((d) => {
      const cur = d.card[id] ?? ''
      return cur.includes(text) ? {} : { card: { ...d.card, [id]: (cur ? cur.trim() + ' ' : '') + text } }
    })
  return (
    <div className="stack" style={{ '--gap': '12px' }}>
      {CARD_SECTIONS.map((s) => (
        <section key={s.id} className="ob-section" aria-labelledby={`sec-${s.id}`}>
          <h2 id={`sec-${s.id}`}>{t(`section.${s.id}`)}</h2>
          <label htmlFor={`card-${s.id}`} className="small muted">
            {t(`section.${s.id}.prompt`)}
          </label>
          <div className="sugg" role="group" aria-label={t('ob.tapToAdd')}>
            {s.suggestions.map((x, i) => {
              const text = t(`sugg.${s.id}.${i}`)
              return (
                <button key={i} type="button" className="chip" aria-pressed={(draft.card[s.id] ?? '').includes(text)} onClick={() => add(s.id, text)}>
                  {text}
                </button>
              )
            })}
          </div>
          <textarea id={`card-${s.id}`} className="textarea" value={draft.card[s.id] ?? ''} onChange={(e) => set({ card: { ...draft.card, [s.id]: e.target.value } })} rows={3} />
        </section>
      ))}
    </div>
  )
}

export function NeedsPicker({ draft, set, t }) {
  return (
    <div className="stack" style={{ '--gap': '8px' }}>
      {Object.entries(ACCOMMODATIONS).map(([id, a]) => {
        const on = draft.accommodations.includes(id)
        return (
          <button
            key={id}
            type="button"
            role="checkbox"
            aria-checked={on}
            className="ob-option"
            onClick={() => set((d) => ({ accommodations: d.accommodations.includes(id) ? d.accommodations.filter((x) => x !== id) : [...d.accommodations, id] }))}
          >
            <span>
              {t(`accom.${id}`)}
              {draft.language === 'en' && <small>{a.detail}</small>}
            </span>
            <span className="ob-check" aria-hidden="true">
              {on && <Check />}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export default function Onboarding({ onDone }) {
  const [draft, setDraft] = useState(() => blankProfile())
  const [step, setStep] = useState(0)
  const [settings, setSettings] = useSettings()
  const ai = useAi()
  const t = useT(draft.language)
  const set = (patch) => setDraft((d) => ({ ...d, ...(typeof patch === 'function' ? patch(d) : patch) }))
  const TOTAL = 5

  useEffect(() => {
    if (draft.language !== 'en' && ai.state === 'ready') loadLanguage(draft.language, aiStrings)
  }, [draft.language, ai.state])

  // Suggest accommodations from the chosen communication modes.
  const goNeeds = () => {
    if (!draft.accommodations.length) {
      const picks = [...new Set(draft.modes.flatMap((m) => MODE_SUGGESTIONS[m] ?? []))]
      set({ accommodations: picks })
    }
    setStep(4)
  }

  const finish = () => onDone({ ...draft, name: draft.name.trim() || 'Me' })

  if (step === 0) {
    return (
      <div className="ob ob-hero">
        <LogoMark size={56} />
        <h1 data-route-focus>{t('ob.welcome')}</h1>
        <p className="muted" style={{ fontSize: '1.08rem' }}>
          {t('ob.welcomeBody')}
        </p>
        <Field label={t('ob.language')}>
          <select className="select" value={draft.language} onChange={(e) => set({ language: e.target.value })}>
            {LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.native}
                {l.native !== l.name ? ` · ${l.name}` : ''}
              </option>
            ))}
          </select>
        </Field>
        <div className="stack" style={{ '--gap': '10px', marginTop: 8 }}>
          <Button variant="accent" size="lg" block onClick={() => setStep(1)} iconEnd={ArrowRight}>
            {t('ob.setup')}
          </Button>
          <Button variant="secondary" size="lg" block onClick={() => onDone({ ...SAMPLE_PROFILE, language: draft.language })}>
            {t('ob.sample')}
          </Button>
        </div>
        <p className="small muted row" style={{ '--gap': '8px' }}>
          <Lock size={14} aria-hidden="true" /> {t('ob.private')}
        </p>
      </div>
    )
  }

  const titles = [null, t('ob.about'), t('ob.how'), t('ob.card'), t('ob.needs'), t('ob.voice')]
  const hints = [null, null, t('ob.howHint'), t('ob.cardHint'), t('ob.needsHint'), t('ob.voiceHint')]
  const canNext = step !== 1 || draft.name.trim().length > 0

  return (
    <div className="ob">
      <div className="stack" style={{ '--gap': '10px' }}>
        <div className="ob-progress" aria-hidden="true">
          {Array.from({ length: TOTAL }, (_, i) => (
            <span key={i} className={clsx(i < step && 'is-on')} />
          ))}
        </div>
        <p className="small muted">{t('common.step', { n: step, total: TOTAL })}</p>
        <h1 data-route-focus tabIndex={-1} key={step}>
          {titles[step]}
        </h1>
        {hints[step] && <p className="muted">{hints[step]}</p>}
      </div>

      {step === 1 && <AboutFields draft={draft} set={set} t={t} />}
      {step === 2 && <ModesPicker draft={draft} set={set} t={t} />}
      {step === 3 && <CardFields draft={draft} set={set} t={t} />}
      {step === 4 && <NeedsPicker draft={draft} set={set} t={t} />}
      {step === 5 && (
        <div className="stack" style={{ '--gap': '14px' }}>
          <Switch checked={settings.voice} onChange={(voice) => setSettings({ voice })}>
            {t('settings.voiceOn')}
          </Switch>
          <div className="field">
            <label htmlFor="ob-rate">
              {t('settings.rate')} <span className="muted">· {settings.rate.toFixed(1)}×</span>
            </label>
            <input id="ob-rate" className="range" type="range" min="0.6" max="1.6" step="0.1" value={settings.rate} onChange={(e) => setSettings({ rate: Number(e.target.value) })} />
          </div>
          <Button variant="secondary" icon={Volume2} onClick={() => speak(`Hi, I’m ${draft.name || 'here'}. Please talk to me directly.`, { rate: settings.rate, voiceURI: settings.voiceURI })}>
            {t('settings.test')}
          </Button>
        </div>
      )}

      <div className="ob-actions">
        <Button variant="secondary" icon={ArrowLeft} onClick={() => setStep((s) => s - 1)}>
          {t('common.back')}
        </Button>
        {step < TOTAL ? (
          <Button variant="primary" iconEnd={ArrowRight} disabled={!canNext} onClick={() => (step === 3 ? goNeeds() : setStep((s) => s + 1))}>
            {t('common.next')}
          </Button>
        ) : (
          <Button variant="accent" icon={Check} onClick={finish}>
            {t('ob.finish')}
          </Button>
        )}
      </div>
    </div>
  )
}
