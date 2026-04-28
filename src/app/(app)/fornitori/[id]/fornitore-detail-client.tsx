'use client'

import dynamic from 'next/dynamic'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  Suspense,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import Link from 'next/link'
import { OpenDocumentInAppButton } from '@/components/OpenDocumentInAppButton'
import { useParams, usePathname, useRouter, useSearchParams, type ReadonlyURLSearchParams } from 'next/navigation'
import {
  fornitoreBollaDeepLink,
  fornitoreFatturaDeepLink,
  fornitoreSupplierClearDocParams,
} from '@/lib/fornitore-supplier-url'
import { buildListLocationPath, hrefWithReturnTo, readReturnToFromGetter } from '@/lib/return-navigation'
import { saveScrollForListPath } from '@/lib/return-navigation-client'
import {
  extractListinoSrcFatturaId,
  LISTINO_SRC_FATTURA_MARK,
  parseListinoNoteParts,
  referencePriceForListinoRow,
  stripListinoSrcMachineSuffix,
} from '@/lib/listino-display'
import {
  calendarDaysBetweenIso,
  isDocumentDateAtLeastLatestListino,
  maxListinoDateForExactProduct,
} from '@/lib/listino-document-date'
import { iconAccentClass as icon } from '@/lib/icon-accent-classes'
import FornitoreDocDetailLayer from '@/components/FornitoreDocDetailLayer'
import { createClient } from '@/utils/supabase/client'
import {
  countSupplierMonthRekkiPriceAnomalies,
  statementMatchesCalendarWindow,
} from '@/lib/rekki-price-anomalies'
const PendingMatchesTab = dynamic(
  () => import('@/app/(app)/statements/statements-views').then(m => ({ default: m.PendingMatchesTab })),
  { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-xl bg-app-line-10/40" /> },
)
const VerificationStatusTab = dynamic(
  () => import('@/app/(app)/statements/statements-views').then(m => ({ default: m.VerificationStatusTab })),
  { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-xl bg-app-line-10/40" /> },
)
import { useT } from '@/lib/use-t'
import { useLocale } from '@/lib/locale-context'
import { formatDate as formatDateLib, formatCurrency, formatMonthYearUppercase } from '@/lib/locale'
import {
  defaultFiscalYearLabel,
  formatFiscalYearShort,
  listFiscalMonthsThroughSelection,
} from '@/lib/fiscal-year'
import { segmentParam } from '@/lib/segment-param'
import { attachmentKindFromFileUrl, type AttachmentKind } from '@/lib/attachment-kind'
import { useMe } from '@/lib/me-context'
import { useMobileSupplierReadOnly } from '@/lib/use-mobile-supplier-read-only'
const ScanEmailButton = dynamic(() => import('@/components/ScanEmailButton'), { ssr: false, loading: () => null })
const SuggestEmailButton = dynamic(() => import('@/components/SuggestEmailButton'), { ssr: false, loading: () => null })
import AppPageHeaderDesktopTray from '@/components/AppPageHeaderDesktopTray'
const StatoSincronizzazioneIntelligente = dynamic(
  () => import('@/components/StatoSincronizzazioneIntelligente'),
  { ssr: false, loading: () => <div className="h-32 animate-pulse rounded-xl bg-app-line-10/40" /> },
)
const FattureInAttesaAutoSync = dynamic(
  () => import('@/components/FattureInAttesaAutoSync'),
  { ssr: false, loading: () => null },
)
const RecuperoCreditiAudit = dynamic(
  () => import('@/components/RecuperoCreditiAudit'),
  { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-xl bg-app-line-10/40" /> },
)
import ErrorBoundary from '@/components/ErrorBoundary'
import GmailAuditReadyBadge from '@/components/GmailAuditReadyBadge'
import FluxoSupplierProfileLoading from '@/components/FluxoSupplierProfileLoading'
import FornitoreAvatar from '@/components/FornitoreAvatar'
import FatturaRefreshDateButton from '@/components/FatturaRefreshDateButton'
const FornitoreConfermeOrdineTab = dynamic(
  () => import('@/components/FornitoreConfermeOrdineTab'),
  { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-xl bg-app-line-10/40" /> },
)
import DeleteButton from '@/components/DeleteButton'
import {
  SUPPLIER_DETAIL_TAB_ACTIVE_UNDERLINE,
  SUPPLIER_DETAIL_TAB_HIGHLIGHT,
  SUPPLIER_DETAIL_TAB_TABLE_ACCENT,
} from '@/lib/supplier-detail-tab-theme'
import { fornitoreDisplayLabel, fornitoreDisplayLabelUppercase } from '@/lib/fornitore-display'
import {
  hexToRgbTuple,
  SUPPLIER_DESKTOP_KPI_GRID_LAYOUT_CLASS,
  supplierDesktopKpiOuterShadow,
  supplierKpiPalette,
} from '@/lib/kpi-accent-palette'
import {
  analyzeBolleDuplicatesForDeletion,
  analyzeFatturaDuplicatesForDeletion,
  serializeFatturaDuplicateDeletionPayload,
} from '@/lib/check-duplicates'
import AppSectionEmptyState from '@/components/AppSectionEmptyState'
import { DuplicateLedgerRowExtras } from '@/components/DuplicateLedgerRowExtras'
import { ActionLink } from '@/components/ui/ActionButton'
import {
  APP_SECTION_AMOUNT_NEGATIVE_CLASS,
  APP_SECTION_DIVIDE_ROWS,
  APP_SECTION_MOBILE_LIST,
  APP_SECTION_TABLE_HEAD_ROW,
  APP_SECTION_TABLE_HEAD_ROW_STRONG,
  APP_SECTION_TABLE_ROW_HOVER,
  APP_SECTION_TABLE_TBODY,
  APP_SECTION_TABLE_THEAD_STICKY,
  APP_SECTION_TABLE_TR,
  appSectionTableHeadRowAccentClass,
} from '@/lib/app-shell-layout'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ActivityFeed } from '@/components/activity/activity-feed'

type Tab = 'dashboard' | 'bolle' | 'fatture' | 'listino' | 'conferme' | 'documenti' | 'verifica' | 'audit'

/** Tab nascosti su mobile per utenti senza permessi di modifica (magazziniere/operatore). */
const MOBILE_READONLY_HIDDEN_TABS: Tab[] = ['bolle', 'fatture', 'conferme', 'verifica', 'audit']

/** Periodo documenti / KPI: estremi inclusivi `YYYY-MM-DD` (timezone locale). */
type SupplierLedgerPeriod = { from: string; toIncl: string }

function localYmd(d: Date): string {
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function parseYmdLocal(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map((x) => Number(x))
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

function addDaysYmd(ymd: string, days: number): string {
  const d = parseYmdLocal(ymd)
  d.setDate(d.getDate() + days)
  return localYmd(d)
}

function supplierExclusiveEndAfterInclusive(ymdInclusive: string): string {
  return addDaysYmd(ymdInclusive, 1)
}

function compareYmd(a: string, b: string): number {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

function clampLedgerPeriodToToday(from: string, toIncl: string, todayYmd: string): SupplierLedgerPeriod {
  let tf = from
  let tt = toIncl
  if (compareYmd(tt, todayYmd) > 0) tt = todayYmd
  if (compareYmd(tf, tt) > 0) tf = tt
  return { from: tf, toIncl: tt }
}

function supplierMonthCalendarBounds(year: number, month1: number): SupplierLedgerPeriod {
  const from = `${year}-${String(month1).padStart(2, '0')}-01`
  const last = new Date(year, month1, 0)
  return { from, toIncl: localYmd(last) }
}

function ymdYearMonth(ymd: string): { y: number; m: number } {
  const [ys, ms] = ymd.split('-')
  return { y: Number(ys), m: Number(ms) }
}

function shiftLedgerPeriodByMonths(
  p: SupplierLedgerPeriod,
  deltaMonths: number,
  todayYmd: string,
): SupplierLedgerPeriod {
  const df = parseYmdLocal(p.from)
  df.setMonth(df.getMonth() + deltaMonths)
  const dt = parseYmdLocal(p.toIncl)
  dt.setMonth(dt.getMonth() + deltaMonths)
  return clampLedgerPeriodToToday(localYmd(df), localYmd(dt), todayYmd)
}

/** Due `TabContent` (mobile/desktop); stesso schema del tab Verifica: `DashboardTab` solo dove `mdUp` coincide (evita doppio Rekki nel DOM). */
function scrollSupplierTabPanelIntoView() {
  if (typeof document === 'undefined') return
  const panel = [...document.querySelectorAll<HTMLElement>('.fornitore-tab-panel')].find((e) => e.offsetHeight > 0)
  if (!panel) return
  const main = document.querySelector('[data-app-main-scroll]') as HTMLElement | null
  if (main) {
    const rect = panel.getBoundingClientRect()
    const mainRect = main.getBoundingClientRect()
    const padding = 8
    const delta = rect.top - mainRect.top - padding
    const nextTop = main.scrollTop + delta
    main.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' })
    return
  }
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

interface Fornitore {
  id: string
  nome: string
  display_name?: string | null
  email: string | null
  piva: string | null
  sede_id: string | null
  created_at: string
  telefono?: string | null
  indirizzo?: string | null
  citta?: string | null
  paese?: string | null
  note?: string | null
  contatto_nome?: string | null
  rekki_supplier_id?: string | null
  rekki_link?: string | null
  logo_url?: string | null
}

interface Bolla {
  id: string
  sede_id: string | null
  data: string
  stato: string
  file_url: string | null
  numero_bolla: string | null
  importo: number | null
}

interface Fattura {
  id: string
  data: string
  file_url: string | null
  bolla_id: string | null
  numero_fattura: string | null
  importo: number | null
  fornitore_id: string
}

interface ListinoRow {
  data: string
  tipo: 'bolla' | 'fattura'
  numero: string | null
  importo: number | null
  id: string
}

/* ─── Dashboard KPI tab ─────────────────────────────────────────── */
type ContattoRow = { id: string; nome: string; ruolo: string | null; email: string | null; telefono: string | null }

const AVATAR_COLORS = [
  'bg-app-cyan-500', 'bg-blue-500', 'bg-violet-500', 'bg-emerald-500',
  'bg-rose-500', 'bg-amber-500', 'bg-indigo-500', 'bg-teal-500',
]

function getAvatarColor(nome: string) {
  let hash = 0
  for (const c of nome) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function getInitials(nome: string) {
  return nome.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function useAppFormatDate() {
  const { locale, timezone } = useLocale()
  return useCallback(
    (dateStr: string) => formatDateLib(dateStr, locale, timezone, { day: '2-digit', month: 'short', year: 'numeric' }),
    [locale, timezone]
  )
}

/** KPI per il periodo (mese) selezionato — condiviso tra header desktop e tab Riepilogo. */
type SupplierPeriodStats = {
  bolleTotal: number
  bolleAperte: number
  fattureTotal: number
  ordiniNelPeriodo: number
  pending: number
  /** Somma importi fatture nel periodo (include eventuali duplicati). */
  totaleSpesaLordo: number
  /** Somma netta: esclude importi delle copie duplicate rilevate. */
  totaleSpesa: number
  /** Righe `listino_prezzi` con `data_prezzo` nel periodo (aggiornamenti). */
  listinoRows: number
  /** Prodotti distinti tra quelle righe (stesso periodo). */
  listinoProdottiDistinti: number
  statementsInPeriod: number
  statementsWithIssues: number
  /** Stessa logica del KPI listino dashboard: anomalie Rekki (estratto + bolla vs `prezzo_rekki`). */
  rekkiPriceAnomalies: number
  /** Anomalie non risolte nella tabella price_anomalies (fattura vs listino_prezzi). */
  listinoAnomaliesCount: number
}

const EMPTY_SUPPLIER_PERIOD_STATS: SupplierPeriodStats = {
  bolleTotal: 0,
  bolleAperte: 0,
  fattureTotal: 0,
  ordiniNelPeriodo: 0,
  pending: 0,
  totaleSpesaLordo: 0,
  totaleSpesa: 0,
  listinoRows: 0,
  listinoProdottiDistinti: 0,
  statementsInPeriod: 0,
  statementsWithIssues: 0,
  rekkiPriceAnomalies: 0,
  listinoAnomaliesCount: 0,
}

function useSupplierPeriodStats(
  fornitoreId: string,
  fromInclusive: string,
  toExclusive: string,
  reloadEpoch = 0,
) {
  const [stats, setStats] = useState<SupplierPeriodStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const from = fromInclusive
    const to = toExclusive
    const supabase = createClient()

    const pendingCountPromise = fetch(
      `/api/documenti-da-processare?fornitore_id=${encodeURIComponent(fornitoreId)}&stati=in_attesa,da_associare&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    )
      .then((r) => (r.ok ? r.json() : []))
      .then((d: unknown) => (Array.isArray(d) ? d.length : 0))
      .catch(() => 0)

    Promise.all([
      supabase
        .from('bolle')
        .select('id', { count: 'exact', head: true })
        .eq('fornitore_id', fornitoreId)
        .gte('data', from)
        .lt('data', to),
      supabase
        .from('bolle')
        .select('id', { count: 'exact', head: true })
        .eq('fornitore_id', fornitoreId)
        .eq('stato', 'in attesa')
        .gte('data', from)
        .lt('data', to),
      supabase
        .from('fatture')
        .select('id, data, numero_fattura, importo, fornitore_id', { count: 'exact' })
        .eq('fornitore_id', fornitoreId)
        .gte('data', from)
        .lt('data', to),
      pendingCountPromise,
      supabase
        .from('listino_prezzi')
        .select('prodotto')
        .eq('fornitore_id', fornitoreId)
        .gte('data_prezzo', from)
        .lt('data_prezzo', to)
        .limit(8000),
      supabase
        .from('statements')
        .select('missing_rows, received_at, extracted_pdf_dates')
        .eq('fornitore_id', fornitoreId)
        .order('received_at', { ascending: false })
        .limit(800),
      supabase
        .from('conferme_ordine')
        .select('id', { count: 'exact', head: true })
        .eq('fornitore_id', fornitoreId)
        .gte('created_at', from)
        .lt('created_at', to),
      countSupplierMonthRekkiPriceAnomalies(supabase, fornitoreId, from, to),
      supabase
        .from('price_anomalies')
        .select('id', { count: 'exact', head: true })
        .eq('fornitore_id', fornitoreId)
        .eq('resolved', false),
    ])
      .then(([bolleRes, bolleAperteRes, fattureRes, pendingCount, listinoRes, stmtsRes, ordiniRes, rekkiAnom, anomalieRes]) => {
        if (cancelled) return
        const fattureRows = (fattureRes.data ?? []) as {
          id: string
          data: string
          numero_fattura: string | null
          importo: number | null
          fornitore_id: string
        }[]
        const totaleSpesaLordo = fattureRows.reduce((s, f) => s + (f.importo ?? 0), 0)
        const dup = analyzeFatturaDuplicatesForDeletion(fattureRows)
        const totaleSpesa = Math.max(0, totaleSpesaLordo - dup.surplusImporto)
        const listinoRowsData = (listinoRes.data ?? []) as { prodotto: string }[]
        const listinoRows = listinoRes.error ? 0 : listinoRowsData.length
        const listinoProdottiDistinti = listinoRes.error
          ? 0
          : new Set(listinoRowsData.map((r) => String(r.prodotto ?? '').trim()).filter(Boolean)).size
        const stmtData = stmtsRes.error
          ? []
          : ((stmtsRes.data ?? []) as {
              missing_rows: number | null
              received_at: string
              extracted_pdf_dates: unknown
            }[])
        const stmtInMonth = stmtData.filter((s) => statementMatchesCalendarWindow(s, from, to))
        const statementsInPeriod = stmtInMonth.length
        const statementsWithIssues = stmtInMonth.filter((s) => (s.missing_rows ?? 0) > 0).length
        const ordiniNelPeriodo = ordiniRes.error ? 0 : (ordiniRes.count ?? 0)
        setStats({
          bolleTotal: bolleRes.count ?? 0,
          bolleAperte: bolleAperteRes.count ?? 0,
          fattureTotal: fattureRes.count ?? 0,
          ordiniNelPeriodo,
          pending: pendingCount,
          totaleSpesaLordo,
          totaleSpesa,
          listinoRows,
          listinoProdottiDistinti,
          statementsInPeriod,
          statementsWithIssues,
          rekkiPriceAnomalies: typeof rekkiAnom === 'number' ? rekkiAnom : 0,
          listinoAnomaliesCount:
            anomalieRes && !anomalieRes.error ? (anomalieRes.count ?? 0) : 0,
        })
      })
      .catch(() => {
        if (!cancelled) setStats(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [fornitoreId, fromInclusive, toExclusive, reloadEpoch])

  return { stats, loading }
}

type KpiDef = {
  label: string
  value: number | string
  icon: ReactNode
  sub: string
  subColor: string
  tab: Tab
  accent: string
  accentHex: string
  chevronClass: string
  chevronHoverClass: string
  /** Separatore titolo/icona, tinta sul tab collegato. */
  headerRule: string
  /** Tile mobile «Totale spesa» (due righe con tab fatture). */
  isSpesaTotale?: boolean
  /** Sotto il valore principale (es. totale lordo fatture se diverso dal reale). */
  valueSupplement?: string
}

function buildSupplierKpiItems(
  stats: SupplierPeriodStats | null,
  t: ReturnType<typeof useT>,
  formatMoney: (amount: number) => string,
): KpiDef[] {
  const stmtN = stats?.statementsInPeriod ?? 0
  const stmtIssues = stats?.statementsWithIssues ?? 0
  let stmtSub: string
  let stmtSubColor: string
  if (stmtN === 0) {
    stmtSub = t.fornitori.subStatementsNoneInMonth
    stmtSubColor = 'text-app-fg-muted'
  } else if (stmtIssues === 0) {
    stmtSub = t.fornitori.subStatementsAllVerified
    stmtSubColor = 'text-emerald-300'
  } else {
    stmtSub = `${stmtIssues} ${t.fornitori.subStatementsWithIssues}`
    stmtSubColor = 'text-amber-300'
  }

  const c = supplierKpiPalette.conferme
  const b = supplierKpiPalette.bolle
  const f = supplierKpiPalette.fatture
  const v = supplierKpiPalette.verifica
  const l = supplierKpiPalette.listino
  const d = supplierKpiPalette.documenti

  return [
    {
      label: t.fornitori.kpiOrdini,
      value: stats?.ordiniNelPeriodo ?? 0,
      tab: 'conferme',
      accent: c.accent,
      accentHex: c.hex,
      chevronClass: c.chevronClass,
      chevronHoverClass: c.chevronHoverClass,
      headerRule: c.headerRule,
      icon: (
        <svg className="text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      ),
      sub: t.fornitori.subOrdiniPeriodo,
      subColor: (stats?.ordiniNelPeriodo ?? 0) > 0 ? c.subStrong : 'text-app-fg-muted',
    },
    {
      label: t.fornitori.kpiBolleTotal,
      value: stats?.bolleTotal ?? 0,
      tab: 'bolle',
      accent: b.accent,
      accentHex: b.hex,
      chevronClass: b.chevronClass,
      chevronHoverClass: b.chevronHoverClass,
      headerRule: b.headerRule,
      icon: (
        <svg className="text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
      sub:
        (stats?.bolleTotal ?? 0) === 0
          ? t.fornitori.subBollePeriodoVuoto
          : t.fornitori.subBollePeriodoRiepilogo
              .replace('{open}', String(stats?.bolleAperte ?? 0))
              .replace('{total}', String(stats?.bolleTotal ?? 0)),
      subColor: (stats?.bolleAperte ?? 0) > 0 ? b.subStrong : 'text-app-fg-muted',
    },
    {
      label: t.fornitori.kpiFatturatoPeriodo,
      value: formatMoney(stats?.totaleSpesa ?? 0),
      tab: 'fatture',
      accent: f.accent,
      accentHex: f.hex,
      chevronClass: f.chevronClass,
      chevronHoverClass: f.chevronHoverClass,
      headerRule: f.headerRule,
      isSpesaTotale: true,
      valueSupplement:
        (stats?.totaleSpesaLordo ?? 0) > (stats?.totaleSpesa ?? 0) + 0.005
          ? t.fornitori.subFatturatoTotaleLordoMicro.replace('{amount}', formatMoney(stats?.totaleSpesaLordo ?? 0))
          : undefined,
      icon: (
        <svg className="text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      sub:
        (stats?.fattureTotal ?? 0) === 0
          ? t.fornitori.subFatturatoPeriodoZero
          : (stats?.fattureTotal ?? 0) === 1
            ? t.fornitori.subFatturatoPeriodoCount_one
            : t.fornitori.subFatturatoPeriodoCount_other.replace('{n}', String(stats?.fattureTotal ?? 0)),
      subColor: f.subStrong,
    },
    {
      label: t.statements.tabVerifica,
      value: stats?.statementsInPeriod ?? 0,
      tab: 'verifica',
      accent: v.accent,
      accentHex: v.hex,
      chevronClass: v.chevronClass,
      chevronHoverClass: v.chevronHoverClass,
      headerRule: v.headerRule,
      icon: (
        <svg className="text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
      sub: stmtSub,
      subColor: stmtSubColor,
    },
    {
      label: t.fornitori.kpiListinoProdottiPeriodo,
      value: stats?.listinoProdottiDistinti ?? 0,
      tab: 'listino',
      accent: l.accent,
      accentHex: l.hex,
      chevronClass: l.chevronClass,
      chevronHoverClass: l.chevronHoverClass,
      headerRule: l.headerRule,
      icon: (
        <svg className="text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h10M4 18h10" />
        </svg>
      ),
      sub:
        (stats?.listinoAnomaliesCount ?? 0) > 0
          ? `${stats?.listinoAnomaliesCount} anomali${(stats?.listinoAnomaliesCount ?? 0) === 1 ? 'a' : 'e'} prezzo da verificare`
          : (stats?.rekkiPriceAnomalies ?? 0) > 0
            ? t.fornitori.subListinoPriceAnomalies.replace('{n}', String(stats?.rekkiPriceAnomalies ?? 0))
            : (stats?.listinoRows ?? 0) === 0
              ? t.fornitori.subListinoPeriodoVuoto
              : t.fornitori.subListinoProdottiEAggiornamenti
                  .replace('{p}', String(stats?.listinoProdottiDistinti ?? 0))
                  .replace('{u}', String(stats?.listinoRows ?? 0)),
      subColor:
        (stats?.listinoAnomaliesCount ?? 0) > 0
          ? 'text-rose-300'
          : (stats?.rekkiPriceAnomalies ?? 0) > 0
            ? 'text-rose-300'
            : (stats?.listinoRows ?? 0) > 0
              ? l.subStrong
              : 'text-app-fg-muted',
    },
    {
      label: t.fornitori.kpiPending,
      value: stats?.pending ?? 0,
      tab: 'documenti',
      accent: d.accent,
      accentHex: d.hex,
      chevronClass: d.chevronClass,
      chevronHoverClass: d.chevronHoverClass,
      headerRule: d.headerRule,
      icon: (
        <svg className="text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      sub: t.fornitori.subDocumentiCodaEmailPeriodo,
      subColor: (stats?.pending ?? 0) > 0 ? d.subStrong : 'text-app-fg-muted',
    },
  ]
}

/** Griglia KPI desktop: sempre visibile sotto le tab (tutte le sezioni). */
function SupplierDesktopKpiGrid({
  loading,
  stats,
  onTabChange,
  hiddenTabs,
}: {
  loading: boolean
  stats: SupplierPeriodStats | null
  onTabChange: (tab: Tab) => void
  /** Tab nascosti su mobile: i KPI che puntano a questi tab vengono esclusi */
  hiddenTabs?: Tab[]
}) {
  const t = useT()
  const { locale, currency } = useLocale()
  const formatMoney = useCallback(
    (amount: number) => formatCurrency(amount, currency, locale),
    [currency, locale],
  )
  const displayStats = stats ?? EMPTY_SUPPLIER_PERIOD_STATS
  const allKpis = useMemo(() => buildSupplierKpiItems(displayStats, t, formatMoney), [displayStats, t, formatMoney])
  const kpis = useMemo(
    () => hiddenTabs?.length ? allKpis.filter((k) => !hiddenTabs.includes(k.tab)) : allKpis,
    [allKpis, hiddenTabs],
  )
  return (
    <div
      className={SUPPLIER_DESKTOP_KPI_GRID_LAYOUT_CLASS}
      aria-busy={loading}
      aria-live="polite"
    >
      {kpis.map((k) => (
        <button
          key={k.label}
          type="button"
          onClick={() => onTabChange(k.tab)}
          className="supplier-desktop-kpi-card group relative flex h-full min-h-[68px] flex-col cursor-pointer overflow-hidden text-left transition-[transform,box-shadow] duration-200 hover:shadow-[0_16px_48px_-12px_rgba(var(--supplier-kpi-rgb),0.32)] active:scale-[0.98] md:min-h-[148px]"
          style={{
            boxShadow: supplierDesktopKpiOuterShadow(k.accentHex),
            ['--supplier-kpi-rgb' as string]: hexToRgbTuple(k.accentHex),
          }}
        >
          <div className="relative z-[1] flex min-h-0 flex-1 flex-col p-1.5 md:p-3">
            {/* Mobile: layout orizzontale compatto icona+label a sinistra, valore a destra */}
            <div className="flex h-full items-center justify-between gap-1 md:hidden">
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center [&>svg]:h-3.5 [&>svg]:w-3.5">
                  {k.icon}
                </span>
                <p className="min-w-0 truncate text-[9px] font-semibold uppercase tracking-wide text-white/70">
                  {k.label}
                </p>
              </div>
              <p className="shrink-0 text-sm font-bold tabular-nums leading-none tracking-tight text-white">
                {k.value}
              </p>
            </div>
            {/* Desktop: layout originale verticale */}
            <div className="hidden md:flex min-h-0 flex-1 flex-col">
              <div className={`flex min-h-0 shrink-0 items-center justify-between gap-2 pb-2 md:min-h-[2.5rem] ${k.headerRule}`}>
                <p className="min-w-0 flex-1 pr-1 text-left text-[11px] font-semibold uppercase leading-snug tracking-wider text-app-fg-muted line-clamp-2">
                  {k.label}
                </p>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center [&>svg]:h-[1.2rem] [&>svg]:w-[1.2rem] [&>svg]:shrink-0">
                  {k.icon}
                </span>
              </div>
              <div className="flex min-h-0 flex-1 flex-col justify-end gap-1 pt-1.5">
                <div className="flex min-h-[2.85rem] shrink-0 flex-col justify-end">
                  <p className={`line-clamp-2 text-left text-[11px] font-medium leading-snug ${k.subColor}`}>{k.sub}</p>
                </div>
                <div className="flex shrink-0 items-end justify-between gap-1">
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate text-xl font-bold tabular-nums leading-none tracking-tight text-app-fg">{k.value}</p>
                    {k.valueSupplement ? (
                      <p className="mt-0.5 truncate text-[10px] font-medium leading-tight text-app-fg-muted">{k.valueSupplement}</p>
                    ) : null}
                  </div>
                  <svg className={`mb-0.5 h-3.5 w-3.5 shrink-0 self-end transition-colors ${k.chevronClass} ${k.chevronHoverClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}

function supplierMonthKey(y: number, m: number) {
  return `${y}-${String(m).padStart(2, '0')}`
}

type SupplierMonthlyDocRow = {
  y: number
  m: number
  monthLabel: string
  bolle: number
  fatture: number
  fattureImporto: number
  ordini: number
  statements: number
  pending: number
}

/** Solo spostamento per anno (come « / » anno in header); il mese resta quello già selezionato. */
type SupplierMonthlyDocPeriodNav = {
  onPrevYear: () => void
  onNextYear: () => void
  onResetToNow: () => void
  disableNextYear: boolean
  showResetToNow: boolean
}

function useSupplierMonthlyDocSummary(
  fornitoreId: string,
  endYear: number,
  endMonth: number,
  countryCode: string
) {
  const [rows, setRows] = useState<SupplierMonthlyDocRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const { locale, timezone } = useLocale()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setRows(null)
    const windows = listFiscalMonthsThroughSelection(countryCode, endYear, endMonth)
    if (windows.length === 0) {
      setRows([])
      setLoading(false)
      return
    }
    const minFrom = windows.reduce((a, w) => (w.from < a ? w.from : a), windows[0].from)
    const maxTo = windows.reduce((a, w) => (w.to > a ? w.to : a), windows[0].to)
    const keySet = new Set(windows.map((w) => supplierMonthKey(w.y, w.m)))
    const supabase = createClient()
    const createdGte = `${minFrom}T00:00:00.000Z`
    const createdLt = `${maxTo}T00:00:00.000Z`

    Promise.all([
      supabase.from('bolle').select('data').eq('fornitore_id', fornitoreId).gte('data', minFrom).lt('data', maxTo),
      supabase.from('fatture').select('data, importo').eq('fornitore_id', fornitoreId).gte('data', minFrom).lt('data', maxTo),
      supabase
        .from('conferme_ordine')
        .select('created_at')
        .eq('fornitore_id', fornitoreId)
        .gte('created_at', createdGte)
        .lt('created_at', createdLt),
      supabase
        .from('statements')
        .select('missing_rows, received_at, extracted_pdf_dates')
        .eq('fornitore_id', fornitoreId)
        .order('received_at', { ascending: false })
        .limit(800),
      supabase
        .from('documenti_da_processare')
        .select('created_at, data_documento')
        .eq('fornitore_id', fornitoreId)
        .in('stato', ['in_attesa', 'da_associare'])
        .limit(500),
    ])
      .then(([bolleRes, fattureRes, ordiniRes, stmtsRes, pendingRes]) => {
        if (cancelled) return
        const agg = new Map<
          string,
          { bolle: number; fatture: number; fattureImporto: number; ordini: number; statements: number; pending: number }
        >()
        for (const w of windows) {
          agg.set(supplierMonthKey(w.y, w.m), {
            bolle: 0,
            fatture: 0,
            fattureImporto: 0,
            ordini: 0,
            statements: 0,
            pending: 0,
          })
        }
        const bump = (
          key: string,
          field: 'bolle' | 'fatture' | 'fattureImporto' | 'ordini' | 'statements' | 'pending',
          n = 1,
          extra = 0
        ) => {
          if (!keySet.has(key)) return
          const cell = agg.get(key)
          if (!cell) return
          if (field === 'fattureImporto') cell.fattureImporto += extra
          else (cell as Record<string, number>)[field] += n
        }

        if (!bolleRes.error && bolleRes.data) {
          for (const r of bolleRes.data as { data: string }[]) {
            const k = (r.data ?? '').slice(0, 7)
            bump(k, 'bolle')
          }
        }
        if (!fattureRes.error && fattureRes.data) {
          for (const r of fattureRes.data as { data: string; importo: number | null }[]) {
            const k = (r.data ?? '').slice(0, 7)
            bump(k, 'fatture')
            bump(k, 'fattureImporto', 0, r.importo ?? 0)
          }
        }
        if (!ordiniRes.error && ordiniRes.data) {
          for (const r of ordiniRes.data as { created_at: string }[]) {
            const d = (r.created_at ?? '').slice(0, 10)
            const k = d.slice(0, 7)
            bump(k, 'ordini')
          }
        }
        if (!stmtsRes.error && stmtsRes.data) {
          const stmtRows = stmtsRes.data as {
            missing_rows: number | null
            received_at: string
            extracted_pdf_dates: unknown
          }[]
          for (const w of windows) {
            const k = supplierMonthKey(w.y, w.m)
            const n = stmtRows.filter((s) => statementMatchesCalendarWindow(s, w.from, w.to)).length
            if (n > 0) {
              const cell = agg.get(k)
              if (cell) cell.statements = n
            }
          }
        }
        if (!pendingRes.error && pendingRes.data) {
          for (const r of pendingRes.data as { created_at: string; data_documento: string | null }[]) {
            const doc = r.data_documento?.trim()
            const day = doc && /^\d{4}-\d{2}-\d{2}$/.test(doc) ? doc : (r.created_at ?? '').slice(0, 10)
            const k = day.slice(0, 7)
            bump(k, 'pending')
          }
        }

        const out: SupplierMonthlyDocRow[] = windows.map((w) => {
          const k = supplierMonthKey(w.y, w.m)
          const a = agg.get(k)!
          return {
            y: w.y,
            m: w.m,
            monthLabel: formatMonthYearUppercase(
              `${w.y}-${String(w.m).padStart(2, '0')}-15`,
              locale,
              timezone
            ),
            bolle: a.bolle,
            fatture: a.fatture,
            fattureImporto: a.fattureImporto,
            ordini: a.ordini,
            statements: a.statements,
            pending: a.pending,
          }
        })
        setRows(out)
      })
      .catch(() => {
        if (!cancelled) setRows(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [fornitoreId, endYear, endMonth, countryCode, locale, timezone])

  return { rows, loading }
}

/** Thead sul guscio trasparente: niente `app-workspace-inset-bg-soft` (vedi `APP_SECTION_TABLE_HEAD_ROW`). */
const SUPPLIER_MONTHLY_TABLE_HEAD_ROW = 'border-b border-app-line-22 bg-transparent'

/** Tabella riepilogo documenti per mese — solo desktop, sotto la griglia KPI. */
function SupplierDesktopMonthlyDocSummary({
  fornitoreId,
  endYear,
  endMonth,
  selectedYear,
  selectedMonth,
  countryCode,
  currency,
  activeTab,
  onOpenMonthTab,
  periodNav,
}: {
  fornitoreId: string
  endYear: number
  endMonth: number
  selectedYear: number
  selectedMonth: number
  countryCode: string
  currency: string
  /** Bordo / barra / accenti tabella come la card del tab sotto (fatture, bolle, …). */
  activeTab: Tab
  onOpenMonthTab: (y: number, m: number, tab: Tab) => void
  periodNav?: SupplierMonthlyDocPeriodNav
}) {
  const t = useT()
  const { locale } = useLocale()
  const { rows, loading } = useSupplierMonthlyDocSummary(fornitoreId, endYear, endMonth, countryCode)
  const cur = currency?.trim() || 'GBP'
  const ccSede = countryCode?.trim() || 'UK'

  const tabHi = SUPPLIER_DETAIL_TAB_HIGHLIGHT[activeTab]
  const tabTable = SUPPLIER_DETAIL_TAB_TABLE_ACCENT[activeTab]

  const tabName = (tab: Tab) => {
    switch (tab) {
      case 'dashboard':
        return t.fornitori.tabRiepilogo
      case 'bolle':
        return t.nav.bolle
      case 'fatture':
        return t.nav.fatture
      case 'conferme':
        return t.fornitori.kpiOrdini
      case 'verifica':
        return t.statements.tabVerifica
      case 'documenti':
        return t.statements.tabDocumenti
      case 'listino':
        return t.fornitori.tabListino
      default:
        return tab
    }
  }

  const ariaGoTo = (tab: Tab, monthLabel: string) =>
    t.fornitori.supplierMonthlyDocAriaGoToTabMonth
      .replace('{tab}', tabName(tab))
      .replace('{month}', monthLabel)

  const dataCellBtn = `w-full min-h-[2.125rem] rounded-md px-2 py-1.5 text-right tabular-nums text-app-fg-muted transition-colors hover:app-workspace-inset-bg ${tabTable.cellHover} focus:outline-none focus-visible:ring-2 ${tabTable.focusRing}`
  const lastDaySelected = new Date(Date.UTC(selectedYear, selectedMonth, 0))
  const fiscalSelectedLabel = defaultFiscalYearLabel(ccSede, lastDaySelected)
  const fiscalSelectedDisplay = formatFiscalYearShort(ccSede, fiscalSelectedLabel)
  const fiscalSelectedLine = t.fornitori.supplierMonthlyDocFiscalSelected.replace('{year}', fiscalSelectedDisplay)

  const lastDayTableEnd = new Date(Date.UTC(endYear, endMonth, 0))
  const fiscalTableEndDisplay = formatFiscalYearShort(
    ccSede,
    defaultFiscalYearLabel(ccSede, lastDayTableEnd)
  )

  return (
    <section
      className={`supplier-detail-tab-shell mb-5 hidden overflow-hidden md:flex md:flex-col ${tabHi.border}`}
      aria-busy={loading}
      aria-live="polite"
    >
      <div className={`app-card-bar-accent ${tabHi.bar}`} aria-hidden />
      <div className="border-b border-app-soft-border bg-transparent px-4 py-2.5 sm:px-5">
        <div className="flex min-w-0 flex-row items-center gap-3">
          <h3 className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-[11px] leading-snug md:text-xs md:leading-snug">
            <span className="min-w-0 flex-1 truncate text-left uppercase tracking-wide md:tracking-wider">
              <span className="font-bold text-app-fg">{t.fornitori.supplierMonthlyDocTitle}</span>
              {!periodNav ? (
                <>
                  <span className="text-app-fg-muted/45" aria-hidden>
                    {' '}
                    ·{' '}
                  </span>
                  <span className="font-semibold tabular-nums text-app-fg-muted">
                    {fiscalSelectedLine}
                  </span>
                </>
              ) : null}
            </span>
            {periodNav ? (
              <>
                <span className="shrink-0 text-app-fg-muted/45 uppercase tracking-wide md:tracking-wider" aria-hidden>
                  {' '}
                  ·{' '}
                </span>
                <div
                  role="group"
                  className={`flex shrink-0 flex-nowrap items-center gap-0.5 rounded-md border px-0.5 py-px ${tabTable.periodNavWrap}`}
                  aria-label={`${t.fornitori.supplierMonthlyDocTitle} · ${fiscalTableEndDisplay}`}
                >
                  <button
                    type="button"
                    onClick={periodNav.onPrevYear}
                    title={t.appStrings.monthNavPrevYearTitle}
                    aria-label={t.appStrings.monthNavPrevYearTitle}
                    className={`flex h-5 w-5 items-center justify-center rounded transition-colors ${tabTable.periodNavIconBtn}`}
                  >
                    <svg className={`h-3 w-3 ${icon.settingsTools}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-9-9 9-9m9 18l-9-9 9-9" />
                    </svg>
                  </button>
                  <span
                    className={`min-w-[3rem] px-0.5 text-center font-semibold uppercase tracking-wide tabular-nums sm:min-w-[3.25rem] md:tracking-wider ${tabTable.monthSelected}`}
                  >
                    {fiscalTableEndDisplay}
                  </span>
                  <button
                    type="button"
                    onClick={periodNav.onNextYear}
                    disabled={periodNav.disableNextYear}
                    title={t.appStrings.monthNavNextYearTitle}
                    aria-label={t.appStrings.monthNavNextYearTitle}
                    className={`flex h-5 w-5 items-center justify-center rounded transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${tabTable.periodNavIconBtn}`}
                  >
                    <svg className={`h-3 w-3 ${icon.settingsTools}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l9 9-9 9M4 5l9 9-9 9" />
                    </svg>
                  </button>
                  {periodNav.showResetToNow ? (
                    <button
                      type="button"
                      onClick={periodNav.onResetToNow}
                      title={t.appStrings.monthNavResetTitle}
                      aria-label={t.appStrings.monthNavResetTitle}
                      className={`flex h-5 w-5 items-center justify-center rounded transition-colors ${tabTable.resetNav}`}
                    >
                      <svg className={`h-3 w-3 ${icon.emailSync}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M3 12a9 9 0 1018 0 9 9 0 00-18 0m9-4v4l3 3"
                        />
                      </svg>
                    </button>
                  ) : null}
                </div>
              </>
            ) : null}
          </h3>
        </div>
      </div>
      <div className="min-w-0 flex-1 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead className={APP_SECTION_TABLE_THEAD_STICKY}>
            <tr className={SUPPLIER_MONTHLY_TABLE_HEAD_ROW}>
              <th className="sticky left-0 z-[1] bg-transparent px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">
                {t.fornitori.supplierMonthlyDocColMonth}
              </th>
              <th className="px-5 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-app-fg-muted tabular-nums">
                {t.fornitori.supplierMonthlyDocColFiscalYear}
              </th>
              <th className="px-5 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-app-fg-muted tabular-nums">
                {t.fornitori.supplierMonthlyDocColBolle}
              </th>
              <th className="px-5 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-app-fg-muted tabular-nums">
                {t.fornitori.supplierMonthlyDocColFatture}
              </th>
              <th className="px-5 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-app-fg-muted tabular-nums">
                {t.fornitori.supplierMonthlyDocColSpesa}
              </th>
              <th className="px-5 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-app-fg-muted tabular-nums">
                {t.fornitori.supplierMonthlyDocColOrdini}
              </th>
              <th className="px-5 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-app-fg-muted tabular-nums">
                {t.fornitori.supplierMonthlyDocColStatements}
              </th>
              <th className="px-5 py-2.5 pr-5 text-right text-[10px] font-bold uppercase tracking-widest text-app-fg-muted tabular-nums">
                {t.fornitori.supplierMonthlyDocColPending}
              </th>
            </tr>
          </thead>
          <tbody className={APP_SECTION_TABLE_TBODY}>
            {(rows ?? []).map((r) => {
              const sel = r.y === selectedYear && r.m === selectedMonth
              const lastDayRow = new Date(Date.UTC(r.y, r.m, 0))
              const fyRow = formatFiscalYearShort(ccSede, defaultFiscalYearLabel(ccSede, lastDayRow))
              return (
                <tr
                  key={`${r.y}-${r.m}`}
                  className={`group transition-colors ${sel ? tabTable.selectionRow : 'hover:app-workspace-inset-bg'}`}
                >
                  <td
                    className={`sticky left-0 z-[1] bg-transparent px-0 ${sel ? tabTable.selectionRow : 'group-hover:bg-app-line-10'}`}
                  >
                    <button
                      type="button"
                      onClick={() => onOpenMonthTab(r.y, r.m, 'dashboard')}
                      className={`w-full px-5 py-3 text-left text-sm font-medium tabular-nums transition-colors md:pl-5 ${sel ? tabTable.monthSelected : 'text-app-fg-muted'} ${tabTable.cellHover}`}
                      aria-label={ariaGoTo('dashboard', r.monthLabel)}
                      title={ariaGoTo('dashboard', r.monthLabel)}
                    >
                      {r.monthLabel}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-app-fg-muted">
                    <button
                      type="button"
                      onClick={() => onOpenMonthTab(r.y, r.m, 'dashboard')}
                      className={`${dataCellBtn}`}
                      aria-label={ariaGoTo('dashboard', r.monthLabel)}
                      title={ariaGoTo('dashboard', r.monthLabel)}
                    >
                      {fyRow}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    <button
                      type="button"
                      onClick={() => onOpenMonthTab(r.y, r.m, 'bolle')}
                      className={dataCellBtn}
                      aria-label={ariaGoTo('bolle', r.monthLabel)}
                      title={ariaGoTo('bolle', r.monthLabel)}
                    >
                      {r.bolle}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    <button
                      type="button"
                      onClick={() => onOpenMonthTab(r.y, r.m, 'fatture')}
                      className={dataCellBtn}
                      aria-label={ariaGoTo('fatture', r.monthLabel)}
                      title={ariaGoTo('fatture', r.monthLabel)}
                    >
                      {r.fatture}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    <button
                      type="button"
                      onClick={() => onOpenMonthTab(r.y, r.m, 'fatture')}
                      className={dataCellBtn}
                      aria-label={ariaGoTo('fatture', r.monthLabel)}
                      title={ariaGoTo('fatture', r.monthLabel)}
                    >
                      {formatCurrency(r.fattureImporto, cur, locale)}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    <button
                      type="button"
                      onClick={() => onOpenMonthTab(r.y, r.m, 'conferme')}
                      className={dataCellBtn}
                      aria-label={ariaGoTo('conferme', r.monthLabel)}
                      title={ariaGoTo('conferme', r.monthLabel)}
                    >
                      {r.ordini}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    <button
                      type="button"
                      onClick={() => onOpenMonthTab(r.y, r.m, 'verifica')}
                      className={dataCellBtn}
                      aria-label={ariaGoTo('verifica', r.monthLabel)}
                      title={ariaGoTo('verifica', r.monthLabel)}
                    >
                      {r.statements}
                    </button>
                  </td>
                  <td className="px-5 py-3 pr-5 text-right tabular-nums">
                    <button
                      type="button"
                      onClick={() => onOpenMonthTab(r.y, r.m, 'documenti')}
                      className={dataCellBtn}
                      aria-label={ariaGoTo('documenti', r.monthLabel)}
                      title={ariaGoTo('documenti', r.monthLabel)}
                    >
                      {r.pending}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!loading && rows?.length === 0 && (
          <p className="border-t border-app-line-15 px-5 py-8 text-center text-sm text-app-fg-muted">—</p>
        )}
        {loading && rows == null && (
          <p className="border-t border-app-line-15 px-5 py-8 text-center text-sm text-app-fg-muted">…</p>
        )}
      </div>
    </section>
  )
}

function DashboardTab({
  fornitoreId,
  fornitore,
  readOnly,
}: {
  fornitoreId: string
  fornitore: Fornitore
  /** Passato dal parent per coerenza API; refresh profilo gestito altrove se necessario */
  onFornitoreReload?: () => void
  readOnly?: boolean
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const supplierReturnPath = useMemo(
    () => buildListLocationPath(pathname, searchParams),
    [pathname, searchParams],
  )
  const t = useT()
  const { locale, timezone } = useLocale()
  const fornitoreNomeVisual = useMemo(
    () => fornitoreDisplayLabelUppercase(fornitore),
    [fornitore],
  )

  // Contacts state
  const [contatti, setContatti]           = useState<ContattoRow[]>([])
  const [contattiLoading, setContattiLoading] = useState(true)
  const [contattiError, setContattiError] = useState(false)
  const [showAddForm, setShowAddForm]     = useState(false)
  const [editingId, setEditingId]         = useState<string | null>(null)
  const [deletingId, setDeletingId]       = useState<string | null>(null)
  const [formNome, setFormNome]           = useState('')
  const [formRuolo, setFormRuolo]         = useState('')
  const [formEmail, setFormEmail]         = useState('')
  const [formTelefono, setFormTelefono]   = useState('')
  const [formSaving, setFormSaving]       = useState(false)

  const loadContatti = async () => {
    const res = await fetch(`/api/fornitore-contatti?fornitore_id=${fornitoreId}`)
    if (!res.ok) { setContattiError(true); setContattiLoading(false); return }
    const data = await res.json()
    if (Array.isArray(data)) { setContatti(data); setContattiError(false) }
    else setContattiError(true)
    setContattiLoading(false)
  }

  const openAdd = () => {
    setEditingId(null)
    setFormNome(''); setFormRuolo(''); setFormEmail(''); setFormTelefono('')
    setShowAddForm(true)
  }

  const openEdit = (c: ContattoRow) => {
    setEditingId(c.id)
    setFormNome(c.nome); setFormRuolo(c.ruolo ?? ''); setFormEmail(c.email ?? ''); setFormTelefono(c.telefono ?? '')
    setShowAddForm(true)
  }

  const handleSaveContatto = async () => {
    if (!formNome.trim()) return
    setFormSaving(true)
    const body = { fornitore_id: fornitoreId, nome: formNome, ruolo: formRuolo, email: formEmail, telefono: formTelefono }
    const res = editingId
      ? await fetch(`/api/fornitore-contatti?id=${editingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      : await fetch('/api/fornitore-contatti', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setFormSaving(false)
    if (res.ok) { setShowAddForm(false); setEditingId(null); await loadContatti() }
  }

  const handleDeleteContatto = async (id: string) => {
    setDeletingId(id)
    await fetch(`/api/fornitore-contatti?id=${id}`, { method: 'DELETE' })
    setDeletingId(null)
    await loadContatti()
  }

  useEffect(() => { loadContatti() }, [fornitoreId]) // eslint-disable-line react-hooks/exhaustive-deps

  const nuovaBollaActive =
    pathname === '/bolle/new' && searchParams.get('fornitore_id') === fornitoreId

  /** Accordion mobile: chiusi di default per dare priorità alla lista prodotti */
  const [mobileContattiOpen, setMobileContattiOpen] = useState(false)
  const [mobileSchedaOpen, setMobileSchedaOpen] = useState(false)

  return (
    <div className="space-y-6">
      {/* Mobile: stesse azioni che prima erano nella bottom bar fissa, sotto i KPI */}
      {!readOnly ? (
      <div className="md:hidden">
        <Link
          href={hrefWithReturnTo(`/bolle/new?fornitore_id=${fornitoreId}`, supplierReturnPath)}
          onClick={() => saveScrollForListPath(supplierReturnPath)}
          className={`app-glow-cyan flex min-h-[44px] min-w-0 touch-manipulation items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-white transition-colors active:scale-[0.99] ${
            nuovaBollaActive
              ? 'bg-cyan-600 ring-2 ring-white/30 ring-offset-2 ring-offset-[rgb(15_23_42)]'
              : 'bg-app-cyan-500 hover:bg-cyan-600 active:bg-cyan-700'
          }`}
          aria-current={nuovaBollaActive ? 'page' : undefined}
        >
          <svg className={`h-5 w-5 shrink-0 ${icon.bolle}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="truncate">{t.nav.nuovaBolla}</span>
        </Link>
      </div>
      ) : null}

      {/* Desktop md+: due colonne (contatti + info); senza contatti → colonna singola. */}
      <div
        className={`grid grid-cols-1 gap-6 md:grid md:items-stretch md:gap-4 ${contattiError ? 'md:grid-cols-1' : 'md:grid-cols-2'}`}
      >
      {/* ── Contacts section ── */}
      {!contattiError && (
        <div className="flex min-h-0 min-w-0 flex-col md:h-full md:min-h-[18rem]">
        <div className={`supplier-detail-tab-shell flex h-full min-h-0 flex-1 flex-col overflow-hidden`}>
          <div className={`app-card-bar-accent ${SUPPLIER_DETAIL_TAB_HIGHLIGHT.dashboard.bar}`} aria-hidden />
          {/* Accordion header: su mobile mostra toggle; su desktop è sempre aperto */}
          <div
            className="flex shrink-0 items-center justify-between border-b border-app-line-22 px-4 py-2.5 md:px-5 md:py-3 md:cursor-default cursor-pointer"
            onClick={() => setMobileContattiOpen((v) => !v)}
            role="button"
            aria-expanded={mobileContattiOpen}
          >
            <div className="flex items-center gap-2">
              <svg className="h-3.5 w-3.5 text-app-fg-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/80">{t.appStrings.contactsHeading}</p>
              {contatti.length > 0 && (
                <span className="rounded-full border border-app-soft-border app-workspace-inset-bg px-2 py-0.5 text-[10px] font-medium text-app-fg-muted">
                  {contatti.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Chevron accordion su mobile */}
              <svg
                className={`h-4 w-4 text-white/50 transition-transform duration-200 md:hidden ${mobileContattiOpen ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              {!readOnly ? (
              <button
                onClick={(e) => { e.stopPropagation(); openAdd() }}
                className="flex items-center gap-1 px-2.5 py-1 bg-app-cyan-500 hover:bg-app-cyan-400 text-white text-[11px] font-bold rounded-lg transition-colors">
                <svg className={`w-3 h-3 ${icon.settingsTools}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                {t.common.add}
              </button>
              ) : null}
            </div>
          </div>

          <div className={`min-h-0 flex-1 overflow-y-auto ${mobileContattiOpen ? '' : 'hidden md:block'}`}>
          {/* Add / edit form */}
          {!readOnly && showAddForm && (
            <div className="border-b border-app-line-25 bg-app-line-10 px-4 py-4 md:px-5">
              <p className="mb-3 text-xs font-semibold text-app-fg-muted">{editingId ? t.appStrings.contactEdit : t.appStrings.contactNew}</p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="md:col-span-2">
                  <label className="mb-1 block text-[10px] font-semibold uppercase text-app-fg-muted">{t.fornitori.nome} *</label>
                  <input type="text" value={formNome} onChange={e => setFormNome(e.target.value)} placeholder="Marco Ferretti"
                    className="w-full rounded-lg border border-app-line-28 app-workspace-inset-bg-soft px-3 py-2 text-sm text-app-fg focus:outline-none focus:ring-2 focus:ring-app-line-40" />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase text-app-fg-muted">{t.common.role}</label>
                  <input type="text" value={formRuolo} onChange={e => setFormRuolo(e.target.value)} placeholder="Administration"
                    className="w-full rounded-lg border border-app-line-28 app-workspace-inset-bg-soft px-3 py-2 text-sm text-app-fg focus:outline-none focus:ring-2 focus:ring-app-line-40" />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase text-app-fg-muted">{t.common.phone}</label>
                  <input type="tel" value={formTelefono} onChange={e => setFormTelefono(e.target.value)} placeholder="+44 20 1234 5678"
                    className="w-full rounded-lg border border-app-line-28 app-workspace-inset-bg-soft px-3 py-2 text-sm text-app-fg focus:outline-none focus:ring-2 focus:ring-app-line-40" />
                </div>
                <div className="md:col-span-4">
                  <label className="mb-1 block text-[10px] font-semibold uppercase text-app-fg-muted">{t.fornitori.email}</label>
                  <input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="marco@supplier.com"
                    className="w-full rounded-lg border border-app-line-28 app-workspace-inset-bg-soft px-3 py-2 text-sm text-app-fg focus:outline-none focus:ring-2 focus:ring-app-line-40" />
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={handleSaveContatto} disabled={formSaving || !formNome.trim()}
                  className="rounded-lg bg-app-cyan-500 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-app-cyan-400 disabled:opacity-40">
                  {formSaving ? t.common.saving : t.common.save}
                </button>
                <button onClick={() => { setShowAddForm(false); setEditingId(null) }}
                  className="rounded-lg px-4 py-2 text-xs font-medium text-app-fg-muted transition-colors hover:text-app-fg">
                  {t.common.cancel}
                </button>
              </div>
            </div>
          )}

          {/* Contact list */}
          {contattiLoading ? (
            <div className={APP_SECTION_DIVIDE_ROWS}>
              {[...Array(2)].map((_, i) => (
                <div key={i} className="flex animate-pulse items-center gap-3 px-4 py-3 md:px-5 md:py-3.5">
                  <div className="h-10 w-10 shrink-0 rounded-xl app-workspace-inset-bg" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-3 w-24 rounded app-workspace-inset-bg" />
                    <div className="h-3.5 w-36 rounded app-workspace-inset-bg" />
                  </div>
                </div>
              ))}
            </div>
          ) : contatti.length === 0 && !showAddForm ? (
            <div className="px-4 py-8 text-center md:px-5">
              <svg className="mx-auto mb-2 h-8 w-8 text-app-fg-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              <p className="text-xs text-app-fg-muted">{t.appStrings.noContactRegistered}</p>
            </div>
          ) : (
            <div className={APP_SECTION_DIVIDE_ROWS}>
              {contatti.map(c => (
                <div key={c.id} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:app-workspace-inset-bg-soft md:px-5 md:py-3.5">
                  {/* Avatar */}
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white ${getAvatarColor(c.nome)}`}>
                    {getInitials(c.nome)}
                  </div>
                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    {c.ruolo && <p className="text-[10px] leading-tight text-app-fg-muted">{c.ruolo}</p>}
                    <p className="text-sm font-semibold leading-tight text-app-fg">{c.nome}</p>
                  </div>
                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-1">
                    {c.telefono && (
                      <a href={`tel:${c.telefono}`} title={c.telefono}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-emerald-400 transition-colors hover:bg-emerald-500/15">
                        <svg className={`w-4 h-4 ${icon.fornitori}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                      </a>
                    )}
                    {c.email && (
                      <a href={`mailto:${c.email}`} title={c.email}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-app-cyan-500 transition-colors hover:bg-app-line-15">
                        <svg className={`w-4 h-4 ${icon.emailSync}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      </a>
                    )}
                    {!readOnly ? (
                    <button onClick={() => openEdit(c)} title={t.common.edit}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-app-fg-muted opacity-0 transition-colors hover:bg-app-line-12 hover:text-app-fg group-hover:opacity-100">
                      <svg className={`w-3.5 h-3.5 ${icon.settingsTools}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                    ) : null}
                    {!readOnly ? (
                    <button onClick={() => handleDeleteContatto(c.id)} disabled={deletingId === c.id} title={t.appStrings.contactRemove}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-app-fg-muted opacity-0 transition-colors hover:bg-red-950/50 hover:text-red-400 group-hover:opacity-100 disabled:opacity-40">
                      {deletingId === c.id
                        ? <svg className={`w-3.5 h-3.5 animate-spin ${icon.destructive}`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                        : <svg className={`w-3.5 h-3.5 ${icon.destructive}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      }
                    </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
        </div>
      )}

      {/* Supplier info card */}
      <div className="flex min-h-0 min-w-0 flex-col md:h-full md:min-h-[18rem]">
      <div className={`supplier-detail-tab-shell flex h-full min-h-0 flex-1 flex-col overflow-hidden`}>
        <div className={`app-card-bar-accent ${SUPPLIER_DETAIL_TAB_HIGHLIGHT.dashboard.bar}`} aria-hidden />
        <div
          className="flex shrink-0 items-center justify-between border-b border-app-line-22 px-5 py-3 cursor-pointer md:cursor-default"
          onClick={() => setMobileSchedaOpen((v) => !v)}
          role="button"
          aria-expanded={mobileSchedaOpen}
        >
          <div className="flex items-center gap-2">
            <svg className="h-3.5 w-3.5 text-app-fg-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
            <p className="text-xs font-semibold uppercase tracking-wide text-white/80">{t.appStrings.infoSupplierCard}</p>
          </div>
          <svg
            className={`h-4 w-4 text-white/50 transition-transform duration-200 md:hidden ${mobileSchedaOpen ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        <div className={`flex min-h-0 flex-1 flex-col overflow-y-auto ${APP_SECTION_DIVIDE_ROWS} ${mobileSchedaOpen ? '' : 'hidden md:flex'}`}>

          {/* Contact */}
          <div className="space-y-3 px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-app-fg-muted">{t.appStrings.contactsHeading}</p>
            {fornitore.email && (
              <div className="flex items-center gap-2">
                <svg className="h-3.5 w-3.5 shrink-0 text-app-fg-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                <a href={`mailto:${fornitore.email}`} className="truncate text-xs text-app-cyan-500 hover:text-app-fg-muted hover:underline">{fornitore.email}</a>
              </div>
            )}
            {fornitore.telefono && (
              <div className="flex items-center gap-2">
                <svg className="h-3.5 w-3.5 shrink-0 text-app-fg-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                <a href={`tel:${fornitore.telefono}`} className="text-xs text-app-fg-muted hover:text-app-fg-muted">{fornitore.telefono}</a>
              </div>
            )}
            {fornitore.contatto_nome && (
              <div className="flex items-center gap-2">
                <svg className="h-3.5 w-3.5 shrink-0 text-app-fg-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                <span className="text-xs text-app-fg-muted">{fornitore.contatto_nome}</span>
              </div>
            )}
            {!fornitore.email && !fornitore.telefono && !fornitore.contatto_nome && (
              <p className="text-xs italic text-app-fg-muted">{t.appStrings.noContactRegistered}</p>
            )}
            {!fornitore.email && !readOnly && (
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={hrefWithReturnTo(`/fornitori/${fornitoreId}/edit`, supplierReturnPath)}
                  onClick={() => saveScrollForListPath(supplierReturnPath)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(34,211,238,0.15)] bg-amber-950/35 px-2.5 py-1.5 text-[11px] font-medium text-amber-300 transition-colors hover:bg-amber-500/20"
                >
                  <svg className={`h-3 w-3 shrink-0 ${icon.reviewWarning}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                  {t.appStrings.noEmailSyncWarning}
                </Link>
                <SuggestEmailButton fornitoreId={fornitoreId} />
              </div>
            )}
          </div>

          {/* Address */}
          <div className="space-y-3 px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-app-fg-muted">{t.appStrings.contactsLegal}</p>
            {(fornitore.indirizzo || fornitore.citta || fornitore.paese) ? (
              <div className="flex items-start gap-2">
                <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-app-fg-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <div className="text-xs leading-relaxed text-app-fg-muted">
                  {fornitore.indirizzo && <p>{fornitore.indirizzo}</p>}
                  {(fornitore.citta || fornitore.paese) && <p>{[fornitore.citta, fornitore.paese].filter(Boolean).join(', ')}</p>}
                </div>
              </div>
            ) : (
              <p className="text-xs italic text-app-fg-muted">{t.appStrings.noAddressRegistered}</p>
            )}
          </div>

          {/* Fiscal info */}
          <div className="space-y-3 px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-app-fg-muted">{t.appStrings.contactsFiscal}</p>
            {fornitore.piva && (
              <div className="flex items-center gap-2">
                <svg className="h-3.5 w-3.5 shrink-0 text-app-fg-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                <span className="font-mono text-xs text-app-fg-muted">{fornitore.piva}</span>
              </div>
            )}
            {Number.isFinite(new Date(fornitore.created_at).getTime()) && (
              <div className="flex items-center gap-2">
                <svg className="h-3.5 w-3.5 shrink-0 text-app-fg-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <span className="text-xs text-app-fg-muted">{t.appStrings.clientSince} {formatDateLib(fornitore.created_at, locale, timezone, { month: 'long', year: 'numeric' })}</span>
              </div>
            )}
            {fornitore.note && (
              <div className="mt-1 flex items-start gap-2">
                <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-app-fg-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
                <p className="text-xs italic leading-relaxed text-app-fg-muted">{fornitore.note}</p>
              </div>
            )}
            {!fornitore.piva && !fornitore.note && (
              <p className="text-xs italic text-app-fg-muted">{t.appStrings.noFiscalRegistered}</p>
            )}
          </div>
        </div>
      </div>
      </div>

      {/* Pannello unico sincronizzazione Rekki — full-width */}
      <ErrorBoundary sectionName="risultati sincronizzazione email">
        <StatoSincronizzazioneIntelligente
          fornitoreId={fornitoreId}
          fornitoreNome={fornitoreNomeVisual}
          sedeId={fornitore.sede_id ?? null}
        />
      </ErrorBoundary>
      
      </div>

    </div>
  )
}

function attachmentKindPillClass(kind: AttachmentKind): string {
  const base = 'inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold tabular-nums'
  if (kind === 'pdf') return `${base} border-app-line-35 bg-app-line-10 text-app-fg-muted`
  if (kind === 'image') return `${base} border-[rgba(34,211,238,0.15)] bg-violet-500/10 text-violet-200`
  return `${base} border-app-line-25 app-workspace-inset-bg-soft text-app-fg-muted`
}

/** Etichetta link “apri file”: foto → apri allegato; PDF → vedi documento (bolle/fatture). */
function attachmentOpenFileLinkLabel(
  kind: AttachmentKind | null,
  t: { bolle: { vediDocumento: string }; common: { openAttachment: string } },
): string {
  if (kind === 'image') return t.common.openAttachment
  if (kind === 'pdf') return t.bolle.vediDocumento
  return t.common.openAttachment
}

/** Pill cyan compatto: «Vedi documento» / allegato in tabella bolle fornitore (e dettaglio fatture). */
const FORNITORE_TABLE_CYAN_ACTION_PILL =
  'inline-flex items-center gap-1 rounded-lg border border-app-line-30 bg-app-line-10 px-2 py-1 text-[10px] font-semibold text-app-fg-muted transition-colors hover:bg-app-line-20'

/** Pill elimina icon-only compatto (solo icona, nessun testo). */
const FORNITORE_TABLE_DELETE_PILL =
  'inline-flex h-6 w-6 items-center justify-center rounded-md border border-[rgba(34,211,238,0.15)] bg-red-950/30 text-red-300 opacity-0 transition-all group-hover:opacity-100 hover:border-[rgba(34,211,238,0.15)] hover:bg-red-600/20 hover:text-red-100 focus-visible:opacity-100'

function attachmentKindText(
  kind: AttachmentKind,
  t: { bolle: { attachmentKindPdf: string; attachmentKindImage: string; attachmentKindOther: string } },
): string {
  if (kind === 'pdf') return t.bolle.attachmentKindPdf
  if (kind === 'image') return t.bolle.attachmentKindImage
  return t.bolle.attachmentKindOther
}

/** Numero documento salvato in coda email (`metadata.numero_fattura`) quando la bolla non ha `numero_bolla`. */
function numeroRefFromDocMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') return null
  const n = (metadata as Record<string, unknown>).numero_fattura
  return typeof n === 'string' && n.trim() ? n.trim() : null
}

/* ─── Bolle tab ──────────────────────────────────────────────────── */
function BolleTab({
  fornitoreId,
  dateFrom,
  dateToExclusive,
  pathname,
  searchParams,
  readOnly,
  onLedgerMutated,
  currency,
}: {
  fornitoreId: string
  dateFrom: string
  dateToExclusive: string
  pathname: string
  searchParams: ReadonlyURLSearchParams
  readOnly?: boolean
  onLedgerMutated?: () => void
  currency: string
}) {
  const router = useRouter()
  const t = useT()
  const { locale } = useLocale()
  const { me } = useMe()
  const formatDate = useAppFormatDate()
  const [bolle, setBolle] = useState<Bolla[]>([])
  const [numeroDaCodaByFileUrl, setNumeroDaCodaByFileUrl] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [ocrEpoch, setOcrEpoch] = useState(0)
  const [ocrBusyId, setOcrBusyId] = useState<string | null>(null)
  const [convertBusyId, setConvertBusyId] = useState<string | null>(null)
  const [ocrError, setOcrError] = useState<string | null>(null)
  const [ocrInfo, setOcrInfo] = useState<string | null>(null)
  /** 1…3: passi mostrati durante Rianalizza (OCR) — allineati al lavoro lato server */
  const [ocrProgressStep, setOcrProgressStep] = useState(0)
  const ocrStepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const canRianalizzaOcr = Boolean(me?.is_admin || me?.is_admin_sede)
  const supplierReturnPath = useMemo(
    () => buildListLocationPath(pathname, searchParams),
    [pathname, searchParams],
  )

  const runBollaOcr = useCallback(
    async (bollaId: string) => {
      if (!bollaId) return
      if (ocrStepTimerRef.current) {
        clearInterval(ocrStepTimerRef.current)
        ocrStepTimerRef.current = null
      }
      setOcrError(null)
      setOcrInfo(null)
      setOcrProgressStep(1)
      setOcrBusyId(bollaId)
      ocrStepTimerRef.current = setInterval(() => {
        setOcrProgressStep((s) => (s < 3 ? s + 1 : 3))
      }, 2000)
      try {
        const body: {
          bolla_id: string
          limit: number
          sede_id?: string
          allow_tipo_migrate: boolean
        } = { bolla_id: bollaId, limit: 1, allow_tipo_migrate: true }
        if (me?.is_admin_sede && me.sede_id) body.sede_id = me.sede_id
        const res = await fetch('/api/admin/fix-ocr-dates', {
          method: 'POST',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = (await res.json().catch(() => ({}))) as {
          error?: string
          details?: { action: string }[]
          errors?: { message: string }[]
        }
        if (!res.ok) {
          setOcrError(data.error ?? `HTTP ${res.status}`)
          return
        }
        const reportErr = data.errors?.[0]?.message
        if (reportErr) {
          setOcrError(reportErr)
          setOcrEpoch((e) => e + 1)
          onLedgerMutated?.()
          return
        }
        const details = data.details ?? []
        const migrated = details.some((d) => d.action === 'migrated_to_fattura')
        const first = details[0]
        if (migrated) {
          setOcrInfo(t.bolle.ocrRerunMovedToInvoices)
        } else if (first?.action === 'unchanged') {
          setOcrInfo(t.bolle.ocrRerunUnchangedStaysBolla)
        } else if (first && (first.action === 'bolla_enriched' || first.action === 'date_only')) {
          setOcrInfo(t.bolle.ocrRerunUpdatedStaysBolla)
        } else if (first?.action === 'error') {
          setOcrError(t.bolle.ocrRerunFailed)
        } else {
          setOcrInfo(t.bolle.ocrRerunUpdatedStaysBolla)
        }
        window.setTimeout(() => setOcrInfo(null), 12_000)
        setOcrEpoch((e) => e + 1)
        onLedgerMutated?.()
      } catch (e) {
        setOcrError(e instanceof Error ? e.message : 'Errore di rete')
      } finally {
        if (ocrStepTimerRef.current) {
          clearInterval(ocrStepTimerRef.current)
          ocrStepTimerRef.current = null
        }
        setOcrProgressStep(0)
        setOcrBusyId(null)
      }
    },
    [me?.is_admin_sede, me?.sede_id, onLedgerMutated, t.bolle],
  )

  const runConvertBollaToFattura = useCallback(
    async (bollaId: string) => {
      if (!bollaId) return
      if (!window.confirm(t.bolle.convertiInFatturaConfirm)) return
      setOcrError(null)
      setOcrInfo(null)
      setConvertBusyId(bollaId)
      try {
        const res = await fetch('/api/bolle/convert-to-fattura', {
          method: 'POST',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bolla_id: bollaId }),
        })
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        if (!res.ok) {
          if (res.status === 409) {
            setOcrError(t.bolle.convertiInFatturaErrLinked)
          } else {
            setOcrError(data.error?.trim() || t.bolle.convertiInFatturaErrGeneric)
          }
          return
        }
        setOcrInfo(t.bolle.convertiInFatturaOk)
        window.setTimeout(() => setOcrInfo(null), 12_000)
        setOcrEpoch((e) => e + 1)
        onLedgerMutated?.()
      } catch (e) {
        setOcrError(e instanceof Error ? e.message : t.bolle.convertiInFatturaErrGeneric)
      } finally {
        setConvertBusyId(null)
      }
    },
    [onLedgerMutated, t.bolle],
  )

  useEffect(() => {
    return () => {
      if (ocrStepTimerRef.current) {
        clearInterval(ocrStepTimerRef.current)
        ocrStepTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const from = dateFrom
    const to = dateToExclusive
    const supabase = createClient()
    void (async () => {
      const { data } = await supabase
        .from('bolle')
        .select('id, sede_id, data, stato, file_url, numero_bolla, importo')
        .eq('fornitore_id', fornitoreId)
        .gte('data', from)
        .lt('data', to)
        .order('data', { ascending: false })
      if (cancelled) return
      const rows = (data ?? []) as Bolla[]
      const urls = [
        ...new Set(
          rows
            .filter((b) => !b.numero_bolla?.trim() && b.file_url?.trim())
            .map((b) => b.file_url!.trim()),
        ),
      ]
      const map: Record<string, string> = {}
      if (urls.length > 0) {
        const { data: docs } = await supabase
          .from('documenti_da_processare')
          .select('file_url, metadata, created_at')
          .in('file_url', urls)
        if (!cancelled && docs?.length) {
          const sorted = [...docs].sort((a, b) =>
            String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')),
          )
          for (const row of sorted) {
            const fu = row.file_url?.trim()
            if (!fu || map[fu]) continue
            const n = numeroRefFromDocMetadata(row.metadata)
            if (n) map[fu] = n
          }
        }
      }
      if (!cancelled) {
        setNumeroDaCodaByFileUrl(map)
        setBolle(rows)
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [fornitoreId, dateFrom, dateToExclusive, ocrEpoch])

  const numeroInElenco = useCallback(
    (b: Bolla) =>
      b.numero_bolla?.trim() || (b.file_url?.trim() ? numeroDaCodaByFileUrl[b.file_url.trim()] : '') || '',
    [numeroDaCodaByFileUrl],
  )

  const bollaDupPayload = useMemo(() => {
    const analysis = analyzeBolleDuplicatesForDeletion(
      bolle.map((b) => ({
        id: b.id,
        numero_bolla: numeroInElenco(b) || b.numero_bolla || null,
        fornitore_id: fornitoreId,
        data: (b.data ?? '').trim().slice(0, 10),
      })),
    )
    return serializeFatturaDuplicateDeletionPayload(analysis)
  }, [bolle, fornitoreId, numeroInElenco])

  const onBollaDuplicateRemoved = useCallback(
    (removedId: string) => {
      setBolle((prev) => prev.filter((x) => x.id !== removedId))
      onLedgerMutated?.()
    },
    [onLedgerMutated],
  )

  if (loading) {
    return (
      <div className={`supplier-detail-tab-shell overflow-hidden`}>
        <div className={`app-card-bar-accent ${SUPPLIER_DETAIL_TAB_HIGHLIGHT.bolle.bar}`} aria-hidden />
        <div className={APP_SECTION_DIVIDE_ROWS}>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex animate-pulse gap-4 px-5 py-3.5">
            <div className="h-4 w-24 shrink-0 rounded app-workspace-inset-bg" />
            <div className="h-4 w-16 shrink-0 rounded app-workspace-inset-bg" />
          </div>
        ))}
        </div>
      </div>
    )
  }

  if (bolle.length === 0) {
    return (
      <div className={`supplier-detail-tab-shell overflow-hidden`}>
        <div className={`app-card-bar-accent ${SUPPLIER_DETAIL_TAB_HIGHLIGHT.bolle.bar}`} aria-hidden />
        <AppSectionEmptyState
          message={t.bolle.nessunaBollaRegistrata}
          density="comfortable"
          icon={
            <svg className="mx-auto mb-3 h-12 w-12 text-app-fg-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
          }
        >
          {!readOnly ? (
            <ActionLink
              href={hrefWithReturnTo(`/bolle/new?fornitore_id=${fornitoreId}`, supplierReturnPath)}
              onClick={() => saveScrollForListPath(supplierReturnPath)}
              intent="nav"
              size="sm"
              className="mt-4"
            >
              {t.bolle.creaLaPrimaBolla}
            </ActionLink>
          ) : null}
        </AppSectionEmptyState>
      </div>
    )
  }

  return (
    <div className={`supplier-detail-tab-shell flex flex-col overflow-hidden`}>
      <div className={`app-card-bar-accent ${SUPPLIER_DETAIL_TAB_HIGHLIGHT.bolle.bar}`} aria-hidden />
      {ocrBusyId && ocrProgressStep > 0 ? (
        <div
          className="border-b border-amber-500/30 bg-amber-950/50 px-3 py-2.5 sm:px-4"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <p className="text-center text-[10px] font-bold uppercase tracking-wider text-amber-200/95 sm:text-xs">
            {t.bolle.ocrRerunProgressTitle}
          </p>
          <ol className="mx-auto mt-2 max-w-xl list-none space-y-1 text-[11px] sm:text-xs">
            {(
              [
                [1, t.bolle.ocrRerunStep1],
                [2, t.bolle.ocrRerunStep2],
                [3, t.bolle.ocrRerunStep3],
              ] as const
            ).map(([n, label]) => {
              const done = ocrProgressStep > n
              const active = ocrProgressStep === n
              return (
                <li
                  key={n}
                  className={`rounded-md border border-transparent px-1.5 py-1 transition-colors sm:px-2 ${
                    active
                      ? 'border-amber-500/30 bg-amber-500/15 font-semibold text-amber-50'
                      : done
                        ? 'text-amber-200/70'
                        : 'text-amber-200/35'
                  }`}
                >
                  {label}
                </li>
              )
            })}
          </ol>
        </div>
      ) : null}
      {ocrError ? (
        <p className="border-b border-rose-500/25 bg-rose-500/10 px-4 py-2 text-center text-xs text-rose-200" role="alert">
          {ocrError}
        </p>
      ) : null}
      {ocrInfo ? (
        <p
          className="border-b border-emerald-500/25 bg-emerald-500/10 px-4 py-2 text-center text-xs text-emerald-100"
          role="status"
        >
          {ocrInfo}
        </p>
      ) : null}
      <div className="min-w-0 flex-1">
      <div className={APP_SECTION_MOBILE_LIST}>
        {bolle.map((b) => {
          const fileKind = attachmentKindFromFileUrl(b.file_url)
          return (
          <div
            key={b.id}
            role="button"
            tabIndex={0}
            onClick={() => router.push(fornitoreBollaDeepLink(pathname, searchParams, b.id), { scroll: false })}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') router.push(fornitoreBollaDeepLink(pathname, searchParams, b.id), { scroll: false })
            }}
            className="flex min-h-[56px] cursor-pointer items-center justify-between gap-3 px-4 py-4 transition-colors hover:bg-black/12 active:brightness-95 touch-manipulation"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-app-fg">{formatDate(b.data)}</p>
                {fileKind ? (
                  <span className={attachmentKindPillClass(fileKind)} title={t.bolle.colAttachmentKind}>
                    {attachmentKindText(fileKind, t)}
                  </span>
                ) : null}
              </div>
              {numeroInElenco(b) && <p className="mt-0.5 text-xs text-app-fg-muted">#{numeroInElenco(b)}</p>}
              {b.importo != null && (
                <p className="mt-0.5 font-mono text-xs font-semibold tabular-nums text-app-fg-muted">
                  {formatCurrency(b.importo, currency, locale)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
                {b.stato === 'completato' ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(34,211,238,0.15)] bg-green-500/15 px-2 py-0.5 text-[11px] font-semibold text-green-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400" /> {t.bolle.statoCompletato}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(34,211,238,0.15)] bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> {t.bolle.statoInAttesa}
                </span>
              )}
              {canRianalizzaOcr && b.file_url ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    void runBollaOcr(b.id)
                  }}
                  disabled={ocrBusyId === b.id || convertBusyId === b.id}
                  title={
                    ocrBusyId === b.id
                      ? `${t.bolle.ocrRerunProgressTitle} (${ocrProgressStep}/3)`
                      : t.bolle.riannalizzaOcr
                  }
                  aria-label={
                    ocrBusyId === b.id && ocrProgressStep >= 1 && ocrProgressStep <= 3
                      ? `${t.bolle.ocrRerunProgressTitle} — ${[t.bolle.ocrRerunStep1, t.bolle.ocrRerunStep2, t.bolle.ocrRerunStep3][ocrProgressStep - 1]}`
                      : t.bolle.riannalizzaOcr
                  }
                  className="shrink-0 touch-manipulation rounded-lg border border-amber-500/35 bg-amber-500/8 px-2 py-1 text-[11px] font-semibold text-amber-200/95 transition-colors hover:bg-amber-500/15 disabled:opacity-50"
                >
                  {ocrBusyId === b.id ? `${ocrProgressStep}/3` : t.bolle.riannalizzaOcr}
                </button>
              ) : null}
              {!readOnly && canRianalizzaOcr && b.file_url ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    void runConvertBollaToFattura(b.id)
                  }}
                  disabled={ocrBusyId === b.id || convertBusyId === b.id}
                  title={t.bolle.convertiInFatturaTitle}
                  className="shrink-0 touch-manipulation rounded-lg border border-emerald-500/35 bg-emerald-500/8 px-2 py-1 text-[11px] font-semibold text-emerald-200/95 transition-colors hover:bg-emerald-500/15 disabled:opacity-50"
                >
                  {convertBusyId === b.id ? '…' : t.bolle.convertiInFattura}
                </button>
              ) : null}
              {b.file_url && (
                <OpenDocumentInAppButton
                  bollaId={b.id}
                  fileUrl={b.file_url}
                  stopTriggerPropagation
                  className="-mr-2 border-0 bg-transparent px-2 py-1.5 text-left text-xs text-app-cyan-500 touch-manipulation hover:text-app-fg-muted hover:underline"
                >
                  {attachmentOpenFileLinkLabel(fileKind, t)}
                </OpenDocumentInAppButton>
              )}
            </div>
          </div>
          )
        })}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[500px] text-sm">
          <thead className={APP_SECTION_TABLE_THEAD_STICKY}>
            <tr className={appSectionTableHeadRowAccentClass('indigo')}>
              <th className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">{t.common.date}</th>
              <th className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">{t.bolle.colNumero}</th>
              <th className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">{t.bolle.colAttachmentKind}</th>
              <th className="px-5 py-2.5 text-right font-mono text-[10px] font-bold uppercase tracking-widest tabular-nums text-app-fg-muted">
                {t.statements.colAmount}
              </th>
              <th className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">{t.common.status}</th>
              <th className="px-5 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">
                {t.common.actions}
              </th>
            </tr>
          </thead>
          <tbody className={APP_SECTION_TABLE_TBODY}>
            {bolle.map((b) => {
              const fileKind = attachmentKindFromFileUrl(b.file_url)
              return (
              <tr
                key={b.id}
                className={`cursor-pointer ${APP_SECTION_TABLE_TR}`}
                onClick={() => router.push(fornitoreBollaDeepLink(pathname, searchParams, b.id), { scroll: false })}
              >
                <td className="px-5 py-3 font-medium text-app-fg-muted">{formatDate(b.data)}</td>
                <td className="px-5 py-3 font-mono text-xs text-app-fg-muted">
                  <span className="break-words">{numeroInElenco(b) || '—'}</span>
                  {!readOnly ? (
                    <DuplicateLedgerRowExtras
                      rowId={b.id}
                      payload={bollaDupPayload}
                      kind="bolla"
                      duplicateBadgeLabel={t.common.duplicateBadge}
                      duplicateDeleteConfirm={t.bolle.duplicateCopyDeleteConfirm}
                      removeCopyLabel={t.fatture.duplicateRemoveThisCopy}
                      deleteFailedPrefix={t.appStrings.deleteFailed}
                      refreshRouter={false}
                      onAfterDelete={() => onBollaDuplicateRemoved(b.id)}
                    />
                  ) : null}
                </td>
                <td className="px-5 py-3">
                  {!fileKind ? (
                    <span className="text-app-fg-muted">—</span>
                  ) : (
                    <span className={attachmentKindPillClass(fileKind)} title={t.bolle.colAttachmentKind}>
                      {attachmentKindText(fileKind, t)}
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-right font-mono text-sm font-semibold tabular-nums text-app-fg-muted">
                  {b.importo != null ? formatCurrency(b.importo, currency, locale) : '—'}
                </td>
                <td className="px-5 py-3">
                  {b.stato === 'completato' ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(34,211,238,0.15)] bg-green-500/15 px-2 py-0.5 text-[11px] font-semibold text-green-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-400" /> {t.bolle.statoCompletato}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(34,211,238,0.15)] bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> {t.bolle.statoInAttesa}
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                    {canRianalizzaOcr && b.file_url ? (
                      <button
                        type="button"
                        onClick={() => void runBollaOcr(b.id)}
                        disabled={ocrBusyId === b.id || convertBusyId === b.id}
                        title={
                          ocrBusyId === b.id
                            ? `${t.bolle.ocrRerunProgressTitle} (${ocrProgressStep}/3)`
                            : t.bolle.riannalizzaOcr
                        }
                        className="inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-lg border border-amber-500/35 bg-amber-500/8 px-2.5 text-[11px] font-semibold text-amber-200/95 transition-colors hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label={
                          ocrBusyId === b.id && ocrProgressStep >= 1 && ocrProgressStep <= 3
                            ? `${t.bolle.ocrRerunProgressTitle} — ${[t.bolle.ocrRerunStep1, t.bolle.ocrRerunStep2, t.bolle.ocrRerunStep3][ocrProgressStep - 1]}`
                            : t.bolle.riannalizzaOcr
                        }
                      >
                        {ocrBusyId === b.id ? (
                          <>
                            <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-amber-300 border-t-transparent" />
                            <span className="font-mono text-[10px] font-bold tabular-nums">{ocrProgressStep}/3</span>
                          </>
                        ) : (
                          <svg className={`h-3.5 w-3.5 ${icon.emailSync}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        )}
                        {ocrBusyId === b.id ? null : <span className="hidden xl:inline">{t.bolle.riannalizzaOcr}</span>}
                      </button>
                    ) : null}
                    {!readOnly && canRianalizzaOcr && b.file_url ? (
                      <button
                        type="button"
                        onClick={() => void runConvertBollaToFattura(b.id)}
                        disabled={ocrBusyId === b.id || convertBusyId === b.id}
                        title={t.bolle.convertiInFatturaTitle}
                        className="inline-flex h-7 max-w-[8rem] shrink-0 items-center justify-center gap-1 rounded-lg border border-emerald-500/35 bg-emerald-500/8 px-2.5 text-[11px] font-semibold text-emerald-200/95 transition-colors hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {convertBusyId === b.id ? (
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-300 border-t-transparent" />
                        ) : (
                          <svg className={`h-3.5 w-3.5 shrink-0 ${icon.fatture}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                        )}
                        <span className="hidden min-w-0 truncate xl:inline">{t.bolle.convertiInFattura}</span>
                      </button>
                    ) : null}
                    {b.file_url && (
                      <OpenDocumentInAppButton
                        bollaId={b.id}
                        fileUrl={b.file_url}
                        stopTriggerPropagation
                        className={FORNITORE_TABLE_CYAN_ACTION_PILL}
                        title={attachmentOpenFileLinkLabel(fileKind, t)}
                      >
                        <svg className={`h-3 w-3 ${icon.bolle}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                        {attachmentOpenFileLinkLabel(fileKind, t)}
                      </OpenDocumentInAppButton>
                    )}
                    {!readOnly ? (
                    <DeleteButton
                      id={b.id}
                      table="bolle"
                      confirmMessage={t.bolle.deleteConfirm}
                      className={FORNITORE_TABLE_DELETE_PILL}
                      iconClassName="h-3.5 w-3.5"
                      iconOnly
                    />
                    ) : null}
                  </div>
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  )
}

/* ─── Fatture tab ────────────────────────────────────────────────── */
function FattureTab({
  fornitoreId,
  dateFrom,
  dateToExclusive,
  pathname,
  searchParams,
  readOnly,
  onLedgerMutated,
  currency,
  epoch,
  /** Totale fatture fornitore (senza filtro data) — per messaggio se l’elenco periodo è vuoto ma il badge archivio >0 */
  archivioFattureCount,
  onExpandDateRangeToShowAllFatture,
}: {
  fornitoreId: string
  dateFrom: string
  dateToExclusive: string
  pathname: string
  searchParams: ReadonlyURLSearchParams
  readOnly?: boolean
  onLedgerMutated?: () => void
  currency: string
  epoch?: number
  archivioFattureCount: number
  /** Allarga il periodo in header a 2000–oggi così l’elenco mostra ogni fattura con `data` in range. */
  onExpandDateRangeToShowAllFatture?: () => void
}) {
  const t = useT()
  const { locale } = useLocale()
  const formatDate = useAppFormatDate()
  const [fatture, setFatture] = useState<Fattura[]>([])
  const [loading, setLoading] = useState(true)

  const dupPayload = useMemo(() => {
    const analysis = analyzeFatturaDuplicatesForDeletion(
      fatture.map((f) => ({
        id: f.id,
        numero_fattura: f.numero_fattura,
        fornitore_id: f.fornitore_id,
        importo: f.importo,
        data: f.data,
      })),
    )
    return serializeFatturaDuplicateDeletionPayload(analysis)
  }, [fatture])
  const supplierReturnPath = useMemo(
    () => buildListLocationPath(pathname, searchParams),
    [pathname, searchParams],
  )

  useEffect(() => {
    setLoading(true)
    const from = dateFrom
    const to = dateToExclusive
    const supabase = createClient()
    supabase
      .from('fatture')
      .select('id, data, file_url, bolla_id, numero_fattura, importo, fornitore_id')
      .eq('fornitore_id', fornitoreId)
      .gte('data', from)
      .lt('data', to)
      .order('data', { ascending: false })
      .then(({ data }: { data: Fattura[] | null }) => {
        setFatture(data ?? [])
        setLoading(false)
      })
  }, [fornitoreId, dateFrom, dateToExclusive, epoch])

  const onDuplicateRemoved = useCallback(
    (removedId: string) => {
      setFatture((prev) => prev.filter((x) => x.id !== removedId))
      onLedgerMutated?.()
    },
    [onLedgerMutated],
  )

  const onFatturaDataRefreshed = useCallback(
    (fatturaId: string, newData: string) => {
      setFatture((prev) => {
        const inRange = newData >= dateFrom && newData < dateToExclusive
        if (!inRange) {
          return prev.filter((r) => r.id !== fatturaId)
        }
        return prev.map((r) => (r.id === fatturaId ? { ...r, data: newData } : r))
      })
    },
    [dateFrom, dateToExclusive],
  )

  if (loading) {
    return (
      <div className={`supplier-detail-tab-shell overflow-hidden`}>
        <div className={`app-card-bar-accent ${SUPPLIER_DETAIL_TAB_HIGHLIGHT.fatture.bar}`} aria-hidden />
        <div className={APP_SECTION_DIVIDE_ROWS}>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex animate-pulse gap-4 px-5 py-3.5">
              <div className="h-4 w-24 shrink-0 rounded app-workspace-inset-bg" />
              <div className="h-4 w-16 shrink-0 rounded app-workspace-inset-bg" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (fatture.length === 0) {
    const hasFattureFuoriPeriodo = archivioFattureCount > 0
    const emptyTitle = hasFattureFuoriPeriodo
      ? t.fatture.nessunaFatturaNelPeriodo
      : t.fatture.nessunaFatturaRegistrata
    const emptyHint = hasFattureFuoriPeriodo
      ? t.fatture.fattureInArchivioAllargaFiltroData.replace('{n}', String(archivioFattureCount))
      : undefined
    return (
      <div className={`supplier-detail-tab-shell overflow-hidden`}>
        <div className={`app-card-bar-accent ${SUPPLIER_DETAIL_TAB_HIGHLIGHT.fatture.bar}`} aria-hidden />
        <AppSectionEmptyState message={emptyTitle} subtitle={emptyHint}>
          {hasFattureFuoriPeriodo && onExpandDateRangeToShowAllFatture ? (
            <div className="mt-2 flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={onExpandDateRangeToShowAllFatture}
                className="rounded-full border border-app-cyan-500/50 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition-colors hover:border-app-cyan-400/70 hover:bg-cyan-500/20"
              >
                {t.fatture.fattureExpandDateRangeCta}
              </button>
            </div>
          ) : null}
          {!readOnly ? (
            <ActionLink
              href={hrefWithReturnTo(`/fatture/new?fornitore_id=${encodeURIComponent(fornitoreId)}`, supplierReturnPath)}
              onClick={() => saveScrollForListPath(supplierReturnPath)}
              intent="confirm"
              size="sm"
              className="mt-4"
            >
              {t.fatture.addFirst}
            </ActionLink>
          ) : null}
        </AppSectionEmptyState>
      </div>
    )
  }

  return (
    <>
      {/* Auto-sync fatture in attesa - mostrato solo se ci sono fatture da processare */}
      {!readOnly && fatture.some(f => !f.bolla_id) && (
        <div className="mb-4 px-4">
          <FattureInAttesaAutoSync
            fatturaId={fatture.find(f => !f.bolla_id)?.id ?? ''}
            onComplete={() => {
              onLedgerMutated?.()
              // Reload fatture
              setLoading(true)
              const supabase = createClient()
              supabase
                .from('fatture')
                .select('id, data, file_url, bolla_id, numero_fattura, importo, fornitore_id')
                .eq('fornitore_id', fornitoreId)
                .gte('data', dateFrom)
                .lt('data', dateToExclusive)
                .order('data', { ascending: false })
                .then(({ data }: { data: Fattura[] | null }) => {
                  setFatture(data ?? [])
                  setLoading(false)
                })
            }}
          />
        </div>
      )}
      
      <ErrorBoundary sectionName="lista fatture">
      <div
        className={`supplier-detail-tab-shell flex flex-col overflow-hidden`}
      >
      <div className={`app-card-bar-accent ${SUPPLIER_DETAIL_TAB_HIGHLIGHT.fatture.bar}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className={APP_SECTION_MOBILE_LIST}>
          {fatture.map((f) => {
            const fileKind = attachmentKindFromFileUrl(f.file_url)
            return (
              <div
                key={f.id}
                className="min-h-[56px] px-4 py-4 transition-colors hover:bg-black/12 active:brightness-95 touch-manipulation"
              >
                <div className="flex items-center justify-between gap-2">
                  <Link href={fornitoreFatturaDeepLink(pathname, searchParams, f.id)} scroll={false} className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-app-fg">{formatDate(f.data)}</p>
                      {fileKind ? (
                        <span className={attachmentKindPillClass(fileKind)} title={t.bolle.colAttachmentKind}>
                          {attachmentKindText(fileKind, t)}
                        </span>
                      ) : null}
                    </div>
                    {!readOnly && f.file_url?.trim() ? (
                      <FatturaRefreshDateButton
                        fatturaId={f.id}
                        hasFile
                        onDataUpdated={(d) => onFatturaDataRefreshed(f.id, d)}
                        onLedgerMutated={onLedgerMutated}
                        className="mt-1.5 w-fit"
                      />
                    ) : null}
                    {f.numero_fattura && <p className="mt-0.5 text-xs text-app-fg-muted">#{f.numero_fattura}</p>}
                    {f.importo != null && (
                      <p className="mt-0.5 font-mono text-xs font-semibold tabular-nums text-app-fg-muted">
                        {formatCurrency(f.importo, currency, locale)}
                      </p>
                    )}
                  </Link>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {f.bolla_id ? (
                      <span className="rounded-full border border-app-line-30 bg-app-line-15 px-2 py-0.5 text-[11px] font-medium text-app-fg-muted">
                        {t.fatture.statusAssociata}
                      </span>
                    ) : (
                      <span className="rounded-full border border-app-line-28 app-workspace-inset-bg px-2 py-0.5 text-[11px] font-medium text-app-fg-muted">
                        {t.fatture.statusSenzaBolla}
                      </span>
                    )}
                  </div>
                </div>
                {!readOnly ? (
                  <div className="mt-2 flex flex-wrap items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <DuplicateLedgerRowExtras
                      rowId={f.id}
                      payload={dupPayload}
                      kind="fattura"
                      duplicateBadgeLabel={t.common.duplicateBadge}
                      duplicateDeleteConfirm={t.fatture.duplicateDeleteConfirm.replace(
                        '{numero}',
                        (f.numero_fattura ?? '').trim() || '—',
                      )}
                      removeCopyLabel={t.fatture.duplicateRemoveThisCopy}
                      deleteFailedPrefix={t.appStrings.deleteFailed}
                      refreshRouter={false}
                      onAfterDelete={() => onDuplicateRemoved(f.id)}
                    />
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[520px] text-sm">
            <thead className={APP_SECTION_TABLE_THEAD_STICKY}>
              <tr className={appSectionTableHeadRowAccentClass('emerald')}>
                <th className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">
                  {t.common.date}
                </th>
                <th className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">
                  {t.fatture.colNumFattura}
                </th>
                <th className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">
                  {t.bolle.colAttachmentKind}
                </th>
                <th className="px-5 py-2.5 text-right font-mono text-[10px] font-bold uppercase tracking-widest tabular-nums text-app-fg-muted">
                  {t.statements.colAmount}
                </th>
                <th className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">
                  {t.fatture.headerBolla}
                </th>
                <th className="px-5 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">
                  {t.common.actions}
                </th>
              </tr>
            </thead>
            <tbody className={APP_SECTION_TABLE_TBODY}>
              {fatture.map((f) => {
                const fileKind = attachmentKindFromFileUrl(f.file_url)
                return (
                  <tr key={f.id} className={APP_SECTION_TABLE_TR}>
                    <td className="px-5 py-3 font-medium text-app-fg-muted">
                      <div className="flex min-w-0 flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                        <span className="tabular-nums">{formatDate(f.data)}</span>
                        <FatturaRefreshDateButton
                          fatturaId={f.id}
                          hasFile={Boolean(f.file_url?.trim())}
                          readOnly={readOnly}
                          onDataUpdated={(d) => onFatturaDataRefreshed(f.id, d)}
                          onLedgerMutated={onLedgerMutated}
                        />
                      </div>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-app-fg-muted">
                      <span className="break-words">{f.numero_fattura ?? '—'}</span>
                      {!readOnly ? (
                        <DuplicateLedgerRowExtras
                          rowId={f.id}
                          payload={dupPayload}
                          kind="fattura"
                          duplicateBadgeLabel={t.common.duplicateBadge}
                          duplicateDeleteConfirm={t.fatture.duplicateDeleteConfirm.replace(
                            '{numero}',
                            (f.numero_fattura ?? '').trim() || '—',
                          )}
                          removeCopyLabel={t.fatture.duplicateRemoveThisCopy}
                          deleteFailedPrefix={t.appStrings.deleteFailed}
                          refreshRouter={false}
                          onAfterDelete={() => onDuplicateRemoved(f.id)}
                        />
                      ) : null}
                    </td>
                    <td className="px-5 py-3">
                      {!fileKind ? (
                        <span className="text-app-fg-muted">—</span>
                      ) : (
                        <span className={attachmentKindPillClass(fileKind)} title={t.bolle.colAttachmentKind}>
                          {attachmentKindText(fileKind, t)}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-sm font-semibold tabular-nums text-app-fg-muted">
                      {f.importo != null ? formatCurrency(f.importo, currency, locale) : '—'}
                    </td>
                    <td className="px-5 py-3">
                      {f.bolla_id ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-app-line-30 bg-app-line-15 px-2 py-0.5 text-[11px] font-semibold text-app-fg-muted">
                          {t.fatture.statusAssociata}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-app-line-28 app-workspace-inset-bg px-2 py-0.5 text-[11px] font-semibold text-app-fg-muted">
                          {t.fatture.statusSenzaBolla}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={fornitoreFatturaDeepLink(pathname, searchParams, f.id)}
                        scroll={false}
                        className={FORNITORE_TABLE_CYAN_ACTION_PILL}
                      >
                        <svg className={`h-3 w-3 ${icon.fatture}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        {t.fatture.dettaglio}
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    </ErrorBoundary>
    </>
  )
}

/* ─── Listino / Storico Prezzi tab ───────────────────────────────── */

interface ListinoProdotto {
  id: string
  prodotto: string
  prezzo: number
  data_prezzo: string
  note: string | null
  rekki_product_id: string | null
}

const MIGRATION_SQL = `-- Esegui nel Supabase Dashboard → SQL Editor
CREATE TABLE IF NOT EXISTS public.listino_prezzi (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  fornitore_id uuid NOT NULL REFERENCES public.fornitori(id) ON DELETE CASCADE,
  sede_id      uuid REFERENCES public.sedi(id) ON DELETE SET NULL,
  prodotto     text NOT NULL,
  prezzo       numeric(12,2) NOT NULL,
  data_prezzo  date NOT NULL,
  note         text,
  created_at   timestamptz DEFAULT now()
);
ALTER TABLE public.listino_prezzi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "listino_select" ON public.listino_prezzi
  FOR SELECT USING (auth.role() IN ('authenticated','service_role'));`

function ListinoTab({
  fornitoreId,
  fornitoreNome,
  rekkiLinked,
  currency,
  readOnly,
}: {
  fornitoreId: string
  fornitoreNome: string
  rekkiLinked: boolean
  currency?: string
  readOnly?: boolean
}) {
  const t = useT()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { locale, timezone } = useLocale()
  const formatDate = useAppFormatDate()
  const fmtMoney = (n: number) => formatCurrency(n, currency ?? 'EUR', locale)
  const [rows, setRows]               = useState<ListinoRow[]>([])
  const [listino, setListino]         = useState<ListinoProdotto[]>([])
  const [listTabloExists, setListTabloExists] = useState<boolean | null>(null)
  const [copied, setCopied]           = useState(false)
  const [loading, setLoading]         = useState(true)

  // New product form state
  const [showForm, setShowForm]       = useState(false)
  const [formProdotto, setFormProdotto] = useState('')
  const [formPrezzo, setFormPrezzo]   = useState('')
  const [formData, setFormData]       = useState(new Date().toISOString().split('T')[0])
  const [formNote, setFormNote]       = useState('')
  const [formRekkiProductId, setFormRekkiProductId] = useState('')
  const [saving, setSaving]           = useState(false)
  const [saveError, setSaveError]     = useState<string | null>(null)
  const [deletingId, setDeletingId]   = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Rekki product ID editing state
  const [editingRekkiId, setEditingRekkiId] = useState<string | null>(null)
  const [rekkiProductIdDraft, setRekkiProductIdDraft] = useState('')
  const [savingRekkiId, setSavingRekkiId] = useState(false)

  // Import from fattura state
  type ImportItem = {
    prodotto: string
    codice_prodotto: string | null
    prezzo: number
    unita: string | null
    note: string | null
    selected: boolean
    rekki_product_id?: string | null
    /** Admin: consenti insert se la data documento è precedente all’ultimo `data_prezzo` per questo nome prodotto. */
    forceOutdated?: boolean
    // Price comparison
    prezzoAttuale: number | null    // last known price from listino
    matchedProdotto: string | null  // name as stored in listino (may differ)
    matchedByRekkiId?: boolean      // true if matched by rekki_product_id
    delta: number | null            // percentage change vs prezzoAttuale
    isNew: boolean                  // product not found in listino
  }
  const [showImport, setShowImport]       = useState(false)
  const [importFattureList, setImportFattureList] = useState<
    { id: string; label: string; file_url: string | null; analizzata: boolean }[]
  >([])
  const [selectedFatturaId, setSelectedFatturaId] = useState('')
  /** Filtro KPI: restringe l’elenco prodotti (origine fattura / data allineata a bolla). */
  const [listinoSpendFilter, setListinoSpendFilter] = useState<'all' | 'fatture' | 'bolle'>('all')
  /** Filtro periodo storico / KPI totali */
  const [listinoPeriod, setListinoPeriod] = useState<'all' | 'cm' | 'pm' | '3m' | 'fy'>('all')
  const [importLoading, setImportLoading] = useState(false)
  const [importError, setImportError]     = useState<string | null>(null)
  const [importItems, setImportItems]     = useState<ImportItem[]>([])
  const [importDate, setImportDate]       = useState(new Date().toISOString().split('T')[0])
  const [importSaving, setImportSaving]   = useState(false)
  const [formForceOutdated, setFormForceOutdated] = useState(false)
  const [importEditingRekkiIdx, setImportEditingRekkiIdx] = useState<number | null>(null)
  const [importRekkiDraft, setImportRekkiDraft] = useState('')
  const [importSavingRekkiIdx, setImportSavingRekkiIdx] = useState<number | null>(null)

  // Auto-import state
  const [autoImporting, setAutoImporting]         = useState(false)
  const [autoImportResult, setAutoImportResult]   = useState<{ inserted: number; fatture: number } | null>(null)
  const [autoImportError, setAutoImportError]     = useState<string | null>(null)

  // Price anomalies state
  type PriceAnomaly = {
    id: string
    prodotto: string
    prezzo_pagato: number
    prezzo_listino: number
    differenza_percent: number
    fattura_id: string | null
    resolved: boolean
    resolved_at: string | null
    created_at: string
  }
  const [priceAnomalies, setPriceAnomalies] = useState<PriceAnomaly[]>([])
  const [anomaliesLoading, setAnomaliesLoading] = useState(false)
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  const loadListino = async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('listino_prezzi')
      .select('id, prodotto, prezzo, data_prezzo, note, rekki_product_id')
      .eq('fornitore_id', fornitoreId)
      .order('prodotto')
      .order('data_prezzo')
    if (error?.message?.includes('listino_prezzi')) {
      setListTabloExists(false)
    } else {
      setListTabloExists(true)
      setListino((data ?? []) as ListinoProdotto[])
    }
  }

  const loadPriceAnomalies = async () => {
    setAnomaliesLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('price_anomalies')
      .select('id, prodotto, prezzo_pagato, prezzo_listino, differenza_percent, fattura_id, resolved, resolved_at, created_at')
      .eq('fornitore_id', fornitoreId)
      .order('resolved', { ascending: true })
      .order('differenza_percent', { ascending: false })
      .limit(200)
    setPriceAnomalies((data ?? []) as PriceAnomaly[])
    setAnomaliesLoading(false)
  }

  const resolveAnomaly = async (anomalyId: string) => {
    setResolvingId(anomalyId)
    const supabase = createClient()
    await supabase
      .from('price_anomalies')
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq('id', anomalyId)
    setPriceAnomalies((prev) =>
      prev.map((a) =>
        a.id === anomalyId
          ? { ...a, resolved: true, resolved_at: new Date().toISOString() }
          : a,
      ),
    )
    setResolvingId(null)
  }

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('bolle').select('id, data, numero_bolla, importo')
        .eq('fornitore_id', fornitoreId).not('importo', 'is', null).order('data'),
      supabase.from('fatture').select('id, data, numero_fattura, importo')
        .eq('fornitore_id', fornitoreId).not('importo', 'is', null).order('data'),
      supabase.from('listino_prezzi').select('id, prodotto, prezzo, data_prezzo, note, rekki_product_id')
        .eq('fornitore_id', fornitoreId).order('prodotto').order('data_prezzo'),
    ]).then(([bolleRes, fattureRes, listinoRes]) => {
      type BollaRaw   = { id: string; data: string; numero_bolla: string | null; importo: number | null }
      type FatturaRaw = { id: string; data: string; numero_fattura: string | null; importo: number | null }

      const bolleRows: ListinoRow[] = ((bolleRes.data ?? []) as BollaRaw[]).map(b => ({
        id: b.id, data: b.data, tipo: 'bolla' as const, numero: b.numero_bolla, importo: b.importo,
      }))
      const fattureRows: ListinoRow[] = ((fattureRes.data ?? []) as FatturaRaw[]).map(f => ({
        id: f.id, data: f.data, tipo: 'fattura' as const, numero: f.numero_fattura, importo: f.importo,
      }))
      const combined = [...bolleRows, ...fattureRows].sort(
        (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
      )
      setRows(combined)

      if (listinoRes.error?.message?.includes('listino_prezzi')) {
        setListTabloExists(false)
      } else {
        setListTabloExists(true)
        setListino((listinoRes.data ?? []) as ListinoProdotto[])
      }
      setLoading(false)
    })
  }, [fornitoreId])

  useEffect(() => {
    setListinoSpendFilter('all')
    setListinoPeriod('all')
  }, [fornitoreId])

  useEffect(() => {
    loadPriceAnomalies()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fornitoreId])

  // ── Price comparison helpers ────────────────────────────────────────
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()

  const wordSimilarity = (a: string, b: string): number => {
    const wa = new Set(normalize(a).split(' '))
    const wb = new Set(normalize(b).split(' '))
    const intersection = [...wa].filter(w => wb.has(w)).length
    return intersection / Math.max(wa.size, wb.size)
  }

  const findBestListinoMatch = (
    prodotto: string,
    listinoData: ListinoProdotto[],
    rekkiProductId?: string | null
  ): { prezzoAttuale: number; matchedProdotto: string; matchedByRekkiId?: boolean } | null => {
    if (listinoData.length === 0) return null
    
    // First try exact Rekki product ID match (highest priority)
    if (rekkiProductId) {
      const exactRekkiMatch = listinoData.find(row => 
        row.rekki_product_id && row.rekki_product_id.trim() === rekkiProductId.trim()
      )
      if (exactRekkiMatch) {
        // Get the latest price for this rekki_product_id
        const allMatchesForRekkiId = listinoData.filter(row => 
          row.rekki_product_id && row.rekki_product_id.trim() === rekkiProductId.trim()
        ).sort((a, b) => b.data_prezzo.localeCompare(a.data_prezzo))
        
        const latest = allMatchesForRekkiId[0]
        if (latest) {
          return { 
            prezzoAttuale: latest.prezzo, 
            matchedProdotto: latest.prodotto,
            matchedByRekkiId: true
          }
        }
      }
    }
    
    // Fallback to product name fuzzy matching
    // listinoData is ordered by data_prezzo ASC — last write per product = most recent price
    const latestByProduct: Record<string, { prezzo: number; prodotto: string }> = {}
    for (const row of listinoData) {
      latestByProduct[row.prodotto] = { prezzo: row.prezzo, prodotto: row.prodotto }
    }
    // Collect latest price for each product (last entry since ordered by data_prezzo)
    const products = Object.values(latestByProduct)

    let bestMatch: { prezzoAttuale: number; matchedProdotto: string; matchedByRekkiId?: boolean } | null = null
    let bestScore = 0.3 // minimum threshold

    for (const p of products) {
      const score = wordSimilarity(prodotto, p.prodotto)
      if (score > bestScore) {
        bestScore = score
        bestMatch = { prezzoAttuale: p.prezzo, matchedProdotto: p.prodotto, matchedByRekkiId: false }
      }
    }
    return bestMatch
  }

  const enrichWithComparison = (
    items: Omit<ImportItem, 'prezzoAttuale' | 'matchedProdotto' | 'matchedByRekkiId' | 'delta' | 'isNew' | 'forceOutdated'>[],
    listinoData: ListinoProdotto[]
  ): ImportItem[] => {
    const latestByProduct: Record<string, { prezzo: number; data: string }> = {}
    for (const row of listinoData) {
      const cur = latestByProduct[row.prodotto]
      if (!cur || row.data_prezzo > cur.data) {
        latestByProduct[row.prodotto] = { prezzo: row.prezzo, data: row.data_prezzo }
      }
    }

    return items.map(item => {
      const match = findBestListinoMatch(item.prodotto, listinoData, item.rekki_product_id)
      const prezzoAttuale = match ? latestByProduct[match.matchedProdotto]?.prezzo ?? null : null
      const delta = prezzoAttuale != null && prezzoAttuale > 0
        ? ((item.prezzo - prezzoAttuale) / prezzoAttuale) * 100
        : null
      return {
        ...item,
        forceOutdated: false,
        prezzoAttuale,
        matchedProdotto: match?.matchedProdotto ?? null,
        matchedByRekkiId: match?.matchedByRekkiId ?? false,
        delta,
        isNew: match === null,
      }
    })
  }

  const openImport = async () => {
    setShowImport(true)
    setShowForm(false)
    setImportError(null)
    setImportItems([])
    const supabase = createClient()
    const { data, error } = await supabase
      .from('fatture')
      .select('id, data, numero_fattura, file_url, analizzata')
      .eq('fornitore_id', fornitoreId)
      .not('file_url', 'is', null)
      .order('data', { ascending: false })
    if (error) {
      const missingCol =
        error.code === '42703' ||
        (error.message?.toLowerCase().includes('analizzata') ?? false)
      if (missingCol) {
        const { data: fallback } = await supabase
          .from('fatture')
          .select('id, data, numero_fattura, file_url')
          .eq('fornitore_id', fornitoreId)
          .not('file_url', 'is', null)
          .order('data', { ascending: false })
        const list = (fallback ?? []).map(
          (f: { id: string; data: string; numero_fattura: string | null; file_url: string | null }) => ({
            id: f.id,
            label: f.numero_fattura
              ? `${t.fatture.invoice} ${f.numero_fattura} — ${formatDate(f.data)}`
              : `${t.fatture.invoice} · ${formatDate(f.data)}`,
            file_url: f.file_url,
            analizzata: false,
          }),
        )
        setImportFattureList(list)
        if (list.length > 0) {
          setSelectedFatturaId((prev) => (list.some((x: { id: string }) => x.id === prev) ? prev : list[0]!.id))
        }
        return
      }
      setImportFattureList([])
      return
    }
    const list = (data ?? []).map(
      (f: { id: string; data: string; numero_fattura: string | null; file_url: string | null; analizzata?: boolean | null }) => ({
        id: f.id,
        label: f.numero_fattura
          ? `${t.fatture.invoice} ${f.numero_fattura} — ${formatDate(f.data)}`
          : `${t.fatture.invoice} · ${formatDate(f.data)}`,
        file_url: f.file_url,
        analizzata: Boolean(f.analizzata),
      }),
    )
    setImportFattureList(list)
    if (list.length > 0) {
      setSelectedFatturaId((prev) => (list.some((x: { id: string }) => x.id === prev) ? prev : list[0]!.id))
    }
  }

  const handleImportAnalyze = async () => {
    if (!selectedFatturaId) return
    setImportLoading(true)
    setImportError(null)
    setImportItems([])
    try {
      const res = await fetch('/api/listino/importa-da-fattura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fattura_id: selectedFatturaId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Errore sconosciuto')
      const items = Array.isArray(json.items) ? json.items : []
      const supabase = createClient()
      const { error: upErr } = await supabase
        .from('fatture')
        .update({ analizzata: true })
        .eq('id', selectedFatturaId)
        .eq('fornitore_id', fornitoreId)
      if (upErr) {
        console.warn('[listino] aggiornamento analizzata:', upErr.message)
      }
      setImportFattureList((prev) =>
        prev.map((f) => (f.id === selectedFatturaId ? { ...f, analizzata: true } : f)),
      )
      if (items.length === 0) {
        setImportError('Nessun prodotto trovato in questa fattura. Prova con un\'altra.')
      } else {
        const docDate = String(json.data_fattura ?? '').slice(0, 10) || new Date().toISOString().split('T')[0]
        setImportDate(docDate)
        const enriched = enrichWithComparison(
          items.map(
            (item: {
              prodotto: string
              prezzo: number
              codice_prodotto?: string | null
              unita: string | null
              note: string | null
            }) => ({
              ...item,
              codice_prodotto:
                item.codice_prodotto != null && String(item.codice_prodotto).trim() !== ''
                  ? String(item.codice_prodotto).trim()
                  : null,
              selected: true,
            })
          ),
          listino
        )
        /** Import automatica: nessuna selezione se data documento precede l’ultimo data_prezzo listino per quel prodotto. */
        const withAutoSkip = enriched.map((item) => {
          const latest = maxListinoDateForExactProduct(listino, item.prodotto)
          const blocked =
            latest != null && !isDocumentDateAtLeastLatestListino(docDate, latest)
          return { ...item, selected: blocked ? false : item.selected }
        })
        setImportItems(withAutoSkip)
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err))
    } finally {
      setImportLoading(false)
    }
  }

  const importRowDateBlocked = (prodotto: string) => {
    const latest = maxListinoDateForExactProduct(listino, prodotto)
    return latest != null && !isDocumentDateAtLeastLatestListino(importDate, latest)
  }

  const handleImportSave = async () => {
    /** Non inviare righe con data documento anteriore al max `data_prezzo` (data ultimo listino) senza forzatura admin. */
    const toSave = importItems.filter(
      (i) =>
        i.selected &&
        i.prodotto &&
        i.prezzo > 0 &&
        !(importRowDateBlocked(i.prodotto) && !i.forceOutdated),
    )
    if (!toSave.length) return
    setImportSaving(true)
    setImportError(null)
    const srcFattura = importFattureList.find(f => f.id === selectedFatturaId)
    const originMachine =
      selectedFatturaId && srcFattura
        ? ` — Origine: ${srcFattura.label}${LISTINO_SRC_FATTURA_MARK}${selectedFatturaId}|`
        : ''
    const rows = toSave.map(i => {
      const base =
        [
          i.codice_prodotto?.trim() ? `Codice: ${i.codice_prodotto.trim()}` : null,
          i.unita ? `Unità: ${i.unita}` : null,
          i.note,
        ]
          .filter(Boolean)
          .join(' — ') || null
      const note = originMachine ? (base ? `${base}${originMachine}` : `Origine listino${originMachine}`) : base
      return {
        prodotto: i.prodotto.trim(),
        prezzo: i.prezzo,
        data_prezzo: importDate.slice(0, 10),
        note,
        ...(i.forceOutdated ? { force_outdated: true as const } : {}),
      }
    })
    try {
      const res = await fetch('/api/listino/prezzi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fornitore_id: fornitoreId, rows }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        error?: string
        inserted?: number
        skipped?: { prodotto: string; reason: string }[]
      }
      if (!res.ok) {
        setImportError(json.error ?? `Errore ${res.status}`)
        setImportSaving(false)
        return
      }
      if (json.skipped && json.skipped.length > 0) {
        const names = json.skipped.map((s) => s.prodotto).join(', ')
        setImportError(
          t.appStrings.listinoImportPartialSaved
            .replace('{inserted}', String(json.inserted ?? 0))
            .replace('{skipped}', String(json.skipped.length))
            .replace('{products}', names)
        )
        setImportSaving(false)
        await loadListino()
        return
      }
    } catch (e) {
      setImportError(e instanceof Error ? e.message : String(e))
      setImportSaving(false)
      return
    }
    setImportError(null)
    setShowImport(false)
    setImportItems([])
    setImportSaving(false)
    await loadListino()
  }

  /**
   * Auto-importa: scansiona tutte le fatture non ancora analizzate di questo fornitore,
   * estrae i prodotti tramite OCR/Vision e li salva nel listino senza interazione manuale.
   * Salta righe con data anteriore all'ultimo prezzo in listino.
   */
  const handleAutoImport = async () => {
    setAutoImporting(true)
    setAutoImportResult(null)
    setAutoImportError(null)
    setShowImport(false)
    setShowForm(false)
    try {
      const supabase = createClient()
      // Recupera tutte le fatture con file ma NON ancora analizzate
      const { data: fattureData } = await supabase
        .from('fatture')
        .select('id, data, numero_fattura, file_url, analizzata')
        .eq('fornitore_id', fornitoreId)
        .not('file_url', 'is', null)
        .order('data', { ascending: false })

      const fattureToProcess = (fattureData ?? []).filter(
        (f: { analizzata?: boolean | null }) => !f.analizzata
      ) as { id: string; data: string; numero_fattura: string | null; file_url: string | null }[]

      if (fattureToProcess.length === 0) {
        setAutoImportError('Nessuna fattura nuova da analizzare.')
        setAutoImporting(false)
        return
      }

      // Ricarica il listino corrente per la comparazione
      const { data: listinoFresh } = await supabase
        .from('listino_prezzi')
        .select('id, prodotto, prezzo, data_prezzo, note, rekki_product_id')
        .eq('fornitore_id', fornitoreId)
        .order('prodotto').order('data_prezzo')
      const listinoData = (listinoFresh ?? []) as ListinoProdotto[]

      let totalInserted = 0
      let fattureProcessed = 0

      for (const fattura of fattureToProcess) {
        try {
          const res = await fetch('/api/listino/importa-da-fattura', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fattura_id: fattura.id }),
          })
          const json = await res.json()
          if (!res.ok || !Array.isArray(json.items) || json.items.length === 0) continue

          const docDate = String(json.data_fattura ?? fattura.data ?? '').slice(0, 10) ||
            new Date().toISOString().split('T')[0]

          const enriched = enrichWithComparison(
            json.items.map((item: {
              prodotto: string; prezzo: number
              codice_prodotto?: string | null; unita: string | null; note: string | null
            }) => ({
              ...item,
              codice_prodotto: item.codice_prodotto?.trim() || null,
              selected: true,
            })),
            listinoData,
          )

          const toSave = enriched.filter((item) => {
            if (!item.selected || !item.prodotto || item.prezzo <= 0) return false
            const latest = maxListinoDateForExactProduct(listinoData, item.prodotto)
            return latest == null || isDocumentDateAtLeastLatestListino(docDate, latest)
          })

          if (toSave.length === 0) {
            // Segna comunque come analizzata
            await supabase.from('fatture').update({ analizzata: true }).eq('id', fattura.id)
            fattureProcessed++
            continue
          }

          const fatturaLabel = fattura.numero_fattura
            ? `Fattura ${fattura.numero_fattura} — ${fattura.data}`
            : `Fattura · ${fattura.data}`

          const rows = toSave.map(i => {
            const base = [
              i.codice_prodotto ? `Codice: ${i.codice_prodotto}` : null,
              i.unita ? `Unità: ${i.unita}` : null,
              i.note,
            ].filter(Boolean).join(' — ') || null
            const note = base
              ? `${base} — Origine: ${fatturaLabel}${LISTINO_SRC_FATTURA_MARK}${fattura.id}|`
              : `Origine listino — Origine: ${fatturaLabel}${LISTINO_SRC_FATTURA_MARK}${fattura.id}|`
            return {
              prodotto: i.prodotto.trim(),
              prezzo: i.prezzo,
              data_prezzo: docDate,
              note,
            }
          })

          const saveRes = await fetch('/api/listino/prezzi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ fornitore_id: fornitoreId, rows }),
          })
          const saveJson = (await saveRes.json().catch(() => ({}))) as { inserted?: number }
          if (saveRes.ok) {
            totalInserted += saveJson.inserted ?? rows.length
            await supabase.from('fatture').update({ analizzata: true }).eq('id', fattura.id)
            fattureProcessed++
          }
        } catch { /* continua con la prossima */ }
      }

      setAutoImportResult({ inserted: totalInserted, fatture: fattureProcessed })
      await loadListino()
    } catch (err) {
      setAutoImportError(err instanceof Error ? err.message : 'Errore sconosciuto')
    } finally {
      setAutoImporting(false)
    }
  }

  const handleSave = async () => {
    if (!formProdotto.trim() || !formPrezzo || !formData) return
    setSaving(true)
    setSaveError(null)
    const latestManual = maxListinoDateForExactProduct(listino, formProdotto.trim())
    const manualBlocked =
      latestManual != null && !isDocumentDateAtLeastLatestListino(formData, latestManual)
    if (manualBlocked && !formForceOutdated) {
      setSaveError(t.appStrings.listinoManualDateBlockedHint)
      setSaving(false)
      return
    }
    try {
      const res = await fetch('/api/listino/prezzi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fornitore_id: fornitoreId,
          rows: [
            {
              prodotto: formProdotto.trim(),
              prezzo: parseFloat(formPrezzo),
              data_prezzo: formData,
              note: formNote.trim() || null,
              rekki_product_id: formRekkiProductId.trim() || null,
              ...(formForceOutdated && manualBlocked ? { force_outdated: true as const } : {}),
            },
          ],
        }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setSaveError(json.error ?? `Errore ${res.status}`)
        setSaving(false)
        return
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e))
      setSaving(false)
      return
    }
    // Reset form and reload
    setFormProdotto('')
    setFormPrezzo('')
    setFormData(new Date().toISOString().split('T')[0])
    setFormNote('')
    setFormRekkiProductId('')
    setFormForceOutdated(false)
    setShowForm(false)
    setSaving(false)
    await loadListino()
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    setDeleteError(null)
    try {
      const res = await fetch(
        `/api/listino/prezzi?id=${encodeURIComponent(id)}&fornitore_id=${encodeURIComponent(fornitoreId)}`,
        { method: 'DELETE', credentials: 'include' }
      )
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setDeleteError(json.error ?? `Errore ${res.status}`)
        setDeletingId(null)
        return
      }
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : String(e))
      setDeletingId(null)
      return
    }
    setDeletingId(null)
    await loadListino()
  }

  const handleUpdateRekkiProductId = async (listinoRowId: string, rekkiProductId: string | null) => {
    setSavingRekkiId(true)
    setDeleteError(null)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('listino_prezzi')
        .update({ rekki_product_id: rekkiProductId?.trim() || null })
        .eq('id', listinoRowId)
      
      if (error) {
        setDeleteError(`Errore aggiornamento Codice Rekki: ${error.message}`)
        setSavingRekkiId(false)
        return
      }
      
      await loadListino()
      setEditingRekkiId(null)
      setRekkiProductIdDraft('')
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : String(e))
    } finally {
      setSavingRekkiId(false)
    }
  }

  const handleImportQuickAddRekkiId = async (idx: number, rekkiId: string) => {
    const item = importItems[idx]
    if (!item || !item.matchedProdotto) return
    
    setImportSavingRekkiIdx(idx)
    try {
      const supabase = createClient()
      // Find listino row for this product
      const matchedRow = listino.find(l => l.prodotto === item.matchedProdotto)
      if (!matchedRow) {
        setImportError('Prodotto non trovato nel listino')
        setImportSavingRekkiIdx(null)
        return
      }
      
      const { error } = await supabase
        .from('listino_prezzi')
        .update({ rekki_product_id: rekkiId.trim() || null })
        .eq('id', matchedRow.id)
      
      if (error) {
        setImportError(`Errore aggiornamento Codice Rekki: ${error.message}`)
        setImportSavingRekkiIdx(null)
        return
      }
      
      await loadListino()
      setImportItems(prev => prev.map((it, i) => i === idx ? { ...it, rekki_product_id: rekkiId.trim() } : it))
      setImportEditingRekkiIdx(null)
      setImportRekkiDraft('')
    } catch (e) {
      setImportError(e instanceof Error ? e.message : String(e))
    } finally {
      setImportSavingRekkiIdx(null)
    }
  }

  const handleApplyAllAsCurrentPrice = () => {
    const selectedItems = importItems.filter(i => i.selected && i.prezzoAttuale != null)
    if (selectedItems.length === 0) return
    
    setImportItems(prev => prev.map(item => {
      if (item.selected && item.prezzoAttuale != null) {
        return { ...item, prezzo: item.prezzoAttuale, delta: 0 }
      }
      return item
    }))
  }

  /* Group listino by product and detect price changes */
  const listinoByProduct = listino.reduce<Record<string, ListinoProdotto[]>>((acc, r) => {
    if (!acc[r.prodotto]) acc[r.prodotto] = []
    acc[r.prodotto].push(r)
    return acc
  }, {})

  const fatturaIdsInRows = useMemo(
    () => new Set(rows.filter((r) => r.tipo === 'fattura').map((r) => r.id)),
    [rows],
  )
  const bollaDatesInRows = useMemo(
    () => new Set(rows.filter((r) => r.tipo === 'bolla').map((r) => r.data.slice(0, 10))),
    [rows],
  )
  const filteredListinoByProduct = useMemo(() => {
    if (listinoSpendFilter === 'all') return listinoByProduct
    const out: Record<string, ListinoProdotto[]> = {}
    for (const [name, prezzi] of Object.entries(listinoByProduct)) {
      const sorted = [...prezzi].sort((a, b) => a.data_prezzo.localeCompare(b.data_prezzo))
      const ultimo = sorted[sorted.length - 1]!
      if (listinoSpendFilter === 'fatture') {
        const fid = extractListinoSrcFatturaId(ultimo.note)
        if (fid && fatturaIdsInRows.has(fid)) out[name] = prezzi
      } else {
        const d = ultimo.data_prezzo.slice(0, 10)
        if (bollaDatesInRows.has(d)) out[name] = prezzi
      }
    }
    return out
  }, [listinoByProduct, listinoSpendFilter, fatturaIdsInRows, bollaDatesInRows])

  const nListinoProducts = Object.keys(listinoByProduct).length
  const nFilteredProducts = Object.keys(filteredListinoByProduct).length

  const copy = () => {
    navigator.clipboard.writeText(MIGRATION_SQL).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (loading) {
    return (
      <div className={`supplier-detail-tab-shell overflow-hidden`}>
        <div className={`app-card-bar-accent ${SUPPLIER_DETAIL_TAB_HIGHLIGHT.listino.bar}`} aria-hidden />
        <div className="flex animate-pulse items-center justify-between border-b border-app-line-22 px-5 py-3">
          <div className="h-3 w-32 rounded app-workspace-inset-bg" />
          <div className="h-3 w-14 rounded app-workspace-inset-bg" />
        </div>
        <div className={APP_SECTION_DIVIDE_ROWS}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex animate-pulse gap-4 px-5 py-3.5">
              <div className="h-4 w-24 shrink-0 rounded app-workspace-inset-bg" />
              <div className="h-4 flex-1 rounded app-workspace-inset-bg" />
              <div className="h-4 w-20 shrink-0 rounded app-workspace-inset-bg" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Calcola intervallo date per il filtro periodo
  const { periodFrom, periodTo } = (() => {
    if (listinoPeriod === 'all') return { periodFrom: null, periodTo: null }
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()      // 0-based
    const day = now.getDate()
    if (listinoPeriod === 'cm') {
      // Mese corrente: dal 1° del mese ad oggi
      const from = `${y}-${String(m + 1).padStart(2, '0')}-01`
      return { periodFrom: from, periodTo: null }
    }
    if (listinoPeriod === 'pm') {
      // Mese precedente: 1° → ultimo giorno del mese scorso
      const prevY = m === 0 ? y - 1 : y
      const prevM = m === 0 ? 12 : m
      const from = `${prevY}-${String(prevM).padStart(2, '0')}-01`
      const to = localYmd(new Date(y, m, 0))
      return { periodFrom: from, periodTo: to }
    }
    if (listinoPeriod === '3m') {
      // Ultimi 3 mesi da oggi
      return { periodFrom: localYmd(new Date(y, m - 3, day)), periodTo: null }
    }
    if (listinoPeriod === 'fy') {
      // Anno fiscale corrente (inizia il 6 aprile, stile UK)
      const fyStart = (m > 3 || (m === 3 && day >= 6))
        ? `${y}-04-06`
        : `${y - 1}-04-06`
      return { periodFrom: fyStart, periodTo: null }
    }
    return { periodFrom: null, periodTo: null }
  })()

  const filteredRows = rows.filter(r => {
    if (periodFrom && r.data < periodFrom) return false
    if (periodTo   && r.data > periodTo)   return false
    return true
  })

  const totale    = filteredRows.reduce((s, r) => s + (r.importo ?? 0), 0)
  const totBolle  = filteredRows.filter(r => r.tipo === 'bolla').reduce((s, r) => s + (r.importo ?? 0), 0)
  const totFatture = filteredRows.filter(r => r.tipo === 'fattura').reduce((s, r) => s + (r.importo ?? 0), 0)

  const unresolvedAnomalies = priceAnomalies.filter((a) => !a.resolved)
  const resolvedAnomalies = priceAnomalies.filter((a) => a.resolved)

  return (
    <div className="space-y-5">

      {/* ── Anomalie Prezzi (fattura vs listino) ── */}
      {!anomaliesLoading && priceAnomalies.length > 0 && (
        <div className="supplier-detail-tab-shell overflow-hidden border-[rgba(34,211,238,0.15)]">
          <div className="app-card-bar-accent bg-rose-500/70" aria-hidden />
          <div className="flex items-center justify-between border-b border-app-line-22 px-5 py-3">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-rose-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-semibold text-app-fg">Anomalie Prezzi</span>
              {unresolvedAnomalies.length > 0 && (
                <span className="ml-1 rounded-full bg-rose-500/20 px-2 py-0.5 text-xs font-bold text-rose-300">
                  {unresolvedAnomalies.length}
                </span>
              )}
            </div>
            {resolvedAnomalies.length > 0 && (
              <span className="text-xs text-app-fg-muted">
                {resolvedAnomalies.length} verificat{resolvedAnomalies.length === 1 ? 'a' : 'e'}
              </span>
            )}
          </div>
          <div className="divide-y divide-app-line-22">
            {priceAnomalies.map((anomaly) => (
              <div key={anomaly.id} className={`flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:gap-4 ${anomaly.resolved ? 'opacity-50' : ''}`}>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-app-fg">{anomaly.prodotto}</p>
                  <p className="text-xs text-app-fg-muted mt-0.5">
                    Pagato{' '}
                    <span className="font-semibold text-rose-300">
                      {fmtMoney(anomaly.prezzo_pagato)}
                    </span>
                    {' vs listino '}
                    <span className="font-semibold text-app-fg">{fmtMoney(anomaly.prezzo_listino)}</span>
                    {' · '}
                    <span className="font-semibold text-rose-300">
                      +{(anomaly.differenza_percent * 100).toFixed(1)}%
                    </span>
                  </p>
                </div>
                {anomaly.resolved ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                    <svg className={`h-3 w-3 ${icon.success}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    Verificato
                  </span>
                ) : (
                  !readOnly && (
                    <button
                      disabled={resolvingId === anomaly.id}
                      onClick={() => resolveAnomaly(anomaly.id)}
                      className="shrink-0 rounded-lg border border-[rgba(34,211,238,0.15)] bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
                    >
                      {resolvingId === anomaly.id ? 'Salvando…' : 'Risolvi'}
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Listino Prodotti (se la tabella esiste) ── */}
      {listTabloExists === false ? (
        /* Setup card — compact 2-step flow */
        <div className="supplier-detail-tab-shell overflow-hidden border-[rgba(34,211,238,0.15)]">
          <div className={`app-card-bar-accent ${SUPPLIER_DETAIL_TAB_HIGHLIGHT.listino.bar}`} aria-hidden />
          <div className="px-5 py-4 flex items-start gap-3 bg-amber-500/10">
            <svg className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-100">{t.fornitori.listinoSetupTitle}</p>
              <p className="text-xs text-amber-200/80 mt-0.5 leading-relaxed">
                {t.fornitori.listinoSetupSubtitle}
              </p>
              <ol className="mt-2 space-y-1 text-xs text-amber-100/90 [&_a]:text-amber-200 [&_a]:underline [&_a]:decoration-amber-200/50 [&_a]:transition-colors [&_a:hover]:text-app-fg [&_strong]:font-bold [&_strong]:text-app-fg [&_code]:rounded [&_code]:app-workspace-inset-bg-soft [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-app-fg-muted">
                <li className="flex items-center gap-2">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-500/30 text-[10px] font-bold text-amber-100">1</span>
                  <span dangerouslySetInnerHTML={{ __html: t.fornitori.listinoSetupStep1 }} />
                </li>
                <li className="flex items-center gap-2">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-500/30 text-[10px] font-bold text-amber-100">2</span>
                  <span dangerouslySetInnerHTML={{ __html: t.fornitori.listinoSetupStep2 }} />
                </li>
              </ol>
            </div>
            {!readOnly ? (
            <button
              onClick={copy}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-all ${
                copied
                  ? 'bg-emerald-500/20 text-emerald-200 border-[rgba(34,211,238,0.15)]'
                  : 'bg-amber-500/25 text-amber-100 border-[rgba(34,211,238,0.15)] hover:bg-amber-500/35'
              }`}
            >
              {copied ? (
                <><svg className={`w-3.5 h-3.5 ${icon.success}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>{t.fornitori.listinoCopied}</>
              ) : (
                <><svg className={`w-3.5 h-3.5 ${icon.settingsTools}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>{t.fornitori.listinoCopySQL}</>
              )}
            </button>
            ) : null}
          </div>
          {!readOnly ? (
          <details className="border-t border-[rgba(34,211,238,0.15)]">
            <summary className="px-5 py-2 text-[11px] text-amber-300/90 cursor-pointer hover:bg-amber-500/10 select-none">
              {t.fornitori.listinoSetupShowSQL}
            </summary>
            <pre className="text-[10px] text-amber-100/90 app-workspace-inset-bg-soft px-5 py-3 overflow-x-auto whitespace-pre font-mono border-t border-[rgba(34,211,238,0.15)]">
              {MIGRATION_SQL}
            </pre>
          </details>
          ) : null}
        </div>
      ) : listTabloExists === true ? (
        /* Listino prodotti — with add form */
        <div className={`supplier-detail-tab-shell overflow-hidden`}>
          <div className={`app-card-bar-accent ${SUPPLIER_DETAIL_TAB_HIGHLIGHT.listino.bar}`} aria-hidden />
          <div className="px-5 py-3 border-b border-app-line-22 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-app-fg-muted">{t.fornitori.listinoProdotti}</p>
            <div className="flex items-center gap-2">
              {nListinoProducts > 0 && (
                <span className="rounded-full border border-app-soft-border app-workspace-inset-bg px-2 py-0.5 text-[10px] font-medium text-app-fg-muted">
                  {listinoSpendFilter !== 'all' ? `${nFilteredProducts} / ${nListinoProducts}` : nListinoProducts}{' '}
                  {t.fornitori.listinoProdottiTracked}
                </span>
              )}
              {!readOnly ? (
              <>
              {/* Auto-import + Importa da fattura: nascosti su mobile (non utili in magazzino) */}
              <button
                onClick={handleAutoImport}
                disabled={autoImporting}
                title="Importa automaticamente i prezzi da tutte le fatture non ancora analizzate"
                className="hidden md:flex items-center gap-1 rounded-lg border border-[rgba(34,211,238,0.15)] bg-violet-500/15 px-2.5 py-1 text-[11px] font-bold text-violet-200 transition-colors hover:bg-violet-500/25 disabled:opacity-50"
              >
                {autoImporting ? (
                  <div className="h-3 w-3 animate-spin rounded-full border border-[rgba(34,211,238,0.15)] border-t-transparent" />
                ) : (
                  <svg className={`w-3 h-3 ${icon.analytics}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                )}
                {autoImporting ? 'Analisi...' : 'Auto'}
              </button>
              <button
                onClick={openImport}
                className="hidden md:flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1 text-[11px] font-bold text-white transition-colors hover:bg-violet-500"
              >
                <svg className={`w-3 h-3 ${icon.fatture}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                {t.appStrings.fromInvoiceBtn}
              </button>
              <button
                onClick={() => {
                  setShowForm((f) => !f)
                  setShowImport(false)
                  setSaveError(null)
                  setFormForceOutdated(false)
                }}
                className="flex items-center gap-1 px-2.5 py-1 bg-app-cyan-500 hover:bg-app-cyan-400 text-white text-[11px] font-bold rounded-lg transition-colors"
              >
                <svg className={`w-3 h-3 ${icon.settingsTools}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                {t.common.add}
              </button>
              </>
              ) : null}
            </div>
          </div>

          {deleteError && (
            <div className="border-b border-[rgba(34,211,238,0.15)] bg-red-500/10 px-5 py-2 text-xs text-red-200">{deleteError}</div>
          )}

          {/* Risultato auto-import */}
          {(autoImportResult || autoImportError) && !autoImporting && (
            <div className={`border-b px-5 py-2.5 text-xs ${autoImportError ? 'border-[rgba(34,211,238,0.15)] bg-red-500/10 text-red-200' : 'border-[rgba(34,211,238,0.15)] bg-emerald-500/10 text-emerald-200'}`}>
              <div className="flex items-center justify-between gap-2">
                <span>
                  {autoImportError
                    ? autoImportError
                    : `✓ ${autoImportResult!.inserted} prezzi importati da ${autoImportResult!.fatture} fattur${autoImportResult!.fatture === 1 ? 'a' : 'e'}`
                  }
                </span>
                <button
                  type="button"
                  onClick={() => { setAutoImportResult(null); setAutoImportError(null) }}
                  className="shrink-0 opacity-60 hover:opacity-100"
                >
                  <svg className={`h-3.5 w-3.5 ${icon.settingsTools}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Import from invoice panel — nascosto su mobile */}
          {showImport && !readOnly && (
            <div className="hidden md:block border-b border-[rgba(34,211,238,0.15)] bg-violet-500/10 px-5 py-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold text-violet-200">{t.appStrings.listinoImportPanelTitle}</p>
                <button type="button" onClick={() => setShowImport(false)} className="text-violet-400/80 transition-colors hover:text-violet-200">
                  <svg className={`h-4 w-4 ${icon.settingsTools}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>

              {importFattureList.length === 0 ? (
                <p className="text-xs text-violet-200/80">{t.appStrings.listinoNoInvoicesFile}</p>
              ) : (
                <>
                  <div className="mb-3 flex items-end gap-3">
                    <div className="flex-1 min-w-0">
                      <label className="mb-1 block text-[10px] font-semibold uppercase text-app-fg-muted">{t.appStrings.listinoImportSelectInvoiceLabel}</label>
                      <select
                        value={selectedFatturaId}
                        onChange={e => { setSelectedFatturaId(e.target.value); setImportItems([]); setImportError(null) }}
                        className="w-full rounded-lg border border-app-line-28 app-workspace-inset-bg-soft px-3 py-2 text-sm text-app-fg focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                      >
                        {importFattureList.map(f => (
                          <option key={f.id} value={f.id}>
                            {f.analizzata ? `\u2713 ${f.label}` : f.label}
                          </option>
                        ))}
                      </select>
                      {(() => {
                        const sel = importFattureList.find((f) => f.id === selectedFatturaId)
                        if (!sel) return null
                        return (
                          <div
                            className={`mt-2 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-opacity ${
                              sel.analizzata
                                ? 'border-[rgba(34,211,238,0.15)] bg-emerald-500/10 text-emerald-100'
                                : 'border-app-line-22 app-workspace-inset-bg-soft text-app-fg-muted opacity-[0.88]'
                            }`}
                          >
                            <span className={`min-w-0 flex-1 truncate font-medium ${sel.analizzata ? 'text-emerald-50' : 'text-app-fg'}`}>
                              {sel.label}
                            </span>
                            {sel.analizzata ? (
                              <span className="shrink-0 rounded-full border border-[rgba(34,211,238,0.15)] bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-200">
                                {t.appStrings.listinoInvoiceAnalyzedBadge}
                              </span>
                            ) : null}
                          </div>
                        )
                      })()}
                    </div>
                    <button
                      onClick={handleImportAnalyze}
                      disabled={importLoading || !selectedFatturaId}
                      className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap"
                    >
                      {importLoading ? (
                        <><svg className={`w-3.5 h-3.5 animate-spin ${icon.analytics}`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>{t.appStrings.listinoAnalyzing}</>
                      ) : (
                        <><svg className={`w-3.5 h-3.5 ${icon.analytics}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>{t.appStrings.listinoAnalyze}</>
                      )}
                    </button>
                  </div>

                  {importError && (
                    <div className="mb-3 flex items-center gap-2 rounded-lg border border-[rgba(34,211,238,0.15)] bg-red-500/10 px-3 py-2 text-xs text-red-200">
                      <svg className={`h-3.5 w-3.5 shrink-0 ${icon.duplicateAlert}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                      {importError}
                    </div>
                  )}

                  {importItems.length > 0 && (
                    <div className="mt-2">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-[10px] font-semibold uppercase text-app-fg-muted">
                          {t.appStrings.listinoImportProductsSelected
                            .replace(/\{selected\}/g, String(importItems.filter(i => i.selected).length))
                            .replace(/\{total\}/g, String(importItems.length))}
                        </p>
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] font-semibold uppercase text-app-fg-muted">{t.appStrings.listinoImportPriceListDateLabel}</label>
                          <input
                            type="date"
                            value={importDate}
                            onChange={e => setImportDate(e.target.value)}
                            className="rounded-lg border border-app-line-28 app-workspace-inset-bg-soft px-2 py-1 text-xs text-app-fg focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                          />
                        </div>
                      </div>

                      {/* Anomaly summary banner */}
                      {(() => {
                        const rincari  = importItems.filter(i => i.delta !== null && i.delta >  5)
                        const ribassi  = importItems.filter(i => i.delta !== null && i.delta < -5)
                        const nuovi    = importItems.filter(i => i.isNew)
                        if (rincari.length === 0 && ribassi.length === 0 && nuovi.length === 0) return null
                        return (
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            {rincari.length > 0 && (
                              <span className="flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-1 text-[10px] font-bold text-red-300">
                                <svg className={`h-3 w-3 ${icon.duplicateAlert}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7"/></svg>
                                {rincari.length} rincaro{rincari.length > 1 ? 'i' : ''}
                              </span>
                            )}
                            {ribassi.length > 0 && (
                              <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold text-emerald-300">
                                <svg className={`h-3 w-3 ${icon.success}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7"/></svg>
                                {ribassi.length} ribasso{ribassi.length > 1 ? 'i' : ''}
                              </span>
                            )}
                            {nuovi.length > 0 && (
                              <span className="flex items-center gap-1 rounded-full bg-app-line-15 px-2.5 py-1 text-[10px] font-bold text-app-fg-muted">
                                <svg className={`h-3 w-3 ${icon.settingsTools}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                                {nuovi.length} nuovo{nuovi.length > 1 ? 'i' : ''}
                              </span>
                            )}
                            <span className="text-[10px] text-app-fg-muted">rispetto all&apos;ultimo listino registrato</span>
                          </div>
                        )
                      })()}

                      {/* Azione massiva: Applica tutto come prezzo attuale */}
                      {importItems.some(i => i.selected && i.prezzoAttuale != null && i.delta !== 0) && (
                        <div className="mb-3 flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2">
                          <svg className="h-4 w-4 shrink-0 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <p className="flex-1 text-xs text-cyan-200">
                            <span className="font-semibold">Azione rapida:</span>{' '}
                            Stai importando prezzi diversi dall&apos;ultimo listino
                          </p>
                          <button
                            type="button"
                            onClick={handleApplyAllAsCurrentPrice}
                            className="shrink-0 rounded-md bg-cyan-600 px-3 py-1 text-xs font-bold text-white transition-colors hover:bg-cyan-500"
                          >
                            Applica tutti come prezzo attuale
                          </button>
                        </div>
                      )}

                      <div className="mb-3 overflow-x-auto rounded-lg border border-app-line-22 app-workspace-inset-bg-soft">
                        <table className="w-full min-w-[920px] text-xs">
                          <thead>
                            <tr className={APP_SECTION_TABLE_HEAD_ROW_STRONG}>
                              <th className="w-8 px-3 py-2"></th>
                              <th className="min-w-[10rem] w-[10.5rem] px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-app-fg-muted">Cod.</th>
                              <th className="min-w-[14rem] px-3 py-2 text-left text-[10px] font-semibold uppercase text-app-fg-muted">Prodotto</th>
                              <th className="w-24 px-3 py-2 text-right text-[10px] font-semibold uppercase text-app-fg-muted">Ult. prezzo</th>
                              <th className="w-24 px-3 py-2 text-right text-[10px] font-semibold uppercase text-app-fg-muted">In fattura</th>
                              <th className="w-24 px-3 py-2 text-center text-[10px] font-semibold uppercase text-app-fg-muted">Δ variaz.</th>
                              <th className="min-w-[9.5rem] px-3 py-2 text-left text-[10px] font-semibold uppercase text-app-fg-muted">
                                {t.appStrings.listinoImportColListinoDate}
                              </th>
                            </tr>
                          </thead>
                          <tbody className={APP_SECTION_TABLE_TBODY}>
                            {importItems.map((item, idx) => {
                              const isRincaro = item.delta !== null && item.delta >  5
                              const isRibasso = item.delta !== null && item.delta < -5
                              const isRekkiMismatch = item.matchedByRekkiId && isRincaro
                              const rowBg = isRekkiMismatch 
                                ? 'bg-red-500/20 ring-1 ring-red-500/30' 
                                : isRincaro 
                                  ? 'bg-red-500/10' 
                                  : isRibasso 
                                    ? 'bg-emerald-500/10' 
                                    : item.isNew 
                                      ? 'bg-app-line-10' 
                                      : ''
                              const dateBlocked = importRowDateBlocked(item.prodotto)
                              const latestExact = maxListinoDateForExactProduct(listino, item.prodotto)
                              return (
                                <tr key={idx} className={`${rowBg} ${item.selected ? '' : 'opacity-40'}`}>
                                  <td className="px-3 py-2.5">
                                    <input
                                      type="checkbox"
                                      checked={item.selected}
                                      onChange={e => setImportItems(prev => prev.map((it, i) => i === idx ? { ...it, selected: e.target.checked } : it))}
                                      className="w-3.5 h-3.5 accent-violet-500 cursor-pointer"
                                    />
                                  </td>
                                  <td className="min-w-0 px-3 py-2 align-top">
                                    <input
                                      type="text"
                                      value={item.codice_prodotto ?? ''}
                                      onChange={e =>
                                        setImportItems(prev =>
                                          prev.map((it, i) =>
                                            i === idx
                                              ? {
                                                  ...it,
                                                  codice_prodotto: e.target.value.trim() === '' ? null : e.target.value,
                                                }
                                              : it
                                          )
                                        )
                                      }
                                      placeholder="—"
                                      className="w-full min-w-0 border-0 bg-transparent px-1 py-1.5 font-mono text-[13px] font-medium leading-snug tracking-wide text-app-fg placeholder:text-app-fg-muted focus:app-workspace-inset-bg-soft focus:outline-none focus:ring-0"
                                    />
                                  </td>
                                  <td className="min-w-0 px-3 py-2.5 align-top">
                                    <div className="flex min-w-0 flex-col gap-1">
                                      <div className="flex min-w-0 flex-wrap items-start gap-1.5">
                                        <input
                                          type="text"
                                          value={item.prodotto}
                                          onChange={e => setImportItems(prev => prev.map((it, i) => i === idx ? { ...it, prodotto: e.target.value } : it))}
                                          className="-mx-1 min-h-[1.25rem] min-w-0 flex-1 rounded bg-transparent px-1 font-medium leading-snug text-app-fg focus:bg-black/15 focus:outline-none"
                                        />
                                        {item.matchedByRekkiId && (
                                          <span className="shrink-0 rounded-full bg-violet-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-300">
                                            ✓ Rekki
                                          </span>
                                        )}
                                        {item.isNew && (
                                          <span className="shrink-0 rounded-full bg-app-line-20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-app-fg-muted">
                                            Nuovo
                                          </span>
                                        )}
                                      </div>
                                      {item.matchedProdotto && item.matchedProdotto !== item.prodotto && (
                                        <p className="break-words text-[9px] italic leading-snug text-app-fg-muted">≈ {item.matchedProdotto}</p>
                                      )}
                                      {item.note && (
                                        <p className="break-words text-[10px] italic leading-snug text-app-fg-muted">{item.note}</p>
                                      )}
                                      
                                      {/* Rekki ID mapping - inline */}
                                      {rekkiLinked && !item.isNew && (
                                        <div className="mt-1 flex items-center gap-1.5">
                                          {importEditingRekkiIdx === idx ? (
                                            <>
                                              <input
                                                type="text"
                                                value={importRekkiDraft}
                                                onChange={(e) => setImportRekkiDraft(e.target.value)}
                                                placeholder="Rekki ID"
                                                disabled={importSavingRekkiIdx === idx}
                                                autoFocus
                                                className="flex-1 rounded border border-[rgba(34,211,238,0.15)] bg-violet-950/30 px-1.5 py-0.5 text-[10px] text-app-fg placeholder:text-app-fg-muted/60 focus:border-[rgba(34,211,238,0.15)] focus:outline-none focus:ring-1 focus:ring-violet-500/50 disabled:opacity-50"
                                              />
                                              <button
                                                type="button"
                                                onClick={() => void handleImportQuickAddRekkiId(idx, importRekkiDraft)}
                                                disabled={importSavingRekkiIdx === idx}
                                                title="Salva"
                                                className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-violet-600 text-[10px] font-bold text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
                                              >
                                                {importSavingRekkiIdx === idx ? '...' : '✓'}
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setImportEditingRekkiIdx(null)
                                                  setImportRekkiDraft('')
                                                }}
                                                disabled={importSavingRekkiIdx === idx}
                                                title="Annulla"
                                                className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-app-line-15 text-[10px] text-app-fg-muted transition-colors hover:bg-app-line-20 disabled:opacity-50"
                                              >
                                                ✕
                                              </button>
                                            </>
                                          ) : item.rekki_product_id ? (
                                            <div className="flex items-center gap-1 rounded-md border border-[rgba(34,211,238,0.15)] bg-violet-500/10 px-1.5 py-0.5">
                                              <span className="text-[9px] font-bold uppercase tracking-wide text-violet-300/70">
                                                Rekki:
                                              </span>
                                              <span className="font-mono text-[10px] font-medium text-violet-200">
                                                {item.rekki_product_id}
                                              </span>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setImportEditingRekkiIdx(idx)
                                                  setImportRekkiDraft(item.rekki_product_id ?? '')
                                                }}
                                                className="ml-0.5 text-violet-400 transition-colors hover:text-violet-300"
                                                title="Modifica"
                                              >
                                                <svg className={`h-2.5 w-2.5 ${icon.bolle}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                              </button>
                                            </div>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setImportEditingRekkiIdx(idx)
                                                setImportRekkiDraft('')
                                              }}
                                              className="flex items-center gap-0.5 text-[9px] font-semibold text-violet-400 transition-colors hover:text-violet-300"
                                              title="Aggiungi Rekki ID"
                                            >
                                              <svg className={`h-2.5 w-2.5 ${icon.bolle}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                              </svg>
                                              <span>Rekki ID</span>
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-3 py-2.5 text-right tabular-nums text-app-fg-muted">
                                    {item.prezzoAttuale != null ? fmtMoney(item.prezzoAttuale) : <span className="text-app-fg-muted">—</span>}
                                  </td>
                                  <td className="px-3 py-2.5 text-right tabular-nums">
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={item.prezzo}
                                      onChange={e => setImportItems(prev => prev.map((it, i) => i === idx ? { ...it, prezzo: parseFloat(e.target.value) || 0 } : it))}
                                      className={`w-20 rounded bg-transparent px-1 text-right font-bold focus:bg-black/15 focus:outline-none ${isRincaro ? 'text-red-300' : isRibasso ? 'text-emerald-300' : 'text-app-fg'}`}
                                    />
                                  </td>
                                  <td className="px-3 py-2.5 text-center">
                                    {item.delta !== null ? (
                                      <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                        isRincaro ? 'bg-red-500/20 text-red-200'
                                        : isRibasso ? 'bg-emerald-500/20 text-emerald-200'
                                        : 'app-workspace-inset-bg text-app-fg-muted'
                                      }`}>
                                        {item.delta > 0 ? '▲' : '▼'} {Math.abs(item.delta).toFixed(1)}%
                                      </span>
                                    ) : item.isNew ? (
                                      <span className="text-[10px] font-semibold text-app-fg-muted">—</span>
                                    ) : (
                                      <span className="text-[10px] text-app-fg-muted">—</span>
                                    )}
                                  </td>
                                  <td className="min-w-0 px-3 py-2 align-top">
                                    <div className="flex flex-col gap-1.5">
                                      <span className="whitespace-nowrap text-[10px] tabular-nums text-app-fg-muted">
                                        {latestExact ? formatDate(latestExact) : '—'}
                                      </span>
                                      {dateBlocked ? (
                                        <div className="flex items-start gap-1.5">
                                          <div
                                            className="group/tooltip relative"
                                            title={t.appStrings.listinoImportDateOlderThanListinoHint}
                                          >
                                            <svg className="h-3.5 w-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <div className="pointer-events-none absolute bottom-full left-0 z-50 mb-1 hidden w-48 rounded-md border border-[rgba(34,211,238,0.15)] bg-amber-950/95 px-2 py-1.5 text-[9px] leading-snug text-amber-100 shadow-lg group-hover/tooltip:block">
                                              {t.appStrings.listinoImportDateOlderThanListinoHint}
                                            </div>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setImportItems((prev) =>
                                                prev.map((it, i) =>
                                                  i === idx
                                                    ? { ...it, forceOutdated: !it.forceOutdated }
                                                    : it
                                                )
                                              )
                                            }
                                            className={`flex-1 rounded-md border px-2 py-1 text-[9px] font-bold uppercase tracking-wide transition-colors ${
                                              item.forceOutdated
                                                ? 'border-[rgba(34,211,238,0.15)] bg-emerald-950/40 text-emerald-100'
                                                : 'border-[rgba(34,211,238,0.15)] bg-amber-950/35 text-amber-100 hover:border-[rgba(34,211,238,0.15)]'
                                            }`}
                                          >
                                            {item.forceOutdated
                                              ? t.appStrings.listinoImportApplyOutdatedAdminActive
                                              : t.appStrings.listinoImportApplyOutdatedAdmin}
                                          </button>
                                        </div>
                                      ) : null}
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleImportSave}
                          disabled={
                            importSaving ||
                            importItems.filter(i => i.selected).length === 0 ||
                            importItems.some(
                              (i) => i.selected && importRowDateBlocked(i.prodotto) && !i.forceOutdated
                            )
                          }
                          className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-colors"
                        >
                          {importSaving
                            ? 'Salvataggio…'
                            : `Salva ${importItems.filter(i => i.selected).length} prodotti`}
                        </button>
                        <button type="button" onClick={() => { setShowImport(false); setImportItems([]) }} className="rounded-lg px-4 py-2 text-xs font-medium text-app-fg-muted transition-colors hover:text-app-fg">
                          Annulla
                        </button>
                      </div>
                      {importItems.some(
                        (i) => i.selected && importRowDateBlocked(i.prodotto) && !i.forceOutdated
                      ) ? (
                        <p className="mt-2 text-[11px] text-app-fg-muted">
                          {t.appStrings.listinoImportSaveBlockedHintOperator}
                        </p>
                      ) : null}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Add product inline form */}
          {showForm && !readOnly && (
            <div className="border-b border-app-line-25 bg-app-line-10 px-5 py-4">
              <p className="mb-3 text-xs font-semibold text-app-fg-muted">Nuovo prodotto / aggiornamento prezzo</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <div className="md:col-span-2">
                  <label className="mb-1 block text-[10px] font-semibold uppercase text-app-fg-muted">Prodotto *</label>
                  <input
                    type="text"
                    value={formProdotto}
                    onChange={e => setFormProdotto(e.target.value)}
                    placeholder="es. Pomodori San Marzano"
                    className="w-full rounded-lg border border-app-line-28 app-workspace-inset-bg-soft px-3 py-2 text-sm text-app-fg focus:outline-none focus:ring-2 focus:ring-app-line-40"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase text-app-fg-muted">Prezzo *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formPrezzo}
                    onChange={e => setFormPrezzo(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-app-line-28 app-workspace-inset-bg-soft px-3 py-2 text-sm text-app-fg focus:outline-none focus:ring-2 focus:ring-app-line-40"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase text-app-fg-muted">Data prezzo *</label>
                  <input
                    type="date"
                    value={formData}
                    onChange={e => setFormData(e.target.value)}
                    className="w-full rounded-lg border border-app-line-28 app-workspace-inset-bg-soft px-3 py-2 text-sm text-app-fg focus:outline-none focus:ring-2 focus:ring-app-line-40"
                  />
                </div>
                <div className="md:col-span-4">
                  <label className="mb-1 block text-[10px] font-semibold uppercase text-app-fg-muted">Note (opzionale)</label>
                  <input
                    type="text"
                    value={formNote}
                    onChange={e => setFormNote(e.target.value)}
                    placeholder="es. prezzo stagionale, promo, ecc."
                    className="w-full rounded-lg border border-app-line-28 app-workspace-inset-bg-soft px-3 py-2 text-sm text-app-fg focus:outline-none focus:ring-2 focus:ring-app-line-40"
                  />
                </div>
                <div className="md:col-span-4">
                  <label className="mb-1 block text-[10px] font-semibold uppercase text-app-fg-muted">Codice Rekki (opzionale)</label>
                  <input
                    type="text"
                    value={formRekkiProductId}
                    onChange={e => setFormRekkiProductId(e.target.value)}
                    placeholder="es. WINE-12345"
                    className="w-full rounded-lg border border-app-line-28 app-workspace-inset-bg-soft px-3 py-2 text-sm text-app-fg focus:outline-none focus:ring-2 focus:ring-app-line-40"
                  />
                </div>
              </div>
              {(() => {
                const latestF = maxListinoDateForExactProduct(listino, formProdotto.trim())
                const manualDateBlocked =
                  Boolean(formProdotto.trim()) &&
                  Boolean(formData) &&
                  latestF != null &&
                  !isDocumentDateAtLeastLatestListino(formData, latestF)
                if (!manualDateBlocked) return null
                return (
                  <div className="mt-3 rounded-lg border border-[rgba(34,211,238,0.15)] bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-100/95">
                    <p>{t.appStrings.listinoManualDateBlockedHint}</p>
                    <label className="mt-2 flex cursor-pointer items-center gap-2 font-medium">
                      <input
                        type="checkbox"
                        checked={formForceOutdated}
                        onChange={(e) => setFormForceOutdated(e.target.checked)}
                        className="h-3.5 w-3.5 accent-amber-400"
                      />
                      {t.appStrings.listinoImportApplyOutdatedAdmin}
                    </label>
                  </div>
                )
              })()}
              {saveError && (
                <p className="mt-2 text-xs text-red-300">{saveError}</p>
              )}
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !formProdotto.trim() || !formPrezzo || !formData}
                  className="rounded-lg bg-app-cyan-500 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-app-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving ? t.common.saving : t.common.save}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setFormForceOutdated(false)
                  }}
                  className="rounded-lg px-4 py-2 text-xs font-medium text-app-fg-muted transition-colors hover:text-app-fg"
                >
                  {t.common.cancel}
                </button>
              </div>
            </div>
          )}

          {/* Empty state */}
          {Object.keys(listinoByProduct).length === 0 && !showForm && (
            <div className="px-5 py-10 text-center">
              <svg className="mx-auto mb-2 h-10 w-10 text-app-fg-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-sm font-medium text-app-fg-muted">{t.fornitori.listinoNoData}</p>
              {!readOnly ? <p className="mt-1 text-xs text-app-fg-muted">{t.appStrings.clickAddFirst}</p> : null}
            </div>
          )}

          {nListinoProducts > 0 && nFilteredProducts === 0 && (
            <div className="border-b border-app-line-22 px-5 py-8 text-center">
              <p className="text-sm text-app-fg-muted">{t.fornitori.listinoFilterEmptyKpi}</p>
              <button
                type="button"
                onClick={() => setListinoSpendFilter('all')}
                className="mt-3 rounded-lg border border-app-line-28 bg-app-line-10 px-3 py-1.5 text-xs font-semibold text-app-fg transition-colors hover:border-[rgba(34,211,238,0.15)] hover:text-violet-200"
              >
                {t.fornitori.listinoClearKpiFilter}
              </button>
            </div>
          )}

          {/* Product rows */}
          {nListinoProducts > 0 && nFilteredProducts > 0 && (
            <div className={APP_SECTION_DIVIDE_ROWS}>
              {Object.entries(filteredListinoByProduct).map(([prodotto, prezzi]) => {
                const sorted = [...prezzi].sort((a, b) => a.data_prezzo.localeCompare(b.data_prezzo))
                const ultimo = sorted[sorted.length - 1]!
                const { ref } = referencePriceForListinoRow(sorted, ultimo)
                const priceDelta = ref ? ultimo.prezzo - ref.prezzo : 0
                const pct = ref && Math.abs(ref.prezzo) > 1e-9 ? (priceDelta / ref.prezzo) * 100 : 0
                const up = Boolean(ref && priceDelta > 0.0001)
                const down = Boolean(ref && priceDelta < -0.0001)
                const pctLabel = `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`
                const summaryLine =
                  ref == null
                    ? null
                    : up
                      ? t.fornitori.listinoLastIncrease
                          .replace('{delta}', fmtMoney(priceDelta))
                          .replace('{pct}', pctLabel)
                      : down
                        ? t.fornitori.listinoLastDecrease
                            .replace('{delta}', fmtMoney(Math.abs(priceDelta)))
                            .replace('{pct}', pctLabel)
                        : t.fornitori.listinoLastFlat.replace('{pct}', pctLabel)
                const parsed = parseListinoNoteParts(ultimo.note)
                const fid = extractListinoSrcFatturaId(ultimo.note)
                const originRow = fid ? rows.find((r) => r.tipo === 'fattura' && r.id === fid) : null
                const originLine = originRow
                  ? t.fornitori.listinoOriginInvoice
                      .replace('{inv}', originRow.numero ?? '—')
                      .replace('{data}', formatDate(originRow.data))
                      .replace('{supplier}', fornitoreNome)
                  : parsed.humanTail?.toLowerCase().includes('origine')
                    ? parsed.humanTail
                    : null
                const verificaQ = new URLSearchParams(searchParams.toString())
                fornitoreSupplierClearDocParams(verificaQ)
                verificaQ.set('tab', 'verifica')
                verificaQ.set('stato', 'rekki_prezzo_discordanza')
                verificaQ.set('verifica_prodotto', prodotto)
                const verificaHref = `${pathname}?${verificaQ.toString()}`
                const noteDisplay = stripListinoSrcMachineSuffix(ultimo.note)
                const hasAnomaly = Boolean(ref && up && pct > 0)
                const rowAccentBorder = hasAnomaly
                  ? 'border-l-[#FF3131]'
                  : ref
                    ? 'border-l-[#39FF14]'
                    : 'border-l-app-line-28/80'
                const todayIso = new Date().toISOString().slice(0, 10)
                const listinoPriceStale =
                  calendarDaysBetweenIso(ultimo.data_prezzo.slice(0, 10), todayIso) > 60

                return (
                  <div
                    key={prodotto}
                    className={`group border-l-4 ${APP_SECTION_TABLE_ROW_HOVER} ${rowAccentBorder}`}
                  >
                    <div className="grid grid-cols-1 gap-4 px-4 py-2.5 sm:px-5 md:grid-cols-[minmax(0,1.5fr)_minmax(0,2fr)_minmax(8rem,auto)] md:items-start md:gap-5 md:py-2.5 md:pl-4 md:pr-5">
                      {/* ── COLONNA 1: Nome Prodotto + Codice/Unità ── */}
                      <div className="min-w-0 md:pr-2">
                        <h3 className="font-bold leading-tight tracking-tight text-white md:text-xl" style={{ fontSize: 'clamp(0.875rem, 2.5vw, 1.125rem)' }}>
                          {prodotto}
                        </h3>
                        {parsed.codice || parsed.unita ? (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {parsed.codice ? (
                              <StatusBadge
                                tone="orange"
                                className="!px-2 !py-0.5 !text-[10px] !font-semibold !normal-case !tracking-normal !shadow-none font-mono"
                              >
                                {parsed.codice}
                              </StatusBadge>
                            ) : null}
                            {parsed.unita ? (
                              <StatusBadge
                                tone="orange"
                                className="!px-2 !py-0.5 !text-[10px] !font-semibold !normal-case !tracking-normal !shadow-none"
                              >
                                {parsed.unita}
                              </StatusBadge>
                            ) : null}
                          </div>
                        ) : null}
                        {noteDisplay ? (
                          <p className="mt-2 text-xs leading-relaxed font-medium text-app-fg-muted">{noteDisplay}</p>
                        ) : null}
                      </div>

                      {/* ── COLONNA 2: Prezzo + Status + Metadati + Rekki ── */}
                      <div className="min-w-0 flex flex-col gap-2.5 border-t border-app-line-22/90 pt-3 md:border-t-0 md:pt-0">
                        {/* Prezzo + Delta badge + Badges (riga compatta) */}
                        <div className="flex flex-wrap items-baseline gap-2">
                          <p
                            className={`text-3xl font-bold tabular-nums tracking-tight md:text-[1.65rem] font-mono ${
                              hasAnomaly
                                ? APP_SECTION_AMOUNT_NEGATIVE_CLASS
                                : listinoPriceStale
                                  ? 'text-app-fg-muted/75'
                                  : 'text-white'
                            }`}
                          >
                            {fmtMoney(ultimo.prezzo)}
                          </p>

                          {/* Badge delta prezzo vivido (solo se esiste riferimento) */}
                          {ref && Math.abs(priceDelta) > 0.001 && (
                            <span
                              className={`inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 text-xs font-bold tabular-nums ${
                                up
                                  ? 'bg-red-500/20 text-red-300 ring-1 ring-red-500/40'
                                  : 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40'
                              }`}
                            >
                              {up ? '▲' : '▼'}
                              {fmtMoney(Math.abs(priceDelta))}
                              <span className="opacity-70">({pctLabel})</span>
                            </span>
                          )}
                          
                          {/* Badges inline */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            {hasAnomaly ? (
                              <StatusBadge
                                tone="red"
                                className="!shadow-[0_0_22px_rgba(255,49,49,0.55)] !ring-1 !ring-[#FF3131]/45"
                              >
                                {t.fornitori.listinoRowBadgeAnomaly}
                              </StatusBadge>
                            ) : ref ? (
                              <StatusBadge tone="green">{t.fornitori.listinoRowBadgeOk}</StatusBadge>
                            ) : null}
                            {rekkiLinked && ultimo.rekki_product_id ? (
                              <StatusBadge tone="violet" className="!normal-case !tracking-wide">
                                ✓ Rekki
                              </StatusBadge>
                            ) : null}
                          </div>
                        </div>

                        {/* Riga Stato Anomalie */}
                        {summaryLine ? (
                          <div className={`rounded-md px-2.5 py-1.5 ${hasAnomaly ? 'bg-red-500/10 border border-[rgba(34,211,238,0.15)]' : 'bg-emerald-500/10 border border-[rgba(34,211,238,0.15)]'}`}>
                            <p className={`text-xs font-semibold leading-tight ${hasAnomaly ? 'text-red-200' : 'text-emerald-200'}`}>
                              {hasAnomaly ? '⚠️ Attenzione: ' : '✓ '}{summaryLine}
                            </p>
                          </div>
                        ) : null}

                        {listinoPriceStale ? (
                          <div className="rounded-md border border-[rgba(34,211,238,0.15)] bg-amber-500/10 px-2.5 py-1.5">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-200">
                              {t.fornitori.listinoPriceStaleBadge}
                            </p>
                            <p className="mt-0.5 text-[9px] leading-snug text-amber-300/80">
                              {t.fornitori.listinoPriceStaleHint}
                            </p>
                          </div>
                        ) : null}

                        {/* Metadati (piccoli e muted) */}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-app-fg-muted">
                          <span className="font-medium">
                            {formatDateLib(ultimo.data_prezzo, locale, timezone, {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                          {sorted.length > 1 ? (
                            <span>
                              · {t.fornitori.listinoHistoryDepth.replace('{n}', String(sorted.length - 1))}
                            </span>
                          ) : null}
                          {parsed.codice ? (
                            <span>
                              · Cod: <span className="font-mono">{parsed.codice}</span>
                            </span>
                          ) : null}
                          {parsed.unita ? (
                            <span>
                              · {parsed.unita}
                            </span>
                          ) : null}
                        </div>

                        {originLine ? (
                          <p className="text-xs leading-snug font-medium text-violet-300">{originLine}</p>
                        ) : null}

                        {/* Codice Rekki inline */}
                        {rekkiLinked && !readOnly ? (
                          <div className="flex items-center gap-2 rounded-md bg-violet-950/20 px-2.5 py-1.5 border border-[rgba(34,211,238,0.15)]">
                            <span className="text-[10px] font-bold uppercase tracking-wide text-violet-300/80">
                              Rekki ID:
                            </span>
                            {editingRekkiId === ultimo.id ? (
                              <>
                                <input
                                  type="text"
                                  value={rekkiProductIdDraft}
                                  onChange={(e) => setRekkiProductIdDraft(e.target.value)}
                                  placeholder="es. WINE-123"
                                  disabled={savingRekkiId}
                                  autoFocus
                                  className="flex-1 rounded border border-[rgba(34,211,238,0.15)] bg-violet-950/30 px-2 py-0.5 text-xs text-app-fg placeholder:text-app-fg-muted/60 focus:border-[rgba(34,211,238,0.15)] focus:outline-none focus:ring-1 focus:ring-violet-500/50 disabled:opacity-50"
                                />
                                <button
                                  type="button"
                                  onClick={() => void handleUpdateRekkiProductId(ultimo.id, rekkiProductIdDraft)}
                                  disabled={savingRekkiId}
                                  title="Salva"
                                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-violet-600 text-xs font-bold text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
                                >
                                  {savingRekkiId ? '...' : '✓'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingRekkiId(null)
                                    setRekkiProductIdDraft('')
                                  }}
                                  disabled={savingRekkiId}
                                  title="Annulla"
                                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-app-line-15 text-xs text-app-fg-muted transition-colors hover:bg-app-line-20 disabled:opacity-50"
                                >
                                  ✕
                                </button>
                              </>
                            ) : ultimo.rekki_product_id ? (
                              <>
                                <span className="flex-1 font-mono text-xs font-medium text-violet-200">
                                  {ultimo.rekki_product_id}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingRekkiId(ultimo.id)
                                    setRekkiProductIdDraft(ultimo.rekki_product_id ?? '')
                                  }}
                                  className="shrink-0 text-violet-400 transition-colors hover:text-violet-300"
                                  title="Modifica"
                                >
                                  <svg className={`h-3.5 w-3.5 ${icon.settingsTools}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <a
                                  href={`https://rekki.com/products/${encodeURIComponent(ultimo.rekki_product_id)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="shrink-0 text-violet-400 transition-colors hover:text-violet-300"
                                  title="Aggiorna da Rekki"
                                >
                                  <svg className={`h-3.5 w-3.5 ${icon.orders}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </a>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingRekkiId(ultimo.id)
                                  setRekkiProductIdDraft('')
                                }}
                                className="flex flex-1 items-center justify-center gap-1 text-xs text-app-fg-muted transition-colors hover:text-violet-300"
                              >
                                <svg className={`h-3 w-3 ${icon.settingsTools}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                <span>{t.common.add}</span>
                              </button>
                            )}
                          </div>
                        ) : null}
                      </div>

                      {/* ── COLONNA 3: Azioni ── */}
                      <div className="flex min-w-0 flex-col gap-2 border-t border-app-line-22/90 pt-3 md:items-end md:border-t-0 md:border-l md:border-app-line-22/70 md:pl-4 md:pt-0">
                        {!readOnly ? (
                          <>
                            <Link
                              href={verificaHref}
                              className="flex items-center justify-center gap-1.5 rounded-md bg-cyan-600/20 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition-colors hover:bg-cyan-600/30"
                              title={t.fornitori.listinoVerifyAnomaliesTitle}
                            >
                              <svg className={`h-3.5 w-3.5 ${icon.reviewWarning}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                              </svg>
                              {t.fornitori.listinoVerifyAnomalies}
                            </Link>
                            <div className="flex justify-end opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
                              <button
                                type="button"
                                onClick={() => handleDelete(ultimo.id)}
                                disabled={deletingId === ultimo.id}
                                title={t.common.delete}
                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-app-line-25 bg-app-line-10/80 text-app-fg-muted transition-colors hover:border-[rgba(34,211,238,0.15)] hover:bg-red-950/40 hover:text-red-300 disabled:opacity-40"
                              >
                                {deletingId === ultimo.id ? (
                                  <svg className={`h-3.5 w-3.5 animate-spin ${icon.destructive}`} fill="none" viewBox="0 0 24 24" aria-hidden>
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                  </svg>
                                ) : (
                                  <svg className={`h-3.5 w-3.5 ${icon.destructive}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                )}
                              </button>
                            </div>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : null}

      {/* ── Totali (KPI cliccabili → filtro elenco prodotti) ── */}
      {rows.length > 0 && (
        <>
        {/* Selettore periodo */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-app-fg-muted mr-1">{t.fornitori.listinoPeriodLabel}</span>
          {(
            [
              { key: 'all', label: t.fornitori.listinoPeriodAll },
              { key: 'cm',  label: t.fornitori.listinoPeriodCurrentMonth },
              { key: 'pm',  label: t.fornitori.listinoPeriodPreviousMonth },
              { key: '3m',  label: t.fornitori.listinoPeriodLast3Months },
              { key: 'fy',  label: t.fornitori.listinoPeriodFiscalYear },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setListinoPeriod(key)}
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
                listinoPeriod === key
                  ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-200'
                  : 'border-app-line-25 bg-app-line-10/50 text-app-fg-muted hover:border-app-line-40 hover:text-app-fg'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(
            [
              {
                key: 'all' as const,
                label: t.fornitori.listinoTotale,
                value: totale,
                cls: 'border-app-line-22 bg-transparent text-app-fg',
                bar: SUPPLIER_DETAIL_TAB_HIGHLIGHT.listino.bar,
                aria: t.fornitori.listinoKpiAriaAll,
              },
              {
                key: 'bolle' as const,
                label: t.fornitori.listinoDaBolle,
                value: totBolle,
                cls: 'border-[rgba(34,211,238,0.15)] bg-blue-500/10 text-blue-200',
                bar: SUPPLIER_DETAIL_TAB_HIGHLIGHT.bolle.bar,
                aria: t.fornitori.listinoKpiAriaBolle,
              },
              {
                key: 'fatture' as const,
                label: t.fornitori.listinoDaFatture,
                value: totFatture,
                cls: 'border-[rgba(34,211,238,0.15)] bg-emerald-500/10 text-emerald-200',
                bar: SUPPLIER_DETAIL_TAB_HIGHLIGHT.fatture.bar,
                aria: t.fornitori.listinoKpiAriaFatture,
              },
            ] as const
          ).map(({ key, label, value, cls, bar, aria }) => (
            <button
              key={label}
              type="button"
              aria-pressed={listinoSpendFilter === key}
              aria-label={aria}
              onClick={() => setListinoSpendFilter((prev) => (prev === key ? 'all' : key))}
              className={`relative flex flex-col overflow-hidden rounded-xl border text-left shadow-none transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-[0_0_24px_-8px_rgba(6,182,212,0.35)] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 ${
                listinoSpendFilter === key ? 'ring-2 ring-cyan-400/45 ring-offset-2 ring-offset-slate-950' : ''
              } ${cls}`}
            >
              <div className={`app-card-bar-accent shrink-0 ${bar}`} aria-hidden />
              <div className="p-4">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide opacity-80">{label}</p>
                <p className="text-xl font-bold tabular-nums">{fmtMoney(value)}</p>
              </div>
            </button>
          ))}
        </div>
        </>
      )}

      {/* ── Storico cronologico documenti ── */}
      {rows.length === 0 ? (
        <div className={`supplier-detail-tab-shell flex flex-col overflow-hidden text-center`}>
          <div className={`app-card-bar-accent shrink-0 ${SUPPLIER_DETAIL_TAB_HIGHLIGHT.listino.bar}`} aria-hidden />
          <div className="px-6 py-16">
          <svg className="mx-auto mb-3 h-12 w-12 text-app-fg-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-sm font-medium text-app-fg-muted">{t.fornitori.listinoNoDocs}</p>
          </div>
        </div>
      ) : (
        <div className={`supplier-detail-tab-shell overflow-hidden`}>
          <div className={`app-card-bar-accent ${SUPPLIER_DETAIL_TAB_HIGHLIGHT.listino.bar}`} aria-hidden />
          <div className="flex items-center justify-between border-b border-app-line-22 px-5 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-app-fg-muted">{t.fornitori.listinoStorico}</p>
            <p className="text-xs text-app-fg-muted">
              {filteredRows.length !== rows.length
                ? `${filteredRows.length} / ${rows.length}`
                : rows.length
              } {t.fornitori.listinoDocs}
            </p>
          </div>

          {/* Mobile */}
          <div className={APP_SECTION_MOBILE_LIST}>
            {filteredRows.map((r) => (
              <div key={`${r.tipo}-${r.id}`} className="flex min-h-[52px] items-center justify-between gap-3 px-4 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${r.tipo === 'fattura' ? 'bg-emerald-400' : 'bg-blue-400'}`} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-app-fg">{formatDate(r.data)}</p>
                    {r.numero && <p className="text-[11px] text-app-fg-muted">#{r.numero}</p>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    r.tipo === 'fattura' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-blue-500/15 text-blue-300'
                  }`}>
                    {r.tipo === 'fattura' ? t.fatture.title : t.bolle.title}
                  </span>
                  <span className="text-sm font-bold tabular-nums text-app-fg">{fmtMoney(r.importo ?? 0)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop */}
          <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead className={APP_SECTION_TABLE_THEAD_STICKY}>
              <tr className={APP_SECTION_TABLE_HEAD_ROW}>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-app-fg-muted">{t.fornitori.listinoColData}</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-app-fg-muted">{t.fornitori.listinoColTipo}</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-app-fg-muted">{t.fornitori.listinoColNumero}</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-app-fg-muted">{t.fornitori.listinoColImporto}</th>
              </tr>
            </thead>
            <tbody className={APP_SECTION_TABLE_TBODY}>
              {filteredRows.map((r) => (
                <tr key={`${r.tipo}-${r.id}`} className={APP_SECTION_TABLE_TR}>
                  <td className="px-5 py-3.5 font-medium text-app-fg-muted">{formatDate(r.data)}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                      r.tipo === 'fattura'
                        ? 'border-[rgba(34,211,238,0.15)] bg-emerald-500/10 text-emerald-300'
                        : 'border-[rgba(34,211,238,0.15)] bg-blue-500/10 text-blue-300'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${r.tipo === 'fattura' ? 'bg-emerald-400' : 'bg-blue-400'}`} />
                      {r.tipo === 'fattura' ? t.fatture.title : t.bolle.title}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-app-fg-muted">{r.numero ?? '—'}</td>
                  <td className="px-5 py-3.5 text-right text-base font-bold tabular-nums text-app-fg">{fmtMoney(r.importo ?? 0)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-app-line-22 app-workspace-inset-bg-soft">
                <td colSpan={3} className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-app-fg-muted">{t.fornitori.listinoColTotale}</td>
                <td className="px-5 py-3 text-right text-base font-bold tabular-nums text-app-fg">{fmtMoney(totale)}</td>
              </tr>
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  )
}

/** Allinea `md:` Tailwind: una sola istanza Verifica «full» su mobile, split desktop sopra la griglia KPI. */
function useMinMdViewport() {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === 'undefined') return () => {}
      const mq = window.matchMedia('(min-width: 768px)')
      mq.addEventListener('change', onStoreChange)
      return () => mq.removeEventListener('change', onStoreChange)
    },
    () => (typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : false),
    () => false,
  )
}

/* ─── Main client component ──────────────────────────────────────── */
function FornitoreDetailClient({
  fornitore,
  bolleCount,
  fattureCount,
  pendingCount,
  countryCode,
  currency,
  reloadFornitore,
}: {
  fornitore: Fornitore
  bolleCount: number
  fattureCount: number
  pendingCount: number
  countryCode: string
  currency?: string
  reloadFornitore?: () => void
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const supplierReturnPath = useMemo(
    () => buildListLocationPath(pathname ?? '', searchParams),
    [pathname, searchParams],
  )
  const tabParam = searchParams.get('tab')
  const tab = useMemo((): Tab => {
    const p = tabParam?.trim().toLowerCase()
    if (
      p === 'dashboard' ||
      p === 'bolle' ||
      p === 'fatture' ||
      p === 'listino' ||
      p === 'conferme' ||
      p === 'documenti' ||
      p === 'verifica' ||
      p === 'audit'
    ) {
      return p
    }
    return 'dashboard'
  }, [tabParam])

  const supplierReadOnlyMobile = useMobileSupplierReadOnly()
  const mdUp = useMinMdViewport()
  const displayTab = useMemo((): Tab => {
    if (supplierReadOnlyMobile && MOBILE_READONLY_HIDDEN_TABS.includes(tab)) return 'dashboard'
    return tab
  }, [supplierReadOnlyMobile, tab])

  const setTab = useCallback(
    (next: Tab) => {
      if (next === tab) {
        scrollSupplierTabPanelIntoView()
        return
      }
      const q = new URLSearchParams(searchParams.toString())
      fornitoreSupplierClearDocParams(q)
      if (next === 'dashboard') q.delete('tab')
      else q.set('tab', next)
      const qs = q.toString()
      const url = qs ? `${pathname}?${qs}` : pathname
      // push (non replace): Indietro del browser torna alla scheda precedente, come “cartella → file”.
      router.push(url, { scroll: false })
    },
    [pathname, router, searchParams, tab]
  )

  useEffect(() => {
    if (!supplierReadOnlyMobile) return
    if (!MOBILE_READONLY_HIDDEN_TABS.includes(tab)) return
    const q = new URLSearchParams(searchParams.toString())
    fornitoreSupplierClearDocParams(q)
    q.delete('tab')
    const qs = q.toString()
    const url = qs ? `${pathname}?${qs}` : pathname
    router.replace(url, { scroll: false })
  }, [supplierReadOnlyMobile, tab, pathname, router, searchParams])

  const t = useT()
  const { locale, timezone } = useLocale()
  const { me } = useMe()
  useLayoutEffect(() => {
    if (displayTab === 'dashboard') return
    const id = requestAnimationFrame(() => scrollSupplierTabPanelIntoView())
    const tmo = window.setTimeout(scrollSupplierTabPanelIntoView, 350)
    return () => {
      cancelAnimationFrame(id)
      window.clearTimeout(tmo)
    }
  }, [displayTab])

  /** Sede attiva utente se il fornitore non ha ancora `sede_id` — necessario per API statement/bolle in Verifica. */
  const effectiveSedeId = fornitore.sede_id?.trim() || me?.sede_id?.trim() || undefined
  const fornitoreNomeVisual = useMemo(
    () => fornitoreDisplayLabelUppercase(fornitore),
    [fornitore],
  )
  const fornitoreLabelAvatar = useMemo(() => fornitoreDisplayLabel(fornitore), [fornitore])
  // ── Periodo documenti / KPI (date inclusive Da / A, navigazione mese/anno) ──
  const now = new Date()
  const nowY = now.getFullYear()
  const nowM = now.getMonth() + 1
  const todayYmd = localYmd(now)

  const [ledgerPeriod, setLedgerPeriod] = useState<SupplierLedgerPeriod>(() => {
    const d = new Date()
    const b = supplierMonthCalendarBounds(d.getFullYear(), d.getMonth() + 1)
    return clampLedgerPeriodToToday(b.from, b.toIncl, localYmd(d))
  })

  const ledgerDateToExclusive = useMemo(
    () => supplierExclusiveEndAfterInclusive(ledgerPeriod.toIncl),
    [ledgerPeriod.toIncl],
  )

  /** Periodo solo per il riepilogo mensile in card: frecce anno qui non muovono il navigatore in header. */
  const [monthlySummaryPeriod, setMonthlySummaryPeriod] = useState(() => ({
    y: nowY,
    m: nowM,
  }))

  const filterYear = ymdYearMonth(ledgerPeriod.from).y
  const filterMonth = ymdYearMonth(ledgerPeriod.from).m

  const clampSupplierPeriod = (y: number, m: number) => {
    if (y > nowY || (y === nowY && m > nowM)) return { y: nowY, m: nowM }
    return { y, m }
  }

  useEffect(() => {
    const { y, m } = ymdYearMonth(ledgerPeriod.toIncl)
    setMonthlySummaryPeriod({ y, m })
  }, [ledgerPeriod.toIncl])

  const shiftMonthlySummaryYear = (delta: number) => {
    setMonthlySummaryPeriod((prev) => clampSupplierPeriod(prev.y + delta, prev.m))
  }

  const nextMonthlySummaryYearPeriod = clampSupplierPeriod(monthlySummaryPeriod.y + 1, monthlySummaryPeriod.m)
  const canShiftMonthlySummaryYearForward =
    nextMonthlySummaryYearPeriod.y !== monthlySummaryPeriod.y ||
    nextMonthlySummaryYearPeriod.m !== monthlySummaryPeriod.m

  const isMonthlySummaryAtCurrentMonth =
    monthlySummaryPeriod.y === nowY && monthlySummaryPeriod.m === nowM

  const shiftLedgerMonth = (delta: number) => {
    setLedgerPeriod((p) => shiftLedgerPeriodByMonths(p, delta, localYmd(new Date())))
  }

  const shiftLedgerYear = (delta: number) => {
    setLedgerPeriod((p) => shiftLedgerPeriodByMonths(p, delta * 12, localYmd(new Date())))
  }

  const ledgerShiftPreview = (deltaMonths: number) =>
    shiftLedgerPeriodByMonths(ledgerPeriod, deltaMonths, localYmd(new Date()))

  const canShiftLedgerMonthForward =
    ledgerShiftPreview(1).from !== ledgerPeriod.from || ledgerShiftPreview(1).toIncl !== ledgerPeriod.toIncl

  const canShiftLedgerYearForward =
    ledgerShiftPreview(12).from !== ledgerPeriod.from || ledgerShiftPreview(12).toIncl !== ledgerPeriod.toIncl

  const currentMonthBounds = useMemo(() => {
    const b = supplierMonthCalendarBounds(nowY, nowM)
    return clampLedgerPeriodToToday(b.from, b.toIncl, todayYmd)
  }, [nowY, nowM, todayYmd])

  const isLedgerAtCurrentMonthBounds =
    ledgerPeriod.from === currentMonthBounds.from && ledgerPeriod.toIncl === currentMonthBounds.toIncl

  const periodTriggerLabel = useMemo(() => {
    if (ledgerPeriod.from === ledgerPeriod.toIncl) {
      return formatDateLib(ledgerPeriod.from, locale, timezone, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    }
    const fromPart = formatDateLib(ledgerPeriod.from, locale, timezone, {
      day: '2-digit',
      month: 'short',
    })
    const toPart = formatDateLib(ledgerPeriod.toIncl, locale, timezone, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    return `${fromPart} – ${toPart}`
  }, [ledgerPeriod.from, ledgerPeriod.toIncl, locale, timezone])

  const [periodPickerOpen, setPeriodPickerOpen] = useState(false)
  const [periodPickerDraft, setPeriodPickerDraft] = useState<SupplierLedgerPeriod>(ledgerPeriod)
  const periodPickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!periodPickerOpen) return
    setPeriodPickerDraft(ledgerPeriod)
  }, [periodPickerOpen, ledgerPeriod])

  useEffect(() => {
    if (!periodPickerOpen) return
    const onPointerDown = (e: PointerEvent) => {
      const el = periodPickerRef.current
      if (el && !el.contains(e.target as Node)) setPeriodPickerOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPeriodPickerOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [periodPickerOpen])

  const [periodLedgerEpoch, setPeriodLedgerEpoch] = useState(0)
  const bumpPeriodLedger = useCallback(() => {
    setPeriodLedgerEpoch((n) => n + 1)
    reloadFornitore?.()
  }, [reloadFornitore])

  const canRunOcrFornitore = Boolean(me?.is_admin || me?.is_admin_sede) && !supplierReadOnlyMobile
  const [ocrFornitoreBusy, setOcrFornitoreBusy] = useState(false)
  const [ocrFornitoreFlash, setOcrFornitoreFlash] = useState<{ text: string; ok: boolean } | null>(null)

  const runOcrFornitoreHeader = useCallback(async () => {
    if (!canRunOcrFornitore) return
    setOcrFornitoreBusy(true)
    setOcrFornitoreFlash(null)
    try {
      const body: { fornitore_id: string; limit: number; sede_id?: string; allow_tipo_migrate: boolean } = {
        fornitore_id: fornitore.id,
        limit: 80,
        allow_tipo_migrate: true,
      }
      if (me?.is_admin_sede && me.sede_id) body.sede_id = me.sede_id
      const res = await fetch('/api/admin/fix-ocr-dates', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        corrected?: number
        scanned?: number
        totalSuspicious?: number
      }
      if (!res.ok) {
        setOcrFornitoreFlash({ text: data.error ?? `HTTP ${res.status}`, ok: false })
        return
      }
      bumpPeriodLedger()
      setOcrFornitoreFlash({
        ok: true,
        text: t.fornitori.ocrControllaFornitoreResult
          .replace(/\{corrected\}/g, String(data.corrected ?? 0))
          .replace(/\{scanned\}/g, String(data.scanned ?? 0))
          .replace(/\{total\}/g, String(data.totalSuspicious ?? 0)),
      })
      window.setTimeout(() => setOcrFornitoreFlash(null), 9000)
    } catch (e) {
      setOcrFornitoreFlash({ text: e instanceof Error ? e.message : 'Errore di rete', ok: false })
    } finally {
      setOcrFornitoreBusy(false)
    }
  }, [bumpPeriodLedger, canRunOcrFornitore, fornitore.id, me?.is_admin_sede, me?.sede_id, t.fornitori.ocrControllaFornitoreResult])

  const { stats: periodStats, loading: periodStatsLoading } = useSupplierPeriodStats(
    fornitore.id,
    ledgerPeriod.from,
    ledgerDateToExclusive,
    periodLedgerEpoch,
  )

  const ordiniCount = periodStats?.ordiniNelPeriodo ?? 0

  const expandLedgerToAllFatture = useCallback(() => {
    setLedgerPeriod(clampLedgerPeriodToToday('2000-01-01', todayYmd, todayYmd))
    setPeriodLedgerEpoch((e) => e + 1)
  }, [todayYmd])

  const tabs: { id: Tab; label: string; badge?: number }[] = useMemo(() => {
    const all: { id: Tab; label: string; badge?: number }[] = [
      { id: 'dashboard', label: t.fornitori.tabRiepilogo },
      { id: 'conferme', label: t.fornitori.kpiOrdini, badge: ordiniCount > 0 ? ordiniCount : undefined },
      { id: 'bolle', label: t.nav.bolle, badge: bolleCount },
      { id: 'fatture', label: t.nav.fatture, badge: fattureCount > 0 ? fattureCount : undefined },
      { id: 'verifica', label: t.statements.tabVerifica },
      { id: 'listino', label: t.fornitori.tabListino },
      { id: 'audit', label: t.fornitori.tabAuditPrezzi },
      { id: 'documenti', label: t.statements.tabDocumenti, badge: pendingCount > 0 ? pendingCount : undefined },
    ]
    if (supplierReadOnlyMobile) {
      return all.filter((tb) => tb.id === 'dashboard' || tb.id === 'listino' || tb.id === 'documenti')
    }
    return all
  }, [t, ordiniCount, bolleCount, fattureCount, pendingCount, supplierReadOnlyMobile])

  const TabContent = ({ variant }: { variant: 'mobile' | 'desktop' }) => (
    <>
      {displayTab === 'dashboard' &&
        ((variant === 'desktop' && mdUp) || (variant === 'mobile' && !mdUp) ? (
          <DashboardTab
            fornitoreId={fornitore.id}
            fornitore={fornitore}
            onFornitoreReload={reloadFornitore}
            readOnly={supplierReadOnlyMobile}
          />
        ) : null)}
      {displayTab === 'bolle' &&
        ((variant === 'desktop' && mdUp) || (variant === 'mobile' && !mdUp) ? (
          <BolleTab
            fornitoreId={fornitore.id}
            dateFrom={ledgerPeriod.from}
            dateToExclusive={ledgerDateToExclusive}
            pathname={pathname}
            searchParams={searchParams}
            readOnly={supplierReadOnlyMobile}
            onLedgerMutated={bumpPeriodLedger}
            currency={currency ?? 'GBP'}
          />
        ) : null)}
      {displayTab === 'fatture' &&
        ((variant === 'desktop' && mdUp) || (variant === 'mobile' && !mdUp) ? (
          <FattureTab
            fornitoreId={fornitore.id}
            dateFrom={ledgerPeriod.from}
            dateToExclusive={ledgerDateToExclusive}
            pathname={pathname}
            searchParams={searchParams}
            readOnly={supplierReadOnlyMobile}
            onLedgerMutated={bumpPeriodLedger}
            currency={currency ?? 'GBP'}
            epoch={periodLedgerEpoch}
            archivioFattureCount={fattureCount}
            onExpandDateRangeToShowAllFatture={expandLedgerToAllFatture}
          />
        ) : null)}
      {displayTab === 'listino' &&
        ((variant === 'desktop' && mdUp) || (variant === 'mobile' && !mdUp) ? (
          <ListinoTab
            fornitoreId={fornitore.id}
            fornitoreNome={fornitoreNomeVisual}
            rekkiLinked={Boolean(
              String(fornitore.rekki_supplier_id ?? '').trim() || String(fornitore.rekki_link ?? '').trim()
            )}
            currency={currency}
            readOnly={supplierReadOnlyMobile}
          />
        ) : null)}
      {displayTab === 'conferme' &&
        ((variant === 'desktop' && mdUp) || (variant === 'mobile' && !mdUp) ? (
          <FornitoreConfermeOrdineTab
            fornitoreId={fornitore.id}
            sedeId={fornitore.sede_id ?? null}
            readOnly={supplierReadOnlyMobile}
          />
        ) : null)}
      {displayTab === 'documenti' &&
        ((variant === 'desktop' && mdUp) || (variant === 'mobile' && !mdUp) ? (
          <PendingMatchesTab
            sedeId={effectiveSedeId}
            fornitoreId={fornitore.id}
            countryCode={countryCode}
            currency={currency}
            year={filterYear}
            month={filterMonth}
            ledgerDateFrom={ledgerPeriod.from}
            ledgerDateToExclusive={ledgerDateToExclusive}
            cardAccent="amber"
          />
        ) : null)}
      {displayTab === 'verifica' &&
        (variant === 'desktop' && mdUp ? (
          <VerificationStatusTab
            sedeId={effectiveSedeId}
            fornitoreId={fornitore.id}
            countryCode={countryCode}
            currency={currency}
            year={filterYear}
            month={filterMonth}
            ledgerDateFrom={ledgerPeriod.from}
            ledgerDateToExclusive={ledgerDateToExclusive}
            cardAccent="cyan"
            supplierDesktopVerificaMode="statementsPanel"
          />
        ) : variant === 'mobile' && !mdUp ? (
          <VerificationStatusTab
            sedeId={effectiveSedeId}
            fornitoreId={fornitore.id}
            countryCode={countryCode}
            currency={currency}
            year={filterYear}
            month={filterMonth}
            ledgerDateFrom={ledgerPeriod.from}
            ledgerDateToExclusive={ledgerDateToExclusive}
            cardAccent="cyan"
          />
        ) : null)}
      {displayTab === 'audit' &&
        ((variant === 'desktop' && mdUp) || (variant === 'mobile' && !mdUp) ? (
          <>
            <GmailAuditReadyBadge fornitoreNome={fornitoreNomeVisual} />
            <RecuperoCreditiAudit
              fornitoreId={fornitore.id}
              fornitoreNome={fornitoreNomeVisual}
              currency={currency ?? 'GBP'}
            />
          </>
        ) : null)}
    </>
  )

  const activeTabInfo = tabs.find((tb) => tb.id === displayTab) ?? tabs[0]!

  return (
    <>
      <FornitoreDocDetailLayer
        fornitoreId={fornitore.id}
        bollaId={searchParams.get('bolla')}
        fatturaId={searchParams.get('fattura')}
        onAfterDelete={bumpPeriodLedger}
      />
      {/* ══ MOBILE (< md): padding basso gestito da AppShell (`showsMobileBottomBar`) ══ */}
      <div className="grid grid-cols-1 min-w-0 gap-4 px-4 pb-6 text-app-fg md:hidden">
        <div className={`supplier-detail-tab-shell mt-2 overflow-hidden ${SUPPLIER_DETAIL_TAB_HIGHLIGHT[displayTab].border}`}>
          <div className={`app-card-bar-accent ${SUPPLIER_DETAIL_TAB_HIGHLIGHT[displayTab].bar}`} aria-hidden />
          <div className="flex items-start gap-3 border-t border-app-line-10 bg-transparent px-3 py-2.5 text-app-fg">
            <FornitoreAvatar nome={fornitoreLabelAvatar} logoUrl={fornitore.logo_url} sizeClass="h-11 w-11" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <h1 className="app-page-title text-sm font-semibold leading-snug">{fornitoreNomeVisual}</h1>
              {!supplierReadOnlyMobile ? (
                <ScanEmailButton
                  variant="supplier"
                  alwaysShowLabel
                  fornitoreId={fornitore.id}
                  sedeId={fornitore.sede_id ?? undefined}
                  disabled={!fornitore.sede_id}
                  disabledReasonTitle={!fornitore.sede_id ? t.fornitori.syncEmailNeedSede : undefined}
                />
              ) : null}
            </div>
          </div>
        </div>

        <div className="min-w-0">
          {supplierReadOnlyMobile ? (
            <SupplierDesktopKpiGrid loading={periodStatsLoading} stats={periodStats} onTabChange={setTab} hiddenTabs={MOBILE_READONLY_HIDDEN_TABS} />
          ) : (
            <div
              className="-mx-1 flex min-w-0 gap-px overflow-x-auto border-b border-app-line-15 pb-2 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              role="navigation"
              aria-label={fornitoreNomeVisual}
            >
              {tabs.map((tb) => (
                <button
                  key={tb.id}
                  type="button"
                  onClick={() => setTab(tb.id)}
                  className={`box-border flex min-h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-t-md px-2.5 py-2 text-xs font-semibold leading-none transition-colors border-b-2 -mb-px touch-manipulation sm:min-h-10 sm:px-3 ${
                    tab === tb.id
                      ? `${SUPPLIER_DETAIL_TAB_ACTIVE_UNDERLINE[tb.id]} bg-transparent text-app-fg`
                      : 'border-b-transparent bg-transparent text-app-fg-muted hover:bg-app-line-10 hover:text-app-fg'
                  }`}
                >
                  {tb.label}
                  {tb.badge !== undefined && tb.badge > 0 ? (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        tab === tb.id
                          ? tb.id === 'documenti'
                            ? 'bg-amber-400/20 text-amber-300'
                            : 'bg-app-a-20 text-app-fg-muted'
                          : 'bg-white/10 text-app-fg-muted'
                      }`}
                    >
                      {tb.badge}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </div>

        <header className="sticky top-0 z-[5] -mx-4 border-b border-app-soft-border bg-transparent px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="mobile-supplier-tab-title" className="text-lg font-bold leading-tight tracking-tight text-app-fg">
              {activeTabInfo.label}
            </h2>
            {activeTabInfo.badge != null && activeTabInfo.badge > 0 && (
              <span className="rounded-full border border-app-line-25 bg-transparent px-2 py-0.5 text-xs font-bold tabular-nums text-app-fg-muted">
                {activeTabInfo.badge > 99 ? '99+' : activeTabInfo.badge}
              </span>
            )}
          </div>
        </header>

        <div className="fornitore-tab-panel min-w-0 scroll-mt-4 rounded-lg border border-app-line-15 bg-white/[0.04] p-3 outline-none sm:p-4">
          <ErrorBoundary sectionName="dettaglio fornitore">
            <TabContent variant="mobile" />
          </ErrorBoundary>
        </div>
      </div>

      {/* ══ DESKTOP layout (md+) ═════════════════════════════════════ */}
      <div className="hidden min-w-0 text-app-fg md:block">
        {/*
          Un solo `fornitore-desktop-main-x`: stesso canale orizzontale per header+tab e corpo (KPI / tabella / tab).
        */}
        <div
          className="fornitore-desktop-main-x mx-auto w-full max-w-7xl"
          role="region"
          aria-label={t.fornitori.supplierDesktopRegionAria}
        >
        {/* Intestazione + tab: sticky in `#app-main` così nome/sync/CTA e tab+mese restano visibili allo scroll. */}
        <div className="sticky top-0 z-20 w-full border-b border-app-soft-border app-workspace-inset-bg-soft pb-0.5 pt-1 shadow-[0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl [-webkit-backdrop-filter:blur(16px)]">
          {/*
            Sotto xl: identità, poi sync, poi CTA. Mese/anno nella fascia tab sotto.
            Da xl in su: identità | sync (verso destra) | CTA; mese/anno accanto alle tab.
          */}
          <div className="flex min-w-0 items-center gap-2 px-2 py-1 sm:gap-2.5 sm:px-2.5 lg:py-0.5">
            {/* Identità fornitore */}
            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
              <FornitoreAvatar
                nome={fornitoreLabelAvatar}
                logoUrl={fornitore.logo_url}
                sizeClass="h-8 w-8 shrink-0 lg:h-7 lg:w-7"
              />
              <div className="min-w-0 flex-1">
                <h1 className="app-page-title truncate text-[13px] font-bold leading-tight text-app-fg">
                  {fornitoreNomeVisual}
                </h1>
                {fornitore.email && (
                  <p className="truncate text-[11px] leading-snug text-app-fg-muted">
                    {fornitore.email}
                  </p>
                )}
              </div>
            </div>

            {/* Sincronizza email — compatto nella sticky header */}
            <div className="shrink-0">
              <ScanEmailButton
                placement="desktopHeader"
                fornitoreId={fornitore.id}
                sedeId={fornitore.sede_id ?? undefined}
                disabled={!fornitore.sede_id}
                disabledReasonTitle={!fornitore.sede_id ? t.fornitori.syncEmailNeedSede : undefined}
              />
            </div>

            {canRunOcrFornitore ? (
              <div className="shrink-0">
                <button
                  type="button"
                  onClick={() => void runOcrFornitoreHeader()}
                  disabled={ocrFornitoreBusy}
                  title={t.fornitori.ocrControllaFornitoreTitle}
                  className="inline-flex h-7 max-w-[9.5rem] shrink-0 items-center justify-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 text-[10px] font-bold leading-tight text-amber-100 transition-colors hover:bg-amber-500/18 disabled:cursor-not-allowed disabled:opacity-50 sm:h-8 sm:max-w-none sm:px-2.5 sm:text-[11px]"
                >
                  {ocrFornitoreBusy ? (
                    <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-amber-200 border-t-transparent" />
                  ) : (
                    <svg className={`h-3.5 w-3.5 shrink-0 ${icon.analytics}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                  <span className="min-w-0 truncate">{t.fornitori.ocrControllaFornitore}</span>
                </button>
              </div>
            ) : null}

            {/* CTA */}
            <div className="flex shrink-0 items-center gap-1">
              <Link
                href={hrefWithReturnTo(`/bolle/new?fornitore_id=${fornitore.id}`, supplierReturnPath)}
                onClick={() => saveScrollForListPath(supplierReturnPath)}
                className="app-glow-cyan inline-flex h-7 shrink-0 items-center gap-1 rounded-md bg-app-cyan-500 px-2.5 text-[11px] font-bold leading-none text-cyan-950 transition-colors hover:bg-app-cyan-400 active:bg-cyan-600 sm:h-8 sm:gap-1.5 sm:px-3"
              >
                <svg className={`h-3.5 w-3.5 ${icon.bolle}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {t.nav.nuovaBolla}
              </Link>
              <Link
                href={hrefWithReturnTo(`/fornitori/${fornitore.id}/edit`, supplierReturnPath)}
                onClick={() => saveScrollForListPath(supplierReturnPath)}
                title={t.fornitori.editTitle}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-app-soft-border text-app-fg-muted transition-colors hover:bg-app-line-10 hover:text-app-fg sm:h-8 sm:w-8"
              >
                <svg className={`h-3.5 w-3.5 ${icon.settingsTools}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </Link>
              <AppPageHeaderDesktopTray className="ms-0.5" />
            </div>
          </div>
          {ocrFornitoreFlash ? (
            <p
              className={`border-b border-app-soft-border px-2.5 py-1 text-center text-[10px] sm:px-3 ${
                ocrFornitoreFlash.ok ? 'text-emerald-200/95' : 'text-rose-300'
              }`}
              role="status"
            >
              {ocrFornitoreFlash.text}
            </p>
          ) : null}

          {/* Tab bar + navigatore mese: tab e mese ancorati in basso (self-end sul mese, stessa h delle tab) */}
          <div className="flex w-full min-w-0 items-stretch gap-2 border-t border-app-soft-border pt-0.5 pb-0 xl:gap-2.5 xl:pt-0.5 xl:pb-0">
            <div className="flex min-h-6 min-w-0 flex-1 items-end gap-px overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden xl:min-h-8">
              {tabs.map((tb) => (
                <button
                  key={tb.id}
                  type="button"
                  onClick={() => setTab(tb.id)}
                  className={`box-border flex min-h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-t px-2 py-0 text-[10px] font-semibold leading-none transition-colors border-b-2 -mb-px lg:min-h-7 lg:text-[11px] xl:min-h-8 xl:px-2.5 ${
                    tab === tb.id
                      ? `${SUPPLIER_DETAIL_TAB_ACTIVE_UNDERLINE[tb.id]} bg-transparent text-app-fg`
                      : 'border-b-transparent bg-transparent text-app-fg-muted hover:bg-app-line-10 hover:text-app-fg'
                  }`}
                >
                  {tb.label}
                  {tb.badge !== undefined && tb.badge > 0 && (
                    <span
                      className={`rounded-full px-1 py-0.5 text-[9px] font-bold lg:px-1.5 lg:text-[10px] ${
                        tab === tb.id
                          ? tb.id === 'documenti'
                            ? 'bg-amber-400/20 text-amber-300'
                            : 'bg-app-a-20 text-app-fg-muted'
                          : 'bg-white/10 text-app-fg-muted'
                      }`}
                    >
                      {tb.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div
              ref={periodPickerRef}
              className="-mb-px relative flex h-6 w-max shrink-0 items-center gap-px self-end rounded-lg border border-cyan-500/20 bg-app-line-12 px-0.5 shadow-[inset_0_1px_0_rgba(34,211,238,0.07),0_1px_4px_rgba(0,0,0,0.18)] xl:h-8 xl:px-1"
            >
              <button
                type="button"
                onClick={() => shiftLedgerYear(-1)}
                title={t.appStrings.monthNavPrevYearTitle}
                aria-label={t.appStrings.monthNavPrevYearTitle}
                className="flex h-5 w-5 items-center justify-center rounded-sm text-app-fg-muted/70 transition-colors hover:bg-cyan-500/10 hover:text-cyan-200 xl:h-6 xl:w-6"
              >
                <svg className="h-3 w-3 text-app-fg-muted xl:h-3 xl:w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-9-9 9-9m9 18l-9-9 9-9" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => shiftLedgerMonth(-1)}
                title={t.appStrings.monthNavPrevMonthTitle}
                aria-label={t.appStrings.monthNavPrevMonthTitle}
                className="flex h-5 w-5 items-center justify-center rounded-sm text-app-fg-muted/70 transition-colors hover:bg-cyan-500/10 hover:text-cyan-200 xl:h-6 xl:w-6"
              >
                <svg className="h-3 w-3 text-app-fg-muted xl:h-3 xl:w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                id="supplier-desktop-period-month-trigger"
                aria-haspopup="dialog"
                aria-expanded={periodPickerOpen}
                aria-controls={periodPickerOpen ? 'supplier-desktop-period-month-dialog' : undefined}
                title={t.appStrings.supplierDesktopPeriodPickerButtonAria}
                aria-label={t.appStrings.supplierDesktopPeriodPickerButtonAria}
                onClick={() => setPeriodPickerOpen((o) => !o)}
                className="min-w-0 max-w-[11rem] truncate whitespace-nowrap rounded px-1 text-center text-[11px] font-semibold tabular-nums leading-none text-cyan-200 transition-colors hover:bg-cyan-500/10 hover:text-white xl:max-w-[14rem] xl:leading-8"
              >
                {periodTriggerLabel}
              </button>
              {periodPickerOpen ? (
                <div
                  id="supplier-desktop-period-month-dialog"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="supplier-desktop-period-picker-title"
                  className="absolute right-0 top-[calc(100%+6px)] z-[60] w-[min(100vw-2rem,20rem)] rounded-lg border border-app-soft-border bg-[#0b1524] p-3 shadow-[0_12px_40px_rgba(0,0,0,0.45)] ring-1 ring-white/5"
                >
                  <p
                    id="supplier-desktop-period-picker-title"
                    className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-app-fg-muted"
                  >
                    {t.appStrings.supplierDesktopPeriodPickerTitle}
                  </p>
                  <div className="mb-2 flex flex-col gap-2">
                    <label className="block text-[10px] font-semibold uppercase tracking-wide text-app-fg-muted">
                      {t.appStrings.supplierDesktopPeriodFromLabel}
                      <input
                        type="date"
                        value={periodPickerDraft.from}
                        max={todayYmd}
                        onChange={(e) => {
                          const v = e.target.value
                          if (!v) return
                          setPeriodPickerDraft((d) => ({ ...d, from: v }))
                        }}
                        className="mt-1 w-full rounded-md border border-app-line-28 bg-app-line-10/90 px-2 py-2 text-sm tabular-nums text-app-fg [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                      />
                    </label>
                    <label className="block text-[10px] font-semibold uppercase tracking-wide text-app-fg-muted">
                      {t.appStrings.supplierDesktopPeriodToLabel}
                      <input
                        type="date"
                        value={periodPickerDraft.toIncl}
                        max={todayYmd}
                        onChange={(e) => {
                          const v = e.target.value
                          if (!v) return
                          setPeriodPickerDraft((d) => ({ ...d, toIncl: v }))
                        }}
                        className="mt-1 w-full rounded-md border border-app-line-28 bg-app-line-10/90 px-2 py-2 text-sm tabular-nums text-app-fg [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const a = periodPickerDraft.from
                      const b = periodPickerDraft.toIncl
                      const ordered =
                        compareYmd(a, b) > 0 ? { from: b, toIncl: a } : { from: a, toIncl: b }
                      setLedgerPeriod(clampLedgerPeriodToToday(ordered.from, ordered.toIncl, localYmd(new Date())))
                      setPeriodPickerOpen(false)
                    }}
                    className="w-full rounded-md bg-app-cyan-500 px-2 py-2 text-center text-xs font-bold text-cyan-950 transition-colors hover:bg-app-cyan-400"
                  >
                    {t.appStrings.supplierDesktopPeriodApply}
                  </button>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => shiftLedgerMonth(1)}
                disabled={!canShiftLedgerMonthForward}
                title={t.appStrings.monthNavNextMonthTitle}
                aria-label={t.appStrings.monthNavNextMonthTitle}
                className="flex h-5 w-5 items-center justify-center rounded-sm text-app-fg-muted/70 transition-colors hover:bg-cyan-500/10 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-30 xl:h-6 xl:w-6"
              >
                <svg className="h-3 w-3 text-app-fg-muted xl:h-3 xl:w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => shiftLedgerYear(1)}
                disabled={!canShiftLedgerYearForward}
                title={t.appStrings.monthNavNextYearTitle}
                aria-label={t.appStrings.monthNavNextYearTitle}
                className="flex h-5 w-5 items-center justify-center rounded-sm text-app-fg-muted/70 transition-colors hover:bg-cyan-500/10 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-30 xl:h-6 xl:w-6"
              >
                <svg className="h-3 w-3 text-app-fg-muted xl:h-3 xl:w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l9 9-9 9M4 5l9 9-9 9" />
                </svg>
              </button>
              {!isLedgerAtCurrentMonthBounds && (
                <button
                  type="button"
                  onClick={() => setLedgerPeriod(currentMonthBounds)}
                  title={t.appStrings.monthNavResetTitle}
                  aria-label={t.appStrings.monthNavResetTitle}
                  className="flex h-5 w-5 items-center justify-center rounded-sm text-app-cyan-500 transition-colors hover:bg-app-line-15 hover:text-app-fg xl:h-6 xl:w-6"
                >
                  <svg className="h-3 w-3 text-app-cyan-500 xl:h-3 xl:w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 12a9 9 0 1018 0 9 9 0 00-18 0m9-4v4l3 3" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tab content — KPI desktop sempre visibili; tabella mensile solo sul tab Riepilogo (`dashboard`). */}
        <div className="min-h-[calc(100vh-8rem)]">
          <div className="w-full min-w-0 py-3 sm:py-3.5 md:py-5 lg:py-6 xl:py-8">
            <SupplierDesktopKpiGrid loading={periodStatsLoading} stats={periodStats} onTabChange={setTab} />
            {displayTab === 'dashboard' ? (
              <>
                <SupplierDesktopMonthlyDocSummary
                  fornitoreId={fornitore.id}
                  endYear={monthlySummaryPeriod.y}
                  endMonth={monthlySummaryPeriod.m}
                  selectedYear={filterYear}
                  selectedMonth={filterMonth}
                  countryCode={countryCode}
                  currency={currency ?? 'GBP'}
                  activeTab="dashboard"
                  periodNav={{
                    onPrevYear: () => shiftMonthlySummaryYear(-1),
                    onNextYear: () => shiftMonthlySummaryYear(1),
                    onResetToNow: () => setMonthlySummaryPeriod({ y: nowY, m: nowM }),
                    disableNextYear: !canShiftMonthlySummaryYearForward,
                    showResetToNow: !isMonthlySummaryAtCurrentMonth,
                  }}
                  onOpenMonthTab={(y, m, nextTab) => {
                    const c = clampSupplierPeriod(y, m)
                    const b = supplierMonthCalendarBounds(c.y, c.m)
                    setLedgerPeriod(clampLedgerPeriodToToday(b.from, b.toIncl, localYmd(new Date())))
                    setTab(nextTab)
                  }}
                />
                {/* Mini activity feed for this fornitore */}
                <div className={`mt-4 relative overflow-hidden rounded-lg border border-app-line-15 bg-white/[0.04]`}>
                  <div className={`app-card-bar-accent shrink-0 ${SUPPLIER_DETAIL_TAB_HIGHLIGHT.dashboard.bar}`} aria-hidden />
                  <div className="p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <svg className="h-4 w-4 text-app-fg-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm font-semibold text-app-fg">{t.appStrings.attivitaRecentTitle}</p>
                    </div>
                    <ActivityFeed fornitoreId={fornitore.id} limit={5} compact={true} />
                  </div>
                </div>
              </>
            ) : null}
            <div
              className="fornitore-tab-panel min-w-0 scroll-mt-6 rounded-xl border border-app-line-15 bg-transparent p-2.5 outline-none sm:p-3 md:p-3.5 md:scroll-mt-8"
              tabIndex={-1}
            >
              <ErrorBoundary sectionName="dettaglio fornitore">
                <TabContent variant="desktop" />
                {displayTab === 'verifica' && mdUp ? (
                  <div className="min-w-0 mt-3 md:mt-4">
                    <VerificationStatusTab
                      sedeId={effectiveSedeId}
                      fornitoreId={fornitore.id}
                      countryCode={countryCode}
                      currency={currency}
                      year={filterYear}
                      month={filterMonth}
                      ledgerDateFrom={ledgerPeriod.from}
                      ledgerDateToExclusive={ledgerDateToExclusive}
                      cardAccent="cyan"
                      supplierDesktopVerificaMode="classicToolbar"
                    />
                  </div>
                ) : null}
              </ErrorBoundary>
            </div>
          </div>
        </div>
        </div>
      </div>
    </>
  )
}

/* ─── Page entry point ───────────────────────────────────────────── */
export default function FornitoreDetailPage() {
  const id = segmentParam(useParams().id)
  const router = useRouter()
  const tPage = useT()
  const idRef = useRef(id)
  idRef.current = id

  const [fornitore, setFornitore] = useState<Fornitore | null>(null)
  const [bolleCount, setBolleCount] = useState(0)
  const [fattureCount, setFattureCount] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)
  const [countryCode, setCountryCode] = useState('UK')
  const [sedeCurrency, setSedeCurrency] = useState('GBP')
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  /**
   * Carica anagrafica + conteggi. Il fetch documenti in coda non blocca più la pagina:
   * se `/api/documenti-da-processare` fallisce o resta appeso, prima si vedeva lo splash all’infinito
   * perché `Promise.all` rifiutava e `setLoading(false)` non veniva mai chiamato.
   */
  const loadImpl = useCallback(
    async (opts: { pageLoading: boolean; cancelled?: () => boolean }) => {
      const { pageLoading, cancelled } = opts

      if (!id) {
        setNotFound(true)
        setFornitore(null)
        if (pageLoading) setLoading(false)
        return
      }

      if (pageLoading) setLoading(true)

      try {
        const supabase = createClient()
        const [fornitoreRes, bolleRes, fattureRes] = await Promise.all([
          supabase.from('fornitori').select('*').eq('id', id).single(),
          supabase.from('bolle').select('id', { count: 'exact', head: true }).eq('fornitore_id', id),
          supabase.from('fatture').select('id', { count: 'exact', head: true }).eq('fornitore_id', id),
        ])

        if (cancelled?.()) return

        if (fornitoreRes.error || !fornitoreRes.data) {
          setNotFound(true)
          setFornitore(null)
          return
        }

        setNotFound(false)
        const data = fornitoreRes.data as Fornitore
        setFornitore(data)
        setBolleCount(bolleRes.count ?? 0)
        setFattureCount(fattureRes.count ?? 0)

        if (data.sede_id) {
          const { data: sedeData } = await supabase
            .from('sedi')
            .select('country_code, currency')
            .eq('id', data.sede_id)
            .single()
          if (cancelled?.()) return
          setCountryCode(sedeData?.country_code ?? 'UK')
          setSedeCurrency(sedeData?.currency ?? 'GBP')
        } else {
          setCountryCode('UK')
          setSedeCurrency('GBP')
        }

        const pendingForId = id
        void fetch(
          `/api/documenti-da-processare?fornitore_id=${encodeURIComponent(pendingForId)}&stati=in_attesa,da_associare`
        )
          .then((r) => (r.ok ? r.json() : []))
          .then((pendingRes) => {
            if (idRef.current !== pendingForId) return
            setPendingCount(Array.isArray(pendingRes) ? pendingRes.length : 0)
          })
          .catch(() => {
            if (idRef.current !== pendingForId) return
            setPendingCount(0)
          })
      } catch {
        if (cancelled?.()) return
        if (pageLoading) {
          setNotFound(true)
          setFornitore(null)
        }
      } finally {
        if (pageLoading && !cancelled?.()) setLoading(false)
      }
    },
    [id]
  )

  useEffect(() => {
    let cancelled = false
    void loadImpl({ pageLoading: true, cancelled: () => cancelled })
    return () => {
      cancelled = true
    }
  }, [loadImpl])

  const reloadFornitore = useCallback(() => {
    void loadImpl({ pageLoading: false })
  }, [loadImpl])

  if (loading) {
    return (
      <FluxoSupplierProfileLoading message={tPage.fornitori.loadingProfile} tagline={tPage.ui.tagline} />
    )
  }

  if (notFound || !fornitore) {
    return (
      <div className="max-w-5xl p-4 py-20 text-center md:p-8">
        <p className="mb-3 font-medium text-app-fg-muted">Fornitore non trovato.</p>
        <button
          type="button"
          onClick={() => {
            const r = readReturnToFromGetter((k) =>
              typeof window !== 'undefined' ? new URL(window.location.href).searchParams.get(k) : null,
            )
            if (r) router.push(r)
            else router.back()
          }}
          className="text-sm font-medium text-app-cyan-500 hover:underline"
        >
          ← Torna ai fornitori
        </button>
      </div>
    )
  }

  return (
    <Suspense fallback={null}>
      <FornitoreDetailClient
        reloadFornitore={reloadFornitore}
        fornitore={fornitore}
        bolleCount={bolleCount}
        fattureCount={fattureCount}
        pendingCount={pendingCount}
        countryCode={countryCode}
        currency={sedeCurrency}
      />
    </Suspense>
  )
}
