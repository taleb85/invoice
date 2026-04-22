'use client'

import { useMe } from '@/lib/me-context'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { BackupManager } from '@/components/backup/backup-manager'

export default function BackupPage() {
  const { me, loading } = useMe()
  const router = useRouter()

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
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-bold text-app-fg">Backup Dati</h1>
        <p className="mt-1 text-sm text-app-fg-muted">
          Esportazioni CSV automatiche settimanali · Ogni lunedì alle 02:00 UTC
        </p>
      </div>
      <BackupManager />
    </div>
  )
}
