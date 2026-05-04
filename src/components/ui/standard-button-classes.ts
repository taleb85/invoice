/**
 * Classi condivise per `StandardButton` e per `<Link>` server-side con lo stesso look.
 *
 * Varianti dimensionali (`size`):
 *   xl  – CTA primari pagina (h-11)
 *   md  – default – azioni in card/form (h-10)
 *   sm  – pill in tabelle, azioni compatte (h-8)
 *   xs  – toolbar compatta desktop (h-7)
 */

export const STANDARD_BUTTON_BASE =
  'inline-flex shrink-0 items-center justify-center gap-1.5 font-semibold transition-[box-shadow,background-color,border-color,color,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-a-40 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:pointer-events-none disabled:opacity-45'

/* ─── Varianti colore (indipendenti dalla taglia) ─────────────────── */

export const STANDARD_BUTTON_PRIMARY =
  'rounded-xl bg-app-cyan-400 text-cyan-950 shadow-[0_0_0_1px_rgba(103,232,249,0.35),0_0_28px_rgba(34,211,238,0.45),0_0_56px_rgba(6,182,212,0.22),0_10px_28px_rgba(0,0,0,0.45)] hover:bg-app-cyan-300 hover:shadow-[0_0_0_1px_rgba(165,243,252,0.45),0_0_36px_rgba(34,211,238,0.55),0_0_72px_rgba(6,182,212,0.28),0_10px_28px_rgba(0,0,0,0.45)] active:scale-[0.99] active:bg-app-cyan-500'

export const STANDARD_BUTTON_SECONDARY =
  'rounded-xl border border-app-line-25 bg-gradient-to-b from-app-line-15 to-violet-500/10 text-app-fg-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_18px_-8px_rgba(34,211,238,0.25)] ring-1 ring-inset ring-white/10 hover:border-app-a-45 hover:text-app-fg hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_24px_-6px_rgba(34,211,238,0.38)] active:scale-[0.99]'

export const STANDARD_BUTTON_DANGER =
  'rounded-xl border border-[rgba(34,211,238,0.15)] bg-red-950/45 text-red-100 shadow-[0_0_16px_-6px_rgba(248,113,113,0.35),inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-red-400/15 hover:border-[rgba(34,211,238,0.15)] hover:bg-red-600/25 hover:text-red-50 hover:shadow-[0_0_22px_-4px_rgba(248,113,113,0.45)] active:scale-[0.99]'

/* ─── Varianti dimensionali (da aggiungere a BASE + colore) ───────── */

/**
 * `xl` – CTA primari pagina
 *   h-11, rounded-xl, text-sm, px-5, py-3
 */
export const BTN_SIZE_XL = 'h-11 min-h-11 px-5 py-3 text-sm rounded-xl'

/**
 * `md` – default – azioni in card, form, pagine
 *   h-10, rounded-xl, text-xs, px-4, py-2.5
 */
export const BTN_SIZE_MD = 'h-10 min-h-10 px-4 py-2.5 text-xs rounded-xl'

/**
 * `sm` – pill in tabelle, azioni compatte inline
 *   h-8, rounded-lg, text-[11px], px-3, py-1.5
 */
export const BTN_SIZE_SM = 'h-8 min-h-8 px-3 py-1.5 text-[11px] rounded-lg'

/**
 * `xs` – toolbar compatta desktop
 *   h-7, rounded-md, text-[10px], px-2, py-1
 */
export const BTN_SIZE_XS = 'h-7 min-h-7 px-2 py-1 text-[10px] rounded-md'

/* ─── Legacy aliases (da deprecare) ───────────────────────────────── */

/** @deprecated Usa `BTN_SIZE_SM` */
export const STANDARD_BUTTON_SIZE_SM_PRIMARY = BTN_SIZE_SM
/** @deprecated Usa `BTN_SIZE_SM` */
export const STANDARD_BUTTON_SIZE_SM_SECONDARY = BTN_SIZE_SM
