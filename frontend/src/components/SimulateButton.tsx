import React, { useState, useCallback } from 'react'
import { simulateIncident } from '../services/api'

interface Props {
  onSimulated: () => void
}

export function SimulateButton({ onSimulated }: Props) {
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle')

  const handleClick = useCallback(async () => {
    if (state === 'loading') return
    setState('loading')
    try {
      await simulateIncident('kartify')
      setState('done')
      onSimulated()
      setTimeout(() => setState('idle'), 3000)
    } catch {
      setState('idle')
      alert('Failed to reach Kartify. Make sure it is running on port 4000.')
    }
  }, [state, onSimulated])

  return (
    <button
      onClick={handleClick}
      disabled={state === 'loading'}
      className={`relative overflow-hidden px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 ${
        state === 'loading'
          ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
          : state === 'done'
          ? 'bg-emerald-600 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]'
          : 'bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:shadow-[0_0_30px_rgba(239,68,68,0.5)] hover:scale-105 active:scale-95'
      }`}
    >
      {/* Animated shimmer for idle state */}
      {state === 'idle' && (
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      )}
      <span className="relative flex items-center gap-2">
        {state === 'loading' ? (
          <>
            <span className="inline-block h-4 w-4 rounded-full border-2 border-slate-500 border-t-slate-300 animate-spin" />
            Triggering incident…
          </>
        ) : state === 'done' ? (
          <>✓ Incident created!</>
        ) : (
          <>🚨 Simulate Incident</>
        )}
      </span>
    </button>
  )
}
