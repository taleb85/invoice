'use client'

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
import {
  checkResultMatchesVerificaProdotto,
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
import FornitoreDocDetailLayer from '@/components/FornitoreDocDetailLayer'
import { createClient } from '@/utils/supabase/client'
import {
  countSupplierMonthRekkiPriceAnomalies,
  statementMatchesCalendarWindow,
} from '@/lib/rekki-price-anomalies'
import { PendingMatchesTab, VerificationStatusTab } from '@/app/(app)/statements/statements-views'
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
import ScanEmailButton from '@/components/ScanEmailButton'
import AppPageHeaderDesktopTray from '@/components/AppPageHeaderDesktopTray'
import RekkiSupplierIntegration from '@/components/RekkiSupplierIntegration'
import FluxoSupplierProfileLoading from '@/components/FluxoSupplierProfileLoading'
import FornitoreAvatar from '@/components/FornitoreAvatar'
import FornitoreConfermeOrdineTab from '@/components/FornitoreConfermeOrdineTab'
import DeleteButton from '@/components/DeleteButton'
import {
  SUPPLIER_DETAIL_TAB_ACTIVE_UNDERLINE,
  SUPPLIER_DETAIL_TAB_HIGHLIGHT,
  SUPPLIER_DETAIL_TAB_TABLE_ACCENT,
} from '@/lib/supplier-detail-tab-theme'
import KpiLAccentOverlay from '@/components/KpiLAccentOverlay'
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
  APP_SECTION_TABLE_TR,
  APP_SECTION_TRAILING_LINK_CLASS,
  appSectionTableHeadRowAccentClass,
} from '@/lib/app-shell-layout'
import { StatusBadge } from '@/components/ui/StatusBadge'

type Tab = 'dashboard' | 'bolle' | 'fatture' | 'listino' | 'conferme' | 'documenti' | 'verifica'

/** Due `TabContent` (mobile/desktop); scrolla il pannello visibile dentro `<main data-app-main-scroll>`. */
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
}

function useSupplierPeriodStats(fornitoreId: string, year: number, month: number, reloadEpoch = 0) {
  const [stats, setStats] = useState<SupplierPeriodStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const from = `${year}-${String(month).padStart(2, '0')}-01`
    const to = new Date(year, month, 1).toISOString().split('T')[0]
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
    ])
      .then(([bolleRes, bolleAperteRes, fattureRes, pendingCount, listinoRes, stmtsRes, ordiniRes, rekkiAnom]) => {
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
  }, [fornitoreId, year, month, reloadEpoch])

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
        <svg className={`${c.iconClass} ${c.iconDropShadow}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <svg className={`${b.iconClass} ${b.iconDropShadow}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <svg className={`${f.iconClass} ${f.iconDropShadow}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <svg className={`${v.iconClass} ${v.iconDropShadow}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <svg className={`${l.iconClass} ${l.iconDropShadow}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h10M4 18h10" />
        </svg>
      ),
      sub:
        (stats?.rekkiPriceAnomalies ?? 0) > 0
          ? t.fornitori.subListinoPriceAnomalies.replace('{n}', String(stats?.rekkiPriceAnomalies ?? 0))
          : (stats?.listinoRows ?? 0) === 0
            ? t.fornitori.subListinoPeriodoVuoto
            : t.fornitori.subListinoProdottiEAggiornamenti
                .replace('{p}', String(stats?.listinoProdottiDistinti ?? 0))
                .replace('{u}', String(stats?.listinoRows ?? 0)),
      subColor:
        (stats?.rekkiPriceAnomalies ?? 0) > 0
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
        <svg className={`${d.iconClass} ${d.iconDropShadow}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
}: {
  loading: boolean
  stats: SupplierPeriodStats | null
  onTabChange: (tab: Tab) => void
}) {
  const t = useT()
  const { locale, currency } = useLocale()
  const formatMoney = useCallback(
    (amount: number) => formatCurrency(amount, currency, locale),
    [currency, locale],
  )
  const displayStats = stats ?? EMPTY_SUPPLIER_PERIOD_STATS
  const kpis = useMemo(() => buildSupplierKpiItems(displayStats, t, formatMoney), [displayStats, t, formatMoney])
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
          className="supplier-desktop-kpi-card group relative flex h-full min-h-[104px] flex-col cursor-pointer overflow-hidden text-left transition-[transform,box-shadow] duration-200 hover:shadow-[0_16px_48px_-12px_rgba(var(--supplier-kpi-rgb),0.32)] active:scale-[0.98] md:min-h-[148px]"
          style={{
            boxShadow: supplierDesktopKpiOuterShadow(k.accentHex),
            ['--supplier-kpi-rgb' as string]: hexToRgbTuple(k.accentHex),
          }}
        >
          <KpiLAccentOverlay accentHex={k.accentHex} edgePx={4} />
          <div className="relative z-[1] flex min-h-0 flex-1 flex-col p-2 md:p-3">
            <div
              className={`flex min-h-0 shrink-0 items-center justify-between gap-1.5 pb-1.5 md:min-h-[2.5rem] md:gap-2 md:pb-2 ${k.headerRule}`}
            >
              <p className="min-w-0 flex-1 pr-0.5 text-left text-[9px] font-semibold uppercase leading-tight tracking-wide text-app-fg-muted line-clamp-2 md:pr-1 md:text-[11px] md:leading-snug md:tracking-wider">
                {k.label}
              </p>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center md:h-8 md:w-8 [&>svg]:h-[1.05rem] [&>svg]:w-[1.05rem] [&>svg]:shrink-0 md:[&>svg]:h-[1.2rem] md:[&>svg]:w-[1.2rem]">
                {k.icon}
              </span>
            </div>
            {/* Stessa struttura su tutte le tile: sottotitolo in slot ad altezza fissa → i valori numerici/cifre si allineano in riga */}
            <div className="flex min-h-0 flex-1 flex-col justify-end gap-1 pt-0.5 md:gap-1 md:pt-1.5">
              <div className="flex min-h-[2.35rem] shrink-0 flex-col justify-end md:min-h-[2.85rem]">
                <p
                  className={`line-clamp-2 text-left text-[9px] font-medium leading-tight md:text-[11px] md:leading-snug ${k.subColor}`}
                >
                  {k.sub}
                </p>
              </div>
              <div className="flex shrink-0 items-end justify-between gap-1">
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate text-base font-bold tabular-nums leading-none tracking-tight text-app-fg md:text-xl">
                    {k.value}
                  </p>
                  {k.valueSupplement ? (
                    <p className="mt-0.5 truncate text-[9px] font-medium leading-tight text-app-fg-muted md:text-[10px]">
                      {k.valueSupplement}
                    </p>
                  ) : null}
                </div>
                <svg
                  className={`mb-0.5 h-3 w-3 shrink-0 self-end transition-colors md:mb-0.5 md:h-3.5 md:w-3.5 ${k.chevronClass} ${k.chevronHoverClass}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M9 5l7 7-7 7" />
                </svg>
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
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
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
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
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
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
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
          <thead>
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
  onFornitoreReload,
  readOnly,
}: {
  fornitoreId: string
  fornitore: Fornitore
  onFornitoreReload?: () => void
  readOnly?: boolean
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const t = useT()
  const { locale, timezone } = useLocale()

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

  return (
    <div className="space-y-6">
      {/* Mobile: stesse azioni che prima erano nella bottom bar fissa, sotto i KPI */}
      {!readOnly ? (
      <div className="md:hidden">
        <Link
          href={`/bolle/new?fornitore_id=${fornitoreId}`}
          className={`app-glow-cyan flex min-h-[44px] min-w-0 touch-manipulation items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-white transition-colors active:scale-[0.99] ${
            nuovaBollaActive
              ? 'bg-cyan-600 ring-2 ring-white/30 ring-offset-2 ring-offset-[rgb(15_23_42)]'
              : 'bg-app-cyan-500 hover:bg-cyan-600 active:bg-cyan-700'
          }`}
          aria-current={nuovaBollaActive ? 'page' : undefined}
        >
          <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="truncate">{t.nav.nuovaBolla}</span>
        </Link>
      </div>
      ) : null}

      {/* Desktop md+: tre colonne stessa altezza (stretch + scroll interno); senza contatti → 2 colonne. */}
      <div
        className={`grid grid-cols-1 gap-6 md:grid md:items-stretch md:gap-4 ${contattiError ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}
      >
      {/* ── Contacts section ── */}
      {!contattiError && (
        <div className="flex min-h-0 min-w-0 flex-col md:h-full md:min-h-[18rem]">
        <div className={`supplier-detail-tab-shell flex h-full min-h-0 flex-1 flex-col overflow-hidden ${SUPPLIER_DETAIL_TAB_HIGHLIGHT.dashboard.border}`}>
          <div className={`app-card-bar-accent ${SUPPLIER_DETAIL_TAB_HIGHLIGHT.dashboard.bar}`} aria-hidden />
          <div className="flex shrink-0 items-center justify-between border-b border-app-line-22 px-4 py-2.5 md:px-5 md:py-3">
            <div className="flex items-center gap-2">
              <svg className="h-3.5 w-3.5 text-app-fg-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              <p className="text-xs font-semibold uppercase tracking-wide text-app-fg-muted">{t.appStrings.contactsHeading}</p>
              {contatti.length > 0 && (
                <span className="rounded-full border border-app-soft-border app-workspace-inset-bg px-2 py-0.5 text-[10px] font-medium text-app-fg-muted">
                  {contatti.length}
                </span>
              )}
            </div>
            {!readOnly ? (
            <button onClick={openAdd}
              className="flex items-center gap-1 px-2.5 py-1 bg-app-cyan-500 hover:bg-app-cyan-400 text-white text-[11px] font-bold rounded-lg transition-colors">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
              {t.common.add}
            </button>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
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
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                      </a>
                    )}
                    {c.email && (
                      <a href={`mailto:${c.email}`} title={c.email}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-app-cyan-500 transition-colors hover:bg-app-line-15">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      </a>
                    )}
                    {!readOnly ? (
                    <button onClick={() => openEdit(c)} title={t.common.edit}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-app-fg-muted opacity-0 transition-colors hover:bg-app-line-12 hover:text-app-fg group-hover:opacity-100">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                    ) : null}
                    {!readOnly ? (
                    <button onClick={() => handleDeleteContatto(c.id)} disabled={deletingId === c.id} title={t.appStrings.contactRemove}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-app-fg-muted opacity-0 transition-colors hover:bg-red-950/50 hover:text-red-400 group-hover:opacity-100 disabled:opacity-40">
                      {deletingId === c.id
                        ? <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                        : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
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
      <div className={`supplier-detail-tab-shell flex h-full min-h-0 flex-1 flex-col overflow-hidden ${SUPPLIER_DETAIL_TAB_HIGHLIGHT.dashboard.border}`}>
        <div className={`app-card-bar-accent ${SUPPLIER_DETAIL_TAB_HIGHLIGHT.dashboard.bar}`} aria-hidden />
        <div className="flex shrink-0 items-center gap-2 border-b border-app-line-22 px-5 py-3">
          <svg className="h-3.5 w-3.5 text-app-fg-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
          <p className="text-xs font-semibold uppercase tracking-wide text-app-fg-muted">{t.appStrings.infoSupplierCard}</p>
        </div>
        <div className={`flex min-h-0 flex-1 flex-col overflow-y-auto ${APP_SECTION_DIVIDE_ROWS}`}>

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

      <div className="flex min-h-0 min-w-0 flex-col md:h-full md:min-h-[18rem]">
      <RekkiSupplierIntegration
        fornitoreId={fornitoreId}
        piva={fornitore.piva}
        supplierDisplayName={fornitore.nome}
        initialRekkiId={fornitore.rekki_supplier_id}
        initialRekkiLink={fornitore.rekki_link}
        onSaved={onFornitoreReload}
        className="h-full min-h-0 w-full"
        compactFields
        readOnly={readOnly}
      />
      </div>
      </div>

    </div>
  )
}

function attachmentKindPillClass(kind: AttachmentKind): string {
  const base = 'inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold tabular-nums'
  if (kind === 'pdf') return `${base} border-app-line-35 bg-app-line-10 text-app-fg-muted`
  if (kind === 'image') return `${base} border-violet-500/35 bg-violet-500/10 text-violet-200`
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

/** Pill elimina compatto, allineato al cyan in tabella bolle fornitore. */
const FORNITORE_TABLE_DELETE_PILL =
  'inline-flex items-center gap-1 rounded-lg border border-red-500/50 bg-red-950/40 px-2 py-1 text-[10px] font-semibold text-red-200 shadow-sm ring-1 ring-inset ring-red-400/10 transition-colors hover:border-red-400/65 hover:bg-red-600/20 hover:text-red-50'

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
  year,
  month,
  pathname,
  searchParams,
  readOnly,
  onLedgerMutated,
  currency,
}: {
  fornitoreId: string
  year: number
  month: number
  pathname: string
  searchParams: ReadonlyURLSearchParams
  readOnly?: boolean
  onLedgerMutated?: () => void
  currency: string
}) {
  const router = useRouter()
  const t = useT()
  const { locale } = useLocale()
  const formatDate = useAppFormatDate()
  const [bolle, setBolle] = useState<Bolla[]>([])
  const [numeroDaCodaByFileUrl, setNumeroDaCodaByFileUrl] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const from = `${year}-${String(month).padStart(2, '0')}-01`
    const to = new Date(year, month, 1).toISOString().split('T')[0]
    const supabase = createClient()
    void (async () => {
      const { data } = await supabase
        .from('bolle')
        .select('id, data, stato, file_url, numero_bolla, importo')
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
  }, [fornitoreId, year, month])

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
      <div className={`supplier-detail-tab-shell overflow-hidden ${SUPPLIER_DETAIL_TAB_HIGHLIGHT.bolle.border}`}>
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
      <div className={`supplier-detail-tab-shell overflow-hidden ${SUPPLIER_DETAIL_TAB_HIGHLIGHT.bolle.border}`}>
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
            <ActionLink href={`/bolle/new?fornitore_id=${fornitoreId}`} intent="confirm" size="sm" className="mt-4">
              {t.bolle.creaLaPrimaBolla}
            </ActionLink>
          ) : null}
        </AppSectionEmptyState>
      </div>
    )
  }

  return (
    <div className={`supplier-detail-tab-shell flex flex-col overflow-hidden ${SUPPLIER_DETAIL_TAB_HIGHLIGHT.bolle.border}`}>
      <div className={`app-card-bar-accent ${SUPPLIER_DETAIL_TAB_HIGHLIGHT.bolle.bar}`} aria-hidden />
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
                <span className="inline-flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/15 px-2 py-0.5 text-[11px] font-semibold text-green-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400" /> {t.bolle.statoCompletato}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> {t.bolle.statoInAttesa}
                </span>
              )}
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
          <thead>
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
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-green-500/30 bg-green-500/15 px-2 py-0.5 text-[11px] font-semibold text-green-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-400" /> {t.bolle.statoCompletato}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> {t.bolle.statoInAttesa}
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                    {b.file_url && (
                      <OpenDocumentInAppButton
                        bollaId={b.id}
                        fileUrl={b.file_url}
                        stopTriggerPropagation
                        className={FORNITORE_TABLE_CYAN_ACTION_PILL}
                        title={attachmentOpenFileLinkLabel(fileKind, t)}
                      >
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                        {attachmentOpenFileLinkLabel(fileKind, t)}
                      </OpenDocumentInAppButton>
                    )}
                    {!readOnly ? (
                    <DeleteButton
                      id={b.id}
                      table="bolle"
                      confirmMessage={t.bolle.deleteConfirm}
                      className={FORNITORE_TABLE_DELETE_PILL}
                      iconClassName="h-3 w-3"
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
  year,
  month,
  pathname,
  searchParams,
  readOnly,
  onLedgerMutated,
  currency,
}: {
  fornitoreId: string
  year: number
  month: number
  pathname: string
  searchParams: ReadonlyURLSearchParams
  readOnly?: boolean
  onLedgerMutated?: () => void
  currency: string
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

  useEffect(() => {
    setLoading(true)
    const from = `${year}-${String(month).padStart(2, '0')}-01`
    const to = new Date(year, month, 1).toISOString().split('T')[0]
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
  }, [fornitoreId, year, month])

  const onDuplicateRemoved = useCallback(
    (removedId: string) => {
      setFatture((prev) => prev.filter((x) => x.id !== removedId))
      onLedgerMutated?.()
    },
    [onLedgerMutated],
  )

  if (loading) {
    return (
      <div className={`supplier-detail-tab-shell overflow-hidden ${SUPPLIER_DETAIL_TAB_HIGHLIGHT.fatture.border}`}>
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
    return (
      <div className={`supplier-detail-tab-shell overflow-hidden ${SUPPLIER_DETAIL_TAB_HIGHLIGHT.fatture.border}`}>
        <div className={`app-card-bar-accent ${SUPPLIER_DETAIL_TAB_HIGHLIGHT.fatture.bar}`} aria-hidden />
        <AppSectionEmptyState message={t.fatture.nessunaFatturaRegistrata}>
          {!readOnly ? (
            <ActionLink
              href={`/fatture/new?fornitore_id=${encodeURIComponent(fornitoreId)}`}
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
    <div
      className={`supplier-detail-tab-shell flex flex-col overflow-hidden ${SUPPLIER_DETAIL_TAB_HIGHLIGHT.fatture.border}`}
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
            <thead>
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
                    <td className="px-5 py-3 font-medium text-app-fg-muted">{formatDate(f.data)}</td>
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
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
  )
}

/* ─── Listino / Storico Prezzi tab ───────────────────────────────── */

interface ListinoProdotto {
  id: string
  prodotto: string
  prezzo: number
  data_prezzo: string
  note: string | null
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
  countryCode,
  currency,
  readOnly,
}: {
  fornitoreId: string
  fornitoreNome: string
  rekkiLinked: boolean
  countryCode: string
  currency?: string
  readOnly?: boolean
}) {
  const { me } = useMe()
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
  const [saving, setSaving]           = useState(false)
  const [saveError, setSaveError]     = useState<string | null>(null)
  const [deletingId, setDeletingId]   = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Import from fattura state
  type ImportItem = {
    prodotto: string
    codice_prodotto: string | null
    prezzo: number
    unita: string | null
    note: string | null
    selected: boolean
    /** Admin: consenti insert se la data documento è precedente all’ultimo `data_prezzo` per questo nome prodotto. */
    forceOutdated?: boolean
    // Price comparison
    prezzoAttuale: number | null    // last known price from listino
    matchedProdotto: string | null  // name as stored in listino (may differ)
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
  const [importLoading, setImportLoading] = useState(false)
  const [importError, setImportError]     = useState<string | null>(null)
  const [importItems, setImportItems]     = useState<ImportItem[]>([])
  const [importDate, setImportDate]       = useState(new Date().toISOString().split('T')[0])
  const [importSaving, setImportSaving]   = useState(false)
  const [formForceOutdated, setFormForceOutdated] = useState(false)

  const loadListino = async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('listino_prezzi')
      .select('id, prodotto, prezzo, data_prezzo, note')
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

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('bolle').select('id, data, numero_bolla, importo')
        .eq('fornitore_id', fornitoreId).not('importo', 'is', null).order('data'),
      supabase.from('fatture').select('id, data, numero_fattura, importo')
        .eq('fornitore_id', fornitoreId).not('importo', 'is', null).order('data'),
      supabase.from('listino_prezzi').select('id, prodotto, prezzo, data_prezzo, note')
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
    listinoData: ListinoProdotto[]
  ): { prezzoAttuale: number; matchedProdotto: string } | null => {
    if (listinoData.length === 0) return null
    // Group by product name and get the latest price for each
    const latestByProduct: Record<string, { prezzo: number; prodotto: string }> = {}
    for (const row of listinoData) {
      const existing = latestByProduct[row.prodotto]
      if (!existing || row.data_prezzo > (listinoData.find(r => r.prodotto === row.prodotto && r.id === existing.prodotto)?.data_prezzo ?? '')) {
        latestByProduct[row.prodotto] = { prezzo: row.prezzo, prodotto: row.prodotto }
      }
    }
    // Collect latest price for each product (last entry since ordered by data_prezzo)
    const products = Object.values(latestByProduct)

    let bestMatch: { prezzoAttuale: number; matchedProdotto: string } | null = null
    let bestScore = 0.3 // minimum threshold

    for (const p of products) {
      const score = wordSimilarity(prodotto, p.prodotto)
      if (score > bestScore) {
        bestScore = score
        bestMatch = { prezzoAttuale: p.prezzo, matchedProdotto: p.prodotto }
      }
    }
    return bestMatch
  }

  const enrichWithComparison = (
    items: Omit<ImportItem, 'prezzoAttuale' | 'matchedProdotto' | 'delta' | 'isNew'>[],
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
      const match = findBestListinoMatch(item.prodotto, listinoData)
      const prezzoAttuale = match ? latestByProduct[match.matchedProdotto]?.prezzo ?? null : null
      const delta = prezzoAttuale != null && prezzoAttuale > 0
        ? ((item.prezzo - prezzoAttuale) / prezzoAttuale) * 100
        : null
      return {
        ...item,
        forceOutdated: false,
        prezzoAttuale,
        matchedProdotto: match?.matchedProdotto ?? null,
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
        setImportItems(enriched)
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err))
    } finally {
      setImportLoading(false)
    }
  }

  const listinoImportAdmin = Boolean(me?.is_admin || me?.is_admin_sede)
  const importRowDateBlocked = (prodotto: string) => {
    const latest = maxListinoDateForExactProduct(listino, prodotto)
    return latest != null && !isDocumentDateAtLeastLatestListino(importDate, latest)
  }

  const handleImportSave = async () => {
    const toSave = importItems.filter(i => i.selected && i.prodotto && i.prezzo > 0)
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
    if (manualBlocked && formForceOutdated && !listinoImportAdmin) {
      setSaveError(t.appStrings.listinoManualDateBlockedNoAdmin)
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
      <div className={`supplier-detail-tab-shell overflow-hidden ${SUPPLIER_DETAIL_TAB_HIGHLIGHT.listino.border}`}>
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

  const totale    = rows.reduce((s, r) => s + (r.importo ?? 0), 0)
  const totBolle  = rows.filter(r => r.tipo === 'bolla').reduce((s, r) => s + (r.importo ?? 0), 0)
  const totFatture = rows.filter(r => r.tipo === 'fattura').reduce((s, r) => s + (r.importo ?? 0), 0)

  return (
    <div className="space-y-5">

      {/* ── Listino Prodotti (se la tabella esiste) ── */}
      {listTabloExists === false ? (
        /* Setup card — compact 2-step flow */
        <div className="supplier-detail-tab-shell overflow-hidden border-amber-500/25">
          <div className={`app-card-bar-accent ${SUPPLIER_DETAIL_TAB_HIGHLIGHT.documenti.bar}`} aria-hidden />
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
                  ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/35'
                  : 'bg-amber-500/25 text-amber-100 border-amber-500/40 hover:bg-amber-500/35'
              }`}
            >
              {copied ? (
                <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>{t.fornitori.listinoCopied}</>
              ) : (
                <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>{t.fornitori.listinoCopySQL}</>
              )}
            </button>
            ) : null}
          </div>
          {!readOnly ? (
          <details className="border-t border-amber-500/20">
            <summary className="px-5 py-2 text-[11px] text-amber-300/90 cursor-pointer hover:bg-amber-500/10 select-none">
              {t.fornitori.listinoSetupShowSQL}
            </summary>
            <pre className="text-[10px] text-amber-100/90 app-workspace-inset-bg-soft px-5 py-3 overflow-x-auto whitespace-pre font-mono border-t border-amber-500/15">
              {MIGRATION_SQL}
            </pre>
          </details>
          ) : null}
        </div>
      ) : listTabloExists === true ? (
        /* Listino prodotti — with add form */
        <div className={`supplier-detail-tab-shell overflow-hidden ${SUPPLIER_DETAIL_TAB_HIGHLIGHT.listino.border}`}>
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
              <button
                onClick={openImport}
                className="flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1 text-[11px] font-bold text-white transition-colors hover:bg-violet-500"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
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
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                {t.common.add}
              </button>
              </>
              ) : null}
            </div>
          </div>

          {deleteError && (
            <div className="border-b border-red-500/25 bg-red-500/10 px-5 py-2 text-xs text-red-200">{deleteError}</div>
          )}

          {/* Import from invoice panel */}
          {showImport && !readOnly && (
            <div className="border-b border-violet-500/25 bg-violet-500/10 px-5 py-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold text-violet-200">{t.appStrings.listinoImportPanelTitle}</p>
                <button type="button" onClick={() => setShowImport(false)} className="text-violet-400/80 transition-colors hover:text-violet-200">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
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
                                ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100'
                                : 'border-app-line-22 app-workspace-inset-bg-soft text-app-fg-muted opacity-[0.88]'
                            }`}
                          >
                            <span className={`min-w-0 flex-1 truncate font-medium ${sel.analizzata ? 'text-emerald-50' : 'text-app-fg'}`}>
                              {sel.label}
                            </span>
                            {sel.analizzata ? (
                              <span className="shrink-0 rounded-full border border-emerald-500/40 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-200">
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
                        <><svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>{t.appStrings.listinoAnalyzing}</>
                      ) : (
                        <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>{t.appStrings.listinoAnalyze}</>
                      )}
                    </button>
                  </div>

                  {importError && (
                    <div className="mb-3 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                      <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
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
                                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7"/></svg>
                                {rincari.length} rincaro{rincari.length > 1 ? 'i' : ''}
                              </span>
                            )}
                            {ribassi.length > 0 && (
                              <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold text-emerald-300">
                                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7"/></svg>
                                {ribassi.length} ribasso{ribassi.length > 1 ? 'i' : ''}
                              </span>
                            )}
                            {nuovi.length > 0 && (
                              <span className="flex items-center gap-1 rounded-full bg-app-line-15 px-2.5 py-1 text-[10px] font-bold text-app-fg-muted">
                                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                                {nuovi.length} nuovo{nuovi.length > 1 ? 'i' : ''}
                              </span>
                            )}
                            <span className="text-[10px] text-app-fg-muted">rispetto all&apos;ultimo listino registrato</span>
                          </div>
                        )
                      })()}

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
                              const rowBg = isRincaro ? 'bg-red-500/10' : isRibasso ? 'bg-emerald-500/10' : item.isNew ? 'bg-app-line-10' : ''
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
                                    </div>
                                  </td>
                                  <td className="px-3 py-2.5 text-right tabular-nums text-app-fg-muted">
                                    {item.prezzoAttuale != null ? `£${item.prezzoAttuale.toFixed(2)}` : <span className="text-app-fg-muted">—</span>}
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
                                        <>
                                          <p className="text-[9px] leading-snug text-amber-200/85">
                                            {t.appStrings.listinoImportDateOlderThanListinoHint}
                                          </p>
                                          {listinoImportAdmin ? (
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
                                              className={`w-fit rounded-md border px-2 py-1 text-[9px] font-bold uppercase tracking-wide transition-colors ${
                                                item.forceOutdated
                                                  ? 'border-emerald-500/45 bg-emerald-950/40 text-emerald-100'
                                                  : 'border-amber-500/40 bg-amber-950/35 text-amber-100 hover:border-amber-400/55'
                                              }`}
                                            >
                                              {item.forceOutdated
                                                ? t.appStrings.listinoImportApplyOutdatedAdminActive
                                                : t.appStrings.listinoImportApplyOutdatedAdmin}
                                            </button>
                                          ) : null}
                                        </>
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
                          {listinoImportAdmin
                            ? t.appStrings.listinoImportSaveBlockedHintAdmin
                            : t.appStrings.listinoImportSaveBlockedHintOperator}
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
                  <div className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-100/95">
                    <p>{t.appStrings.listinoManualDateBlockedHint}</p>
                    {listinoImportAdmin ? (
                      <label className="mt-2 flex cursor-pointer items-center gap-2 font-medium">
                        <input
                          type="checkbox"
                          checked={formForceOutdated}
                          onChange={(e) => setFormForceOutdated(e.target.checked)}
                          className="h-3.5 w-3.5 accent-amber-400"
                        />
                        {t.appStrings.listinoImportApplyOutdatedAdmin}
                      </label>
                    ) : null}
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
                className="mt-3 rounded-lg border border-app-line-28 bg-app-line-10 px-3 py-1.5 text-xs font-semibold text-app-fg transition-colors hover:border-violet-500/40 hover:text-violet-200"
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
                    <div className="grid grid-cols-1 gap-4 px-4 py-4 sm:px-5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(11rem,auto)] md:items-start md:gap-5 md:py-4 md:pl-4 md:pr-5">
                      <div className="min-w-0 md:pr-2">
                        <h3 className="text-lg font-bold leading-tight tracking-tight text-app-fg sm:text-xl md:text-2xl">
                          {prodotto}
                        </h3>
                        {parsed.codice || parsed.unita ? (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {parsed.codice ? (
                              <StatusBadge
                                tone="orange"
                                className="!px-2 !py-0 !text-[9px] !font-semibold !normal-case !tracking-normal !shadow-none font-mono"
                              >
                                {parsed.codice}
                              </StatusBadge>
                            ) : null}
                            {parsed.unita ? (
                              <StatusBadge
                                tone="orange"
                                className="!px-2 !py-0 !text-[9px] !font-semibold !normal-case !tracking-normal !shadow-none"
                              >
                                {parsed.unita}
                              </StatusBadge>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      <div className="min-w-0 flex flex-col gap-1.5 border-t border-app-line-22/90 pt-3 text-app-fg-muted md:border-t-0 md:pt-0">
                        {summaryLine ? (
                          <p className="text-xs leading-relaxed">
                            <span className="text-[11px] text-app-fg-muted">{summaryLine}</span>
                            <span className="mt-0.5 block text-[10px] leading-snug text-app-fg-muted/80">
                              {t.fornitori.listinoVsReferenceHint}
                            </span>
                          </p>
                        ) : null}
                        {originLine ? (
                          <p className="text-[11px] leading-snug text-violet-300/75">{originLine}</p>
                        ) : null}
                        <p className="text-[10px] leading-snug text-app-fg-muted/90">
                          <span className="font-medium text-app-fg-muted/95">{t.fornitori.listinoColData}:</span>{' '}
                          {formatDateLib(ultimo.data_prezzo, locale, timezone, {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                          {sorted.length > 1 ? (
                            <span className="ml-1 opacity-75">
                              · {t.fornitori.listinoHistoryDepth.replace('{n}', String(sorted.length - 1))}
                            </span>
                          ) : null}
                        </p>
                        {noteDisplay ? (
                          <p className="text-[10px] leading-relaxed text-app-fg-muted/80">{noteDisplay}</p>
                        ) : null}
                      </div>

                      <div className="flex min-w-0 flex-col gap-3 border-t border-app-line-22/90 pt-3 md:items-end md:border-t-0 md:border-l md:border-app-line-22/70 md:pl-5 md:pt-0">
                        <p
                          className={`text-right text-2xl font-bold tabular-nums tracking-tight md:text-[1.65rem] font-mono ${
                            hasAnomaly
                              ? APP_SECTION_AMOUNT_NEGATIVE_CLASS
                              : listinoPriceStale
                                ? 'text-app-fg-muted/75'
                                : 'text-app-fg'
                          }`}
                        >
                          {fmtMoney(ultimo.prezzo)}
                        </p>
                        {listinoPriceStale ? (
                          <div className="text-right">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-app-fg-muted">
                              {t.fornitori.listinoPriceStaleBadge}
                            </p>
                            <p className="mt-0.5 text-[10px] leading-snug text-app-fg-muted/80">
                              {t.fornitori.listinoPriceStaleHint}
                            </p>
                          </div>
                        ) : null}
                        <div className="flex flex-wrap items-center justify-end gap-2">
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
                          {rekkiLinked ? (
                            <StatusBadge tone="violet" className="!normal-case !tracking-wide">
                              {t.fornitori.listinoRekkiListBadge}
                            </StatusBadge>
                          ) : null}
                        </div>
                        {!readOnly ? (
                          <div
                            className="mt-1 flex w-full flex-col items-stretch gap-2 md:items-end"
                            role="group"
                            aria-label={t.fornitori.listinoRowActionsLabel}
                          >
                            <Link
                              href={verificaHref}
                              className={`text-right text-[11px] font-semibold ${APP_SECTION_TRAILING_LINK_CLASS}`}
                              title={t.fornitori.listinoVerifyAnomaliesTitle}
                            >
                              {t.fornitori.listinoVerifyAnomalies}
                            </Link>
                            <div className="flex justify-end opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
                              <button
                                type="button"
                                onClick={() => handleDelete(ultimo.id)}
                                disabled={deletingId === ultimo.id}
                                title={t.common.delete}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-app-line-25 bg-app-line-10/80 text-app-fg-muted transition-colors hover:border-red-500/45 hover:bg-red-950/40 hover:text-red-300 disabled:opacity-40"
                              >
                                {deletingId === ultimo.id ? (
                                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden>
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                  </svg>
                                ) : (
                                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                )}
                              </button>
                            </div>
                          </div>
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
                cls: 'border-blue-500/30 bg-blue-500/10 text-blue-200',
                bar: SUPPLIER_DETAIL_TAB_HIGHLIGHT.bolle.bar,
                aria: t.fornitori.listinoKpiAriaBolle,
              },
              {
                key: 'fatture' as const,
                label: t.fornitori.listinoDaFatture,
                value: totFatture,
                cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
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
      )}

      {/* ── Storico cronologico documenti ── */}
      {rows.length === 0 ? (
        <div className={`supplier-detail-tab-shell flex flex-col overflow-hidden text-center ${SUPPLIER_DETAIL_TAB_HIGHLIGHT.listino.border}`}>
          <div className={`app-card-bar-accent shrink-0 ${SUPPLIER_DETAIL_TAB_HIGHLIGHT.listino.bar}`} aria-hidden />
          <div className="px-6 py-16">
          <svg className="mx-auto mb-3 h-12 w-12 text-app-fg-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-sm font-medium text-app-fg-muted">{t.fornitori.listinoNoDocs}</p>
          </div>
        </div>
      ) : (
        <div className={`supplier-detail-tab-shell overflow-hidden ${SUPPLIER_DETAIL_TAB_HIGHLIGHT.listino.border}`}>
          <div className={`app-card-bar-accent ${SUPPLIER_DETAIL_TAB_HIGHLIGHT.listino.bar}`} aria-hidden />
          <div className="flex items-center justify-between border-b border-app-line-22 px-5 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-app-fg-muted">{t.fornitori.listinoStorico}</p>
            <p className="text-xs text-app-fg-muted">{rows.length} {t.fornitori.listinoDocs}</p>
          </div>

          {/* Mobile */}
          <div className={APP_SECTION_MOBILE_LIST}>
            {rows.map((r) => (
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
                  <span className="text-sm font-bold tabular-nums text-app-fg">£{(r.importo ?? 0).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop */}
          <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className={APP_SECTION_TABLE_HEAD_ROW}>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-app-fg-muted">{t.fornitori.listinoColData}</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-app-fg-muted">{t.fornitori.listinoColTipo}</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-app-fg-muted">{t.fornitori.listinoColNumero}</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-app-fg-muted">{t.fornitori.listinoColImporto}</th>
              </tr>
            </thead>
            <tbody className={APP_SECTION_TABLE_TBODY}>
              {rows.map((r) => (
                <tr key={`${r.tipo}-${r.id}`} className={APP_SECTION_TABLE_TR}>
                  <td className="px-5 py-3.5 font-medium text-app-fg-muted">{formatDate(r.data)}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                      r.tipo === 'fattura'
                        ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                        : 'border-blue-500/25 bg-blue-500/10 text-blue-300'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${r.tipo === 'fattura' ? 'bg-emerald-400' : 'bg-blue-400'}`} />
                      {r.tipo === 'fattura' ? t.fatture.title : t.bolle.title}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-app-fg-muted">{r.numero ?? '—'}</td>
                  <td className="px-5 py-3.5 text-right text-base font-bold tabular-nums text-app-fg">£{(r.importo ?? 0).toFixed(2)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-app-line-22 app-workspace-inset-bg-soft">
                <td colSpan={3} className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-app-fg-muted">{t.fornitori.listinoColTotale}</td>
                <td className="px-5 py-3 text-right text-base font-bold tabular-nums text-app-fg">£{totale.toFixed(2)}</td>
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
      p === 'verifica'
    ) {
      return p
    }
    return 'dashboard'
  }, [tabParam])

  const supplierReadOnlyMobile = useMobileSupplierReadOnly()
  const mdUp = useMinMdViewport()
  const displayTab = useMemo((): Tab => {
    if (supplierReadOnlyMobile && (tab === 'documenti' || tab === 'verifica')) return 'dashboard'
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
    if (tab !== 'documenti' && tab !== 'verifica') return
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
  // ── Shared month/year filter ───────────────────────────────────────
  const now = new Date()
  const [filterYear,  setFilterYear]  = useState(now.getFullYear())
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1)

  /** Periodo solo per il riepilogo mensile in card: frecce anno qui non muovono il navigatore in header. */
  const [monthlySummaryPeriod, setMonthlySummaryPeriod] = useState(() => ({
    y: now.getFullYear(),
    m: now.getMonth() + 1,
  }))

  const shiftMonth = (delta: number) => {
    setFilterMonth(prev => {
      const newMonth = prev + delta
      if (newMonth < 1)  { setFilterYear(y => y - 1); return 12 }
      if (newMonth > 12) { setFilterYear(y => y + 1); return 1  }
      return newMonth
    })
  }

  const nowY = now.getFullYear()
  const nowM = now.getMonth() + 1
  const clampSupplierPeriod = (y: number, m: number) => {
    if (y > nowY || (y === nowY && m > nowM)) return { y: nowY, m: nowM }
    return { y, m }
  }

  useEffect(() => {
    setMonthlySummaryPeriod({ y: filterYear, m: filterMonth })
  }, [filterYear, filterMonth])

  const shiftMonthlySummaryYear = (delta: number) => {
    setMonthlySummaryPeriod((prev) => clampSupplierPeriod(prev.y + delta, prev.m))
  }

  const nextMonthlySummaryYearPeriod = clampSupplierPeriod(monthlySummaryPeriod.y + 1, monthlySummaryPeriod.m)
  const canShiftMonthlySummaryYearForward =
    nextMonthlySummaryYearPeriod.y !== monthlySummaryPeriod.y ||
    nextMonthlySummaryYearPeriod.m !== monthlySummaryPeriod.m

  const isMonthlySummaryAtCurrentMonth =
    monthlySummaryPeriod.y === nowY && monthlySummaryPeriod.m === nowM

  const shiftYear = (delta: number) => {
    const next = clampSupplierPeriod(filterYear + delta, filterMonth)
    setFilterYear(next.y)
    setFilterMonth(next.m)
  }

  const nextYearPeriod = clampSupplierPeriod(filterYear + 1, filterMonth)
  const canShiftYearForward =
    nextYearPeriod.y !== filterYear || nextYearPeriod.m !== filterMonth

  const monthYearLabel = formatDateLib(
    `${filterYear}-${String(filterMonth).padStart(2, '0')}-15`,
    locale,
    timezone,
    { month: 'short', year: 'numeric' }
  )
  const isCurrentMonth = filterYear === now.getFullYear() && filterMonth === now.getMonth() + 1

  const [periodLedgerEpoch, setPeriodLedgerEpoch] = useState(0)
  const bumpPeriodLedger = useCallback(() => {
    setPeriodLedgerEpoch((n) => n + 1)
    reloadFornitore?.()
  }, [reloadFornitore])

  const { stats: periodStats, loading: periodStatsLoading } = useSupplierPeriodStats(
    fornitore.id,
    filterYear,
    filterMonth,
    periodLedgerEpoch,
  )

  const ordiniCount = periodStats?.ordiniNelPeriodo ?? 0
  const tabs: { id: Tab; label: string; badge?: number }[] = useMemo(() => {
    const all: { id: Tab; label: string; badge?: number }[] = [
      { id: 'dashboard', label: t.fornitori.tabRiepilogo },
      { id: 'conferme', label: t.fornitori.kpiOrdini, badge: ordiniCount > 0 ? ordiniCount : undefined },
      { id: 'bolle', label: t.nav.bolle, badge: bolleCount },
      { id: 'fatture', label: t.nav.fatture, badge: fattureCount },
      { id: 'verifica', label: t.statements.tabVerifica },
      { id: 'listino', label: t.fornitori.tabListino },
      { id: 'documenti', label: t.statements.tabDocumenti, badge: pendingCount > 0 ? pendingCount : undefined },
    ]
    if (supplierReadOnlyMobile) {
      return all.filter((tb) => tb.id !== 'documenti' && tb.id !== 'verifica')
    }
    return all
  }, [t, ordiniCount, bolleCount, fattureCount, pendingCount, supplierReadOnlyMobile])

  const TabContent = ({ variant }: { variant: 'mobile' | 'desktop' }) => (
    <>
      {displayTab === 'dashboard' && (
        <DashboardTab
          fornitoreId={fornitore.id}
          fornitore={fornitore}
          onFornitoreReload={reloadFornitore}
          readOnly={supplierReadOnlyMobile}
        />
      )}
      {displayTab === 'bolle' && (
        <BolleTab
          fornitoreId={fornitore.id}
          year={filterYear}
          month={filterMonth}
          pathname={pathname}
          searchParams={searchParams}
          readOnly={supplierReadOnlyMobile}
          onLedgerMutated={bumpPeriodLedger}
          currency={currency ?? 'GBP'}
        />
      )}
      {displayTab === 'fatture' && (
        <FattureTab
          fornitoreId={fornitore.id}
          year={filterYear}
          month={filterMonth}
          pathname={pathname}
          searchParams={searchParams}
          readOnly={supplierReadOnlyMobile}
          onLedgerMutated={bumpPeriodLedger}
          currency={currency ?? 'GBP'}
        />
      )}
      {displayTab === 'listino' && (
        <ListinoTab
          fornitoreId={fornitore.id}
          fornitoreNome={fornitore.nome}
          rekkiLinked={Boolean(
            String(fornitore.rekki_supplier_id ?? '').trim() || String(fornitore.rekki_link ?? '').trim()
          )}
          countryCode={countryCode}
          currency={currency}
          readOnly={supplierReadOnlyMobile}
        />
      )}
      {displayTab === 'conferme' && (
        <FornitoreConfermeOrdineTab
          fornitoreId={fornitore.id}
          sedeId={fornitore.sede_id ?? null}
          readOnly={supplierReadOnlyMobile}
        />
      )}
      {displayTab === 'documenti' && (
        <PendingMatchesTab
          sedeId={effectiveSedeId}
          fornitoreId={fornitore.id}
          countryCode={countryCode}
          currency={currency}
          year={filterYear}
          month={filterMonth}
          cardAccent="amber"
        />
      )}
      {displayTab === 'verifica' &&
        (variant === 'desktop' && mdUp ? (
          <VerificationStatusTab
            sedeId={effectiveSedeId}
            fornitoreId={fornitore.id}
            countryCode={countryCode}
            currency={currency}
            year={filterYear}
            month={filterMonth}
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
            cardAccent="cyan"
          />
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
      />
      {/* ══ MOBILE (< md): padding basso gestito da AppShell (`showsMobileBottomBar`) ══ */}
      <div className="flex min-w-0 flex-col gap-4 px-4 pb-6 text-app-fg md:hidden">
        <div className={`supplier-detail-tab-shell mt-2 overflow-hidden ${SUPPLIER_DETAIL_TAB_HIGHLIGHT[displayTab].border}`}>
          <div className={`app-card-bar-accent ${SUPPLIER_DETAIL_TAB_HIGHLIGHT[displayTab].bar}`} aria-hidden />
          <div className="flex items-start gap-3 border-t border-app-line-10 bg-transparent px-3 py-2.5 text-app-fg">
            <FornitoreAvatar nome={fornitore.nome} logoUrl={fornitore.logo_url} sizeClass="h-11 w-11" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <h1 className="app-page-title text-sm font-semibold leading-snug">{fornitore.nome}</h1>
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
          <SupplierDesktopKpiGrid loading={periodStatsLoading} stats={periodStats} onTabChange={setTab} />
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

        <div className="fornitore-tab-panel min-w-0 scroll-mt-4 rounded-xl border border-app-line-15 bg-transparent p-3 outline-none sm:p-4">
          <TabContent variant="mobile" />
        </div>
      </div>

      {/* ══ DESKTOP layout (md+) ═════════════════════════════════════ */}
      <div className="hidden min-w-0 text-app-fg md:block">
        {/*
          Un solo `fornitore-desktop-main-x`: stesso canale orizzontale per header+tab e corpo (KPI / tabella / tab).
        */}
        <div
          className="fornitore-desktop-main-x mx-auto w-full max-w-[83rem]"
          role="region"
          aria-label={t.fornitori.supplierDesktopRegionAria}
        >
        {/* Intestazione + tab: sticky in `#app-main` così nome/sync/CTA e tab+mese restano visibili allo scroll. */}
        <div className="sticky top-0 z-20 w-full border-b border-app-soft-border app-workspace-inset-bg-soft pb-0.5 pt-1.5 shadow-[0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl [-webkit-backdrop-filter:blur(16px)]">
          {/*
            Sotto xl: identità, poi sync, poi CTA. Mese/anno nella fascia tab sotto.
            Da xl in su: identità | sync (verso destra) | CTA; mese/anno accanto alle tab.
          */}
          <div className="flex flex-col gap-1.5 px-2 py-1 sm:py-1.5 xl:flex-row xl:items-center xl:gap-2.5 xl:min-h-8 xl:px-2.5">
            <div className="flex min-w-0 items-start gap-2 xl:min-w-0 xl:max-w-[min(100%,40rem)] xl:shrink-0 xl:items-center">
              <FornitoreAvatar
                nome={fornitore.nome}
                logoUrl={fornitore.logo_url}
                sizeClass="h-8 w-8 xl:h-9 xl:w-9"
                className="mt-0.5 shrink-0 xl:mt-0"
              />

              <div className="min-w-0 flex-1 pr-1">
                <h1 className="app-page-title text-[12px] font-bold leading-tight text-app-fg break-words [overflow-wrap:anywhere] sm:text-[13px] xl:text-sm xl:leading-snug">
                  {fornitore.nome}
                </h1>
                {fornitore.email && (
                  <p className="mt-0.5 break-words text-[11px] leading-snug text-app-fg-muted [overflow-wrap:anywhere]">
                    {fornitore.email}
                  </p>
                )}
              </div>
            </div>

            <div className="flex min-w-0 w-full flex-wrap items-center gap-x-2 gap-y-1.5 xl:h-8 xl:min-w-0 xl:flex-1 xl:flex-nowrap xl:items-center xl:justify-end xl:gap-x-2.5">
            <div className="min-w-0 w-full xl:min-w-[12rem] xl:flex-1 xl:max-w-none">
              <ScanEmailButton
                variant="supplier"
                alwaysShowLabel
                fornitoreId={fornitore.id}
                sedeId={fornitore.sede_id ?? undefined}
                disabled={!fornitore.sede_id}
                disabledReasonTitle={!fornitore.sede_id ? t.fornitori.syncEmailNeedSede : undefined}
              />
            </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-1 max-xl:w-full max-xl:justify-end xl:ml-auto xl:h-8 xl:items-center">
              <Link
                href={`/bolle/new?fornitore_id=${fornitore.id}`}
                className="app-glow-cyan inline-flex h-6 shrink-0 items-center gap-1 rounded-md bg-app-cyan-500 px-2 text-[11px] font-bold leading-none text-cyan-950 transition-colors hover:bg-app-cyan-400 active:bg-cyan-600 xl:h-8 xl:gap-1.5 xl:px-2.5"
              >
                <svg className="h-3.5 w-3.5 xl:h-3.5 xl:w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {t.nav.nuovaBolla}
              </Link>
              <Link
                href={`/fornitori/${fornitore.id}/edit`}
                title={t.fornitori.editTitle}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-app-soft-border text-app-fg-muted transition-colors hover:bg-app-line-10 hover:text-app-fg xl:h-8 xl:w-8"
              >
                <svg className="h-3.5 w-3.5 xl:h-3.5 xl:w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </Link>
              <AppPageHeaderDesktopTray className="ms-1 xl:ms-2" />
            </div>
          </div>

          {/* Tab bar + navigatore mese: tab e mese ancorati in basso (self-end sul mese, stessa h delle tab) */}
          <div className="flex w-full min-w-0 items-stretch gap-2 border-t border-app-soft-border pt-0.5 pb-0 xl:gap-2.5 xl:pt-0.5 xl:pb-0">
            <div className="flex min-h-6 min-w-0 flex-1 items-end gap-px overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden xl:min-h-8">
              {tabs.map((tb) => (
                <button
                  key={tb.id}
                  type="button"
                  onClick={() => setTab(tb.id)}
                  className={`box-border flex min-h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-t px-2 py-0 text-[11px] font-semibold leading-none transition-colors border-b-2 -mb-px xl:min-h-8 xl:px-2.5 ${
                    tab === tb.id
                      ? `${SUPPLIER_DETAIL_TAB_ACTIVE_UNDERLINE[tb.id]} bg-transparent text-app-fg`
                      : 'border-b-transparent bg-transparent text-app-fg-muted hover:bg-app-line-10 hover:text-app-fg'
                  }`}
                >
                  {tb.label}
                  {tb.badge !== undefined && tb.badge > 0 && (
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
                  )}
                </button>
              ))}
            </div>

            <div className="-mb-px flex h-6 w-max shrink-0 items-center gap-px self-end rounded-md border border-app-soft-border bg-transparent px-0.5 xl:h-8 xl:px-1">
              <button
                type="button"
                onClick={() => shiftYear(-1)}
                title={t.appStrings.monthNavPrevYearTitle}
                aria-label={t.appStrings.monthNavPrevYearTitle}
                className="flex h-5 w-5 items-center justify-center rounded-sm text-app-fg-muted transition-colors hover:bg-app-line-10 hover:text-app-fg xl:h-6 xl:w-6"
              >
                <svg className="h-3 w-3 xl:h-3 xl:w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-9-9 9-9m9 18l-9-9 9-9" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                title={t.appStrings.monthNavPrevMonthTitle}
                aria-label={t.appStrings.monthNavPrevMonthTitle}
                className="flex h-5 w-5 items-center justify-center rounded-sm text-app-fg-muted transition-colors hover:bg-app-line-10 hover:text-app-fg xl:h-6 xl:w-6"
              >
                <svg className="h-3 w-3 xl:h-3 xl:w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="min-w-0 whitespace-nowrap px-0.5 text-center text-[11px] font-semibold tabular-nums leading-none text-app-fg xl:leading-8">
                {monthYearLabel}
              </span>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                disabled={isCurrentMonth}
                title={t.appStrings.monthNavNextMonthTitle}
                aria-label={t.appStrings.monthNavNextMonthTitle}
                className="flex h-5 w-5 items-center justify-center rounded-sm text-app-fg-muted transition-colors hover:bg-app-line-10 hover:text-app-fg disabled:cursor-not-allowed disabled:opacity-30 xl:h-6 xl:w-6"
              >
                <svg className="h-3 w-3 xl:h-3 xl:w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => shiftYear(1)}
                disabled={!canShiftYearForward}
                title={t.appStrings.monthNavNextYearTitle}
                aria-label={t.appStrings.monthNavNextYearTitle}
                className="flex h-5 w-5 items-center justify-center rounded-sm text-app-fg-muted transition-colors hover:bg-app-line-10 hover:text-app-fg disabled:cursor-not-allowed disabled:opacity-30 xl:h-6 xl:w-6"
              >
                <svg className="h-3 w-3 xl:h-3 xl:w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l9 9-9 9M4 5l9 9-9 9" />
                </svg>
              </button>
              {!isCurrentMonth && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterYear(now.getFullYear())
                    setFilterMonth(now.getMonth() + 1)
                  }}
                  title={t.appStrings.monthNavResetTitle}
                  aria-label={t.appStrings.monthNavResetTitle}
                  className="flex h-5 w-5 items-center justify-center rounded-sm text-app-cyan-500 transition-colors hover:bg-app-line-15 hover:text-app-fg xl:h-6 xl:w-6"
                >
                  <svg className="h-3 w-3 xl:h-3 xl:w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
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
                  setFilterYear(c.y)
                  setFilterMonth(c.m)
                  setTab(nextTab)
                }}
              />
            ) : null}
            <div
              className="fornitore-tab-panel min-w-0 scroll-mt-6 rounded-xl border border-app-line-15 bg-transparent p-2.5 outline-none sm:p-3 md:p-3.5 md:scroll-mt-8"
              tabIndex={-1}
            >
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
                    cardAccent="cyan"
                    supplierDesktopVerificaMode="classicToolbar"
                  />
                </div>
              ) : null}
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
        <button type="button" onClick={() => router.push('/fornitori')}
          className="text-sm font-medium text-app-cyan-500 hover:underline">
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
