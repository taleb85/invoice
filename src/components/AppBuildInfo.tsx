'use client'

import { useLocale } from '@/lib/locale-context'
import { formatAppBuildLine, formatAppVersionLabel } from '@/lib/app-build-info'

type Props = {
  className?: string
  /** Più piccolo e attenuato (es. footer sidebar). */
  compact?: boolean
  /** `rail` = sotto il wordmark in sidebar (Aurora). */
  variant?: 'default' | 'rail'
}

export default function AppBuildInfo({ className = '', compact, variant = 'default' }: Props) {
  const { t } = useLocale()
  const line = variant === 'rail' ? formatAppVersionLabel() : formatAppBuildLine(t.ui)

  return (
    <p
      className={[
        'select-text font-outfit tracking-tight',
        variant === 'rail'
          ? 'm-0 text-left text-[8px] leading-none uppercase tracking-wider text-[#94a3b8] opacity-95 tabular-nums sm:text-[9px]'
          : compact
            ? 'text-[9px] leading-snug text-white/22'
            : 'text-[11px] text-app-fg-muted/90',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      title={variant === 'rail' ? line : t.ui.appBuildAria}
    >
      {line}
    </p>
  )
}
