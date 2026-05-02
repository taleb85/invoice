import { redirect } from 'next/navigation'
import { getProfile } from '@/utils/supabase/server'
import { getT } from '@/lib/locale-server'
import { BackButton } from '@/components/BackButton'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { APP_PAGE_HEADER_STRIP_H1_CLASS, APP_SECTION_STICKY_TOP_INNER_X_CLASS, APP_SECTION_STICKY_TOP_STACK_CLASS, APP_SHELL_SECTION_PAGE_STACK_CLASS } from '@/lib/app-shell-layout'
import { ApprovalQueue } from '@/components/approval/approval-queue'

export const dynamic = 'force-dynamic'

export default async function ApprovazioniPage() {
  const [profile, t] = await Promise.all([getProfile(), getT()])
  if (!profile || !['admin', 'admin_sede'].includes(profile.role ?? '')) {
    redirect('/')
  }

  return (
    <div className={APP_SHELL_SECTION_PAGE_STACK_CLASS}>
      <div className={APP_SECTION_STICKY_TOP_STACK_CLASS}>
        <div className={`${APP_SECTION_STICKY_TOP_INNER_X_CLASS} pt-1 pb-0`}>
          <AppPageHeaderStrip
            accent="rose"
            flushBottom
            leadingAccessory={<BackButton href="/" label={t.nav.dashboard} iconOnly className="mb-0 shrink-0" />}
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>}
          >
            <div className="min-w-0">
              <h1 className={APP_PAGE_HEADER_STRIP_H1_CLASS}>{t.nav.approvazioni}</h1>
              <p className="mt-0.5 text-xs text-app-fg-muted">{t.appStrings.approvazioni_pageSub}</p>
            </div>
          </AppPageHeaderStrip>
        </div>
      </div>

      <ApprovalQueue />
    </div>
  )
}
