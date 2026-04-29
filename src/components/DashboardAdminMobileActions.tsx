'use client'

import Link from 'next/link'
import { NewFornitoreLink } from '@/components/NewFornitoreLink'
import { useActiveOperator } from '@/lib/active-operator-context'
import { useT } from '@/lib/use-t'

interface Props {
  sedeId: string
  sedeOperatoriHref: string
}

export function DashboardAdminMobileActions({ sedeId, sedeOperatoriHref }: Props) {
  const { activeOperator } = useActiveOperator()
  const t = useT()

  // Hide when an operator profile is active
  if (activeOperator) return null

  return (
    <div className="grid grid-cols-1 gap-2 md:hidden">
      <NewFornitoreLink
        href={`/fornitori/new?prefill_sede_id=${encodeURIComponent(sedeId)}`}
        className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[rgba(34,211,238,0.15)] bg-violet-600/20 px-3 py-2.5 text-sm font-bold text-violet-100"
      >
        {t.fornitori.new}
      </NewFornitoreLink>
      <Link
        href={sedeOperatoriHref}
        className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[rgba(34,211,238,0.15)] bg-violet-950/25 px-3 py-2.5 text-sm font-semibold text-violet-200"
      >
        {t.sedi.addOperatorSedeTitle}
      </Link>
      <Link
        href="/log"
        className="flex min-h-[44px] items-center justify-center rounded-xl border border-app-line-28 px-3 py-2 text-xs font-medium text-app-fg-muted"
      >
        {t.nav.logEmail}
      </Link>
    </div>
  )
}
