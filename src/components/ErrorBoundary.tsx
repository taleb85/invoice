'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /**
   * Testo mostrato nell'header del fallback (default: "Modulo non disponibile").
   * Mantienilo breve — è visibile inline, non a schermo pieno.
   */
  fallbackTitle?: string
  /** Mostra il fallback in stile compatto (per widget nella sidebar/header). */
  compact?: boolean
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * ErrorBoundary React class component per isolare moduli volatili.
 * Evita che il crash di un widget (es. sync email, KPI grid) propaghi
 * all'intera pagina. Usa `error.tsx` di Next.js per errori di rendering
 * dell'intera route; usa questo per sezioni interne.
 *
 * @example
 * ```tsx
 * <ErrorBoundary fallbackTitle="Sincronizzazione non disponibile">
 *   <StatoSincronizzazioneIntelligente ... />
 * </ErrorBoundary>
 * ```
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log server-side visibile nei Vercel Function logs — non inquina la console browser in prod.
    if (process.env.NODE_ENV === 'development') {
      console.error('[ErrorBoundary]', error, info.componentStack)
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const { fallbackTitle = 'Modulo non disponibile', compact = false } = this.props
    const isDev = process.env.NODE_ENV === 'development'

    if (compact) {
      return (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/25 bg-red-500/8 px-3 py-2">
          <svg className="h-4 w-4 shrink-0 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="min-w-0 flex-1 truncate text-xs text-red-300">{fallbackTitle}</p>
          <button
            type="button"
            onClick={this.handleReset}
            className="shrink-0 rounded-md border border-red-500/30 bg-red-950/40 px-2 py-1 text-[10px] font-semibold text-red-200 transition-colors hover:bg-red-950/60"
          >
            Riprova
          </button>
        </div>
      )
    }

    return (
      <div className="rounded-xl border border-red-500/25 bg-red-500/8 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-red-500/30 bg-red-950/45">
            <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-app-fg">{fallbackTitle}</p>
            <p className="mt-0.5 text-xs text-app-fg-muted">
              Si è verificato un errore inatteso. I tuoi dati sono al sicuro.
            </p>
            {isDev && this.state.error && (
              <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg border border-red-500/30 bg-red-950/40 px-2.5 py-2 text-[11px] text-red-300">
                {this.state.error.message}
              </pre>
            )}
          </div>
          <button
            type="button"
            onClick={this.handleReset}
            className="shrink-0 rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-1.5 text-xs font-semibold text-red-200 transition-colors hover:bg-red-950/60"
          >
            Riprova
          </button>
        </div>
      </div>
    )
  }
}
