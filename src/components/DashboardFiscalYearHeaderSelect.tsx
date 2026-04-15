'use client'

import { useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useT } from '@/lib/use-t'
import { defaultFiscalYearLabel, formatFiscalYearShort } from '@/lib/fiscal-year'

const FY_OPTIONS_OLDEST = 2020
const FY_OPTIONS_MAX = 2100

/**
 * Select compatto per la riga `AppPageHeaderStrip` (accanto a rete / notifiche).
 */
export default function DashboardFiscalYearHeaderSelect({
  countryCode,
  selectedFiscalYear,
}: {
  countryCode: string
  selectedFiscalYear: number
}) {
  const t = useT()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const cc = (countryCode || 'IT').trim() || 'IT'

  const options = useMemo(() => {
    const current = defaultFiscalYearLabel(cc, new Date())
    const set = new Set<number>()
    for (let y = current; y >= FY_OPTIONS_OLDEST; y--) set.add(y)
    if (selectedFiscalYear >= FY_OPTIONS_OLDEST && selectedFiscalYear <= FY_OPTIONS_MAX) {
      set.add(selectedFiscalYear)
    }
    return Array.from(set).sort((a, b) => b - a)
  }, [cc, selectedFiscalYear])

  const onFyChange = (y: number) => {
    const next = new URLSearchParams(searchParams.toString())
    next.set('fy', String(y))
    const q = next.toString()
    router.push(q ? `${pathname}?${q}` : pathname)
  }

  return (
    <label className="flex min-w-0 shrink-0 flex-row flex-nowrap items-center gap-1.5 sm:gap-2">
      <span className="whitespace-nowrap text-[8px] font-semibold uppercase leading-tight tracking-wide text-white/95 sm:text-[9px]">
        {t.dashboard.kpiFiscalYearFilter}
      </span>
      <select
        value={selectedFiscalYear}
        onChange={(e) => onFyChange(Number(e.target.value))}
        className="min-h-8 w-auto min-w-0 max-w-[10.5rem] shrink-0 cursor-pointer truncate rounded-md border border-app-line-45 bg-cyan-950/50 px-2 py-1 text-[11px] font-semibold leading-tight text-white shadow-[0_0_20px_-8px_rgba(34,211,238,0.3)] ring-1 ring-app-line-20 transition-colors hover:border-app-a-70 hover:bg-cyan-950/65 focus:border-app-a-55 focus:outline-none focus:ring-2 focus:ring-app-a-30 [color-scheme:dark] sm:min-h-9 sm:max-w-[11rem] sm:rounded-lg sm:py-1.5 sm:text-xs"
        aria-label={t.dashboard.kpiFiscalYearFilterAria}
        title={t.dashboard.kpiFiscalYearFilter}
      >
        {options.map((y) => (
          <option key={y} value={y}>
            {formatFiscalYearShort(cc, y)}
          </option>
        ))}
      </select>
    </label>
  )
}
