'use client'

import { useLayoutEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useT } from '@/lib/use-t'

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

  const navLinkInner =
    'flex min-h-[88px] w-full flex-col justify-center px-4 py-4 transition-colors touch-manipulation sm:min-h-0 sm:px-5 sm:py-5'

  return (
    <div className="w-full min-w-0 p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">
          {isVerifica ? t.statements.heading : t.statements.tabDocumenti}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          {isVerifica ? (
            <>
              {t.nav.fornitori} ·{' '}
              <Link
                href="/statements/da-processare"
                className="text-slate-300 underline-offset-2 transition-colors hover:text-white hover:underline"
              >
                {t.statements.tabDocumenti}
              </Link>
              {' '}
              · {t.statements.tabVerifica}
            </>
          ) : (
            <>
              {t.nav.fornitori} · {t.statements.tabDocumenti} ·{' '}
              <Link
                href="/statements/verifica"
                className="text-slate-300 underline-offset-2 transition-colors hover:text-white hover:underline"
              >
                {t.statements.tabVerifica}
              </Link>
            </>
          )}
        </p>
      </div>

      {isVerifica ? (
        <div className="mb-6 w-full overflow-hidden rounded-2xl border border-sky-500/25 bg-slate-950/50 shadow-[0_0_24px_-8px_rgba(14,165,233,0.25)]">
          <Link
            href="/statements/verifica"
            className={`${navLinkInner} bg-sky-500/10 ring-1 ring-inset ring-sky-500/30`}
            aria-current="page"
          >
            <span className="text-sm font-semibold text-slate-100">{t.statements.tabVerifica}</span>
            <span className="mt-1 max-w-3xl text-xs leading-snug text-slate-500">{t.statements.schedaNavVerificaDesc}</span>
          </Link>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-700/55 bg-slate-900/85 shadow-sm">
        <div className="min-h-[12rem] p-4 md:p-6">{children}</div>
      </div>
    </div>
  )
}
