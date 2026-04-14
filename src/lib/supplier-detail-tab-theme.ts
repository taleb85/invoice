import { SUMMARY_HIGHLIGHT_ACCENTS } from '@/lib/summary-highlight-accent'

/**
 * Barra superiore `.app-card-bar` + bordo card allineati ai KPI della scheda fornitore
 * (`buildSupplierKpiItems` in `fornitori/[id]/page.tsx`).
 */
export const SUPPLIER_DETAIL_TAB_HIGHLIGHT = {
  dashboard: SUMMARY_HIGHLIGHT_ACCENTS.cyan,
  conferme: SUMMARY_HIGHLIGHT_ACCENTS.rose,
  bolle: SUMMARY_HIGHLIGHT_ACCENTS.indigo,
  fatture: SUMMARY_HIGHLIGHT_ACCENTS.emerald,
  verifica: SUMMARY_HIGHLIGHT_ACCENTS.cyan,
  listino: SUMMARY_HIGHLIGHT_ACCENTS.lime,
  documenti: SUMMARY_HIGHLIGHT_ACCENTS.amber,
} as const

export type SupplierDetailTabKey = keyof typeof SUPPLIER_DETAIL_TAB_HIGHLIGHT

/** Tabella «riepilogo per mese»: stessi accenti della card del tab attivo (fatture, bolle, …). */
export const SUPPLIER_DETAIL_TAB_TABLE_ACCENT: Record<
  SupplierDetailTabKey,
  {
    selectionRow: string
    monthSelected: string
    cellHover: string
    focusRing: string
    resetNav: string
  }
> = {
  dashboard: {
    selectionRow: 'bg-cyan-500/10',
    monthSelected: 'text-cyan-200',
    cellHover: 'hover:text-cyan-200',
    focusRing: 'focus-visible:ring-cyan-500/40',
    resetNav: 'text-cyan-400 hover:text-cyan-300',
  },
  conferme: {
    selectionRow: 'bg-rose-500/10',
    monthSelected: 'text-rose-200',
    cellHover: 'hover:text-rose-200',
    focusRing: 'focus-visible:ring-rose-500/40',
    resetNav: 'text-rose-400 hover:text-rose-300',
  },
  bolle: {
    selectionRow: 'bg-indigo-500/10',
    monthSelected: 'text-indigo-200',
    cellHover: 'hover:text-indigo-200',
    focusRing: 'focus-visible:ring-indigo-500/40',
    resetNav: 'text-indigo-400 hover:text-indigo-300',
  },
  fatture: {
    selectionRow: 'bg-emerald-500/10',
    monthSelected: 'text-emerald-200',
    cellHover: 'hover:text-emerald-200',
    focusRing: 'focus-visible:ring-emerald-500/40',
    resetNav: 'text-emerald-400 hover:text-emerald-300',
  },
  verifica: {
    selectionRow: 'bg-cyan-500/10',
    monthSelected: 'text-cyan-200',
    cellHover: 'hover:text-cyan-200',
    focusRing: 'focus-visible:ring-cyan-500/40',
    resetNav: 'text-cyan-400 hover:text-cyan-300',
  },
  listino: {
    selectionRow: 'bg-lime-500/10',
    monthSelected: 'text-lime-200',
    cellHover: 'hover:text-lime-200',
    focusRing: 'focus-visible:ring-lime-500/40',
    resetNav: 'text-lime-400 hover:text-lime-300',
  },
  documenti: {
    selectionRow: 'bg-amber-500/10',
    monthSelected: 'text-amber-200',
    cellHover: 'hover:text-amber-200',
    focusRing: 'focus-visible:ring-amber-500/40',
    resetNav: 'text-amber-400 hover:text-amber-300',
  },
}
