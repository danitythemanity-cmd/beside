import { useEffect } from 'react'
import { Router, useRouter, match } from './router.jsx'
import { SettingsProvider } from '../core/settings.jsx'
import { checkAi } from '../core/ai.js'
import { Announcer, Button, Logo } from '../ui/kit.jsx'
import Home from '../landing/Home.jsx'
import Theater from '../theater/Theater.jsx'
import PatientApp from '../patient/PatientApp.jsx'
import ClinicianApp from '../clinician/ClinicianApp.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'

const TITLES = [
  ['/demo', 'Sample visit · Beside'],
  ['/patient', 'Beside for patients'],
  ['/clinician', 'Beside for clinicians'],
  ['/', 'Beside: be heard at the doctor'],
]

function Routes() {
  const { path } = useRouter()

  useEffect(() => {
    document.title = TITLES.find(([p]) => path === p || path.startsWith(p + '/') || p === '/')?.[1] ?? 'Beside'
  }, [path])

  if (path === '/') return <Home />
  if (path === '/demo') return <Theater />
  if (path === '/patient' || path.startsWith('/patient/')) return <PatientApp />
  if (path === '/clinician' || match('/clinician/visit/:code', path)) return <ClinicianApp />
  return (
    <main className="notfound">
      <Logo />
      <h1>Page not found</h1>
      <p className="muted">That page doesn’t exist.</p>
      <Button to="/">Go home</Button>
    </main>
  )
}

// A crash on one page shouldn't stick after navigating away: remount per path.
function RoutesWithRecovery() {
  const { path } = useRouter()
  return (
    <ErrorBoundary key={path}>
      <Routes />
    </ErrorBoundary>
  )
}

export default function App() {
  useEffect(() => {
    checkAi()
    // Dev only: lets tests re-check the AI connection after mocking it.
    if (import.meta.env.DEV) window.__besideCheckAi = () => checkAi(true)
  }, [])
  return (
    <SettingsProvider>
      <Router>
        <RoutesWithRecovery />
        <Announcer />
      </Router>
    </SettingsProvider>
  )
}
