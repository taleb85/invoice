import { Suspense } from 'react'
import ImportFornitoreInner from './import-fornitore-client'

export const dynamic = 'force-dynamic'

export default function ImportFornitorePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center p-8 text-slate-500">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
        </div>
      }
    >
      <ImportFornitoreInner />
    </Suspense>
  )
}
