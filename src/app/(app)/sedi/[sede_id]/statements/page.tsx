'use client'

import { useParams } from 'next/navigation'
import { StatementsContent } from '@/app/(app)/statements/statements-views'
import { segmentParam } from '@/lib/segment-param'
import { useT } from '@/lib/use-t'

export default function SedeStatementsPage() {
  const sede_id = segmentParam(useParams().sede_id)
  const t = useT()
  return (
    <StatementsContent
      sedeId={sede_id}
      backNav={{ href: `/sedi/${sede_id}`, label: t.nav.bottomNavBackToSede }}
    />
  )
}
