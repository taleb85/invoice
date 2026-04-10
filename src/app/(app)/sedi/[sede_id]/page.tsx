import Link from 'next/link'
import { createServiceClient } from '@/utils/supabase/server'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import ScanEmailButton from '@/components/ScanEmailButton'
import CountrySelector from '@/components/CountrySelector'
import { getLocale } from '@/lib/localization'

interface SedeProfile {
  id: string
  nome: string
  imap_user: string | null
  imap_host: string | null
  country_code: string
  fornitori_count: number
  operators_count: number
}

async function fetchSedeProfile(sedeId: string): Promise<SedeProfile | null> {
  const service = createServiceClient()
  const { data: sede } = await service
    .from('sedi')
    .select('id, nome, imap_user, imap_host, country_code')
    .eq('id', sedeId)
    .single()

  if (!sede) return null

  const [{ count: fornitori_count }, { count: operators_count }] = await Promise.all([
    service.from('fornitori').select('*', { count: 'exact', head: true }).eq('sede_id', sedeId),
    service.from('profiles').select('*', { count: 'exact', head: true }).eq('sede_id', sedeId),
  ])

  return {
    id: sede.id,
    nome: sede.nome,
    imap_user: sede.imap_user ?? null,
    imap_host: sede.imap_host ?? null,
    country_code: (sede as { country_code?: string }).country_code ?? 'UK',
    fornitori_count: fornitori_count ?? 0,
    operators_count: operators_count ?? 0,
  }
}

export default async function SedeProfilePage({ params }: { params: Promise<{ sede_id: string }> }) {
  // Auth guard
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { sede_id } = await params
  const sede = await fetchSedeProfile(sede_id)
  if (!sede) redirect('/sedi')

  const imapConfigured = !!(sede.imap_host && sede.imap_user)

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
        <Link href="/sedi" className="hover:text-slate-700 transition-colors">Sedi</Link>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-slate-800 font-medium">{sede.nome}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center shrink-0">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{sede.nome}</h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-sm text-slate-500">{sede.operators_count} operatore{sede.operators_count !== 1 ? 'i' : ''}</span>
              <span className="text-slate-300">·</span>
              <span className="text-sm text-slate-500">{sede.fornitori_count} fornitore{sede.fornitori_count !== 1 ? 'i' : ''}</span>
              <span className="text-slate-300">·</span>
              {imapConfigured ? (
                <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Email configurata ({sede.imap_user})
                </span>
              ) : (
                <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                  Email non configurata
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Scan button — reads sede_id from URL */}
        <ScanEmailButton sedeId={sede_id} alwaysShowLabel />
      </div>

      {/* Paese / Localizzazione */}
      {(() => {
        const loc = getLocale(sede.country_code)
        return (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 bg-white border border-slate-200 rounded-xl px-5 py-4 mb-6">
            <div className="flex items-center gap-2 text-sm text-slate-500 shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21l18-9-18-9v7l12 2-12 2v7z" />
              </svg>
              Paese sede
            </div>
            <CountrySelector sedeId={sede.id} initialCode={sede.country_code} />
            <div className="flex items-center gap-4 ml-auto flex-wrap text-xs text-slate-500">
              <span><span className="font-medium text-slate-700">{loc.vat}</span> · etichetta imposta</span>
              <span><span className="font-medium text-slate-700">{loc.vatLabel}</span> · n. partita {loc.vat}</span>
              <span><span className="font-medium text-slate-700">{loc.currency}</span> · valuta ({loc.flag})</span>
            </div>
          </div>
        )
      })()}

      {/* Quick-action cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Link
          href={`/sedi/${sede_id}/statements`}
          className="group flex flex-col gap-3 p-5 bg-white border border-slate-200 rounded-xl hover:border-accent hover:shadow-sm transition-all"
        >
          <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-sm">Estratti Conto</p>
            <p className="text-xs text-slate-500 mt-0.5">Associa fatture alle bolle</p>
          </div>
          <svg className="w-4 h-4 text-slate-400 group-hover:text-accent mt-auto self-end transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>

        <Link
          href={`/sedi/${sede_id}/discovery`}
          className="group flex flex-col gap-3 p-5 bg-white border border-slate-200 rounded-xl hover:border-accent hover:shadow-sm transition-all"
        >
          <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-sm">Scopri Fornitori</p>
            <p className="text-xs text-slate-500 mt-0.5">Trova mittenti sconosciuti</p>
          </div>
          <svg className="w-4 h-4 text-slate-400 group-hover:text-accent mt-auto self-end transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>

        <Link
          href={`/sedi/${sede_id}/fornitori`}
          className="group flex flex-col gap-3 p-5 bg-white border border-slate-200 rounded-xl hover:border-accent hover:shadow-sm transition-all"
        >
          <div className="w-9 h-9 bg-violet-100 rounded-lg flex items-center justify-center group-hover:bg-violet-200 transition-colors">
            <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-sm">Fornitori</p>
            <p className="text-xs text-slate-500 mt-0.5">{sede.fornitori_count} registrati</p>
          </div>
          <svg className="w-4 h-4 text-slate-400 group-hover:text-accent mt-auto self-end transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* IMAP not configured warning */}
      {!imapConfigured && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-amber-800">Casella email non configurata</p>
            <p className="text-xs text-amber-700 mt-1">
              Per abilitare la scansione email per questa sede, configura le impostazioni IMAP in{' '}
              <Link href="/sedi" className="underline">Gestione Sedi</Link>.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
