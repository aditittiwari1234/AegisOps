import { useState, useCallback } from 'react'
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
      className={`relative overflow-hidden px-4 py-2 rounded-xl font-semibold text-xs sm:text-sm transition-all duration-200 cursor-pointer ${
        state === 'loading'
          ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
          : state === 'done'
          ? 'bg-emerald-600 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]'
          : 'bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.25)] hover:shadow-[0_0_25px_rgba(239,68,68,0.4)] hover:scale-102 active:scale-98'
      }`}
    >
      {/* Animated shimmer for idle state */}
      {state === 'idle' && (
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      )}
      <span className="relative flex items-center gap-2">
        {state === 'loading' ? (
          <>
            <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
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
