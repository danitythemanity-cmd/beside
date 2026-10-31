// The clinician's visit dashboard (tablet). Rendered full-screen in the
// clinician app and inside the tablet frame of the sample visit.
import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import {
  UserRound, HeartHandshake, Hourglass, Lightbulb, Volume2, Activity, Mic, MicOff, Send, Settings, IdCard, ListChecks,
  Gauge, MessagesSquare, Check, Languages, Printer, Sparkles, Stethoscope, Clock, Award, Video,
} from 'lucide-react'
import { MODES, ACCOMMODATIONS, cardSections } from '../core/catalog.js'
import { nudges as getNudges, metrics, coachingTips, formatClock, decodedGlossary } from '../core/visit.js'
import { countTerms } from '../core/jargon.js'
import { langInfo } from '../core/i18n.js'
import { useAi } from '../core/ai.js'
import { Badge, Button, IconButton, Meter, Segmented } from '../ui/kit.jsx'
import { TermText } from '../ui/speech.jsx'
import { VideoPanel, IncomingCall, tEn } from '../ui/CallUI.jsx'

const NUDGE_ICON = { direct: HeartHandshake, slow: Lightbulb, wait: Hourglass }

function useClock(start, end) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!start || end) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [start, end])
  return start ? (end ?? now) - start : 0
}

export default function ClinicianVisit({ visit, actions, embedded = false, peers = [], mic, interim = '', call, onSettings, footer }) {
  const p = visit.patient
  const name = p?.name ?? 'Patient'
  const elapsed = useClock(visit.startedAt, visit.endedAt)
  const connected = embedded || peers.includes('patient')
  const nudges = getNudges(visit)
  const lang = p?.language ?? 'en'
  const press = visit.ui.press

  if (!p) {
    return (
      <div className="cv cv-waiting">
        <Stethoscope aria-hidden="true" />
        <h2>Waiting for the patient’s phone…</h2>
        <p className="muted">The visit appears here as soon as the patient starts it.</p>
      </div>
    )
  }

  return (
    <div className="cv">
      <header className="cv-bar">
        <div className="cv-patient">
          <div className="cv-avatar" aria-hidden="true">
            {name.slice(0, 1)}
          </div>
          <div className="cv-patient-text">
            <h2 className="cv-name">
              {p.fullName ?? name}
              <span className="muted">
                {p.pronouns ? ` · ${p.pronouns}` : ''}
                {p.age ? ` · ${p.age}` : ''}
              </span>
            </h2>
            <div className="cv-badges">
              {(p.modes ?? []).map((m) => (
                <Badge key={m}>{MODES.find((x) => x.id === m)?.short ?? m}</Badge>
              ))}
              {lang !== 'en' && (
                <Badge tone="sky" icon={Languages}>
                  Reads {langInfo(lang).name}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="cv-bar-right">
          <span className="cv-status">
            <span className={clsx('dot', connected ? 'dot--mint dot--live' : 'dot--amber')} aria-hidden="true" />
            {connected ? `Synced with ${name}’s phone` : `Waiting for ${name}’s phone`}
          </span>
          <span className="cv-clock tabular" aria-label={`Visit time ${formatClock(elapsed)}`}>
            <Clock aria-hidden="true" /> {formatClock(elapsed)}
          </span>
          {call && !visit.ended && call.phase === 'idle' && (
            <Button
              size="sm"
              variant="secondary"
              icon={Video}
              onClick={() => call.start()}
              disabled={!connected || !call.linked}
              title={call.linked ? undefined : tEn('call.waitLink')}
            >
              Video call
            </Button>
          )}
          {!embedded && !visit.ended && (
            <Button size="sm" variant="secondary" onClick={actions.end}>
              End visit
            </Button>
          )}
          {!embedded && <IconButton label="Settings" icon={Settings} onClick={onSettings} />}
        </div>
      </header>

      {call?.blocked && !call.linked && !visit.ended && (
        <p className="cv-alert cv-alert--info" role="status">
          Can’t reach {name}’s phone from this network. Try the same Wi-Fi or a phone hotspot.
        </p>
      )}
      {call && <IncomingCall call={call} name={name} t={tEn} />}
      {call?.error && (
        <p className="cv-alert" role="alert">
          {tEn(`call.err.${call.error}`)}
          <button type="button" className="link" onClick={call.clearError}>
            Dismiss
          </button>
        </p>
      )}

      <div className="cv-nudges" role="status" aria-live="polite">
        {nudges.map((n) => {
          const Icon = NUDGE_ICON[n.id] ?? Lightbulb
          return (
            <div key={n.id} className={clsx('nudge', `nudge--${n.tone}`)}>
              <span className="nudge-icon" aria-hidden="true">
                <Icon />
              </span>
              <div className="nudge-text">
                <strong>{n.title}</strong>
                <p>{n.body}</p>
              </div>
              {n.ack && !embedded && (
                <Button size="sm" variant="secondary" onClick={() => actions.ack(n.id)}>
                  {n.ack}
                </Button>
              )}
            </div>
          )
        })}
      </div>

      {visit.ended ? (
        <ClinicianSummary visit={visit} footer={footer} />
      ) : (
        <div className="cv-grid">
          <aside className="cv-side" aria-label={`About ${name}`}>
            <MeCard visit={visit} />
            <AccomChecklist visit={visit} actions={actions} embedded={embedded} press={press} />
            <Understanding visit={visit} />
          </aside>
          <section className="cv-main" aria-label="Conversation">
            {call && call.phase !== 'idle' && call.phase !== 'incoming' && <VideoPanel call={call} name={name} t={tEn} />}
            {visit.painReports.slice(-1).map((r) => (
              <article key={r.id} className="card cv-pain rise" aria-labelledby={`pain-${r.id}`}>
                <div className="card-head">
                  <h3 id={`pain-${r.id}`}>
                    <Activity aria-hidden="true" /> Pain report from {name}
                  </h3>
                  <Badge tone="coral">{r.severity}/10</Badge>
                </div>
                <p>{r.summary}</p>
              </article>
            ))}
            <Transcript visit={visit} />
            {!embedded && <Composer actions={actions} mic={mic} interim={interim} name={name} />}
          </section>
        </div>
      )}
    </div>
  )
}

function MeCard({ visit }) {
  const p = visit.patient
  const sections = cardSections(p)
  if (!visit.cardShared) {
    return (
      <article className="card cv-me is-empty">
        <div className="card-head">
          <h3>
            <IdCard aria-hidden="true" /> This is me
          </h3>
        </div>
        <p className="muted small">{p.name}’s card appears here when they share it.</p>
      </article>
    )
  }
  return (
    <article className="card cv-me rise" aria-labelledby="cv-me-h">
      <div className="card-head">
        <h3 id="cv-me-h">
          <IdCard aria-hidden="true" /> This is me
        </h3>
        <span className="tiny faint">in {p.name}’s words</span>
      </div>
      <dl>
        {sections.map((s) => (
          <div key={s.id}>
            <dt>{s.title}</dt>
            <dd>{s.body}</dd>
          </div>
        ))}
      </dl>
    </article>
  )
}

function AccomChecklist({ visit, actions, embedded, press }) {
  if (!visit.accoms.length) return null
  const done = visit.accoms.filter((a) => a.status === 'provided').length
  return (
    <article className="card" aria-labelledby="cv-acc-h" data-anchor="accoms">
      <div className="card-head">
        <h3 id="cv-acc-h">
          <ListChecks aria-hidden="true" /> Accommodations
        </h3>
        <span className="tiny faint tabular">
          {done}/{visit.accoms.length} provided
        </span>
      </div>
      <ul className="checklist">
        {visit.accoms.map((a) => {
          const on = a.status === 'provided'
          return (
            <li key={a.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                className={clsx('check-row', press === `accom-${a.id}` && 'is-pressing')}
                onClick={() => (on ? actions.unprovide(a.id) : actions.provide(a.id))}
                disabled={embedded}
              >
                <span className="check-box" aria-hidden="true">
                  {on && <Check />}
                </span>
                <span className="check-text">
                  <span>{a.need}</span>
                  <span className="tiny faint">{a.source === 'card' ? 'From card' : 'Asked during visit'}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </article>
  )
}

function Understanding({ visit }) {
  const value = Math.max(8, 100 - visit.simplerCount * 42)
  const label = visit.rephraseNeeded ? 'Struggling to follow' : visit.simplerCount ? 'Needs simpler words' : 'Following along'
  return (
    <article className="card" aria-labelledby="cv-und-h">
      <div className="card-head">
        <h3 id="cv-und-h">
          <Gauge aria-hidden="true" /> Understanding
        </h3>
        <span className={clsx('tiny', value < 50 ? 'amber' : 'mint')}>{label}</span>
      </div>
      <Meter value={value} label={`How well ${visit.patient?.name ?? 'the patient'} is following`} />
      <p className="tiny faint" style={{ marginTop: 8 }}>
        {visit.simplerTotal ? `“Say it simpler” tapped ${visit.simplerTotal}× this visit` : 'Based on “Say it simpler” taps.'}
      </p>
    </article>
  )
}

function Transcript({ visit }) {
  const ref = useRef(null)
  const name = visit.patient?.name ?? 'Patient'
  const companion = visit.patient?.companion
  const lang = visit.patient?.language ?? 'en'

  useEffect(() => {
    const el = ref.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: document.documentElement.dataset.motion === 'reduce' ? 'auto' : 'smooth' })
  }, [visit.lines.length, visit.composing])

  return (
    <article className="card cv-log" aria-labelledby="cv-log-h">
      <div className="card-head">
        <h3 id="cv-log-h">
          <MessagesSquare aria-hidden="true" /> Live transcript
        </h3>
        <span className="tiny faint">{visit.lines.length} lines</span>
      </div>
      <ol className="log" ref={ref} tabIndex={0} aria-label="Visit transcript">
        {visit.lines.length === 0 && <li className="log-empty">Captions of the conversation appear here.</li>}
        {visit.lines.map((l) => {
          const n = l.who !== 'patient' ? countTerms(l.text, l.terms) : 0
          const who = l.who === 'clinician' ? 'You' : l.who === 'caregiver' ? `${companion?.name ?? 'Companion'}${companion?.relation ? ` · ${companion.relation}` : ''}` : name
          return (
            <li key={l.id} className={clsx('log-line', `is-${l.who}`, l.kind && `kind-${l.kind}`)}>
              <div className="log-meta">
                <span className="log-who">{who}</span>
                {l.who === 'clinician' && l.to === 'caregiver' && <Badge tone="amber">to companion</Badge>}
                {l.who === 'patient' && l.kind !== 'simpler' && (
                  <span className="log-spoken">
                    <Volume2 aria-hidden="true" /> spoken aloud
                  </span>
                )}
                {l.who === 'patient' && l.kind === 'pain' && <Badge tone="coral" icon={Activity}>pain map</Badge>}
                {l.who === 'patient' && l.kind === 'simpler' && <Badge tone="amber" icon={Lightbulb}>needs simpler words</Badge>}
              </div>
              <p className="log-text">{l.who === 'patient' ? l.text : <TermText text={l.text} terms={l.terms} />}</p>
              {l.who === 'patient' && l.local?.[lang] && lang !== 'en' && (
                <p className="tiny faint" lang={lang}>
                  {l.kind === 'typed' ? 'Typed' : 'Tapped'} in {langInfo(lang).name}: {l.local[lang]}
                </p>
              )}
              {(n > 0 || (l.who !== 'patient' && lang !== 'en' && l.local?.[lang])) && (
                <p className="log-note">
                  {n > 0 && <span>{n} medical term{n > 1 ? 's' : ''} decoded for {name}</span>}
                  {l.who !== 'patient' && lang !== 'en' && l.local?.[lang] && (
                    <span>
                      <Languages aria-hidden="true" /> shown in {langInfo(lang).name}
                    </span>
                  )}
                  {l.plain?.en && (
                    <span>
                      <Sparkles aria-hidden="true" /> rewritten in plain words
                    </span>
                  )}
                </p>
              )}
            </li>
          )
        })}
        {visit.composing && (
          <li className="log-line is-patient is-typing" aria-label={`${name} is answering`}>
            <span className="log-who">{name}</span>
            <span className="typing" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </li>
        )}
      </ol>
    </article>
  )
}

function Composer({ actions, mic, interim, name }) {
  const [text, setText] = useState('')
  const [who, setWho] = useState('clinician')
  const ai = useAi()
  return (
    <form
      className="cv-composer"
      onSubmit={(e) => {
        e.preventDefault()
        if (!text.trim()) return
        actions.hear(text, { who, source: 'typed' })
        setText('')
      }}
    >
      <div className="cv-composer-top">
        {mic?.available ? (
          <button type="button" className={clsx('cv-mic', mic.on && 'is-on')} aria-pressed={mic.on} onClick={mic.toggle}>
            {mic.on ? <Mic aria-hidden="true" /> : <MicOff aria-hidden="true" />}
            {mic.on ? 'Captioning your voice' : 'Caption my voice'}
          </button>
        ) : (
          <span className="tiny faint">Live captions need Chrome, Edge, or Safari. Type instead.</span>
        )}
        <Segmented
          label="Who is speaking"
          value={who}
          onChange={setWho}
          options={[
            { value: 'clinician', label: 'Me' },
            { value: 'caregiver', label: 'Companion' },
          ]}
        />
        <Badge tone={ai.state === 'ready' ? 'mint' : undefined} icon={Sparkles}>
          {ai.state === 'ready' ? 'AI on' : 'Offline'}
        </Badge>
      </div>
      {mic?.on && <p className="cv-interim" aria-live="off">{interim ? `${interim}…` : 'Listening…'}</p>}
      <div className="cv-composer-row">
        <label htmlFor="cv-say" className="sr-only">
          Type what was said
        </label>
        <input id="cv-say" className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={`Type what you say to ${name}…`} autoComplete="off" />
        <Button type="submit" icon={Send} disabled={!text.trim()}>
          Send
        </Button>
      </div>
    </form>
  )
}

function ClinicianSummary({ visit, footer }) {
  const m = metrics(visit)
  const tips = coachingTips(visit)
  const name = visit.patient?.name ?? 'the patient'
  const glossary = decodedGlossary(visit)
  const tiles = [
    { label: `Spoke directly to ${name}`, value: `${m.directPct}%`, good: m.directPct >= 80, icon: HeartHandshake },
    { label: 'Medical terms decoded', value: m.jargon, good: m.jargon < 4, icon: Languages },
    { label: '“Say it simpler” requests', value: m.simpler, sub: m.rephrased ? 'You rephrased ✓' : null, good: !m.simpler || m.rephrased > 0, icon: Lightbulb },
    { label: 'Accommodations provided', value: `${m.accomsProvided}/${m.accomsTotal}`, good: m.accomsProvided === m.accomsTotal, icon: ListChecks },
    { label: `${name}’s turns`, value: m.patientTurns, good: m.patientTurns >= 3, icon: MessagesSquare },
  ]
  return (
    <div className="cv-summary">
      <div className="cv-summary-head">
        <div>
          <p className="eyebrow">Visit complete · {formatClock((visit.endedAt ?? 0) - (visit.startedAt ?? 0))}</p>
          <h2>Communication summary</h2>
        </div>
        <Button variant="secondary" size="sm" icon={Printer} onClick={() => window.print()}>
          Print
        </Button>
      </div>
      <ul className="metric-grid">
        {tiles.map((x) => (
          <li key={x.label} className={clsx('metric', x.good ? 'is-good' : 'is-watch')}>
            <x.icon aria-hidden="true" />
            <span className="metric-value tabular">{x.value}</span>
            <span className="metric-label">{x.label}</span>
            {x.sub && <span className="metric-sub">{x.sub}</span>}
          </li>
        ))}
      </ul>
      <div className="cv-summary-grid">
        <article className="card" aria-labelledby="cv-coach">
          <div className="card-head">
            <h3 id="cv-coach">
              <Award aria-hidden="true" /> Coaching
            </h3>
          </div>
          <ul className="tips">
            {tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </article>
        <article className="card" aria-labelledby="cv-sent">
          <div className="card-head">
            <h3 id="cv-sent">
              <UserRound aria-hidden="true" /> Sent to {name}
            </h3>
            {visit.recap?.source === 'ai' && <Badge tone="mint">AI</Badge>}
          </div>
          {visit.recap ? (
            <>
              <p className="cv-recap-summary">{visit.recap.summary}</p>
              <ol className="cv-recap-steps">
                {visit.recap.nextSteps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </>
          ) : (
            <p className="muted">Writing the recap…</p>
          )}
        </article>
        <article className="card" aria-labelledby="cv-log2">
          <div className="card-head">
            <h3 id="cv-log2">
              <ListChecks aria-hidden="true" /> Accommodations log
            </h3>
          </div>
          <table className="acc-table">
            <thead>
              <tr>
                <th scope="col">Request</th>
                <th scope="col">Source</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {visit.accoms.map((a) => (
                <tr key={a.id}>
                  <td>{a.need ?? ACCOMMODATIONS[a.id]?.need}</td>
                  <td>{a.source === 'card' ? 'Card' : 'During visit'}</td>
                  <td className={a.status === 'provided' ? 'mint' : 'amber'}>{a.status === 'provided' ? 'Provided' : 'Not provided'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {glossary.length > 0 && (
            <p className="tiny faint" style={{ marginTop: 12 }}>
              Decoded for {name}: {glossary.map((g) => g.term).join(', ')}.
            </p>
          )}
        </article>
      </div>
      {footer}
    </div>
  )
}
