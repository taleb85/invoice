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
 * Dashboard operatore: **6 KPI** (senza tile Fornitori).
 * Da `lg`: 3 colonne → **due righe** (3 + 3); sotto `lg` resta 2 colonne.
 */
export const DASHBOARD_OPERATOR_KPI_GRID_LAYOUT_CLASS =
  'mb-0 grid w-full max-w-none grid-cols-2 items-stretch gap-2 md:mb-3 md:gap-2.5 lg:grid-cols-3 lg:gap-2.5'

const NEUTRAL_ICON_WRAP = 'bg-white/[0.07] ring-1 ring-white/10'
const NEUTRAL_ICON_SVG = 'text-app-fg-muted'
const NEUTRAL_CHEVRON = 'text-app-fg-muted/60 group-hover:text-app-fg group-hover:opacity-100'
const NEUTRAL_SUB = 'text-app-fg-muted'
const NEUTRAL_ICON_DROP = ''

export const supplierKpiPalette = {
  conferme: {
    hex: '#f43f5e',
    accent: 'border-l-[rgba(34,211,238,0.15)]',
    iconClass: NEUTRAL_ICON_SVG,
    iconDropShadow: NEUTRAL_ICON_DROP,
    chevronClass: NEUTRAL_CHEVRON,
    chevronHoverClass: 'group-hover:text-app-fg',
    subStrong: NEUTRAL_SUB,
    headerRule: 'border-b border-[rgba(34,211,238,0.15)]',
  },
  bolle: {
    hex: '#6366f1',
    accent: 'border-l-[rgba(34,211,238,0.15)]',
    iconClass: NEUTRAL_ICON_SVG,
    iconDropShadow: NEUTRAL_ICON_DROP,
    chevronClass: NEUTRAL_CHEVRON,
    chevronHoverClass: 'group-hover:text-app-fg',
    subStrong: NEUTRAL_SUB,
    headerRule: 'border-b border-[rgba(34,211,238,0.15)]',
  },
  fatture: {
    hex: '#34d399',
    accent: 'border-l-[rgba(34,211,238,0.15)]',
    iconClass: NEUTRAL_ICON_SVG,
    iconDropShadow: NEUTRAL_ICON_DROP,
    chevronClass: NEUTRAL_CHEVRON,
    chevronHoverClass: 'group-hover:text-app-fg',
    subStrong: NEUTRAL_SUB,
    headerRule: 'border-b border-[rgba(34,211,238,0.15)]',
  },
  verifica: {
    hex: '#06b6d4',
    accent: 'border-l-[rgba(34,211,238,0.15)]',
    iconClass: NEUTRAL_ICON_SVG,
    iconDropShadow: NEUTRAL_ICON_DROP,
    chevronClass: NEUTRAL_CHEVRON,
    chevronHoverClass: 'group-hover:text-app-fg',
    subStrong: NEUTRAL_SUB,
    headerRule: 'border-b border-[rgba(34,211,238,0.15)]',
  },
  listino: {
    hex: '#c026d3',
    accent: 'border-l-[rgba(34,211,238,0.15)]',
    iconClass: NEUTRAL_ICON_SVG,
    iconDropShadow: NEUTRAL_ICON_DROP,
    chevronClass: NEUTRAL_CHEVRON,
    chevronHoverClass: 'group-hover:text-app-fg',
    subStrong: NEUTRAL_SUB,
    headerRule: 'border-b border-[rgba(34,211,238,0.15)]',
  },
  totaleSpesa: {
    hex: '#7c3aed',
    accent: 'border-l-[rgba(34,211,238,0.15)]',
    iconClass: NEUTRAL_ICON_SVG,
    iconDropShadow: NEUTRAL_ICON_DROP,
    chevronClass: NEUTRAL_CHEVRON,
    chevronHoverClass: 'group-hover:text-app-fg',
    subStrong: NEUTRAL_SUB,
    headerRule: 'border-b border-[rgba(34,211,238,0.15)]',
  },
  documenti: {
    hex: '#f59e0b',
    accent: 'border-l-[rgba(34,211,238,0.15)]',
    iconClass: NEUTRAL_ICON_SVG,
    iconDropShadow: NEUTRAL_ICON_DROP,
    chevronClass: NEUTRAL_CHEVRON,
    chevronHoverClass: 'group-hover:text-app-fg',
    subStrong: NEUTRAL_SUB,
    headerRule: 'border-b border-[rgba(34,211,238,0.15)]',
  },
} as const

export function hexToRgbTuple(hex: string): string {
  const h = hex.replace('#', '').trim()
  if (h.length !== 6) return '148,163,184'
  return `${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)}`
}

/** Ombra tile KPI scheda fornitore: neutrale. */
export function supplierDesktopKpiOuterShadow(_hex: string): string {
  return [
    '0 0 0 1px rgba(34,211,238,0.12)',
    '0 0 44px -12px rgba(0,0,0,0.4)',
    '0 20px 44px -12px rgba(0,0,0,0.5)',
  ].join(', ')
}

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
