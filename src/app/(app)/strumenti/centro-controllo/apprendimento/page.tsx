import { redirect } from 'next/navigation'
import { getProfile, getRequestAuth } from '@/utils/supabase/server'
import { getCookieStore, getT } from '@/lib/locale-server'
import { isSedePrivilegedRole } from '@/lib/roles'
import { resolveActiveSedeIdForLists } from '@/lib/resolve-active-sede-for-lists'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { BackButton } from '@/components/BackButton'

import {
  APP_PAGE_HEADER_STRIP_H1_CLASS,
  APP_PAGE_HEADER_STRIP_SUBTITLE_CLASS,
  APP_SHELL_SECTION_PAGE_STACK_CLASS,
} from '@/lib/app-shell-layout'
import ApprendimentoClient from './apprendimento-client'

export default async function ApprendimentoPage() {
  const [profile, t, cookieStore, { supabase }] = await Promise.all([
    getProfile(),
    getT(),
    getCookieStore(),
    getRequestAuth(),
  ])
  if (!profile || !isSedePrivilegedRole(profile.role)) redirect('/')

  const activeSedeId = await resolveActiveSedeIdForLists(
    supabase,
    { role: profile.role, sede_id: profile.sede_id },
    (n) => cookieStore.get(n),
  )

  return (
    <div className={APP_SHELL_SECTION_PAGE_STACK_CLASS}>
      <AppPageHeaderStrip
        accent="teal"
        icon={<svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2C12 2 14 8 16 10C18 12 22 12 22 12C22 12 18 12 16 14C14 16 12 22 12 22C12 22 10 16 8 14C6 12 2 12 2 12C2 12 6 12 8 10C10 8 12 2 12 2Z" /></svg>}
        leadingAccessory={
          <BackButton href="/strumenti/centro-controllo" className="mb-0 shrink-0" />
        }
      >
        <div className="flex-1">
          <h1 className={APP_PAGE_HEADER_STRIP_H1_CLASS}>
            {t.strumentiCentroControllo.apprendimentoTitle}
          </h1>
          <p className={APP_PAGE_HEADER_STRIP_SUBTITLE_CLASS}>
            {t.strumentiCentroControllo.apprendimentoSubtitle}
          </p>
        </div>
      </AppPageHeaderStrip>
      <ApprendimentoClient sedeId={activeSedeId} />
    </div>
  )
}
