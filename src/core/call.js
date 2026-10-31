// Live video calls between the patient and clinician: peer to peer over the
// same WebRTC connection the visit already uses. Captions keep running during
// the call, and the patient's tapped replies are spoken on the clinician's side.
import { useCallback, useEffect, useRef, useState } from 'react'

const VIDEO = { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
const AUDIO = { echoCancellation: true, noiseSuppression: true, autoGainControl: true }

export const canCall = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && typeof RTCPeerConnection !== 'undefined'

/**
 * @param {object} rtc  from useVisitStore
 * @returns call state and controls. phase: idle | outgoing | incoming | connecting | live
 */
export function useCall(rtc) {
  const [phase, setPhase] = useState('idle')
  const [local, setLocal] = useState(null)
  const [remote, setRemote] = useState(null)
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [error, setError] = useState('')
  const phaseRef = useRef('idle')
  const media = useRef(null) // active MediaConnection
  const incoming = useRef(null) // pending incoming MediaConnection
  const localRef = useRef(null)

  const go = (p) => {
    phaseRef.current = p
    setPhase(p)
  }

  const reset = useCallback(() => {
    localRef.current?.getTracks().forEach((t) => t.stop())
    localRef.current = null
    try {
      media.current?.close()
    } catch {
      /* already closed */
    }
    media.current = null
    incoming.current = null
    setLocal(null)
    setRemote(null)
    setMicOn(true)
    setCamOn(true)
    go('idle')
  }, [])

  const wire = useCallback(
    (mc) => {
      media.current = mc
      mc.on('stream', (s) => {
        setRemote(s)
        go('live')
      })
      mc.on('close', reset)
      mc.on('error', reset)
    },
    [reset],
  )

  // Incoming calls and call signals from the other side.
  useEffect(() => {
    const offCall = rtc.onCall((mc) => {
      if (phaseRef.current !== 'idle') return mc.close()
      incoming.current = mc
      mc.on('close', () => phaseRef.current === 'incoming' && reset())
      go('incoming')
    })
    const offSignal = rtc.onSignal((msg) => {
      if (msg.action === 'end' || msg.action === 'decline') {
        if (msg.action === 'decline' && phaseRef.current === 'outgoing') setError('The call was declined.')
        reset()
      }
    })
    return () => {
      offCall()
      offSignal()
    }
  }, [rtc, reset])

  useEffect(() => () => localRef.current?.getTracks().forEach((t) => t.stop()), [])

  const getMedia = async (video) => {
    try {
      return await navigator.mediaDevices.getUserMedia({ video: video ? VIDEO : false, audio: AUDIO })
    } catch {
      // Camera blocked or missing: fall back to audio only.
      return navigator.mediaDevices.getUserMedia({ video: false, audio: AUDIO })
    }
  }

  const start = useCallback(
    async ({ video = true } = {}) => {
      setError('')
      const peer = rtc.getPeer()
      const to = rtc.remoteId()
      if (!peer || peer.disconnected || !to) return setError('The other device isn’t connected yet.')
      try {
        const stream = await getMedia(video)
        localRef.current = stream
        setLocal(stream)
        setCamOn(stream.getVideoTracks().length > 0)
        go('outgoing')
        wire(peer.call(to, stream))
        setTimeout(() => {
          if (phaseRef.current !== 'outgoing') return
          rtc.signal({ action: 'end' })
          reset()
          setError('No answer. Try again in a moment.')
        }, 45000)
      } catch {
        setError('Camera and microphone are blocked. Allow them in your browser to start a call.')
        reset()
      }
    },
    [rtc, wire, reset],
  )

  const accept = useCallback(
    async ({ video = true } = {}) => {
      const mc = incoming.current
      if (!mc) return
      setError('')
      try {
        const stream = await getMedia(video)
        localRef.current = stream
        setLocal(stream)
        setCamOn(stream.getVideoTracks().length > 0)
        wire(mc)
        mc.answer(stream)
        incoming.current = null
        if (phaseRef.current === 'incoming') go('connecting')
      } catch {
        setError('Camera and microphone are blocked. Allow them in your browser to join.')
        rtc.signal({ action: 'decline' })
        reset()
      }
    },
    [rtc, wire, reset],
  )

  const decline = useCallback(() => {
    incoming.current?.close()
    rtc.signal({ action: 'decline' })
    reset()
  }, [rtc, reset])

  const hangup = useCallback(() => {
    rtc.signal({ action: 'end' })
    reset()
  }, [rtc, reset])

  const toggleMic = useCallback(() => {
    const tracks = localRef.current?.getAudioTracks() ?? []
    const next = !tracks[0]?.enabled
    tracks.forEach((t) => (t.enabled = next))
    setMicOn(next)
  }, [])

  const toggleCam = useCallback(() => {
    const tracks = localRef.current?.getVideoTracks() ?? []
    if (!tracks.length) return
    const next = !tracks[0].enabled
    tracks.forEach((t) => (t.enabled = next))
    setCamOn(next)
  }, [])

  return { phase, local, remote, micOn, camOn, error, clearError: () => setError(''), start, accept, decline, hangup, toggleMic, toggleCam }
}
