import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { getProfile } from '@/utils/supabase/server'
import SollecitiButton from '@/components/SollecitiButton'
import ScanEmailButton from '@/components/ScanEmailButton'
import { getT, getLocale, getTimezone, formatDate as fmtDate } from '@/lib/locale'
import type { Sede } from '@/types'

async function getStats() {
  const supabase = await createClient()

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: totFornitori },
    { count: totBolle },
    { count: bolleInAttesa },
    { count: fattureFirmate },
    { count: documentiInCoda },
    { count: erroriRecenti },
  ] = await Promise.all([
    supabase.from('fornitori').select('*', { count: 'exact', head: true }),
    supabase.from('bolle').select('*', { count: 'exact', head: true }),
    supabase.from('bolle').select('*', { count: 'exact', head: true }).eq('stato', 'in attesa'),
    supabase.from('fatture').select('*', { count: 'exact', head: true }),
    // Documents received via email not yet matched to a GRN count as invoices
    supabase
      .from('documenti_da_processare')
      .select('*', { count: 'exact', head: true })
      .in('stato', ['in_attesa', 'da_associare']),
    supabase
      .from('log_sincronizzazione')
      .select('*', { count: 'exact', head: true })
      .in('stato', ['fornitore_non_trovato', 'bolla_non_trovata'])
      .gte('data', since24h),
  ])

  return {
    totFornitori:  totFornitori ?? 0,
    totBolle:      totBolle ?? 0,
    bolleInAttesa: bolleInAttesa ?? 0,
    totFatture:    (fattureFirmate ?? 0) + (documentiInCoda ?? 0),
    erroriRecenti: erroriRecenti ?? 0,
  }
}

async function getStatsBySede() {
  const supabase = await createClient()
  const { data: sedi } = await supabase.from('sedi').select('*').order('nome')

  const sediWithStats = await Promise.all(
    (sedi ?? []).map(async (sede: Sede) => {
      const [{ count: fornitori }, { count: bolleInAttesa }, { count: fattureFirmate }, { count: documentiInCoda }] = await Promise.all([
        supabase.from('fornitori').select('*', { count: 'exact', head: true }).eq('sede_id', sede.id),
        supabase.from('bolle').select('*', { count: 'exact', head: true }).eq('sede_id', sede.id).eq('stato', 'in attesa'),
        supabase.from('fatture').select('*', { count: 'exact', head: true }).eq('sede_id', sede.id),
        // Pending email documents count as received invoices for this sede
        supabase
          .from('documenti_da_processare')
          .select('*', { count: 'exact', head: true })
          .eq('sede_id', sede.id)
          .in('stato', ['in_attesa', 'da_associare']),
      ])
      return {
        ...sede,
        fornitori:     fornitori ?? 0,
        bolleInAttesa: bolleInAttesa ?? 0,
        fatture:       (fattureFirmate ?? 0) + (documentiInCoda ?? 0),
      }
    })
  )
  return sediWithStats
}

async function getRecentBolle() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('bolle')
    .select('*, fornitore:fornitori(nome)')
    .order('created_at', { ascending: false })
    .limit(5)
  return data ?? []
}

export default async function DashboardPage() {
  const [t, locale, tz, profile] = await Promise.all([
    getT(), getLocale(), getTimezone(), getProfile(),
  ])
  const isAdmin = profile?.role === 'admin'

  // ── Admin dashboard ──────────────────────────────────────────────────────
  if (isAdmin) {
    const [sediStats, erroriRecenti] = await Promise.all([
      getStatsBySede(),
      createClient().then((sb) =>
        sb.from('log_sincronizzazione')
          .select('*', { count: 'exact', head: true })
          .in('stato', ['fornitore_non_trovato', 'bolla_non_trovata'])
          .gte('data', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .then(({ count }) => count ?? 0)
      ),
    ])
    // Totale bolle in attesa su tutte le sedi
    const totaleBolleInAttesa = sediStats.reduce((sum, s) => sum + (s.bolleInAttesa ?? 0), 0)

    return (
      <div className="p-4 md:p-8 max-w-5xl">
        <div className="mb-8">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900">{t.dashboard.title}</h1>
              <p className="text-sm text-gray-500 mt-1 hidden md:block">{t.sedi.subtitle}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
              <SollecitiButton bolleInAttesa={totaleBolleInAttesa} />
              <ScanEmailButton alwaysShowLabel />
              <Link
                href="/log"
                className={`inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  erroriRecenti > 0
                    ? 'bg-red-50 text-red-700 hover:bg-red-100 ring-1 ring-red-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {erroriRecenti > 0 && (
                  <span className="w-4 h-4 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                    {erroriRecenti > 9 ? '9+' : erroriRecenti}
                  </span>
                )}
                <span className="hidden md:inline">{t.dashboard.viewLog}</span>
                <svg className="w-4 h-4 md:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </Link>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">{t.dashboard.sedeOverview}</h2>
          <Link href="/sedi" className="text-sm text-accent font-medium hover:underline">
            {t.dashboard.manageSedi}
          </Link>
        </div>

        {sediStats.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 px-6 py-16 text-center">
            <svg className="w-12 h-12 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <p className="text-gray-400 text-sm">{t.sedi.noSedi}</p>
            <Link href="/sedi" className="mt-3 inline-block text-sm text-accent font-medium hover:underline">
              {t.dashboard.manageSedi}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sediStats.map((sede) => (
              <div key={sede.id} className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <span className="font-semibold text-gray-800">{sede.nome}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-violet-50 rounded-lg py-2.5">
                    <p className="text-xl font-bold text-violet-700">{sede.fornitori}</p>
                    <p className="text-[10px] text-violet-500 font-medium uppercase tracking-wide mt-0.5">{t.dashboard.suppliers}</p>
                  </div>
                  <div className="bg-amber-50 rounded-lg py-2.5">
                    <p className="text-xl font-bold text-amber-700">{sede.bolleInAttesa}</p>
                    <p className="text-[10px] text-amber-500 font-medium uppercase tracking-wide mt-0.5">{t.dashboard.pendingBills}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg py-2.5">
                    <p className="text-xl font-bold text-green-700">{sede.fatture}</p>
                    <p className="text-[10px] text-green-500 font-medium uppercase tracking-wide mt-0.5">{t.dashboard.invoices}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Operatore dashboard ──────────────────────────────────────────────────
  const [stats, bolle] = await Promise.all([getStats(), getRecentBolle()])
  const formatDate = (d: string) => fmtDate(d, locale, tz)

  const cards = [
    {
      label: t.dashboard.suppliers,
      value: stats.totFornitori,
      href: '/fornitori',
      bg: 'bg-violet-50',
      icon: (
        <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      label: t.dashboard.totalBills,
      value: stats.totBolle,
      href: '/bolle',
      bg: 'bg-blue-50',
      icon: (
        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
    },
    {
      label: t.dashboard.pendingBills,
      value: stats.bolleInAttesa,
      href: '/bolle',
      bg: 'bg-amber-50',
      icon: (
        <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: t.dashboard.invoices,
      value: stats.totFatture,
      href: '/fatture',
      bg: 'bg-green-50',
      icon: (
        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
  ]

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6 md:mb-8 gap-3">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">{t.dashboard.title}</h1>
          <p className="text-sm text-gray-500 mt-0.5 hidden md:block">{t.dashboard.subtitle}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ScanEmailButton alwaysShowLabel />
          <Link
            href="/log"
            className={`inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
              stats.erroriRecenti > 0
                ? 'bg-red-50 text-red-700 hover:bg-red-100 ring-1 ring-red-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {stats.erroriRecenti > 0 && (
              <span className="w-4 h-4 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                {stats.erroriRecenti > 9 ? '9+' : stats.erroriRecenti}
              </span>
            )}
            <span className="hidden md:inline">{t.dashboard.viewLog}</span>
            <svg className="w-4 h-4 md:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </Link>
          <SollecitiButton bolleInAttesa={stats.bolleInAttesa} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="bg-white rounded-xl border border-gray-100 p-5 flex items-center gap-4 hover:shadow-sm transition-shadow"
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${c.bg}`}>
              {c.icon}
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">{c.label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5">{c.value}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{t.dashboard.recentBills}</h2>
          <div className="flex items-center gap-3">
            <Link
              href="/bolle/new"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t.bolle.new}
            </Link>
            <Link href="/bolle" className="text-sm text-accent font-medium hover:underline">
              {t.dashboard.viewAll} →
            </Link>
          </div>
        </div>

        {bolle.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <svg className="w-12 h-12 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-gray-400 text-sm">{t.bolle.noBills}</p>
            <Link href="/bolle/new" className="mt-3 inline-block text-sm text-accent font-medium hover:underline">
              {t.bolle.addFirst}
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {bolle.map((b: any) => (
              <Link
                key={b.id}
                href={`/bolle/${b.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="font-medium text-gray-900 text-sm">{b.fornitore?.nome ?? '—'}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{formatDate(b.data)}</p>
                </div>
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    b.stato === 'completato'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {b.stato === 'completato' ? t.status.completato : t.status.inAttesa}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
