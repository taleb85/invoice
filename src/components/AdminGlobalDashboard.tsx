import Link from 'next/link'
import type { Translations } from '@/lib/translations'
import { getLocale as getCountryLocale } from '@/lib/localization'
import { AdminSelectSedeButton } from '@/components/AdminSelectSedeButton'
import { dashboardManageSediLabel } from '@/lib/gestisci-sede-label'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'

export type AdminGlobalSedeCard = {
  id: string
  nome: string
  country_code?: string | null
  imap_host?: string | null
  imap_user?: string | null
  bolleInAttesa: number
  documentiInCoda: number
}

export function AdminGlobalDashboard({
  t,
  sediCards,
  globalTotals,
  erroriRecenti,
  associatedSedeNome = '',
}: {
  t: Translations
  sediCards: AdminGlobalSedeCard[]
  globalTotals: {
    totFornitori: number
    totBolle: number
    bolleInAttesa: number
    totFatture: number
  }
  erroriRecenti: number
  /** Nome sede sul profilo (o contesto) per etichetta «Gestisci …» */
  associatedSedeNome?: string | null
}) {
  const manageSediText = dashboardManageSediLabel(t, associatedSedeNome ?? '')
  return (
    <div className="max-w-5xl p-4 md:p-8">
      <div className="mb-8 w-full">
        <AppPageHeaderStrip embedded>
          <div className="min-w-0 sm:flex-1 sm:flex-initial">
            <h1 className="app-page-title text-xl font-bold md:text-2xl">{t.dashboard.adminGlobalTitle}</h1>
            <p className="mt-1 hidden text-sm text-slate-200 md:block">{t.dashboard.adminGlobalSubtitle}</p>
            <p className="mt-1 text-xs text-slate-500 md:hidden">{t.dashboard.adminGlobalSubtitle}</p>
          </div>
          <div className="-mx-4 flex w-[calc(100%+2rem)] min-w-0 shrink-0 flex-nowrap items-center justify-end gap-2 overflow-x-auto px-4 py-2.5 md:mx-0 md:w-auto md:overflow-visible md:px-0 md:py-0">
            <Link
              href="/log"
              className={`inline-flex h-11 min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-lg px-3.5 py-0 text-xs font-semibold transition-colors whitespace-nowrap touch-manipulation ${
                erroriRecenti > 0
                  ? 'bg-red-950/60 text-red-200 ring-1 ring-red-500/40 hover:bg-red-950/80'
                  : 'bg-slate-700/90 text-slate-200 hover:bg-slate-700'
              }`}
            >
              {erroriRecenti > 0 && (
                <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-600 px-0.5 text-[10px] font-bold text-white tabular-nums">
                  {erroriRecenti > 9 ? '9+' : erroriRecenti}
                </span>
              )}
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <span>{t.dashboard.viewLog}</span>
            </Link>
            <Link
              href="/sedi"
              className="inline-flex min-h-[44px] items-center rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-sm font-semibold text-cyan-200 transition-colors hover:bg-cyan-500/15"
            >
              {manageSediText}
            </Link>
          </div>
        </AppPageHeaderStrip>
      </div>

      {/* Aggregati globali (nessun filtro sede — RLS) */}
      <div className="mb-8 rounded-xl border border-cyan-500/20 bg-slate-700/50 p-4 shadow-[0_0_24px_-8px_rgba(6,182,212,0.25)] md:p-5">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-cyan-400/90">{t.dashboard.adminGlobalTotalsLabel}</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-3 text-center">
            <p className="text-2xl font-bold tabular-nums text-slate-100">{globalTotals.totFornitori}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t.dashboard.suppliers}</p>
          </div>
          <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 px-3 py-3 text-center">
            <p className="text-2xl font-bold tabular-nums text-slate-100">{globalTotals.totBolle}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t.dashboard.totalBills}</p>
          </div>
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-3 text-center">
            <p className="text-2xl font-bold tabular-nums text-slate-100">{globalTotals.bolleInAttesa}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t.dashboard.pendingBills}</p>
          </div>
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-3 text-center">
            <p className="text-2xl font-bold tabular-nums text-slate-100">{globalTotals.totFatture}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t.dashboard.invoices}</p>
          </div>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-slate-100">{t.dashboard.sedeOverview}</h2>
        <Link href="/sedi" className="text-sm font-medium text-cyan-400 hover:text-cyan-300 hover:underline">
          {manageSediText}
        </Link>
      </div>

      {sediCards.length === 0 ? (
        <div className="rounded-xl border border-cyan-500/20 bg-slate-700/40">
          <div className="h-1 rounded-t-xl bg-gradient-to-r from-cyan-500/40 via-cyan-400/20 to-transparent" aria-hidden />
          <div className="px-6 py-16 text-center">
            <svg className="mx-auto mb-3 h-12 w-12 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
            <p className="text-sm text-slate-200">{t.sedi.noSedi}</p>
            <Link href="/sedi" className="mt-3 inline-block text-sm font-medium text-cyan-400 hover:text-cyan-300 hover:underline">
              {manageSediText}
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {sediCards.map((sede) => {
            const loc = getCountryLocale(sede.country_code)
            const metaLine = [loc.flag, loc.name].filter(Boolean).join(' · ')
            const imapOk = !!(sede.imap_host?.trim() && sede.imap_user?.trim())
            const needsAttention = sede.bolleInAttesa > 0 || sede.documentiInCoda > 0
            return (
              <div
                key={sede.id}
                className="flex flex-col overflow-hidden rounded-xl border border-cyan-500/20 bg-slate-700/45 shadow-[0_0_28px_-10px_rgba(6,182,212,0.35)] transition-colors hover:border-cyan-500/35"
              >
                <div className="h-1 shrink-0 bg-gradient-to-r from-cyan-500/50 via-cyan-400/25 to-transparent" aria-hidden />
                <div className="flex flex-1 flex-col p-5">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="block truncate font-semibold text-slate-100">{sede.nome}</span>
                      {metaLine ? <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-slate-200">{metaLine}</p> : null}
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        needsAttention ? 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/30' : 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25'
                      }`}
                    >
                      {needsAttention ? t.status.inAttesa : t.status.completato}
                    </span>
                  </div>

                  <div className="mb-4 flex flex-wrap gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold ${
                        imapOk ? 'bg-green-500/15 text-green-300' : 'bg-slate-700/80 text-slate-200'
                      }`}
                    >
                      {imapOk ? t.dashboard.sedeImapOn : t.sedi.notConfigured}
                    </span>
                    <span className="inline-flex items-center rounded-lg border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-200/95">
                      {t.dashboard.pendingBills}: {sede.bolleInAttesa}
                    </span>
                    <span className="inline-flex items-center rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-[10px] font-semibold text-cyan-200/90">
                      {t.dashboard.adminDocQueueShort}: {sede.documentiInCoda}
                    </span>
                  </div>

                  <div className="mt-auto flex flex-wrap gap-2 border-t border-slate-700/50 pt-4">
                    <AdminSelectSedeButton
                      sedeId={sede.id}
                      className="inline-flex flex-1 min-w-[8rem] items-center justify-center rounded-lg bg-cyan-500/20 px-3 py-2.5 text-xs font-semibold text-cyan-100 ring-1 ring-cyan-500/35 transition-colors hover:bg-cyan-500/30"
                    >
                      {t.dashboard.adminOpenBranchDashboard}
                    </AdminSelectSedeButton>
                    <Link
                      href={`/sedi/${sede.id}`}
                      className="inline-flex flex-1 min-w-[8rem] items-center justify-center rounded-lg border border-slate-600/80 bg-slate-700/80 px-3 py-2.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700"
                    >
                      {t.dashboard.adminSedeSettingsLink}
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
