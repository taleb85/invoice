'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'

/**
 * Contesto per la floating action bar.
 * Le pagine registrano le azioni con `useFloatingActions()`.
 * Il provider (nell'app layout) rende la barra con le azioni correnti.
 */

type FloatingBarCtx = {
  setActions: (actions: ReactNode | null) => void
  setPadding: (active: boolean) => void
}

const Ctx = createContext<FloatingBarCtx>({
  setActions: () => {},
  setPadding: () => {},
})

/**
 * Provider da montare nell'app layout (o AppShell).
 * Rende la barra fissa in fondo alle pagine che registrano azioni.
 */
export function FloatingBarProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<ReactNode | null>(null)
  const [paddingActive, setPaddingActive] = useState(false)

  const handleSetActions = useCallback((a: ReactNode | null) => setActions(a), [])
  const handleSetPadding = useCallback((v: boolean) => setPaddingActive(v), [])

  return (
    <Ctx.Provider value={{ setActions: handleSetActions, setPadding: handleSetPadding }}>
      {children}
      {actions && (
        <div
          className={`fixed bottom-0 left-0 right-0 z-50 hidden border-t border-app-soft-border bg-[#0b1524]/85 backdrop-blur-lg md:block lg:left-12 ${
            paddingActive ? '' : ''
          }`}
        >
          <div className="mx-auto flex max-w-full items-center gap-2 px-3 py-1.5 xl:px-4 xl:py-2">
            {actions}
          </div>
        </div>
      )}
    </Ctx.Provider>
  )
}

/**
 * Hook per le pagine: registra le azioni della floating bar.
 * Le azioni vengono automaticamente rimosse quando la pagina si smonta.
 */
export function useFloatingActions(actions: ReactNode | null) {
  const { setActions, setPadding } = useContext(Ctx)

  useEffect(() => {
    setActions(actions)
    setPadding(actions !== null)
    return () => {
      setActions(null)
      setPadding(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions !== null ? 'has-actions' : 'no-actions'])
}

/**
 * Floating action bar component (usato direttamente se non si vuole il context).
 * Nascondi su mobile, rispetta la sidebar.
 */
export function FloatingActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 hidden border-t border-app-soft-border bg-[#0b1524]/85 backdrop-blur-lg md:block lg:left-12">
      <div className="mx-auto flex max-w-full items-center gap-2 px-3 py-1.5 xl:px-4 xl:py-2">
        {children}
      </div>
    </div>
  )
}

/** Pulsante azione standard per la floating bar. */
export function FloatingBarButton({
  icon,
  children,
  onClick,
  disabled,
  loading,
  variant = 'default',
  title,
}: {
  icon?: ReactNode
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  variant?: 'default' | 'primary' | 'cyan' | 'amber' | 'emerald'
  title?: string
}) {
  const variantCls = {
    default:
      'border-app-line-28 bg-white/[0.04] text-app-fg hover:border-app-cyan-500/35 hover:bg-cyan-500/[0.08]',
    primary:
      'bg-app-cyan-500 text-cyan-950 hover:bg-app-cyan-400 active:bg-cyan-600 border-transparent font-bold',
    cyan:
      'border-app-cyan-400/40 bg-transparent text-app-cyan-200 hover:border-app-cyan-400/60 hover:bg-cyan-400/10',
    amber:
      'border-amber-500/40 bg-amber-500/10 text-amber-100 hover:bg-amber-500/18',
    emerald:
      'border-emerald-500/35 bg-emerald-500/8 text-emerald-200/95 hover:bg-emerald-500/15',
  }[variant]

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold leading-none transition-colors disabled:opacity-50 ${variantCls}`}
    >
      {loading ? (
        <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : icon ? (
        <span className="h-3 w-3 shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  )
}

/** Link azione standard per la floating bar (Next.js Link). */
import Link from 'next/link'

export function FloatingBarLink({
  icon,
  children,
  href,
  onClick,
  variant = 'default',
  title,
}: {
  icon?: ReactNode
  children: ReactNode
  href: string
  onClick?: () => void
  variant?: 'default' | 'primary' | 'cyan' | 'amber' | 'emerald'
  title?: string
}) {
  const variantCls = {
    default:
      'border-app-line-28 bg-white/[0.04] text-app-fg hover:border-app-cyan-500/35 hover:bg-cyan-500/[0.08]',
    primary:
      'bg-app-cyan-500 text-cyan-950 hover:bg-app-cyan-400 active:bg-cyan-600 border-transparent font-bold',
    cyan:
      'border-app-cyan-400/40 bg-transparent text-app-cyan-200 hover:border-app-cyan-400/60 hover:bg-cyan-400/10',
    amber:
      'border-amber-500/40 bg-amber-500/10 text-amber-100 hover:bg-amber-500/18',
    emerald:
      'border-emerald-500/35 bg-emerald-500/8 text-emerald-200/95 hover:bg-emerald-500/15',
  }[variant]

  return (
    <Link
      href={href}
      onClick={onClick}
      title={title}
      className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold leading-none transition-colors ${variantCls}`}
    >
      {icon ? <span className="h-3 w-3 shrink-0">{icon}</span> : null}
      {children}
    </Link>
  )
}

/** Spacer elastico che spinge le azioni a destra. */
export function FloatingBarSpacer() {
  return <div className="flex-1" />
}

/** Navigatore (prev / current / next) per la floating bar. */
export function FloatingBarNav({
  current,
  total,
  onPrev,
  onNext,
  disabledPrev,
  disabledNext,
  busy,
  ariaLabel,
  positionTitle,
}: {
  current: number
  total: number
  onPrev: () => void
  onNext: () => void
  disabledPrev?: boolean
  disabledNext?: boolean
  busy?: boolean
  ariaLabel: string
  positionTitle: string
}) {
  const navBtn =
    'inline-flex h-6 w-6 items-center justify-center rounded border border-app-line-28 bg-transparent text-app-fg transition-colors hover:border-app-cyan-500/35 hover:bg-cyan-500/[0.08] disabled:pointer-events-none disabled:opacity-40'
  return (
    <div className="flex items-center gap-0.5" role="group" aria-label={ariaLabel}>
      <button
        type="button"
        disabled={disabledPrev || busy}
        title={ariaLabel}
        aria-label={ariaLabel}
        onClick={onPrev}
        className={navBtn}
      >
        <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <span
        className="min-w-[2.25rem] text-center text-[10px] font-semibold tabular-nums text-app-fg-muted"
        title={positionTitle}
      >
        {current}/{total}
      </span>
      <button
        type="button"
        disabled={disabledNext || busy}
        title={ariaLabel}
        aria-label={ariaLabel}
        onClick={onNext}
        className={navBtn}
      >
        <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  )
}
