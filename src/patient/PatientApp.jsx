// The patient app: onboarding, home, live visits, decode tool, card, history.
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Home as HomeIcon, IdCard, History, Wand2, Settings, Play, ChevronRight, ExternalLink, Stethoscope, Volume2, Sparkles, ArrowLeft, Check, BookOpen, Square,
} from 'lucide-react'
import { useRouter, match, Link } from '../app/router.jsx'
import { useProfile, useHistory, useStored, KEYS, read, write, saveToHistory } from '../core/storage.js'
import { useT, useDocumentLanguage, loadLanguage, langInfo } from '../core/i18n.js'
import { useAi, aiStrings, aiSimplify } from '../core/ai.js'
import { useSettings } from '../core/settings.jsx'
import { useVisitStore } from '../core/sync.js'
import { createActions } from '../core/actions.js'
import { makeCode, historyEntry } from '../core/visit.js'
import { cardSections } from '../core/catalog.js'
import { startListening, useCanListen, speak, stopSpeaking } from '../core/speech.js'
import { useCall } from '../core/call.js'
import { findTerms, swapText } from '../core/jargon.js'
import { Button, IconButton, Sheet, Switch, Badge, Empty, Logo } from '../ui/kit.jsx'
import SettingsSheet from '../ui/SettingsSheet.jsx'
import { stripMarkup } from '../ui/speech.jsx'
import Onboarding, { AboutFields, CardFields, ModesPicker, NeedsPicker } from './Onboarding.jsx'
import PatientVisit from './PatientVisit.jsx'
import PatientRecap from './PatientRecap.jsx'

export default function PatientApp() {
  const { path, navigate } = useRouter()
  const [profile, setProfile] = useProfile()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const ai = useAi()
  const lang = profile?.language ?? 'en'
  const t = useT(lang)
  useDocumentLanguage(lang)

  useEffect(() => {
    if (lang !== 'en' && ai.state === 'ready') loadLanguage(lang, aiStrings)
    else if (lang !== 'en') loadLanguage(lang) // use the cached table if there is one
  }, [lang, ai.state])

  const visitMatch = match('/patient/visit/:code', path)
  const historyMatch = match('/patient/visits/:index', path)

  if (!profile) {
    return (
      <Shell bare>
        <Onboarding
          onDone={(p) => {
            setProfile(p)
            navigate('/patient', { replace: true })
          }}
        />
      </Shell>
    )
  }

  // The live visit is full-screen, without the app chrome.
  if (visitMatch) return <LiveVisit code={visitMatch.code} profile={profile} setProfile={setProfile} />

  const settings = (
    <SettingsSheet
      open={settingsOpen}
      onClose={() => setSettingsOpen(false)}
      lang={lang}
      language={lang}
      onLanguage={(language) => setProfile({ ...profile, language })}
      extra={
        <section className="sheet-section">
          <Button
            variant="danger"
            onClick={() => {
              if (window.confirm(t('settings.resetConfirm'))) {
                write(KEYS.profile, undefined)
                write(KEYS.history, [])
                setSettingsOpen(false)
              }
            }}
          >
            {t('settings.reset')}
          </Button>
        </section>
      }
    />
  )

  let page
  if (path === '/patient/card') page = <CardPage profile={profile} setProfile={setProfile} t={t} />
  else if (path === '/patient/decode') page = <DecodePage profile={profile} t={t} lang={lang} />
  else if (path === '/patient/visits') page = <VisitsPage t={t} />
  else if (historyMatch) page = <VisitDetail index={Number(historyMatch.index)} t={t} lang={lang} />
  else page = <HomePage profile={profile} t={t} />

  return (
    <Shell t={t} onSettings={() => setSettingsOpen(true)} path={path}>
      {page}
      {settings}
    </Shell>
  )
}

function Shell({ children, bare, t, onSettings, path }) {
  const nav = [
    { to: '/patient', label: t?.('nav.home'), icon: HomeIcon },
    { to: '/patient/decode', label: t?.('nav.decode'), icon: Wand2 },
    { to: '/patient/card', label: t?.('nav.card'), icon: IdCard },
    { to: '/patient/visits', label: t?.('nav.visits'), icon: History },
  ]
  return (
    <div className="pa">
      <div className="pa-frame">
        <a className="skip-link" href="#pa-main">
          Skip to content
        </a>
        {!bare && (
          <header className="pa-bar">
            <Logo to="/patient" label="Beside patient home" />
            <div className="row" style={{ '--gap': '6px' }}>
              <Button variant="ghost" size="sm" to="/" aria-label="About Beside">
                About
              </Button>
              <IconButton label={t('common.settings')} icon={Settings} onClick={onSettings} />
            </div>
          </header>
        )}
        <main id="pa-main" className="pa-main">
          {children}
        </main>
        {!bare && (
          <nav className="pa-nav" aria-label="Patient app">
            {nav.map((n) => (
              <Link key={n.to} to={n.to} aria-current={path === n.to || (n.to === '/patient/visits' && path.startsWith('/patient/visits')) ? 'page' : undefined}>
                <n.icon aria-hidden="true" />
                {n.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </div>
  )
}

function HomePage({ profile, t }) {
  const { navigate } = useRouter()
  const [history] = useHistory()
  const [active] = useStored(KEYS.activeVisit, null)
  const [starting, setStarting] = useState(false)
  const sections = cardSections(profile)

  return (
    <>
      <div className="pa-hello">
        <h1 data-route-focus>{t('home.hi', { name: profile.name })}</h1>
        <p className="muted">{t('home.ready')}</p>
      </div>

      {active?.code ? (
        <section className="pa-start" aria-labelledby="resume-h">
          <h2 id="resume-h">{t('visit.code', { code: active.code })}</h2>
          <Button variant="accent" size="lg" icon={Play} onClick={() => navigate(`/patient/visit/${active.code}`)}>
            {t('start.begin')}
          </Button>
        </section>
      ) : (
        <section className="pa-start" aria-labelledby="start-h">
          <h2 id="start-h">{t('home.start')}</h2>
          <p className="muted">{t('home.startHint')}</p>
          <Button variant="accent" size="xl" icon={Play} onClick={() => setStarting(true)}>
            {t('home.start')}
          </Button>
        </section>
      )}

      <Link to="/patient/card" className="pa-tile">
        <span className="pa-tile-icon">
          <IdCard aria-hidden="true" />
        </span>
        <span className="pa-tile-text">
          <strong>{t('home.card')}</strong>
          <span className="small muted">
            {sections[0]?.body ? (sections[0].body.length > 64 ? `${sections[0].body.slice(0, 64).trim()}…` : sections[0].body) : t('card.empty')}
          </span>
        </span>
        <ChevronRight aria-hidden="true" />
      </Link>

      <Link to="/patient/decode" className="pa-tile">
        <span className="pa-tile-icon">
          <Wand2 aria-hidden="true" />
        </span>
        <span className="pa-tile-text">
          <strong>{t('home.decode')}</strong>
          <span className="small muted">{t('home.decodeHint')}</span>
        </span>
        <ChevronRight aria-hidden="true" />
      </Link>

      <section aria-labelledby="recent-h" className="stack" style={{ '--gap': '10px' }}>
        <h2 id="recent-h" className="eyebrow">
          {t('home.recent')}
        </h2>
        {history.length ? (
          <ul className="pa-list">
            {history.slice(0, 3).map((v, i) => (
              <li key={`${v.code}-${v.startedAt}`}>
                <VisitTile v={v} i={i} t={t} />
              </li>
            ))}
          </ul>
        ) : (
          <Empty icon={History}>{t('home.noVisits')}</Empty>
        )}
      </section>

      <StartSheet open={starting} onClose={() => setStarting(false)} t={t} />
    </>
  )
}

function StartSheet({ open, onClose, t }) {
  const { navigate } = useRouter()
  const [code] = useState(makeCode)
  const [share, setShare] = useState(true)
  return (
    <Sheet open={open} onClose={onClose} title={t('start.title')}>
      <div className="code-display" aria-label={`Code ${code.split('').join(' ')}`}>
        {code.split('').map((d, i) => (
          <span key={i} aria-hidden="true">
            {d}
          </span>
        ))}
      </div>
      <p className="muted" style={{ textAlign: 'center' }}>
        {t('start.hint')}
      </p>
      <Button variant="secondary" icon={ExternalLink} onClick={() => window.open(`/clinician/visit/${code}`, '_blank', 'noopener')}>
        {t('start.openClinician')}
      </Button>
      <Switch checked={share} onChange={setShare}>
        {t('start.shareCard')}
      </Switch>
      <Button
        variant="accent"
        size="lg"
        icon={Play}
        onClick={() => {
          write(KEYS.activeVisit, { code, share })
          onClose()
          navigate(`/patient/visit/${code}`)
        }}
      >
        {t('start.begin')}
      </Button>
    </Sheet>
  )
}

function LiveVisit({ code, profile }) {
  const { navigate } = useRouter()
  const store = useVisitStore({ code, role: 'patient' })
  const { state, dispatch, getState, peers } = store
  const [settings] = useSettings()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [interim, setInterim] = useState('')
  const [micOn, setMicOn] = useState(false)
  const stopRef = useRef(null)
  const lang = profile.language ?? 'en'
  const t = useT(lang)
  const call = useCall(store.rtc)
  const canListen = useCanListen()
  const inCall = ['outgoing', 'connecting', 'live'].includes(call.phase)
  // In a call, the clinician's device speaks the patient's words instead, so they aren't heard twice.
  const actions = useMemo(
    () => createActions({ dispatch, getState, voice: { ...settings, voice: settings.voice && !inCall } }),
    [dispatch, getState, settings, inCall],
  )

  // Start the visit (once), with the card translated to English for the clinician when needed.
  const started = useRef(false)
  useEffect(() => {
    if (started.current || state.patient) return
    started.current = true
    ;(async () => {
      const active = read(KEYS.activeVisit, null)
      let card = profile.card
      if (lang !== 'en') {
        try {
          card = { ...card, ...(await aiStrings(profile.card, 'en')) }
        } catch {
          /* clinician sees the original words */
        }
      }
      dispatch({
        type: 'visit/start',
        code,
        patient: { ...profile, card, cardLocal: lang !== 'en' ? { [lang]: profile.card } : undefined },
        clinician: { name: null },
      })
      if (active?.share !== false) dispatch({ type: 'card/share' })
    })()
  }, [state.patient, profile, code, dispatch, lang, t])

  // Save the recap to history when the visit ends.
  const saved = useRef(false)
  useEffect(() => {
    if (state.ended && state.recap && !saved.current) {
      saved.current = true
      saveToHistory(historyEntry(state))
      write(KEYS.activeVisit, undefined)
    }
  }, [state])

  const toggleMic = () => {
    if (micOn) {
      stopRef.current?.()
      setMicOn(false)
      setInterim('')
      return
    }
    stopRef.current = startListening({
      onInterim: setInterim,
      onFinal: (text) => {
        setInterim('')
        actions.hear(text, { who: 'clinician', source: 'mic' })
      },
      onError: () => {
        setMicOn(false)
        setInterim('')
      },
    })
    setMicOn(true)
  }
  useEffect(() => () => stopRef.current?.(), [])

  // The clinician captions the call, so the phone's own captions pause to avoid doubles.
  useEffect(() => {
    if (inCall && micOn) toggleMic()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inCall])

  return (
    <div className="pa">
      <div className="pa-frame" style={{ height: '100dvh' }}>
        <main id="pa-main" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <h1 className="sr-only" data-route-focus>
            {t('visit.with', { doctor: state.clinician?.name ?? t('common.doctor') })}
          </h1>
          {state.patient ? (
            <PatientVisit
              visit={state}
              actions={actions}
              peers={peers}
              reduceMotion={settings.reduceMotion}
              interim={interim}
              mic={{ available: canListen && !inCall, on: micOn, toggle: toggleMic }}
              call={{ ...call, linked: store.linked, blocked: store.blocked }}
              onSettings={() => setSettingsOpen(true)}
              onEnd={() => setConfirmEnd(true)}
              footer={
                <Button variant="accent" size="lg" icon={Check} onClick={() => navigate('/patient')}>
                  {t('common.done')}
                </Button>
              }
            />
          ) : (
            <div className="recap-wait" role="status" style={{ padding: 24 }}>
              <span className="typing" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            </div>
          )}
        </main>
      </div>
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} lang={lang} />
      <Sheet open={confirmEnd} onClose={() => setConfirmEnd(false)} title={t('visit.end')}>
        <p>{t('visit.endConfirm')}</p>
        <div className="row">
          <Button variant="secondary" onClick={() => setConfirmEnd(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="accent"
            onClick={() => {
              setConfirmEnd(false)
              actions.end()
            }}
          >
            {t('visit.end')}
          </Button>
        </div>
      </Sheet>
    </div>
  )
}

function CardPage({ profile, setProfile, t }) {
  const [draft, setDraft] = useState(profile)
  const [saved, setSaved] = useState(false)
  const set = (patch) => {
    setDraft((d) => ({ ...d, ...(typeof patch === 'function' ? patch(d) : patch) }))
    setSaved(false)
  }
  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 data-route-focus>{t('card.title')}</h1>
        <Button
          variant="accent"
          size="sm"
          icon={Check}
          onClick={() => {
            setProfile(draft)
            setSaved(true)
          }}
        >
          {saved ? t('common.done') : t('common.save')}
        </Button>
      </div>
      <p className="muted">{t('ob.cardHint')}</p>
      <CardFields draft={draft} set={set} t={t} />
      <h2 className="eyebrow">{t('ob.needs')}</h2>
      <NeedsPicker draft={draft} set={set} t={t} />
      <h2 className="eyebrow">{t('ob.how')}</h2>
      <ModesPicker draft={draft} set={set} t={t} />
      <h2 className="eyebrow">{t('ob.about')}</h2>
      <AboutFields draft={draft} set={set} t={t} />
      <Button
        variant="accent"
        size="lg"
        icon={Check}
        onClick={() => {
          setProfile(draft)
          setSaved(true)
        }}
      >
        {saved ? t('common.done') : t('common.save')}
      </Button>
      <p className="sr-only" role="status">
        {saved ? t('common.done') : ''}
      </p>
    </>
  )
}

function DecodePage({ profile, t, lang }) {
  const ai = useAi()
  const [text, setText] = useState('')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [reading, setReading] = useState(false)

  const run = async () => {
    const clean = text.trim()
    if (!clean) return
    setBusy(true)
    let out = null
    if (ai.state === 'ready') {
      try {
        const r = await aiSimplify({ text: clean, profile, lang })
        out = { plain: stripMarkup(r.plain || r.plain_en), terms: r.terms ?? findTerms(clean), source: 'ai' }
      } catch {
        /* fall back below */
      }
    }
    if (!out) {
      const terms = findTerms(clean)
      out = { plain: swapText(clean, terms), terms, source: 'local' }
    }
    setResult(out)
    setBusy(false)
  }

  return (
    <>
      <h1 data-route-focus>{t('decode.title')}</h1>
      <p className="muted">{t('decode.hint')}</p>
      <form
        className="stack"
        style={{ '--gap': '10px' }}
        onSubmit={(e) => {
          e.preventDefault()
          run()
        }}
      >
        <label htmlFor="decode-in" className="sr-only">
          {t('decode.title')}
        </label>
        <textarea id="decode-in" className="textarea" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('decode.placeholder')} />
        <Button type="submit" variant="accent" size="lg" icon={Wand2} disabled={!text.trim() || busy}>
          {busy ? '…' : t('decode.go')}
        </Button>
      </form>
      {result && (
        <section className="decode-out card rise" aria-labelledby="decode-h" aria-live="polite">
          <div className="card-head">
            <h2 id="decode-h">{t('decode.result')}</h2>
            <Badge tone={result.source === 'ai' ? 'mint' : undefined} icon={result.source === 'ai' ? Sparkles : BookOpen}>
              {result.source === 'ai' ? 'AI' : 'Dictionary'}
            </Badge>
          </div>
          <p className="decode-plain" lang={result.source === 'ai' ? lang : 'en'}>
            {result.plain}
          </p>
          <Button
            variant="secondary"
            icon={reading ? Square : Volume2}
            onClick={() => {
              if (reading) {
                stopSpeaking()
                return setReading(false)
              }
              setReading(true)
              const v = window.speechSynthesis?.getVoices().find((x) => x.lang?.toLowerCase().startsWith(langInfo(result.source === 'ai' ? lang : 'en').voice.slice(0, 2).toLowerCase()))
              speak(result.plain, { voiceURI: v?.voiceURI, onEnd: () => setReading(false) })
            }}
          >
            {reading ? t('common.stop') : t('common.readAloud')}
          </Button>
          {result.terms.length > 0 ? (
            <>
              <h3 className="recap-sub">{t('decode.changed')}</h3>
              <dl className="glossary">
                {result.terms.map((g) => (
                  <div key={g.term}>
                    <dt>{g.term}</dt>
                    <dd>{g.plain}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : (
            <p className="muted small">{t('decode.none')}</p>
          )}
          <p className="tiny faint">{result.source === 'ai' ? t('decode.ai') : t('decode.local')}</p>
        </section>
      )}
    </>
  )
}

function VisitTile({ v, i, t }) {
  const date = v.startedAt ? new Date(v.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''
  return (
    <Link to={`/patient/visits/${i}`} className="pa-tile">
      <span className="pa-tile-icon">
        <Stethoscope aria-hidden="true" />
      </span>
      <span className="pa-tile-text">
        <strong>{date}</strong>
        <span className="small muted">{t('visits.with', { doctor: v.clinician?.name || t('common.doctor') })}</span>
      </span>
      <ChevronRight aria-hidden="true" />
    </Link>
  )
}

function VisitsPage({ t }) {
  const [history] = useHistory()
  return (
    <>
      <h1 data-route-focus>{t('visits.title')}</h1>
      {history.length ? (
        <ul className="pa-list">
          {history.map((v, i) => (
            <li key={`${v.code}-${v.startedAt}`}>
              <VisitTile v={v} i={i} t={t} />
            </li>
          ))}
        </ul>
      ) : (
        <Empty icon={History}>{t('home.noVisits')}</Empty>
      )}
    </>
  )
}

function VisitDetail({ index, t, lang }) {
  const [history] = useHistory()
  const v = history[index]
  if (!v) {
    return (
      <>
        <h1 data-route-focus>{t('visits.title')}</h1>
        <Empty icon={History}>{t('home.noVisits')}</Empty>
      </>
    )
  }
  return (
    <>
      <Button variant="ghost" size="sm" icon={ArrowLeft} to="/patient/visits" style={{ alignSelf: 'flex-start' }}>
        {t('visits.title')}
      </Button>
      <h1 data-route-focus>{t('recap.title')}</h1>
      <p className="muted">
        {new Date(v.startedAt).toLocaleString()} · {t('visits.with', { doctor: v.clinician?.name || t('common.doctor') })}
      </p>
      <PatientRecap recap={v.recap} accoms={v.accoms} glossary={v.glossary ?? []} lang={lang} t={t} />
    </>
  )
}

