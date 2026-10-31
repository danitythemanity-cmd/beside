// The clinician app: join a visit by code, then the live dashboard.
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Play, Settings, Stethoscope } from 'lucide-react'
import { useRouter, match } from '../app/router.jsx'
import { useStored } from '../core/storage.js'
import { useSettings } from '../core/settings.jsx'
import { useVisitStore } from '../core/sync.js'
import { createActions } from '../core/actions.js'
import { startListening, useCanListen, speak } from '../core/speech.js'
import { useCall } from '../core/call.js'
import { Badge, Button, Field, IconButton, Logo } from '../ui/kit.jsx'
import SettingsSheet from '../ui/SettingsSheet.jsx'
import ClinicianVisit from './ClinicianVisit.jsx'

export default function ClinicianApp() {
  const { path } = useRouter()
  const m = match('/clinician/visit/:code', path)
  const [settingsOpen, setSettingsOpen] = useState(false)
  return (
    <div className="ca">
      <a className="skip-link" href="#ca-main">
        Skip to content
      </a>
      <header className="ca-bar">
        <div className="row" style={{ '--gap': '4px' }}>
          <Logo to="/clinician" label="Beside clinician home" />
          <Badge icon={Stethoscope}>Clinician</Badge>
        </div>
        <div className="row" style={{ '--gap': '6px' }}>
          <Button variant="ghost" size="sm" to="/">
            About
          </Button>
          {!m && <IconButton label="Settings" icon={Settings} onClick={() => setSettingsOpen(true)} />}
        </div>
      </header>
      <main id="ca-main" className="ca-main">
        {m ? <LiveDashboard code={m.code} /> : <Join />}
      </main>
      {!m && <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} voiceControls={false} />}
    </div>
  )
}

function Join() {
  const { navigate } = useRouter()
  const [digits, setDigits] = useState(['', '', '', ''])
  const [name, setName] = useStored('beside.clinicianName', '')
  const refs = useRef([])
  const code = digits.join('')

  const setDigit = (i, v) => {
    const clean = v.replace(/\D/g, '')
    if (clean.length > 1) {
      // Pasted a whole code.
      const next = clean.slice(0, 4).split('')
      setDigits([0, 1, 2, 3].map((k) => next[k] ?? ''))
      refs.current[Math.min(3, next.length)]?.focus()
      return
    }
    setDigits((d) => d.map((x, k) => (k === i ? clean : x)))
    if (clean && i < 3) refs.current[i + 1]?.focus()
  }

  return (
    <div className="ca-join">
      <form
        className="ca-join-card"
        onSubmit={(e) => {
          e.preventDefault()
          if (code.length === 4) navigate(`/clinician/visit/${code}`)
        }}
      >
        <div className="stack" style={{ '--gap': '8px' }}>
          <p className="eyebrow">Join a visit</p>
          <h1 data-route-focus>Enter the code on your patient’s phone</h1>
          <p className="muted">Their “This is me” card, live captions, and replies appear on this screen.</p>
        </div>
        <fieldset className="pain-set">
          <legend className="sr-only">Visit code</legend>
          <div className="code-inputs">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => (refs.current[i] = el)}
                inputMode="numeric"
                autoComplete="one-time-code"
                aria-label={`Digit ${i + 1} of 4`}
                value={d}
                onChange={(e) => setDigit(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace' && !d && i > 0) refs.current[i - 1]?.focus()
                }}
                maxLength={i === 0 ? 4 : 1}
              />
            ))}
          </div>
        </fieldset>
        <Field label="Your name, as the patient will see it">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Dr. Lee" autoComplete="name" />
        </Field>
        <Button type="submit" size="lg" iconEnd={ArrowRight} disabled={code.length !== 4}>
          Join visit
        </Button>
        <p className="small muted" style={{ textAlign: 'center' }}>
          No patient handy?{' '}
          <Button variant="ghost" size="sm" icon={Play} to="/demo?autoplay=1">
            Watch the sample visit
          </Button>
        </p>
      </form>
    </div>
  )
}

function LiveDashboard({ code }) {
  const store = useVisitStore({ code, role: 'clinician' })
  const { state, dispatch, getState, peers } = store
  const [settings] = useSettings()
  const [name] = useStored('beside.clinicianName', '')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [micOn, setMicOn] = useState(false)
  const [interim, setInterim] = useState('')
  const stopRef = useRef(null)
  const actions = useMemo(() => createActions({ dispatch, getState, voice: { ...settings, voice: false } }), [dispatch, getState, settings])
  const call = useCall(store.rtc)
  const canListen = useCanListen()
  const inCall = call.phase === 'live'

  // Introduce ourselves to the patient's phone (again after a fresh start).
  useEffect(() => {
    const me = name?.trim()
    if (me && state.patient && state.clinician?.name !== me) dispatch({ type: 'clinician/join', clinician: { name: me } })
  }, [state.patient, state.clinician?.name, name, dispatch])

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

  // Deaf and hard-of-hearing patients rely on captions, so they start with the call.
  useEffect(() => {
    if (inCall && !micOn && canListen) toggleMic()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inCall])

  // During a call the patient's words are spoken here, where the clinician can hear them.
  const spoken = useRef(null)
  useEffect(() => {
    const last = state.lines.at(-1)
    if (!inCall) {
      spoken.current = last?.id ?? null
      return
    }
    if (!last || last.who !== 'patient' || spoken.current === last.id) return
    spoken.current = last.id
    if (settings.voice) speak(last.text, { rate: settings.rate, voiceURI: settings.voiceURI })
  }, [state.lines, inCall, settings])

  return (
    <>
      <h1 className="sr-only" data-route-focus>
        Visit {code}
        {state.patient ? ` with ${state.patient.name}` : ''}
      </h1>
      <ClinicianVisit
        visit={state}
        actions={actions}
        peers={peers}
        mic={{ available: canListen, on: micOn, toggle: toggleMic }}
        interim={interim}
        call={call}
        onSettings={() => setSettingsOpen(true)}
      />
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} voiceControls={false} />
    </>
  )
}
