'use client'

import { useLayoutEffect, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { STATEMENTS_LAYOUT_REFRESH_EVENT } from '@/lib/statements-layout-refresh'
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

  const navLinkInner =
    'flex min-h-[88px] w-full flex-col justify-center px-4 py-4 transition-colors touch-manipulation sm:min-h-0 sm:px-5 sm:py-5'

  return (
    <div className="w-full min-w-0 p-4 md:p-8">
      <AppPageHeaderStrip>
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

      {isVerifica ? (
        <div className="mb-6 w-full overflow-hidden rounded-2xl border border-sky-500/25 bg-slate-700/50 shadow-[0_0_24px_-8px_rgba(14,165,233,0.25)]">
          <Link
            href="/statements/verifica"
            className={`${navLinkInner} bg-sky-500/10 ring-1 ring-inset ring-sky-500/30`}
            aria-current="page"
          >
            <span className="text-sm font-semibold text-slate-100">{t.statements.tabVerifica}</span>
            <span className="mt-1 max-w-3xl text-xs leading-snug text-slate-300">{t.statements.schedaNavVerificaDesc}</span>
          </Link>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-600/45 bg-slate-800/55 shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset]">
        <div className="min-h-[12rem] rounded-xl bg-slate-950/35 p-4 ring-1 ring-inset ring-white/[0.07] md:p-6">
          {children}
        </div>
      </div>
    </div>
  )
}
