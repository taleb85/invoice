'use client'

import { useMe } from '@/lib/me-context'
import { StatementsContent } from '@/app/(app)/statements/statements-views'

export default function StatementsDaProcessarePage() {
  const { me } = useMe()
  return (
    <StatementsContent
      section="pending"
      sedeId={me?.sede_id ?? undefined}
      countryCode={me?.country_code ?? undefined}
      currency={me?.currency ?? undefined}
    />
  )
}
