import { redirect } from 'next/navigation'
import { getCookieStore, getProfile, getRequestAuth } from '@/utils/supabase/server'
import { getT } from '@/lib/locale-server'
import { isSedePrivilegedRole } from '@/lib/roles'
import { resolveActiveSedeIdForLists } from '@/lib/resolve-active-sede-for-lists'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { BackButton } from '@/components/BackButton'
import { Brain } from 'lucide-react'
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
        icon={<Brain className="h-5 w-5" strokeWidth={2} aria-hidden />}
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
