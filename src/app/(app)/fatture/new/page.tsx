import { Suspense } from 'react'
import NuovaFatturaForm from './nuova-fattura-client'

export const dynamic = 'force-dynamic'

export default function NuovaFatturaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center p-8 text-app-fg-muted">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-app-cyan-500 border-t-transparent" />
        </div>
      }
    >
      <NuovaFatturaForm />
    </Suspense>
  )
}
