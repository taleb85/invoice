import Link from 'next/link'
import type { ReactNode } from 'react'
import type { Translations } from '@/lib/translations'
import { withFiscalYearQuery } from '@/lib/fiscal-link'
import { operatorKpiVisual, supplierKpiPalette } from '@/lib/kpi-accent-palette'

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

/**
 * Link alle stesse rotte delle tile KPI dashboard (`DashboardOperatorKpiGrid`), per la strip desktop.
 * Icona + etichetta (troncata); `title` per il testo completo al passaggio del mouse.
 */
export default function DashboardWorkspaceQuickNav({
  t,
  fiscalYear,
}: {
  t: Translations
  fiscalYear: number
}) {
  const fy = fiscalYear > 0 ? fiscalYear : undefined
  const items: { href: string; label: string; i: number }[] = [
    { href: withFiscalYearQuery('/ordini', fy), label: t.fornitori.kpiOrdini, i: 0 },
    { href: withFiscalYearQuery('/bolle', fy, { tutte: '1' }), label: t.fornitori.kpiBolleTotal, i: 1 },
    { href: withFiscalYearQuery('/fatture', fy), label: t.fornitori.kpiFatturatoPeriodo, i: 2 },
    { href: withFiscalYearQuery('/statements/verifica', fy), label: t.statements.tabVerifica, i: 3 },
    { href: withFiscalYearQuery('/listino', fy), label: t.fornitori.tabListino, i: 4 },
    { href: withFiscalYearQuery('/statements/da-processare', fy), label: t.statements.tabDocumenti, i: 5 },
  ]

  return (
    <nav
      className="flex min-h-0 min-w-0 max-w-full flex-1 items-center gap-0.5 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-0.5 md:gap-1"
      aria-label={t.dashboard.workspaceQuickNavAria}
    >
      {items.map((item) => (
        <Link
          key={`${item.href}-${item.i}`}
          href={item.href}
          title={item.label}
          className="flex shrink-0 items-center gap-0.5 rounded-md border border-transparent px-0.5 py-0 text-app-fg-muted transition-colors hover:border-app-line-35 hover:bg-app-line-10 hover:text-app-fg sm:gap-0.5 sm:rounded-lg sm:px-1 sm:py-px md:gap-1 md:px-1.5"
        >
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded sm:h-5 sm:w-5 md:h-6 md:w-6 ${operatorKpiVisualAt(item.i).iconWrapClass}`}
          >
            <TileGlyph index={item.i} />
          </span>
          <span className="min-w-0 max-w-[4.75rem] truncate text-left text-[8px] font-semibold uppercase leading-tight tracking-wide text-app-fg-muted sm:max-w-[5.5rem] sm:text-[9px] md:max-w-[6.25rem] md:text-[10px] lg:max-w-[8rem]">
            {item.label}
          </span>
        </Link>
      ))}
    </nav>
  )
}
