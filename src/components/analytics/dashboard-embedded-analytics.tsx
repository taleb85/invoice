'use client'

import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard'
import { AnalyticsPeriodStrip } from '@/components/analytics/analytics-period-strip'

type Props = {
  sedeId: string
  fiscalYear: number
  months: number
  fyLabel: string
}

/**
 * Blocco Analitiche nella dashboard `/?fy=…&months=…` (riuso grafici + KPI come `/analytics`).
 */
export function DashboardEmbeddedAnalytics({ sedeId, fiscalYear, months, fyLabel }: Props) {
  return (
    <div className="flex min-h-0 w-full min-w-0 flex-col gap-4">
      <AnalyticsPeriodStrip basePath="/" fiscalYear={fiscalYear} months={months} fyLabel={fyLabel} />
      <AnalyticsDashboard sedeId={sedeId} fiscalYear={fiscalYear} months={months} />
    </div>
  )
}
