'use client'

import type { EmailBodySupplierHint } from '@/lib/dashboard-email-body-supplier-hints'
import { NewFornitoreLink } from '@/components/NewFornitoreLink'

type Props = {
  hints: EmailBodySupplierHint[]
  /** Testo banner con `{name}` sostituito dalla hint */
  bannerLineTemplate: string
  ctaLabel: string
}

/**
 * Righe suggerimento fornitore ricorrenti (corpo email): link a `/fornitori/new` con ritorno automatico (`NewFornitoreLink`).
 */
export default function DashboardEmailBodySupplierHints({ hints, bannerLineTemplate, ctaLabel }: Props) {
  if (hints.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      {hints.map((h) => (
        <div
          key={`${h.sedeId ?? 'all'}-${h.displayName}`}
          className="flex flex-col gap-2 rounded-xl border border-[rgba(34,211,238,0.15)] bg-violet-950/35 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm text-violet-100">
            {bannerLineTemplate.replace(/\{name\}/g, h.displayName)}
            <span className="ml-1.5 tabular-nums text-violet-300/85">×{h.hits}</span>
          </p>
          <NewFornitoreLink
            href={h.newFornitoreHref}
            className="shrink-0 text-sm font-semibold text-violet-300 underline decoration-violet-400/50 hover:text-violet-200"
          >
            {ctaLabel}
          </NewFornitoreLink>
        </div>
      ))}
    </div>
  )
}
