// Rendering spoken lines: jargon decoding, translated markup, and a live
// word-by-word caption reveal that screen readers hear once, in full.
import { useEffect, useMemo, useState } from 'react'
import { decode, plainText } from '../core/jargon.js'

export function Jargon({ plain, term }) {
  return (
    <mark className="jargon">
      {plain}
      <span className="jargon-term">
        <span className="sr-only"> (medical term: </span>
        {term}
        <span className="sr-only">)</span>
      </span>
    </mark>
  )
}

/** English line with jargon swapped for plain words, original term shown small. */
export function JargonText({ text, terms }) {
  const segs = useMemo(() => decode(text, terms), [text, terms])
  return segs.map((s, i) => (s.term ? <Jargon key={i} plain={s.plain} term={s.term} /> : <span key={i}>{s.text}</span>))
}

/** Clinician view: original words, jargon underlined. */
export function TermText({ text, terms }) {
  const segs = useMemo(() => decode(text, terms), [text, terms])
  return segs.map((s, i) =>
    s.term ? (
      <span key={i} className="term-under" title={`Shown to the patient as: ${s.plain}`}>
        {s.term}
      </span>
    ) : (
      <span key={i}>{s.text}</span>
    ),
  )
}

// Translations may mark decoded terms as [[plain words|original term]].
export function parseMarkup(text) {
  const out = []
  let last = 0
  for (const m of String(text).matchAll(/\[\[([^|\]]+)\|([^\]]+)\]\]/g)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) })
    out.push({ plain: m[1], term: m[2] })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ text: text.slice(last) })
  return out
}

export const stripMarkup = (text) => String(text ?? '').replace(/\[\[([^|\]]+)\|[^\]]+\]\]/g, '$1')

export function MarkupText({ text }) {
  return parseMarkup(text).map((s, i) => (s.term ? <Jargon key={i} plain={s.plain} term={s.term} /> : <span key={i}>{s.text}</span>))
}

function tokens(segs) {
  const out = []
  for (const s of segs) {
    if (s.term) out.push(s)
    else for (const w of s.text.split(/(\s+)/)) if (w) out.push({ text: w })
  }
  return out
}

/**
 * Live caption: reveals word by word (instantly with reduced motion).
 * `local` is a translated string (may contain markup); otherwise English with jargon decoding.
 */
export function LiveCaption({ text, terms, local, speed = 1, reduceMotion, className }) {
  const segs = useMemo(() => (local ? parseMarkup(local) : decode(text, terms)), [text, terms, local])
  const toks = useMemo(() => tokens(segs), [segs])
  const [shown, setShown] = useState(reduceMotion ? toks.length : 0)

  useEffect(() => {
    if (reduceMotion) return setShown(toks.length)
    setShown(0)
    let n = 0
    const id = setInterval(() => {
      n += 1
      setShown(n)
      if (n >= toks.length) clearInterval(id)
    }, 48 / speed)
    return () => clearInterval(id)
  }, [toks, speed, reduceMotion])

  return (
    <p className={className} aria-hidden="true">
      {toks.slice(0, shown).map((t, i) =>
        t.term ? (
          <Jargon key={i} plain={t.plain} term={t.term} />
        ) : (
          <span key={i} className={reduceMotion ? undefined : 'reveal-word'}>
            {t.text}
          </span>
        ),
      )}
    </p>
  )
}

/** What a screen reader should hear for a line. */
export function spokenText(line, lang) {
  const local = lang !== 'en' ? line.local?.[lang] : null
  if (local) return parseMarkup(local).map((s) => (s.term ? `${s.plain} (${s.term})` : s.text)).join('')
  return plainText(line.text, line.terms)
}
