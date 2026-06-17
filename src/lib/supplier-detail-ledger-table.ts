import {
  APP_SECTION_TABLE_TBODY,
  APP_SECTION_TABLE_THEAD_STICKY,
  APP_SECTION_TABLE_TR,
  appSectionTableHeadRowAccentClass,
  type AppSectionTableHeadAccent,
} from '@/lib/app-shell-layout'
import type { SupplierDetailTabKey } from '@/lib/supplier-detail-tab-theme'

const TAB_HEAD_ACCENT: Partial<Record<SupplierDetailTabKey, AppSectionTableHeadAccent>> = {
  dashboard: 'cyan',
  conferme: 'rose',
  bolle: 'indigo',
  fatture: 'emerald',
  listino: 'fuchsia',
  documenti: 'amber',
  verifica: 'cyan',
  anomalie: 'amber',
}

/** Contenitore tabella desktop nelle tab scheda fornitore (fatture, bolle, ordini, …). */
export const SUPPLIER_LEDGER_TABLE_WRAP = 'hidden overflow-x-auto md:block'

/** Tabella elenco documenti — stesso min-width e tipografia su tutte le categorie. */
export const SUPPLIER_LEDGER_TABLE = 'w-full min-w-[520px] text-sm'

export const SUPPLIER_LEDGER_TH =
  'px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-app-fg-muted'

export const SUPPLIER_LEDGER_TH_RIGHT =
  'px-5 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-app-fg-muted'

export const SUPPLIER_LEDGER_TH_AMOUNT =
  'px-5 py-2.5 text-right font-mono text-[10px] font-bold uppercase tracking-widest tabular-nums text-app-fg-muted'

export const SUPPLIER_LEDGER_TD = 'px-5 py-3'

export const SUPPLIER_LEDGER_TD_DATE = `${SUPPLIER_LEDGER_TD} font-medium text-app-fg-muted`

export const SUPPLIER_LEDGER_TD_TEXT = `${SUPPLIER_LEDGER_TD} text-app-fg-muted`

export const SUPPLIER_LEDGER_TD_AMOUNT =
  `${SUPPLIER_LEDGER_TD} text-right font-mono text-sm font-semibold tabular-nums text-app-fg-muted`

export const SUPPLIER_LEDGER_TD_ACTIONS = `${SUPPLIER_LEDGER_TD} text-right`

export function supplierLedgerTableHeadRow(tab: SupplierDetailTabKey): string {
  return appSectionTableHeadRowAccentClass(TAB_HEAD_ACCENT[tab] ?? 'cyan')
}

export { APP_SECTION_TABLE_TBODY, APP_SECTION_TABLE_THEAD_STICKY, APP_SECTION_TABLE_TR }
