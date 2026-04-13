'use client'

import { useRouter } from 'next/navigation'
import { useActiveOperator } from '@/lib/active-operator-context'

/** Imposta il cookie admin-sede-id e ricarica la dashboard (vista operativa filiale). */
export function AdminSelectSedeButton({
  sedeId,
  className,
  children,
}: {
  sedeId: string
  className?: string
  children: React.ReactNode
}) {
  const router = useRouter()
  const { clearActiveOperator } = useActiveOperator()
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        clearActiveOperator()
        document.cookie = 'fluxo-acting-role=; path=/; Max-Age=0; SameSite=Strict'
        document.cookie = `admin-sede-id=${sedeId}; path=/; SameSite=Strict`
        router.push('/')
        router.refresh()
      }}
    >
      {children}
    </button>
  )
}
