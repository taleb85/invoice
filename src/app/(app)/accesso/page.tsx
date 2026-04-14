import { Suspense } from 'react'
import AccessoPageClient from './AccessoPageClient'

export default function AccessoPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center px-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
        </div>
      }
    >
      <AccessoPageClient />
    </Suspense>
  )
}
