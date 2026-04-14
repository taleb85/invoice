import { Suspense } from 'react'
import NuovaBollaForm from './nuova-bolla-form'

export const dynamic = 'force-dynamic'

export default function NuovaBollaPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-slate-500">
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
        </div>
      }
    >
      <NuovaBollaForm />
    </Suspense>
  )
}
