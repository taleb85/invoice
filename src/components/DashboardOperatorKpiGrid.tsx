'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { OperatorDashboardKpis } from '@/lib/dashboard-operator-kpis'
import type { Translations, Locale } from '@/lib/translations'
import { type CSSProperties, type ReactNode } from 'react'
import { DASHBOARD_OPERATOR_KPI_GRID_LAYOUT_CLASS, operatorKpiVisual } from '@/lib/kpi-accent-palette'
import { withFiscalYearQuery } from '@/lib/fiscal-link'
import {
  SUMMARY_HIGHLIGHT_ACCENTS,
  SUMMARY_HIGHLIGHT_SURFACE_CLASS,
  AURORA_GLASS_PANEL_LAYOUT_CLASS,
} from '@/lib/summary-highlight-accent'
import { formatCurrency } from '@/lib/locale-shared'
import { useNetworkStatusOptional } from '@/lib/network-context'

/** Solo layout; tinta da `operatorKpiVisual[].iconWrapClass`. */
const kpiTileIconWrapBase =
  'col-start-2 row-start-1 flex h-7 w-7 shrink-0 items-center justify-center self-start justify-self-end rounded-md sm:h-8 sm:w-8'
/** Sottotitolo sotto il valore: larghezza piena, niente affiancamento stretto al numero. */
const kpiTileSubLine =
  'w-full min-w-0 text-[11px] font-medium leading-snug text-app-fg-muted sm:text-[12px] sm:leading-snug'

/** Alone KPI: neutro, senza anello colorato. */
function operatorKpiCardShadow() {
  return [
    '0 0 0 1px rgba(34,211,238,0.12)',
    '0 0 44px -12px rgba(0,0,0,0.4)',
    '0 20px 44px -12px rgba(0,0,0,0.5)',
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
  'w-full min-w-0 px-2.5 py-1.5 sm:px-3 sm:py-2 md:px-3.5 md:py-2.5 lg:px-4 lg:py-2.5'

/** Corpo sotto l’intestazione nella sezione vetro unificata (mock AURA «KPI OPERATORE»). */
const kpiGlassInnerClass =
  'w-full min-w-0 px-3 py-3 sm:px-3.5 sm:py-3.5 md:px-4 md:py-4 lg:px-5 lg:py-4'

/** Guscio unico scheda riepilogo operatore in dashboard Aurora. */
const OPERATOR_KPI_GLASS_SECTION_SHELL_CLASS = `${AURORA_GLASS_PANEL_LAYOUT_CLASS} app-card-unified overflow-hidden rounded-2xl`

/**
 * Valore numerico in vetro: stesso accento delle icone SVG (ordine tile: Ordini, Bolle, Fatturato, Estratti, Revisione).
 */
const OPERATOR_KPI_GLASS_VALUE_ACCENT: readonly string[] = [
  'text-cyan-300 [text-shadow:0_0_22px_rgba(103,232,249,0.52)]',
  'text-violet-300 [text-shadow:0_0_22px_rgba(196,181,253,0.5)]',
  'text-emerald-300 [text-shadow:0_0_22px_rgba(110,231,183,0.5)]',
  'text-amber-200 [text-shadow:0_0_20px_rgba(253,230,138,0.45)]',
  'text-white [text-shadow:0_0_20px_rgba(255,255,255,0.14)]',
]

/** Corpo tile: griglia interna; l’altezza uniforme delle card è sul guscio `.operator-kpi-card`. */
const kpiTileInnerGridClass =
  'relative z-[1] grid h-full min-h-0 w-full min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_1fr] gap-x-1.5 gap-y-1 py-2 pl-4 pr-2 sm:py-2.5 sm:pl-5 sm:pr-2.5'

/** Stessa altezza minima per tutte le tile (ridotta; le tile con più righe crescono oltre il minimo). */
const OPERATOR_KPI_CARD_MIN_H = 'min-h-[7.25rem] sm:min-h-[7.5rem] lg:min-h-[7.75rem]'

/**
 * Stessi colori/drop-shadow della scheda fornitore (`supplierKpiPalette` + `buildSupplierKpiItems`).
 * Ordine tile: Ordini → Bolle → Fatturato → Estratti → Documenti da revisionare.
 */
/** Allinea accenti `operatorKpiVisual` all’ordine delle 5 tile dashboard. */
const OPERATOR_KPI_VISUAL_INDEX = [2, 3, 4, 5, 2] as const

/** Colore solo sull’icona SVG — Ordini → Revisione (ordine tile `items`). */
const DASHBOARD_OPERATOR_KPI_ICON_TEXT = [
  'text-cyan-400',
  'text-violet-400',
  'text-emerald-400',
  'text-amber-400',
  'text-white/85',
] as const

const DASHBOARD_OPERATOR_KPI_ICON_TEXT_GLASS = [
  'text-cyan-300',
  'text-violet-300',
  'text-emerald-300',
  'text-amber-300',
  'text-white/80',
] as const

function dashboardKpiIconTextClass(index: number, glassShell: boolean) {
  if (glassShell) {
    const i = Math.max(0, Math.min(index, DASHBOARD_OPERATOR_KPI_ICON_TEXT_GLASS.length - 1))
    return DASHBOARD_OPERATOR_KPI_ICON_TEXT_GLASS[i]!
  }
  const i = Math.max(0, Math.min(index, DASHBOARD_OPERATOR_KPI_ICON_TEXT.length - 1))
  return DASHBOARD_OPERATOR_KPI_ICON_TEXT[i]!
}

function operatorKpiVisualAt(tileIndex: number) {
  const k = Math.max(0, Math.min(tileIndex, OPERATOR_KPI_VISUAL_INDEX.length - 1))
  const v = OPERATOR_KPI_VISUAL_INDEX[k]!
  if (v >= 0 && v < operatorKpiVisual.length) {
    return operatorKpiVisual[v]!
  }
  return operatorKpiVisual[0]!
}

export function DashboardOperatorKpiSkeleton({ glassShell = false }: { glassShell?: boolean }) {
  const outer = glassShell ? OPERATOR_KPI_GLASS_SECTION_SHELL_CLASS : kpiGridShellClass
  const bar = glassShell ? null : (
    <div className={`app-card-bar-accent shrink-0 ${kpiGridShellTheme.bar}`} aria-hidden />
  )
  const innerPad = glassShell ? kpiGlassInnerClass : kpiGridInnerClass

  return (
    <div className={outer}>
      {bar}
      {glassShell ? (
        <div className="border-b border-white/10 px-4 pt-4 pb-3 md:px-5 md:pt-5 md:pb-3.5" aria-hidden>
          <div className="h-2.5 w-32 max-w-[40%] animate-pulse rounded bg-white/12" />
        </div>
      ) : null}
      <div className={innerPad}>
        <div className={DASHBOARD_OPERATOR_KPI_GRID_LAYOUT_CLASS}>
          {[0, 1, 2, 3, 4].map((i) => {
            const ov = operatorKpiVisualAt(i)
            return (
              <div
                key={i}
                className={`operator-kpi-card relative flex h-full min-h-0 min-w-0 w-full animate-pulse flex-col overflow-hidden rounded-2xl ${OPERATOR_KPI_CARD_MIN_H} ${glassShell ? '' : `${ov.borderClass} ${ov.ringClass}`}`}
                style={glassShell ? undefined : { boxShadow: operatorKpiCardShadow() }}
              >
                                <div className={kpiTileInnerGridClass}>
                  <div className="col-start-1 row-start-1 flex min-h-[1.875rem] items-start sm:min-h-[2rem]">
                    <div className="mt-0.5 h-2.5 w-4/5 max-w-[8rem] rounded bg-white/12 sm:h-3" />
                  </div>
                  <div className={`${kpiTileIconWrapBase} ${ov.iconWrapClass} animate-pulse`}>
                    <div className="h-3 w-3 rounded bg-white/15 sm:h-3.5 sm:w-3.5" />
                  </div>
                  <div className="col-span-2 col-start-1 row-start-2 flex min-h-0 min-w-0 flex-col items-stretch gap-0.5 self-start">
                    <div className="h-6 w-12 shrink-0 rounded bg-white/12 sm:h-6 sm:w-14" />
                    <div className="h-4 w-full rounded bg-white/10 sm:h-4" />
                  </div>
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
  /** Tile fatturato: avviso duplicati (arancio / neon). */
  duplicateInvoiceSub?: string
}

export default function DashboardOperatorKpiGrid({
  kpis: k,
  t,
  locale,
  currency,
  fiscalYear,
  glassShell = false,
}: {
  kpis: OperatorDashboardKpis
  t: Translations
  locale: Locale
  currency: string
  /** Se impostato, aggiunge `?fy=` (e `tutte=1` su Bolle) ai link delle schede. */
  fiscalYear?: number
  /** Contenitore vetro Deep Aurora quando la dashboard è dentro `DeepAuroraIntegration`. */
  glassShell?: boolean
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

  const verificaAnomalyParams = k.anomaliePrezziCount > 0 ? { stato: 'anomalia' as const } : undefined

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
        <svg className={`h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4 ${dashboardKpiIconTextClass(0, glassShell)}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
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
        <svg className={`h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4 ${dashboardKpiIconTextClass(1, glassShell)}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
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
        <svg className={`h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4 ${dashboardKpiIconTextClass(2, glassShell)}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
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
        <svg className={`h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4 ${dashboardKpiIconTextClass(3, glassShell)}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
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
      href: withFiscalYearQuery('/revisione', fy),
      label: t.dashboard.kpiDocumentiDaRevisionareTitle,
      value: k.documentiDaRevisionare,
      sub: t.dashboard.kpiDocumentiDaRevisionareSub,
      accentHex: operatorKpiVisualAt(4).accentHex,
      glowRgb: operatorKpiVisualAt(4).glowRgb,
      borderClass: operatorKpiVisualAt(4).borderClass,
      ringClass: operatorKpiVisualAt(4).ringClass,
      hoverClass: operatorKpiVisualAt(4).hoverClass,
      iconWrapClass: operatorKpiVisualAt(4).iconWrapClass,
      icon: (
        <svg
          className={`h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4 ${dashboardKpiIconTextClass(4, glassShell)}`}
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

  const cardInteractive = online ? 'cursor-pointer active:scale-[0.99]' : 'cursor-not-allowed opacity-[0.88]'

  const outerShellClass = glassShell ? OPERATOR_KPI_GLASS_SECTION_SHELL_CLASS : kpiGridShellClass
  const shellAccentBar = glassShell ? null : (
    <div className={`app-card-bar-accent shrink-0 ${kpiGridShellTheme.bar}`} aria-hidden />
  )
  const innerPadClass = glassShell ? kpiGlassInnerClass : kpiGridInnerClass

  const panel = (
    <div className={outerShellClass}>
      {shellAccentBar}
      {glassShell ? (
        <div className="border-b border-white/10 px-4 pt-4 pb-3 md:px-5 md:pt-5 md:pb-3.5">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/75">{t.fornitori.tabRiepilogo}</h2>
        </div>
      ) : null}
      <div className={`${innerPadClass} relative`}>
        <div className={`${DASHBOARD_OPERATOR_KPI_GRID_LAYOUT_CLASS} ${!online ? 'pointer-events-none' : ''}`}>
          {items.map((item, tileIndex) => {
            const valueAccent =
              OPERATOR_KPI_GLASS_VALUE_ACCENT[tileIndex] ?? OPERATOR_KPI_GLASS_VALUE_ACCENT[0] ?? 'text-white'
            const inner = (
              <>
                                <div className={kpiTileInnerGridClass}>
                  <p
                    className={
                      glassShell
                        ? 'col-start-1 row-start-1 flex min-h-[1.875rem] min-w-0 items-start self-start text-[10px] font-semibold uppercase leading-snug tracking-wider text-white/78 line-clamp-2 sm:min-h-[2rem] sm:text-[11px] sm:tracking-widest'
                        : 'col-start-1 row-start-1 flex min-h-[1.875rem] min-w-0 items-start self-start text-[12px] font-semibold leading-[1.15] tracking-wide text-app-fg line-clamp-2 sm:min-h-[2rem] sm:text-sm'
                    }
                  >
                    {item.label}
                  </p>
                  <span
                    className={`${kpiTileIconWrapBase} ${item.iconWrapClass}${glassShell ? ' opacity-95' : ''}`}
                  >
                    {item.icon}
                  </span>
                  <div className="col-span-2 col-start-1 row-start-2 flex min-h-0 min-w-0 flex-col items-stretch gap-0.5 self-start">
                    <p
                      className={
                        glassShell
                          ? `break-words text-xl font-bold tabular-nums leading-none tracking-tight sm:text-2xl sm:leading-tight ${valueAccent}`
                          : 'break-words text-xl font-bold tabular-nums leading-none tracking-tight text-app-fg sm:text-2xl sm:leading-tight'
                      }
                    >
                      {item.value}
                    </p>
                    <p
                      className={
                        glassShell
                          ? 'w-full min-w-0 text-[11px] font-medium leading-snug text-white/65 sm:text-[12px] sm:leading-snug'
                          : kpiTileSubLine
                      }
                    >
                      {item.sub}
                    </p>
                    {item.bollePendingHref && item.bollePendingCta && k.bolleInAttesa > 0 ? (
                      <span
                        role="link"
                        tabIndex={online ? 0 : -1}
                        className={`mt-0.5 inline-flex w-fit max-w-full rounded-md text-left text-[11px] font-semibold leading-snug underline decoration-indigo-400/50 underline-offset-2 transition-colors sm:text-[12px] ${
                          online
                            ? 'cursor-pointer text-indigo-100 hover:text-white hover:decoration-white/80'
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
                      <p
                        className={
                          glassShell
                            ? 'w-full min-w-0 text-[11px] font-medium leading-snug text-emerald-200/95 sm:text-[12px] sm:leading-snug'
                            : 'w-full min-w-0 text-[11px] font-medium leading-snug text-emerald-300/85 sm:text-[12px] sm:leading-snug'
                        }
                      >
                        {item.microSub}
                      </p>
                    ) : null}
                    {item.duplicateInvoiceSub ? (
                      <p className="w-full min-w-0 text-[11px] font-semibold leading-snug text-orange-300 drop-shadow-[0_0_8px_rgba(251,146,60,0.45)] sm:text-[12px] sm:leading-snug">
                        {item.duplicateInvoiceSub}
                      </p>
                    ) : null}
                    {item.duplicateBolleSub ? (
                      <p className="w-full min-w-0 text-[11px] font-semibold leading-snug text-orange-300 drop-shadow-[0_0_8px_rgba(251,146,60,0.45)] sm:text-[12px] sm:leading-snug">
                        {item.duplicateBolleSub}
                      </p>
                    ) : null}
                  </div>
                </div>
              </>
            )

            const shellClass = [
              `operator-kpi-card relative z-[1] flex h-full min-h-0 min-w-0 w-full flex-col overflow-hidden rounded-2xl touch-manipulation ${OPERATOR_KPI_CARD_MIN_H} transition-[transform,border-color,background-color] duration-200`,
              glassShell ? 'ring-0' : `${item.borderClass} ${item.ringClass} ${item.hoverClass}`,
              glassShell ? '' : online ? 'hover:bg-white/[0.07]' : '',
              cardInteractive,
            ]
              .filter(Boolean)
              .join(' ')
            const shellStyle: CSSProperties | undefined = glassShell ? undefined : { boxShadow: operatorKpiCardShadow() }

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
