'use client'

import { use } from 'react'
import { StatementsContent } from '@/app/(app)/statements/page'

export default function SedeStatementsPage({ params }: { params: Promise<{ sede_id: string }> }) {
  const { sede_id } = use(params)
  return <StatementsContent sedeId={sede_id} />
}
