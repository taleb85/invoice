'use client'

import { useNetworkStatusOptional } from '@/lib/network-context'
import { useLocale } from '@/lib/locale-context'
import { getTranslations, type Locale } from '@/lib/translations'

/**
 * Pallino verde/rosso stato connessione (navigator + probe opzionale).
 */
export default function ConnectionStatusDot() {
  const net = useNetworkStatusOptional()
  const { locale } = useLocale()
  if (!net) return null

  const mode: 'online' | 'reconnecting' | 'offline' = !net.online
    ? 'offline'
    : net.reconnecting
      ? 'reconnecting'
      : 'online'

  // Derive copy from `locale` + `getTranslations` so SSR and first client paint match
  // even if a stale/default `t` from context were briefly out of sync during hydration.
  const tr = getTranslations(locale as Locale)
  const label =
    mode === 'offline'
      ? tr.ui.connectionOffline
      : mode === 'reconnecting'
        ? tr.ui.connectionReconnecting
        : tr.ui.connectionOnline

  const dotClass =
    mode === 'online'
      ? 'connection-status-dot connection-status-dot--online h-2.5 w-2.5 shrink-0 md:h-2 md:w-2'
      : mode === 'reconnecting'
        ? 'connection-status-dot connection-status-dot--reconnecting h-2.5 w-2.5 shrink-0 md:h-2 md:w-2'
        : 'connection-status-dot connection-status-dot--offline h-2.5 w-2.5 shrink-0 md:h-2 md:w-2'

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/20 bg-white/[0.06] px-2 py-1 shadow-[0_0_16px_-4px_rgba(34,211,238,0.12)] md:py-0.5"
      title={label}
      role="status"
      aria-label={label}
    >
      <span className={dotClass} />
      <span className="hidden text-[10px] font-medium text-slate-100 sm:inline">{label}</span>
    </span>
  )
}
