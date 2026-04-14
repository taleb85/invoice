'use client'

import { useLayoutEffect, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { STATEMENTS_LAYOUT_REFRESH_EVENT } from '@/lib/statements-layout-refresh'
import {
  SUMMARY_HIGHLIGHT_ACCENTS,
  type SummaryHighlightAccent,
} from '@/lib/summary-highlight-accent'
import { useT } from '@/lib/use-t'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import StatementsSummaryHighlight from '@/components/StatementsSummaryHighlight'

export default function StatementsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? ''
  const router = useRouter()
  const [isRefreshPending, startRefreshTransition] = useTransition()
  const t = useT()
  const isVerifica = pathname.includes('/verifica')

  /** AppShell usa `main` come scroll container (non `window`); senza reset il click dalla dashboard lascia lo scroll in basso e le schede/titolo restano fuori vista. */
  useLayoutEffect(() => {
    if (!pathname.startsWith('/statements')) return
    const scrollMain = () => {
      const main =
        document.querySelector<HTMLElement>('[data-app-main-scroll]') ??
        document.querySelector<HTMLElement>('main.overflow-y-auto')
      if (main) main.scrollTop = 0
    }
    scrollMain()
    const t0 = window.setTimeout(scrollMain, 0)
    const t1 = window.setTimeout(scrollMain, 80)
    return () => {
      window.clearTimeout(t0)
      window.clearTimeout(t1)
    }
  }, [pathname])

  const statementsPageAccent: SummaryHighlightAccent = isVerifica ? 'cyan' : 'amber'
  const statementsMainTheme = SUMMARY_HIGHLIGHT_ACCENTS[statementsPageAccent]

  return (
    <div className="w-full min-w-0 p-4 md:p-8">
      <AppPageHeaderStrip accent={statementsPageAccent}>
        <div className="min-w-0 flex-1">
          <h1 className="app-page-title text-2xl font-bold">
            {isVerifica ? t.statements.heading : t.statements.tabDocumenti}
          </h1>
        </div>
        <div className="flex min-w-0 w-full max-w-full flex-row flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end sm:gap-3 sm:shrink-0">
          <button
            type="button"
            onClick={() =>
              startRefreshTransition(() => {
                window.dispatchEvent(new Event(STATEMENTS_LAYOUT_REFRESH_EVENT))
                router.refresh()
              })
            }
            disabled={isRefreshPending}
            className="inline-flex min-h-[44px] shrink-0 touch-manipulation items-center justify-center gap-2 self-start rounded-xl border border-slate-600/55 bg-slate-800/45 px-3.5 py-2.5 text-sm font-medium text-slate-200 shadow-sm transition-colors hover:border-slate-500/60 hover:bg-slate-700/55 hover:text-white disabled:pointer-events-none disabled:opacity-50 sm:self-center"
            aria-label={t.statements.btnRefresh}
            aria-busy={isRefreshPending}
          >
            <svg
              className={`h-4 w-4 shrink-0 ${isRefreshPending ? 'animate-spin text-cyan-400' : 'text-slate-400'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span>{t.statements.btnRefresh}</span>
          </button>
        </div>
      </AppPageHeaderStrip>

      <StatementsSummaryHighlight />

      <div className={`app-card mb-6 overflow-hidden ${statementsMainTheme.border}`}>
        <div className={`app-card-bar ${statementsMainTheme.bar}`} aria-hidden />
        <div className="min-h-[12rem] px-5 py-4 sm:px-6 sm:py-5">{children}</div>
      </div>
    </div>
  )
}
