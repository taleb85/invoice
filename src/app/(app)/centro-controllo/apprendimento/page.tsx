import { redirect } from 'next/navigation'
import { getProfile } from '@/utils/supabase/server'
import { isSedePrivilegedRole } from '@/lib/roles'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { BackButton } from '@/components/BackButton'
import { APP_PAGE_HEADER_STRIP_H1_CLASS, APP_PAGE_HEADER_STRIP_SUBTITLE_CLASS } from '@/lib/app-shell-layout'
import ApprendimentoClient from './apprendimento-client'

export default async function ApprendimentoPage() {
  const profile = await getProfile()
  if (!profile || !isSedePrivilegedRole(profile.role)) redirect('/')

  const activeSedeId = (
    profile.role === 'admin'
      ? null
      : profile.sede_id
  )

  return (
    <>
      <AppPageHeaderStrip>
        <BackButton href="/centro-controllo" />
        <div className="flex-1">
          <h1 className={APP_PAGE_HEADER_STRIP_H1_CLASS}>
            Apprendimento AI
          </h1>
          <p className={APP_PAGE_HEADER_STRIP_SUBTITLE_CLASS}>
            Statistiche e pattern appresi dal sistema di suggerimenti automatici
          </p>
        </div>
      </AppPageHeaderStrip>
      <ApprendimentoClient sedeId={activeSedeId} />
    </>
  )
}
