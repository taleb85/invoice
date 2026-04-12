'use client'

import { useParams } from 'next/navigation'
import { DiscoveryContent } from '@/app/(app)/impostazioni/fornitori/discovery/page'
import { segmentParam } from '@/lib/segment-param'

export default function SedeDiscoveryPage() {
  const sede_id = segmentParam(useParams().sede_id)
  return <DiscoveryContent sedeId={sede_id} />
}
