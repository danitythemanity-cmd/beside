// Small localStorage layer. Everything stays on this device; nothing is sent
// anywhere. Reads and writes never throw (private mode, blocked storage).
import { useCallback, useEffect, useState } from 'react'

const listeners = new Map()

export function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw == null ? fallback : JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function write(key, value) {
  try {
    if (value === undefined) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable: the app keeps working in memory */
  }
  listeners.get(key)?.forEach((fn) => fn(value))
}

// useState that persists to localStorage and stays in sync across tabs.
export function useStored(key, fallback) {
  const [value, setValue] = useState(() => read(key, fallback))

  useEffect(() => {
    const local = (v) => setValue(v === undefined ? fallback : v)
    if (!listeners.has(key)) listeners.set(key, new Set())
    listeners.get(key).add(local)
    const remote = (e) => {
      if (e.key === key) setValue(read(key, fallback))
    }
    window.addEventListener('storage', remote)
    return () => {
      listeners.get(key)?.delete(local)
      window.removeEventListener('storage', remote)
    }
    // fallback is a constant per call site
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const set = useCallback(
    (next) => {
      const resolved = typeof next === 'function' ? next(read(key, fallback)) : next
      write(key, resolved)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  )
  return [value, set]
}

export const KEYS = {
  profile: 'beside.profile',
  history: 'beside.history',
  settings: 'beside.settings',
  activeVisit: 'beside.activeVisit',
  visit: (code) => `beside.visit.${code}`,
  intro: 'beside.introSeen',
}

export const useProfile = () => useStored(KEYS.profile, null)
export const useHistory = () => useStored(KEYS.history, [])

export function saveToHistory(entry) {
  const list = read(KEYS.history, [])
  const without = list.filter((v) => !(v.code === entry.code && v.startedAt === entry.startedAt))
  write(KEYS.history, [entry, ...without].slice(0, 30))
}

export function sessionFlag(key) {
  try {
    return sessionStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

export function setSessionFlag(key, on = true) {
  try {
    if (on) sessionStorage.setItem(key, '1')
    else sessionStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}
