import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { AURORA_GLASS_CARD_TOP_BAR_CLASS, AURORA_GLASS_PANEL_LAYOUT_CLASS } from '@/lib/summary-highlight-accent'

type ShellProps = {
  children: ReactNode
  className?: string
  /** Vetro più pieno su `LoginBrandedShell` (ex `app-card-login-transparent`). */
  tone?: 'default' | 'soft'
  /** Se false non renderizza la striscia (es. contenitori nidificati). */
  showTopBar?: boolean
  topBarClassName?: string
} & Omit<ComponentPropsWithoutRef<'section'>, 'className' | 'children'>

/**
 * Guscio pannello unico Aurora: stesso sistema di vetro delle card Dashboard (scanner / KPI grid)
 * dentro `[data-deep-aurora-integration]` o `[data-deep-aurora-public-shell]`.
 */
export function AuroraPanelShell({
  children,
  className = '',
  tone = 'default',
  showTopBar = true,
  topBarClassName,
  ...rest
}: ShellProps) {
  const strip = topBarClassName ?? AURORA_GLASS_CARD_TOP_BAR_CLASS
  const toneClass = tone === 'soft' ? 'aurora-public-panel-soft' : ''
  return (
    <section
      className={[AURORA_GLASS_PANEL_LAYOUT_CLASS, toneClass, className].filter(Boolean).join(' ')}
      {...rest}
    >
      {showTopBar ? <div className={strip} aria-hidden /> : null}
      {children}
    </section>
  )
}
