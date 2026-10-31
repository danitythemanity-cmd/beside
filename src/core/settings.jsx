// Device-wide display and voice settings, applied to <html> so every screen
// (and every device frame in the sample visit) follows them.
import { createContext, useContext, useEffect, useMemo } from 'react'
import { useStored, KEYS } from './storage.js'

export const TEXT_SCALES = [
  { value: 1, label: 'Default' },
  { value: 1.15, label: 'Large' },
  { value: 1.3, label: 'Larger' },
  { value: 1.5, label: 'Largest' },
]

const prefersReduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const prefersContrast = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-contrast: more)').matches

const DEFAULTS = {
  theme: 'dark', // dark | light | contrast
  textScale: 1,
  reduceMotion: false,
  voice: true,
  rate: 1,
  voiceURI: null,
}

const Ctx = createContext(null)

export function SettingsProvider({ children }) {
  const [stored, setStored] = useStored(KEYS.settings, null)
  const settings = useMemo(
    () => ({
      ...DEFAULTS,
      reduceMotion: prefersReduced(),
      theme: prefersContrast() ? 'contrast' : DEFAULTS.theme,
      ...(stored ?? {}),
    }),
    [stored],
  )

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = settings.theme
    root.dataset.motion = settings.reduceMotion ? 'reduce' : 'full'
    root.style.fontSize = `${settings.textScale * 100}%`
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.content = settings.theme === 'light' ? '#f6f6f4' : '#0a0a0b'
  }, [settings])

  const value = useMemo(() => [settings, (patch) => setStored((prev) => ({ ...(prev ?? {}), ...patch }))], [settings, setStored])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSettings() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useSettings must be used inside SettingsProvider')
  return v
}
