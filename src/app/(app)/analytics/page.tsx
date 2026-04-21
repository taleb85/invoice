import { redirect } from 'next/navigation'
import { getProfile } from '@/utils/supabase/server'
import { getCookieStore } from '@/lib/locale-server'
import DashboardFiscalYearHeaderForSede from '@/components/DashboardFiscalYearHeaderForSede'
import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ fy?: string; months?: string }>

export default async function AnalyticsPage({ searchParams }: { searchParams: SearchParams }) {
  const profile = await getProfile()
  if (!profile || !['admin', 'admin_sede'].includes(profile.role ?? '')) {
    redirect('/')
  }

  const sp = await searchParams
  const cookieStore = await getCookieStore()

  const isMasterAdmin = profile.role === 'admin'
  const adminPick = isMasterAdmin
    ? (cookieStore.get('admin-sede-id')?.value?.trim() || null)
    : null
  const sedeId = adminPick ?? (profile.role !== 'admin' ? (profile.sede_id ?? null) : null)

  const months = sp.months ? Math.min(24, Math.max(1, parseInt(sp.months, 10))) : 6

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AppPageHeaderStrip>
        <div className="flex flex-1 items-center justify-between gap-3 min-w-0">
          <div className="min-w-0">
            <h1 className="text-base font-bold text-app-fg truncate sm:text-lg">Analytics</h1>
            <p className="text-xs text-app-fg-muted truncate">
              Panoramica acquisti e riconciliazione
            </p>
          </div>
          <DashboardFiscalYearHeaderForSede fyRaw={sp.fy} />
        </div>
      </AppPageHeaderStrip>

      <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        {/* Period selector */}
        <div className="mb-5 flex items-center gap-2">
          {[
            { label: '3 mesi', value: 3 },
            { label: '6 mesi', value: 6 },
            { label: '12 mesi', value: 12 },
          ].map(({ label, value }) => (
            <a
              key={value}
              href={`/analytics?months=${value}${sp.fy ? `&fy=${sp.fy}` : ''}`}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                months === value
                  ? 'bg-[#22d3ee]/15 text-[#22d3ee]'
                  : 'text-app-fg-muted hover:bg-app-line-10 hover:text-app-fg'
              }`}
            >
              {label}
            </a>
          ))}
        </div>

        <AnalyticsDashboard sedeId={sedeId} months={months} />
      </div>
    </div>
  )
}
