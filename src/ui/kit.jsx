// Beside UI kit. Small, accessible primitives used by every screen.
import { cloneElement, forwardRef, isValidElement, useEffect, useId, useRef } from 'react'
import clsx from 'clsx'
import { X } from 'lucide-react'
import { Link } from '../app/router.jsx'

export const Button = forwardRef(function Button(
  { variant = 'primary', size, icon: Icon, iconEnd: IconEnd, block, to, className, children, type = 'button', ...rest },
  ref,
) {
  const cls = clsx('btn', variant !== 'primary' && `btn--${variant}`, size && `btn--${size}`, block && 'btn--block', className)
  const inner = (
    <>
      {Icon && <Icon aria-hidden="true" />}
      {children}
      {IconEnd && <IconEnd aria-hidden="true" />}
    </>
  )
  if (to) {
    return (
      <Link to={to} className={cls} ref={ref} {...rest}>
        {inner}
      </Link>
    )
  }
  return (
    <button ref={ref} type={type} className={cls} {...rest}>
      {inner}
    </button>
  )
})

export function IconButton({ label, icon: Icon, plain, className, ...rest }) {
  return (
    <button type="button" className={clsx('icon-btn', plain && 'icon-btn--plain', className)} aria-label={label} title={label} {...rest}>
      <Icon aria-hidden="true" />
    </button>
  )
}

export function Chip({ pressed, icon: Icon, className, children, ...rest }) {
  return (
    <button type="button" className={clsx('chip', className)} aria-pressed={pressed} {...rest}>
      {Icon && <Icon aria-hidden="true" />}
      {children}
    </button>
  )
}

/** Radio-group segmented control with arrow-key navigation. */
export function Segmented({ label, value, options, onChange, className }) {
  const refs = useRef([])
  const idx = Math.max(0, options.findIndex((o) => o.value === value))
  const move = (e) => {
    const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
    if (!dir) return
    e.preventDefault()
    const rtl = document.documentElement.dir === 'rtl' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')
    const next = (idx + (rtl ? -dir : dir) + options.length) % options.length
    onChange(options[next].value)
    refs.current[next]?.focus()
  }
  return (
    <div className={clsx('seg', className)} role="radiogroup" aria-label={label} onKeyDown={move}>
      {options.map((o, i) => (
        <button
          key={String(o.value)}
          ref={(el) => (refs.current[i] = el)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={i === idx ? 0 : -1}
          aria-label={o.aria}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Switch({ checked, onChange, children, hint }) {
  const id = useId()
  return (
    <button type="button" role="switch" aria-checked={checked} className="switch" onClick={() => onChange(!checked)} aria-describedby={hint ? id : undefined}>
      <span className="stack" style={{ '--gap': '2px' }}>
        <span>{children}</span>
        {hint && (
          <span id={id} className="small muted" style={{ fontWeight: 400 }}>
            {hint}
          </span>
        )}
      </span>
      <span className="switch-track" aria-hidden="true" />
    </button>
  )
}

export function Badge({ tone, icon: Icon, children, className, ...rest }) {
  return (
    <span className={clsx('badge', tone && `badge--${tone}`, className)} {...rest}>
      {Icon && <Icon aria-hidden="true" />}
      {children}
    </span>
  )
}

export function Field({ label, hint, children, id: idProp }) {
  const auto = useId()
  const id = idProp ?? auto
  const hintId = hint ? `${id}-hint` : undefined
  // Wire the label and hint to the control, whether passed as an element or a render function.
  const child =
    typeof children === 'function'
      ? children({ id, 'aria-describedby': hintId })
      : isValidElement(children)
        ? cloneElement(children, { id: children.props.id ?? id, 'aria-describedby': children.props['aria-describedby'] ?? hintId })
        : children
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {hint && (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      )}
      {child}
    </div>
  )
}

/** Accessible modal built on <dialog>: focus trap, Escape, inert background for free. */
export function Sheet({ open, onClose, title, children, footer }) {
  const ref = useRef(null)
  const openRef = useRef(open)
  openRef.current = open
  const titleId = useId()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={titleId}
      // Only a close the user caused (Escape, backdrop) reports back; closing because `open` went false does not.
      onClose={() => openRef.current && onClose()}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      {open && (
        <>
          <div className="sheet-head">
            <h2 id={titleId}>{title}</h2>
            <IconButton label="Close" icon={X} onClick={onClose} />
          </div>
          <div className="sheet-body">{children}</div>
          {footer && <div className="sheet-body" style={{ paddingTop: 0 }}>{footer}</div>}
        </>
      )}
    </dialog>
  )
}

/** Tab list with roving focus. Pair each tab with a panel: id `${idBase}-panel-${tab.id}`. */
export function Tabs({ tabs, value, onChange, label, idBase, className, pressing }) {
  const refs = useRef([])
  const idx = Math.max(0, tabs.findIndex((t) => t.id === value))
  const onKey = (e) => {
    const dir = { ArrowRight: 1, ArrowLeft: -1 }[e.key]
    let next = null
    if (dir) next = (idx + (document.documentElement.dir === 'rtl' ? -dir : dir) + tabs.length) % tabs.length
    if (e.key === 'Home') next = 0
    if (e.key === 'End') next = tabs.length - 1
    if (next === null) return
    e.preventDefault()
    onChange(tabs[next].id)
    refs.current[next]?.focus()
  }
  return (
    <div className={clsx('tabs', className)} role="tablist" aria-label={label} onKeyDown={onKey}>
      {tabs.map((t, i) => {
        const Icon = t.icon
        return (
          <button
            key={t.id}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            role="tab"
            id={`${idBase}-tab-${t.id}`}
            aria-controls={`${idBase}-panel-${t.id}`}
            aria-selected={t.id === value}
            tabIndex={t.id === value ? 0 : -1}
            className={clsx('tab', pressing === `tab-${t.id}` && 'is-pressing')}
            onClick={() => onChange(t.id)}
          >
            {Icon && <Icon aria-hidden="true" />}
            <span>{t.label}</span>
            {t.badge}
          </button>
        )
      })}
    </div>
  )
}

export function Meter({ value, label, low = 50 }) {
  return (
    <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-label={label}>
      <span style={{ width: `${value}%` }} className={value < low ? 'is-low' : undefined} />
    </div>
  )
}

export function Empty({ icon: Icon, title, children, action }) {
  return (
    <div className="empty">
      {Icon && <Icon aria-hidden="true" />}
      {title && <h3>{title}</h3>}
      {children && <p className="small">{children}</p>}
      {action}
    </div>
  )
}

export function LogoMark({ size = 28 }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" focusable="false">
      <circle cx="12" cy="16" r="9" fill="none" stroke="currentColor" strokeWidth="2.4" opacity="0.55" />
      <circle cx="20" cy="16" r="9" fill="var(--mint)" />
      <path d="M16.6 10.4a9 9 0 0 1 0 11.2" fill="none" stroke="var(--mint-ink)" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    </svg>
  )
}

export function Logo({ to = '/', label = 'Beside home' }) {
  return (
    <Link to={to} className="logo" aria-label={label}>
      <LogoMark />
      <span aria-hidden="true">Beside</span>
    </Link>
  )
}

// One polite live region for the whole app.
let announceEl = null
export function Announcer() {
  const ref = useRef(null)
  useEffect(() => {
    announceEl = ref.current
    return () => {
      announceEl = null
    }
  }, [])
  return <div ref={ref} className="sr-only" role="status" aria-live="polite" aria-atomic="true" />
}
export function announce(text) {
  if (!announceEl) return
  announceEl.textContent = ''
  setTimeout(() => {
    if (announceEl) announceEl.textContent = text
  }, 60)
}
