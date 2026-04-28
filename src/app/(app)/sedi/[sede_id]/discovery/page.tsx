'use client'

import { useParams } from 'next/navigation'
import { DiscoveryContent } from '@/app/(app)/impostazioni/fornitori/discovery/page'
import { segmentParam } from '@/lib/segment-param'
import { useT } from '@/lib/use-t'

export default function SedeDiscoveryPage() {
  const sede_id = segmentParam(useParams().sede_id)
  const t = useT()
  return (
    <DiscoveryContent
      sedeId={sede_id}
      backNav={{ href: `/sedi/${sede_id}`, label: t.nav.bottomNavBackToSede }}
    />
  )
}
