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

export const supplierKpiPalette = {
  conferme: {
    hex: '#f43f5e',
    accent: 'border-l-[rgba(34,211,238,0.15)]',
    iconClass: 'text-rose-300',
    iconDropShadow: 'drop-shadow-[0_0_10px_rgba(244,63,94,0.5)]',
    chevronClass: 'text-rose-400',
    chevronHoverClass: 'group-hover:text-rose-200',
    subStrong: 'text-rose-300',
    /** Separatore tra titolo e corpo tile (stessa famiglia cromatica della tab). */
    headerRule: 'border-b border-[rgba(34,211,238,0.15)]',
  },
  bolle: {
    hex: '#6366f1',
    accent: 'border-l-[rgba(34,211,238,0.15)]',
    iconClass: 'text-indigo-300',
    iconDropShadow: 'drop-shadow-[0_0_10px_rgba(129,140,248,0.48)]',
    chevronClass: 'text-indigo-400',
    chevronHoverClass: 'group-hover:text-indigo-200',
    subStrong: 'text-indigo-300',
    headerRule: 'border-b border-[rgba(34,211,238,0.15)]',
  },
  /** Allineato a emerald KPI operatore / tab fatture (`rgb(52,211,153)`). */
  fatture: {
    hex: '#34d399',
    accent: 'border-l-[rgba(34,211,238,0.15)]',
    iconClass: 'text-emerald-300',
    iconDropShadow: 'drop-shadow-[0_0_10px_rgba(52,211,153,0.48)]',
    chevronClass: 'text-emerald-400',
    chevronHoverClass: 'group-hover:text-emerald-200',
    subStrong: 'text-emerald-300',
    headerRule: 'border-b border-[rgba(34,211,238,0.15)]',
  },
  verifica: {
    hex: '#06b6d4',
    accent: 'border-l-app-cyan-500',
    iconClass: 'text-cyan-300',
    iconDropShadow: 'drop-shadow-[0_0_10px_rgba(34,211,238,0.48)]',
    chevronClass: 'text-cyan-400',
    chevronHoverClass: 'group-hover:text-cyan-200',
    subStrong: 'text-cyan-200/90',
    headerRule: 'border-b border-[rgba(34,211,238,0.15)]',
  },
  /** Listino: fucsia (lontano da smeraldo fatture, ambra documenti, cyan verifica). */
  listino: {
    hex: '#c026d3',
    accent: 'border-l-[rgba(34,211,238,0.15)]',
    iconClass: 'text-fuchsia-300',
    iconDropShadow: 'drop-shadow-[0_0_10px_rgba(217,70,239,0.5)]',
    chevronClass: 'text-fuchsia-400',
    chevronHoverClass: 'group-hover:text-fuchsia-200',
    subStrong: 'text-fuchsia-300',
    headerRule: 'border-b border-[rgba(34,211,238,0.15)]',
  },
  totaleSpesa: {
    hex: '#7c3aed',
    accent: 'border-l-[rgba(34,211,238,0.15)]',
    iconClass: 'text-violet-300',
    iconDropShadow: 'drop-shadow-[0_0_10px_rgba(167,139,250,0.48)]',
    chevronClass: 'text-violet-400',
    chevronHoverClass: 'group-hover:text-violet-200',
    subStrong: 'text-violet-300',
    headerRule: 'border-b border-[rgba(34,211,238,0.15)]',
  },
  documenti: {
    hex: '#f59e0b',
    accent: 'border-l-[rgba(34,211,238,0.15)]',
    iconClass: 'text-amber-300',
    iconDropShadow: 'drop-shadow-[0_0_12px_rgba(251,191,36,0.55)]',
    chevronClass: 'text-amber-400',
    chevronHoverClass: 'group-hover:text-amber-200',
    subStrong: 'text-amber-300',
    headerRule: 'border-b border-[rgba(34,211,238,0.15)]',
  },
} as const

export function hexToRgbTuple(hex: string): string {
  const h = hex.replace('#', '').trim()
  if (h.length !== 6) return '148,163,184'
  return `${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)}`
}

/** Alone tile KPI scheda fornitore: tinta sull'accento, senza cyan `.app-card`. */
export function supplierDesktopKpiOuterShadow(hex: string): string {
  const rgb = hexToRgbTuple(hex)
  return [
    `0 0 0 1px rgba(${rgb},0.2)`,
    `0 0 44px -12px rgba(${rgb},0.28)`,
    '0 20px 44px -12px rgba(0,0,0,0.5)',
  ].join(', ')
}

/**
 * Accenti per tile `DashboardOperatorKpiGrid` (bordo, alone, hover, icona, chevron).
 * Ogni voce ha `iconWrapClass` / `iconSvgClass` / `chevronClass` allineati al bordo tile.
 */
export const operatorKpiVisual = [
  {
    accentHex: '#0ea5e9',
    borderClass: 'border-[rgba(34,211,238,0.15)]',
    glowRgb: '14,165,233',
    ringClass: 'ring-sky-400/10',
    hoverClass:
      'hover:border-[rgba(34,211,238,0.25)]',
    iconWrapClass: 'bg-sky-500/14 ring-1 ring-sky-400/25',
    iconSvgClass: 'text-sky-300 drop-shadow-[0_0_8px_rgba(56,189,248,0.42)]',
    chevronClass: 'text-sky-400 group-hover:text-sky-100 group-hover:opacity-100',
  },
  {
    accentHex: '#f59e0b',
    borderClass: 'border-[rgba(34,211,238,0.15)]',
    glowRgb: '245,158,11',
    ringClass: 'ring-amber-400/10',
    hoverClass:
      'hover:border-[rgba(34,211,238,0.25)]',
    iconWrapClass: 'bg-amber-500/14 ring-1 ring-amber-400/25',
    iconSvgClass: 'text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]',
    chevronClass: 'text-amber-400 group-hover:text-amber-100 group-hover:opacity-100',
  },
  {
    accentHex: '#f43f5e',
    borderClass: 'border-[rgba(34,211,238,0.15)]',
    glowRgb: '244,63,94',
    ringClass: 'ring-rose-400/10',
    hoverClass:
      'hover:border-[rgba(34,211,238,0.25)]',
    iconWrapClass: 'bg-rose-500/14 ring-1 ring-rose-400/25',
    iconSvgClass: 'text-rose-300 drop-shadow-[0_0_8px_rgba(251,113,133,0.45)]',
    chevronClass: 'text-rose-400 group-hover:text-rose-100 group-hover:opacity-100',
  },
  {
    accentHex: '#6366f1',
    borderClass: 'border-[rgba(34,211,238,0.15)]',
    glowRgb: '99,102,241',
    ringClass: 'ring-indigo-400/10',
    hoverClass:
      'hover:border-[rgba(34,211,238,0.25)]',
    iconWrapClass: 'bg-indigo-500/14 ring-1 ring-indigo-400/25',
    iconSvgClass: 'text-indigo-300 drop-shadow-[0_0_8px_rgba(129,140,248,0.48)]',
    chevronClass: 'text-indigo-400 group-hover:text-indigo-100 group-hover:opacity-100',
  },
  {
    accentHex: '#34d399',
    borderClass: 'border-[rgba(34,211,238,0.15)]',
    glowRgb: '52,211,153',
    ringClass: 'ring-emerald-400/10',
    hoverClass:
      'hover:border-[rgba(34,211,238,0.25)]',
    iconWrapClass: 'bg-emerald-500/14 ring-1 ring-emerald-400/25',
    iconSvgClass: 'text-emerald-300 drop-shadow-[0_0_8px_rgba(52,211,153,0.45)]',
    chevronClass: 'text-emerald-400 group-hover:text-emerald-100 group-hover:opacity-100',
  },
  {
    accentHex: '#06b6d4',
    borderClass: 'border-app-line-32',
    glowRgb: '6,182,212',
    ringClass: 'ring-app-a-20',
    hoverClass:
      'hover:border-app-a-38 hover:shadow-[0_0_0_1px_rgba(34,211,238,0.12)]',
    iconWrapClass: 'bg-cyan-500/14 ring-1 ring-cyan-400/25',
    iconSvgClass: 'text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.45)]',
    chevronClass: 'text-cyan-400 group-hover:text-cyan-100 group-hover:opacity-100',
  },
  {
    /** Allineato a `supplierKpiPalette.listino` (tile listino dashboard / scheda). */
    accentHex: '#c026d3',
    borderClass: 'border-[rgba(34,211,238,0.15)]',
    glowRgb: '192,38,211',
    ringClass: 'ring-fuchsia-400/10',
    hoverClass:
      'hover:border-[rgba(34,211,238,0.25)]',
    iconWrapClass: 'bg-fuchsia-500/14 ring-1 ring-fuchsia-400/25',
    iconSvgClass: 'text-fuchsia-300 drop-shadow-[0_0_10px_rgba(217,70,239,0.5)]',
    chevronClass: 'text-fuchsia-400 group-hover:text-fuchsia-100 group-hover:opacity-100',
  },
  {
    accentHex: '#7c3aed',
    borderClass: 'border-[rgba(34,211,238,0.15)]',
    glowRgb: '124,58,237',
    ringClass: 'ring-violet-400/10',
    hoverClass:
      'hover:border-[rgba(34,211,238,0.25)]',
    iconWrapClass: 'bg-violet-500/14 ring-1 ring-violet-400/25',
    iconSvgClass: 'text-violet-300 drop-shadow-[0_0_8px_rgba(167,139,250,0.48)]',
    chevronClass: 'text-violet-400 group-hover:text-violet-100 group-hover:opacity-100',
  },
] as const
