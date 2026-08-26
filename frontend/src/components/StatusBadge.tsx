type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN'
type Status = string

const SEVERITY_STYLES: Record<Severity, string> = {
  CRITICAL: 'bg-red-50 text-red-700 border-red-200',
  HIGH: 'bg-orange-50 text-orange-700 border-orange-200',
  MEDIUM: 'bg-amber-50 text-amber-700 border-amber-200',
  LOW: 'bg-blue-50 text-blue-700 border-blue-200',
  UNKNOWN: 'bg-slate-100 text-slate-700 border-slate-200',
}

const STATUS_STYLES: Record<string, string> = {
  DETECTED: 'bg-amber-50 text-amber-800 border-amber-300',
  INVESTIGATING: 'bg-blue-50 text-blue-800 border-blue-300',
  DIAGNOSING: 'bg-purple-50 text-purple-800 border-purple-300',
  SAFETY_REVIEW: 'bg-orange-50 text-orange-800 border-orange-300',
  AWAITING_APPROVAL: 'bg-amber-50 text-amber-900 border-amber-400',
  REMEDIATING: 'bg-cyan-50 text-cyan-800 border-cyan-300',
  VERIFYING: 'bg-indigo-50 text-indigo-800 border-indigo-300',
  RESOLVED: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  FAILED: 'bg-rose-50 text-rose-800 border-rose-300',
  ESCALATED: 'bg-red-50 text-red-800 border-red-300',
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
