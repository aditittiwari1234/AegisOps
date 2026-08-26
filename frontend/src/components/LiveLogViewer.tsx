import React, { useState, useEffect, useRef, useMemo } from 'react'
import type { LogEntry } from '../services/api'

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
      return 'bg-rose-500/15 text-rose-400 border-rose-500/30'
    case 'WARN':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30'
    case 'SUCCESS':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
    case 'DEBUG':
      return 'bg-purple-500/15 text-purple-400 border-purple-500/30'
    case 'INFO':
    default:
      return 'bg-sky-500/15 text-sky-400 border-sky-500/30'
  }
}

function getSourceBadgeStyle(source: string) {
  if (source.startsWith('AGENT:')) {
    if (source.includes('action')) return 'bg-cyan-950/60 text-cyan-300 border-cyan-500/30'
    if (source.includes('investigation')) return 'bg-indigo-950/60 text-indigo-300 border-indigo-500/30'
    if (source.includes('root_cause')) return 'bg-purple-950/60 text-purple-300 border-purple-500/30'
    if (source.includes('safety')) return 'bg-yellow-950/60 text-yellow-300 border-yellow-500/30'
    if (source.includes('verification')) return 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30'
    return 'bg-blue-950/60 text-blue-300 border-blue-500/30'
  }
  if (source === 'KARTIFY') return 'bg-amber-950/60 text-amber-300 border-amber-500/30'
  if (source === 'ORCHESTRATOR') return 'bg-violet-950/60 text-violet-300 border-violet-500/30'
  if (source === 'HEALTH_POLLER') return 'bg-teal-950/60 text-teal-300 border-teal-500/30'
  return 'bg-slate-900 text-slate-300 border-slate-700'
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
      className={`rounded-xl border border-slate-800/80 bg-[#090d16]/95 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col font-mono ${
        embedded ? '' : 'my-4'
      }`}
    >
      {/* Header bar */}
      <div className="px-4 py-3 bg-[#0c1220] border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 select-none">
        <div className="flex items-center gap-2.5">
          {/* Live pulsing dot */}
          <div className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
            {title}
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-400 border border-slate-700/50">
            {filteredLogs.length} events
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* Auto-scroll toggle */}
          <button
            onClick={() => setAutoScroll((prev) => !prev)}
            title="Toggle Auto-Scroll"
            className={`px-2.5 py-1 text-[11px] rounded transition-all flex items-center gap-1.5 border ${
              autoScroll
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-700/40 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:text-slate-200'
            }`}
          >
            <span className="text-[9px]">{autoScroll ? '▼' : '⏸'}</span>
            Auto-scroll {autoScroll ? 'ON' : 'OFF'}
          </button>

          {/* Copy logs */}
          <button
            onClick={copyToClipboard}
            title="Copy logs to clipboard"
            className="px-2.5 py-1 text-[11px] rounded bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 border border-slate-700/50 transition-colors"
          >
            {copied ? '✓ Copied' : '📋 Copy'}
          </button>

          {/* Export logs */}
          <button
            onClick={exportLogs}
            title="Export logs to JSON"
            className="px-2.5 py-1 text-[11px] rounded bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 border border-slate-700/50 transition-colors"
          >
            💾 Export
          </button>

          {/* Clear button */}
          {onClear && (
            <button
              onClick={onClear}
              title="Clear visible logs"
              className="px-2.5 py-1 text-[11px] rounded bg-rose-950/30 hover:bg-rose-900/40 text-rose-300 border border-rose-800/40 transition-colors"
            >
              🗑 Clear
            </button>
          )}
        </div>
      </div>

      {/* Filter and search bar */}
      <div className="px-4 py-2.5 bg-[#090d16] border-b border-slate-800/60 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(
            [
              { id: 'ALL', label: 'All Logs' },
              { id: 'AGENTS', label: '🤖 AI Agents' },
              { id: 'KARTIFY', label: '🛒 Kartify App' },
              { id: 'ORCHESTRATOR', label: '⚡ Orchestrator' },
              { id: 'ERRORS', label: '⚠️ Errors & Warnings' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                filter === tab.id
                  ? 'bg-blue-600/30 text-blue-300 border border-blue-500/50 shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative min-w-[200px] flex-1 sm:flex-initial">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter logs by keyword, agent, error…"
            className="w-full bg-[#060a12] border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Terminal Log Stream Area */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className={`${maxHeight} overflow-y-auto p-3 space-y-1 bg-[#05080f] select-text scroll-smooth text-[12px] leading-relaxed`}
      >
        {filteredLogs.length === 0 ? (
          <div className="py-12 text-center text-slate-600 flex flex-col items-center justify-center gap-2">
            <span className="text-2xl animate-pulse">📡</span>
            <p className="text-xs">No matching logs found.</p>
            <p className="text-[11px] text-slate-600">
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
                    ? 'bg-slate-900/80 border-slate-700/80'
                    : 'border-transparent hover:bg-slate-900/40 hover:border-slate-800/50'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {/* Timestamp */}
                  <span className="text-[11px] text-slate-500 font-mono flex-shrink-0 pt-0.5">
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
                          ? 'text-rose-300 font-medium'
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
                        className="ml-2 text-[10px] text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors cursor-pointer inline-flex items-center gap-0.5"
                      >
                        {isExpanded ? '▲ Hide Details' : '▼ View Payload'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded JSON Data Box */}
                {isExpanded && hasData && (
                  <div className="mt-2 ml-14 p-2.5 rounded bg-[#03060a] border border-slate-800 text-[11px] text-slate-300 overflow-x-auto">
                    <pre className="font-mono">{JSON.stringify(log.data, null, 2)}</pre>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Footer status bar */}
      <div className="px-4 py-1.5 bg-[#0a0e1a] border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-3">
          <span>
            Showing <strong className="text-slate-400">{filteredLogs.length}</strong> of{' '}
            <strong className="text-slate-400">{logs.length}</strong> entries
          </span>
          {incidentId && (
            <span className="text-slate-600 font-mono">
              Scope: {incidentId === '*' ? 'Global' : incidentId.slice(0, 8)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-500">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          WebSocket Connected
        </div>
      </div>
    </div>
  )
}
