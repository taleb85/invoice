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
    border: 'border-l-[#22d3ee]',
    glow: 'shadow-[0_0_20px_rgba(34,211,238,0.08)]',
    badge: 'bg-[#22d3ee]/10 text-[#22d3ee]',
  },
  purple: {
    border: 'border-l-[#818cf8]',
    glow: 'shadow-[0_0_20px_rgba(129,140,248,0.08)]',
    badge: 'bg-[#818cf8]/10 text-[#818cf8]',
  },
  green: {
    border: 'border-l-emerald-400',
    glow: 'shadow-[0_0_20px_rgba(52,211,153,0.08)]',
    badge: 'bg-emerald-400/10 text-emerald-400',
  },
  red: {
    border: 'border-l-rose-400',
    glow: 'shadow-[0_0_20px_rgba(251,113,133,0.08)]',
    badge: 'bg-rose-400/10 text-rose-400',
  },
  amber: {
    border: 'border-l-amber-400',
    glow: 'shadow-[0_0_20px_rgba(251,191,36,0.08)]',
    badge: 'bg-amber-400/10 text-amber-400',
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
      className={`relative rounded-2xl border border-app-line-22 border-l-4 ${c.border} bg-[#0f172b]/80 ${c.glow} px-5 py-4 transition-all ${onClick ? 'cursor-pointer hover:bg-[#0f172b] active:scale-[0.99]' : ''}`}
    >
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
  )
}
