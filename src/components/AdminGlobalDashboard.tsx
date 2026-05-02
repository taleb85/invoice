import Link from 'next/link'
import type { Translations } from '@/lib/translations'
import { getLocale as getCountryLocale, type CountryCode } from '@/lib/localization'
import { LocaleCodeChip } from '@/components/ui/locale-code-chip'
import { AdminSelectSedeButton } from '@/components/AdminSelectSedeButton'
import { dashboardManageSediLabel } from '@/lib/gestisci-sede-label'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { AppPageHeaderTitleWithDashboardShortcut } from '@/components/AppPageHeaderDashboardShortcut'
import type { SedeAdminGlobalOverviewRow } from '@/lib/dashboard-admin-sedi-overview'
import AppSectionEmptyState from '@/components/AppSectionEmptyState'
import { APP_SECTION_EMPTY_LINK_CLASS_COMPACT, APP_SHELL_SECTION_PAGE_CLASS } from '@/lib/app-shell-layout`
export type AdminGlobalSedeCard = SedeAdminGlobalOverviewRow

export function AdminGlobalDashboard({
  t,
  sediCards,
  associatedSedeNome = '',
}: {
  t: Translations
  sediCards: AdminGlobalSedeCard[]
  /** Nome sede sul profilo (o contesto) per etichetta «Gestisci …» */
  associatedSedeNome?: string | null
}) {
  const manageSediText = dashboardManageSediLabel(t, associatedSedeNome ?? '')

  return (
    <div className={APP_SHELL_SECTION_PAGE_CLASS}>
      <div className="mb-8 w-full">
        <AppPageHeaderStrip embedded>
          <AppPageHeaderTitleWithDashboardShortcut>
            <h1 className="app-page-title text-xl font-bold md:text-2xl">{t.dashboard.adminGlobalTitle}</h1>
          </AppPageHeaderTitleWithDashboardShortcut>
        </AppPageHeaderStrip>
      </div>

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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
