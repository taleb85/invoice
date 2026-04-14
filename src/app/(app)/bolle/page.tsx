import Link from 'next/link'
import { cookies } from 'next/headers'
import { getRequestAuth } from '@/utils/supabase/server'
import DeleteButton from '@/components/DeleteButton'
import { getT, getLocale, getTimezone, formatDate as fmtDate } from '@/lib/locale-server'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import AppSummaryHighlightCard from '@/components/AppSummaryHighlightCard'
import { SUMMARY_HIGHLIGHT_ACCENTS } from '@/lib/summary-highlight-accent'
import { OpenDocumentInAppButton } from '@/components/OpenDocumentInAppButton'
import { fornitoreDisplayLabel } from '@/lib/fornitore-display'

const BOLLE_LIST_LIMIT = 500

type BollaListRow = {
  id: string
  data: string
  stato: string
  file_url: string | null
  fornitore_id: string
  fornitori?: { nome: string; display_name?: string | null } | null
}

/** YYYY-MM-DD for the user's calendar day in IANA timezone (matches Impostazioni fuso). */
function calendarDateInTimeZone(timeZone: string): string {
  try {
    return new Date().toLocaleDateString('en-CA', { timeZone })
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

async function getListSedeId(): Promise<string | null> {
  const { supabase, user } = await getRequestAuth()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role, sede_id').eq('id', user.id).single()
  const cookieStore = await cookies()
  if (profile?.role === 'admin') {
    return cookieStore.get('admin-sede-id')?.value?.trim() || null
  }
  return profile?.sede_id ?? null
}

async function getBolleForToday(timeZone: string, sedeId: string | null) {
  const today = calendarDateInTimeZone(timeZone)
  const { supabase } = await getRequestAuth()
  let q = supabase
    .from('bolle')
    .select('*, fornitori(nome, display_name)')
    .eq('data', today)
    .order('id', { ascending: false })
  if (sedeId) q = q.eq('sede_id', sedeId) as typeof q
  const { data, error } = await q

  if (error) console.error('Errore caricamento bolle:', error.message)
  return data ?? []
}

async function getBolleAll(sedeId: string | null, pendingOnly: boolean) {
  const { supabase } = await getRequestAuth()
  let q = supabase
    .from('bolle')
    .select('*, fornitori(nome, display_name)')
    .order('data', { ascending: false })
    .order('id', { ascending: false })
    .limit(BOLLE_LIST_LIMIT)
  if (sedeId) q = q.eq('sede_id', sedeId) as typeof q
  if (pendingOnly) q = q.eq('stato', 'in attesa') as typeof q
  const { data, error } = await q

  if (error) console.error('Errore caricamento bolle:', error.message)
  return data ?? []
}

export default async function BollePage({
  searchParams,
}: {
  searchParams?: Promise<{ tutte?: string; pending?: string }>
}) {
  const sp = searchParams ? await searchParams : {}
  const showAll = sp.tutte === '1' || sp.tutte === 'true'
  const pendingOnly = sp.pending === '1' || sp.pending === 'true'

  const [tz, t, locale, sedeId] = await Promise.all([getTimezone(), getT(), getLocale(), getListSedeId()])
  const bolle = showAll ? await getBolleAll(sedeId, pendingOnly) : await getBolleForToday(tz, sedeId)
  const formatDate = (d: string) => fmtDate(d, locale, tz)

  const subtitle = (() => {
    if (!showAll) {
      return `${bolle.length} ${bolle.length === 1 ? t.bolle.countTodaySingolo : t.bolle.countTodayPlural}`
    }
    if (pendingOnly) {
      return `${bolle.length} · ${t.dashboard.pendingBills}`
    }
    return `${bolle.length} ${bolle.length === 1 ? t.bolle.countSingolo : t.bolle.countPlural}`
  })()

  const emptyMessage = (() => {
    if (!showAll) return t.bolle.noBillsToday
    if (pendingOnly) return t.dashboard.kpiNoPendingBills
    return t.bolle.noBills
  })()

  const bolleListTheme = SUMMARY_HIGHLIGHT_ACCENTS.indigo

  return (
    <div className="p-4 md:p-8">
      <AppPageHeaderStrip accent="indigo">
        <div className="min-w-0 sm:flex-1 sm:flex-initial">
          <h1 className="app-page-title text-2xl font-bold">{t.bolle.title}</h1>
        </div>
        <div className="flex min-w-0 w-full max-w-full flex-row flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end sm:gap-3 sm:shrink-0">
          <Link
            href="/bolle/new"
            className="flex shrink-0 items-center gap-2 self-start rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-cyan-600 sm:self-center"
          >
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">{t.bolle.new}</span>
          </Link>
        </div>
      </AppPageHeaderStrip>

      <AppSummaryHighlightCard
        accent="indigo"
        label={t.common.total}
        primary={bolle.length}
        secondary={subtitle}
        trailing={
          !showAll ? (
            <>
              <Link href="/bolle?tutte=1" className="text-indigo-400 transition-colors hover:text-indigo-300">
                {t.bolle.listShowAll}
              </Link>
              <span className="text-slate-600" aria-hidden>
                ·
              </span>
              <Link href="/bolle?tutte=1&pending=1" className="text-indigo-400 transition-colors hover:text-indigo-300">
                {t.bolle.listAllPending}
              </Link>
            </>
          ) : pendingOnly ? (
            <>
              <Link href="/bolle" className="text-indigo-400 transition-colors hover:text-indigo-300">
                {t.bolle.listShowToday}
              </Link>
              <span className="text-slate-600" aria-hidden>
                ·
              </span>
              <Link href="/bolle?tutte=1" className="text-indigo-400 transition-colors hover:text-indigo-300">
                {t.bolle.listShowAll}
              </Link>
            </>
          ) : (
            <>
              <Link href="/bolle" className="text-indigo-400 transition-colors hover:text-indigo-300">
                {t.bolle.listShowToday}
              </Link>
              <span className="text-slate-600" aria-hidden>
                ·
              </span>
              <Link href="/bolle?tutte=1&pending=1" className="text-indigo-400 transition-colors hover:text-indigo-300">
                {t.bolle.listAllPending}
              </Link>
            </>
          )
        }
      />

      <div className={`app-card overflow-hidden ${bolleListTheme.border}`}>
        <div className={`app-card-bar ${bolleListTheme.bar}`} aria-hidden />
        <div>
          {bolle.length === 0 ? (
            <div className="px-6 py-20 text-center">
              <svg className="mx-auto mb-4 h-14 w-14 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <p className="text-sm font-medium text-slate-200">{emptyMessage}</p>
              {!showAll ? (
                <Link href="/bolle?tutte=1" className="mt-4 inline-block text-sm font-semibold text-indigo-400 hover:text-indigo-300">
                  {t.bolle.listShowAll} →
                </Link>
              ) : null}
            </div>
          ) : (
            <>
              <div className="divide-y divide-slate-800/80 md:hidden">
                {bolle.map((b: BollaListRow) => {
                  const supplierLabel = b.fornitori ? fornitoreDisplayLabel(b.fornitori) : ''
                  return (
                  <div key={b.id} className="px-4 py-4">
                    <Link href={`/bolle/${b.id}`} className="mb-3 block text-left transition-colors hover:opacity-90">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-100">
                            {supplierLabel || <span className="text-slate-600">—</span>}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-200">{formatDate(b.data)}</p>
                        </div>
                        {b.stato === 'completato' ? (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-green-500/30 bg-green-500/15 px-2 py-0.5 text-[11px] font-semibold text-green-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                            {t.status.completato}
                          </span>
                        ) : (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                            {t.status.inAttesa}
                          </span>
                        )}
                      </div>
                    </Link>
                    <div className="flex flex-wrap items-center gap-2">
                      {b.file_url && (
                        <OpenDocumentInAppButton bollaId={b.id} fileUrl={b.file_url}>
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          {t.bolle.viewDocument}
                        </OpenDocumentInAppButton>
                      )}
                      {b.stato === 'in attesa' && (
                        <Link
                          href={`/fatture/new?bolla_id=${b.id}&fornitore_id=${b.fornitore_id}`}
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                          </svg>
                          {t.bolle.uploadInvoice}
                        </Link>
                      )}
                      <DeleteButton id={b.id} table="bolle" confirmMessage={t.bolle.deleteConfirm} />
                    </div>
                  </div>
                  )
                })}
              </div>

              <table className="hidden w-full text-sm md:table">
                <thead>
                  <tr className="border-b border-slate-700/60 bg-slate-700/40">
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-200">
                      {t.common.date}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-200">
                      {t.common.supplier}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-200">
                      {t.common.status}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-200">
                      {t.common.actions}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {bolle.map((b: BollaListRow) => {
                    const supplierLabel = b.fornitori ? fornitoreDisplayLabel(b.fornitori) : ''
                    return (
                    <tr key={b.id} className="group transition-colors hover:bg-slate-700/40">
                      <td className="whitespace-nowrap px-6 py-4 font-medium text-slate-200">
                        <Link href={`/bolle/${b.id}`} className="transition-colors hover:text-indigo-300">
                          {formatDate(b.data)}
                        </Link>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-100">
                        <Link href={`/bolle/${b.id}`} className="transition-colors hover:text-indigo-300">
                          {supplierLabel || <span className="text-slate-600">—</span>}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        {b.stato === 'completato' ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-green-500/30 bg-green-500/15 px-2.5 py-1 text-xs font-semibold text-green-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                            {t.status.completato}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                            {t.status.inAttesa}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {b.file_url && (
                            <OpenDocumentInAppButton bollaId={b.id} fileUrl={b.file_url}>
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              {t.bolle.viewDocument}
                            </OpenDocumentInAppButton>
                          )}
                          {b.stato === 'in attesa' && (
                            <Link
                              href={`/fatture/new?bolla_id=${b.id}&fornitore_id=${b.fornitore_id}`}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                              </svg>
                              {t.bolle.uploadInvoice}
                            </Link>
                          )}
                          <DeleteButton id={b.id} table="bolle" confirmMessage={t.bolle.deleteConfirm} />
                        </div>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
