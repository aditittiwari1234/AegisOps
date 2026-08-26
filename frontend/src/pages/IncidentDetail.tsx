import { useState, useCallback, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getIncident, getIncidentLogs } from '../services/api'
import type { Incident, LogEntry } from '../services/api'
import { useWebSocket } from '../hooks/useWebSocket'
import type { WSEvent } from '../hooks/useWebSocket'
import { AgentTimeline } from '../components/AgentTimeline'
import { SeverityBadge, StatusBadge } from '../components/StatusBadge'
import { LiveLogViewer } from '../components/LiveLogViewer'

function formatTs(ts: string) {
  return new Date(ts).toLocaleTimeString('en-US', { hour12: false })
}

function EventFeed({ events }: { events: Incident['events'] }) {
  return (
    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
      {[...events].reverse().map((ev) => (
        <div key={ev.id} className="flex gap-2 text-xs">
          <span className="text-slate-500 font-mono flex-shrink-0">{formatTs(ev.ts)}</span>
          <span
            className={`flex-1 ${
              ev.event_type === 'resolved'
                ? 'text-emerald-700 font-medium'
                : ev.event_type === 'status_change'
                ? 'text-blue-700'
                : ev.event_type.includes('failed')
                ? 'text-rose-700 font-medium'
                : 'text-slate-700'
            }`}
          >
            {ev.message}
          </span>
        </div>
      ))}
      {events.length === 0 && <p className="text-xs text-slate-500">No events yet…</p>}
    </div>
  )
}

export default function IncidentDetail() {
  const { id } = useParams<{ id: string }>()
  const [incident, setIncident] = useState<Incident | null>(null)
  const [liveEvents, setLiveEvents] = useState<WSEvent[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [activeTab, setActiveTab] = useState<'pipeline' | 'logs' | 'split'>('split')
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!id) return
    try {
      const data = await getIncident(id)
      setIncident(data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [id])

  const fetchLogs = useCallback(async () => {
    if (!id) return
    try {
      const initialLogs = await getIncidentLogs(id)
      setLogs(initialLogs)
    } catch {
      // ignore
    }
  }, [id])

  useEffect(() => {
    fetch()
    fetchLogs()
    const timer = setInterval(fetch, 2000)
    return () => clearInterval(timer)
  }, [fetch, fetchLogs])

  const handleWS = useCallback(
    (evt: WSEvent) => {
      if (evt.incident_id !== id && evt.incident_id !== '*') return
      setLiveEvents((prev) => [...prev.slice(-50), evt])

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

      if (['agent.completed', 'status.changed', 'agent.started', 'orchestrator.started'].includes(evt.type)) {
        fetch()
      }
    },
    [id, fetch]
  )

  useWebSocket(handleWS, id)

  if (loading)
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 text-sm font-sans">
        Loading incident…
      </div>
    )
  if (!incident)
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 font-sans">
        Incident not found.{' '}
        <Link to="/" className="ml-2 text-blue-600 underline">
          Back to Dashboard
        </Link>
      </div>
    )

  const isResolved = incident.status === 'RESOLVED'
  const duration = incident.resolved_at
    ? Math.round(
        (new Date(incident.resolved_at).getTime() - new Date(incident.created_at).getTime()) / 1000
      )
    : null

  const vr = incident.verification_results[0]

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-10 shadow-xs">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-slate-600 hover:text-slate-900 transition-colors text-sm font-medium">
              ← Dashboard
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-sm text-slate-800 font-mono font-semibold">{incident.id.slice(0, 8)}</span>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setActiveTab('split')}
              className={`px-3 py-1 text-xs rounded transition-all font-medium cursor-pointer ${
                activeTab === 'split'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Split View
            </button>
            <button
              onClick={() => setActiveTab('pipeline')}
              className={`px-3 py-1 text-xs rounded transition-all font-medium cursor-pointer ${
                activeTab === 'pipeline'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              AI Pipeline
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-3 py-1 text-xs rounded transition-all font-medium cursor-pointer ${
                activeTab === 'logs'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ⚡ Live Logs ({logs.length})
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column: Incident metadata */}
        <div className="lg:col-span-4 space-y-4">
          {/* Incident header */}
          <div
            className={`p-5 rounded-xl border ${
              isResolved
                ? 'border-emerald-200 bg-emerald-50/70'
                : 'border-blue-200 bg-blue-50/70'
            }`}
          >
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <SeverityBadge severity={incident.severity as any} />
              <StatusBadge status={incident.status} />
            </div>
            <h1 className="text-base font-bold text-slate-900 mb-1">{incident.title}</h1>
            <p className="text-xs text-slate-600 leading-relaxed">{incident.summary}</p>

            {duration && (
              <div className="mt-3 text-xs font-semibold text-emerald-700 flex items-center gap-1">
                <span>✓</span> Resolved in {duration}s
              </div>
            )}
          </div>

          {/* Root cause */}
          {incident.root_cause && (
            <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/70 shadow-xs">
              <div className="text-xs font-semibold text-purple-700 mb-1.5 flex items-center gap-1">
                <span>🧠</span> Root Cause
              </div>
              <p className="text-sm text-slate-800 leading-relaxed">{incident.root_cause}</p>
            </div>
          )}

          {/* Verification result */}
          {vr && (
            <div
              className={`p-4 rounded-xl border ${
                vr.recovered
                  ? 'border-emerald-200 bg-emerald-50/70'
                  : 'border-rose-200 bg-rose-50/70'
              } shadow-xs`}
            >
              <div className="text-xs font-semibold text-emerald-700 mb-2 flex items-center gap-1">
                <span>✅</span> Verification Results
              </div>
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div>
                  <span className="text-slate-500">Health: </span>
                  <span className={vr.health_status === 'ok' ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-semibold'}>
                    {vr.health_status}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Recovered: </span>
                  <span className={vr.recovered ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-semibold'}>
                    {vr.recovered ? 'Yes' : 'No'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Error rate before: </span>
                  <span className="font-semibold text-slate-800">{vr.error_rate_before}%</span>
                </div>
                <div>
                  <span className="text-slate-500">Error rate after: </span>
                  <span className="font-semibold text-emerald-700">{vr.error_rate_after}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Remediation actions */}
          {incident.remediation_actions.length > 0 && (
            <div className="p-4 rounded-xl border border-cyan-200 bg-cyan-50/70 shadow-xs">
              <div className="text-xs font-semibold text-cyan-800 mb-1.5 flex items-center gap-1">
                <span>⚡</span> Runbook Executed
              </div>
              {incident.remediation_actions.map((a) => (
                <div key={a.id} className="text-sm text-slate-800">
                  <span className="font-mono font-semibold text-cyan-700">{a.runbook_name}</span>
                  <span className="text-xs text-slate-500 ml-2">({a.status})</span>
                </div>
              ))}
            </div>
          )}

          {/* Timeline events */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className="text-xs font-semibold text-slate-500 mb-2.5 uppercase tracking-wider">📋 Incident Timeline</div>
            <EventFeed events={incident.events} />
          </div>
        </div>

        {/* Right column: AI Pipeline & Live Logs */}
        <div className="lg:col-span-8 space-y-6">
          {/* AI Pipeline */}
          {(activeTab === 'pipeline' || activeTab === 'split') && (
            <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-xs">
              <div className="text-xs font-semibold text-slate-700 mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>🤖 AI Agent Pipeline</span>
                  <span className="text-slate-400 font-normal">
                    ({incident.agent_runs.length}/7 completed)
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">Model: Gemini 3.6 Flash</span>
              </div>
              <AgentTimeline agentRuns={incident.agent_runs} liveEvents={liveEvents} />
            </div>
          )}

          {/* Live Log Stream Viewer */}
          {(activeTab === 'logs' || activeTab === 'split') && (
            <LiveLogViewer
              logs={logs}
              incidentId={incident.id}
              title="Live Telemetry & Agent Execution Stream"
              maxHeight={activeTab === 'logs' ? 'max-h-[700px]' : 'max-h-[440px]'}
              onClear={() => setLogs([])}
            />
          )}
        </div>
      </main>
    </div>
  )
}
