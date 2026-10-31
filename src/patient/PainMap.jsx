import clsx from 'clsx'
import { Send } from 'lucide-react'
import { QUALITIES, SEVERITIES, DURATIONS } from '../core/catalog.js'
import { Button, Chip } from '../ui/kit.jsx'

// Front view: the patient's right side is on the viewer's left.
const SHAPES = {
  head: <ellipse cx="80" cy="30" rx="20" ry="23" />,
  chest: <path d="M52 62 Q80 52 108 62 L110 106 L50 106 Z" />,
  upper: <rect x="52" y="108" width="56" height="30" rx="6" />,
  rlq: <path d="M52 140 H79 V182 H62 Q52 172 52 160 Z" />,
  llq: <path d="M81 140 H108 V160 Q108 172 98 182 H81 Z" />,
  arms: (
    <>
      <path d="M48 64 Q32 70 30 96 L26 160 Q32 166 40 162 L46 106 Z" />
      <path d="M112 64 Q128 70 130 96 L134 160 Q128 166 120 162 L114 106 Z" />
    </>
  ),
  legs: (
    <>
      <path d="M58 186 H79 L76 292 Q68 296 60 292 Z" />
      <path d="M81 186 H102 L100 292 Q92 296 84 292 Z" />
    </>
  ),
}

export default function PainMap({ pain, set, send, t, doctor, press }) {
  const ready = Boolean(pain.region && pain.severity)
  return (
    <div className="pain">
      <div className="pain-top">
        <figure className="pain-figure">
          <svg viewBox="0 0 160 300" role="group" aria-label={t('pain.where')}>
            {Object.entries(SHAPES).map(([id, shape]) => (
              <g
                key={id}
                role="button"
                tabIndex={0}
                aria-label={t(`region.${id}`)}
                aria-pressed={pain.region === id}
                className={clsx('pain-region', pain.region === id && 'is-on')}
                onClick={() => set('region', id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    set('region', id)
                  }
                }}
              >
                {shape}
              </g>
            ))}
          </svg>
          <figcaption className="pain-sides" aria-hidden="true">
            <span>{t('pain.right')}</span>
            <span>{t('pain.left')}</span>
          </figcaption>
        </figure>

        <div className="pain-side">
          <p className="pain-where" aria-live="polite">
            {pain.region ? t('pain.hurts', { region: t(`region.${pain.region}`) }) : t('pain.where')}
          </p>
          <Chip pressed={pain.region === 'back'} onClick={() => set('region', 'back')}>
            {t('region.back')}
          </Chip>
          <fieldset className="pain-set">
            <legend>{t('pain.howBad')}</legend>
            <div className="pain-sev">
              {SEVERITIES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  className={clsx('pain-sev-btn', `sev-${s.value}`)}
                  aria-pressed={pain.severity === s.value}
                  onClick={() => set('severity', s.value)}
                >
                  <span>{t(`severity.${s.value}`)}</span>
                  <span className="pain-sev-num">{s.value}/10</span>
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      </div>

      <fieldset className="pain-set">
        <legend>{t('pain.feel')}</legend>
        <div className="chips-wrap">
          {QUALITIES.map((q) => (
            <Chip key={q} pressed={pain.qualities.includes(q)} onClick={() => set('quality', q)}>
              {t(`quality.${q}`)}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset className="pain-set">
        <legend>{t('pain.howLong')}</legend>
        <div className="chips-wrap">
          {DURATIONS.map((d) => (
            <Chip key={d} pressed={pain.duration === d} onClick={() => set('duration', d)}>
              {t(`duration.${d}`)}
            </Chip>
          ))}
        </div>
      </fieldset>

      <Button variant="accent" size="lg" block icon={Send} disabled={!ready} onClick={send} className={clsx(press === 'pain-send' && 'is-pressing')}>
        {t('pain.send', { doctor })}
      </Button>
    </div>
  )
}
