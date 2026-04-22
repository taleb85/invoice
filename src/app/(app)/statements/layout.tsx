'use client'

import { Suspense, useLayoutEffect } from 'react'
import { usePathname } from 'next/navigation'
import {
  SUMMARY_HIGHLIGHT_ACCENTS,
  SUMMARY_HIGHLIGHT_CARD_INNER_PADDING_CLASS,
  SUMMARY_HIGHLIGHT_SURFACE_CLASS,
  type SummaryHighlightAccent,
} from '@/lib/summary-highlight-accent'
import { useT } from '@/lib/use-t'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { AppPageHeaderTitleWithDashboardShortcut } from '@/components/AppPageHeaderDashboardShortcut'
import DashboardFiscalYearHeaderSelectMe from '@/components/DashboardFiscalYearHeaderSelectMe'
import StatementsSummaryHighlight from '@/components/StatementsSummaryHighlight'
import {
  APP_SHELL_SECTION_PAGE_CLASS,
  APP_SHELL_SECTION_PAGE_H1_CLASS,
} from '@/lib/app-shell-layout'

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
  const statementsIcon = isVerifica
    ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
    : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>

  return (
    <div className={APP_SHELL_SECTION_PAGE_CLASS}>
      <AppPageHeaderStrip accent={statementsPageAccent} icon={statementsIcon} mergedSlot={<StatementsSummaryHighlight embedded />}>
        <AppPageHeaderTitleWithDashboardShortcut>
          <h1 className={`min-w-0 flex-1 truncate ${APP_SHELL_SECTION_PAGE_H1_CLASS}`}>
            {isVerifica ? t.statements.heading : t.statements.tabDocumenti}
          </h1>
        </AppPageHeaderTitleWithDashboardShortcut>
        <Suspense fallback={null}>
          <DashboardFiscalYearHeaderSelectMe />
        </Suspense>
      </AppPageHeaderStrip>

      <div className={`${SUMMARY_HIGHLIGHT_SURFACE_CLASS} mb-6 md:mb-8 ${statementsMainTheme.border}`}>
        <div className={`app-card-bar-accent ${statementsMainTheme.bar}`} aria-hidden />
        <div className={`min-h-[12rem] ${SUMMARY_HIGHLIGHT_CARD_INNER_PADDING_CLASS}`}>
          {children}
        </div>
      </div>
    </div>
  )
}
