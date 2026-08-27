import React from 'react'
import type { AgentRun } from '../services/api'
import type { WSEvent } from '../hooks/useWebSocket'
import {
  SearchIcon,
  InvestigateIcon,
  KnowledgeIcon,
  BrainIcon,
  SafetyIcon,
  ZapIcon,
  VerificationIcon,
  CheckCircleIcon,
  XCircleIcon,
  LoaderIcon
} from './Icons'

const AGENT_META: Record<string, { label: string; IconComponent: React.ComponentType<{ size?: number; className?: string }> }> = {
  detection:    { label: 'Detection Agent',    IconComponent: SearchIcon },
  investigation:{ label: 'Investigation Agent', IconComponent: InvestigateIcon },
  knowledge:    { label: 'Knowledge Agent',    IconComponent: KnowledgeIcon },
  root_cause:   { label: 'Root Cause Agent',   IconComponent: BrainIcon },
  safety:       { label: 'Safety Agent',       IconComponent: SafetyIcon },
  action:       { label: 'Action Agent',       IconComponent: ZapIcon },
  verification: { label: 'Verification Agent', IconComponent: VerificationIcon },
}

const AGENT_ORDER = ['detection', 'investigation', 'knowledge', 'root_cause', 'safety', 'action', 'verification']

interface Props {
  agentRuns: AgentRun[]
  liveEvents: WSEvent[]
}

export function AgentTimeline({ agentRuns, liveEvents }: Props) {
  // Merge DB runs with live streaming events
  const runMap = new Map<string, AgentRun>()
  agentRuns.forEach(r => runMap.set(r.agent_name, r))

  // Find agents currently running from live events
  const liveRunning = new Set<string>()
  liveEvents.forEach(e => {
    if (e.type === 'agent.started' && e.agent) liveRunning.add(e.agent)
    if (e.type === 'agent.completed' && e.agent) liveRunning.delete(e.agent)
  })

  return (
    <div className="space-y-2.5">
      {AGENT_ORDER.map((agentName) => {
        const run = runMap.get(agentName)
        const isLive = liveRunning.has(agentName)
        const meta = AGENT_META[agentName] || { label: agentName, IconComponent: SearchIcon }
        const isDone = run?.status === 'done'
        const isFailed = run?.status === 'failed'
        const isRunning = run?.status === 'running' || isLive
        const Icon = meta.IconComponent

        return (
          <div
            key={agentName}
            className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all duration-300 ${
              isDone ? 'border-emerald-200 bg-emerald-50/60 shadow-xs' :
              isFailed ? 'border-rose-200 bg-rose-50/60 shadow-xs' :
              isRunning ? 'border-blue-300 bg-blue-50/80 shadow-sm ring-2 ring-blue-500/20' :
              'border-slate-200 bg-slate-50/50 opacity-80'
            }`}
          >
            {/* SVG Icon / Status indicator */}
            <div className="mt-0.5 w-7 flex-shrink-0 flex items-center justify-center">
              {isRunning ? (
                <LoaderIcon size={18} className="text-blue-600" />
              ) : isDone ? (
                <CheckCircleIcon size={18} className="text-emerald-600" />
              ) : isFailed ? (
                <XCircleIcon size={18} className="text-rose-600" />
              ) : (
                <Icon size={18} className="text-slate-400 opacity-60" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className={`text-sm font-semibold flex items-center gap-1.5 ${
                  isDone ? 'text-emerald-800' :
                  isRunning ? 'text-blue-700' :
                  isFailed ? 'text-rose-800' :
                  'text-slate-600'
                }`}>
                  <Icon size={14} className={isDone ? 'text-emerald-700' : isRunning ? 'text-blue-600' : isFailed ? 'text-rose-700' : 'text-slate-400'} />
                  {meta.label}
                </span>
                {run?.duration_ms && (
                  <span className="text-xs font-mono text-slate-500">{run.duration_ms}ms</span>
                )}
              </div>

              {/* Agent output */}
              {isDone && run?.output_json && (
                <div className="mt-2 text-xs text-slate-700 space-y-1 bg-white p-2.5 rounded-lg border border-emerald-200/80 shadow-xs">
                  {Object.entries(run.output_json).slice(0, 3).map(([k, v]) => (
                    typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? (
                      <div key={k} className="truncate">
                        <span className="text-slate-500 font-medium">{k}: </span>
                        <span className="font-mono text-slate-800 font-semibold">{String(v)}</span>
                      </div>
                    ) : null
                  ))}
                </div>
              )}

              {isRunning && (
                <div className="mt-1.5 text-xs font-medium text-blue-600 animate-pulse">Running autonomous analysis…</div>
              )}

              {isFailed && run?.output_json && 'error' in run.output_json && (
                <div className="mt-1.5 text-xs font-medium text-rose-600">
                  {String(run.output_json.error)}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
