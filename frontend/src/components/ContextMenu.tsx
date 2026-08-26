import { useEffect, useRef } from 'react'

export interface MenuItem {
  label: string
  icon?: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
  divider?: boolean
}

interface Props {
  x: number
  y: number
  items: MenuItem[]
  onClose: () => void
  title?: string
}

export function ContextMenu({ x, y, items, onClose, title }: Props) {
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('mousedown', handleOutsideClick)
    window.addEventListener('scroll', onClose, true)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('mousedown', handleOutsideClick)
      window.removeEventListener('scroll', onClose, true)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  // Screen edge boundary adjustment
  const menuWidth = 220
  const menuHeight = items.length * 36 + (title ? 32 : 0) + 16
  const adjustedX = Math.min(x, window.innerWidth - menuWidth - 12)
  const adjustedY = Math.min(y, window.innerHeight - menuHeight - 12)

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: `${Math.max(12, adjustedX)}px`,
        top: `${Math.max(12, adjustedY)}px`,
        zIndex: 9999,
      }}
      className="w-56 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 font-sans text-xs animate-in fade-in zoom-in-95 duration-100 select-none overflow-hidden"
    >
      {title && (
        <div className="px-3 py-1.5 border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
          <span className="truncate">{title}</span>
          <span className="text-[10px] text-slate-400 font-mono">Menu</span>
        </div>
      )}

      <div className="py-1">
        {items.map((item, index) => {
          if (item.divider) {
            return <div key={index} className="my-1 border-t border-slate-100" />
          }

          return (
            <button
              key={index}
              onClick={() => {
                if (item.disabled) return
                item.onClick()
                onClose()
              }}
              disabled={item.disabled}
              className={`w-full px-3 py-2 text-left flex items-center gap-2.5 transition-colors cursor-pointer text-xs ${
                item.disabled
                  ? 'opacity-40 cursor-not-allowed text-slate-400'
                  : item.danger
                  ? 'text-rose-600 hover:bg-rose-50 hover:text-rose-700 font-medium'
                  : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900 font-medium'
              }`}
            >
              {item.icon && <span className="text-sm flex-shrink-0">{item.icon}</span>}
              <span className="flex-1 truncate">{item.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
