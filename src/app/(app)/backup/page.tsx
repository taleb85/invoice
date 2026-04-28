'use client'

import { useMe } from '@/lib/me-context'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { BackupManager } from '@/components/backup/backup-manager'
import { BackButton } from '@/components/BackButton'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { APP_SHELL_SECTION_PAGE_H1_CLASS, APP_SHELL_SECTION_PAGE_STACK_CLASS } from '@/lib/app-shell-layout'
import { useT } from '@/lib/use-t'

export default function BackupPage() {
  const { me, loading } = useMe()
  const router = useRouter()
  const t = useT()

  useEffect(() => {
    if (!loading && me?.role !== 'admin') {
      router.replace('/')
    }
  }, [me, loading, router])

  if (loading || me?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-app-cyan-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className={APP_SHELL_SECTION_PAGE_STACK_CLASS}>
      <AppPageHeaderStrip
        accent="slate"
        leadingAccessory={<BackButton href="/" label={t.nav.dashboard} iconOnly className="mb-0 shrink-0" />}
        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582 4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/></svg>}
      >
        <div className="min-w-0">
          <h1 className={APP_SHELL_SECTION_PAGE_H1_CLASS}>{t.appStrings.backupPageTitle}</h1>
          <p className="mt-0.5 text-xs text-app-fg-muted">{t.appStrings.backupPageDesc}</p>
        </div>
      </AppPageHeaderStrip>
      <BackupManager />
    </div>
  )
}
