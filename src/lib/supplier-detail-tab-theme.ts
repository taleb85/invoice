import { SUMMARY_HIGHLIGHT_ACCENTS } from '@/lib/summary-highlight-accent'

/**
 * Barra superiore `.app-card-bar-accent` + classi `*.bar` + bordo card, allineati ai KPI della scheda fornitore
 * (`buildSupplierKpiItems` in `fornitori/[id]/page.tsx`).
 */
export const SUPPLIER_DETAIL_TAB_HIGHLIGHT = {
  dashboard: SUMMARY_HIGHLIGHT_ACCENTS.cyan,
  conferme: SUMMARY_HIGHLIGHT_ACCENTS.rose,
  bolle: SUMMARY_HIGHLIGHT_ACCENTS.indigo,
  fatture: SUMMARY_HIGHLIGHT_ACCENTS.emerald,
  verifica: SUMMARY_HIGHLIGHT_ACCENTS.cyan,
  listino: SUMMARY_HIGHLIGHT_ACCENTS.fuchsia,
  documenti: SUMMARY_HIGHLIGHT_ACCENTS.amber,
  audit: {
    border: 'border-[rgba(34,211,238,0.15)]',
    bar: 'bg-gradient-to-r from-red-500/70 via-red-400/30 to-transparent',
  },
} as const

export type SupplierDetailTabKey = keyof typeof SUPPLIER_DETAIL_TAB_HIGHLIGHT

/** Bordo inferiore tab attiva (desktop fornitore), allineato a `SUPPLIER_DETAIL_TAB_HIGHLIGHT` / barra `.app-card-bar-accent`. */
export const SUPPLIER_DETAIL_TAB_ACTIVE_UNDERLINE: Record<SupplierDetailTabKey, string> = {
  dashboard: 'border-b-app-cyan-400',
  bolle: 'border-b-[rgba(34,211,238,0.15)]',
  fatture: 'border-b-[rgba(34,211,238,0.15)]',
  listino: 'border-b-[rgba(34,211,238,0.15)]',
  conferme: 'border-b-[rgba(34,211,238,0.15)]',
  documenti: 'border-b-[rgba(34,211,238,0.15)]',
  verifica: 'border-b-app-cyan-400',
  audit: 'border-b-[rgba(34,211,238,0.15)]',
}

/** Tabella «riepilogo per mese»: stessi accenti della card del tab attivo (fatture, bolle, …). */
export const SUPPLIER_DETAIL_TAB_TABLE_ACCENT: Record<
  SupplierDetailTabKey,
  {
    selectionRow: string
    monthSelected: string
    cellHover: string
    focusRing: string
    resetNav: string
    /** Contorno navigatore anno fiscale nella card riepilogo mensile. */
    periodNavWrap: string
    /** Pulsanti ± anno nel navigatore fiscale. */
    periodNavIconBtn: string
  }
> = {
  dashboard: {
    selectionRow: 'bg-app-line-10',
    monthSelected: 'text-app-fg-muted',
    cellHover: 'hover:text-app-fg',
    focusRing: 'focus-visible:ring-app-line-40',
    resetNav: 'text-app-cyan-500 hover:bg-app-line-20 hover:text-app-fg-muted',
    periodNavWrap:
      'border-app-line-40 bg-app-line-10 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.08)]',
    periodNavIconBtn: 'text-app-fg-muted hover:bg-app-line-20 hover:text-white',
  },
  conferme: {
    selectionRow: 'bg-app-line-10',
    monthSelected: 'text-app-fg-muted',
    cellHover: 'hover:text-app-fg',
    focusRing: 'focus-visible:ring-app-line-40',
    resetNav: 'text-app-cyan-500 hover:bg-app-line-20 hover:text-app-fg-muted',
    periodNavWrap:
      'border-app-line-40 bg-app-line-10 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.08)]',
    periodNavIconBtn: 'text-app-fg-muted hover:bg-app-line-20 hover:text-white',
  },
  bolle: {
    selectionRow: 'bg-indigo-500/10',
    monthSelected: 'text-indigo-200',
    cellHover: 'hover:text-indigo-200',
    focusRing: 'focus-visible:ring-indigo-500/40',
    resetNav: 'text-indigo-400 hover:bg-indigo-500/20 hover:text-indigo-300',
    periodNavWrap:
      'border-[rgba(34,211,238,0.15)] bg-indigo-500/[0.09] shadow-none',
    periodNavIconBtn: 'text-indigo-100/90 hover:bg-indigo-500/20 hover:text-white',
  },
  fatture: {
    selectionRow: 'bg-emerald-500/10',
    monthSelected: 'text-emerald-200',
    cellHover: 'hover:text-emerald-200',
    focusRing: 'focus-visible:ring-emerald-500/40',
    resetNav: 'text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300',
    periodNavWrap:
      'border-[rgba(34,211,238,0.15)] bg-emerald-500/[0.09] shadow-none',
    periodNavIconBtn: 'text-emerald-100/90 hover:bg-emerald-500/20 hover:text-white',
  },
  verifica: {
    selectionRow: 'bg-app-line-10',
    monthSelected: 'text-app-fg-muted',
    cellHover: 'hover:text-app-fg',
    focusRing: 'focus-visible:ring-app-line-40',
    resetNav: 'text-app-cyan-500 hover:bg-app-line-20 hover:text-app-fg-muted',
    periodNavWrap:
      'border-app-line-40 bg-app-line-10 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.08)]',
    periodNavIconBtn: 'text-app-fg-muted hover:bg-app-line-20 hover:text-white',
  },
  listino: {
    selectionRow: 'bg-fuchsia-500/10',
    monthSelected: 'text-fuchsia-200',
    cellHover: 'hover:text-fuchsia-200',
    focusRing: 'focus-visible:ring-fuchsia-500/40',
    resetNav: 'text-fuchsia-400 hover:bg-fuchsia-500/20 hover:text-fuchsia-300',
    periodNavWrap:
      'border-[rgba(34,211,238,0.15)] bg-fuchsia-500/[0.09] shadow-none',
    periodNavIconBtn: 'text-fuchsia-100/90 hover:bg-fuchsia-500/20 hover:text-white',
  },
  documenti: {
    selectionRow: 'bg-amber-500/10',
    monthSelected: 'text-amber-200',
    cellHover: 'hover:text-amber-200',
    focusRing: 'focus-visible:ring-amber-500/40',
    resetNav: 'text-amber-400 hover:bg-amber-500/20 hover:text-amber-300',
    periodNavWrap:
      'border-[rgba(34,211,238,0.15)] bg-amber-500/[0.09] shadow-none',
    periodNavIconBtn: 'text-amber-100/90 hover:bg-amber-500/20 hover:text-white',
  },
  audit: {
    selectionRow: 'bg-red-500/10',
    monthSelected: 'text-red-200',
    cellHover: 'hover:text-red-200',
    focusRing: 'focus-visible:ring-red-500/40',
    resetNav: 'text-red-400 hover:bg-red-500/20 hover:text-red-300',
    periodNavWrap:
      'border-[rgba(34,211,238,0.15)] bg-red-500/[0.09] shadow-none',
    periodNavIconBtn: 'text-red-100/90 hover:bg-red-500/20 hover:text-white',
  },
}
