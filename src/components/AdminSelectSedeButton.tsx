'use client'

import { useRouter } from 'next/navigation'

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
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        document.cookie = `admin-sede-id=${sedeId}; path=/; SameSite=Strict`
        router.push('/')
        router.refresh()
      }}
    >
      {children}
    </button>
  )
}
