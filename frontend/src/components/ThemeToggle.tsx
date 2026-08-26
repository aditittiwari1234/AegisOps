import { useTheme } from '../context/ThemeContext'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      onClick={toggleTheme}
      type="button"
      title={`Switch to ${isDark ? 'Light' : 'Dark'} theme`}
      aria-label="Toggle theme"
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all duration-200 cursor-pointer select-none bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700/80 shadow-xs"
    >
      <span className="text-sm">{isDark ? '🌙' : '☀️'}</span>
      <span className="font-semibold">{isDark ? 'Dark' : 'Light'}</span>
    </button>
  )
}
