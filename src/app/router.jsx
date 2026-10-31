// Minimal History API router: real URLs, back/forward, focus management, and a
// route announcement for screen readers.
import { createContext, forwardRef, useCallback, useContext, useEffect, useState } from 'react'

const Ctx = createContext({ path: '/', navigate: () => {} })

export function Router({ children }) {
  const [path, setPath] = useState(() => window.location.pathname)

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = useCallback((to, { replace = false } = {}) => {
    if (to === window.location.pathname + window.location.search) return
    window.history[replace ? 'replaceState' : 'pushState']({}, '', to)
    setPath(window.location.pathname)
    window.scrollTo(0, 0)
    // Move focus to the new page's heading so keyboard and screen reader users land in context.
    requestAnimationFrame(() => {
      const target = document.querySelector('[data-route-focus]') ?? document.querySelector('main h1')
      if (target) {
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
        target.focus({ preventScroll: true })
      }
    })
  }, [])

  return <Ctx.Provider value={{ path, navigate }}>{children}</Ctx.Provider>
}

export const useRouter = () => useContext(Ctx)

/** Match "/clinician/visit/:code" against a path. Returns params or null. */
export function match(pattern, path) {
  const p = pattern.split('/').filter(Boolean)
  const a = path.split('/').filter(Boolean)
  if (p.length !== a.length) return null
  const params = {}
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(a[i])
    else if (p[i] !== a[i]) return null
  }
  return params
}

export const Link = forwardRef(function Link({ to, onClick, children, ...rest }, ref) {
  const { navigate } = useRouter()
  return (
    <a
      ref={ref}
      href={to}
      onClick={(e) => {
        onClick?.(e)
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || rest.target) return
        e.preventDefault()
        navigate(to)
      }}
      {...rest}
    >
      {children}
    </a>
  )
})

export const query = () => new URLSearchParams(window.location.search)
