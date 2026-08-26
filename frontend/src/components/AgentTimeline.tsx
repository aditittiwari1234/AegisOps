import React from 'react'
import type { AgentRun } from '../services/api'
import type { WSEvent } from '../hooks/useWebSocket'

const AGENT_LABELS: Record<string, { label: string; icon: string }> = {
  detection:    { label: 'Detection Agent',    icon: '🔍' },
  investigation:{ label: 'Investigation Agent', icon: '🕵️' },
  knowledge:    { label: 'Knowledge Agent',    icon: '📚' },
  root_cause:   { label: 'Root Cause Agent',   icon: '🧠' },
  safety:       { label: 'Safety Agent',       icon: '🛡️' },
  action:       { label: 'Action Agent',       icon: '⚡' },
  verification: { label: 'Verification Agent', icon: '✅' },
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
    <div className="space-y-2">
      {AGENT_ORDER.map((agentName) => {
        const run = runMap.get(agentName)
        const isLive = liveRunning.has(agentName)
        const meta = AGENT_LABELS[agentName]
        const isDone = run?.status === 'done'
        const isFailed = run?.status === 'failed'
        const isRunning = run?.status === 'running' || isLive

        return (
          <div
            key={agentName}
            className={`flex items-start gap-3 p-3 rounded-lg border transition-all duration-500 ${
              isDone ? 'border-emerald-500/30 bg-emerald-500/5' :
              isFailed ? 'border-red-500/30 bg-red-500/5' :
              isRunning ? 'border-blue-500/40 bg-blue-500/10 shadow-[0_0_12px_rgba(59,130,246,0.15)]' :
              'border-white/5 bg-white/2 opacity-50'
            }`}
          >
            {/* Icon/Status indicator */}
            <div className="mt-0.5 text-lg w-7 flex-shrink-0 text-center">
              {isRunning ? (
                <span className="inline-block animate-spin">⚙️</span>
              ) : isDone ? '✅' : isFailed ? '❌' : (
                <span className="opacity-30">{meta.icon}</span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-semibold ${isDone ? 'text-emerald-400' : isRunning ? 'text-blue-300' : isFailed ? 'text-red-400' : 'text-slate-500'}`}>
                  {meta.label}
                </span>
                {run?.duration_ms && (
                  <span className="text-xs text-slate-500">{run.duration_ms}ms</span>
                )}
              </div>

              {/* Agent output */}
              {isDone && run?.output_json && (
                <div className="mt-1.5 text-xs text-slate-400 space-y-0.5">
                  {Object.entries(run.output_json).slice(0, 3).map(([k, v]) => (
                    typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? (
                      <div key={k} className="truncate">
                        <span className="text-slate-500">{k}: </span>
                        <span className="text-slate-300">{String(v)}</span>
                      </div>
                    ) : null
                  ))}
                </div>
              )}

              {isRunning && (
                <div className="mt-1 text-xs text-blue-400 animate-pulse">Running analysis…</div>
              )}

              {isFailed && run?.output_json?.error && (
                <div className="mt-1 text-xs text-red-400">{String(run.output_json.error)}</div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
