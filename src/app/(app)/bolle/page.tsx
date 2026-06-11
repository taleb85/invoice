import Link from 'next/link'
import { cookies } from 'next/headers'
import { getRequestAuth, createServiceClient } from '@/utils/supabase/server'
import { getT, getLocale, getTimezone, getCurrency, formatDate as fmtDate } from '@/lib/locale-server'
import { formatCurrency } from '@/lib/locale-shared'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { BackButton } from '@/components/BackButton'
import DashboardFiscalYearHeaderForSede from '@/components/DashboardFiscalYearHeaderForSede'
import { AppPageHeaderTitleWithDashboardShortcut } from '@/components/AppPageHeaderDashboardShortcut'
import { standardLinkButtonClassName } from '@/components/ui/StandardButton'
import { resolveFiscalFilterForSede } from '@/lib/fiscal-year-page'
import { withFiscalYearQuery } from '@/lib/fiscal-link'
import AppSectionEmptyState from '@/components/AppSectionEmptyState'
import { ActionLink } from '@/components/ui/ActionButton'
import {
  APP_SHELL_SECTION_PAGE_STACK_CLASS,
  APP_PAGE_HEADER_STRIP_H1_CLASS,
} from '@/lib/app-shell-layout'
import {
  analyzeBolleDuplicatesForDeletion,
  bollaExcessIdsForAutoDeletion,
  serializeFatturaDuplicateDeletionPayload,
  autoDeleteExcessDuplicates,
} from '@/lib/check-duplicates'
import { ExportButton } from '@/components/export-button'
import type { ExportRow } from '@/lib/export-report'
import { unwrapSearchParams } from '@/lib/unwrap-next-search-params'
import { resolveActiveSedeIdForLists } from '@/lib/resolve-active-sede-for-lists'
import BolleListClient from '@/components/BolleListClient'

const BOLLE_LIST_LIMIT = 500

type BollaListRow = {
  id: string
  data: string
  stato: string
  file_url: string | null
  fornitore_id: string
  numero_bolla?: string | null
  fornitori?: { nome: string; display_name?: string | null } | null
  email_sync_auto_saved_at?: string | null
}

/** YYYY-MM-DD for the user's calendar day in IANA timezone (matches Impostazioni fuso). */
function calendarDateInTimeZone(timeZone: string): string {
  try {
    return new Date().toLocaleDateString('en-CA', { timeZone })
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

async function getListSedeId(): Promise<string | null> {
  const { supabase, user } = await getRequestAuth()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role, sede_id').eq('id', user.id).single()
  const cookieStore = await cookies()
  return resolveActiveSedeIdForLists(supabase, profile, (n) => cookieStore.get(n))
}

async function getBolleForToday(timeZone: string, sedeId: string | null) {
  const today = calendarDateInTimeZone(timeZone)
  const { supabase } = await getRequestAuth()
  let q = supabase
    .from('bolle')
    .select('*, fornitori(nome, display_name)')
    .eq('data', today)
    .order('id', { ascending: false })
  if (sedeId) q = q.eq('sede_id', sedeId) as typeof q
  const { data, error } = await q

  if (error) console.error('Errore caricamento bolle:', error.message)
  return data ?? []
}

function bolleListReturnPath(sp: { tutte?: string; pending?: string; fy?: string }): string {
  const q = new URLSearchParams()
  if (sp.tutte != null && sp.tutte !== '') q.set('tutte', String(sp.tutte))
  if (sp.pending != null && sp.pending !== '') q.set('pending', String(sp.pending))
  if (sp.fy != null && sp.fy !== '') q.set('fy', String(sp.fy))
  const qs = q.toString()
  return qs ? `/bolle?${qs}` : '/bolle'
}

async function getBolleAll(
  sedeId: string | null,
  pendingOnly: boolean,
  fiscalDataBounds: { dateFrom: string; dateToExclusive: string } | null,
) {
  const { supabase } = await getRequestAuth()
  let q = supabase
    .from('bolle')
    .select('*, fornitori(nome, display_name)')
    .order('data', { ascending: false })
    .order('id', { ascending: false })
    .limit(BOLLE_LIST_LIMIT)
  if (sedeId) q = q.eq('sede_id', sedeId) as typeof q
  if (pendingOnly) q = q.eq('stato', 'in attesa') as typeof q
  if (fiscalDataBounds) {
    q = q
      .gte('data', fiscalDataBounds.dateFrom)
      .lt('data', fiscalDataBounds.dateToExclusive) as typeof q
  }
  const { data, error } = await q

  if (error) console.error('Errore caricamento bolle:', error.message)
  return data ?? []
}

export default async function BollePage(props: {
  searchParams?: Promise<{ tutte?: string; pending?: string; fy?: string }>
}) {
  const sp = await unwrapSearchParams(props.searchParams)
  const showAll = sp.tutte === '1' || sp.tutte === 'true'
  const pendingOnly = sp.pending === '1' || sp.pending === 'true'
  const bolleReturn = bolleListReturnPath(sp)

  const [tz, t, locale, currency, sedeId, { supabase }] = await Promise.all([
    getTimezone(),
    getT(),
    getLocale(),
    getCurrency(),
    getListSedeId(),
    getRequestAuth(),
  ])
  const fiscal = sedeId ? await resolveFiscalFilterForSede(supabase, sedeId, sp.fy) : null
  const fyForLinks = fiscal?.labelYear
  const bolleRaw =
    showAll && sedeId
      ? await getBolleAll(sedeId, pendingOnly, fiscal?.bounds ?? null)
      : showAll
        ? await getBolleAll(sedeId, pendingOnly, null)
        : await getBolleForToday(tz, sedeId)
  const bolle = bolleRaw as BollaListRow[]
  const todayYmd = calendarDateInTimeZone(tz)
  const bolleDupRows = bolle.map((b) => ({
    id: b.id,
    numero_bolla: b.numero_bolla ?? null,
    fornitore_id: b.fornitore_id,
    data: (b.data ?? '').trim().slice(0, 10),
    file_url: b.file_url ?? null,
    sede_id: sedeId,
    email_sync_auto_saved_at: b.email_sync_auto_saved_at ?? null,
  }))
  const dupAnalysis = analyzeBolleDuplicatesForDeletion(bolleDupRows)
  const excessIds = bollaExcessIdsForAutoDeletion(bolleDupRows)
  if (excessIds.length > 0) {
    const service = createServiceClient()
    const deleted = await autoDeleteExcessDuplicates(service, 'bolle', excessIds)
    if (deleted > 0) {
      const keptIds = new Set(bolle.map(b => b.id).filter(id => !excessIds.includes(id)))
      const filtered = bolle.filter(b => keptIds.has(b.id))
      bolle.length = 0
      bolle.push(...filtered)
      // Recompute analysis after cleanup
      const cleanAnalysis = analyzeBolleDuplicatesForDeletion(
        bolle.map((b) => ({
          id: b.id,
          numero_bolla: b.numero_bolla ?? null,
          fornitore_id: b.fornitore_id,
          data: (b.data ?? '').trim().slice(0, 10),
          file_url: b.file_url ?? null,
          sede_id: sedeId,
          email_sync_auto_saved_at: b.email_sync_auto_saved_at ?? null,
        })),
      )
      dupAnalysis.memberIds = cleanAnalysis.memberIds
      dupAnalysis.excessIds = cleanAnalysis.excessIds
      dupAnalysis.surplusCount = cleanAnalysis.surplusCount
    }
  }
  const dupPayload = serializeFatturaDuplicateDeletionPayload(dupAnalysis)
  const formatDate = (d: string) => fmtDate(d, locale, tz)
  const bolleWithDateLabel = bolle.map((b) => {
    const importoRaw = (b as Record<string, unknown>).importo as number | null
    return {
      ...b,
      dateLabel: formatDate(b.data),
      importoLabel:
        importoRaw != null && Number.isFinite(Number(importoRaw))
          ? formatCurrency(Number(importoRaw), currency, locale)
          : null,
    }
  })

  const exportPeriod = String(fiscal?.labelYear ?? sp.fy ?? new Date().getFullYear())
  const exportRows: ExportRow[] = bolle.map(b => ({
    data: b.data,
    numero: b.numero_bolla ?? null,
    fornitore: b.fornitori?.nome ?? '—',
    importo: (b as Record<string, unknown>).importo as number | null,
    stato: b.stato,
    sede: null,
  }))

  const subtitle = (() => {
    if (!showAll) {
      return `${bolle.length} ${bolle.length === 1 ? t.bolle.countTodaySingolo : t.bolle.countTodayPlural}`
    }
    if (pendingOnly) {
      return `${bolle.length} · ${t.dashboard.pendingBills}`
    }
    return `${bolle.length} ${bolle.length === 1 ? t.bolle.countSingolo : t.bolle.countPlural}`
  })()

  const emptyMessage = (() => {
    if (!showAll) return t.bolle.noBillsToday
    if (pendingOnly) return t.dashboard.kpiNoPendingBills
    return t.bolle.noBills
  })()

  const bolleFilterTrailing = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {!showAll ? (
        <>
          <Link
            href={withFiscalYearQuery('/bolle', fyForLinks, { tutte: '1' })}
            className={standardLinkButtonClassName('secondary', 'sm')}
          >
            {t.bolle.listShowAll}
          </Link>
          <Link
            href={withFiscalYearQuery('/bolle', fyForLinks, { tutte: '1', pending: '1' })}
            className={standardLinkButtonClassName('secondary', 'sm')}
          >
            {t.bolle.listAllPending}
          </Link>
        </>
      ) : pendingOnly ? (
        <>
          <Link href="/bolle" className={standardLinkButtonClassName('secondary', 'sm')}>
            {t.bolle.listShowToday}
          </Link>
          <Link
            href={withFiscalYearQuery('/bolle', fyForLinks, { tutte: '1' })}
            className={standardLinkButtonClassName('secondary', 'sm')}
          >
            {t.bolle.listShowAll}
          </Link>
        </>
      ) : (
        <>
          <Link href="/bolle" className={standardLinkButtonClassName('secondary', 'sm')}>
            {t.bolle.listShowToday}
          </Link>
          <Link
            href={withFiscalYearQuery('/bolle', fyForLinks, { tutte: '1', pending: '1' })}
            className={standardLinkButtonClassName('secondary', 'sm')}
          >
            {t.bolle.listAllPending}
          </Link>
        </>
      )}
    </div>
  )

  const bolleMergedSummary = {
    label: t.common.total,
    primary: bolle.length,
    secondary: subtitle,
    trailing: bolleFilterTrailing,
  }

  return (
    <div className={APP_SHELL_SECTION_PAGE_STACK_CLASS}>
      <AppPageHeaderStrip
        accent="violet"
        mergedSummary={bolleMergedSummary}
        leadingAccessory={<BackButton href="/" label={t.nav.dashboard} iconOnly className="mb-0 shrink-0" />}
        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>}
      >
        <AppPageHeaderTitleWithDashboardShortcut>
          <h1 className={APP_PAGE_HEADER_STRIP_H1_CLASS}>{t.bolle.title}</h1>
        </AppPageHeaderTitleWithDashboardShortcut>
        <div className="flex min-w-0 shrink-0 flex-nowrap items-center justify-end gap-2 md:gap-3">
          <ExportButton rows={exportRows} type="bolle" period={exportPeriod} />
          <DashboardFiscalYearHeaderForSede fyRaw={sp.fy} />
        </div>
      </AppPageHeaderStrip>

      <div className="min-w-0">
          {bolle.length === 0 ? (
            <AppSectionEmptyState message={emptyMessage}>
              {!showAll ? (
                <ActionLink
                  href={withFiscalYearQuery('/bolle', fyForLinks, { tutte: '1' })}
                  intent="nav"
                  size="sm"
                  className="mt-4"
                >
                  {t.bolle.listShowAll} →
                </ActionLink>
              ) : null}
            </AppSectionEmptyState>
          ) : (
            <BolleListClient
              bolle={bolleWithDateLabel}
              todayYmd={todayYmd}
              bolleReturn={bolleReturn}
              excessBollaIds={[...dupAnalysis.excessIds]}
              dupPayload={dupPayload}
            />
          )}
      </div>
    </div>
  )
}
