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
    <div className="space-y-2.5">
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
            className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all duration-300 ${
              isDone ? 'border-emerald-200 bg-emerald-50/60 shadow-xs' :
              isFailed ? 'border-rose-200 bg-rose-50/60 shadow-xs' :
              isRunning ? 'border-blue-300 bg-blue-50/80 shadow-sm ring-2 ring-blue-500/20' :
              'border-slate-200 bg-slate-50/50 opacity-80'
            }`}
          >
            {/* Icon/Status indicator */}
            <div className="mt-0.5 text-lg w-7 flex-shrink-0 text-center">
              {isRunning ? (
                <span className="inline-block animate-spin">⚙️</span>
              ) : isDone ? '✅' : isFailed ? '❌' : (
                <span className="opacity-40">{meta.icon}</span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className={`text-sm font-semibold ${
                  isDone ? 'text-emerald-800' :
                  isRunning ? 'text-blue-700' :
                  isFailed ? 'text-rose-800' :
                  'text-slate-600'
                }`}>
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
