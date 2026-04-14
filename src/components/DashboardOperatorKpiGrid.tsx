import Link from 'next/link'
import { formatCurrency } from '@/lib/locale-shared'
import type { OperatorDashboardKpis } from '@/lib/dashboard-operator-kpis'
import type { Translations, Locale } from '@/lib/translations'
import type { ReactNode } from 'react'
import { desktopHeaderBarDefaultBorderColor, desktopHeaderBarDefaultFill } from '@/lib/desktop-header-bar-surface'

const skeletonAccents = ['#6366f1', '#f97316', '#ec4899', '#3b82f6', '#34d399', '#22d3ee', '#2dd4bf', '#a855f7'] as const

/** Alone KPI: versione ridotta rispetto al blocco precedente (circa metà intensità). */
function operatorKpiCardShadow(glowRgb: string) {
  return [
    '0 0 0 1px rgba(34,211,238,0.1)',
    '0 0 44px -14px rgba(34,211,238,0.18)',
    `0 0 40px -10px rgba(${glowRgb},0.4)`,
    '0 18px 40px -12px rgba(0,0,0,0.48)',
  ].join(', ')
}

const kpiGridPanelClass = `mb-10 rounded-2xl border px-3 py-3 sm:px-4 sm:py-4 md:px-5 md:py-4 ${desktopHeaderBarDefaultBorderColor} ${desktopHeaderBarDefaultFill}`

export function DashboardOperatorKpiSkeleton() {
  return (
    <div className={kpiGridPanelClass}>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
          const hex = skeletonAccents[i % skeletonAccents.length]
          const r = parseInt(hex.slice(1, 3), 16)
          const g = parseInt(hex.slice(3, 5), 16)
          const b = parseInt(hex.slice(5, 7), 16)
          return (
            <div
              key={i}
              className="operator-kpi-card flex animate-pulse flex-col overflow-hidden rounded-2xl border border-slate-600/40"
              style={{ boxShadow: operatorKpiCardShadow(`${r},${g},${b}`) }}
            >
              <div className="operator-kpi-card-bar shrink-0" aria-hidden />
              <div className="flex flex-1 flex-col p-4 sm:p-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="h-3 flex-1 rounded bg-slate-700/80" />
                  <div className="h-6 w-6 shrink-0 rounded-lg bg-slate-700/80" />
                </div>
                <div className="h-8 w-1/2 rounded bg-slate-700/80" />
                <div className="mt-1 flex items-center justify-between gap-2">
                  <div className="h-3 w-2/3 rounded bg-slate-700/80" />
                  <div className="h-3.5 w-3.5 shrink-0 rounded bg-slate-700/80" />
                </div>
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
  borderClass: string
  glowRgb: string
  icon: ReactNode
}

export default function DashboardOperatorKpiGrid({
  kpis: k,
  t,
  locale,
  currency,
}: {
  kpis: OperatorDashboardKpis
  t: Translations
  locale: Locale
  currency: string
}) {
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

  const items: KpiItem[] = [
    {
      href: '/fornitori',
      label: t.nav.fornitori,
      value: k.fornitoriCount,
      sub: t.dashboard.kpiFornitoriSub,
      subClass: 'text-indigo-100/90',
      borderClass: 'border-indigo-500/32',
      glowRgb: '99,102,241',
      icon: (
        <svg
          className="h-5 w-5 text-indigo-400 drop-shadow-[0_0_8px_rgba(129,140,248,0.35)]"
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
      subClass: k.documentiPending > 0 ? 'text-orange-300' : 'text-slate-100',
      borderClass: 'border-orange-500/32',
      glowRgb: '249,115,22',
      icon: (
        <svg
          className="h-5 w-5 text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.35)]"
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
      href: '/ordini',
      label: t.fornitori.kpiOrdini,
      value: k.ordiniCount,
      sub: t.dashboard.kpiOrdiniSub,
      subClass: k.ordiniCount > 0 ? 'text-pink-100/90' : 'text-slate-100',
      borderClass: 'border-pink-500/32',
      glowRgb: '236,72,153',
      icon: (
        <svg
          className="h-5 w-5 text-pink-400 drop-shadow-[0_0_8px_rgba(244,114,182,0.4)]"
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
      href: '/bolle',
      label: t.fornitori.kpiBolleTotal,
      value: k.bolleTotal,
      sub: `${k.bolleInAttesa} ${t.fornitori.subAperte}`,
      subClass: k.bolleInAttesa > 0 ? 'text-amber-300' : 'text-blue-100/85',
      borderClass: 'border-blue-500/32',
      glowRgb: '59,130,246',
      icon: (
        <svg
          className="h-5 w-5 text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.38)]"
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
      href: '/fatture',
      label: t.fornitori.kpiFatture,
      value: k.fattureCount,
      sub: t.fornitori.subConfermate,
      subClass: 'text-emerald-100/90',
      borderClass: 'border-emerald-500/32',
      glowRgb: '52,211,153',
      icon: (
        <svg
          className="h-5 w-5 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.38)]"
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
      href: '/statements/verifica',
      label: t.statements.tabVerifica,
      value: k.statementsWithIssues,
      sub: stmtSub,
      subClass: stmtSubClass,
      borderClass: 'border-cyan-500/32',
      glowRgb: '34,211,238',
      icon: (
        <svg
          className="h-5 w-5 text-cyan-400 drop-shadow-[0_0_8px_rgba(103,232,249,0.38)]"
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
      href: '/listino',
      label: t.fornitori.tabListino,
      value: k.listinoRows,
      sub: t.dashboard.kpiPriceListSub,
      subClass: k.listinoRows > 0 ? 'text-teal-100/90' : 'text-slate-200',
      borderClass: 'border-teal-500/32',
      glowRgb: '20,184,166',
      icon: (
        <svg
          className="h-5 w-5 text-teal-400 drop-shadow-[0_0_8px_rgba(45,212,191,0.35)]"
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
      href: '/fatture/riepilogo',
      label: t.common.total,
      value: formatCurrency(k.totaleImporto, currency, locale),
      sub: `${k.fattureCount} ${t.nav.fatture.toLowerCase()}`,
      subClass: 'text-purple-100/90',
      borderClass: 'border-purple-500/32',
      glowRgb: '192,132,252',
      icon: (
        <svg
          className="h-5 w-5 text-purple-400 drop-shadow-[0_0_8px_rgba(192,132,252,0.38)]"
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

  return (
    <div className={kpiGridPanelClass}>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => (
          <Link
            key={`${item.href}-${item.label}`}
            href={item.href}
            className={`operator-kpi-card group flex flex-col overflow-hidden rounded-2xl border ${item.borderClass} transition-[transform,box-shadow,border-color,background-color] duration-200 hover:border-cyan-400/38 hover:bg-slate-700/90 hover:shadow-[0_0_0_1px_rgba(103,232,249,0.12)] active:scale-[0.99]`}
            style={{ boxShadow: operatorKpiCardShadow(item.glowRgb) }}
          >
            <div className="operator-kpi-card-bar shrink-0" aria-hidden />
            <div className="flex flex-1 flex-col p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase leading-tight tracking-wide text-white/95 sm:text-xs [text-shadow:0_0_14px_rgba(255,255,255,0.08)]">
                  {item.label}
                </p>
                <span className="shrink-0">{item.icon}</span>
              </div>
              <p className="break-words text-2xl font-bold tabular-nums text-white sm:text-3xl [text-shadow:0_0_20px_rgba(255,255,255,0.06)]">
                {item.value}
              </p>
              <div className="mt-1 flex items-end justify-between gap-2">
                <p className={`min-w-0 text-[10px] leading-snug sm:text-xs ${item.subClass}`}>{item.sub}</p>
                <svg
                  className="h-3.5 w-3.5 shrink-0 text-cyan-400/70 transition-colors group-hover:text-cyan-200 group-hover:drop-shadow-[0_0_5px_rgba(103,232,249,0.35)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}