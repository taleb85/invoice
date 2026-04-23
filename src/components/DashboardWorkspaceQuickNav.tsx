'use client'

import Link from 'next/link'
import type { Translations } from '@/lib/translations'
import { withFiscalYearQuery } from '@/lib/fiscal-link'

/** Chip compatti: altezza ridotta e padding stretto per stare tutti su una riga senza troncamento. */
const QUICK_NAV_LINK_BASE =
  'inline-flex h-7 min-h-7 shrink-0 items-center gap-0.5 rounded-md border border-app-line-28 app-workspace-inset-bg-soft px-2 py-0 font-semibold leading-none no-underline transition-[background-color,border-color,box-shadow,transform] duration-200 hover:border-app-line-40 hover:bg-app-line-12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950 active:scale-[0.99]'

export type WorkspaceQuickNavCounts = {
  ordini: number
  bolle: number
  fatture: number
  statements: number
  listino: number
  documenti: number
}

/**
 * Link alle stesse rotte delle tile KPI dashboard (`DashboardOperatorKpiGrid`), per la strip desktop.
 * Badge numerici opzionali = stessi conteggi KPI DB.
 */
export default function DashboardWorkspaceQuickNav({
  t,
  fiscalYear,
  counts,
}: {
  t: Translations
  fiscalYear: number
  /** Conteggi server (`fetchOperatorDashboardKpis`) — stessi numeri delle tile KPI. */
  counts?: WorkspaceQuickNavCounts | null
}) {
  const fy = fiscalYear > 0 ? fiscalYear : undefined
  const items: { href: string; label: string; badge?: number }[] = [
    { href: withFiscalYearQuery('/ordini', fy), label: t.fornitori.kpiOrdini, badge: counts?.ordini },
    { href: withFiscalYearQuery('/bolle', fy, { tutte: '1' }), label: t.fornitori.kpiBolleTotal, badge: counts?.bolle },
    { href: withFiscalYearQuery('/fatture', fy), label: t.fornitori.kpiFatturatoPeriodo, badge: counts?.fatture },
    { href: withFiscalYearQuery('/statements/verifica', fy), label: t.statements.tabVerifica, badge: counts?.statements },
    { href: withFiscalYearQuery('/listino', fy), label: t.fornitori.tabListino, badge: counts?.listino },
    {
      href: withFiscalYearQuery('/statements/da-processare', fy),
      label: t.statements.tabDocumenti,
      badge: counts?.documenti,
    },
  ]

  return (
    <nav
      className="flex min-h-0 min-w-0 max-w-full flex-1 items-center gap-1 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label={t.dashboard.workspaceQuickNavAria}
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          title={item.label}
          className={`${QUICK_NAV_LINK_BASE} min-w-0 shrink`}
        >
          {item.badge != null && item.badge > 0 ? (
            <span className="inline-flex h-3.5 min-w-3.5 shrink-0 items-center justify-center rounded-sm px-0.5 text-[8px] font-bold tabular-nums ring-1 ring-inset bg-app-line-20 text-app-fg ring-app-line-30">
              {item.badge > 999 ? '999+' : item.badge}
            </span>
          ) : null}
          <span className="min-w-0 whitespace-nowrap text-left text-[11px] font-bold uppercase tracking-wide text-app-fg-muted">
            {item.label}
          </span>
        </Link>
      ))}
    </nav>
  )
}
