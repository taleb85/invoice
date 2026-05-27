import { redirect } from 'next/navigation'
import { getProfile } from '@/utils/supabase/server'
import { getT } from '@/lib/locale-server'
import { isSedePrivilegedRole } from '@/lib/roles'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { BackButton } from '@/components/BackButton'
import {
  APP_PAGE_HEADER_STRIP_H1_CLASS,
  APP_PAGE_HEADER_STRIP_SUBTITLE_CLASS,
  APP_SHELL_SECTION_PAGE_STACK_CLASS,
} from '@/lib/app-shell-layout'
import ApprendimentoClient from './apprendimento-client'

export default async function ApprendimentoPage() {
  const [profile, t] = await Promise.all([getProfile(), getT()])
  if (!profile || !isSedePrivilegedRole(profile.role)) redirect('/')

  const activeSedeId = profile.role === 'admin' ? null : profile.sede_id

  return (
    <div className={APP_SHELL_SECTION_PAGE_STACK_CLASS}>
      <AppPageHeaderStrip
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
