import { useEffect, useRef, useCallback, useState } from 'react'

const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'

export type WSEvent = {
  type: string
  incident_id: string
  agent: string | null
  status: string | null
  payload: Record<string, unknown>
  timestamp: string
}

export function useWebSocket(onMessage: (evt: WSEvent) => void, incidentId: string = '*') {
  const [isConnected, setIsConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onMessageRef = useRef(onMessage)

  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return
    const path = incidentId === '*' ? '/ws/incidents' : `/ws/incidents/${incidentId}`
    const ws = new WebSocket(`${WS_BASE}${path}`)
    wsRef.current = ws

    ws.onopen = () => {
      setIsConnected(true)
    }

    ws.onmessage = (e) => {
      try {
        const data: WSEvent = JSON.parse(e.data)
        setIsConnected(true)
        onMessageRef.current(data)
      } catch {
        // ignore malformed frames
      }
    }

    ws.onclose = () => {
      setIsConnected(false)
      // Auto-reconnect after 3s
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      reconnectTimer.current = setTimeout(connect, 3000)
    }

    ws.onerror = () => {
      setIsConnected(false)
      ws.close()
    }
  }, [incidentId])

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

  return { isConnected }
}
