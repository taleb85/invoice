'use client'

import { useRouter } from 'next/navigation'
import { useActiveOperator } from '@/lib/active-operator-context'
import { useT } from '@/lib/use-t'

/** Admin con cookie admin-sede-id: banner per uscire dalla vista operativa sede. */
export default function AdminSedeViewBanner({ sedeNome }: { sedeNome: string }) {
  const router = useRouter()
  const { clearActiveOperator } = useActiveOperator()
  const t = useT()
  return (
    <div className="mb-4 flex flex-col gap-2 rounded-lg border border-app-line-28 bg-slate-900/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-app-fg-muted">
        <span className="font-semibold">{t.dashboard.viewingAsSedeBanner}</span>{' '}
        <span className="text-app-fg-muted">{sedeNome}</span>
      </p>
      <button
        type="button"
        onClick={() => {
          clearActiveOperator()
          document.cookie = 'admin-sede-id=; path=/; Max-Age=0; SameSite=Strict'
          document.cookie = 'fluxo-acting-role=; path=/; Max-Age=0; SameSite=Strict'
          router.refresh()
        }}
        className="shrink-0 rounded-lg border border-app-line-28 app-workspace-surface-elevated px-3 py-2 text-xs font-semibold text-app-fg-muted transition-colors hover:bg-app-line-12"
      >
        {t.dashboard.exitSedeView}
      </button>
    </div>
  )
}
