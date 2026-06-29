import { useEffect, useRef, useState } from 'react'
import { tokenStore } from './api'

export type LiveStatus = 'connecting' | 'open' | 'closed'

export interface LiveEvent {
  event: string
  payload: any
}

type Handler = (event: LiveEvent) => void

/**
 * Subscribe to the backend live-order WebSocket (`/ws/live/`).
 *
 * The server authenticates the handshake from a `?token=` query param and then
 * pushes `{event, payload}` frames for every order transition relevant to the
 * signed-in user's role. We auto-reconnect with a short backoff so a dropped
 * Wi-Fi link on a tablet self-heals without a reload.
 */
export function useLiveSocket(onEvent: Handler): LiveStatus {
  const [status, setStatus] = useState<LiveStatus>('connecting')
  // Keep the latest handler without forcing a reconnect each render.
  const handlerRef = useRef(onEvent)
  handlerRef.current = onEvent

  useEffect(() => {
    let closedByUs = false
    let socket: WebSocket | null = null
    let retry: ReturnType<typeof setTimeout> | undefined

    function connect() {
      const token = tokenStore.access
      if (!token) return
      // Production (Vercel): VITE_WS_URL points at the Render backend
      // (wss://<backend>.onrender.com). Local dev: current host (Vite proxies /ws).
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
      const origin = import.meta.env.VITE_WS_URL ?? `${proto}://${window.location.host}`
      const url = `${origin}/ws/live/?token=${token}`

      setStatus('connecting')
      socket = new WebSocket(url)

      socket.onopen = () => setStatus('open')

      socket.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data) as LiveEvent
          handlerRef.current(data)
        } catch {
          /* ignore malformed frames */
        }
      }

      socket.onclose = () => {
        setStatus('closed')
        if (!closedByUs) retry = setTimeout(connect, 2000)
      }

      // An error is always followed by a close, so reconnect is handled there.
      socket.onerror = () => socket?.close()
    }

    connect()

    return () => {
      closedByUs = true
      if (retry) clearTimeout(retry)
      socket?.close()
    }
  }, [])

  return status
}
