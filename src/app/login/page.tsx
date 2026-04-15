import { Suspense } from 'react'
import LoginBrandedShell from '@/components/LoginBrandedShell'
import LoginProviders from './LoginProviders'
import LoginPageClient from './LoginPageClient'

/**
 * Nessuna lettura `cookies()` qui: evita 500 RSC in ambienti dove il login deve restare statico.
 * Lingua e `/api/me` arrivano dal client (cookie + UserProvider).
 */
export default function LoginPage() {
  return (
    <LoginBrandedShell>
      <LoginProviders>
        <Suspense
          fallback={
            <div className="flex min-h-[40vh] w-full max-w-xs flex-col items-center justify-center gap-3 px-4">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-app-cyan-400 border-t-transparent" />
            </div>
          }
        >
          <LoginPageClient />
        </Suspense>
      </LoginProviders>
    </LoginBrandedShell>
  )
}
