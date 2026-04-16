import type { HTMLAttributes } from 'react'

/** Rosso / verde / arancio neon — duplicati, pagato, in attesa (e varianti). */
export type StatusBadgeTone = 'red' | 'green' | 'orange' | 'violet'

const TONE_CLASS: Record<StatusBadgeTone, string> = {
  red: 'border-[#FF3131]/55 bg-red-950/50 text-red-100 shadow-[0_0_12px_rgba(255,49,49,0.35)]',
  green:
    'border-[#39FF14]/45 bg-emerald-950/45 text-[#b8ffc4] shadow-[0_0_12px_rgba(57,255,20,0.22)]',
  orange: 'border-orange-400/55 bg-orange-950/50 text-orange-100 shadow-[0_0_12px_rgba(251,146,60,0.32)]',
  violet: 'border-violet-400/50 bg-violet-950/45 text-violet-100 shadow-[0_0_12px_rgba(167,139,250,0.28)]',
}

export const STATUS_BADGE_BASE =
  'inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide transition-[border-color,background-color,box-shadow] duration-150'

export function statusBadgeClassName(tone: StatusBadgeTone, className = ''): string {
  return `${STATUS_BADGE_BASE} ${TONE_CLASS[tone]} ${className}`.trim()
}

export type StatusBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone: StatusBadgeTone
  dot?: 'emerald' | 'amber' | 'rose' | 'none'
}

export function StatusBadge({ tone, dot = 'none', className = '', children, ...rest }: StatusBadgeProps) {
  const dotCls =
    dot === 'emerald'
      ? 'h-1.5 w-1.5 rounded-full bg-emerald-400'
      : dot === 'amber'
        ? 'h-1.5 w-1.5 rounded-full bg-amber-400'
        : dot === 'rose'
          ? 'h-1.5 w-1.5 rounded-full bg-rose-400'
          : ''
  return (
    <span className={statusBadgeClassName(tone, className)} {...rest}>
      {dot !== 'none' ? <span className={dotCls} aria-hidden /> : null}
      {children}
    </span>
  )
}
