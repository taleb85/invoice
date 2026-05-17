import { getProfile, getRequestAuth } from '@/utils/supabase/server'
import { getCookieStore, getT } from '@/lib/locale-server'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import {
  APP_PAGE_HEADER_STRIP_H1_CLASS,
  APP_PAGE_HEADER_STRIP_SUBTITLE_CLASS,
  APP_SHELL_SECTION_PAGE_STACK_CLASS,
} from '@/lib/app-shell-layout'
import { BackButton } from '@/components/BackButton'
import { resolveActiveSedeIdForLists } from '@/lib/resolve-active-sede-for-lists'
import CentroControlloClient from './centro-controllo-client'

export const dynamic = 'force-dynamic'

export default async function CentroControlloPage() {
  const [t, cookieStore, profile, { supabase }] = await Promise.all([
    getT(),
    getCookieStore(),
    getProfile(),
    getRequestAuth(),
  ])

  const sedeId = await resolveActiveSedeIdForLists(
    supabase,
    profile ? { role: profile.role, sede_id: profile.sede_id } : undefined,
    (n) => cookieStore.get(n),
  )

  return (
    <div className={APP_SHELL_SECTION_PAGE_STACK_CLASS}>
      <AppPageHeaderStrip>
        <BackButton href="/" />
        <div className="flex-1">
          <h1 className={APP_PAGE_HEADER_STRIP_H1_CLASS}>
            Centro Controllo
          </h1>
          <p className={APP_PAGE_HEADER_STRIP_SUBTITLE_CLASS}>
            Coda unificata documenti — gestisci tutto da un&apos;unica schermata
          </p>
        </div>
      </AppPageHeaderStrip>

      <CentroControlloClient
        sedeId={sedeId}
      />
    </div>
  )
}
