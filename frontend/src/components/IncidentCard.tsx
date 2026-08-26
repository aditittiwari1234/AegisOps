import React from 'react'
import { Link } from 'react-router-dom'
import type { Incident } from '../services/api'
import { SeverityBadge, StatusBadge } from './StatusBadge'

interface Props {
  incident: Incident
  onContextMenu?: (e: React.MouseEvent, incident: Incident) => void
}

function formatDuration(start: string, end: string | null) {
  if (!end) return null
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`
  return `${Math.round(ms / 60_000)}m`
}

export function IncidentCard({ incident, onContextMenu }: Props) {
  const isResolved = incident.status === 'RESOLVED'
  const isFailed = incident.status === 'FAILED'
  const duration = formatDuration(incident.created_at, incident.resolved_at)

  const handleContextMenu = (e: React.MouseEvent) => {
    if (onContextMenu) {
      e.preventDefault()
      e.stopPropagation()
      onContextMenu(e, incident)
    }
  }

  const handleMoreClick = (e: React.MouseEvent) => {
    if (onContextMenu) {
      e.preventDefault()
      e.stopPropagation()
      onContextMenu(e, incident)
    }
  }

  return (
    <div
      onContextMenu={handleContextMenu}
      className={`group relative p-4 rounded-xl border transition-all duration-200 cursor-pointer hover:scale-[1.005] hover:shadow-md ${
        isResolved
          ? 'border-emerald-200 bg-white hover:border-emerald-300 shadow-xs'
          : isFailed
          ? 'border-red-200 bg-white hover:border-red-300 shadow-xs'
          : 'border-blue-200 bg-blue-50/40 hover:border-blue-300 shadow-xs'
      }`}
    >
      <Link to={`/incidents/${incident.id}`} className="block">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 pr-8">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <SeverityBadge severity={incident.severity as any} />
              <StatusBadge status={incident.status} />
              <span className="text-xs text-slate-500 font-mono">{incident.id.slice(0, 8)}</span>
            </div>
            <h3 className="text-sm font-semibold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
              {incident.title}
            </h3>
            {incident.summary && (
              <p className="mt-0.5 text-xs text-slate-600 line-clamp-2">{incident.summary}</p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-xs text-slate-500 font-mono">
              {new Date(incident.created_at).toLocaleTimeString()}
            </div>
            {duration && (
              <div className="text-xs font-semibold text-emerald-600 mt-0.5">
                ✓ {duration}
              </div>
            )}
          </div>
        </div>

        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">🏷️ {incident.service}</span>
          <span className="flex items-center gap-1">🤖 {incident.agent_runs.length}/7 agents</span>
          {incident.root_cause && (
            <span className="truncate max-w-[280px]">🧠 {incident.root_cause}</span>
          )}
        </div>
      </Link>

      {/* Quick context action button */}
      <button
        onClick={handleMoreClick}
        title="More options (or Right Click)"
        aria-label="Incident options"
        className="absolute top-3.5 right-2 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="1"/>
          <circle cx="12" cy="5" r="1"/>
          <circle cx="12" cy="19" r="1"/>
        </svg>
      </button>
    </div>
  )
}
