import { useState, useCallback, useEffect, useRef } from 'react'
import { listIncidents, getAllLogs } from '../services/api'
import type { Incident, LogEntry } from '../services/api'
import { useWebSocket } from '../hooks/useWebSocket'
import type { WSEvent } from '../hooks/useWebSocket'
import { IncidentCard } from '../components/IncidentCard'
import { SimulateButton } from '../components/SimulateButton'
import { LiveLogViewer } from '../components/LiveLogViewer'

function MTTD(incidents: Incident[]) {
  const resolved = incidents.filter((i) => i.resolved_at)
  if (!resolved.length) return null
  const avg =
    resolved.reduce((sum, i) => {
      return sum + (new Date(i.resolved_at!).getTime() - new Date(i.created_at).getTime())
    }, 0) / resolved.length
  return Math.round(avg / 1000)
}

export default function Dashboard() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showLogs, setShowLogs] = useState(true)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchIncidents = useCallback(async () => {
    try {
      const data = await listIncidents()
      setIncidents(data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchLogs = useCallback(async () => {
    try {
      const initialLogs = await getAllLogs()
      setLogs(initialLogs)
    } catch {
      // ignore
    }
  }, [])

  // Poll every 3s as fallback
  useEffect(() => {
    fetchIncidents()
    fetchLogs()
    pollRef.current = setInterval(fetchIncidents, 3000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [fetchIncidents, fetchLogs])

  const handleWS = useCallback(
    (evt: WSEvent) => {
      // Handle incoming logs
      if (evt.type === 'log.entry' && evt.payload) {
        const entry = evt.payload as unknown as LogEntry
        setLogs((prev) => {
          if (prev.some((l) => l.id === entry.id)) return prev
          return [...prev.slice(-400), entry]
        })
      } else if (evt.type === 'connection.established' && evt.payload?.initial_logs) {
        const inits = evt.payload.initial_logs as LogEntry[]
        setLogs((prev) => {
          const ids = new Set(prev.map((l) => l.id))
          const fresh = inits.filter((l) => !ids.has(l.id))
          return [...fresh, ...prev].slice(-400)
        })
      }

      // Refresh incident list on any interesting event
      if (
        [
          'status.changed',
          'agent.completed',
          'agent.started',
          'orchestrator.started',
          'connection.established',
        ].includes(evt.type)
      ) {
        fetchIncidents()
      }
    },
    [fetchIncidents]
  )

  const { isConnected: wsConnected } = useWebSocket(handleWS)

  const active = incidents.filter((i) => !['RESOLVED', 'FAILED', 'ESCALATED'].includes(i.status))
  const resolved = incidents.filter((i) => i.status === 'RESOLVED')
  const avgMTTR = MTTD(incidents)

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-10 shadow-xs">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-sm font-bold text-white shadow-sm shadow-blue-500/30">
              A
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 tracking-tight">AegisOps</h1>
              <p className="text-xs text-slate-500">Autonomous Incident Response</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* WS status indicator */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 px-2.5 py-1 bg-slate-100 rounded-lg border border-slate-200">
              <span
                className={`h-2 w-2 rounded-full ${
                  wsConnected
                    ? 'bg-emerald-500 shadow-[0_0_6px_rgba(52,211,153,0.8)]'
                    : 'bg-slate-400'
                }`}
              />
              {wsConnected ? 'Live' : 'Connecting…'}
            </div>

            {/* Toggle Logs View */}
            <button
              onClick={() => setShowLogs((prev) => !prev)}
              className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-all cursor-pointer ${
                showLogs
                  ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-xs'
                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:text-slate-900'
              }`}
            >
              📟 Live Console {showLogs ? 'ON' : 'OFF'}
            </button>

            {/* Simulate button */}
            <SimulateButton onSimulated={fetchIncidents} />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Stats strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Incidents', value: incidents.length, color: 'text-slate-900' },
            {
              label: 'Active',
              value: active.length,
              color: active.length > 0 ? 'text-amber-600' : 'text-slate-500',
            },
            { label: 'Resolved', value: resolved.length, color: 'text-emerald-600' },
            { label: 'Avg MTTR', value: avgMTTR != null ? `${avgMTTR}s` : '—', color: 'text-blue-600' },
          ].map((stat) => (
            <div key={stat.label} className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
              <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Live Logs Stream Console */}
        {showLogs && (
          <section>
            <LiveLogViewer
              logs={logs}
              title="Global Live Operations Stream & Telemetry"
              maxHeight="max-h-[360px]"
              onClear={() => setLogs([])}
            />
          </section>
        )}

        {/* Active incidents */}
        {active.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <span>🔴 Active Incidents</span>
            </h2>
            <div className="space-y-3">
              {active.map((i) => (
                <IncidentCard key={i.id} incident={i} />
              ))}
            </div>
          </section>
        )}

        {/* All incidents */}
        <section>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <span>📋 Incident History</span>
          </h2>
          {loading ? (
            <div className="text-sm text-slate-500 animate-pulse">Loading incidents…</div>
          ) : incidents.length === 0 ? (
            <div className="text-center py-16 text-slate-500 bg-white rounded-xl border border-slate-200">
              <div className="text-4xl mb-3">🌿</div>
              <p className="text-sm font-medium text-slate-600">
                No incidents yet. Click <strong className="text-slate-900">Simulate Incident</strong> to start.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {incidents.map((i) => (
                <IncidentCard key={i.id} incident={i} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
