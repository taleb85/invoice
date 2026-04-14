/**
 * Accent della card riepilogo: allineati alle icone/colore bordo dei KPI operatore
 * (`DashboardOperatorKpiGrid`).
 */
export const SUMMARY_HIGHLIGHT_ACCENTS = {
  indigo: {
    border: 'border-indigo-500/25',
    bar: 'bg-gradient-to-r from-indigo-500/55 via-indigo-400/30 to-transparent [box-shadow:0_0_18px_rgba(99,102,241,0.45),0_0_32px_rgba(79,70,229,0.22),0_4px_18px_rgba(99,102,241,0.2)]',
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
  /** Chip / UI secondari (non KPI Ordini fornitore — vedi `rose`). */
  fuchsia: {
    border: 'border-fuchsia-500/25',
    bar: 'bg-gradient-to-r from-fuchsia-500/55 via-fuchsia-400/30 to-transparent [box-shadow:0_0_18px_rgba(217,70,239,0.55),0_0_34px_rgba(192,38,211,0.3),0_4px_20px_rgba(217,70,239,0.26)]',
    label: 'text-fuchsia-300/90',
  },
  /** KPI «Ordini» (rosa corallo, distinto da fucsia/viola). */
  rose: {
    border: 'border-rose-500/25',
    bar: 'bg-gradient-to-r from-rose-500/55 via-rose-400/30 to-transparent [box-shadow:0_0_18px_rgba(244,63,94,0.5),0_0_34px_rgba(225,29,72,0.28),0_4px_20px_rgba(244,63,94,0.24)]',
    label: 'text-rose-300/90',
  },
  lime: {
    border: 'border-lime-500/25',
    bar: 'bg-gradient-to-r from-lime-500/55 via-lime-400/30 to-transparent [box-shadow:0_0_16px_rgba(132,204,22,0.45),0_0_28px_rgba(101,163,13,0.22),0_4px_18px_rgba(132,204,22,0.2)]',
    label: 'text-lime-300/90',
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
  /** Estratti / accenti azzurri (non usato come default tab Verifica fornitore). */
  sky: {
    border: 'border-sky-500/25',
    bar: 'bg-gradient-to-r from-sky-500/55 via-sky-400/30 to-transparent [box-shadow:0_0_18px_rgba(14,165,233,0.5),0_0_34px_rgba(2,132,199,0.28),0_4px_20px_rgba(14,165,233,0.24)]',
    label: 'text-sky-300/90',
  },
  amber: {
    border: 'border-amber-500/20',
    bar: 'bg-gradient-to-r from-amber-600/40 to-transparent',
    label: 'text-amber-300/90',
  },
  /** KPI «Totale spesa» / riepilogo (`accentHex` #7c3aed). */
  violet: {
    border: 'border-violet-600/25',
    bar: 'bg-gradient-to-r from-violet-600/55 via-violet-500/30 to-transparent [box-shadow:0_0_18px_rgba(124,58,237,0.48),0_0_32px_rgba(109,40,217,0.26),0_4px_18px_rgba(124,58,237,0.22)]',
    label: 'text-violet-300/90',
  },
} as const

export type SummaryHighlightAccent = keyof typeof SUMMARY_HIGHLIGHT_ACCENTS
