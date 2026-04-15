import { Suspense } from 'react'
import { getProfile, getRequestAuth } from '@/utils/supabase/server'
import { getCookieStore } from '@/lib/locale-server'
import { parseFiscalYearQueryParam } from '@/lib/fiscal-year'
import DashboardFiscalYearHeaderSelect from '@/components/DashboardFiscalYearHeaderSelect'

/**
 * Select anno fiscale nella `AppPageHeaderStrip` quando c’è una sede attiva
 * (operatore / admin_sede / admin con sede scelta da cookie).
 */
export default async function DashboardFiscalYearHeaderForSede({
  fyRaw,
}: {
  fyRaw: string | undefined
}) {
  const [{ supabase }, profile, cookieStore] = await Promise.all([
    getRequestAuth(),
    getProfile(),
    getCookieStore(),
  ])

  const isMasterAdmin = profile?.role === 'admin'
  const adminPick = isMasterAdmin ? cookieStore.get('admin-sede-id')?.value?.trim() || null : null
  let sedeId: string | null = null
  if (isMasterAdmin && adminPick) {
    const { data } = await supabase.from('sedi').select('id').eq('id', adminPick).maybeSingle()
    if (data?.id) sedeId = data.id
  }
  if (!sedeId) sedeId = profile?.sede_id ?? null
  if (!sedeId) return null

  const { data } = await supabase.from('sedi').select('country_code').eq('id', sedeId).maybeSingle()
  const countryCode = (data?.country_code ?? 'IT').trim() || 'IT'
  const fiscalYear = parseFiscalYearQueryParam(fyRaw, countryCode)

  return (
    <Suspense fallback={null}>
      <DashboardFiscalYearHeaderSelect countryCode={countryCode} selectedFiscalYear={fiscalYear} />
    </Suspense>
  )
}
