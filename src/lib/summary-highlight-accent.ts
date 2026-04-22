/**
 * Accent della card riepilogo: allineati alle icone/colore bordo dei KPI operatore
 * (`DashboardOperatorKpiGrid`).
 */

const NEUTRAL_BAR = 'bg-gradient-to-r from-[rgba(34,211,238,0.35)] via-[rgba(34,211,238,0.12)] to-transparent'

export const SUMMARY_HIGHLIGHT_ACCENTS = {
  indigo: {
    border: 'border-[rgba(34,211,238,0.15)]',
    bar: NEUTRAL_BAR,
    label: 'text-indigo-300/90',
  },
  blue: {
    border: 'border-[rgba(34,211,238,0.15)]',
    bar: NEUTRAL_BAR,
    label: 'text-blue-300/90',
  },
  emerald: {
    border: 'border-[rgba(34,211,238,0.15)]',
    bar: NEUTRAL_BAR,
    label: 'text-emerald-300/90',
  },
  purple: {
    border: 'border-[rgba(34,211,238,0.15)]',
    bar: NEUTRAL_BAR,
    label: 'text-purple-300/90',
  },
  pink: {
    border: 'border-[rgba(34,211,238,0.15)]',
    bar: NEUTRAL_BAR,
    label: 'text-pink-300/90',
  },
  /** Chip / UI secondari (non KPI Ordini fornitore — vedi `rose`). */
  fuchsia: {
    border: 'border-[rgba(34,211,238,0.15)]',
    bar: NEUTRAL_BAR,
    label: 'text-fuchsia-300/90',
  },
  /** KPI «Ordini» (rosa corallo, distinto da fucsia/viola). */
  rose: {
    border: 'border-[rgba(34,211,238,0.15)]',
    bar: NEUTRAL_BAR,
    label: 'text-rose-300/90',
  },
  lime: {
    border: 'border-[rgba(34,211,238,0.15)]',
    bar: NEUTRAL_BAR,
    label: 'text-lime-300/90',
  },
  teal: {
    border: 'border-[rgba(34,211,238,0.15)]',
    bar: NEUTRAL_BAR,
    label: 'text-teal-300/90',
  },
  cyan: {
    border: 'border-[rgba(34,211,238,0.15)]',
    bar: NEUTRAL_BAR,
    label: 'text-app-fg-muted',
  },
  /** Estratti / accenti azzurri (non usato come default tab Verifica fornitore). */
  sky: {
    border: 'border-[rgba(34,211,238,0.15)]',
    bar: NEUTRAL_BAR,
    label: 'text-sky-300/90',
  },
  amber: {
    border: 'border-[rgba(34,211,238,0.15)]',
    bar: NEUTRAL_BAR,
    label: 'text-amber-300/90',
  },
  /** KPI «Totale spesa» / riepilogo (`accentHex` #7c3aed). */
  violet: {
    border: 'border-[rgba(34,211,238,0.15)]',
    bar: NEUTRAL_BAR,
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
