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
    border: 'border-white/10',
    bar: 'bg-gradient-to-r from-cyan-400/90 via-cyan-500/85 to-teal-800/70',
    badge: 'bg-[#22d3ee]/10 text-[#22d3ee]',
  },
  purple: {
    border: 'border-white/10',
    bar: 'bg-gradient-to-r from-violet-500/90 via-violet-400/80 to-violet-800/75',
    badge: 'bg-violet-400/10 text-violet-300',
  },
  green: {
    border: 'border-white/10',
    bar: 'bg-gradient-to-r from-emerald-500/90 via-emerald-400/85 to-emerald-800/72',
    badge: 'bg-emerald-400/10 text-emerald-400',
  },
  red: {
    border: 'border-white/10',
    bar: 'bg-gradient-to-r from-rose-500/88 via-rose-400/82 to-rose-800/72',
    badge: 'bg-rose-400/10 text-rose-400',
  },
  amber: {
    border: 'border-white/10',
    bar: 'bg-gradient-to-r from-amber-500/90 via-amber-400/82 to-amber-800/70',
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
      className={`relative overflow-hidden rounded-2xl border ${c.border} bg-transparent shadow-none backdrop-blur-none [-webkit-backdrop-filter:none] transition-all ${onClick ? 'cursor-pointer hover:bg-white/[0.04] active:scale-[0.99]' : ''}`}
    >
      <div className={`h-0.5 w-full shrink-0 ${c.bar}`} aria-hidden />
      <div className="px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/92">{title}</p>

        <p className="mt-1.5 text-2xl font-bold leading-none tabular-nums text-white">{value}</p>

        {(subtitle || (trend && trendValue)) && (
          <div className="mt-2 flex items-center gap-2">
            {trend && trendValue && (
              <span
                className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
                  trend === 'up'
                    ? 'text-emerald-300'
                    : trend === 'down'
                      ? 'text-rose-300'
                      : 'text-white/82'
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
            {subtitle && <p className="text-xs text-white/82">{subtitle}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
