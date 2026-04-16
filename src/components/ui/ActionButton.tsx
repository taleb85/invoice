import type { ButtonHTMLAttributes, ComponentProps } from 'react'
import Link from 'next/link'

/** Design system: neon verde conferme, viola integrazioni/ricerca, rosso elimina/anomalie. */
export type ActionButtonIntent = 'integration' | 'confirm' | 'danger' | 'nav'

const ACTION_BUTTON_BASE =
  'inline-flex shrink-0 items-center justify-center gap-1.5 font-semibold transition-[box-shadow,background-color,border-color,color,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:pointer-events-none disabled:opacity-45'

const INTENT_CLASS: Record<ActionButtonIntent, string> = {
  /** Viola neon — Rekki, Google, ricerche, collegamenti integrazione */
  integration: [
    ACTION_BUTTON_BASE,
    'rounded-xl border border-violet-400/55 bg-violet-950/55 px-4 py-2.5 text-sm text-violet-50',
    'shadow-[0_0_0_1px_rgba(167,139,250,0.35),0_0_28px_rgba(139,92,246,0.42),0_0_52px_rgba(76,29,149,0.28)]',
    'hover:border-violet-300/70 hover:bg-violet-600/35 hover:shadow-[0_0_0_1px_rgba(196,181,253,0.45),0_0_36px_rgba(167,139,250,0.5)]',
    'focus-visible:ring-violet-400/55 active:scale-[0.99]',
  ].join(' '),
  /** Verde neon #39FF14 — salva, conferma, prezzo OK */
  confirm: [
    ACTION_BUTTON_BASE,
    'rounded-xl border border-[#39FF14]/55 bg-emerald-950/50 px-4 py-2.5 text-sm font-bold text-[#39FF14]',
    'shadow-[0_0_0_1px_rgba(57,255,20,0.25),0_0_26px_rgba(57,255,20,0.35),0_0_48px_rgba(16,185,129,0.18)]',
    'hover:border-[#7CFF6A] hover:bg-emerald-900/45 hover:shadow-[0_0_32px_rgba(57,255,20,0.45)]',
    'focus-visible:ring-[#39FF14]/50 active:scale-[0.99]',
  ].join(' '),
  /** Rosso neon — duplicati da rimuovere, errori, elimina */
  danger: [
    ACTION_BUTTON_BASE,
    'rounded-xl border border-[#FF3131]/60 bg-red-950/50 px-4 py-2.5 text-sm text-red-50',
    'shadow-[0_0_0_1px_rgba(255,49,49,0.35),0_0_22px_rgba(255,49,49,0.38)]',
    'hover:border-[#FF6B6B] hover:bg-red-900/45 hover:shadow-[0_0_30px_rgba(255,49,49,0.48)]',
    'focus-visible:ring-red-400/55 active:scale-[0.99]',
  ].join(' '),
  /** Ciano / navigazione — dettagli, link rapidi (allineato ai pulsanti primari compatti) */
  nav: [
    ACTION_BUTTON_BASE,
    'rounded-xl border border-cyan-400/40 bg-cyan-950/40 px-4 py-2.5 text-sm text-cyan-50',
    'shadow-[0_0_0_1px_rgba(34,211,238,0.28),0_0_24px_rgba(34,211,238,0.28)]',
    'hover:border-cyan-300/55 hover:bg-cyan-900/35 hover:shadow-[0_0_32px_rgba(34,211,238,0.38)]',
    'focus-visible:ring-cyan-400/50 active:scale-[0.99]',
  ].join(' '),
}

const SIZE_SM = 'rounded-lg px-3 py-1.5 text-xs'

export function actionButtonClassName(intent: ActionButtonIntent, size: 'md' | 'sm' = 'md', extra = ''): string {
  const base = INTENT_CLASS[intent]
  const sz = size === 'sm' ? SIZE_SM : ''
  return `${base} ${sz} ${extra}`.trim()
}

export type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  intent: ActionButtonIntent
  size?: 'md' | 'sm'
}

export function ActionButton({ intent, size = 'md', className = '', type = 'button', ...rest }: ActionButtonProps) {
  return <button type={type} className={actionButtonClassName(intent, size, className)} {...rest} />
}

export type ActionLinkProps = Omit<ComponentProps<typeof Link>, 'className'> & {
  intent: ActionButtonIntent
  size?: 'md' | 'sm'
  className?: string
}

export function ActionLink({ intent, size = 'md', className = '', ...rest }: ActionLinkProps) {
  return <Link className={actionButtonClassName(intent, size, className)} {...rest} />
}
