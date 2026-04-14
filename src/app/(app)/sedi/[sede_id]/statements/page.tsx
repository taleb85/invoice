'use client'

import { useParams } from 'next/navigation'
import { StatementsContent } from '@/app/(app)/statements/statements-views'
import { segmentParam } from '@/lib/segment-param'

export default function SedeStatementsPage() {
  const sede_id = segmentParam(useParams().sede_id)
  return <StatementsContent sedeId={sede_id} />
}
