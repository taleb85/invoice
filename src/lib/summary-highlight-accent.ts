/**
 * Accent della card riepilogo — tutto neutro, nessun colore per categoria.
 */

const NEUTRAL_BAR = ''
const NEUTRAL_LABEL = 'text-app-fg-muted'
const NEUTRAL_BORDER = 'border-[rgba(34,211,238,0.15)]'

export const SUMMARY_HIGHLIGHT_ACCENTS = {
  indigo:    { border: NEUTRAL_BORDER, bar: NEUTRAL_BAR, label: NEUTRAL_LABEL },
  blue:      { border: NEUTRAL_BORDER, bar: NEUTRAL_BAR, label: NEUTRAL_LABEL },
  emerald:   { border: NEUTRAL_BORDER, bar: NEUTRAL_BAR, label: NEUTRAL_LABEL },
  purple:    { border: NEUTRAL_BORDER, bar: NEUTRAL_BAR, label: NEUTRAL_LABEL },
  pink:      { border: NEUTRAL_BORDER, bar: NEUTRAL_BAR, label: NEUTRAL_LABEL },
  fuchsia:   { border: NEUTRAL_BORDER, bar: NEUTRAL_BAR, label: NEUTRAL_LABEL },
  rose:      { border: NEUTRAL_BORDER, bar: NEUTRAL_BAR, label: NEUTRAL_LABEL },
  lime:      { border: NEUTRAL_BORDER, bar: NEUTRAL_BAR, label: NEUTRAL_LABEL },
  teal:      { border: NEUTRAL_BORDER, bar: NEUTRAL_BAR, label: NEUTRAL_LABEL },
  cyan:      { border: NEUTRAL_BORDER, bar: NEUTRAL_BAR, label: NEUTRAL_LABEL },
  sky:       { border: NEUTRAL_BORDER, bar: NEUTRAL_BAR, label: NEUTRAL_LABEL },
  amber:     { border: NEUTRAL_BORDER, bar: NEUTRAL_BAR, label: NEUTRAL_LABEL },
  violet:    { border: NEUTRAL_BORDER, bar: NEUTRAL_BAR, label: NEUTRAL_LABEL },
} as const

export type SummaryHighlightAccent = keyof typeof SUMMARY_HIGHLIGHT_ACCENTS

/**
 * Guscio esterno card/sezione: bordo top cyan unificato, sfondo semi-trasparente neutro.
 */
export const SUMMARY_HIGHLIGHT_SURFACE_CLASS =
  'relative overflow-hidden rounded-[10px] border-t-2 border-t-[#22d3ee] border-x-0 border-b-0 bg-white/[0.04] shadow-none backdrop-blur-none [-webkit-backdrop-filter:none] [backdrop-filter:none]'

/** Padding interno corpo (`AppSummaryHighlightCard`, tabelle in stesso guscio). */
export const SUMMARY_HIGHLIGHT_CARD_INNER_PADDING_CLASS =
  'px-4 py-3 sm:px-4 sm:py-4 md:px-5 md:py-4 lg:px-5'
