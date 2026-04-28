/**
 * Classi Tailwind `text-*` per icone (SVG / Lucide) — un solo punto di verità tematico.
 * Valgono solo per le icone; testi e superfici seguono il resto del design system.
 */
export const iconAccentClass = {
  orders: 'text-cyan-400',
  bolle: 'text-violet-400',
  fatture: 'text-emerald-400',
  statements: 'text-amber-400',
  /** Documenti da revisionare / alert da gestire */
  reviewWarning: 'text-orange-400',
  /** Email, log di sync */
  emailSync: 'text-sky-400',
  fornitori: 'text-indigo-400',
  approvazioni: 'text-rose-400',
  /** KPI / grafici / overview */
  analytics: 'text-teal-400',
  /** Impostazioni, backup, lingua, strumenti secondari */
  settingsTools: 'text-slate-400',
  duplicateAlert: 'text-red-400',
  /** Esci, elimina, azioni distruttive */
  destructive: 'text-red-400',
  success: 'text-green-400',
  /** Dashboard home / panoramica (uso nav principale). */
  home: 'text-teal-400',
} as const

export type IconAccentClassKey = keyof typeof iconAccentClass
