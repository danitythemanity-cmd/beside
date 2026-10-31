import { Check, Clock, Volume2, Square, Sparkles, BookOpen } from 'lucide-react'
import { useState } from 'react'
import { speak, stopSpeaking } from '../core/speech.js'
import { langInfo } from '../core/i18n.js'
import { Badge, Button } from '../ui/kit.jsx'
import { stripMarkup } from '../ui/speech.jsx'

/** The patient's plain-language recap. Used at the end of a visit and in history. */
export default function PatientRecap({ recap, accoms = [], glossary = [], lang, t, footer, headingLevel = 2 }) {
  const [reading, setReading] = useState(false)
  const H = `h${headingLevel}`
  const S = `h${headingLevel + 1}`
  if (!recap) {
    return (
      <div className="recap-wait" role="status">
        <span className="typing" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        {t('recap.waiting')}
      </div>
    )
  }
  const local = lang !== 'en' ? recap.local?.[lang] : null
  const summary = stripMarkup(local?.summary ?? recap.summary)
  const steps = (local?.nextSteps?.length ? local.nextSteps : recap.nextSteps).map(stripMarkup)

  const read = () => {
    if (reading) {
      stopSpeaking()
      return setReading(false)
    }
    setReading(true)
    const voiceLang = local ? langInfo(lang).voice : 'en-US'
    const synth = window.speechSynthesis
    const v = synth?.getVoices().find((x) => x.lang?.toLowerCase().startsWith(voiceLang.slice(0, 2).toLowerCase()))
    speak([summary, ...steps].join(' '), { voiceURI: v?.voiceURI, onEnd: () => setReading(false) })
  }

  return (
    <div className="recap">
      <section className="recap-hero" aria-labelledby="recap-plain">
        <div className="row" style={{ '--gap': '8px' }}>
          <H id="recap-plain" className="eyebrow">
            {t('recap.plain')}
          </H>
          {recap.source === 'ai' && (
            <Badge tone="mint" icon={Sparkles}>
              AI
            </Badge>
          )}
        </div>
        <p className="recap-summary">{summary}</p>
        <S className="recap-sub">{t('recap.next')}</S>
        <ol className="recap-steps">
          {steps.map((s, i) => (
            <li key={i}>
              <span className="recap-num" aria-hidden="true">
                {i + 1}
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
        <Button variant="secondary" icon={reading ? Square : Volume2} onClick={read}>
          {reading ? t('common.stop') : t('common.readAloud')}
        </Button>
      </section>

      {accoms.length > 0 && (
        <section className="recap-block" aria-labelledby="recap-asked">
          <S id="recap-asked" className="recap-sub">
            {t('recap.asked')}
          </S>
          <ul className="accom-list">
            {accoms.map((a) => (
              <li key={a.id} className={a.status === 'provided' ? 'is-done' : 'is-open'}>
                <span className="accom-icon" aria-hidden="true">
                  {a.status === 'provided' ? <Check /> : <Clock />}
                </span>
                <span className="accom-need">{t(`accom.${a.id}`) === `accom.${a.id}` ? a.need : t(`accom.${a.id}`)}</span>
                <span className="accom-status">{a.status === 'provided' ? t('common.provided') : t('common.notYet')}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {glossary.length > 0 && (
        <section className="recap-block" aria-labelledby="recap-words">
          <S id="recap-words" className="recap-sub row" style={{ '--gap': '8px' }}>
            <BookOpen size={16} aria-hidden="true" />
            {t('recap.words')}
          </S>
          <dl className="glossary">
            {glossary.map((g) => (
              <div key={g.term}>
                <dt>{g.term}</dt>
                <dd>{g.plain}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      {footer}
    </div>
  )
}
