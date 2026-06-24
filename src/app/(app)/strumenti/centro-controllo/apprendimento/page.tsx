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
        icon={<svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden><path d="M12 18V5"/><path d="M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4"/><path d="M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5"/><path d="M17.997 5.125a4 4 0 0 1 2.526 5.77"/><path d="M18 18a4 4 0 0 0 2-7.464"/><path d="M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517"/><path d="M6 18a4 4 0 0 1-2-7.464"/><path d="M6.003 5.125a4 4 0 0 0-2.526 5.77"/></svg>}
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
