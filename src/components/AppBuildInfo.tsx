'use client'

import { useLocale } from '@/lib/locale-context'
import { formatAppBuildLine } from '@/lib/app-build-info'

type Props = {
  className?: string
  /** Più piccolo e attenuato (es. footer sidebar). */
  compact?: boolean
  /** In cima alla sidebar, a destra del wordmark (stretto, allineato a destra). */
  variant?: 'default' | 'rail'
}

export default function AppBuildInfo({ className = '', compact, variant = 'default' }: Props) {
  const { t } = useLocale()
  const line = formatAppBuildLine(t.ui)

  return (
    <p
      className={[
        'select-text font-mono tabular-nums tracking-tight',
        variant === 'rail'
          ? 'max-w-[6.5rem] text-right text-[7px] leading-tight text-white/28 sm:max-w-[7.25rem] sm:text-[8px]'
          : compact
            ? 'text-[9px] leading-snug text-white/22'
            : 'text-[11px] text-app-fg-muted/90',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      title={t.ui.appBuildAria}
    >
      {line}
    </p>
  )
}
