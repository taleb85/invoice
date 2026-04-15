'use client'

import { useSearchParams } from 'next/navigation'
import { useMe } from '@/lib/me-context'
import { parseFiscalYearQueryParam } from '@/lib/fiscal-year'
import DashboardFiscalYearHeaderSelect from '@/components/DashboardFiscalYearHeaderSelect'

/** Stesso comportamento di `DashboardFiscalYearHeaderForSede`, per layout client (es. `/statements`). */
export default function DashboardFiscalYearHeaderSelectMe() {
  const { me, loading } = useMe()
  const searchParams = useSearchParams()

  if (loading || !me?.sede_id) return null

  const fy = parseFiscalYearQueryParam(searchParams.get('fy') ?? undefined, me.country_code)

  return <DashboardFiscalYearHeaderSelect countryCode={me.country_code} selectedFiscalYear={fy} />
}
