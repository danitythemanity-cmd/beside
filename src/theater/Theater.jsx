// The sample visit theater: a scripted appointment played through the real
// visit engine onto the real patient and clinician screens, side by side.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { ArrowLeft, Play, Pause, RotateCcw, Check, Smartphone, Tablet, Volume2, VolumeX, Languages, Sparkles, Stethoscope, UserRound } from 'lucide-react'
import { useVisitStore } from '../core/sync.js'
import { createActions } from '../core/actions.js'
import { SCRIPT, SCRIPT_MS, FEATURES, scriptStrings, localizeEvent } from '../core/sampleVisit.js'
import { painSentence } from '../core/visit.js'
import { speak, stopSpeaking } from '../core/speech.js'
import { useSettings } from '../core/settings.jsx'
import { useAi, aiStrings } from '../core/ai.js'
import { LANGS, loadLanguage, useLanguageStatus } from '../core/i18n.js'
import { read, write } from '../core/storage.js'
import { useRouter, query } from '../app/router.jsx'
import { Button, Segmented, Logo } from '../ui/kit.jsx'
import PatientVisit from '../patient/PatientVisit.jsx'
import ClinicianVisit from '../clinician/ClinicianVisit.jsx'

const SPEEDS = [1, 1.5, 2]
const PHONE = { w: 384, h: 790 }
const TABLET = { w: 900, h: 790 }
const GAP = 28

// Cumulative start time of each step, for the progress bar and chapters.
const STARTS = SCRIPT.reduce((acc, s, i) => [...acc, (acc[i - 1] ?? 0) + (i ? SCRIPT[i - 1].wait : 0)], [])

// Scroll the tablet screen to an element (or back to the top) after React paints.
function revealOnTablet(selector) {
  setTimeout(() => {
    const box = document.querySelector('.th-stage .device--tablet .device-screen')
    if (!box) return
    const el = selector ? box.querySelector(selector) : null
    if (!el) return box.scrollTo({ top: 0, behavior: 'smooth' })
    const r = el.getBoundingClientRect()
    const b = box.getBoundingClientRect()
    const k = box.offsetHeight / (b.height || 1)
    if (r.top < b.top || r.bottom > b.bottom) box.scrollBy({ top: (r.bottom - b.bottom + 24) * k, behavior: 'smooth' })
  }, 60)
}

function useMedia(q) {
  const [m, setM] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const mq = window.matchMedia(q)
    const on = () => setM(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [q])
  return m
}

export default function Theater() {
  const { navigate } = useRouter()
  const [settings, setSettings] = useSettings()
  const ai = useAi()
  const store = useVisitStore({ role: 'theater', sync: false })
  const { state, dispatch, reset, getState } = store
  const [status, setStatus] = useState('idle') // idle | playing | paused | done
  const [step, setStep] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [narration, setNarration] = useState(null)
  const [seen, setSeen] = useState(() => new Set())
  const [lang, setLang] = useState('en')
  const [tr, setTr] = useState(null)
  const [trStatus, setTrStatus] = useState('ready')
  const wide = useMedia('(min-width: 980px)')
  const [view, setView] = useState('patient')
  const [follow, setFollow] = useState(true)
  const uiStatus = useLanguageStatus(lang)

  const voice = useCallback(
    (text) => {
      if (settings.voice) speak(text, { rate: Math.min(1.5, settings.rate * Math.min(speed, 1.35)), voiceURI: settings.voiceURI })
    },
    [settings.voice, settings.rate, settings.voiceURI, speed],
  )

  // Clicks inside the frames work too, using the same actions as the real apps.
  const actions = useMemo(() => createActions({ dispatch, getState, voice: { ...settings, rate: settings.rate }, ai: false }), [dispatch, getState, settings])

  const apply = useCallback(
    (s, { silent = false } = {}) => {
      if (s.narrate) setNarration({ text: s.narrate, feature: s.feature })
      if (s.feature) setSeen((prev) => new Set(prev).add(s.feature))
      if (s.focus && s.focus !== 'both' && follow) setView(s.focus)
      const e = s.event
      if (!e) return
      if (silent && e.type === 'ui/press') return
      // Point the tablet at what just changed: the checklist, or the top for nudges and reports.
      if (!silent) {
        if (e.type === 'accom/provide') revealOnTablet('[data-anchor="accoms"]')
        else if (e.type === 'card/share' || e.type === 'pain/send' || (e.type === 'line/add' && e.who === 'clinician' && e.to === 'caregiver')) revealOnTablet(null)
      }
      if (e.type === 'pain/send') {
        const p = getState().pain
        dispatch(e)
        if (!silent) voice(painSentence(p))
        return
      }
      dispatch(localizeEvent(e, lang, tr))
      if (silent) return
      if (e.type === 'line/add' && e.who === 'patient') voice(e.text)
      if (e.type === 'patient/simpler') voice('Can you say that more simply?')
    },
    [dispatch, getState, voice, lang, tr, follow],
  )

  // The player loop.
  useEffect(() => {
    if (status !== 'playing') return
    if (step >= SCRIPT.length) {
      setStatus('done')
      return
    }
    const s = SCRIPT[step]
    const timer = setTimeout(() => {
      apply(s)
      setStep((n) => n + 1)
    }, s.wait / speed)
    return () => clearTimeout(timer)
  }, [status, step, speed, apply])

  const start = useCallback(() => {
    stopSpeaking()
    reset()
    setSeen(new Set())
    setNarration(null)
    setStep(0)
    setStatus('playing')
    const controls = document.querySelector('.th-controls')
    if (controls && window.matchMedia('(min-width: 980px)').matches) {
      window.scrollTo({ top: controls.getBoundingClientRect().top + window.scrollY - 8, behavior: settings.reduceMotion ? 'auto' : 'smooth' })
    }
  }, [reset, settings.reduceMotion])

  // Jump to a chapter: rebuild state instantly up to that step, then keep playing.
  const seek = useCallback(
    (featureId) => {
      const target = SCRIPT.findIndex((s) => s.feature === featureId)
      if (target < 0) return
      stopSpeaking()
      reset()
      setSeen(new Set())
      for (let i = 0; i < target; i++) apply(SCRIPT[i], { silent: true })
      setStep(target)
      setStatus('playing')
    },
    [apply, reset],
  )

  // Autoplay when arriving from the home page.
  const autoplayed = useRef(false)
  useEffect(() => {
    if (!autoplayed.current && query().get('autoplay') === '1') {
      autoplayed.current = true
      start()
    }
  }, [start])

  useEffect(() => () => stopSpeaking(), [])

  // Keep scripted taps and new captions in view inside the (scrollable) phone.
  const captionId = state.lines.findLast?.((l) => l.who !== 'patient')?.id
  useEffect(() => {
    document.querySelector('.th-stage .device--phone .pv-body')?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [captionId])
  useEffect(() => {
    if (!state.ui.press) return
    const el = document.querySelector('.th-stage .is-pressing')
    const box = el?.closest('.pv-body')
    if (!el || !box) return
    const r = el.getBoundingClientRect()
    const b = box.getBoundingClientRect()
    const k = box.offsetHeight / (b.height || 1)
    if (r.top < b.top || r.bottom > b.bottom) box.scrollBy({ top: (r.top - b.top - b.height / 3) * k, behavior: 'smooth' })
  }, [state.ui.press])

  // Language: translate the interface and the script once, then cache.
  async function chooseLanguage(code) {
    setLang(code)
    if (code === 'en') {
      setTr(null)
      setTrStatus('ready')
      if (status !== 'idle') start()
      return
    }
    const key = `beside.demo.${code}.v2-${Object.keys(scriptStrings()).length}`
    const cached = read(key, null)
    if (cached) {
      setTr(cached)
      setTrStatus('ready')
      loadLanguage(code, aiStrings)
      return
    }
    if (ai.state !== 'ready') {
      setTrStatus('offline')
      return
    }
    setTrStatus('loading')
    setStatus((s) => (s === 'playing' ? 'paused' : s))
    try {
      const [strings] = await Promise.all([aiStrings(scriptStrings(), code), loadLanguage(code, aiStrings)])
      write(key, strings)
      setTr(strings)
      setTrStatus('ready')
    } catch {
      setTrStatus('failed')
    }
  }

  // Restart with the new language once its translation lands.
  const prevTr = useRef(tr)
  useEffect(() => {
    if (prevTr.current !== tr && status !== 'idle') start()
    prevTr.current = tr
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tr])

  const elapsed = status === 'idle' ? 0 : Math.min(SCRIPT_MS, STARTS[Math.min(step, SCRIPT.length - 1)] ?? SCRIPT_MS)
  const playing = status === 'playing'
  const name = state.patient?.name ?? 'Sam'

  return (
    <div className="th">
      <a className="skip-link" href="#th-stage">
        Skip to the sample visit
      </a>
      <header className="th-top">
        <div className="row" style={{ '--gap': '14px' }}>
          <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => navigate('/')}>
            Home
          </Button>
          <Logo />
        </div>
        <div className="th-banner">
          <p>
            <strong>Disabled patients are talked over, rushed, and dismissed.</strong> Beside makes sure they are heard.
          </p>
        </div>
        <div className="row th-top-actions" style={{ '--gap': '8px' }}>
          <Button variant="secondary" size="sm" icon={UserRound} to="/patient">
            Patient app
          </Button>
          <Button variant="secondary" size="sm" icon={Stethoscope} to="/clinician">
            Clinician app
          </Button>
        </div>
      </header>

      <main id="th-stage" className="th-main">
        <h1 className="sr-only">Sample visit: Sam at urgent care</h1>
        <section className="th-controls" aria-label="Sample visit controls">
          <div className="th-narration" aria-live="polite">
            {narration ? (
              <>
                {narration.feature && (
                  <span className="th-chip">
                    Step {FEATURES.findIndex((f) => f.id === narration.feature) + 1} of {FEATURES.length} · {FEATURES.find((f) => f.id === narration.feature)?.label}
                  </span>
                )}
                <p>{narration.text}</p>
              </>
            ) : status === 'done' ? (
              <p>That’s the visit. Try it yourself, or watch it again.</p>
            ) : (
              <p>
                A 75-second appointment with <strong>Sam</strong>, who is autistic and nonverbal. Press play. Sound on to hear Sam’s voice.
              </p>
            )}
          </div>
          <div className="th-buttons">
            {status === 'idle' || status === 'done' ? (
              <Button variant="accent" icon={status === 'done' ? RotateCcw : Play} onClick={start} disabled={trStatus === 'loading'}>
                {status === 'done' ? 'Watch again' : 'Play sample visit'}
              </Button>
            ) : (
              <>
                <Button variant="accent" icon={playing ? Pause : Play} onClick={() => setStatus(playing ? 'paused' : 'playing')}>
                  {playing ? 'Pause' : 'Resume'}
                </Button>
                <Button variant="secondary" icon={RotateCcw} onClick={start}>
                  Restart
                </Button>
              </>
            )}
            <Segmented label="Playback speed" value={speed} onChange={setSpeed} options={SPEEDS.map((s) => ({ value: s, label: `${s}×`, aria: `${s} times speed` }))} />
            <button
              type="button"
              className="icon-btn"
              aria-pressed={settings.voice}
              aria-label="Sam’s voice"
              title={settings.voice ? 'Sam’s voice is on' : 'Sam’s voice is off'}
              onClick={() => setSettings({ voice: !settings.voice })}
            >
              {settings.voice ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
            </button>
            <label className="th-lang">
              <Languages aria-hidden="true" />
              <span className="sr-only">Sam’s language</span>
              <select className="select" value={lang} onChange={(e) => chooseLanguage(e.target.value)}>
                {LANGS.map((l) => (
                  <option key={l.code} value={l.code}>
                    Sam reads {l.native}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {(trStatus !== 'ready' || (lang !== 'en' && uiStatus === 'loading')) && (
            <p className="th-lang-status" role="status">
              {trStatus === 'loading' || uiStatus === 'loading' ? (
                <>
                  <Sparkles aria-hidden="true" /> Translating Sam’s visit into {LANGS.find((l) => l.code === lang)?.native}…
                </>
              ) : trStatus === 'offline' ? (
                'Other languages need the AI connection. Add a Hugging Face or Claude key to turn it on. Playing in English.'
              ) : trStatus === 'failed' ? (
                'Translation failed. Playing in English.'
              ) : null}
            </p>
          )}
          <div className="th-progress" aria-hidden="true">
            <span style={{ width: `${(elapsed / SCRIPT_MS) * 100}%` }} />
          </div>
          <nav className="th-chapters" aria-label="Jump to a feature">
            <ol>
              {FEATURES.map((f, i) => (
                <li key={f.id}>
                  <button
                    type="button"
                    className={clsx('th-chapter', seen.has(f.id) && 'is-seen', narration?.feature === f.id && 'is-now')}
                    aria-current={narration?.feature === f.id ? 'step' : undefined}
                    onClick={() => seek(f.id)}
                  >
                    <span className="th-step-num" aria-hidden="true">
                      {seen.has(f.id) && narration?.feature !== f.id ? <Check /> : i + 1}
                    </span>
                    {f.label}
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        </section>

        {!wide && (
          <div className="th-switch">
            <Segmented
              label="Which screen to show"
              value={view}
              onChange={(v) => {
                setView(v)
                setFollow(false)
              }}
              options={[
                { value: 'patient', label: <span className="row" style={{ '--gap': '6px' }}><Smartphone size={16} aria-hidden="true" />Sam’s phone</span>, aria: 'Sam’s phone' },
                { value: 'clinician', label: <span className="row" style={{ '--gap': '6px' }}><Tablet size={16} aria-hidden="true" />Doctor’s tablet</span>, aria: 'Doctor’s tablet' },
              ]}
            />
            <label className="th-follow">
              <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> Follow the action
            </label>
          </div>
        )}

        <Stage wide={wide}>
          {(!wide ? view === 'patient' : true) && (
            <Device kind="phone" label={`${name}’s phone`} sub="Patient" wide={wide}>
              <PatientVisit visit={state} actions={actions} embedded speed={speed} reduceMotion={settings.reduceMotion} />
            </Device>
          )}
          {(!wide ? view === 'clinician' : true) && (
            <Device kind="tablet" label="Dr. Okafor’s tablet" sub="Clinician" wide={wide}>
              <ClinicianVisit visit={state} actions={actions} embedded />
            </Device>
          )}
        </Stage>

        {status === 'done' && (
          <section className="th-end rise" aria-labelledby="th-end-h">
            <div>
              <p className="eyebrow">Now it’s your turn</p>
              <h2 id="th-end-h">Run a real visit across two screens.</h2>
              <p className="muted">Open the patient app here and the clinician app in another tab or device. They sync live.</p>
            </div>
            <div className="row">
              <Button variant="accent" size="lg" icon={UserRound} to="/patient">
                Open the patient app
              </Button>
              <Button variant="secondary" size="lg" icon={Stethoscope} to="/clinician">
                Open the clinician app
              </Button>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

/** Scales the two device frames together so both always fit on screen. */
function Stage({ wide, children }) {
  const ref = useRef(null)
  const [scale, setScale] = useState(1)
  useLayoutEffect(() => {
    if (!wide) return setScale(1)
    const el = ref.current
    const fit = () => {
      const w = el.clientWidth
      // Controls stick to the top while playing; the devices fill the rest of the viewport.
      const controls = document.querySelector('.th-controls')?.offsetHeight ?? 160
      const availH = Math.max(520, window.innerHeight - controls - 44)
      setScale(Math.min(1, w / (PHONE.w + TABLET.w + GAP), availH / PHONE.h))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    window.addEventListener('resize', fit)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', fit)
    }
  }, [wide])
  return (
    <div ref={ref} className={clsx('th-stage', wide && 'is-wide')} style={wide ? { height: PHONE.h * scale } : undefined}>
      <div className="th-stage-inner" style={wide ? { transform: `scale(${scale})`, width: PHONE.w + TABLET.w + GAP } : undefined}>
        {children}
      </div>
    </div>
  )
}

function Device({ kind, label, sub, wide, children }) {
  return (
    <figure className={clsx('device', `device--${kind}`, wide && 'is-fixed')} aria-label={label}>
      <figcaption className="device-label">
        {kind === 'phone' ? <Smartphone aria-hidden="true" /> : <Tablet aria-hidden="true" />}
        <span>{label}</span>
        <span className="faint">· {sub}</span>
      </figcaption>
      <div className="device-shell">
        <div className="device-status" aria-hidden="true">
          <span>9:41</span>
          {kind === 'phone' && <span className="device-island" />}
          <span className="device-icons">
            <i />
            <i />
            <i />
          </span>
        </div>
        <div className="device-screen">{children}</div>
      </div>
    </figure>
  )
}
