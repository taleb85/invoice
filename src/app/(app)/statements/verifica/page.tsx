'use client'

import { StatementsContent } from '@/app/(app)/statements/statements-views'
import { useMe } from '@/lib/me-context'

export default function StatementsVerificaPage() {
  const { me } = useMe()
  return (
    <StatementsContent
      section="status"
      sedeId={me?.sede_id ?? undefined}
      countryCode={me?.country_code ?? undefined}
      currency={me?.currency ?? undefined}
    />
  )
}
