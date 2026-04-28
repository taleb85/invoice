/**
 * Accent card riepilogo: bordo/barra unificati; etichette metriche (`label`) restano neutre.
 * `headerIcon` usa le stesse classi `iconAccentClass` della sidebar (`@/lib/icon-accent-classes`).
 */

import { iconAccentClass } from '@/lib/icon-accent-classes'

const NEUTRAL_BAR = ''
const NEUTRAL_LABEL = 'text-app-fg-muted'
const NEUTRAL_BORDER = 'border-[rgba(34,211,238,0.15)]'

const SUMMARY_HIGHLIGHT_KEYS = {
  indigo: true,
  blue: true,
  emerald: true,
  purple: true,
  pink: true,
  fuchsia: true,
  rose: true,
  lime: true,
  teal: true,
  cyan: true,
  sky: true,
  amber: true,
  violet: true,
  slate: true,
} as const

/** Allineamento icone strip alle voci correlati nella sidebar (`Sidebar.tsx`). */
const HEADER_ICON = {
  indigo: iconAccentClass.fornitori,
  blue: iconAccentClass.orders,
  emerald: iconAccentClass.fatture,
  purple: iconAccentClass.bolle,
  pink: 'text-pink-400',
  fuchsia: 'text-fuchsia-400',
  rose: iconAccentClass.approvazioni,
  lime: 'text-lime-400',
  teal: iconAccentClass.analytics,
  cyan: iconAccentClass.orders,
  sky: iconAccentClass.emailSync,
  amber: iconAccentClass.statements,
  violet: iconAccentClass.bolle,
  slate: iconAccentClass.settingsTools,
} as const satisfies Record<keyof typeof SUMMARY_HIGHLIGHT_KEYS, string>

export const SUMMARY_HIGHLIGHT_ACCENTS = {
  indigo: {
    border: NEUTRAL_BORDER,
    bar: NEUTRAL_BAR,
    label: NEUTRAL_LABEL,
    headerIcon: HEADER_ICON.indigo,
  },
  blue: {
    border: NEUTRAL_BORDER,
    bar: NEUTRAL_BAR,
    label: NEUTRAL_LABEL,
    headerIcon: HEADER_ICON.blue,
  },
  emerald: {
    border: NEUTRAL_BORDER,
    bar: NEUTRAL_BAR,
    label: NEUTRAL_LABEL,
    headerIcon: HEADER_ICON.emerald,
  },
  purple: {
    border: NEUTRAL_BORDER,
    bar: NEUTRAL_BAR,
    label: NEUTRAL_LABEL,
    headerIcon: HEADER_ICON.purple,
  },
  pink: {
    border: NEUTRAL_BORDER,
    bar: NEUTRAL_BAR,
    label: NEUTRAL_LABEL,
    headerIcon: HEADER_ICON.pink,
  },
  fuchsia: {
    border: NEUTRAL_BORDER,
    bar: NEUTRAL_BAR,
    label: NEUTRAL_LABEL,
    headerIcon: HEADER_ICON.fuchsia,
  },
  rose: {
    border: NEUTRAL_BORDER,
    bar: NEUTRAL_BAR,
    label: NEUTRAL_LABEL,
    headerIcon: HEADER_ICON.rose,
  },
  lime: {
    border: NEUTRAL_BORDER,
    bar: NEUTRAL_BAR,
    label: NEUTRAL_LABEL,
    headerIcon: HEADER_ICON.lime,
  },
  teal: {
    border: NEUTRAL_BORDER,
    bar: NEUTRAL_BAR,
    label: NEUTRAL_LABEL,
    headerIcon: HEADER_ICON.teal,
  },
  cyan: {
    border: NEUTRAL_BORDER,
    bar: NEUTRAL_BAR,
    label: NEUTRAL_LABEL,
    headerIcon: HEADER_ICON.cyan,
  },
  sky: {
    border: NEUTRAL_BORDER,
    bar: NEUTRAL_BAR,
    label: NEUTRAL_LABEL,
    headerIcon: HEADER_ICON.sky,
  },
  amber: {
    border: NEUTRAL_BORDER,
    bar: NEUTRAL_BAR,
    label: NEUTRAL_LABEL,
    headerIcon: HEADER_ICON.amber,
  },
  violet: {
    border: NEUTRAL_BORDER,
    bar: NEUTRAL_BAR,
    label: NEUTRAL_LABEL,
    headerIcon: HEADER_ICON.violet,
  },
  slate: {
    border: NEUTRAL_BORDER,
    bar: NEUTRAL_BAR,
    label: NEUTRAL_LABEL,
    headerIcon: HEADER_ICON.slate,
  },
} as const satisfies Record<
  keyof typeof SUMMARY_HIGHLIGHT_KEYS,
  { border: string; bar: string; label: string; headerIcon: string }
>

export type SummaryHighlightAccent = keyof typeof SUMMARY_HIGHLIGHT_ACCENTS

/**
 * Guscio esterno card/sezione: bordo top cyan unificato, sfondo semi-trasparente neutro.
 */
export const SUMMARY_HIGHLIGHT_SURFACE_CLASS =
  'relative overflow-hidden rounded-[10px] border-t-2 border-t-[#22d3ee] border-x-0 border-b-0 bg-white/[0.04] shadow-none backdrop-blur-none [-webkit-backdrop-filter:none] [backdrop-filter:none]'

/** Padding interno corpo (`AppSummaryHighlightCard`, tabelle in stesso guscio). */
export const SUMMARY_HIGHLIGHT_CARD_INNER_PADDING_CLASS =
  'px-4 py-3 sm:px-4 sm:py-4 md:px-5 md:py-4 lg:px-5'
