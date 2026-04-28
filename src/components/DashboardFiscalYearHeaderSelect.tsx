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
    <label className="hidden min-w-0 shrink-0 flex-row flex-nowrap items-center gap-2 sm:gap-3 md:flex">
      <span className="whitespace-nowrap text-[11px] font-semibold uppercase leading-snug tracking-wide text-app-fg-muted md:text-xs lg:text-[13px]">
        {t.dashboard.kpiFiscalYearFilter}
      </span>
      <select
        value={selectedFiscalYear}
        onChange={(e) => onFyChange(Number(e.target.value))}
        className="min-h-10 w-auto min-w-0 max-w-[12rem] shrink-0 cursor-pointer truncate rounded-lg border border-white/15 bg-white/[0.08] px-3 py-2 text-xs font-semibold leading-tight text-app-fg ring-0 transition-colors hover:border-white/25 hover:bg-white/[0.11] focus:border-white/30 focus:outline-none [color-scheme:dark] sm:max-w-[14rem] sm:text-sm md:min-h-11 md:px-3.5"
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
