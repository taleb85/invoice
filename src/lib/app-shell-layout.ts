/**
 * Layout condiviso pagine “sezione” raggiunte dai KPI dashboard (stesso ordine visivo:
 * strip titolo + anno fiscale a destra → riepilogo → tabella in card).
 */
export const APP_SHELL_SECTION_PAGE_CLASS = 'w-full min-w-0 app-shell-page-padding'

/**
 * Contenitore modifica / nuovo fornitore: stesso canale orizzontale della scheda fornitore (`max-w-[83rem]` + `fornitore-desktop-main-x`).
 */
export const APP_FORNITORE_FORM_PAGE_SHELL_CLASS =
  'fornitore-desktop-main-x mx-auto flex w-full min-w-0 max-w-[83rem] flex-col gap-5 pb-8 pt-2 md:gap-6 md:pb-10'

/**
 * Pagine sezione a stack (header → riepilogo → lista): stesso ritmo verticale della dashboard
 * (`gap-5 md:gap-6`). Sulle strip/card che hanno ancora `mb-6`/`mb-8`, passare `className="!mb-0"`.
 */
export const APP_SHELL_SECTION_PAGE_STACK_CLASS =
  'flex w-full min-w-0 flex-col gap-5 md:gap-6 app-shell-page-padding'

/**
 * Padding della riga interna `AppPageHeaderStrip` con `dense` (corpo trasparente sul canvas).
 * Stesso filo per griglia KPI e card Scanner sulla dashboard.
 */
export const APP_PAGE_HEADER_INNER_DENSE_PADDING_CLASS =
  'px-3 py-2 sm:px-3 sm:py-2.5 md:px-4 md:py-2.5 lg:px-5'

/** h1 standard nelle strip di quelle pagine (stessa scala su tutti i breakpoint). */
export const APP_SHELL_SECTION_PAGE_H1_CLASS =
  'app-page-title text-lg font-bold leading-snug sm:text-xl md:text-2xl'

/** Link filtri / azioni nella card riepilogo (`AppSummaryHighlightCard` trailing). */
export const APP_SECTION_TRAILING_LINK_CLASS =
  'text-app-cyan-500 transition-colors hover:text-app-fg'

export const APP_SECTION_TRAILING_SEP_CLASS = 'text-app-fg-muted'

/** CTA sotto messaggio empty state (stesso stile ovunque). */
export const APP_SECTION_EMPTY_LINK_CLASS =
  'mt-4 inline-block text-sm font-semibold text-app-cyan-500 transition-colors hover:text-app-fg'

/** Come sopra con `mt-3` (schede fornitore / card compatte). */
export const APP_SECTION_EMPTY_LINK_CLASS_COMPACT =
  'mt-3 inline-block text-sm font-semibold text-app-cyan-500 transition-colors hover:text-app-fg hover:underline'

/** Barra strumenti sotto header (liste dense / filtri). */
export const APP_SECTION_TOOLBAR_STRIP = 'border-b border-app-line-22 app-workspace-inset-bg-soft px-4 py-2.5'

/** Blocco titolo sezione con bordo inferiore (variante più ariosa). */
export const APP_SECTION_PANEL_HEAD_BLOCK = 'border-b border-app-line-22 app-workspace-inset-bg-soft px-5 py-4'

/** Intestazione tabella desktop (card dati sotto il riepilogo). */
export const APP_SECTION_TABLE_HEAD_ROW = 'border-b border-app-line-22 app-workspace-inset-bg-soft'

/** Header tabella su sfondo leggermente più marcato (es. modali / confronti densi). */
export const APP_SECTION_TABLE_HEAD_ROW_STRONG = 'border-b border-app-line-22 app-workspace-inset-bg'

export const APP_SECTION_TABLE_TH =
  'px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-app-fg-muted'

export const APP_SECTION_TABLE_TH_RIGHT =
  'px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-app-fg-muted'

/** Separazione righe in stack / liste (stesso token del tbody tabella). */
export const APP_SECTION_DIVIDE_ROWS = 'divide-y divide-app-soft-border'

export const APP_SECTION_TABLE_TBODY = 'divide-y divide-app-soft-border'

export const APP_SECTION_TABLE_TR = 'transition-colors hover:bg-black/12'

export const APP_SECTION_TABLE_TR_GROUP = 'group transition-colors hover:bg-black/12'

/** Link primario in cella (fornitore / dettaglio riga). */
export const APP_SECTION_TABLE_CELL_LINK =
  'font-medium text-app-cyan-500 transition-colors hover:text-app-fg'

/** Lista mobile sotto card dati. */
export const APP_SECTION_MOBILE_LIST = 'divide-y divide-app-soft-border md:hidden'

export const APP_SECTION_MOBILE_ROW = 'px-4 py-4 transition-colors hover:bg-black/12'

/** Pill / azione secondaria in riga (es. “Apri fattura”). */
export const APP_SECTION_ROW_ACTION_PILL =
  'inline-flex items-center gap-1.5 rounded-lg bg-app-line-15 px-3 py-1.5 text-xs font-medium text-app-fg-muted transition-colors hover:bg-app-line-25'

/** Chip compatto in lista mobile (es. link bolla). */
export const APP_SECTION_ROW_ACTION_CHIP =
  'inline-flex items-center gap-1 rounded-full bg-app-line-15 px-2 py-0.5 text-xs font-medium text-app-fg-muted transition-colors hover:bg-app-line-25'
