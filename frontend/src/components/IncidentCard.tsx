import React from 'react'
import { Link } from 'react-router-dom'
import type { Incident } from '../services/api'
import { SeverityBadge, StatusBadge } from './StatusBadge'

interface Props {
  incident: Incident
}

function formatDuration(start: string, end: string | null) {
  if (!end) return null
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`
  return `${Math.round(ms / 60_000)}m`
}

export function IncidentCard({ incident }: Props) {
  const isResolved = incident.status === 'RESOLVED'
  const duration = formatDuration(incident.created_at, incident.resolved_at)

  return (
    <Link to={`/incidents/${incident.id}`}>
      <div className={`group relative p-4 rounded-xl border transition-all duration-200 cursor-pointer hover:scale-[1.01] hover:shadow-lg ${
        isResolved ? 'border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40' :
        incident.status === 'FAILED' ? 'border-red-500/20 bg-red-500/5 hover:border-red-500/40' :
        'border-blue-500/20 bg-blue-500/5 hover:border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.08)]'
      }`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <SeverityBadge severity={incident.severity as any} />
              <StatusBadge status={incident.status} />
              <span className="text-xs text-slate-500 font-mono">{incident.id.slice(0, 8)}</span>
            </div>
            <h3 className="text-sm font-semibold text-slate-200 truncate group-hover:text-white transition-colors">
              {incident.title}
            </h3>
            {incident.summary && (
              <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{incident.summary}</p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-xs text-slate-500">
              {new Date(incident.created_at).toLocaleTimeString()}
            </div>
            {duration && (
              <div className="text-xs font-semibold text-emerald-400 mt-0.5">
                ✓ {duration}
              </div>
            )}
          </div>
        </div>

        <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
          <span>🏷️ {incident.service}</span>
          <span>🤖 {incident.agent_runs.length}/7 agents</span>
          {incident.root_cause && (
            <span className="truncate max-w-[200px]">🧠 {incident.root_cause}</span>
          )}
        </div>
      </div>
    </Link>
  )
}
