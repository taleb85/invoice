import { Suspense } from 'react'
import NewFornitoreForm from './new-fornitore-client'

export const dynamic = 'force-dynamic'

export default function NewFornitore() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
          <div className="size-6 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
        </div>
      }
    >
      <NewFornitoreForm />
    </Suspense>
  )
}
