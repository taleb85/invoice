import Link from 'next/link'
import type { OperatorDashboardKpis } from '@/lib/dashboard-operator-kpis'
import type { Translations, Locale } from '@/lib/translations'
import type { ReactNode } from 'react'
import KpiLAccentOverlay from '@/components/KpiLAccentOverlay'
import {
  DASHBOARD_OPERATOR_KPI_GRID_LAYOUT_CLASS,
  operatorKpiVisual,
  supplierKpiPalette,
} from '@/lib/kpi-accent-palette'
import { withFiscalYearQuery } from '@/lib/fiscal-link'
import {
  SUMMARY_HIGHLIGHT_ACCENTS,
  SUMMARY_HIGHLIGHT_CARD_INNER_PADDING_CLASS,
  SUMMARY_HIGHLIGHT_SURFACE_CLASS,
} from '@/lib/summary-highlight-accent'
import { formatCurrency } from '@/lib/locale-shared'

/** Solo layout; tinta da `operatorKpiVisual[].iconWrapClass`. */
const kpiTileIconWrapBase =
  'col-start-2 row-start-1 flex h-10 w-10 shrink-0 items-center justify-center self-start justify-self-end rounded-lg sm:h-11 sm:w-11'
/** Sottotitolo sotto il valore: larghezza piena, niente affiancamento stretto al numero. */
const kpiTileSubLine =
  'w-full min-w-0 text-[11px] font-medium leading-relaxed text-app-fg-muted sm:text-xs sm:leading-relaxed'
const kpiTileChevronBase =
  'col-start-2 row-start-2 h-4 w-4 shrink-0 self-end justify-self-end opacity-55 transition-colors sm:h-5 sm:w-5'

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
/** Stesso padding interno di `AppSummaryHighlightCard` / tabelle in guscio accent. */
const kpiGridInnerClass = `w-full min-w-0 ${SUMMARY_HIGHLIGHT_CARD_INNER_PADDING_CLASS}`

/**
 * Stessi colori/drop-shadow/chevron della scheda fornitore (`supplierKpiPalette` + `buildSupplierKpiItems`).
 * Indice 0 = Fornitori (solo dashboard): resta l’accento sky della tile.
 * Ordine tile: Fornitori → Ordini → Bolle → Fatturato → Verifica → Listino → Documenti.
 */
const DASHBOARD_TILE_SUPPLIER_ICON_KEYS: (keyof typeof supplierKpiPalette | null)[] = [
  null,
  'conferme',
  'bolle',
  'fatture',
  'verifica',
  'listino',
  'documenti',
]

/** Allinea accenti `operatorKpiVisual` all’ordine tile (Documenti in coda come in scheda + Fornitori in testa). */
const OPERATOR_KPI_VISUAL_INDEX = [0, 2, 3, 4, 5, 6, 1] as const

function operatorKpiVisualAt(tileIndex: number) {
  return operatorKpiVisual[OPERATOR_KPI_VISUAL_INDEX[tileIndex]!]
}

function dashboardKpiIconSvgClass(index: number) {
  const key = DASHBOARD_TILE_SUPPLIER_ICON_KEYS[index]
  if (!key) return operatorKpiVisual[index].iconSvgClass
  const p = supplierKpiPalette[key]
  return `${p.iconClass} ${p.iconDropShadow}`
}

function dashboardKpiChevronClass(index: number) {
  const key = DASHBOARD_TILE_SUPPLIER_ICON_KEYS[index]
  if (!key) return operatorKpiVisual[index].chevronClass
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
                className={`operator-kpi-card relative flex animate-pulse flex-col overflow-hidden rounded-3xl ${ov.borderClass} ${ov.ringClass}`}
                style={{ boxShadow: operatorKpiCardShadow(ov.glowRgb) }}
              >
                <KpiLAccentOverlay accentHex={ov.accentHex} edgePx={4} />
                <div className="relative z-[1] grid min-h-[7rem] flex-1 grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_1fr] gap-x-2.5 gap-y-2 p-4 sm:min-h-[7.5rem] sm:gap-x-3 sm:p-5">
                  <div className="col-start-1 row-start-1 flex items-center">
                    <div className="h-3.5 w-4/5 max-w-[10rem] rounded bg-white/12 sm:h-4" />
                  </div>
                  <div className={`${kpiTileIconWrapBase} ${ov.iconWrapClass} animate-pulse`}>
                    <div className="h-5 w-5 rounded bg-white/15 sm:h-6 sm:w-6" />
                  </div>
                  <div className="col-start-1 row-start-2 flex min-w-0 flex-col items-stretch gap-2">
                    <div className="h-8 w-16 shrink-0 rounded bg-white/12 sm:h-9 sm:w-20" />
                    <div className="h-8 w-full rounded bg-white/10" />
                  </div>
                  <div className="col-start-2 row-start-2 h-4 w-4 shrink-0 self-end justify-self-end rounded bg-white/12 sm:h-5 sm:w-5" />
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
  accentHex: string
  glowRgb: string
  borderClass: string
  ringClass: string
  hoverClass: string
  iconWrapClass: string
  icon: ReactNode
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

  const items: KpiItem[] = [
    {
      href: '/fornitori',
      label: t.nav.fornitori,
      value: k.fornitoriCount,
      sub: t.dashboard.kpiFornitoriSub,
      accentHex: operatorKpiVisualAt(0).accentHex,
      glowRgb: operatorKpiVisualAt(0).glowRgb,
      borderClass: operatorKpiVisualAt(0).borderClass,
      ringClass: operatorKpiVisualAt(0).ringClass,
      hoverClass: operatorKpiVisualAt(0).hoverClass,
      iconWrapClass: operatorKpiVisualAt(0).iconWrapClass,
      icon: (
        <svg className={`h-5 w-5 shrink-0 sm:h-6 sm:w-6 ${dashboardKpiIconSvgClass(0)}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      ),
    },
    {
      href: withFiscalYearQuery('/ordini', fy),
      label: t.fornitori.kpiOrdini,
      value: k.ordiniCount,
      sub: t.fornitori.subOrdiniPeriodo,
      accentHex: operatorKpiVisualAt(1).accentHex,
      glowRgb: operatorKpiVisualAt(1).glowRgb,
      borderClass: operatorKpiVisualAt(1).borderClass,
      ringClass: operatorKpiVisualAt(1).ringClass,
      hoverClass: operatorKpiVisualAt(1).hoverClass,
      iconWrapClass: operatorKpiVisualAt(1).iconWrapClass,
      icon: (
        <svg className={`h-5 w-5 shrink-0 sm:h-6 sm:w-6 ${dashboardKpiIconSvgClass(1)}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
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
      accentHex: operatorKpiVisualAt(2).accentHex,
      glowRgb: operatorKpiVisualAt(2).glowRgb,
      borderClass: operatorKpiVisualAt(2).borderClass,
      ringClass: operatorKpiVisualAt(2).ringClass,
      hoverClass: operatorKpiVisualAt(2).hoverClass,
      iconWrapClass: operatorKpiVisualAt(2).iconWrapClass,
      icon: (
        <svg className={`h-5 w-5 shrink-0 sm:h-6 sm:w-6 ${dashboardKpiIconSvgClass(2)}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
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
      accentHex: operatorKpiVisualAt(3).accentHex,
      glowRgb: operatorKpiVisualAt(3).glowRgb,
      borderClass: operatorKpiVisualAt(3).borderClass,
      ringClass: operatorKpiVisualAt(3).ringClass,
      hoverClass: operatorKpiVisualAt(3).hoverClass,
      iconWrapClass: operatorKpiVisualAt(3).iconWrapClass,
      icon: (
        <svg className={`h-5 w-5 shrink-0 sm:h-6 sm:w-6 ${dashboardKpiIconSvgClass(3)}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
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
      href: withFiscalYearQuery('/statements/verifica', fy),
      label: t.statements.tabVerifica,
      value: k.statementsTotal,
      sub: stmtSub,
      accentHex: operatorKpiVisualAt(4).accentHex,
      glowRgb: operatorKpiVisualAt(4).glowRgb,
      borderClass: operatorKpiVisualAt(4).borderClass,
      ringClass: operatorKpiVisualAt(4).ringClass,
      hoverClass: operatorKpiVisualAt(4).hoverClass,
      iconWrapClass: operatorKpiVisualAt(4).iconWrapClass,
      icon: (
        <svg className={`h-5 w-5 shrink-0 sm:h-6 sm:w-6 ${dashboardKpiIconSvgClass(4)}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
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
      href: withFiscalYearQuery('/listino', fy),
      label: t.fornitori.kpiListinoProdottiPeriodo,
      value: k.listinoProdottiDistinti,
      sub:
        k.listinoRows === 0
          ? t.fornitori.subListinoPeriodoVuoto
          : t.fornitori.subListinoProdottiEAggiornamenti
              .replace('{p}', String(k.listinoProdottiDistinti))
              .replace('{u}', String(k.listinoRows)),
      accentHex: operatorKpiVisualAt(5).accentHex,
      glowRgb: operatorKpiVisualAt(5).glowRgb,
      borderClass: operatorKpiVisualAt(5).borderClass,
      ringClass: operatorKpiVisualAt(5).ringClass,
      hoverClass: operatorKpiVisualAt(5).hoverClass,
      iconWrapClass: operatorKpiVisualAt(5).iconWrapClass,
      icon: (
        <svg className={`h-5 w-5 shrink-0 sm:h-6 sm:w-6 ${dashboardKpiIconSvgClass(5)}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h10M4 18h10" />
        </svg>
      ),
    },
    {
      href: '/statements/da-processare',
      label: t.fornitori.kpiPending,
      value: k.documentiPending,
      sub: t.fornitori.subDocumentiCodaEmailPeriodo,
      accentHex: operatorKpiVisualAt(6).accentHex,
      glowRgb: operatorKpiVisualAt(6).glowRgb,
      borderClass: operatorKpiVisualAt(6).borderClass,
      ringClass: operatorKpiVisualAt(6).ringClass,
      hoverClass: operatorKpiVisualAt(6).hoverClass,
      iconWrapClass: operatorKpiVisualAt(6).iconWrapClass,
      icon: (
        <svg className={`h-5 w-5 shrink-0 sm:h-6 sm:w-6 ${dashboardKpiIconSvgClass(6)}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ]

  const panel = (
    <div className={kpiGridShellClass}>
      <div className={`app-card-bar-accent shrink-0 ${kpiGridShellTheme.bar}`} aria-hidden />
      <div className={kpiGridInnerClass}>
        <div className={DASHBOARD_OPERATOR_KPI_GRID_LAYOUT_CLASS}>
          {items.map((item, itemIndex) => (
            <Link
              key={`${item.href}-${item.label}`}
              href={item.href}
              aria-label={`${item.label}: ${item.value}`}
              className={`operator-kpi-card group relative z-[1] flex cursor-pointer flex-col overflow-hidden rounded-3xl touch-manipulation ${item.borderClass} ${item.ringClass} transition-[transform,box-shadow,border-color,background-color] duration-200 hover:bg-white/[0.07] ${item.hoverClass} active:scale-[0.99]`}
              style={{ boxShadow: operatorKpiCardShadow(item.glowRgb) }}
            >
              <KpiLAccentOverlay accentHex={item.accentHex} edgePx={4} />
              <div className="relative z-[1] grid min-h-[7rem] flex-1 grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_1fr] gap-x-2.5 gap-y-2 p-4 sm:min-h-[7.5rem] sm:gap-x-3 sm:p-5">
                <p className="col-start-1 row-start-1 min-w-0 self-center text-[11px] font-semibold uppercase leading-snug tracking-wide text-app-fg line-clamp-3 sm:text-xs">
                  {item.label}
                </p>
                <span className={`${kpiTileIconWrapBase} ${item.iconWrapClass}`}>{item.icon}</span>
                <div className="col-start-1 row-start-2 flex min-w-0 flex-col items-stretch gap-1.5 self-end">
                  <p className="text-xl font-bold tabular-nums leading-tight tracking-tight text-app-fg sm:text-2xl xl:text-3xl break-words">
                    {item.value}
                  </p>
                  <p className={kpiTileSubLine}>{item.sub}</p>
                </div>
                <svg
                  className={`${kpiTileChevronBase} ${dashboardKpiChevronClass(itemIndex)}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )

  return panel
}