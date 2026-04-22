'use client'

export type KpiCardProps = {
  title: string
  value: string
  subtitle?: string
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  color?: 'cyan' | 'purple' | 'green' | 'red' | 'amber'
  onClick?: () => void
}

const colorMap = {
  cyan: {
    border: 'border-app-soft-border',
    bar: 'bg-gradient-to-r from-cyan-400 via-cyan-500 to-teal-700 shadow-[0_0_16px_rgba(34,211,238,0.35)]',
    badge: 'bg-[#22d3ee]/10 text-[#22d3ee]',
  },
  purple: {
    border: 'border-violet-500/25',
    bar: 'bg-gradient-to-r from-violet-500 via-violet-400 to-violet-800 shadow-[0_0_16px_rgba(139,92,246,0.4)]',
    badge: 'bg-violet-400/10 text-violet-300',
  },
  green: {
    border: 'border-emerald-500/20',
    bar: 'bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-700 shadow-[0_0_16px_rgba(16,185,129,0.4)]',
    badge: 'bg-emerald-400/10 text-emerald-400',
  },
  red: {
    border: 'border-rose-500/25',
    bar: 'bg-gradient-to-r from-rose-500 via-rose-400 to-rose-700 shadow-[0_0_16px_rgba(244,63,94,0.4)]',
    badge: 'bg-rose-400/10 text-rose-400',
  },
  amber: {
    border: 'border-amber-500/20',
    bar: 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-700 shadow-[0_0_16px_rgba(245,158,11,0.4)]',
    badge: 'bg-amber-400/10 text-amber-300',
  },
}

export function KpiCard({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  color = 'cyan',
  onClick,
}: KpiCardProps) {
  const c = colorMap[color]

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`relative overflow-hidden rounded-2xl border ${c.border} bg-transparent transition-all ${onClick ? 'cursor-pointer hover:brightness-110 active:scale-[0.99]' : ''}`}
    >
      <div className={`h-0.5 w-full shrink-0 ${c.bar}`} aria-hidden />
      <div className="px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-app-fg-muted">{title}</p>

        <p className="mt-1.5 text-2xl font-bold leading-none tabular-nums text-app-fg">{value}</p>

        {(subtitle || (trend && trendValue)) && (
          <div className="mt-2 flex items-center gap-2">
            {trend && trendValue && (
              <span
                className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
                  trend === 'up'
                    ? 'text-emerald-400'
                    : trend === 'down'
                      ? 'text-rose-400'
                      : 'text-app-fg-muted'
                }`}
              >
                {trend === 'up' && (
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                  </svg>
                )}
                {trend === 'down' && (
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
                {trendValue}
              </span>
            )}
            {subtitle && <p className="text-xs text-app-fg-muted">{subtitle}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
