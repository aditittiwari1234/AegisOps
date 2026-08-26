import React from 'react'

type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN'
type Status = string

const SEVERITY_STYLES: Record<Severity, string> = {
  CRITICAL: 'bg-red-500/20 text-red-400 border-red-500/40',
  HIGH: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
  MEDIUM: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
  LOW: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
  UNKNOWN: 'bg-slate-500/20 text-slate-400 border-slate-500/40',
}

const STATUS_STYLES: Record<string, string> = {
  DETECTED: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  INVESTIGATING: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  DIAGNOSING: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  SAFETY_REVIEW: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  AWAITING_APPROVAL: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  REMEDIATING: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
  VERIFYING: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
  RESOLVED: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  FAILED: 'bg-red-500/20 text-red-300 border-red-500/40',
  ESCALATED: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-bold tracking-wide ${SEVERITY_STYLES[severity] || SEVERITY_STYLES.UNKNOWN}`}>
      {severity}
    </span>
  )
}

export function StatusBadge({ status }: { status: Status }) {
  const isActive = !['RESOLVED', 'FAILED', 'ESCALATED'].includes(status)
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-semibold ${STATUS_STYLES[status] || STATUS_STYLES.DETECTED}`}>
      {isActive && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-current" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
        </span>
      )}
      {status}
    </span>
  )
}
