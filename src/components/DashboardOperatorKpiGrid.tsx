import Link from 'next/link'
import { formatCurrency } from '@/lib/locale-shared'
import type { OperatorDashboardKpis } from '@/lib/dashboard-operator-kpis'
import type { Translations, Locale } from '@/lib/translations'
import type { ReactNode } from 'react'

const skeletonAccents = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#14b8a6', '#0ea5e9'] as const

export function DashboardOperatorKpiSkeleton() {
  return (
    <div className="mb-10 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="app-card animate-pulse overflow-hidden rounded-xl border border-slate-700/50 bg-slate-900/45 p-4 backdrop-blur-md sm:p-5"
          style={{ boxShadow: `0 0 24px -12px ${skeletonAccents[i]}55` }}
        >
          <div className="app-card-bar mb-3" aria-hidden />
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
      ))}
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
    stmtSubClass = 'text-slate-400'
  } else if (k.statementsWithIssues === 0) {
    stmtSub = t.dashboard.kpiStatementAllOk
    stmtSubClass = 'text-emerald-400'
  } else {
    stmtSub = t.dashboard.kpiStatementIssuesFooter.replace('{t}', String(k.statementsTotal))
    stmtSubClass = 'text-amber-400'
  }

  const items: KpiItem[] = [
    {
      href: '/bolle',
      label: t.fornitori.kpiBolleTotal,
      value: k.bolleTotal,
      sub: `${k.bolleInAttesa} ${t.fornitori.subAperte}`,
      subClass: k.bolleInAttesa > 0 ? 'text-amber-400' : 'text-slate-400',
      borderClass: 'border-cyan-500/25',
      glowRgb: '6,182,212',
      icon: (
        <svg className="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
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
      subClass: 'text-slate-400',
      borderClass: 'border-emerald-500/25',
      glowRgb: '16,185,129',
      icon: (
        <svg className="h-5 w-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
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
      href: '/archivio',
      label: t.fornitori.kpiPending,
      value: k.documentiDaAssociare,
      sub: t.fornitori.subDaAbbinare,
      subClass: k.documentiDaAssociare > 0 ? 'text-amber-400' : 'text-slate-400',
      borderClass: 'border-amber-500/25',
      glowRgb: '245,158,11',
      icon: (
        <svg className="h-5 w-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      href: '/fatture',
      label: t.common.total,
      value: formatCurrency(k.totaleImporto, currency, locale),
      sub: `${k.fattureCount} ${t.nav.fatture.toLowerCase()}`,
      subClass: 'text-slate-400',
      borderClass: 'border-violet-500/25',
      glowRgb: '168,85,247',
      icon: (
        <svg className="h-5 w-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    {
      href: '/fornitori',
      label: t.fornitori.tabListino,
      value: k.listinoRows,
      sub: t.dashboard.kpiPriceListSub,
      subClass: k.listinoRows > 0 ? 'text-slate-400' : 'text-slate-500',
      borderClass: 'border-teal-500/25',
      glowRgb: '20,184,166',
      icon: (
        <svg className="h-5 w-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h10M4 18h10" />
        </svg>
      ),
    },
    {
      href: '/statements',
      label: t.statements.tabVerifica,
      value: k.statementsWithIssues,
      sub: stmtSub,
      subClass: stmtSubClass,
      borderClass: 'border-sky-500/25',
      glowRgb: '14,165,233',
      icon: (
        <svg className="h-5 w-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          />
        </svg>
      ),
    },
  ]

  return (
    <div className="mb-10 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
      {items.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className={`app-card group overflow-hidden rounded-xl border ${item.borderClass} bg-slate-900/45 p-4 shadow-black/20 backdrop-blur-md transition-all hover:border-opacity-40 hover:shadow-lg active:scale-[0.99] sm:p-5`}
          style={{
            boxShadow: `0 0 28px -12px rgba(${item.glowRgb},0.45), 0 4px 24px -8px rgba(0,0,0,0.45)`,
          }}
        >
          <div className="app-card-bar" aria-hidden />
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-[10px] font-medium uppercase leading-tight tracking-wide text-slate-400 sm:text-xs">{item.label}</p>
            <span className="shrink-0">{item.icon}</span>
          </div>
          <p className="break-words text-2xl font-bold tabular-nums text-slate-100 sm:text-3xl">{item.value}</p>
          <div className="mt-1 flex items-end justify-between gap-2">
            <p className={`min-w-0 text-[10px] leading-snug sm:text-xs ${item.subClass}`}>{item.sub}</p>
            <svg
              className="h-3.5 w-3.5 shrink-0 text-slate-600 transition-colors group-hover:text-slate-400"
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
  )
}
