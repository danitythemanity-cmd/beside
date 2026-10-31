import { useEffect, useMemo, useState } from 'react'
import {
  Play, UserRound, Stethoscope, IdCard, Video, Languages, MessageSquareText, HeartHandshake, Activity, Lightbulb, ListChecks, Check,
  Captions, LayoutGrid, Hourglass, Gauge, FileText, Award, History, Smartphone, Tablet, ClipboardCheck, ArrowRight, Volume2, Sparkles,
  Ear, Brain, MessageCircle, Keyboard, Contrast, Type, Lock, Radio, Cpu, Zap, Compass,
} from 'lucide-react'
import { SCRIPT } from '../core/sampleVisit.js'
import { reduceAll, stamp } from '../core/visit.js'
import { setSessionFlag, sessionFlag, KEYS } from '../core/storage.js'
import { Button, Logo } from '../ui/kit.jsx'
import PatientVisit from '../patient/PatientVisit.jsx'
import Intro from './Intro.jsx'
import Tour from './Tour.jsx'

// The hero shows the real patient screen, frozen mid-visit.
function heroState() {
  const t0 = Date.now() - 4 * 60 * 1000 - 37 * 1000
  return reduceAll([
    stamp({ ...SCRIPT[0].event, at: t0 }),
    stamp({ type: 'card/share', at: t0 + 1000 }),
    stamp({
      type: 'line/add',
      id: 'hero',
      who: 'clinician',
      to: 'patient',
      at: t0 + 2000,
      text: 'I’d like to palpate your abdomen, then order a CBC.',
      replies: ['Okay.', 'Please warn me before you touch me.', 'Will it hurt?'],
    }),
  ])
}
const NOOP_ACTIONS = new Proxy({}, { get: () => () => {} })

// Fade sections in as they scroll into view.
function useReveal(active) {
  useEffect(() => {
    if (!active) return
    const els = [...document.querySelectorAll('[data-reveal]')]
    if (!('IntersectionObserver' in window)) return els.forEach((el) => el.classList.add('is-in'))
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-in')
            io.unobserve(e.target)
          }
        }),
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [active])
}

const PROBLEMS = [
  {
    word: 'Talked over.',
    body: 'Clinicians speak to the companion instead of the patient, as if they weren’t in the room.',
    fix: 'Talk-to-me nudges redirect the clinician, live.',
    icon: HeartHandshake,
  },
  {
    word: 'Rushed.',
    body: 'Answers take time to type or tap. Visits move on before the patient can respond.',
    fix: 'One-tap replies, and a “Sam is answering” cue that asks for patience.',
    icon: Hourglass,
  },
  {
    word: 'Dismissed.',
    body: 'Pain that doesn’t look “typical” is missed. Requests for accommodations are forgotten.',
    fix: 'A pain translator, and a log of every request and whether it was met.',
    icon: Activity,
  },
]

const WHO = [
  { icon: MessageCircle, title: 'Nonverbal and AAC users', body: 'Predicted replies, a phrase board, and type-to-speak.' },
  { icon: Sparkles, title: 'Autistic patients', body: 'Sensory needs on the card. Warnings before touch.' },
  { icon: Ear, title: 'Deaf and hard of hearing', body: 'Large live captions, in person or on video.' },
  { icon: MessageSquareText, title: 'Speech disabilities', body: 'Beside speaks clearly for you, at your pace.' },
  { icon: Brain, title: 'Cognitive disabilities', body: 'Plain words, “say it simpler,” and a written recap.' },
]

const FEATURE_GROUPS = [
  {
    title: 'On the patient’s phone',
    icon: Smartphone,
    items: [
      { icon: Captions, title: 'Live captions and video', body: 'Every word in large, clear text, in the room or on a video visit.' },
      { icon: Languages, title: 'Plain words, 15 languages', body: 'Jargon is swapped for everyday words, in the patient’s language.' },
      { icon: MessageSquareText, title: 'One-tap replies', body: 'Three likely answers after each question, spoken aloud.' },
      { icon: LayoutGrid, title: 'Phrase board', body: 'Fifteen essentials, from “Wait, please” to “Too bright.”' },
      { icon: Activity, title: 'Pain translator', body: 'A body map and a few taps become a clinical summary.' },
      { icon: Lightbulb, title: 'Say it simpler', body: 'Rewrites the last sentence in plain words, instantly.' },
    ],
  },
  {
    title: 'On the clinician’s screen',
    icon: Tablet,
    items: [
      { icon: IdCard, title: '“This is me” card', body: 'How the patient communicates, in their own words, before you begin.' },
      { icon: HeartHandshake, title: 'Talk-to-me nudge', body: 'A gentle prompt when you address the companion instead.' },
      { icon: Hourglass, title: 'Patience cue', body: 'Shows when the patient is composing a reply. Silence is okay.' },
      { icon: Gauge, title: 'Understanding meter', body: 'Repeated “simpler” taps ask you to slow down and rephrase.' },
      { icon: ClipboardCheck, title: 'Accommodations checklist', body: 'Every request, checked off as it is provided.' },
      { icon: Video, title: 'Video visits', body: 'Peer-to-peer video with captions, and the patient’s voice in your ear.' },
    ],
  },
  {
    title: 'After the visit',
    icon: FileText,
    items: [
      { icon: FileText, title: 'Plain-language recap', body: 'What happened and what’s next, read aloud, in the patient’s language.' },
      { icon: ListChecks, title: 'Accommodations log', body: 'What was asked for, and whether it was provided.' },
      { icon: Award, title: 'Communication coaching', body: 'Direct address, jargon used, and tips for next time.' },
      { icon: History, title: 'Visit history', body: 'Every recap saved on the patient’s own device.' },
    ],
  },
]

export default function Home() {
  const [intro, setIntro] = useState(() => !sessionFlag(KEYS.intro))
  const [tour, setTour] = useState(false)
  const hero = useMemo(heroState, [])
  useReveal(!intro)

  if (intro) {
    return (
      <Intro
        onDone={() => {
          setSessionFlag(KEYS.intro)
          setIntro(false)
        }}
      />
    )
  }

  return (
    <div className="ld">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="ld-nav">
        <Logo />
        <nav className="ld-links" aria-label="Sections">
          <a href="#problem">The problem</a>
          <a href="#how">How it works</a>
          <a href="#features">Features</a>
          <a href="#try">Try it</a>
        </nav>
        <div className="row" style={{ '--gap': '8px' }}>
          <Button variant="ghost" size="sm" icon={Compass} onClick={() => setTour(true)}>
            Tour
          </Button>
          <Button variant="ghost" size="sm" icon={Stethoscope} to="/clinician">
            Clinician
          </Button>
          <Button size="sm" icon={UserRound} to="/patient">
            Patient app
          </Button>
        </div>
      </header>

      <main id="main">
        <section className="ld-hero" aria-labelledby="hero-h">
          <div className="ld-hero-copy">
            <p className="ld-pill ld-in" style={{ '--d': '0ms' }}>
              <span className="dot dot--mint dot--live" aria-hidden="true" /> Accessibility in the exam room
            </p>
            <h1 id="hero-h" className="ld-in" style={{ '--d': '80ms' }} data-route-focus>
              Disabled patients are talked over, rushed, and dismissed. <span className="mint">Beside makes sure they are heard.</span>
            </h1>
            <p className="ld-lede ld-in" style={{ '--d': '160ms' }}>
              A communication companion for patients who are nonverbal, autistic, deaf, or cognitively disabled. It gives them a voice at the
              doctor, and helps clinicians communicate better, in real time.
            </p>
            <div className="ld-ctas ld-in" style={{ '--d': '240ms' }}>
              <Button variant="accent" size="xl" icon={Play} to="/demo?autoplay=1">
                Watch a 75-second visit
              </Button>
              <Button variant="secondary" size="xl" to="#try" iconEnd={ArrowRight} onClick={(e) => { e.preventDefault(); document.getElementById('try')?.scrollIntoView({ behavior: 'smooth' }) }}>
                Try it yourself
              </Button>
            </div>
            <button type="button" className="ld-tour-btn ld-in" style={{ '--d': '300ms' }} onClick={() => setTour(true)}>
              <Compass aria-hidden="true" /> New here? Take the 30-second tour
            </button>
            <ul className="ld-meta ld-in" style={{ '--d': '360ms' }} aria-label="Highlights">
              <li>
                <Zap aria-hidden="true" /> No sign-up
              </li>
              <li>
                <Volume2 aria-hidden="true" /> Sound on for Sam’s voice
              </li>
              <li>
                <Languages aria-hidden="true" /> 15 languages
              </li>
            </ul>
          </div>

          <div className="ld-hero-art" aria-hidden="true" inert="">
            <div className="ld-glow" />
            <div className="ld-phone">
              <div className="ld-phone-screen">
                <PatientVisit visit={hero} actions={NOOP_ACTIONS} embedded reduceMotion />
              </div>
            </div>
            <div className="ld-float ld-float--nudge">
              <span className="ld-float-icon">
                <HeartHandshake />
              </span>
              <div>
                <strong>Please speak directly to Sam.</strong>
                <span>Clinician’s screen</span>
              </div>
            </div>
            <div className="ld-float ld-float--voice">
              <Volume2 />
              <span>“Please warn me before you touch me.”</span>
            </div>
            <div className="ld-float ld-float--check">
              <span className="ld-check">
                <Check />
              </span>
              <span>Warn before touching · provided</span>
            </div>
          </div>
        </section>

        <section className="ld-section" id="problem" aria-labelledby="problem-h">
          <header className="ld-head" data-reveal>
            <p className="ld-num">01 · The problem</p>
            <h2 id="problem-h">What a doctor’s visit often feels like, and what Beside changes.</h2>
          </header>
          <ul className="ld-problems">
            {PROBLEMS.map((p, i) => (
              <li key={p.word} data-reveal style={{ '--d': `${i * 90}ms` }}>
                <p className="ld-problem-word">{p.word}</p>
                <p className="ld-problem-body">{p.body}</p>
                <p className="ld-problem-fix">
                  <p.icon aria-hidden="true" />
                  <span>
                    <strong>Beside:</strong> {p.fix}
                  </span>
                </p>
              </li>
            ))}
          </ul>
          <p className="ld-stat" data-reveal>
            <strong>Up to 1 in 4 adults in the U.S. has a disability.</strong> <span className="faint">Source: CDC</span>
          </p>
        </section>

        <section className="ld-section" aria-labelledby="who-h">
          <header className="ld-head" data-reveal>
            <p className="ld-num">02 · Who it’s for</p>
            <h2 id="who-h">Built for the patients the system talks over.</h2>
          </header>
          <ul className="ld-who">
            {WHO.map((w, i) => (
              <li key={w.title} data-reveal style={{ '--d': `${i * 70}ms` }}>
                <w.icon aria-hidden="true" />
                <h3>{w.title}</h3>
                <p>{w.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="ld-section" id="how" aria-labelledby="how-h">
          <header className="ld-head" data-reveal>
            <p className="ld-num">03 · How it works</p>
            <h2 id="how-h">Two screens. One conversation. Everyone heard.</h2>
          </header>
          <ol className="ld-steps">
            {[
              ['Before', 'Share your card', 'The patient starts a visit and shares a 4-digit code. Their “This is me” card appears on the clinician’s screen.', IdCard],
              ['During', 'Talk, in person or on video', 'Speech becomes plain-language captions. The patient answers with one tap, and Beside speaks for them.', Captions],
              ['After', 'Leave with a plan', 'Next steps in plain words for the patient. What was asked for, and what was provided, for the clinic.', FileText],
            ].map(([phase, title, body, Icon], i) => (
              <li key={phase} data-reveal style={{ '--d': `${i * 110}ms` }}>
                <span className="ld-step-top">
                  <span className="ld-step-num">{i + 1}</span>
                  <span className="ld-step-phase">{phase}</span>
                  <Icon aria-hidden="true" />
                </span>
                <h3>{title}</h3>
                <p>{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="ld-section" id="features" aria-labelledby="feat-h">
          <header className="ld-head" data-reveal>
            <p className="ld-num">04 · Features</p>
            <h2 id="feat-h">Everything a hard appointment needs, where it’s needed.</h2>
          </header>
          <div className="ld-groups">
            {FEATURE_GROUPS.map((g, gi) => (
              <section key={g.title} className="ld-group" aria-labelledby={`grp-${gi}`} data-reveal style={{ '--d': `${gi * 100}ms` }}>
                <h3 id={`grp-${gi}`} className="ld-group-title">
                  <g.icon aria-hidden="true" />
                  {g.title}
                </h3>
                <ul>
                  {g.items.map((f) => (
                    <li key={f.title}>
                      <span className="ld-feature-icon">
                        <f.icon aria-hidden="true" />
                      </span>
                      <span>
                        <strong>{f.title}</strong>
                        <span>{f.body}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </section>

        <section className="ld-section" id="try" aria-labelledby="try-h">
          <header className="ld-head" data-reveal>
            <p className="ld-num">05 · Try it</p>
            <h2 id="try-h">Three ways in.</h2>
          </header>
          <ul className="ld-paths">
            <li className="ld-path ld-path--demo" data-reveal>
              <span className="ld-path-icon">
                <Play aria-hidden="true" />
              </span>
              <h3>Watch the sample visit</h3>
              <p>Sam’s 75-second appointment, played on the real patient and clinician screens, with narration. No setup.</p>
              <Button variant="accent" to="/demo?autoplay=1" iconEnd={ArrowRight}>
                Watch now
              </Button>
            </li>
            <li className="ld-path" data-reveal style={{ '--d': '90ms' }}>
              <span className="ld-path-icon">
                <Smartphone aria-hidden="true" />
              </span>
              <h3>Patient app</h3>
              <p>Build your “This is me” card, choose your language, and start a visit with a 4-digit code.</p>
              <Button variant="secondary" to="/patient" iconEnd={ArrowRight}>
                Open patient app
              </Button>
            </li>
            <li className="ld-path" data-reveal style={{ '--d': '180ms' }}>
              <span className="ld-path-icon">
                <Tablet aria-hidden="true" />
              </span>
              <h3>Clinician app</h3>
              <p>Enter the patient’s code to join. See their card, live captions, nudges, and start a video call.</p>
              <Button variant="secondary" to="/clinician" iconEnd={ArrowRight}>
                Open clinician app
              </Button>
            </li>
          </ul>
          <p className="ld-tip" data-reveal>
            <Radio aria-hidden="true" /> Tip: open the patient app on your phone and the clinician app on a laptop, or in two browser tabs, to see them sync live.
          </p>
        </section>

        <section className="ld-section" aria-labelledby="built-h">
          <header className="ld-head" data-reveal>
            <p className="ld-num">06 · Built right</p>
            <h2 id="built-h">An accessibility tool has to be accessible first.</h2>
          </header>
          <div className="ld-split">
            <div data-reveal>
              <h3>Accessible by default</h3>
              <ul className="ld-checks">
                <li>
                  <Keyboard aria-hidden="true" /> WCAG 2.2 AA. Full keyboard and screen reader support.
                </li>
                <li>
                  <Contrast aria-hidden="true" /> Dark, light, and high-contrast themes.
                </li>
                <li>
                  <Type aria-hidden="true" /> Four text sizes. Atkinson Hyperlegible for reading.
                </li>
                <li>
                  <Languages aria-hidden="true" /> Right-to-left layouts for Arabic and Persian.
                </li>
              </ul>
            </div>
            <div data-reveal style={{ '--d': '90ms' }}>
              <h3>Engineered to be trusted</h3>
              <ul className="ld-checks">
                <li>
                  <Cpu aria-hidden="true" /> Event-sourced visit engine. Every screen reads the same log.
                </li>
                <li>
                  <Radio aria-hidden="true" /> Video and conversation travel peer to peer, encrypted.
                </li>
                <li>
                  <Sparkles aria-hidden="true" /> Fast AI on Groq, with an offline fallback for everything.
                </li>
                <li>
                  <Lock aria-hidden="true" /> No accounts. Cards and recaps stay on the patient’s device.
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className="ld-final" aria-labelledby="final-h" data-reveal>
          <h2 id="final-h">See Sam’s visit. Then run your own.</h2>
          <div className="ld-ctas">
            <Button variant="accent" size="lg" icon={Play} to="/demo?autoplay=1">
              Watch the sample visit
            </Button>
            <Button variant="secondary" size="lg" icon={UserRound} to="/patient">
              Patient app
            </Button>
            <Button variant="secondary" size="lg" icon={Stethoscope} to="/clinician">
              Clinician app
            </Button>
          </div>
        </section>
      </main>

      <Tour open={tour} onClose={() => setTour(false)} />

      <footer className="ld-foot">
        <Logo />
        <p className="small faint">Sam, Ana, and Dr. Okafor are fictional. Beside is a hackathon project, not a medical device.</p>
        <button type="button" className="link" onClick={() => setIntro(true)}>
          Replay intro
        </button>
      </footer>
    </div>
  )
}
