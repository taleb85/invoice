import Link from 'next/link'
import { getT } from '@/lib/locale-server'

const secondaryBtn =
  'inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-app-line-25 app-workspace-inset-bg-soft px-3 py-2.5 text-sm font-medium text-app-fg-muted transition-colors hover:border-app-a-40 hover:bg-app-line-10 hover:text-app-fg'

/**
 * Bolla o fattura assente / non visibile (RLS): messaggio chiaro senza `notFound()` globale.
 */
export default async function DocumentUnavailable({ kind }: { kind: 'bolla' | 'fattura' }) {
  const t = await getT()
  const title =
    kind === 'bolla' ? t.appStrings.docUnavailableBollaTitle : t.appStrings.docUnavailableFatturaTitle
  const desc =
    kind === 'bolla' ? t.appStrings.docUnavailableBollaDesc : t.appStrings.docUnavailableFatturaDesc

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-4 md:min-h-[60vh]">
      <div className="w-full max-w-md space-y-5 text-center">
        <div className="app-card-login flex flex-col overflow-hidden">
          <div className="app-card-bar shrink-0" aria-hidden />
          <div className="space-y-4 px-6 py-8">
          <h1 className="app-page-title text-xl font-bold">{title}</h1>
          <p className="text-sm leading-relaxed text-app-fg-muted">{desc}</p>
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <Link
              href="/"
              className="col-span-2 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-app-cyan-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-cyan-600"
            >
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              {t.appStrings.backToHome}
            </Link>
            <Link href="/fornitori" className={secondaryBtn}>
              {t.nav.fornitori}
            </Link>
            <Link href="/bolle" className={secondaryBtn}>
              {t.nav.bolle}
            </Link>
            <Link href="/fatture" className={`col-span-2 ${secondaryBtn}`}>
              {t.nav.fatture}
            </Link>
          </div>
          </div>
        </div>
        <p className="text-xs text-app-fg-muted">{t.appStrings.brandFooter}</p>
      </div>
    </div>
  )
}
