import Link from 'next/link'
import { getProfile, getRequestAuth } from '@/utils/supabase/server'
import { getT, getCookieStore } from '@/lib/locale-server'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import DashboardFiscalYearHeaderForSede from '@/components/DashboardFiscalYearHeaderForSede'
import { AppPageHeaderTitleWithDashboardShortcut } from '@/components/AppPageHeaderDashboardShortcut'
import {
  SUMMARY_HIGHLIGHT_ACCENTS,
  SUMMARY_HIGHLIGHT_CARD_INNER_PADDING_CLASS,
  SUMMARY_HIGHLIGHT_SURFACE_CLASS,
} from '@/lib/summary-highlight-accent'
import { resolveFiscalFilterForSede } from '@/lib/fiscal-year-page'
import { withFiscalYearQuery } from '@/lib/fiscal-link'
import { APP_SHELL_SECTION_PAGE_CLASS, APP_SHELL_SECTION_PAGE_H1_CLASS } from '@/lib/app-shell-layout'

export const dynamic = 'force-dynamic'

export default async function RevisioneInboxPage(props: {
  searchParams?: Promise<{ fy?: string }>
}) {
  const searchParams =
    props.searchParams != null ? await props.searchParams : {}
  const [t, cookieStore, profile, { supabase }] = await Promise.all([
    getT(),
    getCookieStore(),
    getProfile(),
    getRequestAuth(),
  ])

  const isMasterAdmin = profile?.role === 'admin'
  const adminPick = isMasterAdmin ? cookieStore.get('admin-sede-id')?.value?.trim() || null : null
  let adminViewSedeId: string | null = null
  if (isMasterAdmin && adminPick) {
    const { data } = await supabase.from('sedi').select('id').eq('id', adminPick).maybeSingle()
    if (data?.id) adminViewSedeId = data.id
  }

  const sedeId = adminViewSedeId ?? profile?.sede_id ?? null
  const fiscal = sedeId ? await resolveFiscalFilterForSede(supabase, sedeId, searchParams.fy) : null
  const fy = fiscal?.labelYear

  const theme = SUMMARY_HIGHLIGHT_ACCENTS.rose
  const nav = [
    { href: '/statements/da-processare', label: t.dashboard.inboxUrgenteNavDocQueue },
    { href: withFiscalYearQuery('/statements/verifica', fy, { stato: 'anomalia' }), label: t.dashboard.inboxUrgenteNavPriceAnomalies },
    { href: withFiscalYearQuery('/fatture', fy), label: t.dashboard.inboxUrgenteNavInvoices },
    { href: withFiscalYearQuery('/bolle', fy, { tutte: '1' }), label: t.dashboard.inboxUrgenteNavBolle },
    { href: withFiscalYearQuery('/ordini', fy), label: t.dashboard.inboxUrgenteNavOrdini },
  ]

  return (
    <div className={APP_SHELL_SECTION_PAGE_CLASS}>
      <AppPageHeaderStrip accent="rose" icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>}>
        <AppPageHeaderTitleWithDashboardShortcut>
          <h1 className={APP_SHELL_SECTION_PAGE_H1_CLASS}>{t.dashboard.inboxUrgentePageTitle}</h1>
        </AppPageHeaderTitleWithDashboardShortcut>
        <DashboardFiscalYearHeaderForSede fyRaw={searchParams.fy} />
      </AppPageHeaderStrip>

      {!sedeId && !isMasterAdmin ? (
        <div className="rounded-xl border border-[rgba(34,211,238,0.15)] bg-amber-950/25 px-4 py-3 text-sm text-amber-100">
          {t.dashboard.operatorNoSede}
        </div>
      ) : (
        <div className={`${SUMMARY_HIGHLIGHT_SURFACE_CLASS} ${theme.border}`}>
          <div className={`app-card-bar-accent ${theme.bar}`} aria-hidden />
          <div className={`${SUMMARY_HIGHLIGHT_CARD_INNER_PADDING_CLASS} space-y-4`}>
            <p className="text-sm leading-relaxed text-app-fg-muted">{t.dashboard.inboxUrgentePageIntro}</p>
            <ul className="space-y-2">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="block rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-app-fg transition-colors hover:border-[rgba(34,211,238,0.15)] hover:bg-rose-950/20"
                  >
                    {item.label}
                    <span className="mt-0.5 block text-xs font-normal text-app-fg-muted">{item.href}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
