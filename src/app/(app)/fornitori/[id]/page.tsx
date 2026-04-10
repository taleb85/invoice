'use client'

import { use, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { StatementsContent } from '@/app/(app)/statements/page'
import { getTranslations } from '@/lib/translations'
import { getLocale } from '@/lib/localization'

type Tab = 'dashboard' | 'bolle' | 'fatture' | 'statements'

interface Fornitore {
  id: string
  nome: string
  email: string | null
  piva: string | null
  sede_id: string | null
  created_at: string
}

interface Bolla {
  id: string
  data: string
  stato: string
  file_url: string | null
  numero?: string | null
}

interface Fattura {
  id: string
  data: string
  file_url: string | null
  bolla_id: string | null
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return dateStr
  }
}

/* ─── Dashboard KPI tab ─────────────────────────────────────────── */
function DashboardTab({ fornitoreId }: { fornitoreId: string }) {
  const [stats, setStats] = useState<{
    bolleTotal: number
    bolleAperte: number
    fattureTotal: number
    pending: number
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('bolle').select('stato', { count: 'exact' }).eq('fornitore_id', fornitoreId),
      supabase.from('bolle').select('id', { count: 'exact', head: true }).eq('fornitore_id', fornitoreId).eq('stato', 'in attesa'),
      supabase.from('fatture').select('id', { count: 'exact', head: true }).eq('fornitore_id', fornitoreId),
      fetch(`/api/documenti-da-processare?fornitore_id=${fornitoreId}&stati=in_attesa,da_associare`)
        .then(r => r.ok ? r.json() : [])
        .then((d: unknown[]) => d.length),
    ]).then(([bolleRes, bolleAperteRes, fattureRes, pendingCount]) => {
      setStats({
        bolleTotal:  bolleRes.count ?? 0,
        bolleAperte: bolleAperteRes.count ?? 0,
        fattureTotal: fattureRes.count ?? 0,
        pending: pendingCount as number,
      })
      setLoading(false)
    })
  }, [fornitoreId])

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse">
            <div className="h-3 bg-gray-100 rounded w-3/4 mb-3" />
            <div className="h-7 bg-gray-100 rounded w-1/2" />
          </div>
        ))}
      </div>
    )
  }

  const kpis = [
    {
      label: 'Bolle totali',
      value: stats?.bolleTotal ?? 0,
      icon: (
        <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
      sub: `${stats?.bolleAperte ?? 0} aperte`,
      subColor: (stats?.bolleAperte ?? 0) > 0 ? 'text-amber-500' : 'text-gray-400',
    },
    {
      label: 'Fatture registrate',
      value: stats?.fattureTotal ?? 0,
      icon: (
        <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      sub: 'confermate',
      subColor: 'text-gray-400',
    },
    {
      label: 'Documenti in attesa',
      value: stats?.pending ?? 0,
      icon: (
        <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      sub: 'da abbinare',
      subColor: (stats?.pending ?? 0) > 0 ? 'text-amber-500' : 'text-gray-400',
    },
    {
      label: 'Riconciliazione',
      value: stats && stats.bolleTotal > 0
        ? `${Math.round(((stats.bolleTotal - (stats.bolleAperte ?? 0)) / stats.bolleTotal) * 100)}%`
        : '—',
      icon: (
        <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      sub: 'bolle chiuse',
      subColor: 'text-gray-400',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{k.label}</p>
              {k.icon}
            </div>
            <p className="text-3xl font-bold text-gray-900">{k.value}</p>
            <p className={`text-xs mt-1 ${k.subColor}`}>{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <p className="text-sm text-gray-500">
          Vai alla tab <strong>Estratto Conto</strong> per abbinare documenti e bolle, o a <strong>Bolle</strong> e <strong>Fatture</strong> per vedere lo storico completo.
        </p>
      </div>
    </div>
  )
}

/* ─── Bolle tab ──────────────────────────────────────────────────── */
function BolleTab({ fornitoreId }: { fornitoreId: string }) {
  const [bolle, setBolle] = useState<Bolla[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('bolle')
      .select('id, data, stato, file_url, numero')
      .eq('fornitore_id', fornitoreId)
      .order('data', { ascending: false })
      .then(({ data }: { data: Bolla[] | null }) => {
        setBolle(data ?? [])
        setLoading(false)
      })
  }, [fornitoreId])

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="px-5 py-4 animate-pulse flex gap-4">
            <div className="h-4 bg-gray-100 rounded w-24" />
            <div className="h-4 bg-gray-100 rounded w-16" />
          </div>
        ))}
      </div>
    )
  }

  if (bolle.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 px-6 py-16 text-center">
        <svg className="w-12 h-12 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p className="text-sm text-gray-400 font-medium">Nessuna bolla registrata</p>
        <Link href={`/bolle/new?fornitore_id=${fornitoreId}`}
          className="mt-3 inline-block text-sm text-accent font-medium hover:underline">
          Crea la prima bolla →
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      {/* Mobile */}
      <div className="md:hidden divide-y divide-gray-50">
        {bolle.map((b) => (
          <div key={b.id} className="px-4 py-4 flex items-center justify-between gap-3 min-h-[56px]">
            <div>
              <p className="text-sm font-medium text-gray-900">{formatDate(b.data)}</p>
              {b.numero && <p className="text-xs text-gray-400 mt-0.5">#{b.numero}</p>}
            </div>
            <div className="flex items-center gap-2">
              {b.stato === 'completato' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-50 text-green-700 border border-green-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Completato
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-600 border border-amber-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> In attesa
                </span>
              )}
              {b.file_url && (
                <a href={b.file_url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:underline px-2 py-1.5 -mr-2 touch-manipulation">
                  Apri
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm min-w-[420px]">
          <thead>
            <tr className="border-b border-gray-50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Data</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Numero</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Stato</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {bolle.map((b) => (
              <tr key={b.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-5 py-3.5 text-gray-700 font-medium">{formatDate(b.data)}</td>
                <td className="px-5 py-3.5 text-gray-500">{b.numero ?? '—'}</td>
                <td className="px-5 py-3.5">
                  {b.stato === 'completato' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-50 text-green-700 border border-green-100">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Completato
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-600 border border-amber-100">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> In attesa
                    </span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-right">
                  {b.file_url && (
                    <a href={b.file_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline font-medium">
                      Vedi documento
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ─── Fatture tab ────────────────────────────────────────────────── */
function FattureTab({ fornitoreId }: { fornitoreId: string }) {
  const [fatture, setFatture] = useState<Fattura[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('fatture')
      .select('id, data, file_url, bolla_id')
      .eq('fornitore_id', fornitoreId)
      .order('data', { ascending: false })
      .then(({ data }: { data: Fattura[] | null }) => {
        setFatture(data ?? [])
        setLoading(false)
      })
  }, [fornitoreId])

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="px-5 py-4 animate-pulse flex gap-4">
            <div className="h-4 bg-gray-100 rounded w-24" />
            <div className="h-4 bg-gray-100 rounded w-16" />
          </div>
        ))}
      </div>
    )
  }

  if (fatture.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 px-6 py-16 text-center">
        <svg className="w-12 h-12 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-sm text-gray-400 font-medium">Nessuna fattura registrata</p>
        <Link href={`/fatture/new?fornitore_id=${fornitoreId}`}
          className="mt-3 inline-block text-sm text-accent font-medium hover:underline">
          Aggiungi fattura →
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      {/* Mobile */}
      <div className="md:hidden divide-y divide-gray-50">
        {fatture.map((f) => (
          <Link key={f.id} href={`/fatture/${f.id}`}
            className="block px-4 py-4 min-h-[56px] hover:bg-gray-50 active:bg-gray-100 transition-colors touch-manipulation">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-gray-900">{formatDate(f.data)}</p>
              <div className="flex items-center gap-2">
                {f.bolla_id ? (
                  <span className="text-[11px] text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                    Associata
                  </span>
                ) : (
                  <span className="text-[11px] text-gray-400 font-medium bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">
                    Senza bolla
                  </span>
                )}
                {f.file_url && (
                  <span className="text-xs text-green-600 font-medium">PDF</span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm min-w-[380px]">
          <thead>
            <tr className="border-b border-gray-50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Data</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Bolla</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {fatture.map((f) => (
              <tr key={f.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-5 py-3.5 text-gray-700 font-medium">{formatDate(f.data)}</td>
                <td className="px-5 py-3.5">
                  {f.bolla_id ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-600 border border-blue-100">
                      Associata
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-50 text-gray-400 border border-gray-100">
                      Senza bolla
                    </span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-3">
                    {f.file_url && (
                      <a href={f.file_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:underline font-medium">
                        PDF
                      </a>
                    )}
                    <Link href={`/fatture/${f.id}`}
                      className="text-xs text-gray-400 hover:text-gray-600 font-medium">
                      Dettaglio →
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ─── Main client component ──────────────────────────────────────── */
function FornitoreDetailClient({
  fornitore,
  bolleCount,
  fattureCount,
  pendingCount,
  countryCode,
}: {
  fornitore: Fornitore
  bolleCount: number
  fattureCount: number
  pendingCount: number
  countryCode: string
}) {
  const [tab, setTab] = useState<Tab>('dashboard')
  const router = useRouter()
  const t = getTranslations('it')
  const loc = getLocale(countryCode)

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'dashboard', label: 'Riepilogo' },
    { id: 'bolle', label: 'Bolle', badge: bolleCount },
    { id: 'fatture', label: 'Fatture', badge: fattureCount },
    { id: 'statements', label: 'Estratto Conto', badge: pendingCount > 0 ? pendingCount : undefined },
  ]

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link href="/fornitori" className="hover:text-gray-600 transition-colors">
          {t.nav.fornitori}
        </Link>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-gray-700 font-medium truncate">{fornitore.nome}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900 truncate">{fornitore.nome}</h1>
            {fornitore.piva && (
              <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md border border-gray-200">
                {loc.vatLabel} {fornitore.piva}
              </span>
            )}
          </div>
          {fornitore.email && (
            <p className="text-sm text-gray-500 mt-1">{fornitore.email}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/bolle/new?fornitore_id=${fornitore.id}`}
            className="flex items-center gap-1.5 px-3 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuova Bolla
          </Link>
          <Link
            href={`/fatture/new?fornitore_id=${fornitore.id}`}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors border border-gray-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuova Fattura
          </Link>
          <Link
            href={`/fornitori/${fornitore.id}/edit`}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Modifica fornitore"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Tab bar — horizontally scrollable on mobile */}
      <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 mb-6" style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-max">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap touch-manipulation ${
                tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700 active:bg-white/60'
              }`}
            >
              {t.label}
              {t.badge !== undefined && t.badge > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                  tab === t.id
                    ? t.id === 'statements' ? 'bg-amber-100 text-amber-700' : 'bg-[#e8edf5] text-accent'
                    : 'bg-gray-200 text-gray-500'
                }`}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {tab === 'dashboard' && <DashboardTab fornitoreId={fornitore.id} />}
      {tab === 'bolle'     && <BolleTab fornitoreId={fornitore.id} />}
      {tab === 'fatture'   && <FattureTab fornitoreId={fornitore.id} />}
      {tab === 'statements' && <StatementsContent fornitoreId={fornitore.id} countryCode={countryCode} />}
    </div>
  )
}

/* ─── Page entry point ───────────────────────────────────────────── */
export default function FornitoreDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()

  const [fornitore, setFornitore] = useState<Fornitore | null>(null)
  const [bolleCount, setBolleCount] = useState(0)
  const [fattureCount, setFattureCount] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)
  const [countryCode, setCountryCode] = useState('UK')
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('fornitori')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) { setNotFound(true); setLoading(false); return }
    setFornitore(data as Fornitore)

    const [bolleRes, fattureRes, pendingRes, sedeRes] = await Promise.all([
      supabase.from('bolle').select('id', { count: 'exact', head: true }).eq('fornitore_id', id),
      supabase.from('fatture').select('id', { count: 'exact', head: true }).eq('fornitore_id', id),
      fetch(`/api/documenti-da-processare?fornitore_id=${id}&stati=in_attesa,da_associare`)
        .then(r => r.ok ? r.json() : []),
      data.sede_id
        ? supabase.from('sedi').select('country_code').eq('id', data.sede_id).single()
        : Promise.resolve({ data: null }),
    ])

    setBolleCount(bolleRes.count ?? 0)
    setFattureCount(fattureRes.count ?? 0)
    setPendingCount(Array.isArray(pendingRes) ? pendingRes.length : 0)
    setCountryCode((sedeRes.data as { country_code?: string } | null)?.country_code ?? 'UK')
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="p-4 md:p-8 max-w-5xl">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-100 rounded w-48" />
          <div className="h-8 bg-gray-100 rounded w-72" />
          <div className="h-10 bg-gray-100 rounded w-64" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-gray-100 rounded-xl" />)}
          </div>
        </div>
      </div>
    )
  }

  if (notFound || !fornitore) {
    return (
      <div className="p-4 md:p-8 max-w-5xl text-center py-20">
        <p className="text-gray-400 font-medium mb-3">Fornitore non trovato.</p>
        <button onClick={() => router.push('/fornitori')}
          className="text-sm text-accent font-medium hover:underline">
          ← Torna ai fornitori
        </button>
      </div>
    )
  }

  return (
    <FornitoreDetailClient
      fornitore={fornitore}
      bolleCount={bolleCount}
      fattureCount={fattureCount}
      pendingCount={pendingCount}
      countryCode={countryCode}
    />
  )
}
