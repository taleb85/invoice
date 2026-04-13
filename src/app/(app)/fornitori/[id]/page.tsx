'use client'

import { useCallback, useEffect, useMemo, useState, Suspense, type ReactNode } from 'react'
import Link from 'next/link'
import { openDocumentUrl } from '@/lib/open-document-url'
import { useParams, usePathname, useRouter, useSearchParams, type ReadonlyURLSearchParams } from 'next/navigation'
import DashboardKpiListSheet, { type DashboardKpiListItem } from '@/components/DashboardKpiListSheet'
import { createClient } from '@/utils/supabase/client'
import { PendingMatchesTab, VerificationStatusTab } from '@/app/(app)/statements/page'
import { useT } from '@/lib/use-t'
import { getLocale } from '@/lib/localization'
import { useLocale } from '@/lib/locale-context'
import { formatDate as formatDateLib } from '@/lib/locale'
import { segmentParam } from '@/lib/segment-param'
import { useEmailSyncProgress } from '@/components/EmailSyncProgressProvider'
import { useMe } from '@/lib/me-context'
import RekkiSupplierIntegration from '@/components/RekkiSupplierIntegration'

type Tab = 'dashboard' | 'bolle' | 'fatture' | 'listino' | 'documenti' | 'verifica'

function fornitorePageTabHref(pathname: string, sp: ReadonlyURLSearchParams, tab: Tab): string {
  const q = new URLSearchParams(sp.toString())
  if (tab === 'dashboard') q.delete('tab')
  else q.set('tab', tab)
  const qs = q.toString()
  return qs ? `${pathname}?${qs}` : pathname
}

interface Fornitore {
  id: string
  nome: string
  email: string | null
  piva: string | null
  sede_id: string | null
  created_at: string
  telefono?: string | null
  indirizzo?: string | null
  citta?: string | null
  paese?: string | null
  note?: string | null
  contatto_nome?: string | null
  rekki_supplier_id?: string | null
  rekki_link?: string | null
}

interface Bolla {
  id: string
  data: string
  stato: string
  file_url: string | null
  numero_bolla: string | null
  importo: number | null
}

interface Fattura {
  id: string
  data: string
  file_url: string | null
  bolla_id: string | null
  numero_fattura: string | null
  importo: number | null
}

interface ListinoRow {
  data: string
  tipo: 'bolla' | 'fattura'
  numero: string | null
  importo: number | null
  id: string
}

/* ─── Dashboard KPI tab ─────────────────────────────────────────── */
type ContattoRow = { id: string; nome: string; ruolo: string | null; email: string | null; telefono: string | null }

const AVATAR_COLORS = [
  'bg-cyan-500', 'bg-blue-500', 'bg-violet-500', 'bg-emerald-500',
  'bg-rose-500', 'bg-amber-500', 'bg-indigo-500', 'bg-teal-500',
]

function getAvatarColor(nome: string) {
  let hash = 0
  for (const c of nome) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function getInitials(nome: string) {
  return nome.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function useAppFormatDate() {
  const { locale, timezone } = useLocale()
  return useCallback(
    (dateStr: string) => formatDateLib(dateStr, locale, timezone, { day: '2-digit', month: 'short', year: 'numeric' }),
    [locale, timezone]
  )
}

/** KPI per il periodo (mese) selezionato — condiviso tra header desktop e tab Riepilogo. */
type SupplierPeriodStats = {
  bolleTotal: number
  bolleAperte: number
  fattureTotal: number
  pending: number
  totaleSpesa: number
  listinoRows: number
  statementsInPeriod: number
  statementsWithIssues: number
}

function useSupplierPeriodStats(fornitoreId: string, year: number, month: number) {
  const [stats, setStats] = useState<SupplierPeriodStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const from = `${year}-${String(month).padStart(2, '0')}-01`
    const to = new Date(year, month, 1).toISOString().split('T')[0]
    const supabase = createClient()
    Promise.all([
      supabase.from('bolle').select('stato', { count: 'exact' }).eq('fornitore_id', fornitoreId).gte('data', from).lt('data', to),
      supabase.from('bolle').select('id', { count: 'exact', head: true }).eq('fornitore_id', fornitoreId).eq('stato', 'in attesa').gte('data', from).lt('data', to),
      supabase.from('fatture').select('id, importo', { count: 'exact' }).eq('fornitore_id', fornitoreId).gte('data', from).lt('data', to),
      fetch(`/api/documenti-da-processare?fornitore_id=${fornitoreId}&stati=in_attesa,da_associare&from=${from}&to=${to}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((d: unknown[]) => d.length),
      supabase
        .from('listino_prezzi')
        .select('id', { count: 'exact', head: true })
        .eq('fornitore_id', fornitoreId)
        .gte('data_prezzo', from)
        .lt('data_prezzo', to),
      supabase
        .from('statements')
        .select('missing_rows')
        .eq('fornitore_id', fornitoreId)
        .gte('received_at', from)
        .lt('received_at', to),
    ]).then(([bolleRes, bolleAperteRes, fattureRes, pendingCount, listinoRes, stmtsRes]) => {
      const totaleSpesa = ((fattureRes.data ?? []) as { importo: number | null }[]).reduce((s, f) => s + (f.importo ?? 0), 0)
      const listinoRows = listinoRes.error ? 0 : (listinoRes.count ?? 0)
      const stmtData = stmtsRes.error ? [] : ((stmtsRes.data ?? []) as { missing_rows: number | null }[])
      const statementsInPeriod = stmtData.length
      const statementsWithIssues = stmtData.filter((s) => (s.missing_rows ?? 0) > 0).length
      setStats({
        bolleTotal: bolleRes.count ?? 0,
        bolleAperte: bolleAperteRes.count ?? 0,
        fattureTotal: fattureRes.count ?? 0,
        pending: pendingCount as number,
        totaleSpesa,
        listinoRows,
        statementsInPeriod,
        statementsWithIssues,
      })
      setLoading(false)
    })
  }, [fornitoreId, year, month])

  return { stats, loading }
}

type KpiDef = {
  label: string
  value: number | string
  icon: ReactNode
  sub: string
  subColor: string
  tab: Tab
  accent: string
  accentHex: string
}

function buildSupplierKpiItems(stats: SupplierPeriodStats | null, t: ReturnType<typeof useT>): KpiDef[] {
  const stmtN = stats?.statementsInPeriod ?? 0
  const stmtIssues = stats?.statementsWithIssues ?? 0
  let stmtSub: string
  let stmtSubColor: string
  if (stmtN === 0) {
    stmtSub = t.fornitori.subStatementsNoneInMonth
    stmtSubColor = 'text-slate-400'
  } else if (stmtIssues === 0) {
    stmtSub = t.fornitori.subStatementsAllVerified
    stmtSubColor = 'text-emerald-400'
  } else {
    stmtSub = `${stmtIssues} ${t.fornitori.subStatementsWithIssues}`
    stmtSubColor = 'text-amber-400'
  }

  return [
    {
      label: t.fornitori.kpiBolleTotal,
      value: stats?.bolleTotal ?? 0,
      tab: 'bolle',
      accent: 'border-l-blue-500',
      accentHex: '#3b82f6',
      icon: (
        <svg className="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
      sub: `${stats?.bolleAperte ?? 0} ${t.fornitori.subAperte}`,
      subColor: (stats?.bolleAperte ?? 0) > 0 ? 'text-amber-400' : 'text-slate-400',
    },
    {
      label: t.fornitori.kpiFatture,
      value: stats?.fattureTotal ?? 0,
      tab: 'fatture',
      accent: 'border-l-green-500',
      accentHex: '#22c55e',
      icon: (
        <svg className="h-5 w-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      sub: t.fornitori.subConfermate,
      subColor: 'text-slate-400',
    },
    {
      label: t.fornitori.kpiPending,
      value: stats?.pending ?? 0,
      tab: 'documenti',
      accent: 'border-l-amber-500',
      accentHex: '#f59e0b',
      icon: (
        <svg className="h-5 w-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      sub: t.fornitori.subDaAbbinare,
      subColor: (stats?.pending ?? 0) > 0 ? 'text-amber-400' : 'text-slate-400',
    },
    {
      label: t.common.total,
      value: (() => {
        const v = stats?.totaleSpesa ?? 0
        return v >= 1000 ? `£${(v / 1000).toFixed(1)}k` : `£${v.toFixed(0)}`
      })(),
      tab: 'fatture',
      accent: 'border-l-purple-500',
      accentHex: '#a855f7',
      icon: (
        <svg className="h-5 w-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      sub: `${stats?.fattureTotal ?? 0} ${t.nav.fatture.toLowerCase()}`,
      subColor: 'text-slate-400',
    },
    {
      label: t.fornitori.tabListino,
      value: stats?.listinoRows ?? 0,
      tab: 'listino',
      accent: 'border-l-teal-500',
      accentHex: '#14b8a6',
      icon: (
        <svg className="h-5 w-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h10M4 18h10" />
        </svg>
      ),
      sub: t.fornitori.subListinoRows,
      subColor: (stats?.listinoRows ?? 0) > 0 ? 'text-slate-400' : 'text-slate-500',
    },
    {
      label: t.statements.tabVerifica,
      value: stats?.statementsInPeriod ?? 0,
      tab: 'verifica',
      accent: 'border-l-sky-500',
      accentHex: '#0ea5e9',
      icon: (
        <svg className="h-5 w-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
      sub: stmtSub,
      subColor: stmtSubColor,
    },
  ]
}

/** Griglia KPI desktop: sempre visibile sotto le tab (tutte le sezioni). */
function SupplierDesktopKpiGrid({
  loading,
  stats,
  onTabChange,
}: {
  loading: boolean
  stats: SupplierPeriodStats | null
  onTabChange: (tab: Tab) => void
}) {
  const t = useT()
  if (loading) {
    const skeletonAccents = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#14b8a6', '#0ea5e9'] as const
    return (
      <div className="mb-6 hidden gap-4 md:grid md:grid-cols-3 xl:grid-cols-6">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="app-card animate-pulse overflow-hidden border-l-4 p-5"
            style={{ borderLeftColor: skeletonAccents[i] }}
          >
            <div className="app-card-bar mb-3" aria-hidden />
            <div className="mb-3 flex items-center justify-between">
              <div className="h-3 flex-1 rounded bg-slate-700/80" />
              <div className="h-6 w-6 shrink-0 rounded-lg bg-slate-700/80" />
            </div>
            <div className="h-8 w-1/2 rounded bg-slate-700/80" />
            <div className="mt-1 flex items-center justify-between">
              <div className="h-3 w-2/3 rounded bg-slate-700/80" />
              <div className="h-3.5 w-3.5 shrink-0 rounded bg-slate-700/80" />
            </div>
          </div>
        ))}
      </div>
    )
  }
  const kpis = buildSupplierKpiItems(stats, t)
  return (
    <div className="mb-6 hidden gap-4 md:grid md:grid-cols-3 xl:grid-cols-6">
      {kpis.map((k) => (
        <button
          key={k.label}
          type="button"
          onClick={() => onTabChange(k.tab)}
          className={`app-card group cursor-pointer overflow-hidden border-l-4 ${k.accent} p-5 text-left transition-all hover:border-cyan-500/30 active:scale-[0.98]`}
          style={{ borderLeftColor: k.accentHex }}
        >
          <div className="app-card-bar" aria-hidden />
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{k.label}</p>
            {k.icon}
          </div>
          <p className="text-3xl font-bold text-slate-100">{k.value}</p>
          <div className="mt-1 flex items-center justify-between">
            <p className={`text-xs ${k.subColor}`}>{k.sub}</p>
            <svg className="h-3.5 w-3.5 text-slate-600 transition-colors group-hover:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>
      ))}
    </div>
  )
}

function DashboardTab({
  fornitoreId,
  fornitore,
  periodStats,
  periodStatsLoading,
  filterYear,
  filterMonth,
  onFornitoreReload,
}: {
  fornitoreId: string
  fornitore: Fornitore
  periodStats: SupplierPeriodStats | null
  periodStatsLoading: boolean
  filterYear: number
  filterMonth: number
  onFornitoreReload?: () => void
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const t = useT()
  const { locale, timezone } = useLocale()
  const formatDate = useAppFormatDate()

  // Contacts state
  const [contatti, setContatti]           = useState<ContattoRow[]>([])
  const [contattiLoading, setContattiLoading] = useState(true)
  const [contattiError, setContattiError] = useState(false)
  const [showAddForm, setShowAddForm]     = useState(false)
  const [editingId, setEditingId]         = useState<string | null>(null)
  const [deletingId, setDeletingId]       = useState<string | null>(null)
  const [formNome, setFormNome]           = useState('')
  const [formRuolo, setFormRuolo]         = useState('')
  const [formEmail, setFormEmail]         = useState('')
  const [formTelefono, setFormTelefono]   = useState('')
  const [formSaving, setFormSaving]       = useState(false)

  const loadContatti = async () => {
    const res = await fetch(`/api/fornitore-contatti?fornitore_id=${fornitoreId}`)
    if (!res.ok) { setContattiError(true); setContattiLoading(false); return }
    const data = await res.json()
    if (Array.isArray(data)) { setContatti(data); setContattiError(false) }
    else setContattiError(true)
    setContattiLoading(false)
  }

  const openAdd = () => {
    setEditingId(null)
    setFormNome(''); setFormRuolo(''); setFormEmail(''); setFormTelefono('')
    setShowAddForm(true)
  }

  const openEdit = (c: ContattoRow) => {
    setEditingId(c.id)
    setFormNome(c.nome); setFormRuolo(c.ruolo ?? ''); setFormEmail(c.email ?? ''); setFormTelefono(c.telefono ?? '')
    setShowAddForm(true)
  }

  const handleSaveContatto = async () => {
    if (!formNome.trim()) return
    setFormSaving(true)
    const body = { fornitore_id: fornitoreId, nome: formNome, ruolo: formRuolo, email: formEmail, telefono: formTelefono }
    const res = editingId
      ? await fetch(`/api/fornitore-contatti?id=${editingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      : await fetch('/api/fornitore-contatti', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setFormSaving(false)
    if (res.ok) { setShowAddForm(false); setEditingId(null); await loadContatti() }
  }

  const handleDeleteContatto = async (id: string) => {
    setDeletingId(id)
    await fetch(`/api/fornitore-contatti?id=${id}`, { method: 'DELETE' })
    setDeletingId(null)
    await loadContatti()
  }

  useEffect(() => { loadContatti() }, [fornitoreId]) // eslint-disable-line react-hooks/exhaustive-deps

  const [bolleSheetItems, setBolleSheetItems] = useState<DashboardKpiListItem[]>([])
  const [fattureSheetItems, setFattureSheetItems] = useState<DashboardKpiListItem[]>([])

  useEffect(() => {
    const from = `${filterYear}-${String(filterMonth).padStart(2, '0')}-01`
    const to = new Date(filterYear, filterMonth, 1).toISOString().split('T')[0]
    const supabase = createClient()
    Promise.all([
      supabase
        .from('bolle')
        .select('id, data, numero_bolla, stato')
        .eq('fornitore_id', fornitoreId)
        .gte('data', from)
        .lt('data', to)
        .order('data', { ascending: false }),
      supabase
        .from('fatture')
        .select('id, data, numero_fattura')
        .eq('fornitore_id', fornitoreId)
        .gte('data', from)
        .lt('data', to)
        .order('data', { ascending: false }),
    ]).then(([br, fr]) => {
      const bl = (br.data ?? []) as { id: string; data: string; numero_bolla: string | null; stato: string }[]
      const ft = (fr.data ?? []) as { id: string; data: string; numero_fattura: string | null }[]
      setBolleSheetItems(
        bl.map((b) => ({
          id: b.id,
          href: `/bolle/${b.id}`,
          title: formatDate(b.data),
          subtitle: b.numero_bolla?.trim() ? `#${b.numero_bolla}` : null,
          statusPill: b.stato === 'completato' ? ('completato' as const) : ('in attesa' as const),
        }))
      )
      setFattureSheetItems(
        ft.map((f) => ({
          id: f.id,
          href: `/fatture/${f.id}`,
          title: formatDate(f.data),
          subtitle: f.numero_fattura?.trim() ?? null,
        }))
      )
    })
  }, [fornitoreId, filterYear, filterMonth, formatDate])

  if (periodStatsLoading) {
    const skeletonAccents = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#14b8a6', '#0ea5e9'] as const
    return (
      <div className="grid grid-cols-2 gap-3 md:hidden">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="app-card animate-pulse overflow-hidden border-l-[3px] p-3"
            style={{ borderLeftColor: skeletonAccents[i] }}
          >
            <div className="app-card-bar mb-2" aria-hidden />
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="h-3 flex-1 rounded bg-slate-700/80" />
              <div className="h-6 w-6 shrink-0 rounded-lg bg-slate-700/80" />
            </div>
            <div className="h-7 w-1/2 rounded bg-slate-700/80" />
            <div className="mt-0.5 h-2.5 w-2/3 rounded bg-slate-700/80" />
          </div>
        ))}
      </div>
    )
  }

  const kpis = buildSupplierKpiItems(periodStats, t)

  const nuovaBollaActive =
    pathname === '/bolle/new' && searchParams.get('fornitore_id') === fornitoreId
  const nuovaFatturaActive =
    pathname === '/fatture/new' && searchParams.get('fornitore_id') === fornitoreId

  return (
    <div className="space-y-6">
      {/* Mobile: KPI — bolle/fatture come foglio elenco (come dashboard); altre voci → tab via Link. */}
      <div className="grid grid-cols-2 gap-3 md:hidden">
        {kpis.map((k) => {
          const tabHref = fornitorePageTabHref(pathname, searchParams, k.tab)
          if (k.tab === 'bolle') {
            return (
              <DashboardKpiListSheet
                key={k.label}
                layout="mobile"
                count={periodStats?.bolleTotal ?? 0}
                label={k.label}
                icon={<span className="[&>svg]:!h-6 [&>svg]:!w-6">{k.icon}</span>}
                bgClass="bg-blue-500/20"
                tileAccentHex={k.accentHex}
                sheetTitle={t.bolle.title}
                items={bolleSheetItems}
                emptyText={t.bolle.noBills}
                viewAllHref={tabHref}
              />
            )
          }
          if (k.tab === 'fatture') {
            const fattureBg = k.accentHex === '#a855f7' ? 'bg-violet-500/20' : 'bg-emerald-500/20'
            const isTotaleTile = k.accentHex === '#a855f7'
            return (
              <DashboardKpiListSheet
                key={k.label}
                layout="mobile"
                count={periodStats?.fattureTotal ?? 0}
                tileValue={isTotaleTile ? k.value : undefined}
                label={k.label}
                icon={<span className="[&>svg]:!h-6 [&>svg]:!w-6">{k.icon}</span>}
                bgClass={fattureBg}
                tileAccentHex={k.accentHex}
                sheetTitle={t.fatture.title}
                items={fattureSheetItems}
                emptyText={t.fatture.noInvoices}
                viewAllHref={tabHref}
              />
            )
          }
          return (
            <Link
              key={k.label}
              href={tabHref}
              scroll={false}
              className="app-card group block w-full overflow-hidden border-l-[3px] p-3 text-left transition-all active:scale-[0.99] hover:border-cyan-500/30"
              style={{ borderLeftColor: k.accentHex }}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <p className="line-clamp-2 min-w-0 flex-1 text-[10px] font-semibold uppercase leading-tight tracking-wide text-slate-400">
                  {k.label}
                </p>
                <span className="shrink-0 [&>svg]:!h-6 [&>svg]:!w-6" aria-hidden>
                  {k.icon}
                </span>
              </div>
              <p className="text-xl font-bold tabular-nums text-slate-100">{k.value}</p>
              <p className={`mt-0.5 line-clamp-1 text-[10px] ${k.subColor}`}>{k.sub}</p>
            </Link>
          )
        })}
      </div>

      {/* Mobile: stesse azioni che prima erano nella bottom bar fissa, sotto i KPI */}
      <div className="grid grid-cols-2 gap-3 md:hidden">
        <Link
          href={`/bolle/new?fornitore_id=${fornitoreId}`}
          className={`app-glow-cyan flex min-h-[44px] min-w-0 touch-manipulation items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-white transition-colors active:scale-[0.99] ${
            nuovaBollaActive
              ? 'bg-cyan-600 ring-2 ring-white/30 ring-offset-2 ring-offset-slate-900'
              : 'bg-cyan-500 hover:bg-cyan-600 active:bg-cyan-700'
          }`}
          aria-current={nuovaBollaActive ? 'page' : undefined}
        >
          <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="truncate">{t.nav.nuovaBolla}</span>
        </Link>
        <Link
          href={`/fatture/new?fornitore_id=${fornitoreId}`}
          className={`flex min-h-[44px] min-w-0 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold shadow-lg transition-colors touch-manipulation active:scale-[0.99] ${
            nuovaFatturaActive
              ? 'border-cyan-400/60 bg-white/15 text-cyan-200 ring-2 ring-cyan-500/30 ring-offset-2 ring-offset-slate-900'
              : 'border-slate-600/80 bg-slate-800/90 text-slate-100 hover:bg-slate-800'
          }`}
          aria-current={nuovaFatturaActive ? 'page' : undefined}
        >
          <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="truncate">{t.fatture.new}</span>
        </Link>
      </div>

      {/* ── Contacts section ── */}
      {!contattiError && (
        <div className="app-card overflow-hidden">
          <div className="app-card-bar" aria-hidden />
          <div className="flex items-center justify-between border-b border-slate-700/60 px-4 py-2.5 md:px-5 md:py-3">
            <div className="flex items-center gap-2">
              <svg className="h-3.5 w-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t.appStrings.contactsHeading}</p>
              {contatti.length > 0 && (
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-400">{contatti.length}</span>
              )}
            </div>
            <button onClick={openAdd}
              className="flex items-center gap-1 px-2.5 py-1 bg-cyan-500 hover:bg-cyan-400 text-white text-[11px] font-bold rounded-lg transition-colors">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
              {t.common.add}
            </button>
          </div>

          {/* Add / edit form */}
          {showAddForm && (
            <div className="border-b border-cyan-500/25 bg-cyan-500/10 px-4 py-4 md:px-5">
              <p className="mb-3 text-xs font-semibold text-cyan-200">{editingId ? t.appStrings.contactEdit : t.appStrings.contactNew}</p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="md:col-span-2">
                  <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500">{t.fornitori.nome} *</label>
                  <input type="text" value={formNome} onChange={e => setFormNome(e.target.value)} placeholder="Marco Ferretti"
                    className="w-full rounded-lg border border-slate-600/60 bg-slate-800/70 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/40" />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500">{t.common.role}</label>
                  <input type="text" value={formRuolo} onChange={e => setFormRuolo(e.target.value)} placeholder="Administration"
                    className="w-full rounded-lg border border-slate-600/60 bg-slate-800/70 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/40" />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500">{t.common.phone}</label>
                  <input type="tel" value={formTelefono} onChange={e => setFormTelefono(e.target.value)} placeholder="+44 20 1234 5678"
                    className="w-full rounded-lg border border-slate-600/60 bg-slate-800/70 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/40" />
                </div>
                <div className="md:col-span-4">
                  <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500">{t.fornitori.email}</label>
                  <input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="marco@supplier.com"
                    className="w-full rounded-lg border border-slate-600/60 bg-slate-800/70 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/40" />
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={handleSaveContatto} disabled={formSaving || !formNome.trim()}
                  className="rounded-lg bg-cyan-500 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-cyan-400 disabled:opacity-40">
                  {formSaving ? t.common.saving : t.common.save}
                </button>
                <button onClick={() => { setShowAddForm(false); setEditingId(null) }}
                  className="rounded-lg px-4 py-2 text-xs font-medium text-slate-400 transition-colors hover:text-slate-200">
                  {t.common.cancel}
                </button>
              </div>
            </div>
          )}

          {/* Contact list */}
          {contattiLoading ? (
            <div className="divide-y divide-slate-800/80">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="flex animate-pulse items-center gap-3 px-4 py-3 md:px-5 md:py-3.5">
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-700/80" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-3 w-24 rounded bg-slate-700/80" />
                    <div className="h-3.5 w-36 rounded bg-slate-700/80" />
                  </div>
                </div>
              ))}
            </div>
          ) : contatti.length === 0 && !showAddForm ? (
            <div className="px-4 py-8 text-center md:px-5">
              <svg className="mx-auto mb-2 h-8 w-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              <p className="text-xs text-slate-500">{t.appStrings.noContactRegistered}</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {contatti.map(c => (
                <div key={c.id} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-800/30 md:px-5 md:py-3.5">
                  {/* Avatar */}
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white ${getAvatarColor(c.nome)}`}>
                    {getInitials(c.nome)}
                  </div>
                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    {c.ruolo && <p className="text-[10px] leading-tight text-slate-500">{c.ruolo}</p>}
                    <p className="text-sm font-semibold leading-tight text-slate-100">{c.nome}</p>
                  </div>
                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-1">
                    {c.telefono && (
                      <a href={`tel:${c.telefono}`} title={c.telefono}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-emerald-400 transition-colors hover:bg-emerald-500/15">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                      </a>
                    )}
                    {c.email && (
                      <a href={`mailto:${c.email}`} title={c.email}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-cyan-400 transition-colors hover:bg-cyan-500/15">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      </a>
                    )}
                    <button onClick={() => openEdit(c)} title={t.common.edit}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 opacity-0 transition-colors hover:bg-slate-800 hover:text-slate-200 group-hover:opacity-100">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                    <button onClick={() => handleDeleteContatto(c.id)} disabled={deletingId === c.id} title={t.appStrings.contactRemove}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 opacity-0 transition-colors hover:bg-red-950/50 hover:text-red-400 group-hover:opacity-100 disabled:opacity-40">
                      {deletingId === c.id
                        ? <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                        : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      }
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Supplier info card */}
      <div className="app-card overflow-hidden">
        <div className="app-card-bar" aria-hidden />
        <div className="flex items-center gap-2 border-b border-slate-700/60 px-5 py-3">
          <svg className="h-3.5 w-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t.appStrings.infoSupplierCard}</p>
        </div>
        <div className="grid grid-cols-2 gap-0 divide-y divide-slate-800/80 md:grid-cols-3 md:divide-x md:divide-y-0 md:divide-slate-800/80">

          {/* Contact */}
          <div className="space-y-3 px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t.appStrings.contactsHeading}</p>
            {fornitore.email && (
              <div className="flex items-center gap-2">
                <svg className="h-3.5 w-3.5 shrink-0 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                <a href={`mailto:${fornitore.email}`} className="truncate text-xs text-cyan-400 hover:text-cyan-300 hover:underline">{fornitore.email}</a>
              </div>
            )}
            {fornitore.telefono && (
              <div className="flex items-center gap-2">
                <svg className="h-3.5 w-3.5 shrink-0 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                <a href={`tel:${fornitore.telefono}`} className="text-xs text-slate-300 hover:text-cyan-300">{fornitore.telefono}</a>
              </div>
            )}
            {fornitore.contatto_nome && (
              <div className="flex items-center gap-2">
                <svg className="h-3.5 w-3.5 shrink-0 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                <span className="text-xs text-slate-300">{fornitore.contatto_nome}</span>
              </div>
            )}
            {!fornitore.email && !fornitore.telefono && !fornitore.contatto_nome && (
              <p className="text-xs italic text-slate-600">{t.appStrings.noContactRegistered}</p>
            )}
          </div>

          {/* Address */}
          <div className="space-y-3 px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t.appStrings.contactsLegal}</p>
            {(fornitore.indirizzo || fornitore.citta || fornitore.paese) ? (
              <div className="flex items-start gap-2">
                <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <div className="text-xs leading-relaxed text-slate-300">
                  {fornitore.indirizzo && <p>{fornitore.indirizzo}</p>}
                  {(fornitore.citta || fornitore.paese) && <p>{[fornitore.citta, fornitore.paese].filter(Boolean).join(', ')}</p>}
                </div>
              </div>
            ) : (
              <p className="text-xs italic text-slate-600">{t.appStrings.noAddressRegistered}</p>
            )}
          </div>

          {/* Fiscal info */}
          <div className="space-y-3 px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t.appStrings.contactsFiscal}</p>
            {fornitore.piva && (
              <div className="flex items-center gap-2">
                <svg className="h-3.5 w-3.5 shrink-0 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                <span className="font-mono text-xs text-slate-300">{fornitore.piva}</span>
              </div>
            )}
            {Number.isFinite(new Date(fornitore.created_at).getTime()) && (
              <div className="flex items-center gap-2">
                <svg className="h-3.5 w-3.5 shrink-0 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <span className="text-xs text-slate-500">{t.appStrings.clientSince} {formatDateLib(fornitore.created_at, locale, timezone, { month: 'long', year: 'numeric' })}</span>
              </div>
            )}
            {fornitore.note && (
              <div className="mt-1 flex items-start gap-2">
                <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
                <p className="text-xs italic leading-relaxed text-slate-400">{fornitore.note}</p>
              </div>
            )}
            {!fornitore.piva && !fornitore.note && (
              <p className="text-xs italic text-slate-600">{t.appStrings.noFiscalRegistered}</p>
            )}
          </div>
        </div>
      </div>

      <RekkiSupplierIntegration
        fornitoreId={fornitoreId}
        piva={fornitore.piva}
        initialRekkiId={fornitore.rekki_supplier_id}
        initialRekkiLink={fornitore.rekki_link}
        onSaved={onFornitoreReload}
      />

    </div>
  )
}

/* ─── Bolle tab ──────────────────────────────────────────────────── */
function BolleTab({ fornitoreId, year, month }: { fornitoreId: string; year: number; month: number }) {
  const router = useRouter()
  const t = useT()
  const formatDate = useAppFormatDate()
  const [bolle, setBolle] = useState<Bolla[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const from = `${year}-${String(month).padStart(2, '0')}-01`
    const to   = new Date(year, month, 1).toISOString().split('T')[0]
    const supabase = createClient()
    supabase
      .from('bolle')
      .select('id, data, stato, file_url, numero_bolla, importo')
      .eq('fornitore_id', fornitoreId)
      .gte('data', from)
      .lt('data', to)
      .order('data', { ascending: false })
      .then(({ data }: { data: Bolla[] | null }) => {
        setBolle(data ?? [])
        setLoading(false)
      })
  }, [fornitoreId, year, month])

  if (loading) {
    return (
      <div className="app-card overflow-hidden">
        <div className="app-card-bar" aria-hidden />
        <div className="divide-y divide-slate-800/80">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex animate-pulse gap-4 px-5 py-3.5">
            <div className="h-4 w-24 shrink-0 rounded bg-slate-700/80" />
            <div className="h-4 w-16 shrink-0 rounded bg-slate-700/80" />
          </div>
        ))}
        </div>
      </div>
    )
  }

  if (bolle.length === 0) {
    return (
      <div className="app-card overflow-hidden">
        <div className="app-card-bar" aria-hidden />
        <div className="px-6 py-16 text-center">
        <svg className="mx-auto mb-3 h-12 w-12 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p className="text-sm font-medium text-slate-400">{t.bolle.nessunaBollaRegistrata}</p>
        <Link href={`/bolle/new?fornitore_id=${fornitoreId}`}
          className="mt-3 inline-block text-sm font-medium text-cyan-400 hover:text-cyan-300 hover:underline">
          {t.bolle.creaLaPrimaBolla}
        </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="app-card flex flex-col overflow-hidden">
      <div className="app-card-bar" aria-hidden />
      <div className="min-w-0 flex-1">
      <div className="divide-y divide-slate-800/80 md:hidden">
        {bolle.map((b) => (
          <div
            key={b.id}
            role="button"
            tabIndex={0}
            onClick={() => router.push(`/bolle/${b.id}`)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') router.push(`/bolle/${b.id}`) }}
            className="flex min-h-[56px] cursor-pointer items-center justify-between gap-3 px-4 py-4 transition-colors hover:bg-slate-800/40 active:bg-slate-800/60 touch-manipulation"
          >
            <div>
              <p className="text-sm font-medium text-slate-100">{formatDate(b.data)}</p>
              {b.numero_bolla && <p className="mt-0.5 text-xs text-slate-400">#{b.numero_bolla}</p>}
              {b.importo != null && <p className="mt-0.5 text-xs font-semibold text-slate-300">£{b.importo.toFixed(2)}</p>}
            </div>
            <div className="flex items-center gap-2">
                {b.stato === 'completato' ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/15 px-2 py-0.5 text-[11px] font-semibold text-green-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400" /> {t.bolle.statoCompletato}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> {t.bolle.statoInAttesa}
                </span>
              )}
              {b.file_url && (
                <a
                  href={openDocumentUrl({ bollaId: b.id })}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="-mr-2 px-2 py-1.5 text-xs text-cyan-400 touch-manipulation hover:text-cyan-300 hover:underline"
                >
                  {t.bolle.apri}
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="border-b border-slate-700/60 bg-slate-950/40">
              <th className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">{t.common.date}</th>
              <th className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">{t.bolle.colNumero}</th>
              <th className="px-5 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">{t.statements.colAmount}</th>
              <th className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">{t.common.status}</th>
              <th className="px-5 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {bolle.map((b) => (
              <tr key={b.id} className="cursor-pointer transition-colors hover:bg-slate-800/40" onClick={() => window.location.href = `/bolle/${b.id}`}>
                <td className="px-5 py-3 font-medium text-slate-300">{formatDate(b.data)}</td>
                <td className="px-5 py-3 font-mono text-xs text-slate-500">{b.numero_bolla ?? '—'}</td>
                <td className="px-5 py-3 text-right font-bold tabular-nums text-slate-200">{b.importo != null ? `£${b.importo.toFixed(2)}` : '—'}</td>
                <td className="px-5 py-3">
                  {b.stato === 'completato' ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-green-500/30 bg-green-500/15 px-2 py-0.5 text-[11px] font-semibold text-green-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-400" /> {t.bolle.statoCompletato}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> {t.bolle.statoInAttesa}
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                    {b.file_url && (
                      <a href={openDocumentUrl({ bollaId: b.id })} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[10px] font-semibold text-cyan-300 transition-colors hover:bg-cyan-500/20">
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                        {t.bolle.vediDocumento}
                      </a>
                    )}
                    <Link href={`/bolle/${b.id}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-cyan-600 px-2 py-1 text-[10px] font-semibold text-white transition-colors hover:bg-cyan-500">
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      {t.bolle.apri}
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  )
}

/* ─── Fatture tab ────────────────────────────────────────────────── */
function FattureTab({ fornitoreId, year, month }: { fornitoreId: string; year: number; month: number }) {
  const t = useT()
  const formatDate = useAppFormatDate()
  const [fatture, setFatture] = useState<Fattura[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const from = `${year}-${String(month).padStart(2, '0')}-01`
    const to   = new Date(year, month, 1).toISOString().split('T')[0]
    const supabase = createClient()
    supabase
      .from('fatture')
      .select('id, data, file_url, bolla_id, numero_fattura, importo')
      .eq('fornitore_id', fornitoreId)
      .gte('data', from)
      .lt('data', to)
      .order('data', { ascending: false })
      .then(({ data }: { data: Fattura[] | null }) => {
        setFatture(data ?? [])
        setLoading(false)
      })
  }, [fornitoreId, year, month])

  if (loading) {
    return (
      <div className="app-card overflow-hidden">
        <div className="app-card-bar" aria-hidden />
        <div className="divide-y divide-slate-800/80">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex animate-pulse gap-4 px-5 py-3.5">
            <div className="h-4 w-24 shrink-0 rounded bg-slate-700/80" />
            <div className="h-4 w-16 shrink-0 rounded bg-slate-700/80" />
          </div>
        ))}
        </div>
      </div>
    )
  }

  if (fatture.length === 0) {
    return (
      <div className="app-card overflow-hidden">
        <div className="app-card-bar" aria-hidden />
        <div className="px-6 py-16 text-center">
        <svg className="mx-auto mb-3 h-12 w-12 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-sm font-medium text-slate-400">{t.fatture.nessunaFatturaRegistrata}</p>
        <Link href={`/fatture/new?fornitore_id=${fornitoreId}`}
          className="mt-3 inline-block text-sm font-medium text-cyan-400 hover:text-cyan-300 hover:underline">
          {t.fatture.addFirst}
        </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="app-card flex flex-col overflow-hidden">
      <div className="app-card-bar" aria-hidden />
      <div className="min-w-0 flex-1">
      <div className="divide-y divide-slate-800/80 md:hidden">
        {fatture.map((f) => (
          <div key={f.id} className="min-h-[56px] px-4 py-4 transition-colors hover:bg-slate-800/40 active:bg-slate-800/60 touch-manipulation">
            <Link href={`/fatture/${f.id}`} className="block">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-slate-100">{formatDate(f.data)}</p>
                  {f.numero_fattura && <p className="mt-0.5 text-xs text-slate-400">#{f.numero_fattura}</p>}
                  {f.importo != null && <p className="mt-0.5 text-xs font-semibold text-slate-300">£{f.importo.toFixed(2)}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {f.bolla_id ? (
                    <span className="rounded-full border border-cyan-500/30 bg-cyan-500/15 px-2 py-0.5 text-[11px] font-medium text-cyan-300">
                      {t.fatture.statusAssociata}
                    </span>
                  ) : (
                    <span className="rounded-full border border-slate-600/60 bg-slate-800/80 px-2 py-0.5 text-[11px] font-medium text-slate-400">
                      {t.fatture.statusSenzaBolla}
                    </span>
                  )}
                </div>
              </div>
            </Link>
            {f.file_url && (
              <a
                href={openDocumentUrl({ fatturaId: f.id })}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-xs font-medium text-green-400 hover:text-green-300 hover:underline"
              >
                PDF
              </a>
            )}
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[380px] text-sm">
          <thead>
            <tr className="border-b border-slate-700/60 bg-slate-950/40">
              <th className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">{t.common.date}</th>
              <th className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">{t.fatture.colNumFattura}</th>
              <th className="px-5 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">{t.statements.colAmount}</th>
              <th className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">{t.fatture.headerBolla}</th>
              <th className="px-5 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {fatture.map((f) => (
              <tr key={f.id} className="transition-colors hover:bg-slate-800/40">
                <td className="px-5 py-3 font-medium text-slate-300">{formatDate(f.data)}</td>
                <td className="px-5 py-3 font-mono text-xs text-slate-500">{f.numero_fattura ?? '—'}</td>
                <td className="px-5 py-3 text-right font-bold tabular-nums text-slate-200">{f.importo != null ? `£${f.importo.toFixed(2)}` : '—'}</td>
                <td className="px-5 py-3">
                  {f.bolla_id ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/15 px-2 py-0.5 text-[11px] font-semibold text-cyan-300">
                      {t.fatture.statusAssociata}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-600/60 bg-slate-800/80 px-2 py-0.5 text-[11px] font-semibold text-slate-400">
                      {t.fatture.statusSenzaBolla}
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {f.file_url && (
                      <a href={openDocumentUrl({ fatturaId: f.id })} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[10px] font-semibold text-cyan-300 transition-colors hover:bg-cyan-500/20">
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                        PDF
                      </a>
                    )}
                    <Link href={`/fatture/${f.id}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-cyan-600 px-2 py-1 text-[10px] font-semibold text-white transition-colors hover:bg-cyan-500">
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      {t.fatture.dettaglio}
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  )
}

/* ─── Listino / Storico Prezzi tab ───────────────────────────────── */

interface ListinoProdotto {
  id: string
  prodotto: string
  prezzo: number
  data_prezzo: string
  note: string | null
}

const MIGRATION_SQL = `-- Esegui nel Supabase Dashboard → SQL Editor
CREATE TABLE IF NOT EXISTS public.listino_prezzi (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  fornitore_id uuid NOT NULL REFERENCES public.fornitori(id) ON DELETE CASCADE,
  sede_id      uuid REFERENCES public.sedi(id) ON DELETE SET NULL,
  prodotto     text NOT NULL,
  prezzo       numeric(12,2) NOT NULL,
  data_prezzo  date NOT NULL,
  note         text,
  created_at   timestamptz DEFAULT now()
);
ALTER TABLE public.listino_prezzi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "listino_select" ON public.listino_prezzi
  FOR SELECT USING (auth.role() IN ('authenticated','service_role'));`

function ListinoTab({ fornitoreId }: { fornitoreId: string }) {
  const t = useT()
  const { locale, timezone } = useLocale()
  const formatDate = useAppFormatDate()
  const [rows, setRows]               = useState<ListinoRow[]>([])
  const [listino, setListino]         = useState<ListinoProdotto[]>([])
  const [listTabloExists, setListTabloExists] = useState<boolean | null>(null)
  const [copied, setCopied]           = useState(false)
  const [loading, setLoading]         = useState(true)

  // New product form state
  const [showForm, setShowForm]       = useState(false)
  const [formProdotto, setFormProdotto] = useState('')
  const [formPrezzo, setFormPrezzo]   = useState('')
  const [formData, setFormData]       = useState(new Date().toISOString().split('T')[0])
  const [formNote, setFormNote]       = useState('')
  const [saving, setSaving]           = useState(false)
  const [saveError, setSaveError]     = useState<string | null>(null)
  const [deletingId, setDeletingId]   = useState<string | null>(null)

  // Import from fattura state
  type ImportItem = {
    prodotto: string
    prezzo: number
    unita: string | null
    note: string | null
    selected: boolean
    // Price comparison
    prezzoAttuale: number | null    // last known price from listino
    matchedProdotto: string | null  // name as stored in listino (may differ)
    delta: number | null            // percentage change vs prezzoAttuale
    isNew: boolean                  // product not found in listino
  }
  const [showImport, setShowImport]       = useState(false)
  const [importFattureList, setImportFattureList] = useState<{ id: string; label: string; file_url: string | null }[]>([])
  const [selectedFatturaId, setSelectedFatturaId] = useState('')
  const [importLoading, setImportLoading] = useState(false)
  const [importError, setImportError]     = useState<string | null>(null)
  const [importItems, setImportItems]     = useState<ImportItem[]>([])
  const [importDate, setImportDate]       = useState(new Date().toISOString().split('T')[0])
  const [importSaving, setImportSaving]   = useState(false)

  const loadListino = async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('listino_prezzi')
      .select('id, prodotto, prezzo, data_prezzo, note')
      .eq('fornitore_id', fornitoreId)
      .order('prodotto')
      .order('data_prezzo')
    if (error?.message?.includes('listino_prezzi')) {
      setListTabloExists(false)
    } else {
      setListTabloExists(true)
      setListino((data ?? []) as ListinoProdotto[])
    }
  }

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('bolle').select('id, data, numero_bolla, importo')
        .eq('fornitore_id', fornitoreId).not('importo', 'is', null).order('data'),
      supabase.from('fatture').select('id, data, numero_fattura, importo')
        .eq('fornitore_id', fornitoreId).not('importo', 'is', null).order('data'),
      supabase.from('listino_prezzi').select('id, prodotto, prezzo, data_prezzo, note')
        .eq('fornitore_id', fornitoreId).order('prodotto').order('data_prezzo'),
    ]).then(([bolleRes, fattureRes, listinoRes]) => {
      type BollaRaw   = { id: string; data: string; numero_bolla: string | null; importo: number | null }
      type FatturaRaw = { id: string; data: string; numero_fattura: string | null; importo: number | null }

      const bolleRows: ListinoRow[] = ((bolleRes.data ?? []) as BollaRaw[]).map(b => ({
        id: b.id, data: b.data, tipo: 'bolla' as const, numero: b.numero_bolla, importo: b.importo,
      }))
      const fattureRows: ListinoRow[] = ((fattureRes.data ?? []) as FatturaRaw[]).map(f => ({
        id: f.id, data: f.data, tipo: 'fattura' as const, numero: f.numero_fattura, importo: f.importo,
      }))
      const combined = [...bolleRows, ...fattureRows].sort(
        (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
      )
      setRows(combined)

      if (listinoRes.error?.message?.includes('listino_prezzi')) {
        setListTabloExists(false)
      } else {
        setListTabloExists(true)
        setListino((listinoRes.data ?? []) as ListinoProdotto[])
      }
      setLoading(false)
    })
  }, [fornitoreId])

  // ── Price comparison helpers ────────────────────────────────────────
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()

  const wordSimilarity = (a: string, b: string): number => {
    const wa = new Set(normalize(a).split(' '))
    const wb = new Set(normalize(b).split(' '))
    const intersection = [...wa].filter(w => wb.has(w)).length
    return intersection / Math.max(wa.size, wb.size)
  }

  const findBestListinoMatch = (
    prodotto: string,
    listinoData: ListinoProdotto[]
  ): { prezzoAttuale: number; matchedProdotto: string } | null => {
    if (listinoData.length === 0) return null
    // Group by product name and get the latest price for each
    const latestByProduct: Record<string, { prezzo: number; prodotto: string }> = {}
    for (const row of listinoData) {
      const existing = latestByProduct[row.prodotto]
      if (!existing || row.data_prezzo > (listinoData.find(r => r.prodotto === row.prodotto && r.id === existing.prodotto)?.data_prezzo ?? '')) {
        latestByProduct[row.prodotto] = { prezzo: row.prezzo, prodotto: row.prodotto }
      }
    }
    // Collect latest price for each product (last entry since ordered by data_prezzo)
    const products = Object.values(latestByProduct)

    let bestMatch: { prezzoAttuale: number; matchedProdotto: string } | null = null
    let bestScore = 0.3 // minimum threshold

    for (const p of products) {
      const score = wordSimilarity(prodotto, p.prodotto)
      if (score > bestScore) {
        bestScore = score
        bestMatch = { prezzoAttuale: p.prezzo, matchedProdotto: p.prodotto }
      }
    }
    return bestMatch
  }

  const enrichWithComparison = (
    items: Omit<ImportItem, 'prezzoAttuale' | 'matchedProdotto' | 'delta' | 'isNew'>[],
    listinoData: ListinoProdotto[]
  ): ImportItem[] => {
    const latestByProduct: Record<string, { prezzo: number; data: string }> = {}
    for (const row of listinoData) {
      const cur = latestByProduct[row.prodotto]
      if (!cur || row.data_prezzo > cur.data) {
        latestByProduct[row.prodotto] = { prezzo: row.prezzo, data: row.data_prezzo }
      }
    }

    return items.map(item => {
      const match = findBestListinoMatch(item.prodotto, listinoData)
      const prezzoAttuale = match ? latestByProduct[match.matchedProdotto]?.prezzo ?? null : null
      const delta = prezzoAttuale != null && prezzoAttuale > 0
        ? ((item.prezzo - prezzoAttuale) / prezzoAttuale) * 100
        : null
      return {
        ...item,
        prezzoAttuale,
        matchedProdotto: match?.matchedProdotto ?? null,
        delta,
        isNew: match === null,
      }
    })
  }

  const openImport = async () => {
    setShowImport(true)
    setShowForm(false)
    setImportError(null)
    setImportItems([])
    if (importFattureList.length === 0) {
      const supabase = createClient()
      const { data } = await supabase
        .from('fatture')
        .select('id, data, numero_fattura, file_url')
        .eq('fornitore_id', fornitoreId)
        .not('file_url', 'is', null)
        .order('data', { ascending: false })
      const list = (data ?? []).map((f: { id: string; data: string; numero_fattura: string | null; file_url: string | null }) => ({
        id: f.id,
        label: f.numero_fattura
          ? `${t.fatture.invoice} ${f.numero_fattura} — ${formatDate(f.data)}`
          : `${t.fatture.invoice} · ${formatDate(f.data)}`,
        file_url: f.file_url,
      }))
      setImportFattureList(list)
      if (list.length > 0) setSelectedFatturaId(list[0].id)
    }
  }

  const handleImportAnalyze = async () => {
    if (!selectedFatturaId) return
    setImportLoading(true)
    setImportError(null)
    setImportItems([])
    try {
      const res = await fetch('/api/listino/importa-da-fattura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fattura_id: selectedFatturaId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Errore sconosciuto')
      if (json.items.length === 0) {
        setImportError('Nessun prodotto trovato in questa fattura. Prova con un\'altra.')
      } else {
        const enriched = enrichWithComparison(
          json.items.map((item: { prodotto: string; prezzo: number; unita: string | null; note: string | null }) => ({ ...item, selected: true })),
          listino
        )
        setImportItems(enriched)
        if (json.data_fattura) setImportDate(json.data_fattura)
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err))
    } finally {
      setImportLoading(false)
    }
  }

  const handleImportSave = async () => {
    const toSave = importItems.filter(i => i.selected && i.prodotto && i.prezzo > 0)
    if (!toSave.length) return
    setImportSaving(true)
    const supabase = createClient()
    const rows = toSave.map(i => ({
      fornitore_id: fornitoreId,
      prodotto: i.prodotto,
      prezzo: i.prezzo,
      data_prezzo: importDate,
      note: [i.unita ? `Unità: ${i.unita}` : null, i.note].filter(Boolean).join(' — ') || null,
    }))
    const { error } = await supabase.from('listino_prezzi').insert(rows)
    if (error) {
      setImportError(error.message)
      setImportSaving(false)
      return
    }
    setShowImport(false)
    setImportItems([])
    setImportSaving(false)
    await loadListino()
  }

  const handleSave = async () => {
    if (!formProdotto.trim() || !formPrezzo || !formData) return
    setSaving(true)
    setSaveError(null)
    const supabase = createClient()
    const { error } = await supabase.from('listino_prezzi').insert([{
      fornitore_id: fornitoreId,
      prodotto: formProdotto.trim(),
      prezzo: parseFloat(formPrezzo),
      data_prezzo: formData,
      note: formNote.trim() || null,
    }])
    if (error) {
      setSaveError(error.message)
      setSaving(false)
      return
    }
    // Reset form and reload
    setFormProdotto('')
    setFormPrezzo('')
    setFormData(new Date().toISOString().split('T')[0])
    setFormNote('')
    setShowForm(false)
    setSaving(false)
    await loadListino()
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    const supabase = createClient()
    await supabase.from('listino_prezzi').delete().eq('id', id)
    setDeletingId(null)
    await loadListino()
  }

  /* Group listino by product and detect price changes */
  const listinoByProduct = listino.reduce<Record<string, ListinoProdotto[]>>((acc, r) => {
    if (!acc[r.prodotto]) acc[r.prodotto] = []
    acc[r.prodotto].push(r)
    return acc
  }, {})

  const copy = () => {
    navigator.clipboard.writeText(MIGRATION_SQL).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (loading) {
    return (
      <div className="app-card overflow-hidden">
        <div className="app-card-bar" aria-hidden />
        <div className="flex animate-pulse items-center justify-between border-b border-slate-700/60 px-5 py-3">
          <div className="h-3 w-32 rounded bg-slate-700/80" />
          <div className="h-3 w-14 rounded bg-slate-700/80" />
        </div>
        <div className="divide-y divide-slate-700/50">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex animate-pulse gap-4 px-5 py-3.5">
              <div className="h-4 w-24 shrink-0 rounded bg-slate-700/80" />
              <div className="h-4 flex-1 rounded bg-slate-700/80" />
              <div className="h-4 w-20 shrink-0 rounded bg-slate-700/80" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const totale    = rows.reduce((s, r) => s + (r.importo ?? 0), 0)
  const totBolle  = rows.filter(r => r.tipo === 'bolla').reduce((s, r) => s + (r.importo ?? 0), 0)
  const totFatture = rows.filter(r => r.tipo === 'fattura').reduce((s, r) => s + (r.importo ?? 0), 0)

  return (
    <div className="space-y-5">

      {/* ── Listino Prodotti (se la tabella esiste) ── */}
      {listTabloExists === false ? (
        /* Setup card — compact 2-step flow */
        <div className="app-card overflow-hidden border-amber-500/25">
          <div className="app-card-bar" aria-hidden />
          <div className="px-5 py-4 flex items-start gap-3 bg-amber-500/10">
            <svg className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-100">{t.fornitori.listinoSetupTitle}</p>
              <p className="text-xs text-amber-200/80 mt-0.5 leading-relaxed">
                {t.fornitori.listinoSetupSubtitle}
              </p>
              <ol className="mt-2 space-y-1 text-xs text-amber-100/90 [&_a]:text-amber-200 [&_a]:underline [&_a]:decoration-amber-200/50 [&_a]:transition-colors [&_a:hover]:text-slate-100 [&_strong]:font-bold [&_strong]:text-slate-100 [&_code]:rounded [&_code]:bg-slate-950/50 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-slate-300">
                <li className="flex items-center gap-2">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-500/30 text-[10px] font-bold text-amber-100">1</span>
                  <span dangerouslySetInnerHTML={{ __html: t.fornitori.listinoSetupStep1 }} />
                </li>
                <li className="flex items-center gap-2">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-500/30 text-[10px] font-bold text-amber-100">2</span>
                  <span dangerouslySetInnerHTML={{ __html: t.fornitori.listinoSetupStep2 }} />
                </li>
              </ol>
            </div>
            <button
              onClick={copy}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-all ${
                copied
                  ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/35'
                  : 'bg-amber-500/25 text-amber-100 border-amber-500/40 hover:bg-amber-500/35'
              }`}
            >
              {copied ? (
                <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>{t.fornitori.listinoCopied}</>
              ) : (
                <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>{t.fornitori.listinoCopySQL}</>
              )}
            </button>
          </div>
          <details className="border-t border-amber-500/20">
            <summary className="px-5 py-2 text-[11px] text-amber-300/90 cursor-pointer hover:bg-amber-500/10 select-none">
              {t.fornitori.listinoSetupShowSQL}
            </summary>
            <pre className="text-[10px] text-amber-100/90 bg-slate-950/60 px-5 py-3 overflow-x-auto whitespace-pre font-mono border-t border-amber-500/15">
              {MIGRATION_SQL}
            </pre>
          </details>
        </div>
      ) : listTabloExists === true ? (
        /* Listino prodotti — with add form */
        <div className="app-card overflow-hidden">
          <div className="app-card-bar" aria-hidden />
          <div className="px-5 py-3 border-b border-slate-700/60 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t.fornitori.listinoProdotti}</p>
            <div className="flex items-center gap-2">
              {Object.keys(listinoByProduct).length > 0 && (
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                  {Object.keys(listinoByProduct).length} {t.fornitori.listinoProdottiTracked}
                </span>
              )}
              <button
                onClick={openImport}
                className="flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1 text-[11px] font-bold text-white transition-colors hover:bg-violet-500"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                {t.appStrings.fromInvoiceBtn}
              </button>
              <button
                onClick={() => { setShowForm(f => !f); setShowImport(false); setSaveError(null) }}
                className="flex items-center gap-1 px-2.5 py-1 bg-cyan-500 hover:bg-cyan-400 text-white text-[11px] font-bold rounded-lg transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                {t.common.add}
              </button>
            </div>
          </div>

          {/* Import from invoice panel */}
          {showImport && (
            <div className="border-b border-violet-500/25 bg-violet-500/10 px-5 py-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold text-violet-200">{t.appStrings.listinoImportPanelTitle}</p>
                <button type="button" onClick={() => setShowImport(false)} className="text-violet-400/80 transition-colors hover:text-violet-200">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>

              {importFattureList.length === 0 ? (
                <p className="text-xs text-violet-200/80">{t.appStrings.listinoNoInvoicesFile}</p>
              ) : (
                <>
                  <div className="mb-3 flex items-end gap-3">
                    <div className="flex-1">
                      <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500">{t.appStrings.listinoImportSelectInvoiceLabel}</label>
                      <select
                        value={selectedFatturaId}
                        onChange={e => { setSelectedFatturaId(e.target.value); setImportItems([]); setImportError(null) }}
                        className="w-full rounded-lg border border-slate-600/60 bg-slate-800/70 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                      >
                        {importFattureList.map(f => (
                          <option key={f.id} value={f.id}>{f.label}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={handleImportAnalyze}
                      disabled={importLoading || !selectedFatturaId}
                      className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap"
                    >
                      {importLoading ? (
                        <><svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>{t.appStrings.listinoAnalyzing}</>
                      ) : (
                        <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>{t.appStrings.listinoAnalyze}</>
                      )}
                    </button>
                  </div>

                  {importError && (
                    <div className="mb-3 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                      <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                      {importError}
                    </div>
                  )}

                  {importItems.length > 0 && (
                    <div className="mt-2">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-[10px] font-semibold uppercase text-slate-500">
                          {t.appStrings.listinoImportProductsSelected
                            .replace(/\{selected\}/g, String(importItems.filter(i => i.selected).length))
                            .replace(/\{total\}/g, String(importItems.length))}
                        </p>
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] font-semibold uppercase text-slate-500">{t.appStrings.listinoImportPriceListDateLabel}</label>
                          <input
                            type="date"
                            value={importDate}
                            onChange={e => setImportDate(e.target.value)}
                            className="rounded-lg border border-slate-600/60 bg-slate-800/70 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                          />
                        </div>
                      </div>

                      {/* Anomaly summary banner */}
                      {(() => {
                        const rincari  = importItems.filter(i => i.delta !== null && i.delta >  5)
                        const ribassi  = importItems.filter(i => i.delta !== null && i.delta < -5)
                        const nuovi    = importItems.filter(i => i.isNew)
                        if (rincari.length === 0 && ribassi.length === 0 && nuovi.length === 0) return null
                        return (
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            {rincari.length > 0 && (
                              <span className="flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-1 text-[10px] font-bold text-red-300">
                                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7"/></svg>
                                {rincari.length} rincaro{rincari.length > 1 ? 'i' : ''}
                              </span>
                            )}
                            {ribassi.length > 0 && (
                              <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold text-emerald-300">
                                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7"/></svg>
                                {ribassi.length} ribasso{ribassi.length > 1 ? 'i' : ''}
                              </span>
                            )}
                            {nuovi.length > 0 && (
                              <span className="flex items-center gap-1 rounded-full bg-cyan-500/15 px-2.5 py-1 text-[10px] font-bold text-cyan-300">
                                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                                {nuovi.length} nuovo{nuovi.length > 1 ? 'i' : ''}
                              </span>
                            )}
                            <span className="text-[10px] text-slate-500">rispetto all&apos;ultimo listino registrato</span>
                          </div>
                        )
                      })()}

                      <div className="mb-3 overflow-hidden rounded-lg border border-slate-700/60 bg-slate-900/40">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-700/60 bg-slate-800/80">
                              <th className="w-8 px-3 py-2"></th>
                              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Prodotto</th>
                              <th className="w-24 px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Ult. prezzo</th>
                              <th className="w-24 px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">In fattura</th>
                              <th className="w-24 px-3 py-2 text-center text-[10px] font-semibold uppercase text-slate-500">Δ variaz.</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-700/50">
                            {importItems.map((item, idx) => {
                              const isRincaro = item.delta !== null && item.delta >  5
                              const isRibasso = item.delta !== null && item.delta < -5
                              const rowBg = isRincaro ? 'bg-red-500/10' : isRibasso ? 'bg-emerald-500/10' : item.isNew ? 'bg-cyan-500/10' : ''
                              return (
                                <tr key={idx} className={`${rowBg} ${item.selected ? '' : 'opacity-40'}`}>
                                  <td className="px-3 py-2.5">
                                    <input
                                      type="checkbox"
                                      checked={item.selected}
                                      onChange={e => setImportItems(prev => prev.map((it, i) => i === idx ? { ...it, selected: e.target.checked } : it))}
                                      className="w-3.5 h-3.5 accent-violet-500 cursor-pointer"
                                    />
                                  </td>
                                  <td className="px-3 py-2.5 max-w-xs">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <input
                                        type="text"
                                        value={item.prodotto}
                                        onChange={e => setImportItems(prev => prev.map((it, i) => i === idx ? { ...it, prodotto: e.target.value } : it))}
                                        className="-mx-1 min-w-0 rounded bg-transparent px-1 font-medium text-slate-100 focus:bg-slate-800/80 focus:outline-none"
                                      />
                                      {item.isNew && (
                                        <span className="shrink-0 rounded-full bg-cyan-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-cyan-300">Nuovo</span>
                                      )}
                                      {item.matchedProdotto && item.matchedProdotto !== item.prodotto && (
                                        <span className="shrink-0 truncate text-[9px] italic text-slate-500">≈ {item.matchedProdotto}</span>
                                      )}
                                    </div>
                                    {item.note && <p className="mt-0.5 text-[10px] italic text-slate-500">{item.note}</p>}
                                  </td>
                                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-400">
                                    {item.prezzoAttuale != null ? `£${item.prezzoAttuale.toFixed(2)}` : <span className="text-slate-600">—</span>}
                                  </td>
                                  <td className="px-3 py-2.5 text-right tabular-nums">
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={item.prezzo}
                                      onChange={e => setImportItems(prev => prev.map((it, i) => i === idx ? { ...it, prezzo: parseFloat(e.target.value) || 0 } : it))}
                                      className={`w-20 rounded bg-transparent px-1 text-right font-bold focus:bg-slate-800/80 focus:outline-none ${isRincaro ? 'text-red-300' : isRibasso ? 'text-emerald-300' : 'text-slate-100'}`}
                                    />
                                  </td>
                                  <td className="px-3 py-2.5 text-center">
                                    {item.delta !== null ? (
                                      <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                        isRincaro ? 'bg-red-500/20 text-red-200'
                                        : isRibasso ? 'bg-emerald-500/20 text-emerald-200'
                                        : 'bg-slate-700/80 text-slate-400'
                                      }`}>
                                        {item.delta > 0 ? '▲' : '▼'} {Math.abs(item.delta).toFixed(1)}%
                                      </span>
                                    ) : item.isNew ? (
                                      <span className="text-[10px] font-semibold text-cyan-400/90">—</span>
                                    ) : (
                                      <span className="text-[10px] text-slate-600">—</span>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleImportSave}
                          disabled={importSaving || importItems.filter(i => i.selected).length === 0}
                          className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-colors"
                        >
                          {importSaving
                            ? 'Salvataggio…'
                            : `Salva ${importItems.filter(i => i.selected).length} prodotti`}
                        </button>
                        <button type="button" onClick={() => { setShowImport(false); setImportItems([]) }} className="rounded-lg px-4 py-2 text-xs font-medium text-slate-400 transition-colors hover:text-slate-200">
                          Annulla
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Add product inline form */}
          {showForm && (
            <div className="border-b border-cyan-500/25 bg-cyan-500/10 px-5 py-4">
              <p className="mb-3 text-xs font-semibold text-cyan-100">Nuovo prodotto / aggiornamento prezzo</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <div className="md:col-span-2">
                  <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500">Prodotto *</label>
                  <input
                    type="text"
                    value={formProdotto}
                    onChange={e => setFormProdotto(e.target.value)}
                    placeholder="es. Pomodori San Marzano"
                    className="w-full rounded-lg border border-slate-600/60 bg-slate-800/70 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500">Prezzo *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formPrezzo}
                    onChange={e => setFormPrezzo(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-slate-600/60 bg-slate-800/70 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500">Data prezzo *</label>
                  <input
                    type="date"
                    value={formData}
                    onChange={e => setFormData(e.target.value)}
                    className="w-full rounded-lg border border-slate-600/60 bg-slate-800/70 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                  />
                </div>
                <div className="md:col-span-4">
                  <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500">Note (opzionale)</label>
                  <input
                    type="text"
                    value={formNote}
                    onChange={e => setFormNote(e.target.value)}
                    placeholder="es. prezzo stagionale, promo, ecc."
                    className="w-full rounded-lg border border-slate-600/60 bg-slate-800/70 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                  />
                </div>
              </div>
              {saveError && (
                <p className="mt-2 text-xs text-red-300">{saveError}</p>
              )}
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !formProdotto.trim() || !formPrezzo || !formData}
                  className="rounded-lg bg-cyan-500 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving ? t.common.saving : t.common.save}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg px-4 py-2 text-xs font-medium text-slate-400 transition-colors hover:text-slate-200"
                >
                  {t.common.cancel}
                </button>
              </div>
            </div>
          )}

          {/* Empty state */}
          {Object.keys(listinoByProduct).length === 0 && !showForm && (
            <div className="px-5 py-10 text-center">
              <svg className="mx-auto mb-2 h-10 w-10 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-sm font-medium text-slate-400">{t.fornitori.listinoNoData}</p>
              <p className="mt-1 text-xs text-slate-500">{t.appStrings.clickAddFirst}</p>
            </div>
          )}

          {/* Product rows */}
          {Object.keys(listinoByProduct).length > 0 && (
            <div className="divide-y divide-slate-700/50">
              {Object.entries(listinoByProduct).map(([prodotto, prezzi]) => {
                const sorted = [...prezzi].sort((a, b) => a.data_prezzo.localeCompare(b.data_prezzo))
                const ultimo = sorted[sorted.length - 1]
                const penultimo = sorted.length > 1 ? sorted[sorted.length - 2] : null
                const delta = penultimo ? ultimo.prezzo - penultimo.prezzo : 0
                const pct   = penultimo ? (delta / penultimo.prezzo) * 100 : 0
                const isRincaro = delta > 0
                const isRibasso = delta < 0

                return (
                  <div key={prodotto} className="px-5 py-3.5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-100">{prodotto}</p>
                          {penultimo && (
                            <div className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              isRincaro ? 'bg-red-500/15 text-red-300' : isRibasso ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-800 text-slate-500'
                            }`}>
                              {isRincaro ? '▲' : isRibasso ? '▼' : '='} {Math.abs(pct).toFixed(1)}%
                            </div>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {sorted.map((p, i) => (
                            <span key={p.id} className="flex items-center gap-1">
                              <span className="text-[10px] text-slate-500">
                                {formatDateLib(p.data_prezzo, locale, timezone, { month: 'short', year: '2-digit' })}
                              </span>
                              <span className={`text-xs font-bold ${
                                i === sorted.length - 1 && isRincaro ? 'text-red-300' :
                                i === sorted.length - 1 && isRibasso ? 'text-emerald-300' :
                                'text-slate-300'
                              }`}>
                                £{p.prezzo.toFixed(2)}
                              </span>
                              {i < sorted.length - 1 && <span className="text-[10px] text-slate-600">→</span>}
                            </span>
                          ))}
                        </div>
                        {ultimo.note && <p className="mt-0.5 text-[10px] italic text-slate-500">{ultimo.note}</p>}
                      </div>

                      {/* Delete last entry button */}
                      <button
                        type="button"
                        onClick={() => handleDelete(ultimo.id)}
                        disabled={deletingId === ultimo.id}
                        title="Rimuovi ultimo prezzo"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-red-500/15 hover:text-red-400 disabled:opacity-40"
                      >
                        {deletingId === ultimo.id
                          ? <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                          : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        }
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : null}

      {/* ── Totali ── */}
      {rows.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { label: t.fornitori.listinoTotale, value: totale, cls: 'border-slate-700/50 bg-slate-900/90 text-slate-100' },
            { label: t.fornitori.listinoDaBolle, value: totBolle, cls: 'border-blue-500/30 bg-blue-500/10 text-blue-200' },
            { label: t.fornitori.listinoDaFatture, value: totFatture, cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' },
          ].map(({ label, value, cls }) => (
            <div
              key={label}
              className={`relative overflow-hidden rounded-xl border p-4 shadow-lg shadow-black/30 backdrop-blur-xl ${cls}`}
            >
              <div className="app-card-bar mb-3" aria-hidden />
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide opacity-80">{label}</p>
              <p className="text-xl font-bold tabular-nums">£{value.toFixed(2)}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Storico cronologico documenti ── */}
      {rows.length === 0 ? (
        <div className="app-card overflow-hidden px-6 py-16 text-center">
          <div className="app-card-bar" aria-hidden />
          <svg className="mx-auto mb-3 h-12 w-12 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-sm font-medium text-slate-400">{t.fornitori.listinoNoDocs}</p>
        </div>
      ) : (
        <div className="app-card overflow-hidden">
          <div className="app-card-bar" aria-hidden />
          <div className="flex items-center justify-between border-b border-slate-700/60 px-5 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t.fornitori.listinoStorico}</p>
            <p className="text-xs text-slate-500">{rows.length} {t.fornitori.listinoDocs}</p>
          </div>

          {/* Mobile */}
          <div className="divide-y divide-slate-700/50 md:hidden">
            {rows.map((r) => (
              <div key={`${r.tipo}-${r.id}`} className="flex min-h-[52px] items-center justify-between gap-3 px-4 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${r.tipo === 'fattura' ? 'bg-emerald-400' : 'bg-blue-400'}`} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-100">{formatDate(r.data)}</p>
                    {r.numero && <p className="text-[11px] text-slate-500">#{r.numero}</p>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    r.tipo === 'fattura' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-blue-500/15 text-blue-300'
                  }`}>
                    {r.tipo === 'fattura' ? t.fatture.title : t.bolle.title}
                  </span>
                  <span className="text-sm font-bold tabular-nums text-slate-100">£{(r.importo ?? 0).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop */}
          <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/60">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{t.fornitori.listinoColData}</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{t.fornitori.listinoColTipo}</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{t.fornitori.listinoColNumero}</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">{t.fornitori.listinoColImporto}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {rows.map((r) => (
                <tr key={`${r.tipo}-${r.id}`} className="transition-colors hover:bg-slate-800/40">
                  <td className="px-5 py-3.5 font-medium text-slate-200">{formatDate(r.data)}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                      r.tipo === 'fattura'
                        ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                        : 'border-blue-500/25 bg-blue-500/10 text-blue-300'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${r.tipo === 'fattura' ? 'bg-emerald-400' : 'bg-blue-400'}`} />
                      {r.tipo === 'fattura' ? t.fatture.title : t.bolle.title}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-500">{r.numero ?? '—'}</td>
                  <td className="px-5 py-3.5 text-right text-base font-bold tabular-nums text-slate-100">£{(r.importo ?? 0).toFixed(2)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-700/60 bg-slate-800/30">
                <td colSpan={3} className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{t.fornitori.listinoColTotale}</td>
                <td className="px-5 py-3 text-right text-base font-bold tabular-nums text-slate-100">£{totale.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
          </div>
        </div>
      )}
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
  currency,
  reloadFornitore,
}: {
  fornitore: Fornitore
  bolleCount: number
  fattureCount: number
  pendingCount: number
  countryCode: string
  currency?: string
  reloadFornitore?: () => void
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const tabParam = searchParams.get('tab')
  const tab = useMemo((): Tab => {
    if (
      tabParam === 'dashboard' ||
      tabParam === 'bolle' ||
      tabParam === 'fatture' ||
      tabParam === 'listino' ||
      tabParam === 'documenti' ||
      tabParam === 'verifica'
    ) {
      return tabParam
    }
    return 'dashboard'
  }, [tabParam])

  const setTab = useCallback(
    (next: Tab) => {
      if (next === tab) return
      const q = new URLSearchParams(searchParams.toString())
      if (next === 'dashboard') q.delete('tab')
      else q.set('tab', next)
      const qs = q.toString()
      const url = qs ? `${pathname}?${qs}` : pathname
      // push (non replace): Indietro del browser torna alla scheda precedente, come “cartella → file”.
      router.push(url, { scroll: false })
    },
    [pathname, router, searchParams, tab]
  )

  const t = useT()
  const { locale, timezone } = useLocale()
  const loc = getLocale(countryCode)
  const { me } = useMe()
  const { runEmailSync, progress: emailSyncProgress } = useEmailSyncProgress()
  const supplierSyncDisabled = !fornitore.sede_id || emailSyncProgress.active
  const syncThisSupplier = () => {
    void runEmailSync({
      fornitore_id: fornitore.id,
      user_sede_id: me?.sede_id ?? fornitore.sede_id ?? undefined,
    })
  }
  // ── Shared month/year filter ───────────────────────────────────────
  const now = new Date()
  const [filterYear,  setFilterYear]  = useState(now.getFullYear())
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1)

  const shiftMonth = (delta: number) => {
    setFilterMonth(prev => {
      const newMonth = prev + delta
      if (newMonth < 1)  { setFilterYear(y => y - 1); return 12 }
      if (newMonth > 12) { setFilterYear(y => y + 1); return 1  }
      return newMonth
    })
  }

  const monthYearLabel = formatDateLib(
    `${filterYear}-${String(filterMonth).padStart(2, '0')}-15`,
    locale,
    timezone,
    { month: 'long', year: 'numeric' }
  )
  const isCurrentMonth = filterYear === now.getFullYear() && filterMonth === now.getMonth() + 1

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'dashboard', label: t.fornitori.tabRiepilogo },
    { id: 'bolle',     label: t.nav.bolle,              badge: bolleCount },
    { id: 'fatture',   label: t.nav.fatture,            badge: fattureCount },
    { id: 'listino',   label: t.fornitori.tabListino },
    { id: 'documenti', label: t.statements.tabDocumenti, badge: pendingCount > 0 ? pendingCount : undefined },
    { id: 'verifica',  label: t.statements.tabVerifica },
  ]

  // Initials for avatar
  const initials = fornitore.nome.split(/\s+/).slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()

  const { stats: periodStats, loading: periodStatsLoading } = useSupplierPeriodStats(fornitore.id, filterYear, filterMonth)

  const TabContent = () => (
    <>
      {tab === 'dashboard' && (
        <DashboardTab
          fornitoreId={fornitore.id}
          fornitore={fornitore}
          periodStats={periodStats}
          periodStatsLoading={periodStatsLoading}
          filterYear={filterYear}
          filterMonth={filterMonth}
          onFornitoreReload={reloadFornitore}
        />
      )}
      {tab === 'bolle'     && <BolleTab fornitoreId={fornitore.id} year={filterYear} month={filterMonth} />}
      {tab === 'fatture'   && <FattureTab fornitoreId={fornitore.id} year={filterYear} month={filterMonth} />}
      {tab === 'listino'   && <ListinoTab fornitoreId={fornitore.id} />}
      {tab === 'documenti' && <PendingMatchesTab fornitoreId={fornitore.id} countryCode={countryCode} currency={currency} year={filterYear} month={filterMonth} />}
      {tab === 'verifica'  && <VerificationStatusTab fornitoreId={fornitore.id} countryCode={countryCode} currency={currency} year={filterYear} month={filterMonth} />}
    </>
  )

  const activeTabInfo = tabs.find((tb) => tb.id === tab)!

  return (
    <>
      {/* ══ MOBILE (< md): padding basso gestito da AppShell (`showsMobileBottomBar`) ══ */}
      <div className="md:hidden px-4 pb-6">
        <div className="app-card mb-4 mt-2 overflow-hidden">
          <div className="app-card-bar" aria-hidden />
          <div className="flex flex-col gap-2 px-3 py-2.5">
            <h1 className="text-sm font-semibold leading-snug text-slate-100">{fornitore.nome}</h1>
            <button
              type="button"
              onClick={syncThisSupplier}
              disabled={supplierSyncDisabled}
              title={!fornitore.sede_id ? t.fornitori.syncEmailNeedSede : undefined}
              className="inline-flex min-h-[44px] w-full touch-manipulation items-center justify-center gap-2 rounded-xl bg-cyan-500/90 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {emailSyncProgress.active ? (
                <svg className="h-4 w-4 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : (
                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              {t.dashboard.syncEmail}
            </button>
          </div>
        </div>

        <header className="sticky top-0 z-[5] -mx-4 mb-3 border-b border-slate-700/70 bg-slate-950/90 px-4 py-3 backdrop-blur-md supports-backdrop-filter:bg-slate-950/80">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="mobile-supplier-tab-title" className="text-lg font-bold leading-tight tracking-tight text-slate-100">
              {activeTabInfo.label}
            </h2>
            {activeTabInfo.badge != null && activeTabInfo.badge > 0 && (
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-bold tabular-nums text-slate-300">
                {activeTabInfo.badge > 99 ? '99+' : activeTabInfo.badge}
              </span>
            )}
          </div>
        </header>

        <TabContent />
      </div>

      {/* ══ DESKTOP layout (md+) ═════════════════════════════════════ */}
      <div className="hidden md:block">

        {/* ── Horizontal header bar ── */}
        <div className="bg-slate-950 px-6 pt-3 pb-0">
          {/* Identity + stats + actions — all in one row */}
          <div className="flex items-center gap-4 pb-3 border-b border-white/10">
            {/* Avatar */}
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-sm font-bold text-white shrink-0">
              {initials}
            </div>

            {/* Name / email */}
            <div className="min-w-0 flex-1">
              <h1 className="text-sm font-bold text-white truncate leading-tight">{fornitore.nome}</h1>
              {fornitore.email && <p className="text-[11px] text-slate-400 truncate mt-0.5">{fornitore.email}</p>}
            </div>

            {/* Stat pills */}
            <div className="flex items-center gap-1.5 shrink-0">
              {[
                { label: t.nav.bolle,           value: bolleCount },
                { label: t.nav.fatture,          value: fattureCount },
                { label: t.fornitori.kpiPending, value: pendingCount, warn: pendingCount > 0 },
              ].map(k => (
                <div key={k.label} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold ${k.warn ? 'bg-amber-400/10 border-amber-400/20 text-amber-300' : 'bg-white/5 border-white/10 text-slate-300'}`}>
                  <span className="font-bold tabular-nums">{k.value}</span>
                  <span className="text-[10px] opacity-60 hidden xl:inline">{k.label}</span>
                </div>
              ))}
            </div>

            {/* Divider */}
            <div className="w-px h-6 bg-white/10 shrink-0" />

            {/* Month/year navigator */}
            <div className="flex items-center gap-1 shrink-0 bg-white/5 border border-white/10 rounded-lg px-1 py-1">
              <button onClick={() => shiftMonth(-1)}
                className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 rounded transition-colors">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <span className="text-[11px] font-semibold text-slate-200 tabular-nums min-w-[72px] text-center">
                {monthYearLabel}
              </span>
              <button onClick={() => shiftMonth(1)} disabled={isCurrentMonth}
                className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
              </button>
              {!isCurrentMonth && (
                <button onClick={() => { setFilterYear(now.getFullYear()); setFilterMonth(now.getMonth() + 1) }}
                  title={t.appStrings.monthNavResetTitle}
                  className="w-6 h-6 flex items-center justify-center text-cyan-400 hover:text-cyan-300 hover:bg-white/10 rounded transition-colors">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 12a9 9 0 1018 0 9 9 0 00-18 0m9-4v4l3 3" /></svg>
                </button>
              )}
            </div>

            {/* Divider */}
            <div className="w-px h-6 bg-white/10 shrink-0" />

            {/* Action buttons */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={syncThisSupplier}
                disabled={supplierSyncDisabled}
                title={!fornitore.sede_id ? t.fornitori.syncEmailNeedSede : undefined}
                className="flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 py-2 text-xs font-bold text-cyan-100 transition-colors hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {emailSyncProgress.active ? (
                  <svg className="h-3.5 w-3.5 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden>
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
                {t.dashboard.syncEmail}
              </button>
              <Link href={`/bolle/new?fornitore_id=${fornitore.id}`}
                className="flex items-center gap-1.5 px-3 py-2 bg-cyan-500 hover:bg-cyan-400 text-white text-xs font-bold rounded-lg transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                {t.nav.nuovaBolla}
              </Link>
              <Link href={`/fatture/new?fornitore_id=${fornitore.id}`}
                className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold rounded-lg transition-colors border border-white/10">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                {t.fatture.new}
              </Link>
              <Link href={`/fornitori/${fornitore.id}/edit`} title={t.fornitori.editTitle}
                className="p-2 text-slate-400 hover:text-slate-200 hover:bg-white/10 rounded-lg transition-colors border border-white/10">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              </Link>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex gap-0.5">
            {tabs.map(tb => (
              <button key={tb.id} onClick={() => setTab(tb.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold transition-all border-b-2 -mb-px ${
                  tab === tb.id
                    ? 'text-white border-cyan-400'
                    : 'text-slate-400 border-transparent hover:text-slate-200'
                }`}
              >
                {tb.label}
                {tb.badge !== undefined && tb.badge > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    tab === tb.id
                      ? tb.id === 'documenti' ? 'bg-amber-400/20 text-amber-300' : 'bg-cyan-400/20 text-cyan-300'
                      : 'bg-white/10 text-slate-400'
                  }`}>
                    {tb.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content — KPI desktop sempre visibili (stesso periodo del navigatore mese) */}
        <div className="min-h-[calc(100vh-8rem)]">
          <div className="mx-auto max-w-6xl p-5">
            <SupplierDesktopKpiGrid loading={periodStatsLoading} stats={periodStats} onTabChange={setTab} />
            <TabContent />
          </div>
        </div>
      </div>
    </>
  )
}

/* ─── Page entry point ───────────────────────────────────────────── */
export default function FornitoreDetailPage() {
  const id = segmentParam(useParams().id)
  const router = useRouter()

  const [fornitore, setFornitore] = useState<Fornitore | null>(null)
  const [bolleCount, setBolleCount] = useState(0)
  const [fattureCount, setFattureCount] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)
  const [countryCode, setCountryCode] = useState('UK')
  const [sedeCurrency, setSedeCurrency] = useState('GBP')
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
        ? supabase.from('sedi').select('country_code, currency').eq('id', data.sede_id).single()
        : Promise.resolve({ data: null }),
    ])

    setBolleCount(bolleRes.count ?? 0)
    setFattureCount(fattureRes.count ?? 0)
    setPendingCount(Array.isArray(pendingRes) ? pendingRes.length : 0)
    const sedeData = sedeRes.data as { country_code?: string; currency?: string } | null
    setCountryCode(sedeData?.country_code ?? 'UK')
    setSedeCurrency(sedeData?.currency ?? 'GBP')
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) {
    const shellAccents = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#14b8a6', '#0ea5e9'] as const
    return (
      <div className="mx-auto max-w-6xl p-4 pb-6 md:p-5">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-48 rounded bg-slate-700/80" />
          <div className="h-8 w-72 rounded bg-slate-700/80" />
          <div className="h-10 w-64 rounded bg-slate-700/80" />
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="app-card h-28 overflow-hidden border-l-4 p-4"
                style={{ borderLeftColor: shellAccents[i] }}
              >
                <div className="app-card-bar mb-2" aria-hidden />
                <div className="h-3 w-2/3 rounded bg-slate-700/80" />
                <div className="mt-3 h-6 w-1/2 rounded bg-slate-700/80" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (notFound || !fornitore) {
    return (
      <div className="max-w-5xl p-4 py-20 text-center md:p-8">
        <p className="mb-3 font-medium text-slate-400">Fornitore non trovato.</p>
        <button type="button" onClick={() => router.push('/fornitori')}
          className="text-sm font-medium text-cyan-400 hover:underline">
          ← Torna ai fornitori
        </button>
      </div>
    )
  }

  return (
    <Suspense fallback={null}>
      <FornitoreDetailClient
        reloadFornitore={load}
        fornitore={fornitore}
        bolleCount={bolleCount}
        fattureCount={fattureCount}
        pendingCount={pendingCount}
        countryCode={countryCode}
        currency={sedeCurrency}
      />
    </Suspense>
  )
}
