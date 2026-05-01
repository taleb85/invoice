'use client'

import Link from 'next/link'

import DashboardFiscalYearHeaderSelect from '@/components/DashboardFiscalYearHeaderSelect'
import ConnectionStatusDot from '@/components/ConnectionStatusDot'
import { APP_SEGMENT_CHIP_CONTROL_CLASS } from '@/lib/app-shell-layout'
import { useT } from '@/lib/use-t'

type Props = {
  /** Percorso assoluto (es. `/` o `/analytics`) — query `months` + `fy` sono aggiunte qui. */
  basePath: string
  fiscalYear: number
  months: number
  /** Etichetta FY breve — tab “anno intero”. */
  fyLabel: string
  /**
   * Dashboard: anno fiscale + stato rete nella stessa riga dei chip (spostati dallo header).
   */
  dashboardPeriodToolbar?: {
    countryCode: string
  }
}

export function AnalyticsPeriodStrip({ basePath, fiscalYear, months, fyLabel, dashboardPeriodToolbar }: Props) {
  const t = useT()

  const periodLabels: Record<number, string> = {
    3: 'Q1',
    6: 'H1',
    12: fyLabel,
  }

  const href = (value: number) =>
    `${basePath}?${new URLSearchParams({
      months: String(value),
      fy: String(fiscalYear),
    })}`

  return (
    <div className="relative mb-0 overflow-hidden rounded-2xl app-card-unified">
      <div className="flex min-h-10 flex-wrap items-center gap-x-2 gap-y-2 px-4 py-2.5 sm:px-5 sm:py-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-2">
          {[3, 6, 12].map((value) => (
            <Link
              key={value}
              prefetch={false}
              href={href(value)}
              scroll={false}
              className={`${APP_SEGMENT_CHIP_CONTROL_CLASS} ${
                months === value
                  ? 'bg-white/[0.1] text-white ring-1 ring-white/18'
                  : 'text-app-fg-muted hover:bg-white/[0.08] hover:text-white'
              }`}
            >
              {periodLabels[value]}
            </Link>
          ))}
          <span className="ms-1 shrink-0 text-[10px] font-medium uppercase tracking-wider text-app-fg-subtle sm:ms-2">
            {t.appStrings.analyticsSinceFY}
          </span>
        </div>
        {dashboardPeriodToolbar ? (
          <div className="flex w-full min-w-0 shrink-0 flex-wrap items-center justify-end gap-2 sm:ms-auto sm:w-auto md:gap-3">
            <DashboardFiscalYearHeaderSelect
              countryCode={dashboardPeriodToolbar.countryCode}
              selectedFiscalYear={fiscalYear}
              layout="periodToolbar"
            />
            <div className="hidden shrink-0 items-center md:flex">
              <ConnectionStatusDot />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
