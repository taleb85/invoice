'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { AiAnalysisModal } from './AiAnalysisModal'
import { useT } from '@/lib/use-t'

type Props = {
  entityType: 'bolla' | 'fattura'
  entityId: string
  fornitoreId?: string | null
}

export function AiAnalysisButton({ entityType, entityId, fornitoreId }: Props) {
  const t = useT()
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm font-medium text-app-cyan-500 transition-colors hover:text-app-fg-muted"
      >
        <Sparkles className="h-4 w-4" aria-hidden />
        {entityType === 'bolla' ? t.bolle.contextMenuAiAnalysis : t.fatture.contextMenuAiAnalysis}
      </button>
      <AiAnalysisModal
        open={open}
        onOpenChange={() => setOpen(false)}
        entityType={entityType}
        entityId={entityId}
        fornitoreId={fornitoreId}
      />
    </>
  )
}
