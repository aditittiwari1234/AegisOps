import { useState, useEffect, useRef, useMemo } from 'react'
import type { LogEntry } from '../services/api'
import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  TrashIcon,
  BotIcon,
  CartIcon,
  ZapIcon,
  AlertTriangleIcon,
  XIcon,
  RadioIcon,
  PlayIcon,
  PauseIcon
} from './Icons'

interface Props {
  logs: LogEntry[]
  onClear?: () => void
  title?: string
  incidentId?: string
  maxHeight?: string
  embedded?: boolean
}

type FilterType = 'ALL' | 'AGENTS' | 'KARTIFY' | 'ORCHESTRATOR' | 'ERRORS'

function formatTs(ts: string) {
  try {
    const d = new Date(ts)
    return d.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    })
  } catch {
    return ts
  }
}

function getLevelBadgeStyle(level: string) {
  switch (level.toUpperCase()) {
    case 'ERROR':
      return 'bg-rose-100 text-rose-800 border-rose-200'
    case 'WARN':
      return 'bg-amber-100 text-amber-800 border-amber-200'
    case 'SUCCESS':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    case 'DEBUG':
      return 'bg-purple-100 text-purple-800 border-purple-200'
    case 'INFO':
    default:
      return 'bg-sky-100 text-sky-800 border-sky-200'
  }
}

function getSourceBadgeStyle(source: string) {
  if (source.startsWith('AGENT:')) {
    if (source.includes('action')) return 'bg-cyan-100 text-cyan-800 border-cyan-200'
    if (source.includes('investigation')) return 'bg-indigo-100 text-indigo-800 border-indigo-200'
    if (source.includes('root_cause')) return 'bg-purple-100 text-purple-800 border-purple-200'
    if (source.includes('safety')) return 'bg-amber-100 text-amber-800 border-amber-200'
    if (source.includes('verification')) return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    return 'bg-blue-100 text-blue-800 border-blue-200'
  }
  if (source === 'KARTIFY') return 'bg-orange-100 text-orange-800 border-orange-200'
  if (source === 'ORCHESTRATOR') return 'bg-violet-100 text-violet-800 border-violet-200'
  if (source === 'HEALTH_POLLER') return 'bg-teal-100 text-teal-800 border-teal-200'
  return 'bg-slate-200 text-slate-800 border-slate-300'
}

export function LiveLogViewer({
  logs,
  onClear,
  title = 'Live Logs & Telemetry Stream',
  incidentId,
  maxHeight = 'max-h-[480px]',
  embedded = false,
}: Props) {
  const [filter, setFilter] = useState<FilterType>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const containerRef = useRef<HTMLDivElement | null>(null)

  // Auto-scroll effect
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  const handleScroll = () => {
    if (!containerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 40
    if (isAtBottom !== autoScroll) {
      setAutoScroll(isAtBottom)
    }
  }

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // 1. Category Filter
      if (filter === 'AGENTS' && !log.source.startsWith('AGENT:')) return false
      if (filter === 'KARTIFY' && log.source !== 'KARTIFY') return false
      if (filter === 'ORCHESTRATOR' && log.source !== 'ORCHESTRATOR') return false
      if (filter === 'ERRORS' && log.level !== 'ERROR' && log.level !== 'WARN') return false

      // 2. Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matchMsg = log.message.toLowerCase().includes(query)
        const matchSource = log.source.toLowerCase().includes(query)
        const matchLevel = log.level.toLowerCase().includes(query)
        const matchData = log.data ? JSON.stringify(log.data).toLowerCase().includes(query) : false
        if (!matchMsg && !matchSource && !matchLevel && !matchData) return false
      }

      return true
    })
  }, [logs, filter, searchQuery])

  const copyToClipboard = () => {
    const text = filteredLogs
      .map(
        (l) =>
          `[${l.timestamp}] [${l.level}] [${l.source}] ${l.message}${
            l.data ? '\n' + JSON.stringify(l.data, null, 2) : ''
          }`
      )
      .join('\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const exportLogs = () => {
    const text = JSON.stringify(filteredLogs, null, 2)
    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `aegisops-logs-${incidentId || 'all'}-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col font-mono ${
        embedded ? '' : 'my-4'
      }`}
    >
      {/* Header bar */}
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 select-none">
        <div className="flex items-center gap-2.5">
          {/* Live pulsing dot */}
          <div className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
            {title}
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 border border-slate-300 font-semibold">
            {filteredLogs.length} events
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* Auto-scroll toggle */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            title="Toggle live autoscroll"
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded border transition-all cursor-pointer ${
              autoScroll
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-xs font-semibold'
                : 'bg-slate-100 text-slate-600 border-slate-200 hover:text-slate-900'
            }`}
          >
            {autoScroll ? <PauseIcon size={10} /> : <PlayIcon size={10} />}
            Auto-scroll {autoScroll ? 'ON' : 'OFF'}
          </button>

          {/* Copy logs */}
          <button
            onClick={copyToClipboard}
            title="Copy logs to clipboard"
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <CheckIcon size={12} className="text-emerald-600" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <CopyIcon size={12} className="text-slate-500" />
                <span>Copy</span>
              </>
            )}
          </button>

          {/* Export logs */}
          <button
            onClick={exportLogs}
            title="Export logs to JSON"
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
          >
            <DownloadIcon size={12} className="text-slate-500" />
            <span>Export</span>
          </button>

          {/* Clear button */}
          {onClear && (
            <button
              onClick={onClear}
              title="Clear visible logs"
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] rounded bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer"
            >
              <TrashIcon size={12} className="text-rose-600" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and search bar */}
      <div className="px-4 py-2.5 bg-slate-50/50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(
            [
              { id: 'ALL', label: 'All Logs', icon: null },
              { id: 'AGENTS', label: 'AI Agents', icon: BotIcon },
              { id: 'KARTIFY', label: 'Kartify App', icon: CartIcon },
              { id: 'ORCHESTRATOR', label: 'Orchestrator', icon: ZapIcon },
              { id: 'ERRORS', label: 'Errors & Warnings', icon: AlertTriangleIcon },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id as FilterType)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-all cursor-pointer ${
                  filter === tab.id
                    ? 'bg-blue-100 text-blue-800 border border-blue-300 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 border border-transparent'
                }`}
              >
                {Icon && <Icon size={13} className={filter === tab.id ? 'text-blue-700' : 'text-slate-500'} />}
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* Search input */}
        <div className="relative min-w-[200px] flex-1 sm:flex-initial">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter logs by keyword, agent, error…"
            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <XIcon size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Terminal Log Stream Area - Light Console */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className={`${maxHeight} overflow-y-auto p-3 space-y-1 bg-slate-900 text-slate-100 select-text scroll-smooth text-[12px] leading-relaxed font-mono`}
      >
        {filteredLogs.length === 0 ? (
          <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <RadioIcon size={28} className="text-slate-500 animate-pulse" />
            <p className="text-xs text-slate-300 font-medium">No matching logs found.</p>
            <p className="text-[11px] text-slate-400">
              Live events, agent executions, and app telemetry will appear here in real time.
            </p>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const isExpanded = expandedLogId === log.id
            const hasData = log.data && Object.keys(log.data).length > 0

            return (
              <div
                key={log.id}
                className={`group rounded p-1.5 transition-colors border ${
                  isExpanded
                    ? 'bg-slate-800/90 border-slate-700'
                    : 'border-transparent hover:bg-slate-800/50 hover:border-slate-700/50'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {/* Timestamp */}
                  <span className="text-[11px] text-slate-400 font-mono flex-shrink-0 pt-0.5">
                    {formatTs(log.timestamp)}
                  </span>

                  {/* Level badge */}
                  <span
                    className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${getLevelBadgeStyle(
                      log.level
                    )}`}
                  >
                    {log.level}
                  </span>

                  {/* Source badge */}
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0 font-medium ${getSourceBadgeStyle(
                      log.source
                    )}`}
                  >
                    {log.source}
                  </span>

                  {/* Message */}
                  <div className="flex-1 text-slate-200 break-words pt-0.5">
                    <span
                      className={
                        log.level === 'ERROR'
                          ? 'text-rose-300 font-semibold'
                          : log.level === 'WARN'
                          ? 'text-amber-300'
                          : log.level === 'SUCCESS'
                          ? 'text-emerald-300 font-medium'
                          : log.level === 'DEBUG'
                          ? 'text-purple-300'
                          : 'text-slate-200'
                      }
                    >
                      {log.message}
                    </span>

                    {/* Expand payload toggle */}
                    {hasData && (
                      <button
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        className="ml-2 text-[10px] text-sky-400 hover:text-sky-300 underline underline-offset-2 transition-colors cursor-pointer inline-flex items-center gap-0.5"
                      >
                        {isExpanded ? '▲ Hide Details' : '▼ View Payload'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded JSON Data Box */}
                {isExpanded && hasData && (
                  <div className="mt-2 ml-14 p-2.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-300 overflow-x-auto">
                    <pre className="font-mono">{JSON.stringify(log.data, null, 2)}</pre>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Footer status bar */}
      <div className="px-4 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-3">
          <span>
            Showing <strong className="text-slate-700">{filteredLogs.length}</strong> of{' '}
            <strong className="text-slate-700">{logs.length}</strong> entries
          </span>
          {incidentId && (
            <span className="text-slate-500 font-mono">
              Scope: {incidentId === '*' ? 'Global' : incidentId.slice(0, 8)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          WebSocket Connected
        </div>
      </div>
    </div>
  )
}
