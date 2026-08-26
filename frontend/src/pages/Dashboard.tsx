import React, { useState, useCallback, useEffect, useRef } from 'react'
import { listIncidents, simulateIncident } from '../services/api'
import type { Incident } from '../services/api'
import { useWebSocket, WSEvent } from '../hooks/useWebSocket'
import { IncidentCard } from '../components/IncidentCard'
import { SimulateButton } from '../components/SimulateButton'

const AGENT_PIPELINE = ['detection', 'investigation', 'knowledge', 'root_cause', 'safety', 'action', 'verification']

function MTTD(incidents: Incident[]) {
  const resolved = incidents.filter(i => i.resolved_at)
  if (!resolved.length) return null
  const avg = resolved.reduce((sum, i) => {
    return sum + (new Date(i.resolved_at!).getTime() - new Date(i.created_at).getTime())
  }, 0) / resolved.length
  return Math.round(avg / 1000)
}

export default function Dashboard() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [wsConnected, setWsConnected] = useState(false)
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

  // Poll every 3s as WS fallback
  useEffect(() => {
    fetchIncidents()
    pollRef.current = setInterval(fetchIncidents, 3000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchIncidents])

  const handleWS = useCallback((evt: WSEvent) => {
    setWsConnected(true)
    // Refresh incident list on any interesting event
    if (['status.changed', 'agent.completed', 'orchestrator.started'].includes(evt.type)) {
      fetchIncidents()
    }
  }, [fetchIncidents])

  useWebSocket(handleWS)

  const active = incidents.filter(i => !['RESOLVED', 'FAILED', 'ESCALATED'].includes(i.status))
  const resolved = incidents.filter(i => i.status === 'RESOLVED')
  const avgMTTR = MTTD(incidents)

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 font-sans">
      {/* Header */}
      <header className="border-b border-white/5 bg-[#0a0f1a]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold shadow-[0_0_15px_rgba(99,102,241,0.4)]">
              A
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight">AegisOps</h1>
              <p className="text-xs text-slate-500">Autonomous Incident Response</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* WS status indicator */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className={`h-2 w-2 rounded-full ${wsConnected ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'bg-slate-600'}`} />
              {wsConnected ? 'Live' : 'Connecting…'}
            </div>
            <SimulateButton onSimulated={fetchIncidents} />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats strip */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Incidents', value: incidents.length, color: 'text-white' },
            { label: 'Active', value: active.length, color: active.length > 0 ? 'text-yellow-400' : 'text-slate-400' },
            { label: 'Resolved', value: resolved.length, color: 'text-emerald-400' },
            { label: 'Avg MTTR', value: avgMTTR != null ? `${avgMTTR}s` : '—', color: 'text-blue-400' },
          ].map(stat => (
            <div key={stat.label} className="p-4 rounded-xl border border-white/5 bg-white/2">
              <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Active incidents */}
        {active.length > 0 && (
          <section className="mb-6">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">🔴 Active Incidents</h2>
            <div className="space-y-3">
              {active.map(i => <IncidentCard key={i.id} incident={i} />)}
            </div>
          </section>
        )}

        {/* All incidents */}
        <section>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">📋 Incident History</h2>
          {loading ? (
            <div className="text-sm text-slate-500 animate-pulse">Loading incidents…</div>
          ) : incidents.length === 0 ? (
            <div className="text-center py-16 text-slate-600">
              <div className="text-4xl mb-3">🌿</div>
              <p className="text-sm">No incidents yet. Click <strong className="text-slate-400">Simulate Incident</strong> to start.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {incidents.map(i => <IncidentCard key={i.id} incident={i} />)}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
