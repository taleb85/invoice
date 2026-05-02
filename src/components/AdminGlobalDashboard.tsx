import Link from 'next/link'
import type { Translations, Locale } from '@/lib/translations'
import { getLocale as getCountryLocale, type CountryCode } from '@/lib/localization'
import { LocaleCodeChip } from '@/components/ui/glyph-icons'
import { AdminSelectSedeButton } from '@/components/AdminSelectSedeButton'
import { dashboardManageSediLabel } from '@/lib/gestisci-sede-label'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { AppPageHeaderTitleWithDashboardShortcut } from '@/components/AppPageHeaderDashboardShortcut'
import type { SedeAdminGlobalOverviewRow, AdminGlobalConsoleEvent } from '@/lib/dashboard-admin-sedi-overview'
import AppSectionEmptyState from '@/components/AppSectionEmptyState'
import { APP_SECTION_EMPTY_LINK_CLASS_COMPACT } from '@/lib/app-shell-layout'
import { iconAccentClass as icon } from '@/lib/icon-accent-classes'
import { formatDate } from '@/lib/locale-shared'
import { SUMMARY_HIGHLIGHT_SURFACE_CLASS } from '@/lib/summary-highlight-accent'

export type AdminGlobalSedeCard = SedeAdminGlobalOverviewRow

export function AdminGlobalDashboard({
  t,
  sediCards,
  consoleEvents,
  appLocale,
  appTimezone,
  erroriRecenti,
  associatedSedeNome = '',
}: {
  t: Translations
  sediCards: AdminGlobalSedeCard[]
  consoleEvents: AdminGlobalConsoleEvent[]
  appLocale: Locale
  appTimezone: string
  erroriRecenti: number
  /** Nome sede sul profilo (o contesto) per etichetta «Gestisci …» */
  associatedSedeNome?: string | null
}) {
  const manageSediText = dashboardManageSediLabel(t, associatedSedeNome ?? '')

  function consoleStatoLabel(evt: AdminGlobalConsoleEvent): string {
    if (evt.channel === 'imap') return t.dashboard.adminGlobalConsoleChannelImap
    if (evt.statoKey === 'fornitore_non_trovato') return t.dashboard.adminGlobalConsoleStatoSupplier
    if (evt.statoKey === 'bolla_non_trovata') return t.dashboard.adminGlobalConsoleStatoBolla
    return evt.statoKey
  }

  function consoleTimeLabel(iso: string): string {
    if (iso.startsWith('1970-01-01T00:00:00')) return t.dashboard.adminGlobalConsoleTimeUnknown
    const formatted = formatDate(iso, appLocale, appTimezone, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    return formatted || iso
  }

  return (
    <div className="w-full min-w-0">
      <div className="mb-8 w-full">
        <AppPageHeaderStrip
          accent="slate"
          flushBottom
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          }
        >
          <AppPageHeaderTitleWithDashboardShortcut>
            <h1 className="app-page-title text-xl font-bold md:text-2xl">{t.dashboard.adminGlobalTitle}</h1>
            <p className="mt-1 hidden text-sm text-app-fg-muted md:block">{t.dashboard.adminGlobalSubtitle}</p>
            <p className="mt-1 text-xs text-app-fg-muted md:hidden">{t.dashboard.adminGlobalSubtitle}</p>
          </AppPageHeaderTitleWithDashboardShortcut>
          <div className="-mx-4 flex w-[calc(100%+2rem)] min-w-0 shrink-0 flex-nowrap items-center justify-end gap-2 overflow-x-auto px-4 py-2.5 md:mx-0 md:w-auto md:overflow-visible md:px-0 md:py-0">
            <Link
              href="/log"
              className={`inline-flex h-11 min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-lg px-3.5 py-0 text-xs font-semibold transition-colors whitespace-nowrap touch-manipulation ${
                erroriRecenti > 0
                  ? 'bg-red-950/60 text-red-200 ring-1 ring-red-500/40 hover:bg-red-950/80'
                  : 'app-workspace-surface-elevated text-app-fg-muted hover:bg-app-line-10 hover:text-app-fg'
              }`}
            >
              {erroriRecenti > 0 && (
                <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-600 px-0.5 text-[10px] font-bold text-white tabular-nums">
                  {erroriRecenti > 9 ? '9+' : erroriRecenti}
                </span>
              )}
              <svg className={`h-4 w-4 shrink-0 ${icon.emailSync}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
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
              className="inline-flex min-h-[44px] items-center rounded-lg border border-app-line-25 bg-app-line-10 px-3 py-2 text-sm font-semibold text-app-fg-muted transition-colors hover:bg-app-line-15"
            >
              {manageSediText}
            </Link>
          </div>
        </AppPageHeaderStrip>
      </div>

      <section
        className={`${SUMMARY_HIGHLIGHT_SURFACE_CLASS} mb-8 flex flex-col border-app-line-35 p-0`}
        aria-label={t.dashboard.adminGlobalConsoleAria}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-app-line-22 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-app-fg">{t.dashboard.adminGlobalConsoleTitle}</h2>
            <p className="mt-0.5 text-xs text-app-fg-muted">{t.dashboard.adminGlobalConsoleSubtitle}</p>
          </div>
          <Link
            href="/log"
            className="shrink-0 text-xs font-semibold text-app-cyan-400 hover:text-cyan-200 hover:underline"
          >
            {t.dashboard.adminGlobalConsoleOpenLog}
          </Link>
        </div>
        {consoleEvents.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-app-fg-muted">{t.dashboard.adminGlobalConsoleEmpty}</p>
        ) : (
          <div
            className="max-h-[min(22rem,50vh)] overflow-y-auto overflow-x-auto px-3 py-2 font-mono text-[11px] leading-relaxed sm:text-xs"
            tabIndex={0}
          >
            <ul className="space-y-0">
              {consoleEvents.map((evt) => {
                const sedeDisplay = evt.sedeNome === '—' ? t.dashboard.adminGlobalConsoleUnknownSede : evt.sedeNome
                const tag = consoleStatoLabel(evt)
                const att =
                  evt.allegatoNome?.trim() &&
                  `${t.dashboard.adminGlobalConsoleAttachment}: ${evt.allegatoNome.trim()}`
                const lineDetail = [evt.detail.trim(), att].filter(Boolean).join(' · ')
                return (
                  <li
                    key={evt.id}
                    className="grid border-b border-app-line-15/80 py-2 last:border-b-0 sm:grid-cols-[minmax(7.5rem,auto)_minmax(5rem,auto)_minmax(5rem,1fr)_minmax(0,1fr)] sm:gap-x-3"
                  >
                    <span className="whitespace-nowrap text-slate-500 tabular-nums">{consoleTimeLabel(evt.occurredAt)}</span>
                    <span
                      className={`whitespace-nowrap font-semibold uppercase tracking-wide ${
                        evt.channel === 'imap' ? 'text-amber-400' : 'text-rose-300/95'
                      }`}
                    >
                      {tag}
                    </span>
                    <span className="min-w-0 sm:max-w-[14rem]">
                      {evt.sedeId ? (
                        <Link
                          href={`/sedi/${evt.sedeId}`}
                          className="truncate font-semibold text-cyan-300/95 hover:text-cyan-100 hover:underline"
                        >
                          {sedeDisplay}
                        </Link>
                      ) : (
                        <span className="text-slate-400">{sedeDisplay}</span>
                      )}
                    </span>
                    <span className="min-w-0 break-words text-slate-300/95">{lineDetail || '—'}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </section>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-app-fg">{t.dashboard.sedeOverview}</h2>
        <Link href="/sedi" className="text-sm font-medium text-app-cyan-500 hover:text-app-fg-muted hover:underline">
          {manageSediText}
        </Link>
      </div>

      {sediCards.length === 0 ? (
        <div className="rounded-xl border border-app-soft-border app-workspace-inset-bg-soft">
          <div className="h-1 rounded-t-xl bg-gradient-to-r from-app-line-40 via-app-a-20 to-transparent" aria-hidden />
          <AppSectionEmptyState
            message={t.sedi.noSedi}
            density="comfortable"
            icon={
              <svg className="mx-auto mb-3 h-12 w-12 text-app-fg-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            }
          >
            <Link href="/sedi" className={APP_SECTION_EMPTY_LINK_CLASS_COMPACT}>
              {manageSediText}
            </Link>
          </AppSectionEmptyState>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {sediCards.map((sede) => {
            const loc = getCountryLocale(sede.country_code)
            const badgeCode = sede.country_code?.trim()?.toUpperCase()
            const chipCode: CountryCode =
              badgeCode === 'IT' || badgeCode === 'FR' || badgeCode === 'DE' || badgeCode === 'ES' || badgeCode === 'UK'
                ? badgeCode
                : 'UK'
            const imapOk = !!(sede.imap_host?.trim() && sede.imap_user?.trim())
            const hasIssues =
              !imapOk ||
              sede.hasLastImapSyncError ||
              sede.syncLogErrors24h > 0 ||
              sede.ocrFailures48h > 0
            return (
              <div
                key={sede.id}
                className={`flex flex-col overflow-hidden rounded-xl border app-workspace-inset-bg shadow-[0_0_28px_-10px_rgba(6,182,212,0.35)] transition-colors hover:border-app-line-35 ${
                  hasIssues ? 'border-amber-500/35' : 'border-app-soft-border'
                }`}
              >
                <div className="h-1 shrink-0 bg-gradient-to-r from-app-line-50 via-app-a-25 to-transparent" aria-hidden />
                <div className="flex flex-1 flex-col p-5">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="block truncate font-semibold text-app-fg">{sede.nome}</span>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-app-fg-muted flex items-center gap-1.5">
                        <LocaleCodeChip code={chipCode} className="h-5 min-w-[1.5rem] shrink-0 text-[9px]" />
                        <span>{loc.name}</span>
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        hasIssues
                          ? 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/35'
                          : 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25'
                      }`}
                    >
                      {hasIssues ? t.dashboard.adminGlobalHealthAttention : t.dashboard.adminGlobalHealthOk}
                    </span>
                  </div>

                  <div className="mb-3 flex flex-wrap gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold ${
                        imapOk ? 'bg-green-500/15 text-green-300' : 'app-workspace-inset-bg text-app-fg-muted'
                      }`}
                    >
                      {imapOk ? t.dashboard.sedeImapOn : t.sedi.notConfigured}
                    </span>
                  </div>

                  {hasIssues ? (
                    <ul className="mb-4 list-inside list-disc space-y-1.5 text-xs leading-snug text-app-fg-muted marker:text-amber-400/90">
                      {!imapOk ? <li>{t.dashboard.adminGlobalHealthImapNotConfigured}</li> : null}
                      {sede.hasLastImapSyncError ? <li>{t.dashboard.adminGlobalHealthLastImapError}</li> : null}
                      {sede.syncLogErrors24h > 0 ? (
                        <li>
                          {t.dashboard.adminGlobalHealthSyncLogErrors.replace(
                            '{n}',
                            String(sede.syncLogErrors24h),
                          )}
                        </li>
                      ) : null}
                      {sede.ocrFailures48h > 0 ? (
                        <li>
                          {t.dashboard.adminGlobalHealthOcrFailures.replace(
                            '{n}',
                            String(sede.ocrFailures48h),
                          )}
                        </li>
                      ) : null}
                    </ul>
                  ) : null}

                  <div className="mt-auto flex flex-wrap gap-2 border-t border-app-line-22 pt-4">
                    <AdminSelectSedeButton
                      sedeId={sede.id}
                      className="inline-flex flex-1 min-w-[8rem] items-center justify-center rounded-lg bg-app-line-20 px-3 py-2.5 text-xs font-semibold text-app-fg-muted ring-1 ring-app-line-35 transition-colors hover:bg-app-line-30"
                    >
                      {t.dashboard.adminOpenBranchDashboard}
                    </AdminSelectSedeButton>
                    <Link
                      href={`/sedi/${sede.id}`}
                      className="inline-flex flex-1 min-w-[8rem] items-center justify-center rounded-lg border border-app-line-28 app-workspace-inset-bg px-3 py-2.5 text-xs font-semibold text-app-fg-muted transition-colors hover:bg-app-line-12"
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
