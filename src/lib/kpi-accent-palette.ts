/**
 * Palette KPI unica: scheda fornitore (`SupplierDesktopKpiGrid`),
 * dashboard operatore (`DashboardOperatorKpiGrid`) ed elenchi collegati.
 */

/**
 * Griglia KPI scheda fornitore desktop (6 tile): 2 → 3 → 6 colonne.
 */
export const SUPPLIER_DESKTOP_KPI_GRID_LAYOUT_CLASS =
  'mb-0 grid w-full max-w-none grid-cols-1 min-[360px]:grid-cols-2 md:grid-cols-3 gap-2 md:mb-5 md:gap-3 lg:grid-cols-3 lg:gap-2.5 xl:grid-cols-6 xl:gap-2'

/**
 * Dashboard operatore: **5 KPI** (senza tile Fornitori).
 * Da `md`: **una sola riga** (5 colonne); su viewport piccoli (es. pagina sede) resta 2 colonne.
 */
export const DASHBOARD_OPERATOR_KPI_GRID_LAYOUT_CLASS =
  'mb-0 grid w-full max-w-none grid-cols-2 items-stretch gap-2 md:mb-3 md:grid-cols-5 md:gap-2.5'

const NEUTRAL_ICON_WRAP = 'bg-white/[0.07] ring-1 ring-white/10'
const NEUTRAL_ICON_SVG = 'text-app-fg-muted'
const NEUTRAL_CHEVRON = 'text-app-fg-subtle group-hover:text-app-fg group-hover:opacity-100'
const NEUTRAL_SUB = 'text-app-fg-muted'
const NEUTRAL_ICON_DROP = ''

/** Bordi tile KPI scheda fornitore: Aura glass slate (icone restano tinte per lettura rapida). */
const SUPPLIER_KPI_TILE_ACCENT_BORDER = 'border-l border-white/[0.06]'
const SUPPLIER_KPI_TILE_HEADER_RULE = 'border-b border-white/10'

export const supplierKpiPalette = {
  conferme: {
    hex: '#f43f5e',
    accent: SUPPLIER_KPI_TILE_ACCENT_BORDER,
    iconClass: NEUTRAL_ICON_SVG,
    iconDropShadow: NEUTRAL_ICON_DROP,
    chevronClass: NEUTRAL_CHEVRON,
    chevronHoverClass: 'group-hover:text-app-fg',
    subStrong: NEUTRAL_SUB,
    headerRule: SUPPLIER_KPI_TILE_HEADER_RULE,
  },
  bolle: {
    hex: '#6366f1',
    accent: SUPPLIER_KPI_TILE_ACCENT_BORDER,
    iconClass: NEUTRAL_ICON_SVG,
    iconDropShadow: NEUTRAL_ICON_DROP,
    chevronClass: NEUTRAL_CHEVRON,
    chevronHoverClass: 'group-hover:text-app-fg',
    subStrong: NEUTRAL_SUB,
    headerRule: SUPPLIER_KPI_TILE_HEADER_RULE,
  },
  fatture: {
    hex: '#34d399',
    accent: SUPPLIER_KPI_TILE_ACCENT_BORDER,
    iconClass: NEUTRAL_ICON_SVG,
    iconDropShadow: NEUTRAL_ICON_DROP,
    chevronClass: NEUTRAL_CHEVRON,
    chevronHoverClass: 'group-hover:text-app-fg',
    subStrong: NEUTRAL_SUB,
    headerRule: SUPPLIER_KPI_TILE_HEADER_RULE,
  },
  verifica: {
    hex: '#06b6d4',
    accent: SUPPLIER_KPI_TILE_ACCENT_BORDER,
    iconClass: NEUTRAL_ICON_SVG,
    iconDropShadow: NEUTRAL_ICON_DROP,
    chevronClass: NEUTRAL_CHEVRON,
    chevronHoverClass: 'group-hover:text-app-fg',
    subStrong: NEUTRAL_SUB,
    headerRule: SUPPLIER_KPI_TILE_HEADER_RULE,
  },
  listino: {
    hex: '#c026d3',
    accent: SUPPLIER_KPI_TILE_ACCENT_BORDER,
    iconClass: NEUTRAL_ICON_SVG,
    iconDropShadow: NEUTRAL_ICON_DROP,
    chevronClass: NEUTRAL_CHEVRON,
    chevronHoverClass: 'group-hover:text-app-fg',
    subStrong: NEUTRAL_SUB,
    headerRule: SUPPLIER_KPI_TILE_HEADER_RULE,
  },
  totaleSpesa: {
    hex: '#7c3aed',
    accent: SUPPLIER_KPI_TILE_ACCENT_BORDER,
    iconClass: NEUTRAL_ICON_SVG,
    iconDropShadow: NEUTRAL_ICON_DROP,
    chevronClass: NEUTRAL_CHEVRON,
    chevronHoverClass: 'group-hover:text-app-fg',
    subStrong: NEUTRAL_SUB,
    headerRule: SUPPLIER_KPI_TILE_HEADER_RULE,
  },
  documenti: {
    hex: '#f59e0b',
    accent: SUPPLIER_KPI_TILE_ACCENT_BORDER,
    iconClass: NEUTRAL_ICON_SVG,
    iconDropShadow: NEUTRAL_ICON_DROP,
    chevronClass: NEUTRAL_CHEVRON,
    chevronHoverClass: 'group-hover:text-app-fg',
    subStrong: NEUTRAL_SUB,
    headerRule: SUPPLIER_KPI_TILE_HEADER_RULE,
  },
} as const

export function hexToRgbTuple(hex: string): string {
  const h = hex.replace('#', '').trim()
  if (h.length !== 6) return '148,163,184'
  return `${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)}`
}

/** Contorno tile KPI glass (dashboard `glassShell`): niente alone scuro sul canvas. */
export function supplierDesktopKpiOuterShadow(): string {
  return '0 0 0 1px rgb(148 163 184 / 0.22)'
}

/** Stessi accenti delle card KPI fornitore (`buildSupplierKpiItems`): conferme → documenti / coda. */
export const DASHBOARD_OPERATOR_KPI_SUPPLIER_HEXES = [
  supplierKpiPalette.conferme.hex,
  supplierKpiPalette.bolle.hex,
  supplierKpiPalette.fatture.hex,
  supplierKpiPalette.verifica.hex,
  supplierKpiPalette.documenti.hex,
] as const

/** Stroke icone allineati alla scheda fornitore (`buildSupplierKpiItems`). */
export const DASHBOARD_OPERATOR_KPI_SUPPLIER_ICON_CLASS = [
  'text-cyan-400',
  'text-violet-400',
  'text-emerald-400',
  'text-amber-400',
  'text-orange-400',
] as const

/**
 * Accenti per tile `DashboardOperatorKpiGrid` — tutto neutro, senza colori per categoria.
 */
export const operatorKpiVisual = [
  {
    accentHex: '#0ea5e9',
    borderClass: 'border-[rgba(34,211,238,0.15)]',
    glowRgb: '148,163,184',
    ringClass: '',
    hoverClass: 'hover:border-[rgba(34,211,238,0.25)]',
    iconWrapClass: NEUTRAL_ICON_WRAP,
    iconSvgClass: NEUTRAL_ICON_SVG,
    chevronClass: NEUTRAL_CHEVRON,
  },
  {
    accentHex: '#f59e0b',
    borderClass: 'border-[rgba(34,211,238,0.15)]',
    glowRgb: '148,163,184',
    ringClass: '',
    hoverClass: 'hover:border-[rgba(34,211,238,0.25)]',
    iconWrapClass: NEUTRAL_ICON_WRAP,
    iconSvgClass: NEUTRAL_ICON_SVG,
    chevronClass: NEUTRAL_CHEVRON,
  },
  {
    accentHex: '#f43f5e',
    borderClass: 'border-[rgba(34,211,238,0.15)]',
    glowRgb: '148,163,184',
    ringClass: '',
    hoverClass: 'hover:border-[rgba(34,211,238,0.25)]',
    iconWrapClass: NEUTRAL_ICON_WRAP,
    iconSvgClass: NEUTRAL_ICON_SVG,
    chevronClass: NEUTRAL_CHEVRON,
  },
  {
    accentHex: '#6366f1',
    borderClass: 'border-[rgba(34,211,238,0.15)]',
    glowRgb: '148,163,184',
    ringClass: '',
    hoverClass: 'hover:border-[rgba(34,211,238,0.25)]',
    iconWrapClass: NEUTRAL_ICON_WRAP,
    iconSvgClass: NEUTRAL_ICON_SVG,
    chevronClass: NEUTRAL_CHEVRON,
  },
  {
    accentHex: '#34d399',
    borderClass: 'border-[rgba(34,211,238,0.15)]',
    glowRgb: '148,163,184',
    ringClass: '',
    hoverClass: 'hover:border-[rgba(34,211,238,0.25)]',
    iconWrapClass: NEUTRAL_ICON_WRAP,
    iconSvgClass: NEUTRAL_ICON_SVG,
    chevronClass: NEUTRAL_CHEVRON,
  },
  {
    accentHex: '#06b6d4',
    borderClass: 'border-[rgba(34,211,238,0.15)]',
    glowRgb: '148,163,184',
    ringClass: '',
    hoverClass: 'hover:border-[rgba(34,211,238,0.25)]',
    iconWrapClass: NEUTRAL_ICON_WRAP,
    iconSvgClass: NEUTRAL_ICON_SVG,
    chevronClass: NEUTRAL_CHEVRON,
  },
  {
    accentHex: '#c026d3',
    borderClass: 'border-[rgba(34,211,238,0.15)]',
    glowRgb: '148,163,184',
    ringClass: '',
    hoverClass: 'hover:border-[rgba(34,211,238,0.25)]',
    iconWrapClass: NEUTRAL_ICON_WRAP,
    iconSvgClass: NEUTRAL_ICON_SVG,
    chevronClass: NEUTRAL_CHEVRON,
  },
  {
    accentHex: '#7c3aed',
    borderClass: 'border-[rgba(34,211,238,0.15)]',
    glowRgb: '148,163,184',
    ringClass: '',
    hoverClass: 'hover:border-[rgba(34,211,238,0.25)]',
    iconWrapClass: NEUTRAL_ICON_WRAP,
    iconSvgClass: NEUTRAL_ICON_SVG,
    chevronClass: NEUTRAL_CHEVRON,
  },
] as const
