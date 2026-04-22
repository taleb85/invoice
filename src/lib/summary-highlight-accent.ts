/**
 * Accent della card riepilogo: allineati alle icone/colore bordo dei KPI operatore
 * (`DashboardOperatorKpiGrid`).
 */
export const SUMMARY_HIGHLIGHT_ACCENTS = {
  indigo: {
    border: 'border-[rgba(34,211,238,0.15)]',
    bar: 'bg-gradient-to-r from-indigo-500 via-indigo-400 to-indigo-700 [box-shadow:0_0_18px_rgba(99,102,241,0.52),0_0_32px_rgba(79,70,229,0.32),0_4px_18px_rgba(99,102,241,0.28)]',
    label: 'text-indigo-300/90',
  },
  blue: {
    border: 'border-[rgba(34,211,238,0.15)]',
    bar: 'bg-gradient-to-r from-blue-500 via-blue-400 to-blue-700 [box-shadow:0_0_16px_rgba(59,130,246,0.5),0_3px_14px_rgba(29,78,216,0.32)]',
    label: 'text-blue-300/90',
  },
  emerald: {
    border: 'border-[rgba(34,211,238,0.15)]',
    bar: 'bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-700 [box-shadow:0_0_16px_rgba(16,185,129,0.48),0_3px_14px_rgba(5,150,105,0.32)]',
    label: 'text-emerald-300/90',
  },
  purple: {
    border: 'border-[rgba(34,211,238,0.15)]',
    bar: 'bg-gradient-to-r from-purple-500 via-purple-400 to-purple-800 [box-shadow:0_0_16px_rgba(168,85,247,0.45),0_3px_14px_rgba(126,34,206,0.3)]',
    label: 'text-purple-300/90',
  },
  pink: {
    border: 'border-[rgba(34,211,238,0.15)]',
    bar: 'bg-gradient-to-r from-pink-500 via-pink-400 to-rose-700 [box-shadow:0_0_16px_rgba(236,72,153,0.48),0_3px_14px_rgba(190,24,93,0.28)]',
    label: 'text-pink-300/90',
  },
  /** Chip / UI secondari (non KPI Ordini fornitore — vedi `rose`). */
  fuchsia: {
    border: 'border-[rgba(34,211,238,0.15)]',
    bar: 'bg-gradient-to-r from-fuchsia-500 via-fuchsia-400 to-fuchsia-800 [box-shadow:0_0_18px_rgba(217,70,239,0.55),0_0_34px_rgba(192,38,211,0.34),0_4px_20px_rgba(217,70,239,0.3)]',
    label: 'text-fuchsia-300/90',
  },
  /** KPI «Ordini» (rosa corallo, distinto da fucsia/viola). */
  rose: {
    border: 'border-[rgba(34,211,238,0.15)]',
    bar: 'bg-gradient-to-r from-rose-500 via-rose-400 to-rose-700 [box-shadow:0_0_18px_rgba(244,63,94,0.52),0_0_34px_rgba(225,29,72,0.32),0_4px_20px_rgba(244,63,94,0.28)]',
    label: 'text-rose-300/90',
  },
  lime: {
    border: 'border-[rgba(34,211,238,0.15)]',
    bar: 'bg-gradient-to-r from-lime-500 via-lime-400 to-lime-700 [box-shadow:0_0_16px_rgba(132,204,22,0.5),0_0_28px_rgba(101,163,13,0.32),0_4px_18px_rgba(132,204,22,0.26)]',
    label: 'text-lime-300/90',
  },
  teal: {
    border: 'border-[rgba(34,211,238,0.15)]',
    bar: 'bg-gradient-to-r from-teal-500 via-teal-400 to-teal-700 [box-shadow:0_0_16px_rgba(20,184,166,0.48),0_3px_14px_rgba(15,118,110,0.3)]',
    label: 'text-teal-300/90',
  },
  cyan: {
    border: 'border-[rgba(34,211,238,0.15)]',
    bar: 'bg-gradient-to-r from-cyan-400 via-cyan-500 to-teal-700 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.08),0_1px_0_rgb(6_182_212_/_0.25)]',
    label: 'text-app-fg-muted',
  },
  /** Estratti / accenti azzurri (non usato come default tab Verifica fornitore). */
  sky: {
    border: 'border-[rgba(34,211,238,0.15)]',
    bar: 'bg-gradient-to-r from-sky-500 via-sky-400 to-sky-600 [box-shadow:0_0_16px_rgba(14,165,233,0.6),0_0_28px_rgba(2,132,199,0.35),0_3px_14px_rgba(14,165,233,0.35)]',
    label: 'text-sky-300/90',
  },
  amber: {
    border: 'border-[rgba(34,211,238,0.15)]',
    bar: 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-700 [box-shadow:0_0_18px_rgba(251,191,36,0.55),0_0_30px_rgba(217,119,6,0.35),0_3px_14px_rgba(245,158,11,0.35)]',
    label: 'text-amber-300/90',
  },
  /** KPI «Totale spesa» / riepilogo (`accentHex` #7c3aed). */
  violet: {
    border: 'border-[rgba(34,211,238,0.15)]',
    bar: 'bg-gradient-to-r from-violet-600 via-violet-500 to-violet-900 [box-shadow:0_0_18px_rgba(124,58,237,0.52),0_0_32px_rgba(109,40,217,0.32),0_4px_18px_rgba(124,58,237,0.28)]',
    label: 'text-violet-300/90',
  },
} as const

export type SummaryHighlightAccent = keyof typeof SUMMARY_HIGHLIGHT_ACCENTS

/**
 * Guscio esterno per blocchi con accento KPI (riepilogo, header strip, contenitori sezione):
 * solo bordo tinta + barra; corpo trasparente sul canvas — senza vetro/ombre di `.app-card`.
 * Comporre con `SUMMARY_HIGHLIGHT_ACCENTS[accent].border` e `app-card-bar-accent` + classi `*.bar`.
 */
export const SUMMARY_HIGHLIGHT_SURFACE_CLASS =
  'relative overflow-hidden rounded-2xl border bg-transparent shadow-none backdrop-blur-none [-webkit-backdrop-filter:none] [backdrop-filter:none]'

/** Padding interno corpo sotto la barra (`AppSummaryHighlightCard`, tabelle in stesso guscio). */
export const SUMMARY_HIGHLIGHT_CARD_INNER_PADDING_CLASS =
  'px-3 py-4 sm:px-4 sm:py-5 md:px-6 lg:px-8 xl:px-10'
