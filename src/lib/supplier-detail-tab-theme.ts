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
