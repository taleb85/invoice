'use client'

/** Icone tab mobile profilo fornitore (Riepilogo / Bolle / Fatture). */
export type SupplierProfileMobileTab = 'dashboard' | 'bolle' | 'fatture'

export function SupplierProfileTabIcon({
  id,
  className = 'h-5 w-5',
}: {
  id: SupplierProfileMobileTab
  className?: string
}) {
  const p = { className, fill: 'none' as const, stroke: 'currentColor', viewBox: '0 0 24 24' }
  switch (id) {
    case 'dashboard':
      return (
        <svg {...p}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      )
    case 'bolle':
      return (
        <svg {...p}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      )
    case 'fatture':
      return (
        <svg {...p}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      )
    default:
      return <svg {...p}><circle cx="12" cy="12" r="10" strokeWidth={2} /></svg>
  }
}
