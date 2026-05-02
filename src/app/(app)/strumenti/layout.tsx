'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLocale } from '@/lib/locale-context'

export default function StrumentiLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { t } = useLocale()

  const tabs = [
    {
      href: '/strumenti/centro-operazioni',
      label: t.strumentiCentroOperazioni.pageTitle,
      active: !!pathname?.startsWith('/strumenti/centro-operazioni'),
    },
    {
      href: '/strumenti/sedi',
      label: t.nav.sedi,
      active: pathname === '/strumenti/sedi',
    },
    {
      href: '/strumenti/impostazioni',
      label: t.nav.impostazioni,
      active: pathname === '/strumenti/impostazioni',
    },
  ]

  return (
    <>
      <div className="app-shell-page-padding-x pt-3 md:pt-4">
        <div className="flex gap-1 rounded-lg border border-app-soft-border bg-black/20 p-1">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 rounded-md px-3 py-2 text-center text-xs font-semibold transition-colors ${
                tab.active
                  ? 'bg-white/10 text-app-fg shadow-sm'
                  : 'text-app-fg-muted hover:bg-white/5 hover:text-app-fg'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>
      {children}
    </>
  )
}
