import { Suspense } from 'react'
import LoginBrandedShell from '@/components/LoginBrandedShell'
import LoginProviders from '@/app/login/LoginProviders'
import AccessoLoginClient from './AccessoLoginClient'

/**
 * Stesso motivo di `/login`: niente `getAppMeShellResult`/`cookies()` in RSC (evita Internal Server Error).
 * La sessione e il profilo si caricano via `UserProvider` → `/api/me` sul client.
 */
export default function AccessoPage() {
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
          <AccessoLoginClient />
        </Suspense>
      </LoginProviders>
    </LoginBrandedShell>
  )
}
