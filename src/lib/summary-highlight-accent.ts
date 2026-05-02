/**
 * Accent card riepilogo: bordo/barra unificati; etichette metriche (`label`) restano neutre.
 * `headerIcon` usa le stesse classi `iconAccentClass` della sidebar (`@/lib/icon-accent-classes`).
 */

import { iconAccentClass } from '@/lib/icon-accent-classes'

const NEUTRAL_BAR = ''
const NEUTRAL_LABEL = 'text-app-fg-muted'
const NEUTRAL_BORDER = 'border-app-line-35'

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
} as const

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
  keyof typeof HEADER_ICON,
  { border: string; bar: string; label: string; headerIcon: string }
>

export type SummaryHighlightAccent = keyof typeof SUMMARY_HIGHLIGHT_ACCENTS

/**
 * Layout esterno a tutta larghezza (KPI `glassShell`, scanner, `AuroraPanelShell`): solo struttura flex, senza classe `.glass-card`.
 */
export const AURORA_GLASS_PANEL_LAYOUT_CLASS =
  'relative flex w-full min-w-0 flex-col min-h-0'

/**
 * Guscio esterno card/sezione: bordo neutro, sfondo trasparente sul canvas (KPI, strip FY, scanner, ecc.).
 */
export const SUMMARY_HIGHLIGHT_SURFACE_CLASS =
  'app-summary-highlight-surface relative overflow-hidden rounded-[10px] border border-app-line-28 bg-transparent shadow-none backdrop-blur-none [-webkit-backdrop-filter:none] [backdrop-filter:none]'

/**
 * Come {@link SUMMARY_HIGHLIGHT_SURFACE_CLASS} ma con `border-app-line-35`, allineato a `SUMMARY_HIGHLIGHT_ACCENTS.*.border`
 * e alla strip dashboard — usato da `AppPageHeaderStrip` per tutte le pagine gestionali.
 */
export const SUMMARY_HIGHLIGHT_SURFACE_HEADER_CLASS =
  'app-summary-highlight-surface relative overflow-hidden rounded-[10px] border border-app-line-35 bg-transparent shadow-none backdrop-blur-none [-webkit-backdrop-filter:none] [backdrop-filter:none]'

/** @deprecated Usare `SUMMARY_HIGHLIGHT_SURFACE_CLASS` (stesso valore). */
export const SUMMARY_HIGHLIGHT_HEADER_STRIP_SURFACE_CLASS = SUMMARY_HIGHLIGHT_SURFACE_CLASS

/** Padding interno corpo (`AppSummaryHighlightCard`, tabelle in stesso guscio). */
export const SUMMARY_HIGHLIGHT_CARD_INNER_PADDING_CLASS =
  'px-4 py-3 sm:px-4 sm:py-4 md:px-5 md:py-4 lg:px-5'
