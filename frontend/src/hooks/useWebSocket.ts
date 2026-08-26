import { useEffect, useRef, useCallback } from 'react'

const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'

export type WSEvent = {
  type: string
  incident_id: string
  agent: string | null
  status: string | null
  payload: Record<string, unknown>
  timestamp: string
}

export function useWebSocket(onMessage: (evt: WSEvent) => void) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return
    const ws = new WebSocket(`${WS_BASE}/ws/incidents`)
    wsRef.current = ws

    ws.onmessage = (e) => {
      try {
        const data: WSEvent = JSON.parse(e.data)
        onMessage(data)
      } catch {
        // ignore malformed frames
      }
    }

    ws.onclose = () => {
      // Auto-reconnect after 3s
      reconnectTimer.current = setTimeout(connect, 3000)
    }

    ws.onerror = () => ws.close()
  }, [onMessage])

  useEffect(() => {
    connect()
    return () => {
      wsRef.current?.close()
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
    }
  }, [connect])

  const sendPing = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send('ping')
    }
  }, [])

  // Keepalive ping every 20s
  useEffect(() => {
    const id = setInterval(sendPing, 20_000)
    return () => clearInterval(id)
  }, [sendPing])
}
