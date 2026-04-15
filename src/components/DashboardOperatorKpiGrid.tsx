import Link from 'next/link'
import { formatCurrency } from '@/lib/locale-shared'
import type { OperatorDashboardKpis } from '@/lib/dashboard-operator-kpis'
import type { Translations, Locale } from '@/lib/translations'
import type { ReactNode } from 'react'
import KpiLAccentOverlay from '@/components/KpiLAccentOverlay'
import { operatorKpiVisual } from '@/lib/kpi-accent-palette'
import { withFiscalYearQuery } from '@/lib/fiscal-link'

/** Alone KPI: alone dominante sul colore della card (non più cyan fisso). */
function operatorKpiCardShadow(glowRgb: string) {
  return [
    `0 0 0 1px rgba(${glowRgb},0.14)`,
    `0 0 44px -14px rgba(${glowRgb},0.22)`,
    `0 0 40px -10px rgba(${glowRgb},0.4)`,
    '0 18px 40px -12px rgba(0,0,0,0.48)',
  ].join(', ')
}

const kpiGridPanelClass = [
  'app-card',
  /* Sotto: allineato alle altre card (md:mb-8); evita mb-10 + gap pagina sulla dashboard */
  'mb-6 md:mb-8',
  'px-3 py-2.5 sm:px-4 sm:py-3 md:px-5 md:py-3.5',
].join(' ')

export function DashboardOperatorKpiSkeleton() {
  return (
    <div className={kpiGridPanelClass}>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 md:gap-3.5 xl:grid-cols-4 xl:gap-4">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
          const ov = operatorKpiVisual[i]
          return (
            <div
              key={i}
              className={`operator-kpi-card relative flex animate-pulse flex-col overflow-hidden rounded-2xl ${ov.borderClass} ${ov.ringClass}`}
              style={{ boxShadow: operatorKpiCardShadow(ov.glowRgb) }}
            >
              <KpiLAccentOverlay accentHex={ov.accentHex} edgePx={4} />
              <div className="relative z-[1] grid min-h-[5.5rem] flex-1 grid-cols-[minmax(0,1fr)_auto] grid-rows-[minmax(2rem,auto)_minmax(2.75rem,auto)] gap-x-2 gap-y-2 p-3.5 sm:min-h-[5.75rem] sm:p-4">
                <div className="col-start-1 row-start-1 flex items-center">
                  <div className="h-3 w-4/5 max-w-[9rem] rounded bg-slate-700/80" />
                </div>
                <div className="col-start-2 row-start-1 h-6 w-6 shrink-0 justify-self-end rounded-lg bg-slate-700/80" />
                <div className="col-start-1 row-start-2 flex min-w-0 items-end gap-2">
                  <div className="h-7 w-11 shrink-0 rounded bg-slate-700/80 sm:h-8 sm:w-12" />
                  <div className="h-3 min-h-[2rem] flex-1 rounded bg-slate-700/80" />
                </div>
                <div className="col-start-2 row-start-2 h-3.5 w-3.5 shrink-0 self-end justify-self-end rounded bg-slate-700/80" />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

type KpiItem = {
  href: string
  label: string
  value: string | number
  sub: string
  subClass: string
  accentHex: string
  glowRgb: string
  borderClass: string
  ringClass: string
  hoverClass: string
  chevronClass: string
  icon: ReactNode
}

export default function DashboardOperatorKpiGrid({
  kpis: k,
  t,
  locale,
  currency,
  hideBelowLg = false,
  fiscalYear,
}: {
  kpis: OperatorDashboardKpis
  t: Translations
  locale: Locale
  currency: string
  /** Sotto 1024px nasconde tutta la griglia (evita che resti visibile se il layout padre viene sovrascritto). */
  hideBelowLg?: boolean
  /** Se impostato, aggiunge `?fy=` (e `tutte=1` su Bolle) ai link delle schede. */
  fiscalYear?: number
}) {
  const fy = fiscalYear
  let stmtSub: string
  let stmtSubClass: string
  if (k.statementsTotal === 0) {
    stmtSub = t.dashboard.kpiStatementNone
    stmtSubClass = 'text-slate-100'
  } else if (k.statementsWithIssues === 0) {
    stmtSub = t.dashboard.kpiStatementAllOk
    stmtSubClass = 'text-emerald-300'
  } else {
    stmtSub = t.dashboard.kpiStatementIssuesFooter.replace('{t}', String(k.statementsTotal))
    stmtSubClass = 'text-amber-300'
  }

  const ov = operatorKpiVisual

  const items: KpiItem[] = [
    {
      href: '/fornitori',
      label: t.nav.fornitori,
      value: k.fornitoriCount,
      sub: t.dashboard.kpiFornitoriSub,
      subClass: ov[0].subIdleClass,
      accentHex: ov[0].accentHex,
      glowRgb: ov[0].glowRgb,
      borderClass: ov[0].borderClass,
      ringClass: ov[0].ringClass,
      hoverClass: ov[0].hoverClass,
      chevronClass: ov[0].chevronClass,
      icon: (
        <svg
          className={`h-5 w-5 ${ov[0].iconClass} ${ov[0].iconDropShadow}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
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
      href: '/statements/da-processare',
      label: t.fornitori.kpiPending,
      value: k.documentiPending,
      sub: t.dashboard.kpiDaProcessareSub,
      subClass: k.documentiPending > 0 ? ov[1].subPositiveClass! : ov[1].subIdleClass,
      accentHex: ov[1].accentHex,
      glowRgb: ov[1].glowRgb,
      borderClass: ov[1].borderClass,
      ringClass: ov[1].ringClass,
      hoverClass: ov[1].hoverClass,
      chevronClass: ov[1].chevronClass,
      icon: (
        <svg
          className={`h-5 w-5 ${ov[1].iconClass} ${ov[1].iconDropShadow}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      href: withFiscalYearQuery('/ordini', fy),
      label: t.fornitori.kpiOrdini,
      value: k.ordiniCount,
      sub: t.dashboard.kpiOrdiniSub,
      subClass: k.ordiniCount > 0 ? ov[2].subPositiveClass! : ov[2].subIdleClass,
      accentHex: ov[2].accentHex,
      glowRgb: ov[2].glowRgb,
      borderClass: ov[2].borderClass,
      ringClass: ov[2].ringClass,
      hoverClass: ov[2].hoverClass,
      chevronClass: ov[2].chevronClass,
      icon: (
        <svg
          className={`h-5 w-5 ${ov[2].iconClass} ${ov[2].iconDropShadow}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
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
      sub: `${k.bolleInAttesa} ${t.fornitori.subAperte}`,
      subClass: k.bolleInAttesa > 0 ? ov[3].subPositiveClass! : ov[3].subIdleClass,
      accentHex: ov[3].accentHex,
      glowRgb: ov[3].glowRgb,
      borderClass: ov[3].borderClass,
      ringClass: ov[3].ringClass,
      hoverClass: ov[3].hoverClass,
      chevronClass: ov[3].chevronClass,
      icon: (
        <svg
          className={`h-5 w-5 ${ov[3].iconClass} ${ov[3].iconDropShadow}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
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
      label: t.fornitori.kpiFatture,
      value: k.fattureCount,
      sub: t.fornitori.subConfermate,
      subClass: ov[4].subIdleClass,
      accentHex: ov[4].accentHex,
      glowRgb: ov[4].glowRgb,
      borderClass: ov[4].borderClass,
      ringClass: ov[4].ringClass,
      hoverClass: ov[4].hoverClass,
      chevronClass: ov[4].chevronClass,
      icon: (
        <svg
          className={`h-5 w-5 ${ov[4].iconClass} ${ov[4].iconDropShadow}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
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
      value: k.statementsWithIssues,
      sub: stmtSub,
      subClass: stmtSubClass,
      accentHex: ov[5].accentHex,
      glowRgb: ov[5].glowRgb,
      borderClass: ov[5].borderClass,
      ringClass: ov[5].ringClass,
      hoverClass: ov[5].hoverClass,
      chevronClass: ov[5].chevronClass,
      icon: (
        <svg
          className={`h-5 w-5 ${ov[5].iconClass} ${ov[5].iconDropShadow}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
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
      label: t.fornitori.tabListino,
      value: k.listinoRows,
      sub: t.dashboard.kpiPriceListSub,
      subClass: k.listinoRows > 0 ? ov[6].subPositiveClass! : ov[6].subIdleClass,
      accentHex: ov[6].accentHex,
      glowRgb: ov[6].glowRgb,
      borderClass: ov[6].borderClass,
      ringClass: ov[6].ringClass,
      hoverClass: ov[6].hoverClass,
      chevronClass: ov[6].chevronClass,
      icon: (
        <svg
          className={`h-5 w-5 ${ov[6].iconClass} ${ov[6].iconDropShadow}`}
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
      href: withFiscalYearQuery('/fatture/riepilogo', fy),
      label: t.common.total,
      value: formatCurrency(k.totaleImporto, currency, locale),
      sub: `${k.fattureCount} ${t.nav.fatture.toLowerCase()}`,
      subClass: ov[7].subIdleClass,
      accentHex: ov[7].accentHex,
      glowRgb: ov[7].glowRgb,
      borderClass: ov[7].borderClass,
      ringClass: ov[7].ringClass,
      hoverClass: ov[7].hoverClass,
      chevronClass: ov[7].chevronClass,
      icon: (
        <svg
          className={`h-5 w-5 ${ov[7].iconClass} ${ov[7].iconDropShadow}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
  ]

  const panel = (
    <div className={kpiGridPanelClass}>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 md:gap-3.5 xl:grid-cols-4 xl:gap-4">
        {items.map((item) => (
          <Link
            key={`${item.href}-${item.label}`}
            href={item.href}
            className={`operator-kpi-card group relative flex flex-col overflow-hidden rounded-2xl ${item.borderClass} ${item.ringClass} transition-[transform,box-shadow,border-color,background-color] duration-200 hover:bg-slate-700/90 ${item.hoverClass} active:scale-[0.99]`}
            style={{ boxShadow: operatorKpiCardShadow(item.glowRgb) }}
          >
            <KpiLAccentOverlay accentHex={item.accentHex} edgePx={4} />
            <div className="relative z-[1] grid min-h-[5.5rem] flex-1 grid-cols-[minmax(0,1fr)_auto] grid-rows-[minmax(2rem,auto)_minmax(2.75rem,auto)] gap-x-2 gap-y-2 p-3.5 sm:min-h-[5.75rem] sm:p-4">
              <p className="col-start-1 row-start-1 min-w-0 self-center text-[10px] font-semibold uppercase leading-tight tracking-wide text-white/95 line-clamp-2 sm:text-xs [text-shadow:0_0_14px_rgba(255,255,255,0.08)]">
                {item.label}
              </p>
              <span className="col-start-2 row-start-1 shrink-0 self-start justify-self-end pt-0.5">{item.icon}</span>
              <div className="col-start-1 row-start-2 flex min-w-0 flex-row flex-nowrap items-end gap-x-2">
                <p className="shrink-0 text-xl font-bold tabular-nums text-white sm:text-2xl xl:text-3xl [text-shadow:0_0_20px_rgba(255,255,255,0.06)]">
                  {item.value}
                </p>
                <p
                  className={`min-h-[2rem] min-w-0 flex-1 text-[10px] leading-snug sm:text-xs ${item.subClass} line-clamp-2 break-words`}
                >
                  {item.sub}
                </p>
              </div>
              <svg
                className={`col-start-2 row-start-2 h-3.5 w-3.5 shrink-0 self-end justify-self-end ${item.chevronClass}`}
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
  )

  if (hideBelowLg) {
    return <div className="operator-kpi-grid-desktop-only">{panel}</div>
  }

  return panel
}