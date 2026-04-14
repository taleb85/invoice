/**
 * Accent della card riepilogo: allineati alle icone/colore bordo dei KPI operatore
 * (`DashboardOperatorKpiGrid`).
 */
export const SUMMARY_HIGHLIGHT_ACCENTS = {
  indigo: {
    border: 'border-indigo-500/20',
    bar: 'bg-gradient-to-r from-indigo-600/40 to-transparent',
    label: 'text-indigo-300/90',
  },
  blue: {
    border: 'border-blue-500/20',
    bar: 'bg-gradient-to-r from-blue-600/40 to-transparent',
    label: 'text-blue-300/90',
  },
  emerald: {
    border: 'border-emerald-500/20',
    bar: 'bg-gradient-to-r from-emerald-600/40 to-transparent',
    label: 'text-emerald-300/90',
  },
  purple: {
    border: 'border-purple-500/20',
    bar: 'bg-gradient-to-r from-purple-600/40 to-transparent',
    label: 'text-purple-300/90',
  },
  pink: {
    border: 'border-pink-500/20',
    bar: 'bg-gradient-to-r from-pink-600/40 to-transparent',
    label: 'text-pink-300/90',
  },
  teal: {
    border: 'border-teal-500/20',
    bar: 'bg-gradient-to-r from-teal-600/40 to-transparent',
    label: 'text-teal-300/90',
  },
  cyan: {
    border: 'border-cyan-500/20',
    bar: 'bg-gradient-to-r from-cyan-600/40 to-transparent',
    label: 'text-cyan-300/90',
  },
  amber: {
    border: 'border-amber-500/20',
    bar: 'bg-gradient-to-r from-amber-600/40 to-transparent',
    label: 'text-amber-300/90',
  },
} as const

export type SummaryHighlightAccent = keyof typeof SUMMARY_HIGHLIGHT_ACCENTS
