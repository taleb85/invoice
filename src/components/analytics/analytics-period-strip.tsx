'use client'

import Link from 'next/link'

import { APP_SEGMENT_CHIP_CONTROL_CLASS } from '@/lib/app-shell-layout'
import { useT } from '@/lib/use-t'

type Props = {
  /** Percorso assoluto (es. `/` o `/analytics`) — query `months` + `fy` sono aggiunte qui. */
  basePath: string
  fiscalYear: number
  months: number
  /** Etichetta FY breve — tab “anno intero”. */
  fyLabel: string
}

export function AnalyticsPeriodStrip({ basePath, fiscalYear, months, fyLabel }: Props) {
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
        {[3, 6, 12].map((value) => (
          <Link
            key={value}
            prefetch={false}
            href={href(value)}
            scroll={false}
            className={`${APP_SEGMENT_CHIP_CONTROL_CLASS} ${
              months === value
                ? 'bg-white/[0.1] text-white ring-1 ring-white/18'
                : 'text-white/65 hover:bg-white/[0.08] hover:text-white'
            }`}
          >
            {periodLabels[value]}
          </Link>
        ))}
        <span className="ms-1 shrink-0 text-[10px] font-medium uppercase tracking-wider text-white/45 sm:ms-2">
          {t.appStrings.analyticsSinceFY}
        </span>
      </div>
    </div>
  )
}
