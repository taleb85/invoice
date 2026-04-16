import type { HTMLAttributes } from 'react'
import { StatusBadge, statusBadgeClassName, type StatusBadgeTone } from '@/components/ui/StatusBadge'

export type StandardBadgeVariant = 'duplicate' | 'urgent' | 'pending' | 'success'

const VARIANT_TONE: Record<StandardBadgeVariant, StatusBadgeTone> = {
  /** Duplicati — rosso neon (design system) */
  duplicate: 'red',
  urgent: 'red',
  pending: 'orange',
  success: 'green',
}

/** @deprecated Prefer `StatusBadge` con `tone` esplicito nelle nuove viste. */
export function standardBadgeClassName(variant: StandardBadgeVariant, className = ''): string {
  return statusBadgeClassName(VARIANT_TONE[variant], className)
}

export type StandardBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant: StandardBadgeVariant
  dot?: 'emerald' | 'amber' | 'rose' | 'none'
}

export function StandardBadge({ variant, dot = 'none', className = '', children, ...rest }: StandardBadgeProps) {
  return (
    <StatusBadge tone={VARIANT_TONE[variant]} dot={dot} className={className} {...rest}>
      {children}
    </StatusBadge>
  )
}

export { STATUS_BADGE_BASE as STANDARD_BADGE_BASE } from '@/components/ui/StatusBadge'
