// The opening sequence: Beside in 25 seconds, in four acts, paced to be read.
//   1. The problem    kinetic type: talked over, rushed, dismissed
//   2. Meet Sam       nonverbal, understands everything
//   3. Beside         phone and tablet, live: plain words, one-tap voice, requests tracked
//   4. The promise    the mark comes together
// Every element is placed on a fixed 1200x700 stage that scales to the screen.
// Skippable (button, Escape, Enter) and pausable (button, Space).
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { ArrowRight, Pause, Play, Volume2, Check, Send, Captions, Sparkles, ListChecks, MessageCircle, LayoutGrid, Activity, IdCard } from 'lucide-react'

const ACTS = [
  { id: 'problem', label: 'The problem', from: 0, to: 6500 },
  { id: 'sam', label: 'Meet Sam', from: 6500, to: 10000 },
  { id: 'beside', label: 'Beside', from: 10000, to: 20500 },
  { id: 'promise', label: 'The promise', from: 20500, to: 25000 },
]
const TOTAL = ACTS.at(-1).to
const SR = [
  'Every day, disabled patients are talked over, rushed, and dismissed.',
  'Sam doesn’t speak. But Sam understands everything.',
  'With Beside, the doctor’s words appear on Sam’s phone in plain language. Sam taps a reply, and Beside speaks it aloud. Every request is tracked.',
  'Beside. Disabled patients deserve to be heard.',
]

// Landscape screens use a 1200x720 stage; portrait phones a 760x1180 one.
function useStage() {
  const measure = () => {
    const portrait = window.innerWidth / window.innerHeight < 0.85
    const [w, h] = portrait ? [760, 1180] : [1200, 720]
    return { portrait, w, h, k: Math.min(window.innerWidth / w, (window.innerHeight - 40) / h, 1.25) }
  }
  const [stage, setStage] = useState(measure)
  useLayoutEffect(() => {
    const fit = () => setStage(measure())
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])
  return stage
}

export default function Intro({ onDone }) {
  const [t, setT] = useState(0)
  const [paused, setPaused] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const skipRef = useRef(null)
  const done = useRef(false)
  const last = useRef(null)
  const tRef = useRef(0) // latest time, read inside the animation loop
  tRef.current = t
  const stage = useStage()

  const finish = () => {
    if (done.current) return
    done.current = true
    setLeaving(true)
    setTimeout(onDone, document.documentElement.dataset.motion === 'reduce' ? 0 : 700)
  }

  useEffect(() => {
    skipRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') finish()
      if (e.key === ' ' && e.target === document.body) {
        e.preventDefault()
        setPaused((p) => !p)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (paused || leaving) return
    let raf
    const tick = (now) => {
      if (last.current != null) {
        // Cap each step so a hidden tab pauses the intro instead of skipping it.
        const next = Math.min(TOTAL, tRef.current + Math.min(now - last.current, 64))
        setT(next)
        if (next >= TOTAL) return finish()
      }
      last.current = now
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      last.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, leaving])
  const act = ACTS.findIndex((a) => t >= a.from && t < a.to)
  const syncPath = stage.portrait ? 'M 380 580 C 360 600, 400 610, 380 640' : 'M 470 360 C 560 300, 620 300, 690 330'
  const on = (ms) => t >= ms // absolute timeline cue
  const within = (a, b) => t >= a && t < b

  return (
    <div className={clsx('intro', leaving && 'is-leaving', paused && 'is-paused')} role="dialog" aria-modal="true" aria-label="Beside introduction">
      <div className="intro-aurora" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div className="intro-grain" aria-hidden="true" />

      <header className="intro-top">
        <ol className="intro-acts" aria-label="Introduction progress">
          {ACTS.map((a, i) => (
            <li key={a.id} className={clsx(i < act && 'is-done', i === act && 'is-now')}>
              <span className="intro-act-bar">
                <i style={{ transform: `scaleX(${Math.max(0, Math.min(1, (t - a.from) / (a.to - a.from)))})` }} />
              </span>
              <span className="intro-act-label">{a.label}</span>
            </li>
          ))}
        </ol>
        <div className="intro-actions">
          <button type="button" className="intro-btn intro-btn--icon" onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Play' : 'Pause'}>
            {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
          </button>
          <button ref={skipRef} type="button" className="intro-btn" onClick={finish}>
            Skip intro <ArrowRight aria-hidden="true" />
          </button>
        </div>
      </header>

      <p className="sr-only" aria-live="polite">
        {act >= 0 ? SR[act] : ''}
      </p>

      <div className="intro-viewport" aria-hidden="true">
        <div
          className={clsx('intro-stage', stage.portrait && 'is-portrait')}
          style={{ width: stage.w, height: stage.h, transform: `translate(-50%, -50%) scale(${stage.k})` }}
        >
          {/* ACT 1: The problem */}
          <section className={clsx('act act-problem', act === 0 && 'is-on')}>
            <p className={clsx('kicker', on(300) && 'in', on(4300) && 'is-gone')}>Every day, disabled patients are</p>
            <div className={clsx('kinetic', on(4300) && 'is-lifted')}>
              {['Talked over.', 'Rushed.', 'Dismissed.'].map((w, i) => (
                <p key={w} className={clsx('kinetic-word', on(900 + i * 1000) && 'in', on(900 + (i + 1) * 1000) && i < 2 && 'is-past')}>
                  {w}
                </p>
              ))}
            </div>
            <p className={clsx('kicker kicker--after', on(4500) && 'in')}>They leave without being asked, understood, or accommodated.</p>
          </section>

          {/* ACT 2: Meet Sam */}
          <section className={clsx('act act-sam', act === 1 && 'is-on')}>
            <div className={clsx('sam-avatar', on(6700) && 'in')}>
              <span>S</span>
              <i className="ring r1" />
              <i className="ring r2" />
              <i className="ring r3" />
            </div>
            <p className={clsx('sam-line', on(7100) && 'in')}>Sam doesn’t speak.</p>
            <p className={clsx('sam-line mint', on(8100) && 'in')}>But Sam understands everything.</p>
          </section>

          {/* ACT 3: Beside, live */}
          <section className={clsx('act act-beside', act === 2 && 'is-on')}>
            <svg className={clsx('sync-line', on(11000) && 'in')} viewBox={`0 0 ${stage.w} ${stage.h}`} aria-hidden="true">
              <path d={syncPath} />
              <circle r="5" className="sync-dot">
                <animateMotion dur="1.6s" repeatCount="indefinite" path={syncPath} />
              </circle>
            </svg>
            <span className={clsx('sync-label', on(11300) && 'in')}>Synced live</span>

            {/* Phone */}
            <div className={clsx('i-phone', on(10050) && 'in')}>
              <div className="i-phone-screen">
                <div className="i-status">
                  <span>9:41</span>
                  <span className="i-island" />
                  <span className="i-bars">
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
                <p className="i-eyebrow">Dr. Okafor is saying</p>
                <p className="i-caption">
                  I’d like to{' '}
                  <span className={clsx('i-swap', on(13000) && 'is-swapped')}>
                    <span className="i-from">palpate your abdomen.</span>
                    <span className="i-to">
                      gently press on your belly.
                      <small>palpate your abdomen</small>
                    </span>
                  </span>
                </p>
                <p className={clsx('i-eyebrow i-eyebrow--gap', on(14300) && 'in-soft')}>Tap to say</p>
                <div className="i-replies">
                  {['Okay.', 'Please warn me first.', 'Will it hurt?'].map((r, i) => (
                    <span
                      key={r}
                      className={clsx('i-reply', on(14400 + i * 150) && 'in', i === 1 && on(15600) && 'is-pressed', i !== 1 && on(15700) && 'is-dim')}
                    >
                      {r}
                      <Send />
                      {i === 1 && <i className={clsx('ripple', on(15600) && 'go')} />}
                    </span>
                  ))}
                </div>
                <div className="i-tabbar">
                  <span className="is-on">
                    <MessageCircle />
                    Talk
                  </span>
                  <span>
                    <LayoutGrid />
                    Phrases
                  </span>
                  <span>
                    <Activity />
                    Pain
                  </span>
                  <span>
                    <IdCard />
                    My card
                  </span>
                </div>
              </div>
            </div>

            {/* Sound wave from phone to tablet */}
            <div className={clsx('i-voice', on(15900) && 'in')}>
              <Volume2 />
              <span className="wave">
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
              </span>
            </div>

            {/* Tablet */}
            <div className={clsx('i-tablet', on(10350) && 'in')}>
              <div className="i-tablet-screen">
                <div className="i-t-head">
                  <span className="i-t-avatar">S</span>
                  <span>
                    <strong>Sam Rivera</strong>
                    <small>they/them · Nonverbal · Autistic</small>
                  </span>
                  <span className="i-t-sync">
                    <i /> Synced
                  </span>
                </div>
                <div className="i-t-body">
                  <div className="i-t-col">
                    <p className="i-t-label">Live transcript</p>
                    <div className={clsx('i-bubble', on(11600) && 'in')}>
                      <small>You</small>I’d like to <u>palpate</u> your <u>abdomen</u>.
                      <em>2 terms decoded for Sam</em>
                    </div>
                    <div className={clsx('i-bubble i-bubble--sam', on(16400) && 'in')}>
                      <small>
                        Sam · <Volume2 /> spoken aloud
                      </small>
                      Please warn me first.
                    </div>
                  </div>
                  <div className="i-t-col">
                    <p className="i-t-label">Accommodations</p>
                    {['Speak to me directly', 'Warn me before touching', 'Written next steps'].map((a, i) => (
                      <div key={a} className={clsx('i-check', on(10700 + i * 160) && 'in', i === 1 && on(17600) && 'is-done', i === 0 && on(10700) && 'is-done')}>
                        <span className="i-box">
                          <Check />
                        </span>
                        {a}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Callouts */}
            <span className={clsx('callout c1', within(11800, 20500) && 'in')}>
              <Captions /> Live captions
            </span>
            <span className={clsx('callout c2', within(13300, 20500) && 'in')}>
              <Sparkles /> Plain words
            </span>
            <span className={clsx('callout c3', within(15700, 20500) && 'in')}>
              <Volume2 /> One tap. Spoken aloud.
            </span>
            <span className={clsx('callout c4', within(17800, 20500) && 'in')}>
              <ListChecks /> Every request tracked
            </span>
          </section>

          {/* ACT 4: The promise */}
          <section className={clsx('act act-promise', act === 3 && 'is-on')}>
            <div className={clsx('mark', on(20600) && 'in')}>
              <span className="mark-a" />
              <span className="mark-b" />
              <span className="mark-flash" />
            </div>
            <p className="wordmark">
              {'Beside'.split('').map((c, i) => (
                <span key={i} className={clsx(on(21300 + i * 80) && 'in')}>
                  {c}
                </span>
              ))}
            </p>
            <p className={clsx('promise', on(22200) && 'in')}>
              Disabled patients deserve to be heard. <span className="mint">Beside makes sure they are.</span>
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
