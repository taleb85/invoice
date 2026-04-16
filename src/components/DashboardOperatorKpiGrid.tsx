'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { OperatorDashboardKpis } from '@/lib/dashboard-operator-kpis'
import type { Translations, Locale } from '@/lib/translations'
import {
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react'
import KpiLAccentOverlay from '@/components/KpiLAccentOverlay'
import {
  DASHBOARD_OPERATOR_KPI_GRID_LAYOUT_CLASS,
  operatorKpiVisual,
  supplierKpiPalette,
} from '@/lib/kpi-accent-palette'
import { withFiscalYearQuery } from '@/lib/fiscal-link'
import { SUMMARY_HIGHLIGHT_ACCENTS, SUMMARY_HIGHLIGHT_SURFACE_CLASS } from '@/lib/summary-highlight-accent'
import { formatCurrency } from '@/lib/locale-shared'
import { useNetworkStatusOptional } from '@/lib/network-context'

/** Solo layout; tinta da `operatorKpiVisual[].iconWrapClass`. */
const kpiTileIconWrapBase =
  'col-start-2 row-start-1 flex h-9 w-9 shrink-0 items-center justify-center self-start justify-self-end rounded-md sm:h-10 sm:w-10'
/** Sottotitolo sotto il valore: larghezza piena, niente affiancamento stretto al numero. */
const kpiTileSubLine =
  'w-full min-w-0 text-[10px] font-medium leading-relaxed text-app-fg-muted sm:text-[11px] sm:leading-relaxed'
const kpiTileChevronBase =
  'col-start-2 row-start-2 h-3.5 w-3.5 shrink-0 self-end justify-self-end opacity-55 transition-colors sm:h-4 sm:w-4'

/** Alone KPI: alone dominante sul colore della card (non più cyan fisso). */
function operatorKpiCardShadow(glowRgb: string) {
  return [
    `0 0 0 1px rgba(${glowRgb},0.14)`,
    `0 0 44px -14px rgba(${glowRgb},0.22)`,
    `0 0 40px -10px rgba(${glowRgb},0.4)`,
    '0 18px 40px -12px rgba(0,0,0,0.48)',
  ].join(', ')
}

/** Guscio come strip dashboard: bordo sky + barra; corpo trasparente con padding come `AppPageHeaderStrip` dense. */
const kpiGridShellTheme = SUMMARY_HIGHLIGHT_ACCENTS.sky
const kpiGridShellClass = [
  SUMMARY_HIGHLIGHT_SURFACE_CLASS,
  kpiGridShellTheme.border,
  'flex flex-col overflow-hidden',
].join(' ')
/** Più compatto del padding generico riepilogo (`xl:px-10` altrimenti “gonfia” la fascia KPI). */
const kpiGridInnerClass =
  'w-full min-w-0 px-3 py-3 sm:px-4 sm:py-3.5 md:px-4 md:py-4 lg:px-5 lg:py-4 xl:px-6 xl:py-4'

/** Corpo tile: stessa altezza minima e spaziatura su tutte le KPI (skeleton incluso). */
const kpiTileInnerGridClass =
  'relative z-[1] grid h-full min-h-[8.25rem] w-full min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_1fr] gap-x-2.5 gap-y-2 p-3.5 sm:min-h-[8.75rem] sm:p-4'

/**
 * Stessi colori/drop-shadow/chevron della scheda fornitore (`supplierKpiPalette` + `buildSupplierKpiItems`).
 * Ordine tile: Ordini → Bolle → Fatturato → Verifica → Listino → Documenti.
 */
const DASHBOARD_TILE_SUPPLIER_ICON_KEYS: (keyof typeof supplierKpiPalette)[] = [
  'conferme',
  'bolle',
  'fatture',
  'verifica',
  'listino',
  'documenti',
]

/** Allinea accenti `operatorKpiVisual` all’ordine tile (Documenti in coda come in scheda). */
const OPERATOR_KPI_VISUAL_INDEX = [2, 3, 4, 5, 6, 1] as const

function operatorKpiVisualAt(tileIndex: number) {
  return operatorKpiVisual[OPERATOR_KPI_VISUAL_INDEX[tileIndex]!]
}

function dashboardKpiIconSvgClass(index: number) {
  const key = DASHBOARD_TILE_SUPPLIER_ICON_KEYS[index]!
  const p = supplierKpiPalette[key]
  return `${p.iconClass} ${p.iconDropShadow}`
}

function dashboardKpiChevronClass(index: number) {
  const key = DASHBOARD_TILE_SUPPLIER_ICON_KEYS[index]!
  const p = supplierKpiPalette[key]
  return `${p.chevronClass} ${p.chevronHoverClass} group-hover:opacity-100`
}

export function DashboardOperatorKpiSkeleton() {
  return (
    <div className={kpiGridShellClass}>
      <div className={`app-card-bar-accent shrink-0 ${kpiGridShellTheme.bar}`} aria-hidden />
      <div className={kpiGridInnerClass}>
        <div className={DASHBOARD_OPERATOR_KPI_GRID_LAYOUT_CLASS}>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => {
            const ov = operatorKpiVisualAt(i)
            return (
              <div
                key={i}
                className={`operator-kpi-card relative flex h-full min-h-0 min-w-0 w-full animate-pulse flex-col overflow-hidden rounded-2xl ${ov.borderClass} ${ov.ringClass}`}
                style={{ boxShadow: operatorKpiCardShadow(ov.glowRgb) }}
              >
                <KpiLAccentOverlay accentHex={ov.accentHex} edgePx={4} />
                <div className={kpiTileInnerGridClass}>
                  <div className="col-start-1 row-start-1 flex min-h-[2.5rem] items-start sm:min-h-[2.75rem]">
                    <div className="mt-0.5 h-3 w-4/5 max-w-[9rem] rounded bg-white/12 sm:h-3.5" />
                  </div>
                  <div className={`${kpiTileIconWrapBase} ${ov.iconWrapClass} animate-pulse`}>
                    <div className="h-4 w-4 rounded bg-white/15 sm:h-[18px] sm:w-[18px]" />
                  </div>
                  <div className="col-start-1 row-start-2 flex min-h-0 min-w-0 flex-col items-stretch gap-1.5 self-start">
                    <div className="h-8 w-16 shrink-0 rounded bg-white/12 sm:h-9 sm:w-20" />
                    <div className="h-6 w-full rounded bg-white/10 sm:h-7" />
                  </div>
                  <div className="col-start-2 row-start-2 h-3.5 w-3.5 shrink-0 self-end justify-self-end rounded bg-white/12 sm:h-4 sm:w-4" />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

type KpiItem = {
  href: string
  label: string
  value: string | number
  sub: string
  /** Avviso duplicati bolle (arancio) sotto Rekki / sottotitolo. */
  duplicateBolleSub?: string
  /** Seconda riga sotto il sottotitolo (es. hint Rekki su Bolle). */
  microSub?: string
  accentHex: string
  glowRgb: string
  borderClass: string
  ringClass: string
  hoverClass: string
  iconWrapClass: string
  icon: ReactNode
  /** Tile Bolle: link secondario verso elenco solo `pending=1` (evita `<a>` annidato: gestito nel render). */
  bollePendingHref?: string
  bollePendingCta?: string
  /** Sottotitolo listino con conteggio anomalie: enfasi testuale senza cambiare bordo card. */
  listinoAnomalySubHighlight?: boolean
  /** Tile fatturato: avviso duplicati (arancio / neon). */
  duplicateInvoiceSub?: string
}

export default function DashboardOperatorKpiGrid({
  kpis: k,
  t,
  locale,
  currency,
  fiscalYear,
}: {
  kpis: OperatorDashboardKpis
  t: Translations
  locale: Locale
  currency: string
  /** Se impostato, aggiunge `?fy=` (e `tutte=1` su Bolle) ai link delle schede. */
  fiscalYear?: number
}) {
  const router = useRouter()
  const network = useNetworkStatusOptional()
  const online = network?.online ?? true
  const fy = fiscalYear
  const stmtN = k.statementsTotal
  const stmtIssues = k.statementsWithIssues
  const stmtSub =
    stmtN === 0
      ? t.fornitori.subStatementsNoneInMonth
      : stmtIssues === 0
        ? t.fornitori.subStatementsAllVerified
        : `${stmtIssues} ${t.fornitori.subStatementsWithIssues}`

  const formatMoney = (amount: number) => formatCurrency(amount, currency, locale)

  const bollePendingHref =
    k.bolleInAttesa > 0 ? withFiscalYearQuery('/bolle', fy, { tutte: '1', pending: '1' }) : undefined
  const bollePendingCta =
    bollePendingHref != null
      ? t.dashboard.kpiBollePendingListCta.replace('{n}', String(k.bolleInAttesa))
      : undefined

  const listinoAnomaly = k.anomaliePrezziCount > 0
  const verificaAnomalyParams = k.anomaliePrezziCount > 0 ? { stato: 'anomalia' as const } : undefined

  const kpiLayoutFingerprint = useMemo(
    () =>
      [
        online ? '1' : '0',
        locale,
        currency,
        String(fy ?? ''),
        k.bolleTotal,
        k.bolleInAttesa,
        k.bolleRekkiSavingsHint ? 1 : 0,
        k.duplicatiBolleCount,
        k.duplicatiOrdiniCount,
        k.duplicatiCount,
        k.documentiDaRevisionare,
        k.documentiPending,
        k.fattureCount,
        k.listinoProdottiDistinti,
        k.listinoRows,
        k.ordiniCount,
        k.statementsTotal,
        k.statementsWithIssues,
        k.anomaliePrezziCount,
        k.totaleImporto,
        bollePendingHref ?? '',
      ].join('|'),
    [
      online,
      locale,
      currency,
      fy,
      bollePendingHref,
      k.anomaliePrezziCount,
      k.bolleInAttesa,
      k.bolleRekkiSavingsHint,
      k.bolleTotal,
      k.documentiPending,
      k.duplicatiBolleCount,
      k.duplicatiOrdiniCount,
      k.duplicatiCount,
      k.documentiDaRevisionare,
      k.fattureCount,
      k.listinoProdottiDistinti,
      k.listinoRows,
      k.ordiniCount,
      k.statementsTotal,
      k.statementsWithIssues,
      k.totaleImporto,
    ],
  )

  const items: KpiItem[] = [
    {
      href: withFiscalYearQuery('/ordini', fy),
      label: t.fornitori.kpiOrdini,
      value: k.ordiniCount,
      sub: t.fornitori.subOrdiniPeriodo,
      accentHex: operatorKpiVisualAt(0).accentHex,
      glowRgb: operatorKpiVisualAt(0).glowRgb,
      borderClass: operatorKpiVisualAt(0).borderClass,
      ringClass: operatorKpiVisualAt(0).ringClass,
      hoverClass: operatorKpiVisualAt(0).hoverClass,
      iconWrapClass: operatorKpiVisualAt(0).iconWrapClass,
      icon: (
        <svg className={`h-4 w-4 shrink-0 sm:h-[18px] sm:w-[18px] ${dashboardKpiIconSvgClass(0)}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
          />
        </svg>
      ),
    },
    {
      href: withFiscalYearQuery('/bolle', fy, { tutte: '1' }),
      label: t.fornitori.kpiBolleTotal,
      value: k.bolleTotal,
      sub:
        k.bolleTotal === 0
          ? t.fornitori.subBollePeriodoVuoto
          : t.fornitori.subBollePeriodoRiepilogo
              .replace('{open}', String(k.bolleInAttesa))
              .replace('{total}', String(k.bolleTotal)),
      microSub:
        k.bolleTotal > 0 && k.bolleRekkiSavingsHint ? t.fornitori.subBolleRekkiSavingsMicro : undefined,
      duplicateBolleSub:
        k.duplicatiBolleCount > 0
          ? t.dashboard.kpiDuplicateBolleDetected.replace('{n}', String(k.duplicatiBolleCount))
          : undefined,
      bollePendingHref,
      bollePendingCta,
      accentHex: operatorKpiVisualAt(1).accentHex,
      glowRgb: operatorKpiVisualAt(1).glowRgb,
      borderClass: operatorKpiVisualAt(1).borderClass,
      ringClass: operatorKpiVisualAt(1).ringClass,
      hoverClass: operatorKpiVisualAt(1).hoverClass,
      iconWrapClass: operatorKpiVisualAt(1).iconWrapClass,
      icon: (
        <svg className={`h-4 w-4 shrink-0 sm:h-[18px] sm:w-[18px] ${dashboardKpiIconSvgClass(1)}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
      ),
    },
    {
      href: withFiscalYearQuery('/fatture', fy),
      label: t.fornitori.kpiFatturatoPeriodo,
      value: formatMoney(k.totaleImporto),
      sub:
        k.fattureCount === 0
          ? t.fornitori.subFatturatoPeriodoZero
          : k.fattureCount === 1
            ? t.fornitori.subFatturatoPeriodoCount_one
            : t.fornitori.subFatturatoPeriodoCount_other.replace('{n}', String(k.fattureCount)),
      duplicateInvoiceSub:
        k.duplicatiCount > 0
          ? t.dashboard.kpiDuplicateInvoicesDetected.replace('{n}', String(k.duplicatiCount))
          : undefined,
      accentHex: operatorKpiVisualAt(2).accentHex,
      glowRgb: operatorKpiVisualAt(2).glowRgb,
      borderClass: operatorKpiVisualAt(2).borderClass,
      ringClass: operatorKpiVisualAt(2).ringClass,
      hoverClass: operatorKpiVisualAt(2).hoverClass,
      iconWrapClass: operatorKpiVisualAt(2).iconWrapClass,
      icon: (
        <svg className={`h-4 w-4 shrink-0 sm:h-[18px] sm:w-[18px] ${dashboardKpiIconSvgClass(2)}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
    },
    {
      href: withFiscalYearQuery('/statements/verifica', fy, verificaAnomalyParams),
      label: t.statements.tabVerifica,
      value: k.statementsTotal,
      sub: stmtSub,
      accentHex: operatorKpiVisualAt(3).accentHex,
      glowRgb: operatorKpiVisualAt(3).glowRgb,
      borderClass: operatorKpiVisualAt(3).borderClass,
      ringClass: operatorKpiVisualAt(3).ringClass,
      hoverClass: operatorKpiVisualAt(3).hoverClass,
      iconWrapClass: operatorKpiVisualAt(3).iconWrapClass,
      icon: (
        <svg className={`h-4 w-4 shrink-0 sm:h-[18px] sm:w-[18px] ${dashboardKpiIconSvgClass(3)}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          />
        </svg>
      ),
    },
    {
      href: listinoAnomaly
        ? withFiscalYearQuery('/statements/verifica', fy, { stato: 'anomalia' })
        : withFiscalYearQuery('/listino', fy),
      label: t.fornitori.kpiListinoProdottiPeriodo,
      value: k.listinoProdottiDistinti,
      sub: listinoAnomaly
        ? t.dashboard.kpiListinoAnomaliesCountLine.replace('{n}', String(k.anomaliePrezziCount))
        : k.listinoRows === 0
          ? t.fornitori.subListinoPeriodoVuoto
          : t.fornitori.subListinoProdottiEAggiornamenti
              .replace('{p}', String(k.listinoProdottiDistinti))
              .replace('{u}', String(k.listinoRows)),
      listinoAnomalySubHighlight: listinoAnomaly,
      accentHex: operatorKpiVisualAt(4).accentHex,
      glowRgb: operatorKpiVisualAt(4).glowRgb,
      borderClass: operatorKpiVisualAt(4).borderClass,
      ringClass: operatorKpiVisualAt(4).ringClass,
      hoverClass: operatorKpiVisualAt(4).hoverClass,
      iconWrapClass: operatorKpiVisualAt(4).iconWrapClass,
      icon: (
        <svg
          className={`h-4 w-4 shrink-0 sm:h-[18px] sm:w-[18px] ${dashboardKpiIconSvgClass(4)}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h10M4 18h10" />
        </svg>
      ),
    },
    {
      href: '/statements/da-processare',
      label: t.fornitori.kpiPending,
      value: k.documentiPending,
      sub: t.fornitori.subDocumentiCodaEmailPeriodo,
      accentHex: operatorKpiVisualAt(5).accentHex,
      glowRgb: operatorKpiVisualAt(5).glowRgb,
      borderClass: operatorKpiVisualAt(5).borderClass,
      ringClass: operatorKpiVisualAt(5).ringClass,
      hoverClass: operatorKpiVisualAt(5).hoverClass,
      iconWrapClass: operatorKpiVisualAt(5).iconWrapClass,
      icon: (
        <svg className={`h-4 w-4 shrink-0 sm:h-[18px] sm:w-[18px] ${dashboardKpiIconSvgClass(5)}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      href: withFiscalYearQuery('/revisione', fy),
      label: t.dashboard.kpiDocumentiDaRevisionareTitle,
      value: k.documentiDaRevisionare,
      sub: t.dashboard.kpiDocumentiDaRevisionareSub,
      accentHex: operatorKpiVisual[2].accentHex,
      glowRgb: operatorKpiVisual[2].glowRgb,
      borderClass: operatorKpiVisual[2].borderClass,
      ringClass: operatorKpiVisual[2].ringClass,
      hoverClass: operatorKpiVisual[2].hoverClass,
      iconWrapClass: operatorKpiVisual[2].iconWrapClass,
      icon: (
        <svg
          className={`h-4 w-4 shrink-0 sm:h-[18px] sm:w-[18px] ${operatorKpiVisual[2].iconSvgClass}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z"
          />
        </svg>
      ),
    },
  ]

  /** Altezza unica (px) per tutte le tile: le righe della griglia possono avere altezze diverse senza questo. */
  const kpiGridRef = useRef<HTMLDivElement>(null)
  const uniformTileMinPxRef = useRef<number | undefined>(undefined)
  const [, bumpUniformTileHeight] = useReducer((n: number) => n + 1, 0)

  useLayoutEffect(() => {
    const grid = kpiGridRef.current
    if (!grid) return

    const run = (clearIntrinsicMinHeight: boolean) => {
      const tiles = [...grid.querySelectorAll<HTMLElement>(':scope > .operator-kpi-card')]
      if (tiles.length === 0) return
      if (clearIntrinsicMinHeight) {
        for (const node of tiles) node.style.removeProperty('min-height')
      }
      const maxPx = Math.ceil(Math.max(1, ...tiles.map((node) => node.getBoundingClientRect().height)))
      const prev = uniformTileMinPxRef.current
      uniformTileMinPxRef.current = maxPx
      if (prev !== maxPx || clearIntrinsicMinHeight) bumpUniformTileHeight()
    }

    run(true)

    const onResize = () => run(true)
    const ro = new ResizeObserver(onResize)
    ro.observe(grid)
    window.addEventListener('resize', onResize)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', onResize)
    }
  }, [kpiLayoutFingerprint])

  const uniformTileMinPx = uniformTileMinPxRef.current
  const cardInteractive = online ? 'cursor-pointer active:scale-[0.99]' : 'cursor-not-allowed opacity-[0.88]'

  const panel = (
    <div className={kpiGridShellClass}>
      <div className={`app-card-bar-accent shrink-0 ${kpiGridShellTheme.bar}`} aria-hidden />
      <div className={`${kpiGridInnerClass} relative`}>
        <div
          ref={kpiGridRef}
          className={`${DASHBOARD_OPERATOR_KPI_GRID_LAYOUT_CLASS} ${!online ? 'pointer-events-none' : ''}`}
        >
          {items.map((item, itemIndex) => {
            const chevronClass = `${kpiTileChevronBase} ${dashboardKpiChevronClass(itemIndex < 6 ? itemIndex : 5)}`

            const inner = (
              <>
                <KpiLAccentOverlay accentHex={item.accentHex} edgePx={4} />
                <div className={kpiTileInnerGridClass}>
                  <p className="col-start-1 row-start-1 flex min-h-[2.5rem] min-w-0 items-start self-start text-[10px] font-semibold uppercase leading-snug tracking-wide text-app-fg line-clamp-2 sm:min-h-[2.75rem] sm:text-[11px]">
                    {item.label}
                  </p>
                  <span className={`${kpiTileIconWrapBase} ${item.iconWrapClass}`}>{item.icon}</span>
                  <div className="col-start-1 row-start-2 flex min-h-0 min-w-0 flex-col items-stretch gap-1 self-start">
                    <p className="break-words text-xl font-bold tabular-nums leading-tight tracking-tight text-app-fg sm:text-2xl">
                      {item.value}
                    </p>
                    <p
                      className={
                        item.listinoAnomalySubHighlight
                          ? `${kpiTileSubLine} font-semibold text-rose-200/95`
                          : kpiTileSubLine
                      }
                    >
                      {item.sub}
                    </p>
                    {item.bollePendingHref && item.bollePendingCta && k.bolleInAttesa > 0 ? (
                      <span
                        role="link"
                        tabIndex={online ? 0 : -1}
                        className={`mt-0.5 inline-flex w-fit max-w-full rounded-md text-left text-[10px] font-semibold leading-snug underline decoration-indigo-400/50 underline-offset-2 transition-colors sm:text-[11px] ${
                          online
                            ? 'cursor-pointer text-indigo-200 hover:text-indigo-100 hover:decoration-indigo-200/80'
                            : 'text-app-fg-muted line-through decoration-transparent'
                        }`}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          if (online) void router.push(item.bollePendingHref!)
                        }}
                        onKeyDown={(e) => {
                          if (!online) return
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            e.stopPropagation()
                            void router.push(item.bollePendingHref!)
                          }
                        }}
                      >
                        {item.bollePendingCta}
                      </span>
                    ) : null}
                    {item.microSub ? (
                      <p className="w-full min-w-0 text-[10px] font-medium leading-snug text-emerald-300/85 sm:text-[11px] sm:leading-snug">
                        {item.microSub}
                      </p>
                    ) : null}
                    {item.duplicateInvoiceSub ? (
                      <p className="w-full min-w-0 text-[10px] font-semibold leading-snug text-orange-300 drop-shadow-[0_0_8px_rgba(251,146,60,0.45)] sm:text-[11px] sm:leading-snug">
                        {item.duplicateInvoiceSub}
                      </p>
                    ) : null}
                    {item.duplicateBolleSub ? (
                      <p className="w-full min-w-0 text-[10px] font-semibold leading-snug text-orange-300 drop-shadow-[0_0_8px_rgba(251,146,60,0.45)] sm:text-[11px] sm:leading-snug">
                        {item.duplicateBolleSub}
                      </p>
                    ) : null}
                  </div>
                  <svg className={chevronClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </>
            )

            const shellClass = `operator-kpi-card group relative z-[1] flex h-full min-h-0 min-w-0 w-full flex-col overflow-hidden rounded-2xl touch-manipulation ${item.borderClass} ${item.ringClass} transition-[transform,box-shadow,border-color,background-color] duration-200 ${online ? 'hover:bg-white/[0.07]' : ''} ${item.hoverClass} ${cardInteractive}`
            const shellStyle: CSSProperties = {
              boxShadow: operatorKpiCardShadow(item.glowRgb),
              ...(uniformTileMinPx != null ? { minHeight: uniformTileMinPx } : {}),
            }

            if (online) {
              return (
                <Link
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  aria-label={`${item.label}: ${item.value}`}
                  className={shellClass}
                  style={shellStyle}
                >
                  {inner}
                </Link>
              )
            }

            return (
              <div
                key={`${item.href}-${item.label}`}
                role="group"
                aria-label={`${item.label}: ${item.value}`}
                aria-disabled
                className={shellClass}
                style={shellStyle}
              >
                {inner}
              </div>
            )
          })}
        </div>

        {!online ? (
          <div
            className="pointer-events-auto absolute inset-0 z-[2] flex flex-col items-center justify-center gap-2 rounded-[inherit] bg-slate-950/72 px-4 py-6 text-center shadow-[inset_0_0_0_1px_rgba(244,63,94,0.18)] backdrop-blur-[2px]"
            role="status"
            aria-live="polite"
          >
            <p className="text-sm font-bold tracking-tight text-rose-100">{t.dashboard.kpiOperatorOfflineOverlayTitle}</p>
            <p className="max-w-[20rem] text-[11px] font-medium leading-relaxed text-app-fg-muted sm:text-xs">
              {t.dashboard.kpiOperatorOfflineOverlayHint}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )

  return panel
}
