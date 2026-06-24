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
      <AppPageHeaderStrip
        leadingAccessory={<BackButton href="/" className="mb-0 shrink-0" />}
        icon={<svg className="w-5 h-5 shrink-0 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
      >
        <div className="flex-1">
          <h1 className={APP_PAGE_HEADER_STRIP_H1_CLASS}>
            {t.strumentiCentroControllo.pageTitle}
          </h1>
          <p className={APP_PAGE_HEADER_STRIP_SUBTITLE_CLASS}>
            {t.strumentiCentroControllo.pageSubtitle}
          </p>
        </div>
      </AppPageHeaderStrip>

      <CentroControlloClient
        sedeId={sedeId}
      />
    </div>
  )
}
