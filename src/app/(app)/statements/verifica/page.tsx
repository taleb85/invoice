'use client'

import { StatementsContent } from '@/app/(app)/statements/statements-views'
import { BackButton } from '@/components/BackButton'
import { useMe } from '@/lib/me-context'
import { useT } from '@/lib/use-t'

export default function StatementsVerificaPage() {
  const { me } = useMe()
  const t = useT()
  return (
    <>
      <div className="app-shell-page-padding pb-0">
        <BackButton href="/" label={t.nav.dashboard} />
      </div>
      <StatementsContent
      section="status"
      sedeId={me?.sede_id ?? undefined}
      countryCode={me?.country_code ?? undefined}
      currency={me?.currency ?? undefined}
    />
    </>
  )
}
