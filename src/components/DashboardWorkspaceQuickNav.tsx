import Link from 'next/link'
import type { ReactNode } from 'react'
import type { Translations } from '@/lib/translations'
import { withFiscalYearQuery } from '@/lib/fiscal-link'
import { operatorKpiVisual, supplierKpiPalette } from '@/lib/kpi-accent-palette'
import { actionButtonClassName } from '@/components/ui/ActionButton'

/** Allinea accenti `operatorKpiVisual` all’ordine tile (come `DashboardOperatorKpiGrid`). */
const OPERATOR_KPI_VISUAL_INDEX = [2, 3, 4, 5, 6, 1] as const

function operatorKpiVisualAt(tileIndex: number) {
  return operatorKpiVisual[OPERATOR_KPI_VISUAL_INDEX[tileIndex]!]
}

/** Stessi indici / tinte delle tile `DashboardOperatorKpiGrid`. */
const TILE_ICON_KEYS: (keyof typeof supplierKpiPalette)[] = [
  'conferme',
  'bolle',
  'fatture',
  'verifica',
  'listino',
  'documenti',
]

function tileIconSvgClass(index: number) {
  const key = TILE_ICON_KEYS[index]!
  const p = supplierKpiPalette[key]
  return `${p.iconClass} ${p.iconDropShadow}`
}

function TileGlyph({ index }: { index: number }) {
  const c = `h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5 ${tileIconSvgClass(index)}`
  const glyphs: ReactNode[] = [
    <svg key="o" className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
    </svg>,
    <svg key="b" className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
      />
    </svg>,
    <svg key="ft" className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>,
    <svg key="v" className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
      />
    </svg>,
    <svg key="l" className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h10M4 18h10" />
    </svg>,
    <svg key="d" className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>,
  ]
  return glyphs[index] ?? null
}

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
 * Stile allineato ai pulsanti `ActionButton` (intent `nav`); badge numerici opzionali = stessi conteggi KPI DB.
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
  const items: { href: string; label: string; i: number; badge?: number }[] = [
    { href: withFiscalYearQuery('/ordini', fy), label: t.fornitori.kpiOrdini, i: 0, badge: counts?.ordini },
    { href: withFiscalYearQuery('/bolle', fy, { tutte: '1' }), label: t.fornitori.kpiBolleTotal, i: 1, badge: counts?.bolle },
    { href: withFiscalYearQuery('/fatture', fy), label: t.fornitori.kpiFatturatoPeriodo, i: 2, badge: counts?.fatture },
    { href: withFiscalYearQuery('/statements/verifica', fy), label: t.statements.tabVerifica, i: 3, badge: counts?.statements },
    { href: withFiscalYearQuery('/listino', fy), label: t.fornitori.tabListino, i: 4, badge: counts?.listino },
    {
      href: withFiscalYearQuery('/statements/da-processare', fy),
      label: t.statements.tabDocumenti,
      i: 5,
      badge: counts?.documenti,
    },
  ]

  const linkShell = `${actionButtonClassName('nav', 'sm')} max-w-[7.5rem] no-underline sm:max-w-[9rem]`

  return (
    <nav
      className="flex min-h-0 min-w-0 max-w-full flex-1 items-center gap-1 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-1.5"
      aria-label={t.dashboard.workspaceQuickNavAria}
    >
      {items.map((item) => (
        <Link
          key={`${item.href}-${item.i}`}
          href={item.href}
          title={item.label}
          className={`${linkShell} flex min-w-0 shrink-0 flex-col items-stretch gap-0.5 sm:flex-row sm:items-center`}
        >
          <span className="flex items-center gap-1">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md sm:h-7 sm:w-7 ${operatorKpiVisualAt(item.i).iconWrapClass}`}
            >
              <TileGlyph index={item.i} />
            </span>
            {item.badge != null && item.badge > 0 ? (
              <span className="inline-flex min-w-[1.125rem] justify-center rounded-full bg-cyan-400/25 px-1 text-[9px] font-bold tabular-nums text-cyan-100 ring-1 ring-cyan-300/35 sm:text-[10px]">
                {item.badge > 999 ? '999+' : item.badge}
              </span>
            ) : null}
          </span>
          <span className="min-w-0 truncate text-left text-[8px] font-bold uppercase leading-tight tracking-wide text-cyan-100/90 sm:text-[9px] md:text-[10px]">
            {item.label}
          </span>
        </Link>
      ))}
    </nav>
  )
}
