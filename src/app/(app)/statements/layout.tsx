'use client'

import { useLayoutEffect } from 'react'
import { usePathname } from 'next/navigation'
import {
  SUMMARY_HIGHLIGHT_ACCENTS,
  type SummaryHighlightAccent,
} from '@/lib/summary-highlight-accent'
import { useT } from '@/lib/use-t'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import StatementsSummaryHighlight from '@/components/StatementsSummaryHighlight'

export default function StatementsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? ''
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
      </AppPageHeaderStrip>

      <StatementsSummaryHighlight />

      <div className={`app-card mb-6 overflow-hidden ${statementsMainTheme.border}`}>
        <div className={`app-card-bar ${statementsMainTheme.bar}`} aria-hidden />
        <div className="min-h-[12rem] px-5 py-4 sm:px-6 sm:py-5">{children}</div>
      </div>
    </div>
  )
}
