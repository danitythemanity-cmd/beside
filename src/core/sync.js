// Live sync between the patient's phone and the clinician's device.
//
// Each visit is an event log keyed by a 4-digit code. Two transports carry the
// same messages (event, hello -> snapshot, presence):
//   - BroadcastChannel: tabs in the same browser, instant and offline.
//   - WebRTC data channel (PeerJS signaling): separate devices, peer to peer,
//     encrypted. The patient's phone hosts; clinicians connect to it.
// Logs merge by event id, so duplicates and ordering don't matter. The same
// peer connection carries video calls (see call.js).
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { Peer } from 'peerjs'
import { reducer, createVisit, stamp, isLocalEvent, newId } from './visit.js'
import { read, write, KEYS } from './storage.js'

export const hostId = (code) => `beside-v1-visit-${code}`

function fromEvents(events, ui) {
  const state = events.reduce(reducer, createVisit())
  return { events, ids: new Set(events.map((e) => e.id)), state: ui ? { ...state, ui } : state }
}

const byTime = (a, b) => a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

function storeReducer(store, action) {
  switch (action.kind) {
    case 'apply': {
      const e = action.event
      if (isLocalEvent(e)) return { ...store, state: reducer(store.state, e) }
      if (store.ids.has(e.id)) return store
      const last = store.events.at(-1)
      if (last && e.at < last.at) return fromEvents([...store.events, e].sort(byTime), store.state.ui)
      const ids = new Set(store.ids)
      ids.add(e.id)
      return { events: [...store.events, e], ids, state: reducer(store.state, e) }
    }
    case 'merge': {
      const fresh = (action.events ?? []).filter((e) => e?.id && e.type && !store.ids.has(e.id))
      if (!fresh.length) return store
      return fromEvents([...store.events, ...fresh].sort(byTime), store.state.ui)
    }
    case 'reset':
      return fromEvents([])
    default:
      return store
  }
}

/**
 * Event-sourced visit store.
 * @param {{ code?: string, role: 'patient'|'clinician'|'theater', sync?: boolean }} opts
 * @returns {{ state, events, dispatch, reset, getState, peers: string[], net: string, rtc: object }}
 */
export function useVisitStore({ code = '', role, sync = true }) {
  const live = Boolean(sync && code)
  const [store, apply] = useReducer(storeReducer, null, () => fromEvents(live ? read(KEYS.visit(code), []) : []))
  const storeRef = useRef(store)
  storeRef.current = store
  const selfId = useMemo(() => newId('d'), [])
  const [peers, setPeers] = useState({})
  const [net, setNet] = useState(live ? 'connecting' : 'off') // off | connecting | online | local
  const [, tick] = useState(0)

  const channel = useRef(null) // BroadcastChannel
  const peerRef = useRef(null) // PeerJS peer
  const conns = useRef(new Map()) // remote peer id -> DataConnection
  const callListeners = useRef(new Set())
  const signalListeners = useRef(new Set())

  const seen = useCallback((r) => setPeers((p) => ({ ...p, [r]: Date.now() })), [])
  const gone = useCallback(
    (r) =>
      setPeers((p) => {
        const n = { ...p }
        delete n[r]
        return n
      }),
    [],
  )

  // One handler for both transports. `reply` answers the sender; `relay` forwards to everyone else.
  const handle = useCallback(
    (data, reply, relay) => {
      if (!data || data.from === selfId) return
      switch (data.kind) {
        case 'event':
          apply({ kind: 'apply', event: data.event })
          relay?.(data)
          break
        case 'hello':
          seen(data.role)
          reply({ kind: 'snapshot', from: selfId, role, events: storeRef.current.events })
          break
        case 'snapshot':
          seen(data.role)
          apply({ kind: 'merge', events: data.events })
          break
        case 'here':
          seen(data.role)
          break
        case 'bye':
          gone(data.role)
          break
        case 'call':
          signalListeners.current.forEach((fn) => fn(data))
          break
        default:
      }
    },
    [selfId, role, seen, gone],
  )

  const sendAll = useCallback((msg, except) => {
    channel.current?.postMessage(msg)
    for (const [id, c] of conns.current) if (id !== except && c.open) c.send(msg)
  }, [])

  // Persist the synced log so reloads and late joiners catch up.
  useEffect(() => {
    if (live) write(KEYS.visit(code), store.events)
  }, [live, code, store.events])

  // Same-browser transport.
  useEffect(() => {
    if (!live) return
    const onStorage = (ev) => {
      if (ev.key === KEYS.visit(code)) apply({ kind: 'merge', events: read(KEYS.visit(code), []) })
    }
    window.addEventListener('storage', onStorage)
    let ch = null
    if (typeof BroadcastChannel !== 'undefined') {
      ch = new BroadcastChannel(`beside:${code}`)
      channel.current = ch
      ch.onmessage = ({ data }) => handle(data, (m) => ch.postMessage(m))
      ch.postMessage({ kind: 'hello', from: selfId, role })
    }
    return () => {
      window.removeEventListener('storage', onStorage)
      ch?.close()
      channel.current = null
    }
  }, [live, code, role, selfId, handle])

  // Cross-device transport.
  useEffect(() => {
    if (!live || role === 'theater') return
    let disposed = false
    let retry = 0
    let peer = null

    const attach = (conn) => {
      conn.on('open', () => {
        conns.current.set(conn.peer, conn)
        conn.send({ kind: 'hello', from: selfId, role })
        setNet('online')
      })
      conn.on('data', (data) =>
        handle(
          data,
          (m) => conn.send(m),
          role === 'patient' ? (m) => sendAll(m, conn.peer) : null,
        ),
      )
      conn.on('close', () => {
        conns.current.delete(conn.peer)
        if (!disposed && role !== 'patient') retry = setTimeout(connect, 2000)
      })
      conn.on('error', () => conn.close())
    }

    const connect = () => {
      if (disposed || !peer || peer.destroyed) return
      attach(peer.connect(hostId(code), { reliable: true, serialization: 'json' }))
    }

    const create = () => {
      if (disposed) return
      peer = role === 'patient' ? new Peer(hostId(code), { debug: 0 }) : new Peer({ debug: 0 })
      peerRef.current = peer
      peer.on('open', () => {
        setNet(role === 'patient' ? 'online' : 'connecting')
        if (role !== 'patient') connect()
      })
      peer.on('connection', attach)
      peer.on('call', (mc) => callListeners.current.forEach((fn) => fn(mc)))
      peer.on('disconnected', () => {
        if (!disposed && !peer.destroyed) peer.reconnect()
      })
      peer.on('error', (err) => {
        if (disposed) return
        if (err.type === 'peer-unavailable') {
          // The patient's phone isn't online yet; keep trying quietly.
          retry = setTimeout(connect, 3000)
        } else if (err.type === 'unavailable-id') {
          // Our previous session still holds the id for a few seconds after a reload.
          peer.destroy()
          retry = setTimeout(create, 3000)
        } else if (['network', 'server-error', 'socket-error', 'socket-closed', 'browser-incompatible'].includes(err.type)) {
          setNet('local')
          retry = setTimeout(() => {
            peer.destroy()
            create()
          }, 8000)
        }
      })
    }
    create()

    return () => {
      disposed = true
      clearTimeout(retry)
      for (const c of conns.current.values()) {
        try {
          c.send({ kind: 'bye', from: selfId, role })
        } catch {
          /* closing anyway */
        }
      }
      conns.current.clear()
      peer?.destroy()
      peerRef.current = null
    }
  }, [live, code, role, selfId, handle, sendAll])

  // Presence pings on both transports.
  useEffect(() => {
    if (!live) return
    const ping = setInterval(() => {
      sendAll({ kind: 'here', from: selfId, role })
      tick((n) => n + 1)
    }, 3000)
    const bye = () => sendAll({ kind: 'bye', from: selfId, role })
    window.addEventListener('pagehide', bye)
    return () => {
      bye()
      clearInterval(ping)
      window.removeEventListener('pagehide', bye)
    }
  }, [live, role, selfId, sendAll])

  const dispatch = useCallback(
    (event) => {
      const e = stamp(event)
      apply({ kind: 'apply', event: e })
      if (!isLocalEvent(e)) sendAll({ kind: 'event', from: selfId, event: e })
      return e
    },
    [selfId, sendAll],
  )

  const reset = useCallback(() => apply({ kind: 'reset' }), [])
  const getState = useCallback(() => storeRef.current.state, [])

  // What a video call needs: the peer, who to call, and a side channel for call signals.
  const rtc = useMemo(
    () => ({
      getPeer: () => peerRef.current,
      remoteId: () => (role === 'patient' ? [...conns.current.keys()].at(-1) ?? null : hostId(code)),
      onCall: (fn) => {
        callListeners.current.add(fn)
        return () => callListeners.current.delete(fn)
      },
      onSignal: (fn) => {
        signalListeners.current.add(fn)
        return () => signalListeners.current.delete(fn)
      },
      signal: (msg) => sendAll({ kind: 'call', from: selfId, role, ...msg }),
    }),
    [role, code, selfId, sendAll],
  )

  const now = Date.now()
  const connected = Object.entries(peers)
    .filter(([r, t]) => r !== role && now - t < 9000)
    .map(([r]) => r)

  return { state: store.state, events: store.events, dispatch, reset, getState, peers: connected, net, rtc }
}
