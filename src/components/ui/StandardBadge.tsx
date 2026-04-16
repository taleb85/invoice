import type { HTMLAttributes } from 'react'

export type StandardBadgeVariant = 'duplicate' | 'urgent' | 'pending' | 'success'

const VARIANT_CLASS: Record<StandardBadgeVariant, string> = {
  duplicate:
    'border-orange-500/55 bg-orange-950/45 text-orange-200 shadow-[0_0_10px_rgba(251,146,60,0.35)]',
  urgent:
    'border-rose-500/50 bg-rose-950/40 text-rose-100 shadow-[0_0_12px_rgba(244,63,94,0.35)]',
  pending:
    'border-amber-500/35 bg-amber-500/15 text-amber-200 shadow-[0_0_8px_rgba(251,191,36,0.22)]',
  success:
    'border-emerald-500/35 bg-emerald-500/15 text-emerald-200 shadow-[0_0_8px_rgba(52,211,153,0.22)]',
}

export const STANDARD_BADGE_BASE =
  'inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide transition-[border-color,background-color,box-shadow] duration-150'

export function standardBadgeClassName(variant: StandardBadgeVariant, className = ''): string {
  return `${STANDARD_BADGE_BASE} ${VARIANT_CLASS[variant]} ${className}`.trim()
}

export type StandardBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant: StandardBadgeVariant
  /** Con punto stato (Bolle completato / in attesa). */
  dot?: 'emerald' | 'amber' | 'rose' | 'none'
}

export function StandardBadge({ variant, dot = 'none', className = '', children, ...rest }: StandardBadgeProps) {
  const dotCls =
    dot === 'emerald'
      ? 'h-1.5 w-1.5 rounded-full bg-emerald-400'
      : dot === 'amber'
        ? 'h-1.5 w-1.5 rounded-full bg-amber-400'
        : dot === 'rose'
          ? 'h-1.5 w-1.5 rounded-full bg-rose-400'
          : ''
  return (
    <span className={`${STANDARD_BADGE_BASE} ${VARIANT_CLASS[variant]} ${className}`.trim()} {...rest}>
      {dot !== 'none' ? <span className={dotCls} aria-hidden /> : null}
      {children}
    </span>
  )
}
