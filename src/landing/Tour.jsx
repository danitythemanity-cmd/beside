// The optional 30-second tour: how Beside works, in six steps with small
// pictures of the real interface. Arrow keys or Next/Back to move.
import { useEffect, useState } from 'react'
import clsx from 'clsx'
import {
  ArrowLeft, ArrowRight, Smartphone, Tablet, IdCard, Volume2, HeartHandshake, Check, Video, FileText, Play, Stethoscope, UserRound, Send,
} from 'lucide-react'
import { Button, Sheet } from '../ui/kit.jsx'

const STEPS = [
  {
    title: 'Two screens, one conversation',
    body: 'Beside links the patient’s phone and the clinician’s screen. The patient is heard; the clinician gets live coaching.',
    art: (
      <div className="tour-pair">
        <span className="tour-device">
          <Smartphone /> Patient’s phone
        </span>
        <span className="tour-link" />
        <span className="tour-device">
          <Tablet /> Clinician’s screen
        </span>
      </div>
    ),
  },
  {
    title: 'Make your card',
    body: 'In the Patient app, write how you communicate, what overwhelms you, and what you need. Once, in about two minutes.',
    art: (
      <div className="tour-card">
        <p className="tour-eyebrow">
          <IdCard /> This is me
        </p>
        <p>
          <strong>How I communicate</strong> I answer by tapping my phone. Give me ten seconds.
        </p>
        <p>
          <strong>What I need</strong> Talk to me, not my mom. Warn me before you touch me.
        </p>
      </div>
    ),
  },
  {
    title: 'Start a visit, share the code',
    body: 'The patient taps Start a visit and shows a 4-digit code. The clinician opens the Clinician app and types it in. Connected.',
    art: (
      <div className="tour-code">
        {['4', '8', '1', '9'].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
    ),
  },
  {
    title: 'Talk',
    body: 'Everything said appears as captions, with medical words in plain language. The patient taps an answer, and Beside says it out loud.',
    art: (
      <div className="tour-talk">
        <p className="tour-caption">
          I’d like to <mark>gently press on your belly</mark>.
        </p>
        <div className="tour-replies">
          <span>Okay.</span>
          <span className="is-on">
            Please warn me first. <Send />
          </span>
        </div>
        <p className="tour-voice">
          <Volume2 /> Spoken aloud
        </p>
      </div>
    ),
  },
  {
    title: 'The clinician is coached',
    body: 'If the clinician talks to the companion, rushes, or uses jargon, their screen nudges them. Every request is tracked.',
    art: (
      <div className="tour-coach">
        <p className="tour-nudge">
          <HeartHandshake /> Please speak directly to Sam.
        </p>
        <p className="tour-check">
          <span>
            <Check />
          </span>
          Warn me before touching · provided
        </p>
      </div>
    ),
  },
  {
    title: 'Video, then a clear recap',
    body: 'Visits can happen on video, with captions. At the end, the patient gets next steps in plain words, and the clinician a communication summary.',
    art: (
      <div className="tour-after">
        <span className="tour-video">
          <Video /> Video call · captions on
        </span>
        <span className="tour-recap">
          <FileText /> Next steps, in plain words
        </span>
      </div>
    ),
  },
]

const clamp = (n) => Math.max(0, Math.min(STEPS.length - 1, n))

export default function Tour({ open, onClose }) {
  const [i, setI] = useState(0)
  const last = i === STEPS.length - 1
  const step = STEPS[i]
  const go = (delta) => setI((n) => clamp(n + delta))

  useEffect(() => {
    if (open) setI(0)
  }, [open])

  const onKeyDown = (e) => {
    if (e.target.closest('input, textarea, select')) return
    if (e.key === 'ArrowRight') go(1)
    if (e.key === 'ArrowLeft') go(-1)
  }

  return (
    <Sheet open={open} onClose={onClose} title="Beside in 30 seconds" className="sheet--tour">
      <div className="tour" onKeyDown={onKeyDown}>
        <div key={i} className="tour-art rise" aria-hidden="true">
          {step.art}
        </div>
        <div className="tour-text" aria-live="polite">
          <p className="eyebrow">
            Step {i + 1} of {STEPS.length}
          </p>
          <h3>{step.title}</h3>
          <p className="muted">{step.body}</p>
        </div>

        <div className="tour-dots" role="group" aria-label="Tour steps">
          {STEPS.map((s, n) => (
            <button key={s.title} type="button" className={clsx(n === i && 'is-on')} aria-label={`Step ${n + 1}: ${s.title}`} aria-current={n === i ? 'step' : undefined} onClick={() => setI(n)} />
          ))}
        </div>

        {last ? (
          <div className="tour-end">
            <Button variant="accent" icon={Play} to="/demo?autoplay=1" onClick={onClose}>
              Watch the sample visit
            </Button>
            <div className="row" style={{ '--gap': '8px' }}>
              <Button variant="secondary" icon={UserRound} to="/patient" onClick={onClose}>
                Patient app
              </Button>
              <Button variant="secondary" icon={Stethoscope} to="/clinician" onClick={onClose}>
                Clinician app
              </Button>
            </div>
            <button type="button" className="link" onClick={() => setI(0)}>
              Start the tour over
            </button>
          </div>
        ) : (
          <div className="tour-nav">
            <Button variant="ghost" icon={ArrowLeft} onClick={() => go(-1)} disabled={i === 0}>
              Back
            </Button>
            <Button iconEnd={ArrowRight} onClick={() => go(1)}>
              Next
            </Button>
          </div>
        )}
      </div>
    </Sheet>
  )
}
