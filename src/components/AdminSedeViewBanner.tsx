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
    <div className="mb-4 flex flex-col gap-2 rounded-xl border border-cyan-500/35 bg-cyan-950/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-cyan-100">
        <span className="font-semibold">{t.dashboard.viewingAsSedeBanner}</span>{' '}
        <span className="text-cyan-200/90">{sedeNome}</span>
      </p>
      <button
        type="button"
        onClick={() => {
          clearActiveOperator()
          document.cookie = 'admin-sede-id=; path=/; Max-Age=0; SameSite=Strict'
          document.cookie = 'fluxo-acting-role=; path=/; Max-Age=0; SameSite=Strict'
          router.refresh()
        }}
        className="shrink-0 rounded-lg border border-slate-600 bg-slate-700/90 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700"
      >
        {t.dashboard.exitSedeView}
      </button>
    </div>
  )
}
