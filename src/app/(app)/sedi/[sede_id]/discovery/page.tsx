'use client'

import { use } from 'react'
import { DiscoveryContent } from '@/app/(app)/impostazioni/fornitori/discovery/page'

export default function SedeDiscoveryPage({ params }: { params: Promise<{ sede_id: string }> }) {
  const { sede_id } = use(params)
  return <DiscoveryContent sedeId={sede_id} />
}
