import Link from 'next/link'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { Fornitore } from '@/types'
import FornitoriCardsGrid from '@/components/FornitoriCardsGrid'
import { getT } from '@/lib/locale-server'

async function getFornitori(): Promise<{ fornitori: Fornitore[]; sedeNome: string | null }> {
  const supabase  = await createClient()
  const cookieStore = await cookies()

  // Detect sede attiva: per admin usa admin-sede-id, per operatore usa sede dal profilo
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile }  = user
    ? await supabase.from('profiles').select('role, sede_id').eq('id', user.id).single()
    : { data: null }

  let sedeId: string | null = null
  let sedeNome: string | null = null

  if (profile?.role === 'admin') {
    sedeId = cookieStore.get('admin-sede-id')?.value ?? null
  } else if (profile?.sede_id) {
    sedeId = profile.sede_id
  }

  // Risolvi il nome della sede attiva
  if (sedeId) {
    const { data: sede } = await supabase.from('sedi').select('nome').eq('id', sedeId).single()
    sedeNome = sede?.nome ?? null
  }

  let q = supabase.from('fornitori').select('*').order('nome')
  if (sedeId) q = q.eq('sede_id', sedeId) as typeof q

  const { data } = await q
  return { fornitori: (data as Fornitore[]) ?? [], sedeNome }
}

export default async function FornitoriPage() {
  const [{ fornitori, sedeNome }, t] = await Promise.all([getFornitori(), getT()])

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-3 mb-6 md:flex-row md:items-center md:justify-between md:mb-8">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl font-bold text-slate-100 min-w-0">{t.fornitori.title}</h1>
            {sedeNome ? (
              <span className="shrink-0 inline-flex max-w-[55%] items-center gap-1 rounded-full border border-cyan-500/35 bg-cyan-500/15 px-2 py-0.5 text-[11px] font-medium text-cyan-200 sm:max-w-none">
                <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
                <span className="truncate" title={sedeNome}>{sedeNome}</span>
              </span>
            ) : null}
          </div>
          <p className="text-sm text-slate-400 mt-1">
            {fornitori.length} {t.fornitori.countLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/fornitori/import"
            className="flex items-center gap-1.5 rounded-lg border border-slate-600/80 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-800"
          >
            <svg className="w-3.5 h-3.5 shrink-0 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {t.fornitori.importaDaFattura}
          </Link>
          <Link
            href="/fornitori/new"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t.fornitori.new}
          </Link>
        </div>
      </div>

      {fornitori.length === 0 ? (
        <div className="app-card overflow-hidden">
          <div className="app-card-bar" aria-hidden />
          <div className="px-6 py-16 text-center">
            <svg className="mx-auto mb-4 h-14 w-14 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-sm font-medium text-slate-400">{t.fornitori.noSuppliers}</p>
            <Link href="/fornitori/new" className="mt-4 inline-block text-sm font-medium text-cyan-400 hover:text-cyan-300 hover:underline">
              {t.fornitori.addFirst}
            </Link>
          </div>
        </div>
      ) : (
        <FornitoriCardsGrid fornitori={fornitori} />
      )}
    </div>
  )
}
