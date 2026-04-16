'use client'

import Link from 'next/link'
import type { Translations } from '@/lib/translations'
import { withFiscalYearQuery } from '@/lib/fiscal-link'

/** Stessi toni `supplierKpiPalette` delle glyph rimosse (ordini → documenti). */
const QUICK_NAV_LABEL_CLASS = [
  'text-rose-300 drop-shadow-[0_0_10px_rgba(244,63,94,0.5)]',
  'text-indigo-300 drop-shadow-[0_0_10px_rgba(129,140,248,0.48)]',
  'text-emerald-300 drop-shadow-[0_0_10px_rgba(52,211,153,0.48)]',
  'text-cyan-300 drop-shadow-[0_0_10px_rgba(34,211,238,0.48)]',
  'text-fuchsia-300 drop-shadow-[0_0_10px_rgba(217,70,239,0.5)]',
  'text-amber-300 drop-shadow-[0_0_12px_rgba(251,191,36,0.55)]',
] as const

const QUICK_NAV_BADGE_CLASS = [
  'bg-rose-400/25 text-rose-100 ring-rose-300/35',
  'bg-indigo-400/25 text-indigo-100 ring-indigo-300/35',
  'bg-emerald-400/25 text-emerald-100 ring-emerald-300/35',
  'bg-cyan-400/25 text-cyan-100 ring-cyan-300/35',
  'bg-fuchsia-400/25 text-fuchsia-100 ring-fuchsia-300/35',
  'bg-amber-400/25 text-amber-100 ring-amber-300/35',
] as const

/** Bordo / fondo / alone proporzionati al testo molto piccolo (non il chrome `ActionButton` nav). */
const QUICK_NAV_FRAME_CLASS = [
  'border border-rose-400/35 bg-rose-950/40 shadow-[inset_0_0_0_1px_rgba(244,63,94,0.12)] hover:border-rose-300/50 hover:bg-rose-950/55',
  'border border-indigo-400/35 bg-indigo-950/40 shadow-[inset_0_0_0_1px_rgba(129,140,248,0.12)] hover:border-indigo-300/50 hover:bg-indigo-950/55',
  'border border-emerald-400/35 bg-emerald-950/40 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.12)] hover:border-emerald-300/50 hover:bg-emerald-950/55',
  'border border-cyan-400/35 bg-cyan-950/40 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.12)] hover:border-cyan-300/50 hover:bg-cyan-950/55',
  'border border-fuchsia-400/35 bg-fuchsia-950/40 shadow-[inset_0_0_0_1px_rgba(217,70,239,0.12)] hover:border-fuchsia-300/50 hover:bg-fuchsia-950/55',
  'border border-amber-400/35 bg-amber-950/40 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.14)] hover:border-amber-300/50 hover:bg-amber-950/55',
] as const

/** Stessa altezza riga dei pulsanti toolbar (`h-7` in duplicati / solleciti / sync email). */
const QUICK_NAV_LINK_BASE =
  'inline-flex h-7 min-h-7 max-h-7 shrink-0 items-center gap-1 rounded-md border px-2 py-0 font-semibold leading-none no-underline transition-[background-color,border-color,box-shadow,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950 active:scale-[0.99] sm:px-2.5'

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
      className="flex min-h-0 min-w-0 max-w-full flex-1 items-center gap-1 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-1.5"
      aria-label={t.dashboard.workspaceQuickNavAria}
    >
      {items.map((item, index) => (
        <Link
          key={item.href}
          href={item.href}
          title={item.label}
          className={`${QUICK_NAV_LINK_BASE} ${QUICK_NAV_FRAME_CLASS[index]!} max-w-[9rem] min-w-0 sm:max-w-[11rem] md:max-w-[12rem]`}
        >
          {item.badge != null && item.badge > 0 ? (
            <span
              className={`inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-sm px-1 text-[9px] font-bold tabular-nums ring-1 ring-inset sm:min-w-[1.125rem] sm:text-[10px] ${QUICK_NAV_BADGE_CLASS[index]!}`}
            >
              {item.badge > 999 ? '999+' : item.badge}
            </span>
          ) : null}
          <span
            className={`min-w-0 flex-1 truncate text-left text-[10px] font-bold uppercase tracking-wide sm:text-[11px] ${QUICK_NAV_LABEL_CLASS[index]!}`}
          >
            {item.label}
          </span>
        </Link>
      ))}
    </nav>
  )
}
