/**
 * Palette KPI unica: scheda fornitore (`SupplierDesktopKpiGrid`),
 * dashboard operatore (`DashboardOperatorKpiGrid`) ed elenchi collegati.
 */
export const supplierKpiPalette = {
  conferme: {
    hex: '#f43f5e',
    accent: 'border-l-rose-500',
    iconClass: 'text-rose-400',
    iconDropShadow: 'drop-shadow-[0_0_8px_rgba(244,63,94,0.42)]',
    chevronHoverClass: 'group-hover:text-rose-300',
    subStrong: 'text-rose-300',
  },
  bolle: {
    hex: '#6366f1',
    accent: 'border-l-indigo-500',
    iconClass: 'text-indigo-400',
    iconDropShadow: 'drop-shadow-[0_0_8px_rgba(129,140,248,0.4)]',
    chevronHoverClass: 'group-hover:text-indigo-300',
    subStrong: 'text-amber-400',
  },
  /** Allineato a emerald KPI operatore / tab fatture (`rgb(52,211,153)`). */
  fatture: {
    hex: '#34d399',
    accent: 'border-l-emerald-400',
    iconClass: 'text-emerald-400',
    iconDropShadow: 'drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]',
    chevronHoverClass: 'group-hover:text-emerald-300',
    subStrong: 'text-slate-200',
  },
  verifica: {
    hex: '#06b6d4',
    accent: 'border-l-cyan-500',
    iconClass: 'text-cyan-400',
    iconDropShadow: 'drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]',
    chevronHoverClass: 'group-hover:text-cyan-300',
    subStrong: 'text-slate-200',
  },
  listino: {
    hex: '#84cc16',
    accent: 'border-l-lime-500',
    iconClass: 'text-lime-400',
    iconDropShadow: 'drop-shadow-[0_0_8px_rgba(163,230,53,0.4)]',
    chevronHoverClass: 'group-hover:text-lime-300',
    subStrong: 'text-slate-200',
  },
  totaleSpesa: {
    hex: '#7c3aed',
    accent: 'border-l-violet-600',
    iconClass: 'text-violet-400',
    iconDropShadow: 'drop-shadow-[0_0_8px_rgba(167,139,250,0.4)]',
    chevronHoverClass: 'group-hover:text-violet-300',
    subStrong: 'text-slate-200',
  },
  documenti: {
    hex: '#f59e0b',
    accent: 'border-l-amber-500',
    iconClass: 'text-amber-400',
    iconDropShadow: 'drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]',
    chevronHoverClass: 'group-hover:text-amber-300',
    subStrong: 'text-amber-400',
  },
} as const

export function hexToRgbTuple(hex: string): string {
  const h = hex.replace('#', '').trim()
  if (h.length !== 6) return '148,163,184'
  return `${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)}`
}

/** Alone tile KPI scheda fornitore: tinta sull’accento, senza cyan `.app-card`. */
export function supplierDesktopKpiOuterShadow(hex: string): string {
  const rgb = hexToRgbTuple(hex)
  return [
    `0 0 0 1px rgba(${rgb},0.2)`,
    `0 0 44px -12px rgba(${rgb},0.28)`,
    '0 20px 44px -12px rgba(0,0,0,0.5)',
  ].join(', ')
}

/** Ordine righe = `DashboardOperatorKpiGrid` (fornitori → … → totale). */
export const operatorKpiVisual = [
  {
    accentHex: '#0ea5e9',
    borderClass: 'border-sky-500/32',
    glowRgb: '14,165,233',
    iconClass: 'text-sky-400',
    iconDropShadow: 'drop-shadow-[0_0_8px_rgba(56,189,248,0.38)]',
    subIdleClass: 'text-sky-100/90',
    ringClass: 'ring-sky-400/10',
    hoverClass:
      'hover:border-sky-400/38 hover:shadow-[0_0_0_1px_rgba(56,189,248,0.12)]',
    chevronClass:
      'text-sky-400/70 transition-colors group-hover:text-sky-200 group-hover:drop-shadow-[0_0_5px_rgba(56,189,248,0.35)]',
  },
  {
    accentHex: '#f59e0b',
    borderClass: 'border-amber-500/32',
    glowRgb: '245,158,11',
    iconClass: 'text-amber-400',
    iconDropShadow: 'drop-shadow-[0_0_8px_rgba(251,191,36,0.38)]',
    subIdleClass: 'text-slate-100',
    subPositiveClass: 'text-amber-300',
    ringClass: 'ring-amber-400/10',
    hoverClass:
      'hover:border-amber-400/38 hover:shadow-[0_0_0_1px_rgba(251,191,36,0.12)]',
    chevronClass:
      'text-amber-400/70 transition-colors group-hover:text-amber-200 group-hover:drop-shadow-[0_0_5px_rgba(251,191,36,0.35)]',
  },
  {
    accentHex: '#f43f5e',
    borderClass: 'border-rose-500/32',
    glowRgb: '244,63,94',
    iconClass: 'text-rose-400',
    iconDropShadow: 'drop-shadow-[0_0_8px_rgba(244,63,94,0.4)]',
    subIdleClass: 'text-slate-100',
    subPositiveClass: 'text-rose-200',
    ringClass: 'ring-rose-400/10',
    hoverClass:
      'hover:border-rose-400/38 hover:shadow-[0_0_0_1px_rgba(251,113,133,0.12)]',
    chevronClass:
      'text-rose-400/70 transition-colors group-hover:text-rose-200 group-hover:drop-shadow-[0_0_5px_rgba(251,113,133,0.35)]',
  },
  {
    accentHex: '#6366f1',
    borderClass: 'border-indigo-500/32',
    glowRgb: '99,102,241',
    iconClass: 'text-indigo-400',
    iconDropShadow: 'drop-shadow-[0_0_8px_rgba(129,140,248,0.38)]',
    subIdleClass: 'text-indigo-100/85',
    subPositiveClass: 'text-amber-300',
    ringClass: 'ring-indigo-400/10',
    hoverClass:
      'hover:border-indigo-400/38 hover:shadow-[0_0_0_1px_rgba(129,140,248,0.12)]',
    chevronClass:
      'text-indigo-400/70 transition-colors group-hover:text-indigo-200 group-hover:drop-shadow-[0_0_5px_rgba(129,140,248,0.35)]',
  },
  {
    accentHex: '#34d399',
    borderClass: 'border-emerald-500/32',
    glowRgb: '52,211,153',
    iconClass: 'text-emerald-400',
    iconDropShadow: 'drop-shadow-[0_0_8px_rgba(52,211,153,0.38)]',
    subIdleClass: 'text-emerald-100/90',
    ringClass: 'ring-emerald-400/10',
    hoverClass:
      'hover:border-emerald-400/38 hover:shadow-[0_0_0_1px_rgba(52,211,153,0.12)]',
    chevronClass:
      'text-emerald-400/70 transition-colors group-hover:text-emerald-200 group-hover:drop-shadow-[0_0_5px_rgba(52,211,153,0.35)]',
  },
  {
    accentHex: '#06b6d4',
    borderClass: 'border-cyan-500/32',
    glowRgb: '6,182,212',
    iconClass: 'text-cyan-400',
    iconDropShadow: 'drop-shadow-[0_0_8px_rgba(34,211,238,0.38)]',
    subIdleClass: 'text-slate-100',
    ringClass: 'ring-cyan-400/10',
    hoverClass:
      'hover:border-cyan-400/38 hover:shadow-[0_0_0_1px_rgba(34,211,238,0.12)]',
    chevronClass:
      'text-cyan-400/70 transition-colors group-hover:text-cyan-200 group-hover:drop-shadow-[0_0_5px_rgba(34,211,238,0.35)]',
  },
  {
    accentHex: '#84cc16',
    borderClass: 'border-lime-500/32',
    glowRgb: '132,204,22',
    iconClass: 'text-lime-400',
    iconDropShadow: 'drop-shadow-[0_0_8px_rgba(163,230,53,0.4)]',
    subIdleClass: 'text-slate-200',
    subPositiveClass: 'text-lime-100/90',
    ringClass: 'ring-lime-400/10',
    hoverClass:
      'hover:border-lime-400/38 hover:shadow-[0_0_0_1px_rgba(163,230,53,0.12)]',
    chevronClass:
      'text-lime-400/70 transition-colors group-hover:text-lime-200 group-hover:drop-shadow-[0_0_5px_rgba(163,230,53,0.35)]',
  },
  {
    accentHex: '#7c3aed',
    borderClass: 'border-violet-600/32',
    glowRgb: '124,58,237',
    iconClass: 'text-violet-400',
    iconDropShadow: 'drop-shadow-[0_0_8px_rgba(167,139,250,0.38)]',
    subIdleClass: 'text-violet-100/90',
    ringClass: 'ring-violet-400/10',
    hoverClass:
      'hover:border-violet-500/38 hover:shadow-[0_0_0_1px_rgba(167,139,250,0.12)]',
    chevronClass:
      'text-violet-400/70 transition-colors group-hover:text-violet-200 group-hover:drop-shadow-[0_0_5px_rgba(167,139,250,0.35)]',
  },
] as const
