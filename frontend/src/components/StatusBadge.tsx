type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN'
type Status = string

const SEVERITY_STYLES: Record<Severity, string> = {
  CRITICAL: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/40',
  HIGH: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/20 dark:text-orange-400 dark:border-orange-500/40',
  MEDIUM: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-yellow-500/20 dark:text-yellow-400 dark:border-yellow-500/40',
  LOW: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/40',
  UNKNOWN: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/20 dark:text-slate-400 dark:border-slate-500/40',
}

const STATUS_STYLES: Record<string, string> = {
  DETECTED: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-yellow-500/20 dark:text-yellow-300 dark:border-yellow-500/40',
  INVESTIGATING: 'bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/40',
  DIAGNOSING: 'bg-purple-50 text-purple-800 border-purple-300 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/40',
  SAFETY_REVIEW: 'bg-orange-50 text-orange-800 border-orange-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40',
  AWAITING_APPROVAL: 'bg-amber-50 text-amber-900 border-amber-400 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/40',
  REMEDIATING: 'bg-cyan-50 text-cyan-800 border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/40',
  VERIFYING: 'bg-indigo-50 text-indigo-800 border-indigo-300 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/40',
  RESOLVED: 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40',
  FAILED: 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/40',
  ESCALATED: 'bg-red-50 text-red-800 border-red-300 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/40',
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-bold tracking-wide ${SEVERITY_STYLES[severity] || SEVERITY_STYLES.UNKNOWN}`}>
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
