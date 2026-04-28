import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getRequestAuth } from '@/utils/supabase/server'
import {
  SCANNER_FLOW_EVENTS_PAGE_SIZE,
  fetchScannerFlowEventsPage,
} from '@/lib/dashboard-operator-kpis'
import { scannerFlowStepLabel } from '@/components/DashboardScannerFlowCard'
import { getT, getLocale, getTimezone, formatDate as fmtDate } from '@/lib/locale-server'
import { BackButton } from '@/components/BackButton'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { AppPageHeaderTitleWithDashboardShortcut } from '@/components/AppPageHeaderDashboardShortcut'
import { APP_PAGE_HEADER_STRIP_H1_CLASS, APP_SHELL_SECTION_PAGE_STACK_CLASS } from '@/lib/app-shell-layout'

export const dynamic = 'force-dynamic'

async function getListSedeId(): Promise<string | null> {
  const { supabase, user } = await getRequestAuth()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role, sede_id').eq('id', user.id).single()
  if (!profile) return null
  const cookieStore = await cookies()
  const adminPick =
    profile.role === 'admin' ? cookieStore.get('admin-sede-id')?.value?.trim() || null : null
  if (adminPick) {
    const { data } = await supabase.from('sedi').select('id').eq('id', adminPick).maybeSingle()
    if (data?.id) return data.id
  }
  return profile.sede_id ?? null
}

export default async function ScannerEventiPage(props: {
  searchParams?: Promise<{ page?: string }>
}) {
  const sedeId = await getListSedeId()
  if (!sedeId) redirect('/')

  const sp = props.searchParams != null ? await props.searchParams : {}
  const raw = typeof sp.page === 'string' ? parseInt(sp.page, 10) : 1
  const requestedPage = Number.isFinite(raw) && raw >= 1 ? raw : 1

  const { supabase } = await getRequestAuth()
  const [t, locale, tz] = await Promise.all([getT(), getLocale(), getTimezone()])

  const { rows, total } = await fetchScannerFlowEventsPage(supabase, sedeId, requestedPage)
  const totalPages = Math.max(1, Math.ceil(total / SCANNER_FLOW_EVENTS_PAGE_SIZE))
  if (requestedPage > totalPages) {
    redirect(`/scanner/eventi?page=${totalPages}`)
  }
  const page = Math.min(requestedPage, totalPages)

  const formatDt = (iso: string) => fmtDate(iso, locale, tz, { dateStyle: 'short', timeStyle: 'short' })

  const pageOfLabel = t.dashboard.scannerFlowEventsPageOf
    .replace('{current}', String(page))
    .replace('{pages}', String(totalPages))

  const prevHref = page > 1 ? `/scanner/eventi?page=${page - 1}` : null
  const nextHref = page < totalPages ? `/scanner/eventi?page=${page + 1}` : null

  const navBtnBase =
    'inline-flex min-h-[44px] items-center rounded-lg border px-4 py-2 text-sm font-semibold transition-colors touch-manipulation'
  const navBtnActive = `${navBtnBase} border-app-line-40 bg-app-line-15 text-app-fg-muted hover:border-app-a-50 hover:bg-app-line-25`
  const navBtnDisabled = `${navBtnBase} cursor-not-allowed border-app-line-25 text-app-fg-muted opacity-60`

  return (
    <div className={APP_SHELL_SECTION_PAGE_STACK_CLASS}>
      <AppPageHeaderStrip
        accent="cyan"
        leadingAccessory={<BackButton href="/" label={t.nav.dashboard} iconOnly className="mb-0 shrink-0" />}
        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 3.5V20m-4-12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>}
      >
        <AppPageHeaderTitleWithDashboardShortcut>
          <h1 className={APP_PAGE_HEADER_STRIP_H1_CLASS}>{t.dashboard.scannerFlowEventsPageTitle}</h1>
        </AppPageHeaderTitleWithDashboardShortcut>
      </AppPageHeaderStrip>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-white/10 app-workspace-inset-bg-soft px-4 py-8 text-center text-sm text-app-fg-muted">
          {t.dashboard.scannerFlowEventsEmpty}
        </p>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-app-line-35 bg-gradient-to-b from-app-line-10 to-violet-500/5 text-app-fg-muted shadow-[0_0_20px_-10px_rgba(6,182,212,0.35)]">
          {rows.map((e) => (
            <li
              key={e.id}
              className="border-b border-white/10 px-4 py-3 last:border-b-0 sm:flex sm:items-start sm:gap-4 sm:px-5 sm:py-3.5"
            >
              <time
                className="mb-1 block shrink-0 text-xs tabular-nums text-app-fg-muted sm:mb-0 sm:w-44 sm:text-sm"
                dateTime={e.created_at}
              >
                {formatDt(e.created_at)}
              </time>
              <span className="block text-sm leading-snug text-app-fg">{scannerFlowStepLabel(e.step, t)}</span>
            </li>
          ))}
        </ul>
      )}

      {total > 0 ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-app-fg-muted sm:text-sm">{pageOfLabel}</p>
          <div className="flex flex-wrap gap-2">
            {prevHref ? (
              <Link href={prevHref} className={navBtnActive} prefetch={false}>
                {t.dashboard.scannerFlowEventsPrev}
              </Link>
            ) : (
              <span className={navBtnDisabled} aria-disabled>
                {t.dashboard.scannerFlowEventsPrev}
              </span>
            )}
            {nextHref ? (
              <Link href={nextHref} className={navBtnActive} prefetch={false}>
                {t.dashboard.scannerFlowEventsNext}
              </Link>
            ) : (
              <span className={navBtnDisabled} aria-disabled>
                {t.dashboard.scannerFlowEventsNext}
              </span>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
