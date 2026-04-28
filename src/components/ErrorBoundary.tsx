'use client'

import { Component, useCallback, useState, type ErrorInfo, type ReactNode } from 'react'
import { iconAccentClass as icon } from '@/lib/icon-accent-classes'

interface Props {
  children: ReactNode
  /** Custom fallback replaces the default UI entirely. */
  fallback?: ReactNode
  /**
   * Heading text for the error card. Use one or the other:
   *  - `sectionName`  — "Errore in {sectionName}" (new style, from error-boundary pattern)
   *  - `fallbackTitle` — shown as-is in the card (legacy prop for existing callers)
   * `sectionName` takes precedence when both are provided.
   */
  sectionName?: string
  /** @deprecated Use `sectionName` instead. Kept for backward compatibility. */
  fallbackTitle?: string
  /**
   * `compact`  — one-line banner (for widget slots, sidebar, header items).
   * `fullPage` — centered in `min-h-dvh` (for shell-level crashes).
   * default    — medium card (for page sections / panels).
   */
  compact?: boolean
  fullPage?: boolean
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * React class-based Error Boundary for granular fault isolation.
 *
 * Complements Next.js route-level `error.tsx` files:
 *  - `error.tsx`      → catches full route-segment crashes
 *  - `ErrorBoundary`  → catches sub-component crashes within a route
 *
 * Placement in AppShell:
 *  - `fullPage`  around the root visual container (last resort before white screen)
 *  - default     around `<BranchSessionGate>` (page content isolation)
 *  - default     around each `<Sidebar>` (nav crash ≠ page crash)
 *  - `fallback={null}` around `<EmailSyncProgressBar>` (silent fallback)
 *
 * @example widget (compact banner)
 * ```tsx
 * <ErrorBoundary sectionName="sincronizzazione email" compact>
 *   <StatoSincronizzazioneIntelligente ... />
 * </ErrorBoundary>
 * ```
 *
 * @example page section
 * ```tsx
 * <ErrorBoundary sectionName="risultati sincronizzazione email">
 *   <EmailScanResults ... />
 * </ErrorBoundary>
 * ```
 *
 * @example shell-level safety net
 * ```tsx
 * <ErrorBoundary fullPage sectionName="applicazione">
 *   <AppShellMain>{children}</AppShellMain>
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[ErrorBoundary]', error, info.componentStack)
    }
  }

  private handleReset = () => this.setState({ hasError: false, error: null })

  render() {
    if (!this.state.hasError) return this.props.children
    if (this.props.fallback !== undefined) return this.props.fallback

    const {
      sectionName,
      fallbackTitle,
      compact = false,
      fullPage = false,
    } = this.props
    const { error } = this.state
    const isDev = process.env.NODE_ENV === 'development'

    // Resolve heading: sectionName wins; fallbackTitle is the legacy alias
    const title = sectionName
      ? `Errore in ${sectionName}`
      : (fallbackTitle ?? 'Modulo non disponibile')

    /* ── Compact: one-line banner for widget / sidebar slots ── */
    if (compact) {
      return (
        <div className="flex items-center gap-2 rounded-lg border border-[rgba(34,211,238,0.15)] bg-red-500/8 px-3 py-2">
          <svg className="h-4 w-4 shrink-0 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="min-w-0 flex-1 truncate text-xs text-red-300">{title}</p>
          <button
            type="button"
            onClick={this.handleReset}
            className="shrink-0 rounded-md border border-[rgba(34,211,238,0.15)] bg-red-950/40 px-2 py-1 text-[10px] font-semibold text-red-200 transition-colors hover:bg-red-950/60"
          >
            Riprova
          </button>
        </div>
      )
    }

    /* ── Full-page: centred in viewport for shell-level crashes ── */
    if (fullPage) {
      return (
        <div className="flex min-h-dvh flex-1 items-center justify-center p-4">
          <ErrorCard title={title} error={error} isDev={isDev} onReset={this.handleReset} />
        </div>
      )
    }

    /* ── Default: medium card for page sections / panels ── */
    return (
      <div className="flex min-h-[180px] flex-1 items-center justify-center p-4">
        <ErrorCard title={title} error={error} isDev={isDev} onReset={this.handleReset} />
      </div>
    )
  }
}

/** Presentational card — no hooks, safe to call from class `render()`. */
function ErrorCard({
  title,
  error,
  isDev,
  onReset,
}: {
  title: string
  error: Error | null
  isDev: boolean
  onReset: () => void
}) {
  return (
    <div className="w-full max-w-md space-y-5 text-center">
      <div className="flex justify-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgba(34,211,238,0.15)] bg-red-950/40">
          <svg className="h-6 w-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
      </div>

      <div className="app-card app-card-transparent overflow-hidden text-left">
        <div className="space-y-4 px-8 py-7 text-center">
          <h2 className="text-base font-semibold text-app-fg">{title}</h2>
          <p className="text-sm leading-relaxed text-app-fg-muted">
            Si è verificato un problema imprevisto. I tuoi dati sono al sicuro.
          </p>

          {isDev && error && (
            <details className="text-left">
              <summary className="cursor-pointer text-xs text-app-fg-muted hover:text-app-fg">
                Dettagli tecnici (solo in sviluppo)
              </summary>
              <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap rounded-lg border border-[rgba(34,211,238,0.15)] bg-red-950/40 px-3 py-2 font-mono text-[11px] text-red-300">
                {error.message}
                {error.stack ? `\n\n${error.stack}` : ''}
              </pre>
            </details>
          )}

          <div className="flex flex-col gap-2.5 pt-1 sm:flex-row">
            <button
              type="button"
              onClick={onReset}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-app-cyan-500 px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 active:opacity-80"
            >
              <svg className={`h-4 w-4 ${icon.emailSync}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Riprova
            </button>
            <button
              type="button"
              onClick={() => { window.location.href = '/' }}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-app-line-32 app-workspace-inset-bg px-4 py-2.5 text-sm font-medium text-app-fg-muted transition-colors hover:bg-app-line-12 hover:text-app-fg"
            >
              <svg className={`h-4 w-4 ${icon.home}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Home
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Default export for backward compatibility with existing callers
// (`import ErrorBoundary from '@/components/ErrorBoundary'`).
export default ErrorBoundary

/**
 * Bridges async / event-handler errors into the nearest ErrorBoundary.
 *
 * Error boundaries only catch errors thrown during render or lifecycle
 * methods — NOT inside `useEffect`, event handlers, or promise `.catch()`.
 * This hook works around that by scheduling a state update whose updater
 * throws; React evaluates it during the next render inside the boundary.
 *
 * @example
 * const throwToBoundary = useErrorBoundary()
 * useEffect(() => { fetchData().catch(throwToBoundary) }, [throwToBoundary])
 */
export function useErrorBoundary() {
  const [, setState] = useState<unknown>()
  return useCallback((error: unknown) => {
    setState(() => { throw error })
  }, [])
}
