// Video call UI shared by the patient and clinician screens.
import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react'
import { Button, Sheet } from './kit.jsx'

function Stream({ stream, muted, mirror, label, className }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream ?? null
  }, [stream])
  return <video ref={ref} className={className} autoPlay playsInline muted={muted} aria-label={label} style={mirror ? { transform: 'scaleX(-1)' } : undefined} />
}

// Whether a stream is currently showing video (the other side may turn their camera off).
function useHasVideo(stream) {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const track = stream?.getVideoTracks()[0]
    if (!track) return setOn(false)
    const update = () => setOn(track.readyState === 'live' && !track.muted && track.enabled)
    update()
    track.addEventListener('mute', update)
    track.addEventListener('unmute', update)
    track.addEventListener('ended', update)
    return () => {
      track.removeEventListener('mute', update)
      track.removeEventListener('unmute', update)
      track.removeEventListener('ended', update)
    }
  }, [stream])
  return on
}

/**
 * The live call: the other person large, yourself small, and three controls.
 * `t` translates labels on the patient side; the clinician side passes English.
 */
export function VideoPanel({ call, name, t }) {
  const remoteVideo = useHasVideo(call.remote)
  const localVideo = call.camOn && Boolean(call.local?.getVideoTracks().length)
  return (
    <section className={clsx('vp', call.phase === 'live' && 'is-live')} aria-label={t('call.title', { name })}>
      <div className="vp-stage">
        {call.remote && <Stream stream={call.remote} label={name} className={clsx('vp-remote', !remoteVideo && 'is-hidden')} />}
        {(!call.remote || !remoteVideo) && (
          <div className="vp-placeholder">
            <span className="vp-avatar" aria-hidden="true">
              {name?.slice(0, 1)}
            </span>
            <span role="status">{call.phase === 'outgoing' ? t('call.calling', { name }) : call.phase === 'connecting' ? t('call.connecting') : name}</span>
          </div>
        )}
        {call.local && (
          <Stream stream={call.local} muted mirror label={t('call.you')} className={clsx('vp-self', !localVideo && 'is-hidden')} />
        )}
        {call.phase === 'live' && (
          <span className="vp-live">
            <span className="dot dot--live" aria-hidden="true" /> {t('call.live')}
          </span>
        )}
      </div>
      <div className="vp-controls">
        <button type="button" className={clsx('vp-btn', !call.micOn && 'is-off')} aria-pressed={!call.micOn} aria-label={t('call.mute')} title={t('call.mute')} onClick={call.toggleMic}>
          {call.micOn ? <Mic aria-hidden="true" /> : <MicOff aria-hidden="true" />}
        </button>
        <button
          type="button"
          className={clsx('vp-btn', !call.camOn && 'is-off')}
          aria-pressed={!call.camOn}
          aria-label={t('call.camera')}
          title={t('call.camera')}
          onClick={call.toggleCam}
          disabled={!call.local?.getVideoTracks().length}
        >
          {call.camOn ? <Video aria-hidden="true" /> : <VideoOff aria-hidden="true" />}
        </button>
        <button type="button" className="vp-btn is-end" aria-label={t('call.end')} title={t('call.end')} onClick={call.hangup}>
          <PhoneOff aria-hidden="true" />
        </button>
      </div>
    </section>
  )
}

/** Ask before turning on the camera. */
export function IncomingCall({ call, name, t }) {
  return (
    <Sheet open={call.phase === 'incoming'} onClose={call.decline} title={t('call.incoming', { name })}>
      <p className="muted">{t('call.incomingHint')}</p>
      <div className="stack" style={{ '--gap': '10px' }}>
        <Button variant="accent" size="lg" icon={Video} onClick={() => call.accept({ video: true })}>
          {t('call.joinVideo')}
        </Button>
        <Button variant="secondary" size="lg" icon={VideoOff} onClick={() => call.accept({ video: false })}>
          {t('call.joinAudio')}
        </Button>
        <Button variant="ghost" onClick={call.decline}>
          {t('call.decline')}
        </Button>
      </div>
    </Sheet>
  )
}

// English labels for the clinician side.
const EN = {
  'call.title': 'Video call with {name}',
  'call.calling': 'Calling {name}…',
  'call.connecting': 'Connecting…',
  'call.you': 'You',
  'call.live': 'Live',
  'call.mute': 'Mute microphone',
  'call.camera': 'Turn camera off',
  'call.end': 'End call',
  'call.incoming': '{name} is starting a video call',
  'call.incomingHint': 'Captions keep running during the call.',
  'call.joinVideo': 'Join with video',
  'call.joinAudio': 'Join without camera',
  'call.decline': 'Not now',
  'call.err.not-linked': 'The other device isn’t connected yet. Wait for “Connected”, then try again.',
  'call.err.media': 'Camera and microphone are blocked. Allow them in your browser, then try again.',
  'call.err.declined': 'The call was declined.',
  'call.err.no-answer': 'No answer. Try again in a moment.',
  'call.err.network': 'The video couldn’t get through between these networks. Try the same Wi-Fi or a phone hotspot.',
  'call.waitLink': 'Video calls start once the other device is connected.',
}
export const tEn = (key, vars) => Object.entries(vars ?? {}).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, v), EN[key] ?? key)
