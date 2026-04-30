/**
 * Layout condiviso pagine “sezione” raggiunte dai KPI dashboard (stesso ordine visivo:
 * strip titolo + anno fiscale a destra → riepilogo → tabella in card).
 */
export const APP_SHELL_SECTION_PAGE_CLASS = 'w-full min-w-0 app-shell-page-padding'

/**
 * Contenitore modifica / nuovo fornitore: stesso canale orizzontale della scheda fornitore (`max-w-[83rem]` + `fornitore-desktop-main-x`).
 */
export const APP_FORNITORE_FORM_PAGE_SHELL_CLASS =
  'fornitore-desktop-main-x mx-auto flex w-full min-w-0 max-w-[83rem] flex-col gap-3 pb-8 pt-2 md:gap-4 md:pb-10'

/** Stack verticale (header strip → contenuto) come la dashboard KPI; corpo trasparente sul canvas workspace. */
export const APP_SHELL_SECTION_PAGE_STACK_CLASS =
  'flex w-full min-w-0 flex-col gap-3 md:gap-4 app-shell-page-padding'

/**
 * Padding della riga interna `AppPageHeaderStrip` con `dense` (corpo trasparente sul canvas).
 * Stesso filo per griglia KPI e card Scanner sulla dashboard.
 */
export const APP_PAGE_HEADER_INNER_DENSE_PADDING_CLASS =
  'px-4 py-2 sm:px-4 sm:py-2.5 md:px-6 md:py-2.5 lg:px-8 xl:px-10'

/** h1 standard nelle strip di quelle pagine (stessa scala su tutti i breakpoint). */
export const APP_SHELL_SECTION_PAGE_H1_CLASS =
  'app-page-title app-page-title-glow text-[16px] font-medium leading-snug sm:text-[18px] md:text-[20px]'

/** Sottotitoli / metadati sotto il titolo o in card riepilogo. */
export const APP_SHELL_SECTION_PAGE_SUBTITLE_CLASS = 'text-xs leading-snug text-app-fg-muted'

/** Variante compatta per strip affollate (es. Analitiche con FY + tray). */
export const APP_SHELL_SECTION_PAGE_H1_COMPACT_CLASS =
  'app-page-title app-page-title-glow text-[14px] font-medium leading-snug sm:text-[15px] md:text-[16px]'

export const APP_SHELL_SECTION_PAGE_SUBTITLE_COMPACT_CLASS =
  'text-[11px] leading-snug text-app-fg-muted sm:text-xs'

/**
 * Titolo h1 dentro `AppPageHeaderStrip` (modello `/sedi`: stessa scala `APP_SHELL_SECTION_PAGE_H1_CLASS` + grassetto).
 */
export const APP_PAGE_HEADER_STRIP_H1_CLASS = `${APP_SHELL_SECTION_PAGE_H1_CLASS} font-bold`

/**
 * Sottotitolo opzionale sotto l’h1 nello strip (stesso ritmo responsive di `/sedi`).
 */
export const APP_PAGE_HEADER_STRIP_SUBTITLE_CLASS =
  'max-w-[min(100%,40rem)] text-[11px] leading-snug text-app-fg-muted sm:text-sm sm:leading-tight'

/**
 * Barra filtri sotto header (allineata al padding interno tabelle `SUMMARY_HIGHLIGHT_CARD_INNER_PADDING_CLASS`).
 */
export const APP_SECTION_FILTERS_STRIP_CLASS =
  'flex w-full min-w-0 flex-wrap items-center gap-2 border-b border-app-line-22 app-workspace-inset-bg-soft px-4 py-2.5 sm:gap-3 sm:px-4 sm:py-3 md:px-5 lg:px-6 xl:px-8'

/** Link filtri / azioni nella card riepilogo (`AppSummaryHighlightCard` trailing). */
export const APP_SECTION_TRAILING_LINK_CLASS =
  'text-app-fg-muted transition-colors hover:text-app-fg'

export const APP_SECTION_TRAILING_SEP_CLASS = 'text-app-fg-muted'

/** CTA sotto messaggio empty state (stesso stile ovunque). */
export const APP_SECTION_EMPTY_LINK_CLASS =
  'mt-4 inline-block text-sm font-semibold text-app-fg-muted transition-colors hover:text-app-fg'

/** Come sopra con `mt-3` (schede fornitore / card compatte). */
export const APP_SECTION_EMPTY_LINK_CLASS_COMPACT =
  'mt-3 inline-block text-sm font-semibold text-app-fg-muted transition-colors hover:text-app-fg hover:underline'

/** Barra strumenti sotto header (liste dense / filtri). */
export const APP_SECTION_TOOLBAR_STRIP = 'border-b border-app-line-22 app-workspace-inset-bg-soft px-4 py-2.5'

/** Blocco titolo sezione con bordo inferiore (variante più ariosa). */
export const APP_SECTION_PANEL_HEAD_BLOCK = 'border-b border-app-line-22 app-workspace-inset-bg-soft px-5 py-4'

/** Intestazione tabella desktop (card dati sotto il riepilogo). */
export const APP_SECTION_TABLE_HEAD_ROW = 'border-b border-app-line-22 app-workspace-inset-bg-soft'

/** Accenti bordo inferiore thead (liste Ordini / Bolle / Fatture / Documenti). */
export type AppSectionTableHeadAccent =
  | 'indigo'
  | 'emerald'
  | 'rose'
  | 'amber'
  | 'fuchsia'
  | 'violet'
  | 'cyan'
  | 'sky'

const APP_SECTION_TABLE_HEAD_ACCENT_BORDER: Record<AppSectionTableHeadAccent, string> = {
  indigo: 'border-b border-[rgba(34,211,238,0.15)]',
  emerald: 'border-b border-[rgba(34,211,238,0.15)]',
  rose: 'border-b border-[rgba(34,211,238,0.15)]',
  amber: 'border-b border-[rgba(34,211,238,0.15)]',
  fuchsia: 'border-b border-[rgba(34,211,238,0.15)]',
  violet: 'border-b border-[rgba(34,211,238,0.15)]',
  cyan: 'border-b border-[rgba(34,211,238,0.15)]',
  sky: 'border-b border-[rgba(34,211,238,0.15)]',
}

/** Thead con bordo colorato + stesso sfondo delle altre tabelle sezione. */
export function appSectionTableHeadRowAccentClass(accent: AppSectionTableHeadAccent): string {
  return `app-workspace-inset-bg-soft ${APP_SECTION_TABLE_HEAD_ACCENT_BORDER[accent]}`
}

/** Header tabella su sfondo leggermente più marcato (es. modali / confronti densi). */
export const APP_SECTION_TABLE_HEAD_ROW_STRONG = 'border-b border-app-line-22 app-workspace-inset-bg'

/**
 * `<thead>` con sticky scroll — si fissa al top del contenitore `overflow-y-auto` più vicino
 * (solitamente `#app-main`). Backdrop-blur opaco per coprire le righe scorrenti.
 */
export const APP_SECTION_TABLE_THEAD_STICKY =
  'sticky top-0 z-10 backdrop-blur-xl [-webkit-backdrop-filter:blur(16px)] bg-slate-900/85'

export const APP_SECTION_TABLE_TH =
  'px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[1.5px] text-app-fg-muted md:px-5 md:py-3 lg:py-2'

export const APP_SECTION_TABLE_TH_RIGHT =
  'px-4 py-2.5 text-right font-mono text-[11px] font-semibold uppercase tracking-[1.5px] tabular-nums text-app-fg-muted md:px-5 md:py-3 lg:py-2'

/** Separazione righe in stack / liste (stesso token del tbody tabella). */
export const APP_SECTION_DIVIDE_ROWS = 'divide-y divide-app-soft-border'

export const APP_SECTION_TABLE_TBODY = 'divide-y divide-app-soft-border'

/** Hover riga unificato — più visibile su desktop con mouse. */
export const APP_SECTION_TABLE_ROW_HOVER =
  'transition-colors hover:bg-white/[0.04]'

export const APP_SECTION_TABLE_TR = `group even:bg-white/[0.025] ${APP_SECTION_TABLE_ROW_HOVER}`

export const APP_SECTION_TABLE_TR_GROUP = APP_SECTION_TABLE_TR

/** Celle dati tabella — padding compatto su mobile, normale su tablet, denso su desktop. */
export const APP_SECTION_TABLE_TD = 'px-4 py-2.5 text-[13px] align-middle md:px-5 md:py-3 lg:py-2'

/** Importi / numeri confrontabili: monospace, allineati a destra. */
export const APP_SECTION_TABLE_TD_NUMERIC = `${APP_SECTION_TABLE_TD} text-right font-mono tabular-nums`

/** Importo positivo / totale (neon verde). */
export const APP_SECTION_AMOUNT_POSITIVE_CLASS = 'app-amount-positive-neon'

/** Anomalie, duplicati, saldi negativi (neon rosso). */
export const APP_SECTION_AMOUNT_NEGATIVE_CLASS = 'app-amount-negative-neon'

/** Link primario in cella (fornitore / dettaglio riga). */
export const APP_SECTION_TABLE_CELL_LINK =
  'font-medium text-app-fg-muted transition-colors hover:text-app-fg'

/** Lista mobile sotto card dati. */
export const APP_SECTION_MOBILE_LIST = 'divide-y divide-app-soft-border md:hidden'

export const APP_SECTION_MOBILE_ROW = `px-4 py-4 ${APP_SECTION_TABLE_ROW_HOVER}`

/**
 * Chip / segmenti (filtri Attività, periodo Analytics, ecc.): stessa altezza delle righe
 * input desktop (`min-height: 36px` in globals) e stessa scala tipografica delle pill tabelle.
 */
export const APP_SEGMENT_CHIP_CONTROL_CLASS =
  'inline-flex min-h-9 shrink-0 items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors touch-manipulation'

/**
 * Etichetta chip in riga (es. badge azione + icona in timeline): stesso box dei controlli segment.
 */
export const APP_SEGMENT_CHIP_LABEL_CLASS =
  'mr-1.5 inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold'

/** Pill / azione secondaria in riga (es. “Apri fattura”). */
export const APP_SECTION_ROW_ACTION_PILL =
  'inline-flex items-center gap-1.5 rounded-lg bg-app-line-15 px-3 py-1.5 text-xs font-medium text-app-fg-muted transition-colors hover:bg-app-line-25'

/** Chip compatto in lista mobile (es. link bolla). */
export const APP_SECTION_ROW_ACTION_CHIP =
  'inline-flex items-center gap-1 rounded-full bg-app-line-15 px-2 py-0.5 text-xs font-medium text-app-fg-muted transition-colors hover:bg-app-line-25'
