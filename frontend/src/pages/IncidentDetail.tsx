import React, { useState, useCallback, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getIncident } from '../services/api'
import type { Incident } from '../services/api'
import { useWebSocket, WSEvent } from '../hooks/useWebSocket'
import { AgentTimeline } from '../components/AgentTimeline'
import { SeverityBadge, StatusBadge } from '../components/StatusBadge'

function formatTs(ts: string) {
  return new Date(ts).toLocaleTimeString('en-US', { hour12: false })
}

function EventFeed({ events }: { events: Incident['events'] }) {
  return (
    <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
      {[...events].reverse().map(ev => (
        <div key={ev.id} className="flex gap-2 text-xs">
          <span className="text-slate-600 flex-shrink-0">{formatTs(ev.ts)}</span>
          <span className={`flex-1 ${
            ev.event_type === 'resolved' ? 'text-emerald-400' :
            ev.event_type === 'status_change' ? 'text-blue-400' :
            ev.event_type.includes('failed') ? 'text-red-400' :
            'text-slate-400'
          }`}>{ev.message}</span>
        </div>
      ))}
      {events.length === 0 && <p className="text-xs text-slate-600">No events yet…</p>}
    </div>
  )
}

export default function IncidentDetail() {
  const { id } = useParams<{ id: string }>()
  const [incident, setIncident] = useState<Incident | null>(null)
  const [liveEvents, setLiveEvents] = useState<WSEvent[]>([])
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

  useEffect(() => {
    fetch()
    const timer = setInterval(fetch, 2000)
    return () => clearInterval(timer)
  }, [fetch])

  const handleWS = useCallback((evt: WSEvent) => {
    if (evt.incident_id !== id) return
    setLiveEvents(prev => [...prev.slice(-50), evt])
    if (['agent.completed', 'status.changed'].includes(evt.type)) {
      fetch()
    }
  }, [id, fetch])

  useWebSocket(handleWS)

  if (loading) return (
    <div className="min-h-screen bg-[#080c14] flex items-center justify-center text-slate-500 text-sm">
      Loading incident…
    </div>
  )
  if (!incident) return (
    <div className="min-h-screen bg-[#080c14] flex items-center justify-center text-slate-500">
      Incident not found. <Link to="/" className="ml-2 text-blue-400 underline">Back</Link>
    </div>
  )

  const isResolved = incident.status === 'RESOLVED'
  const duration = incident.resolved_at
    ? Math.round((new Date(incident.resolved_at).getTime() - new Date(incident.created_at).getTime()) / 1000)
    : null

  const vr = incident.verification_results[0]

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 font-sans">
      {/* Header */}
      <header className="border-b border-white/5 bg-[#0a0f1a]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link to="/" className="text-slate-500 hover:text-white transition-colors text-sm">← Dashboard</Link>
          <span className="text-slate-700">/</span>
          <span className="text-sm text-slate-300 font-mono">{incident.id.slice(0, 8)}</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Incident meta */}
        <div className="lg:col-span-2 space-y-4">
          {/* Incident header */}
          <div className={`p-5 rounded-xl border ${isResolved ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-blue-500/20 bg-blue-500/5'}`}>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <SeverityBadge severity={incident.severity as any} />
              <StatusBadge status={incident.status} />
            </div>
            <h1 className="text-base font-bold text-white mb-1">{incident.title}</h1>
            <p className="text-xs text-slate-400">{incident.summary}</p>

            {duration && (
              <div className="mt-3 text-xs font-semibold text-emerald-400">
                ✓ Resolved in {duration}s
              </div>
            )}
          </div>

          {/* Root cause */}
          {incident.root_cause && (
            <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-500/5">
              <div className="text-xs font-semibold text-purple-400 mb-1.5">🧠 Root Cause</div>
              <p className="text-sm text-slate-300">{incident.root_cause}</p>
            </div>
          )}

          {/* Verification result */}
          {vr && (
            <div className={`p-4 rounded-xl border ${vr.recovered ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
              <div className="text-xs font-semibold text-emerald-400 mb-1.5">✅ Verification</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-slate-500">Health: </span><span className={vr.health_status === 'ok' ? 'text-emerald-400' : 'text-red-400'}>{vr.health_status}</span></div>
                <div><span className="text-slate-500">Recovered: </span><span className={vr.recovered ? 'text-emerald-400' : 'text-red-400'}>{vr.recovered ? 'Yes' : 'No'}</span></div>
                <div><span className="text-slate-500">Error rate before: </span><span className="text-slate-300">{vr.error_rate_before}%</span></div>
                <div><span className="text-slate-500">Error rate after: </span><span className="text-emerald-300">{vr.error_rate_after}%</span></div>
              </div>
            </div>
          )}

          {/* Remediation actions */}
          {incident.remediation_actions.length > 0 && (
            <div className="p-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5">
              <div className="text-xs font-semibold text-cyan-400 mb-1.5">⚡ Runbook Executed</div>
              {incident.remediation_actions.map(a => (
                <div key={a.id} className="text-sm text-slate-300">
                  <span className="font-mono text-cyan-400">{a.runbook_name}</span>
                  <span className="text-xs text-slate-500 ml-2">({a.status})</span>
                </div>
              ))}
            </div>
          )}

          {/* Timeline events */}
          <div className="p-4 rounded-xl border border-white/5 bg-white/2">
            <div className="text-xs font-semibold text-slate-400 mb-2">📋 Timeline</div>
            <EventFeed events={incident.events} />
          </div>
        </div>

        {/* Right: Agent pipeline */}
        <div className="lg:col-span-3">
          <div className="p-5 rounded-xl border border-white/5 bg-white/2">
            <div className="text-xs font-semibold text-slate-400 mb-4 flex items-center gap-2">
              🤖 AI Agent Pipeline
              <span className="text-slate-600">({incident.agent_runs.length}/7 completed)</span>
            </div>
            <AgentTimeline agentRuns={incident.agent_runs} liveEvents={liveEvents} />
          </div>
        </div>
      </main>
    </div>
  )
}
