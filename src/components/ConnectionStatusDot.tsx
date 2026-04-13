'use client'

import { useNetworkStatusOptional } from '@/lib/network-context'
import { useLocale } from '@/lib/locale-context'

/**
 * Pallino verde/rosso stato connessione (navigator + probe opzionale).
 */
export default function ConnectionStatusDot() {
  const net = useNetworkStatusOptional()
  const { t } = useLocale()
  if (!net) return null

  const label = net.online ? t.ui.connectionOnline : t.ui.connectionOffline

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-600/50 bg-slate-900/80 px-2 py-0.5"
      title={label}
      role="status"
      aria-label={label}
    >
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${
          net.online ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
        }`}
      />
      <span className="hidden text-[10px] font-medium text-slate-400 sm:inline">{label}</span>
    </span>
  )
}
