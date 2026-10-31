// The patient's visit screen: captions, replies, phrase board, pain map, card,
// and video calls. Rendered full-screen in the patient app and inside the
// phone frame of the sample visit. All state comes from the visit engine.
import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import {
  MessageCircle, LayoutGrid, Activity, IdCard, Settings, Sparkles, Languages, Lightbulb, Send, RotateCcw, Captions, CaptionsOff, Video,
  ThumbsUp, ThumbsDown, Hourglass, Hand, CircleHelp, Frown, Coffee, Bath, GlassWater, Heart, SunDim, VolumeX, LifeBuoy, Check, Clock, Share2,
} from 'lucide-react'
import { BOARD, cardSections } from '../core/catalog.js'
import { currentCaption, lastLine, formatClock, decodedGlossary } from '../core/visit.js'
import { useAi } from '../core/ai.js'
import { useT, dirOf } from '../core/i18n.js'
import { Badge, Button, IconButton, Tabs } from '../ui/kit.jsx'
import { LiveCaption, spokenText, stripMarkup } from '../ui/speech.jsx'
import { VideoPanel, IncomingCall } from '../ui/CallUI.jsx'
import PainMap from './PainMap.jsx'
import PatientRecap from './PatientRecap.jsx'

const BOARD_ICONS = {
  yes: ThumbsUp, no: ThumbsDown, wait: Hourglass, stop: Hand, repeat: RotateCcw, unsure: CircleHelp, pain: Activity, scared: Frown,
  break: Coffee, lights: SunDim, loud: VolumeX, bathroom: Bath, water: GlassWater, help: LifeBuoy, thanks: Heart,
}
const replyText = (r, lang) => (typeof r === 'string' ? r : r[lang] ?? r.en)

export function useElapsed(start, end) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!start || end) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [start, end])
  return start ? (end ?? now) - start : 0
}

export default function PatientVisit({ visit, actions, embedded = false, peers = [], speed = 1, reduceMotion = false, interim = '', mic, call, onSettings, onEnd, footer }) {
  const lang = visit.patient?.language ?? 'en'
  const t = useT(lang)
  const ai = useAi()
  const doctor = visit.clinician?.name ?? t('common.doctor')
  const press = visit.ui.press
  const tab = visit.ui.tab
  const elapsed = useElapsed(visit.startedAt, visit.endedAt)
  const connected = embedded || peers.includes('clinician')
  const inCall = call && call.phase !== 'idle' && call.phase !== 'incoming'

  const tabs = [
    { id: 'talk', label: t('tab.talk'), icon: MessageCircle },
    { id: 'board', label: t('tab.board'), icon: LayoutGrid },
    { id: 'pain', label: t('tab.pain'), icon: Activity },
    { id: 'card', label: t('tab.card'), icon: IdCard },
  ]

  return (
    <div className="pv" dir={dirOf(lang)} lang={lang === 'en' ? 'en' : lang}>
      <header className="pv-bar">
        <div className="pv-bar-text">
          <p className="pv-title">{t('visit.with', { doctor })}</p>
          <p className="pv-sub">
            <span className={clsx('dot', connected ? 'dot--mint' : 'dot--amber')} aria-hidden="true" />
            {connected ? t('visit.connected') : t('visit.waiting')}
            <span aria-hidden="true">·</span>
            <span className="tabular">{formatClock(elapsed)}</span>
            {!embedded && visit.code && (
              <>
                <span aria-hidden="true">·</span>
                <span>{t('visit.code', { code: visit.code })}</span>
              </>
            )}
          </p>
        </div>
        {!embedded && (
          <div className="row" style={{ '--gap': '6px', flexWrap: 'nowrap' }}>
            {call && !visit.ended && call.phase === 'idle' && (
              <IconButton
                label={call.linked ? t('call.start') : t('call.waitLink')}
                icon={Video}
                onClick={() => call.start()}
                disabled={!connected || !call.linked}
              />
            )}
            {!visit.ended && (
              <Button size="sm" variant="secondary" onClick={onEnd}>
                {t('visit.end')}
              </Button>
            )}
            <IconButton label={t('common.settings')} icon={Settings} onClick={onSettings} />
          </div>
        )}
      </header>

      {call?.error && (
        <p className="pv-alert" role="alert">
          {t(`call.err.${call.error}`)}
          <button type="button" className="link" onClick={call.clearError}>
            {t('common.close')}
          </button>
        </p>
      )}
      {call?.blocked && !call.linked && !visit.ended && (
        <p className="pv-alert pv-alert--info" role="status">
          {t('link.blocked')}
        </p>
      )}
      {call && <IncomingCall call={call} name={doctor} t={t} />}

      {visit.ended ? (
        <div className="pv-body pv-recap">
          <h2 className="pv-h">{t('recap.title')}</h2>
          <PatientRecap recap={visit.recap} accoms={visit.accoms} glossary={decodedGlossary(visit)} lang={lang} t={t} headingLevel={3} footer={footer} />
        </div>
      ) : (
        <>
          <div className="pv-body">
            {inCall && <VideoPanel call={call} name={doctor} t={t} />}
            {tabs.map((tb) => (
              <div key={tb.id} role="tabpanel" id={`pv-panel-${tb.id}`} aria-labelledby={`pv-tab-${tb.id}`} hidden={tab !== tb.id} className="pv-panel">
                {tab === tb.id && tb.id === 'talk' && (
                  <TalkPanel visit={visit} actions={actions} t={t} lang={lang} ai={ai} speed={speed} reduceMotion={reduceMotion} interim={interim} mic={embedded ? null : mic} />
                )}
                {tab === tb.id && tb.id === 'board' && <BoardPanel actions={actions} t={t} press={press} />}
                {tab === tb.id && tb.id === 'pain' && (
                  <>
                    <h2 className="pv-h">{t('pain.title')}</h2>
                    <PainMap pain={visit.pain} set={actions.painSet} send={actions.sendPain} t={t} doctor={doctor} press={press} />
                  </>
                )}
                {tab === tb.id && tb.id === 'card' && <CardPanel visit={visit} actions={actions} t={t} lang={lang} doctor={doctor} />}
              </div>
            ))}
          </div>
          <nav className="pv-nav" aria-label="Visit sections">
            <Tabs tabs={tabs} value={tab} onChange={actions.tab} label="Visit sections" idBase="pv" pressing={press} />
          </nav>
        </>
      )}
    </div>
  )
}

function TalkPanel({ visit, actions, t, lang, ai, speed, reduceMotion, interim, mic }) {
  const caption = currentCaption(visit)
  const press = visit.ui.press
  const [showOriginal, setShowOriginal] = useState(false)
  const [typed, setTyped] = useState('')
  const said = lastLine(visit, 'patient')
  const who = caption?.who === 'caregiver' ? visit.patient?.companion?.name || t('common.companion') : visit.clinician?.name ?? t('common.doctor')
  const local = caption && lang !== 'en' ? caption.local?.[lang] : null
  const plain = caption ? caption.plain?.[lang] ?? caption.plain?.en : null
  const awaitingPlain = said?.kind === 'simpler' && caption && said.at >= caption.at && !plain
  const items = visit.replies.items ?? []
  const typing = useRef(false)

  useEffect(() => setShowOriginal(false), [caption?.id])

  return (
    <>
      <section className="pv-caption" aria-labelledby="pv-cap-h">
        <div className="pv-cap-head">
          <h2 id="pv-cap-h" className="eyebrow">
            {caption ? t('talk.saying', { who }) : t('talk.captions')}
          </h2>
          <div className="row" style={{ '--gap': '6px' }}>
            {local && (
              <Badge tone="sky" icon={Languages}>
                {t('talk.translated')}
              </Badge>
            )}
            {caption && lang !== 'en' && !local && ai.state === 'ready' && <Badge icon={Languages}>{t('talk.translating')}</Badge>}
            {mic?.available && (
              <button type="button" className={clsx('pv-mic', mic.on && 'is-on')} aria-pressed={mic.on} onClick={mic.toggle}>
                {mic.on ? <Captions aria-hidden="true" /> : <CaptionsOff aria-hidden="true" />}
                {mic.on ? t('talk.listening') : t('talk.listen')}
              </button>
            )}
          </div>
        </div>
        {caption ? (
          <LiveCaption key={caption.id + (local ? 'l' : '')} className="pv-cap-text" text={caption.text} terms={caption.terms} local={local} speed={speed} reduceMotion={reduceMotion} />
        ) : (
          <p className="pv-cap-idle">{interim && interim !== '…' ? `${interim}…` : t('talk.idle')}</p>
        )}
        {caption && lang !== 'en' && !local && ai.state !== 'ready' && <p className="pv-note">{t('talk.offlineTranslate')}</p>}
        {local && (
          <>
            <button type="button" className="link" onClick={() => setShowOriginal((v) => !v)} aria-expanded={showOriginal}>
              {showOriginal ? t('talk.hideOriginal') : t('talk.showOriginal')}
            </button>
            {showOriginal && (
              <p className="pv-original" lang="en" dir="ltr">
                {caption.text}
              </p>
            )}
          </>
        )}
        {plain && (
          <div className="pv-plain rise">
            <p className="eyebrow row" style={{ '--gap': '6px' }}>
              <Lightbulb size={14} aria-hidden="true" /> {t('talk.plain')}
            </p>
            <p>{stripMarkup(plain)}</p>
          </div>
        )}
        {awaitingPlain && ai.state === 'ready' && <p className="pv-note">{t('talk.simplifying')}</p>}
        {caption && interim && interim !== '…' && <p className="pv-interim">{interim}…</p>}
        <p className="sr-only" aria-live="polite">
          {caption ? `${who}: ${spokenText(caption, lang)}` : ''}
        </p>
        <p className="sr-only" aria-live="polite">
          {plain ? `${t('talk.plain')}: ${stripMarkup(plain)}` : ''}
        </p>
      </section>

      <section className="pv-replies" aria-labelledby="pv-rep-h">
        <div className="pv-label-row">
          <h2 id="pv-rep-h" className="eyebrow">
            {t('talk.tapToSay')}
          </h2>
          {items.length > 0 && visit.replies.source === 'ai' && (
            <Badge tone="mint" icon={Sparkles}>
              AI
            </Badge>
          )}
        </div>
        {items.length ? (
          <div className="pv-reply-list">
            {items.map((r, i) => (
              <button key={`${visit.replies.forId}-${i}`} type="button" className={clsx('pv-reply', press === `reply-${i}` && 'is-pressing')} onClick={() => actions.say(r)}>
                <span>{replyText(r, lang)}</span>
                <Send aria-hidden="true" />
              </button>
            ))}
          </div>
        ) : (
          <p className="pv-empty">{t('talk.noReplies')}</p>
        )}
      </section>

      <button type="button" className={clsx('pv-simpler', press === 'simpler' && 'is-pressing')} onClick={actions.simpler}>
        <Lightbulb aria-hidden="true" />
        {t('talk.simpler')}
        {visit.simplerCount > 0 && <span className="pv-count">{visit.simplerCount}</span>}
      </button>

      <form
        className="pv-type"
        onSubmit={(e) => {
          e.preventDefault()
          if (!typed.trim()) return
          actions.sayTyped(typed)
          setTyped('')
          typing.current = false
        }}
      >
        <label htmlFor="pv-typed" className="sr-only">
          {t('talk.type')}
        </label>
        <input
          id="pv-typed"
          className="input"
          value={typed}
          placeholder={t('talk.typePlaceholder')}
          autoComplete="off"
          onChange={(e) => {
            setTyped(e.target.value)
            const on = e.target.value.length > 0
            if (on !== typing.current) {
              typing.current = on
              actions.composing(on)
            }
          }}
          onBlur={() => {
            if (!typed && typing.current) {
              typing.current = false
              actions.composing(false)
            }
          }}
        />
        <Button type="submit" variant="accent" icon={Send} disabled={!typed.trim()}>
          {t('talk.speak')}
        </Button>
      </form>

      {said && said.kind !== 'simpler' && (
        <p className="pv-said">
          <span className="muted">{t('talk.youSaid')}:</span> <span>“{said.local?.[lang] ?? said.text}”</span>
          <IconButton plain label={t('talk.again')} icon={RotateCcw} onClick={() => actions.replay(said)} />
        </p>
      )}
    </>
  )
}

function BoardPanel({ actions, t, press }) {
  return (
    <>
      <h2 className="pv-h">{t('board.title')}</h2>
      <div className="board">
        {BOARD.map((b) => {
          const Icon = BOARD_ICONS[b.id]
          return (
            <button
              key={b.id}
              type="button"
              className={clsx('board-tile', b.tone && `is-${b.tone}`, press === `board-${b.id}` && 'is-pressing')}
              onClick={() => actions.say(b.say, { kind: b.accom ? 'need' : 'board', accom: b.accom })}
            >
              {Icon && <Icon aria-hidden="true" />}
              <span>{t(`board.${b.id}`)}</span>
            </button>
          )
        })}
      </div>
    </>
  )
}

function CardPanel({ visit, actions, t, lang, doctor }) {
  const p = visit.patient
  const localCard = lang !== 'en' ? p?.cardLocal?.[lang] : null
  const sections = cardSections(p)
  return (
    <>
      <div className="pv-card-head">
        <div>
          <p className="eyebrow">{t('card.show')}</p>
          <h2 className="pv-h" style={{ margin: 0 }}>
            {t('card.title')}
          </h2>
        </div>
        {visit.cardShared ? (
          <Badge tone="mint" icon={Check}>
            {t('card.shared', { doctor })}
          </Badge>
        ) : (
          <Button size="sm" variant="accent" icon={Share2} onClick={actions.shareCard}>
            {t('card.share')}
          </Button>
        )}
      </div>
      <article className="me-card">
        <p className="me-name">
          {p?.fullName ?? p?.name}
          {p?.pronouns && <span className="muted"> · {p.pronouns}</span>}
        </p>
        {sections.length ? (
          <dl>
            {sections.map((s) => (
              <div key={s.id}>
                <dt>{t(`section.${s.id}`)}</dt>
                <dd>{localCard?.[s.id] ?? s.body}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="muted">{t('card.empty')}</p>
        )}
      </article>
      {visit.accoms.length > 0 && (
        <section aria-labelledby="pv-asked">
          <h3 id="pv-asked" className="eyebrow" style={{ margin: '18px 0 10px' }}>
            {t('card.asked')}
          </h3>
          <ul className="accom-list">
            {visit.accoms.map((a) => (
              <li key={a.id} className={a.status === 'provided' ? 'is-done' : 'is-open'}>
                <span className="accom-icon" aria-hidden="true">
                  {a.status === 'provided' ? <Check /> : <Clock />}
                </span>
                <span className="accom-need">{t(`accom.${a.id}`) === `accom.${a.id}` ? a.need : t(`accom.${a.id}`)}</span>
                <span className="accom-status">{a.status === 'provided' ? t('common.provided') : t('common.requested')}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
