'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { thumbnailUrl } from '@/lib/storage-transform'
import { getLocale, formatCurrency } from '@/lib/localization'
import { useMe } from '@/lib/me-context'
import { useLocale } from '@/lib/locale-context'
import { useToast } from '@/lib/toast-context'
import { useT } from '@/lib/use-t'
import { parseAnyAmount } from '@/lib/ocr-amount'
import { openDocumentUrl } from '@/lib/open-document-url'
import {
  findUniqueFornitoreForPendingDoc,
  greedyBollaIdsForTotal,
  normalizeAddressKey,
} from '@/lib/auto-resolve-pending-doc'
import { STATEMENTS_LAYOUT_REFRESH_EVENT } from '@/lib/statements-layout-refresh'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import StatementsSummaryHighlight from '@/components/StatementsSummaryHighlight'

/* ── Types ──────────────────────────────────────────────────── */
type OcrMetadata = {
  ragione_sociale:    string | null
  p_iva:              string | null
  indirizzo?:         string | null
  data_fattura:       string | null
  numero_fattura:     string | null
  totale_iva_inclusa: number | null
  /** Raw amount string as returned by GPT (e.g. "£1,234.56" or "1.234,56 €") */
  importo_raw?:       string | null
  /** Numeric format detected: 'dot' | 'comma' | 'plain' */
  formato_importo?:   'dot' | 'comma' | 'plain' | null
  matched_by:         'email' | 'alias' | 'domain' | 'piva' | 'unknown' | null
  /** User-selected tipo documento in coda (estratto vs bolla vs fattura vs ordine) */
  pending_kind?:      'statement' | 'bolla' | 'fattura' | 'ordine' | null
  bozza_id?:          string | null
  bozza_tipo?:        'bolla' | 'fattura' | null
  rekki_link?:        string | null
}

type Documento = {
  id: string
  created_at: string
  sede_id?: string | null
  fornitore_id: string | null
  mittente: string
  oggetto_mail: string | null
  file_url: string
  file_name: string | null
  content_type: string | null
  data_documento: string | null
  stato: 'in_attesa' | 'da_associare' | 'associato' | 'scartato' | 'bozza_creata'
  is_statement: boolean
  metadata?: OcrMetadata | null
  fornitore?: { nome: string; email?: string } | null
}

type BollaAperta = { id: string; data: string; importo: number | null; numero_bolla: string | null; fornitore_id: string; fornitore_nome: string }
type Fornitore   = { id: string; nome: string }

type BollaConFattura = {
  id: string
  data: string
  stato: string
  fornitore_id: string
  fattura: { id: string; data: string; file_url: string | null } | null
}
type SupplierGroup = { fornitore_id: string; nome: string; bolle: BollaConFattura[] }

/** Module-level formatter — used in contexts without React hooks. Always DD/MM/YYYY. */
function fmt(d: string | null, locale = 'it-IT', timezone?: string) {
  if (!d) return '—'
  try {
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit', month: '2-digit', year: 'numeric',
      ...(timezone ? { timeZone: timezone } : {}),
    }).format(new Date(d))
  } catch {
    return d
  }
}

/** React hook returning a locale/timezone-aware fmt function. */
function useFmt() {
  const { locale, timezone } = useLocale()
  const intlLocale =
    locale === 'it' ? 'it-IT'
    : locale === 'en' ? 'en-GB'
    : locale === 'es' ? 'es-ES'
    : locale === 'fr' ? 'fr-FR'
    : 'de-DE'
  return (d: string | null) => fmt(d, intlLocale, timezone)
}

function normalizeOcrCompanyKey(s: string | null | undefined): string {
  const t = s?.trim()
  if (!t) return ''
  return t
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

/* ── Tab selector ───────────────────────────────────────────── */
type Tab = 'pending' | 'status'

/** Named export so sede-specific and fornitore-specific wrapper pages can render with a fixed context. */
export function StatementsContent({
  sedeId,
  fornitoreId,
  countryCode,
  currency,
  section,
}: {
  sedeId?: string
  fornitoreId?: string
  countryCode?: string
  currency?: string
  /** Set on `/statements/da-processare` and `/statements/verifica` — layout supplies header and scheda nav. */
  section?: Tab
}) {
  const [tab, setTab] = useState<Tab>('pending')
  const t = useT()

  const showPageHeader = !fornitoreId && section === undefined
  const showSwitcher = section === undefined
  const active: Tab = section ?? tab

  const wrapperClass =
    fornitoreId ? '' : section !== undefined ? 'w-full min-w-0' : 'w-full min-w-0 p-4 md:p-8'

  return (
    <div className={wrapperClass}>
      {showPageHeader && (
        <>
          <AppPageHeaderStrip>
            <div className="min-w-0 sm:flex-1 sm:flex-initial">
              <h1 className="app-page-title text-2xl font-bold">{t.statements.heading}</h1>
            </div>
          </AppPageHeaderStrip>
          <StatementsSummaryHighlight
            sedeId={sedeId}
            tabMode="tabs"
            activeTab={active}
            onTabChange={setTab}
          />
        </>
      )}

      {showSwitcher && (
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 mb-6" style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
          <div className="flex w-max flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setTab('pending')}
              className={`min-h-[44px] rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap touch-manipulation ${
                tab === 'pending'
                  ? 'border-slate-500/50 bg-slate-700/95 text-slate-100 shadow-sm'
                  : 'border-slate-700/60 bg-slate-700/70 text-slate-200 hover:border-slate-600 hover:bg-slate-700 hover:text-slate-200 active:bg-slate-700/90'
              }`}
            >
              {t.statements.tabDocumenti}
            </button>
            <button
              type="button"
              onClick={() => setTab('status')}
              className={`min-h-[44px] rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap touch-manipulation ${
                tab === 'status'
                  ? 'border-slate-500/50 bg-slate-700/95 text-slate-100 shadow-sm'
                  : 'border-slate-700/60 bg-slate-700/70 text-slate-200 hover:border-slate-600 hover:bg-slate-700 hover:text-slate-200 active:bg-slate-700/90'
              }`}
            >
              {t.statements.tabVerifica}
            </button>
          </div>
        </div>
      )}

      {active === 'pending'
        ? <PendingMatchesTab sedeId={sedeId} fornitoreId={fornitoreId} countryCode={countryCode} currency={currency} />
        : <VerificationStatusTab sedeId={sedeId} fornitoreId={fornitoreId} countryCode={countryCode} currency={currency} />}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   Popup "Edit Supplier"
   ══════════════════════════════════════════════════════════════ */
function EditSupplierPopup({
  docId, current, fornitori, onSaved, onClose, onError,
}: {
  docId: string
  current: string | null
  fornitori: Fornitore[]
  onSaved: (
    fornitoreId: string,
    nome: string,
    extra?: { suggestRemember?: boolean; mittenteEmail?: string | null }
  ) => void
  onClose: () => void
  onError?: (message: string) => void
}) {
  const t = useT()
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const filtered = fornitori.filter(f => f.nome.toLowerCase().includes(search.toLowerCase()))

  async function pick(f: Fornitore) {
    setSaving(true)
    const res = await fetch('/api/documenti-da-processare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: docId, azione: 'aggiorna_fornitore', fornitore_id: f.id }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      suggestRememberAssociation?: boolean
      mittenteEmail?: string | null
      error?: string
    }
    let extra: { suggestRemember?: boolean; mittenteEmail?: string | null } | undefined
    if (data.suggestRememberAssociation && data.mittenteEmail) {
      extra = { suggestRemember: true, mittenteEmail: data.mittenteEmail }
    }
    setSaving(false)
    if (res.ok) {
      onSaved(f.id, f.nome, extra)
      onClose()
    } else {
      onError?.(data.error?.trim() || t.statements.supplierLinkFailed)
    }
  }

  return (
    <div ref={ref} className="absolute left-0 top-full z-30 mt-1 w-64 overflow-hidden rounded-xl border border-slate-600/50 bg-slate-700/95 shadow-lg backdrop-blur-md">
      <div className="app-card-bar" aria-hidden />
      <div className="border-b border-slate-700/50 p-2">
        <input
          autoFocus value={search} onChange={e => setSearch(e.target.value)}
          placeholder={t.nav.cerca}
          className="w-full rounded-lg border border-slate-600/50 bg-slate-700/50 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
        />
      </div>
      <ul className="max-h-52 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <li className="px-3 py-2 text-xs text-slate-400">{t.nav.nessunRisultato}</li>
        ) : filtered.map(f => (
          <li key={f.id}>
            <button disabled={saving} onClick={() => pick(f)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-700/60 transition-colors ${f.id === current ? 'font-semibold text-cyan-400' : 'text-slate-200'}`}>
              {f.nome}{f.id === current && <span className="ml-1 text-[10px] text-cyan-400">✓</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   AI Data Card — mostra i dati estratti dall'OCR
   ══════════════════════════════════════════════════════════════ */
function buildNewFornitoreHref(opts: {
  ragione_sociale?: string | null
  p_iva?: string | null
  indirizzo?: string | null
  sedeId?: string | null
  mittente?: string | null
}): string {
  const params = new URLSearchParams()
  const nome = opts.ragione_sociale?.trim()
  const piva = opts.p_iva?.trim()
  const indirizzo = opts.indirizzo?.trim()
  const sede = opts.sedeId?.trim()
  if (nome) params.set('prefill_nome', nome)
  if (piva) params.set('prefill_piva', piva)
  if (indirizzo) params.set('prefill_indirizzo', indirizzo)
  if (sede) params.set('prefill_sede_id', sede)
  const m = opts.mittente?.trim().toLowerCase()
  if (m?.includes('@')) {
    params.set('remember_mittente', m)
    params.set('prefill_email', m)
  }
  const qs = params.toString()
  return `/fornitori/new${qs ? `?${qs}` : ''}`
}

function AiDataCard({
  metadata,
  countryCode,
  currency,
  onAssociateSupplier,
  fornitoreId,
  newFornitoreSedeId,
  mittenteForRemember,
}: {
  metadata: OcrMetadata
  countryCode?: string
  currency?: string
  /** When OCR did not match a supplier, opens the supplier picker (same as header pencil). */
  onAssociateSupplier?: () => void
  /** Se valorizzato, il fornitore è già collegato al documento: non mostrare «Non associato» solo perché matched_by è unknown. */
  fornitoreId?: string | null
  /** Sede per `prefill_sede_id` su /fornitori/new (doc o contesto lista). */
  newFornitoreSedeId?: string | null
  /** Email mittente per `remember_mittente` dopo creazione. */
  mittenteForRemember?: string | null
}) {
  const loc = getLocale(countryCode)
  const t = useT()
  const formatD = useFmt()
  const { currency: ctxCurrency } = useLocale()
  const resolvedCurrency = currency ?? ctxCurrency ?? loc.currency ?? 'EUR'

  // ── OCR amount format badge + toggle ──────────────────────
  const hasRaw = !!(metadata.importo_raw && metadata.totale_iva_inclusa !== null)
  // forcedFormat: null = use detected, 'dot'/'comma' = user override
  const [forcedFormat, setForcedFormat] = useState<'dot' | 'comma' | null>(null)

  // Compute displayed amount, possibly with forced re-interpretation
  const displayedAmount = (() => {
    if (metadata.totale_iva_inclusa === null) return null
    if (!forcedFormat || !metadata.importo_raw) return metadata.totale_iva_inclusa
    // Re-parse the raw string with the forced convention
    const raw = metadata.importo_raw.replace(/[£€$¥₹\s]/g, '').trim()
    if (forcedFormat === 'comma') {
      // treat dot as thousands sep, comma as decimal: "1.234,56"
      return parseAnyAmount(raw.replace(/\./g, '').replace(',', '.'))
    } else {
      // treat comma as thousands sep, dot as decimal: "1,234.56"
      return parseAnyAmount(raw.replace(/,/g, ''))
    }
  })()

  // Format badge label
  const detectedFmt = forcedFormat ?? metadata.formato_importo ?? null
  const fmtBadgeLabel = hasRaw ? (() => {
    const standard = detectedFmt === 'comma' ? 'EU (1.234,56)' : detectedFmt === 'dot' ? 'UK (1,234.56)' : null
    return standard ? `Parsed as ${standard}` : null
  })() : null

  const confidenceLabel: Record<string, { label: string; cls: string }> = {
    email:   { label: `${t.common.matched} (email)`,      cls: 'text-emerald-200 bg-emerald-500/20 ring-1 ring-emerald-500/35' },
    alias:   { label: `${t.common.matched} (alias)`,      cls: 'text-emerald-200 bg-emerald-500/20 ring-1 ring-emerald-500/35' },
    domain:  { label: `${t.common.matched} (domain)`,     cls: 'text-cyan-200 bg-cyan-500/20 ring-1 ring-cyan-500/35' },
    piva:    { label: `${t.common.matched} (${loc.vat})`, cls: 'text-violet-200 bg-violet-500/20 ring-1 ring-violet-500/35' },
    unknown: { label: t.common.notMatched,                 cls: 'text-amber-200 bg-amber-500/20 ring-1 ring-amber-500/35' },
  }
  const supplierLinked = Boolean(fornitoreId)
  const linkedConf = {
    label: t.common.recordSupplierLinked,
    cls: 'text-emerald-200 bg-emerald-500/20 ring-1 ring-emerald-500/35',
  } as const
  const conf = supplierLinked
    ? linkedConf
    : (confidenceLabel[metadata.matched_by ?? 'unknown'] ?? confidenceLabel.unknown)
  const isUnmatched = !supplierLinked && (metadata.matched_by ?? 'unknown') === 'unknown'
  const showCreateSupplier = Boolean(isUnmatched && onAssociateSupplier)
  const newFornitoreHref = showCreateSupplier
    ? buildNewFornitoreHref({
        ragione_sociale: metadata.ragione_sociale,
        p_iva: metadata.p_iva,
        indirizzo: metadata.indirizzo,
        sedeId: newFornitoreSedeId,
        mittente: mittenteForRemember,
      })
    : ''

  const matchControl = isUnmatched && onAssociateSupplier ? (
    <button
      type="button"
      onClick={onAssociateSupplier}
      title={t.statements.editSupplierTitle}
      className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold transition-colors hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 active:scale-[0.98] ${conf.cls}`}
    >
      {conf.label}
    </button>
  ) : (
    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${conf.cls}`}>{conf.label}</span>
  )

  return (
    <div className="mx-1 mt-2 overflow-hidden rounded-xl border border-violet-400/40 bg-slate-800/85 ring-1 ring-inset ring-violet-500/15">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-violet-500/30 bg-violet-950/50 px-3 py-2">
        <svg className="h-3.5 w-3.5 shrink-0 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-violet-200">{t.common.aiExtracted}</span>
        <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-1.5">
          {showCreateSupplier && newFornitoreHref && (
            <Link
              href={newFornitoreHref}
              className="shrink-0 rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2 py-1 text-[10px] font-semibold text-emerald-100 transition-colors hover:bg-emerald-500/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
            >
              {t.statements.btnCreateSupplierFromAi}
            </Link>
          )}
          {matchControl}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 px-3 py-2.5 text-xs">
        {metadata.ragione_sociale && (
          <div className="col-span-2">
            <span className="text-slate-300">{t.common.company} · </span>
            <span className="font-medium text-slate-100">{metadata.ragione_sociale}</span>
          </div>
        )}
        {metadata.p_iva && (
          <div>
            <span className="text-slate-300">{loc.vatLabel} · </span>
            <span className="font-mono font-medium text-slate-100">{metadata.p_iva}</span>
          </div>
        )}
        {metadata.indirizzo?.trim() && (
          <div className="col-span-2">
            <span className="text-slate-300">{t.fornitori.addressLabel} · </span>
            <span className="font-medium text-slate-100">{metadata.indirizzo}</span>
          </div>
        )}
        {metadata.numero_fattura && (
          <div>
            <span className="text-slate-300">{t.common.invoiceNum} · </span>
            <span className="font-medium text-slate-100">{metadata.numero_fattura}</span>
          </div>
        )}
        {metadata.data_fattura && (
          <div>
            <span className="text-slate-300">{t.statements.colDate} · </span>
            <span className="font-medium text-slate-100">{formatD(metadata.data_fattura)}</span>
          </div>
        )}
        {displayedAmount !== null && displayedAmount !== undefined && (
          <div className="col-span-2">
            <span className="text-slate-300">{t.common.total} ({loc.vat} incl.) · </span>
            <span className="font-semibold text-slate-50">
              {formatCurrency(displayedAmount, countryCode, resolvedCurrency)}
            </span>
            {/* ── OCR format validation badge ── */}
            {fmtBadgeLabel && (
              <span className="ml-2 inline-flex items-center gap-1">
                <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${
                  forcedFormat
                    ? 'border-amber-500/40 bg-amber-500/15 text-amber-200'
                    : 'border-slate-600 bg-slate-700 text-slate-200'
                }`}>
                  {fmtBadgeLabel}
                </span>
                <button
                  type="button"
                  title={t.statements.ocrFormatToggleTitle}
                  onClick={() => {
                    const cur = forcedFormat ?? metadata.formato_importo
                    setForcedFormat(cur === 'dot' ? 'comma' : 'dot')
                  }}
                  className="rounded border border-violet-500/40 px-1 py-0.5 text-[9px] leading-none text-violet-300 transition-colors hover:bg-violet-500/15"
                >
                  ⇄
                </button>
              </span>
            )}
            {/* Raw string hint (greyed out) */}
            {metadata.importo_raw && (
              <span className="ml-1 font-mono text-[9px] text-slate-400/90">({metadata.importo_raw})</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   Statement Panel — appears when a doc is marked as Statement
   Shows GRN vs Invoice comparison for the supplier/month
   ══════════════════════════════════════════════════════════════ */
function StatementPanel({ doc, onRequestMissing, countryCode }: {
  doc: Documento
  onRequestMissing: (bolle: BollaConFattura[]) => void
  countryCode?: string
}) {
  const t = useT()
  const formatD = useFmt()
  const MONTHS = t.statements.months
  const [bolle, setBolle] = useState<BollaConFattura[]>([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(() => {
    if (doc.data_documento) {
      const dt = new Date(doc.data_documento)
      return { year: dt.getFullYear(), month: dt.getMonth() + 1 }
    }
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() + 1 }
  })

  const fetchBolle = useCallback(async () => {
    if (!doc.fornitore_id) { setBolle([]); setLoading(false); return }
    setLoading(true)
    const supabase = createClient()
    const from = `${month.year}-${String(month.month).padStart(2,'0')}-01`
    const to   = new Date(month.year, month.month, 1).toISOString().split('T')[0]
    const { data } = await supabase
      .from('bolle')
      .select('id, data, stato, fornitore_id, fatture(id, data, file_url)')
      .eq('fornitore_id', doc.fornitore_id)
      .gte('data', from).lt('data', to)
      .order('data', { ascending: true })
    setBolle((data ?? []).map((b: {
      id: string; data: string; stato: string; fornitore_id: string;
      fatture: { id: string; data: string; file_url: string | null } | { id: string; data: string; file_url: string | null }[] | null
    }) => ({
      id: b.id, data: b.data, stato: b.stato, fornitore_id: b.fornitore_id,
      fattura: Array.isArray(b.fatture) ? (b.fatture[0] ?? null) : (b.fatture ?? null),
    })))
    setLoading(false)
  }, [doc.fornitore_id, month])

  useEffect(() => { fetchBolle() }, [fetchBolle])

  const missing = bolle.filter(b => !b.fattura)
  const matched = bolle.filter(b => b.fattura)
  const supplierEmail = (doc.fornitore as { email?: string } | null)?.email ?? null

  return (
    <div className="mx-1 mt-3 overflow-hidden rounded-xl border border-cyan-400/35 bg-slate-800/85 ring-1 ring-inset ring-cyan-500/12">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-500/25 bg-slate-900/40 px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {/* ClipboardCheck icon */}
          <svg className="h-4 w-4 shrink-0 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <span className="text-sm font-semibold text-slate-100">{t.statements.statementVerifyBanner}</span>
          <span className="truncate text-xs text-slate-200">
            — {(doc.fornitore as { nome: string } | null)?.nome ?? t.statements.unknownSupplier}
          </span>
        </div>
        {/* Month picker */}
        <div className="flex items-center gap-1.5">
          <select value={month.month} onChange={e => setMonth(p => ({ ...p, month: Number(e.target.value) }))}
            className="rounded-lg border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-slate-100 [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-cyan-500/40">
            {MONTHS.map((m,i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
          <select value={month.year} onChange={e => setMonth(p => ({ ...p, year: Number(e.target.value) }))}
            className="rounded-lg border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-slate-100 [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-cyan-500/40">
            {Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - i).map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-px bg-slate-900/50">
        {[
          { label: 'Bolle', value: bolle.length, color: 'text-slate-100' },
          { label: 'Fatture', value: matched.length, color: 'text-emerald-400' },
          { label: 'Differenza', value: missing.length, color: missing.length > 0 ? 'text-red-400' : 'text-emerald-400' },
        ].map(c => (
          <div key={c.label} className="bg-slate-800/90 px-4 py-3 text-center">
            <p className={`text-xl font-bold ${c.color}`}>{loading ? '—' : c.value}</p>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-300">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Checklist */}
      <div className="divide-y divide-slate-600/45 bg-slate-800/60">
        {loading ? (
          <p className="py-4 text-center text-xs text-slate-300">{t.common.loading}</p>
        ) : bolle.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-300">
            {t.fornitori.listinoNoDocs} — {t.statements.months[month.month-1]} {month.year}
          </p>
        ) : bolle.map(bolla => (
          <div key={bolla.id} className="flex items-center gap-3 px-4 py-2.5">
            <span className={`flex h-5 w-5 flex-none items-center justify-center rounded-full text-xs font-bold text-white ${bolla.fattura ? 'bg-emerald-500' : 'bg-red-500/90'}`}>
              {bolla.fattura ? '✓' : '✗'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-200">{t.nav.bolle} · {formatD(bolla.data)}</p>
              {bolla.fattura ? (
                <p className="text-xs text-emerald-400/90">{t.fatture.title} {formatD(bolla.fattura.data)}
                  {bolla.fattura.file_url && <> · <a href={openDocumentUrl({ fatturaId: bolla.fattura.id })} target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline hover:text-cyan-300">{t.fatture.apri}</a></>}
                </p>
              ) : (
                <p className="text-xs text-red-400">Fattura mancante</p>
              )}
            </div>
            {bolla.fattura ? (
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 ring-1 ring-emerald-500/30">Verificata</span>
            ) : (
              <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-semibold text-red-300 ring-1 ring-red-500/35">Discrepanza</span>
            )}
          </div>
        ))}
      </div>

      {/* Request Missing Documents button */}
      {!loading && missing.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-red-500/25 bg-red-950/35 px-4 py-3">
          <p className="text-xs font-medium text-red-200">{missing.length} fattura{missing.length > 1 ? 'e' : ''} mancante{missing.length > 1 ? 'i' : ''} in questo estratto</p>
          <button
            onClick={() => {
              const subject = encodeURIComponent(`Fatture mancanti — ${MONTHS[month.month-1]} ${month.year}`)
              const missingDates = missing.map(b => `- Bolla del ${fmt(b.data)}`).join('\n')
              const body = encodeURIComponent(
                `Gentile ${(doc.fornitore as { nome: string } | null)?.nome ?? 'Fornitore'},\n\nabbiamo verificato il vostro estratto conto mensile e riscontrato le seguenti fatture mancanti nei nostri archivi:\n\n${missingDates}\n\nPotreste gentilmente inviarci le relative fatture al più presto?\n\nGrazie.`
              )
              const email = supplierEmail ?? ''
              window.open(`mailto:${email}?subject=${subject}&body=${body}`)
              onRequestMissing(missing)
            }}
            className="flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-semibold rounded-lg transition-colors touch-manipulation"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Richiedi documenti mancanti
          </button>
        </div>
      )}
      {!loading && missing.length === 0 && bolle.length > 0 && (
        <div className="flex items-center gap-2 border-t border-emerald-500/25 bg-emerald-950/30 px-4 py-3">
          <svg className="h-4 w-4 shrink-0 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-xs font-medium text-emerald-200">{t.statements.allBolleInvoicedOk}</p>
        </div>
      )}

      {/* Statement total from AI vs number of matched invoices */}
      {!loading && doc.metadata?.totale_iva_inclusa !== null && doc.metadata?.totale_iva_inclusa !== undefined && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-violet-500/25 bg-violet-950/25 px-4 py-3">
          <div className="flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span className="text-xs font-medium text-violet-200">
              {t.statements.aiStatementTotalLabel} {formatCurrency(doc.metadata.totale_iva_inclusa, countryCode)}
            </span>
          </div>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            missing.length === 0 ? 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/35' : 'bg-red-500/20 text-red-200 ring-1 ring-red-500/35'
          }`}>
            {t.statements.statementLinkedBolleLine.replace(/\{matched\}/g, String(matched.length)).replace(/\{total\}/g, String(bolle.length))}
          </span>
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   TAB 1 — Pending Matches
   ══════════════════════════════════════════════════════════════ */
export function PendingMatchesTab({ sedeId, fornitoreId, countryCode, currency, year, month }: { sedeId?: string; fornitoreId?: string; countryCode?: string; currency?: string; year?: number; month?: number }) {
  const t = useT()
  const { me } = useMe()
  const { showToast } = useToast()
  const [docs, setDocs]                     = useState<Documento[]>([])
  const [loading, setLoading]               = useState(true)
  const [filter, setFilter]                 = useState<'in_attesa' | 'tutti'>('in_attesa')
  const [bolleAperte, setBolleAperte]       = useState<BollaAperta[]>([])
  const [fornitori, setFornitori]           = useState<Fornitore[]>([])
  const [selezione, setSelezione]           = useState<Record<string, string[]>>({})
  const [actions, setActions]               = useState<Record<string, 'idle'|'loading'|'done'|'error'>>({})
  const [preview, setPreview]               = useState<string | null>(null)
  const [editSupplier, setEditSupplier]     = useState<string | null>(null)
  const [statementDocs, setStatementDocs]   = useState<Set<string>>(new Set())  // tracked locally
  const [markingStatement, setMarkingStatement] = useState<string | null>(null)
  const [finalizingTipoId, setFinalizingTipoId] = useState<string | null>(null)
  const [rememberBar, setRememberBar] = useState<{
    fornitoreId: string
    email: string
  } | null>(null)

  const autoLinkTriedRef = useRef(new Set<string>())
  const autoAssocTriedRef = useRef(new Set<string>())

  const addressClusterPeersByDocId = useMemo(() => {
    const pendingLike = docs.filter(
      (d) =>
        d.stato === 'in_attesa' || d.stato === 'da_associare' || d.stato === 'bozza_creata',
    )
    const byKey = new Map<string, Documento[]>()
    for (const d of pendingLike) {
      const k = normalizeAddressKey(d.metadata?.indirizzo)
      if (!k) continue
      const list = byKey.get(k) ?? []
      list.push(d)
      byKey.set(k, list)
    }
    const out = new Map<string, string[]>()
    for (const group of byKey.values()) {
      if (group.length < 2) continue
      const nameKeys = new Set(
        group.map((g) => normalizeOcrCompanyKey(g.metadata?.ragione_sociale)).filter(Boolean),
      )
      if (nameKeys.size < 2) continue
      for (const d of group) {
        const seen = new Set<string>()
        const labels: string[] = []
        for (const x of group) {
          if (x.id === d.id) continue
          const raw = x.metadata?.ragione_sociale?.trim()
          if (!raw) continue
          const nk = normalizeOcrCompanyKey(raw)
          if (!nk || seen.has(nk)) continue
          seen.add(nk)
          labels.push(raw)
        }
        if (labels.length > 0) out.set(d.id, labels)
      }
    }
    return out
  }, [docs])

  const fetchDocs = useCallback(async () => {
    setLoading(true)
    // Use the server-side API (service client) to bypass RLS so that documents
    // with sede_id = NULL (global IMAP / unknown sender) are visible to all users.
    const params = new URLSearchParams()
    if (filter === 'in_attesa') params.set('stati', 'in_attesa,da_associare,bozza_creata')
    if (sedeId) params.set('sede_id', sedeId)
    if (fornitoreId) params.set('fornitore_id', fornitoreId)
    if (year && month) {
      params.set('from', `${year}-${String(month).padStart(2, '0')}-01`)
      params.set('to', new Date(year, month, 1).toISOString().split('T')[0])
    }
    const res = await fetch(`/api/documenti-da-processare?${params.toString()}`)
    const data = res.ok ? await res.json() : []
    setDocs((data ?? []).map((d: Record<string, unknown>) => ({ ...d, is_statement: (d.is_statement as boolean | null) ?? false })) as Documento[])
    setLoading(false)
  }, [filter, sedeId, fornitoreId, year, month])

  const fetchBolleAperte = useCallback(async () => {
    const parts: string[] = []
    if (sedeId) parts.push(`sede_id=${sedeId}`)
    if (fornitoreId) parts.push(`fornitore_id=${fornitoreId}`)
    const url = '/api/bolle-aperte' + (parts.length ? '?' + parts.join('&') : '')
    const res = await fetch(url)
    if (!res.ok) return
    const data = await res.json()
    setBolleAperte(
      (data ?? []).map((b: { id: string; data: string; importo: number | null; numero_bolla: string | null; fornitore_id: string; fornitori: { nome: string } | { nome: string }[] | null }) => ({
        id: b.id, data: b.data, importo: b.importo ?? null, numero_bolla: b.numero_bolla ?? null,
        fornitore_id: b.fornitore_id,
        fornitore_nome: (Array.isArray(b.fornitori) ? b.fornitori[0] : b.fornitori)?.nome ?? '—',
      }))
    )
  }, [sedeId, fornitoreId])

  const fetchFornitori = useCallback(async () => {
    const supabase = createClient()
    let effectiveSedeId = sedeId
    if (!effectiveSedeId && fornitoreId) {
      const { data: row } = await supabase.from('fornitori').select('sede_id').eq('id', fornitoreId).maybeSingle()
      effectiveSedeId = row?.sede_id ?? undefined
    }
    let q = supabase.from('fornitori').select('id, nome').order('nome')
    if (effectiveSedeId) q = q.eq('sede_id', effectiveSedeId) as typeof q
    const { data } = await q
    setFornitori(data ?? [])
  }, [sedeId, fornitoreId])

  useEffect(() => { fetchDocs(); fetchBolleAperte(); fetchFornitori() }, [fetchDocs, fetchBolleAperte, fetchFornitori])

  useEffect(() => {
    const onLayoutRefresh = () => {
      void fetchDocs()
      void fetchBolleAperte()
      void fetchFornitori()
    }
    window.addEventListener(STATEMENTS_LAYOUT_REFRESH_EVENT, onLayoutRefresh)
    return () => window.removeEventListener(STATEMENTS_LAYOUT_REFRESH_EVENT, onLayoutRefresh)
  }, [fetchDocs, fetchBolleAperte, fetchFornitori])

  // Auto-link fornitore from OCR / mittente when unambiguous in sede scope
  useEffect(() => {
    if (loading || !docs.length) return
    void (async () => {
      const supabase = createClient()
      const linkedSupplierNames: string[] = []
      for (const doc of docs) {
        if (doc.stato !== 'in_attesa' && doc.stato !== 'da_associare') continue
        if (doc.fornitore_id) continue
        if (autoLinkTriedRef.current.has(doc.id)) continue

        const match = await findUniqueFornitoreForPendingDoc(supabase, {
          docSedeId: doc.sede_id,
          fallbackSedeId: sedeId ?? null,
          profileSedeId: me?.sede_id ?? null,
          fornitoreFilterId: fornitoreId ?? null,
          metadata: doc.metadata,
          mittente: doc.mittente,
        })
        autoLinkTriedRef.current.add(doc.id)
        if (!match) continue

        const res = await fetch('/api/documenti-da-processare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: doc.id, azione: 'aggiorna_fornitore', fornitore_id: match.id }),
        })
        if (res.ok) {
          handleSupplierUpdated(doc.id, match.id, match.nome)
          linkedSupplierNames.push(match.nome)
        }
      }
      if (linkedSupplierNames.length === 1) {
        showToast(
          t.statements.autoLinkedSupplierOne.replace(/\{name\}/g, linkedSupplierNames[0]),
          'success',
        )
        await fetchDocs()
      } else if (linkedSupplierNames.length > 1) {
        showToast(
          t.statements.autoLinkedSupplierMany.replace(/\{count\}/g, String(linkedSupplierNames.length)),
          'success',
        )
        await fetchDocs()
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when queue changes; avoid re-running on every callback identity
  }, [loading, docs, sedeId, fornitoreId, me?.sede_id])

  // Auto-associa bolle when totale OCR matches a unique greedy subset (same heuristic as checkbox suggest)
  useEffect(() => {
    if (loading || !bolleAperte.length || !docs.length) return
    void (async () => {
      let didAssoc = false
      for (const doc of docs) {
        if (doc.stato !== 'in_attesa' && doc.stato !== 'da_associare') continue
        if (!doc.fornitore_id) continue
        if (doc.is_statement) continue
        if (doc.metadata?.pending_kind === 'ordine') continue
        const ocr = doc.metadata?.totale_iva_inclusa ?? null
        if (ocr == null || ocr <= 0) continue
        if (autoAssocTriedRef.current.has(doc.id)) continue

        const relevant = bolleAperte.filter((b) => b.fornitore_id === doc.fornitore_id && b.importo != null && b.importo > 0)
        if (!relevant.length) {
          autoAssocTriedRef.current.add(doc.id)
          continue
        }

        const ids = greedyBollaIdsForTotal(relevant, ocr)
        if (!ids?.length) continue

        autoAssocTriedRef.current.add(doc.id)
        const res = await fetch('/api/documenti-da-processare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: doc.id, azione: 'associa', bolla_ids: ids }),
        })
        if (res.ok) {
          setActions((p) => ({ ...p, [doc.id]: 'done' }))
          setSelezione((p) => ({ ...p, [doc.id]: ids }))
          didAssoc = true
        } else {
          let msg = t.statements.assignFailed
          try {
            const j = (await res.json()) as { error?: string }
            if (j.error?.trim()) msg = j.error.trim()
          } catch { /* ignore */ }
          showToast(msg, 'error')
        }
      }
      if (didAssoc) {
        setTimeout(() => {
          void fetchDocs()
          void fetchBolleAperte()
        }, 600)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, bolleAperte, docs])

  // Auto-suggest when both docs and bolle are loaded
  useEffect(() => {
    if (loading || !bolleAperte.length || !docs.length) return
    docs.forEach(doc => {
      if (doc.metadata?.pending_kind === 'ordine') return
      const ocrTotal = doc.metadata?.totale_iva_inclusa ?? null
      if (ocrTotal === null) return
      if ((selezione[doc.id] ?? []).length > 0) return  // already has selection
      const relevant = bolleAperte.filter(b => b.fornitore_id === doc.fornitore_id)
      if (!relevant.length) return
      autoSuggest(doc.id, relevant, ocrTotal)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, bolleAperte, docs])

  async function associa(docId: string) {
    const bollaIds = selezione[docId] ?? []
    if (!bollaIds.length) return
    setActions(p => ({ ...p, [docId]: 'loading' }))
    const res = await fetch('/api/documenti-da-processare', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: docId, azione: 'associa', bolla_ids: bollaIds }),
    })
    if (res.ok) {
      setActions(p => ({ ...p, [docId]: 'done' }))
      setTimeout(() => { fetchDocs(); fetchBolleAperte() }, 600)
    } else {
      setActions(p => ({ ...p, [docId]: 'error' }))
      let msg = t.statements.assignFailed
      try {
        const j = (await res.json()) as { error?: string }
        if (j.error?.trim()) msg = j.error.trim()
      } catch { /* ignore */ }
      showToast(msg, 'error')
    }
  }

  /** Auto-suggest bolle whose importi sum exactly to totalTarget (or closest subset) */
  function autoSuggest(docId: string, bolle: BollaAperta[], totalTarget: number | null) {
    if (!totalTarget || !bolle.length) return
    // Exact match: find subset summing to totalTarget (greedy subset-sum, max 10 items)
    const candidates = [...bolle].sort((a, b) => (b.importo ?? 0) - (a.importo ?? 0))
    const found: string[] = []
    let remaining = totalTarget
    for (const b of candidates) {
      const imp = b.importo ?? 0
      if (imp > 0 && imp <= remaining + 0.001) {
        found.push(b.id)
        remaining = parseFloat((remaining - imp).toFixed(2))
        if (remaining <= 0.001) break
      }
    }
    if (found.length) {
      setSelezione(p => ({ ...p, [docId]: found }))
    }
  }

  async function scarta(docId: string) {
    setActions(p => ({ ...p, [docId]: 'loading' }))
    const res = await fetch('/api/documenti-da-processare', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: docId, azione: 'scarta' }),
    })
    if (res.ok) {
      setActions(p => ({ ...p, [docId]: 'done' }))
      setTimeout(() => fetchDocs(), 600)
    } else {
      setActions(p => ({ ...p, [docId]: 'error' }))
    }
  }

  async function setPendingKind(docId: string, kind: 'statement' | 'bolla' | 'fattura' | 'ordine') {
    setMarkingStatement(docId)
    try {
      // Usa mark_statement + kind: compatibile con API vecchie (solo is_statement) e nuove (metadata.pending_kind).
      const res = await fetch('/api/documenti-da-processare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: docId,
          azione: 'mark_statement',
          is_statement: kind === 'statement',
          kind,
        }),
      })
      if (!res.ok) {
        let msg = t.statements.assignFailed
        try {
          const j = (await res.json()) as { error?: string }
          if (j.error?.trim()) msg = j.error.trim()
        } catch { /* ignore */ }
        showToast(msg, 'error')
        return
      }
      setDocs(prev =>
        prev.map(d => {
          if (d.id !== docId) return d
          const meta = { ...(d.metadata ?? {}), pending_kind: kind } as OcrMetadata
          return { ...d, is_statement: kind === 'statement', metadata: meta } as Documento
        })
      )
      setStatementDocs(prev => {
        const next = new Set(prev)
        if (kind === 'statement') next.add(docId)
        else next.delete(docId)
        return next
      })
    } finally {
      setMarkingStatement(null)
    }
  }

  function pendingKindForDoc(doc: Documento): 'statement' | 'bolla' | 'fattura' | 'ordine' | null {
    if (statementDocs.has(doc.id) || doc.is_statement) return 'statement'
    const pk = doc.metadata?.pending_kind
    if (pk === 'bolla' || pk === 'fattura' || pk === 'ordine') return pk
    return null
  }

  async function finalizzaTipo(docId: string) {
    setFinalizingTipoId(docId)
    try {
      // Usa `associa` + flag: stesso ramo API già presente su tutti i deploy (evita «Azione non valida» se manca il nome `finalizza_tipo`).
      const res = await fetch('/api/documenti-da-processare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: docId,
          azione: 'associa',
          finalizza_da_tipo: true,
          bolla_ids: [],
        }),
      })
      if (!res.ok) {
        let msg = t.statements.assignFailed
        try {
          const j = (await res.json()) as { error?: string }
          if (j.error?.trim()) msg = j.error.trim()
        } catch { /* ignore */ }
        showToast(msg, 'error')
        return
      }
      setTimeout(() => {
        void fetchDocs()
        void fetchBolleAperte()
      }, 400)
    } finally {
      setFinalizingTipoId(null)
    }
  }

  function handleSupplierUpdated(
    docId: string,
    fornitoreId: string,
    nome: string,
    extra?: { suggestRemember?: boolean; mittenteEmail?: string | null }
  ) {
    setDocs(prev => prev.map(d => d.id === docId ? { ...d, fornitore_id: fornitoreId, fornitore: { nome } } : d))
    if (extra?.suggestRemember && extra.mittenteEmail) {
      setRememberBar({ fornitoreId, email: extra.mittenteEmail })
    }
  }

  const isPdf = (url: string) => url.toLowerCase().includes('.pdf')
  const inAttesa = docs.filter(d => d.stato === 'in_attesa' || d.stato === 'da_associare').length
  const bozzeCreate = docs.filter(d => d.stato === 'bozza_creata').length

  return (
    <>
      {/* Header banner: bozze create automaticamente */}
      {bozzeCreate > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-emerald-100/95">
            <strong>{bozzeCreate} {bozzeCreate === 1 ? t.statements.bozzaCreataOne : t.statements.bozzeCreatePlural}</strong> {t.statements.bozzaBannerSuffix}
          </p>
        </div>
      )}

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button onClick={() => setFilter('in_attesa')}
            className={`min-h-[44px] rounded-lg px-3 py-2 text-xs font-medium transition-colors touch-manipulation ${
              filter === 'in_attesa'
                ? 'border border-orange-500/45 bg-orange-500/15 text-orange-50 shadow-[0_0_20px_-8px_rgba(249,115,22,0.35)]'
                : 'border border-transparent bg-slate-800/70 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}>
            {t.statements.tabPending} {inAttesa > 0 && <span className="ml-1 rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-slate-950">{inAttesa}</span>}
          </button>
          <button onClick={() => setFilter('tutti')}
            className={`min-h-[44px] rounded-lg px-3 py-2 text-xs font-medium transition-colors touch-manipulation ${
              filter === 'tutti'
                ? 'border border-slate-500/55 bg-slate-800/90 text-slate-50 ring-1 ring-white/5'
                : 'border border-transparent bg-slate-800/70 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}>
            {t.statements.tabAll}
          </button>
        </div>
        <p className="text-xs font-medium text-slate-300">{bolleAperte.length} {bolleAperte.length === 1 ? t.statements.bolleAperteOne : t.statements.bolleApertePlural}</p>
      </div>

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-md" onClick={() => setPreview(null)}>
          <div className="max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            {isPdf(preview)
              ? <iframe src={preview} className="w-full h-[80vh] rounded-xl" />
              : (
                <Image
                  src={preview}
                  alt=""
                  width={1200}
                  height={1600}
                  unoptimized
                  className="h-auto max-h-[80vh] w-full object-contain rounded-xl"
                />
              )}
            <button onClick={() => setPreview(null)} className="mt-3 w-full text-sm text-white/70 hover:text-white">{t.statements.btnClose}</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-slate-600/45 bg-slate-800/50 px-6 py-16 text-center">
          <p className="text-sm text-slate-300">{t.common.loading}</p>
        </div>
      ) : docs.length === 0 ? (
        <div className="rounded-xl border border-slate-600/45 bg-slate-800/50 px-6 py-16 text-center">
          <svg className="mx-auto mb-4 h-14 w-14 text-slate-400 opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm font-medium text-slate-300">
            {filter === 'in_attesa' ? t.statements.noPendingDocs : t.statements.noDocsFound}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {docs.map(doc => {
            const stato          = actions[doc.id] ?? 'idle'
            const isImage        = doc.content_type?.startsWith('image/')
            const thumb          = isImage ? thumbnailUrl(doc.file_url) : null
            const nomeFornitore  = (doc.fornitore as { nome: string } | null)?.nome ?? null
            const isUnknown      = !nomeFornitore
            const isStmt         = statementDocs.has(doc.id) || doc.is_statement
            const bolleSameSupplier = bolleAperte.filter(b => b.fornitore_id === doc.fornitore_id)
            const bolleOther        = bolleAperte.filter(b => b.fornitore_id !== doc.fornitore_id)

            return (
              <div
                key={doc.id}
                className={`overflow-hidden rounded-xl border transition-opacity ${
                  stato === 'done' ? 'opacity-[0.58] saturate-[0.85]' : ''
                } ${
                  doc.stato === 'associato'
                    ? 'border-emerald-500/40 bg-slate-800/70 shadow-[0_0_0_1px_rgba(16,185,129,0.08)]'
                    : doc.stato === 'da_associare'
                      ? 'border-cyan-500/35 bg-slate-800/65 shadow-[0_0_24px_-12px_rgba(34,211,238,0.12)]'
                      : 'border-slate-600/40 bg-slate-800/55 shadow-sm'
                }`}
              >
                <div className="flex gap-3 p-3 md:gap-3 md:p-3">
                  {/* Thumbnail */}
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch(openDocumentUrl({ documentoId: doc.id, json: true }))
                        const data = (await res.json()) as { url?: string }
                        if (res.ok && data.url) setPreview(data.url)
                      } catch {
                        /* ignore */
                      }
                    }}
                    className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-600/50 bg-slate-900/40 transition-opacity hover:opacity-80 md:h-10 md:w-10"
                  >
                    {thumb
                      ? (
                        <Image
                          src={thumb}
                          alt=""
                          width={64}
                          height={64}
                          unoptimized
                          className="h-full w-full object-cover"
                        />
                      )
                      : <svg className="h-7 w-7 text-slate-400 md:h-5 md:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                  </button>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <div className="relative flex min-w-0 items-center gap-1.5">
                        <p className={`truncate text-sm font-semibold ${isUnknown ? 'text-orange-200' : 'text-slate-100'}`}>
                          {nomeFornitore ?? `⚠ ${t.statements.unknownSender}`}
                        </p>
                        {(doc.stato === 'in_attesa' || doc.stato === 'da_associare') && (
                          <button onClick={() => setEditSupplier(editSupplier === doc.id ? null : doc.id)}
                            title={t.statements.editSupplierTitle}
                            className="shrink-0 rounded-md p-1 text-slate-300 transition-colors hover:bg-slate-700/80 hover:text-cyan-200">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                        )}
                        {editSupplier === doc.id && (
                          <EditSupplierPopup
                            docId={doc.id} current={doc.fornitore_id} fornitori={fornitori}
                            onSaved={(fId, nome) => handleSupplierUpdated(doc.id, fId, nome)}
                            onClose={() => setEditSupplier(null)}
                            onError={(msg) => showToast(msg, 'error')}
                          />
                        )}
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                        {/* Tipo documento: ordine / bolla / fattura / estratto (mutua esclusione, persistito su DB) */}
                        {(doc.stato === 'in_attesa' || doc.stato === 'da_associare') && (() => {
                          const pk = pendingKindForDoc(doc)
                          const busy = markingStatement === doc.id
                          const chips: {
                            kind: 'statement' | 'bolla' | 'fattura' | 'ordine'
                            label: string
                            title: string
                            activeCls: string
                          }[] = [
                            {
                              kind: 'ordine',
                              label: t.statements.docKindOrdine,
                              title: t.statements.docKindHintOrdine,
                              activeCls: 'border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-200',
                            },
                            {
                              kind: 'bolla',
                              label: t.statements.docKindBolla,
                              title: t.statements.docKindHintBolla,
                              activeCls: 'border-amber-500/40 bg-amber-500/15 text-amber-200',
                            },
                            {
                              kind: 'fattura',
                              label: t.statements.docKindFattura,
                              title: t.statements.docKindHintFattura,
                              activeCls: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200',
                            },
                            {
                              kind: 'statement',
                              label: t.statements.docKindEstratto,
                              title: t.statements.toggleAddStatement,
                              activeCls: 'border-cyan-500/40 bg-cyan-500/15 text-cyan-200',
                            },
                          ]
                          return (
                            <div className="flex flex-wrap items-center gap-1" role="group" aria-label={t.statements.docKindGroupAria}>
                              {chips.map(({ kind, label, title, activeCls }) => (
                                <button
                                  key={kind}
                                  type="button"
                                  disabled={busy}
                                  onClick={() => {
                                    if (pk !== kind) void setPendingKind(doc.id, kind)
                                  }}
                                  title={title}
                                  aria-pressed={pk === kind}
                                  className={`min-h-[28px] rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors touch-manipulation disabled:opacity-50 ${
                                    pk === kind ? activeCls : 'border-slate-500/55 bg-slate-900/45 text-slate-100 hover:border-slate-400/50 hover:bg-slate-800/90'
                                  }`}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          )
                        })()}
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${
                          doc.stato === 'bozza_creata'
                            ? 'bg-emerald-500/20 text-emerald-200 ring-emerald-500/35'
                            : (doc.stato === 'in_attesa' || doc.stato === 'da_associare')
                              ? 'bg-orange-500/20 text-orange-100 ring-orange-500/40'
                              : doc.stato === 'associato'
                                ? 'bg-emerald-500/25 text-emerald-100 ring-emerald-500/40'
                                : 'bg-slate-800/90 text-slate-200 ring-slate-600/60'
                        }`}>
                          {doc.stato === 'bozza_creata' ? t.statements.tagBozzaCreata
                            : (doc.stato === 'in_attesa' || doc.stato === 'da_associare') ? t.statements.tagPending
                            : doc.stato === 'associato' ? t.statements.tagAssociated
                            : t.statements.tagDiscarded}
                        </span>
                        {(doc.stato === 'in_attesa' || doc.stato === 'da_associare' || doc.stato === 'bozza_creata') && (
                          doc.fornitore_id ? (
                            <span className="rounded-full bg-emerald-600/25 px-2 py-0.5 text-[10px] font-semibold text-emerald-100 ring-1 ring-emerald-500/40" title={t.statements.badgeAiRecognized}>
                              {t.statements.badgeAiRecognized}
                            </span>
                          ) : (
                            <span className="rounded-full bg-orange-600/25 px-2 py-0.5 text-[10px] font-semibold text-orange-100 ring-1 ring-orange-500/40" title={t.statements.badgeNeedsHuman}>
                              {t.statements.badgeNeedsHuman}
                            </span>
                          )
                        )}
                        {doc.metadata?.rekki_link && /^https?:\/\//i.test(doc.metadata.rekki_link) && (
                          <a
                            href={doc.metadata.rekki_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-full bg-fuchsia-600/20 px-2 py-0.5 text-[10px] font-semibold text-fuchsia-200 ring-1 ring-fuchsia-500/35 hover:bg-fuchsia-600/30"
                          >
                            {t.statements.rekkiDocumentLink} ↗
                          </a>
                        )}
                      </div>
                    </div>

                    {(doc.stato === 'in_attesa' || doc.stato === 'da_associare') && pendingKindForDoc(doc) !== null && (
                      <div className="mb-2 mt-1 flex flex-wrap items-center gap-2">
                        {!doc.fornitore_id ? (
                          <p className="text-[11px] text-orange-200/95">{t.statements.finalizeNeedsSupplier}</p>
                        ) : (
                          <button
                            type="button"
                            disabled={finalizingTipoId === doc.id || (actions[doc.id] ?? 'idle') === 'loading'}
                            onClick={() => void finalizzaTipo(doc.id)}
                            className={`min-h-[36px] rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 touch-manipulation ${
                              pendingKindForDoc(doc) === 'ordine'
                                ? 'border-fuchsia-500/45 bg-fuchsia-500/15 text-fuchsia-100 hover:bg-fuchsia-500/25'
                                : 'border-emerald-500/45 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25'
                            }`}
                          >
                            {finalizingTipoId === doc.id
                              ? t.statements.btnFinalizing
                              : pendingKindForDoc(doc) === 'fattura'
                                ? t.statements.btnFinalizeFattura
                                : pendingKindForDoc(doc) === 'bolla'
                                  ? t.statements.btnFinalizeBolla
                                  : pendingKindForDoc(doc) === 'ordine'
                                    ? t.statements.btnFinalizeOrdine
                                    : t.statements.btnFinalizeStatement}
                          </button>
                        )}
                      </div>
                    )}

                    <p className="mb-0.5 truncate text-xs text-slate-300">{doc.oggetto_mail ?? doc.mittente}</p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                      <span>{t.statements.labelReceived} {fmt(doc.created_at)}</span>
                      {doc.data_documento && <span className="font-medium text-cyan-300">{t.statements.labelDocDate} {fmt(doc.data_documento)}</span>}
                      <a href={openDocumentUrl({ documentoId: doc.id })} target="_blank" rel="noopener noreferrer" className="text-cyan-300 hover:text-cyan-200 hover:underline">{t.statements.openFile}</a>
                      {doc.stato === 'bozza_creata' && doc.metadata?.bozza_id && (
                        <a
                          href={`/${doc.metadata.bozza_tipo === 'fattura' ? 'fatture' : 'bolle'}/${doc.metadata.bozza_id}`}
                          className="inline-flex items-center gap-1 font-semibold text-emerald-400 hover:text-emerald-300 hover:underline"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          {doc.metadata.bozza_tipo === 'fattura' ? t.statements.gotoFatturaDraft : t.statements.gotoBollaDraft}
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {addressClusterPeersByDocId.has(doc.id) &&
                  (doc.stato === 'in_attesa' || doc.stato === 'da_associare' || doc.stato === 'bozza_creata') && (
                  <div className="mx-3 mb-2 rounded-lg border border-cyan-500/35 bg-cyan-950/40 px-3 py-2 ring-1 ring-inset ring-cyan-400/10">
                    <p className="text-[11px] leading-snug text-cyan-50/95">
                      {t.statements.sameAddressClusterHint.replace(
                        /\{names\}/g,
                        addressClusterPeersByDocId.get(doc.id)!.join(' · '),
                      )}
                    </p>
                  </div>
                )}

                {/* AI Extracted Data card */}
                {doc.metadata && (doc.metadata.numero_fattura || doc.metadata.totale_iva_inclusa !== null || doc.metadata.ragione_sociale || doc.metadata.p_iva || doc.metadata.indirizzo?.trim()) && (
                  <div className="px-3 pb-2">
                    <AiDataCard
                      metadata={doc.metadata}
                      countryCode={countryCode}
                      currency={currency}
                      fornitoreId={doc.fornitore_id}
                      newFornitoreSedeId={doc.sede_id?.trim() || sedeId || null}
                      mittenteForRemember={doc.mittente}
                      onAssociateSupplier={
                        (doc.stato === 'in_attesa' || doc.stato === 'da_associare')
                          ? () => setEditSupplier(doc.id)
                          : undefined
                      }
                    />
                  </div>
                )}

                {/* Statement Panel: solo con fornitore (altrimenti la verifica mensile non ha senso) */}
                {isStmt && (doc.stato === 'in_attesa' || doc.stato === 'da_associare') && doc.fornitore_id && (
                  <div className="px-3 pb-3">
                    <StatementPanel doc={doc} onRequestMissing={() => {}} countryCode={countryCode} />
                  </div>
                )}

                {/* Match actions — multi-select. Se è «estratto» ma fornitore mancante, mostra comunque le bolle per poter associare e fissare il fornitore. Ordine: solo finalizza in header, niente bolle. */}
                {(doc.stato === 'in_attesa' || doc.stato === 'da_associare') &&
                  pendingKindForDoc(doc) !== 'ordine' &&
                  (!isStmt || !doc.fornitore_id) &&
                  (() => {
                  const selIds       = selezione[doc.id] ?? []
                  const ocrTotal     = doc.metadata?.totale_iva_inclusa ?? null
                  const selSum       = selIds.reduce((s, bid) => {
                    const b = bolleAperte.find(x => x.id === bid)
                    return s + (b?.importo ?? 0)
                  }, 0)
                  const diff         = ocrTotal !== null ? parseFloat((selSum - ocrTotal).toFixed(2)) : null
                  const hasSel       = selIds.length > 0
                  const loc          = getLocale(countryCode)
                  const rowCurrency  = currency ?? loc.currency ?? 'EUR'

                  const toggleBolla  = (bid: string) => {
                    setSelezione(p => {
                      const cur = p[doc.id] ?? []
                      return { ...p, [doc.id]: cur.includes(bid) ? cur.filter(x => x !== bid) : [...cur, bid] }
                    })
                  }

                  return (
                    <div className="px-3 pb-3 space-y-1.5">
                      {/* Bolle checkboxes grouped by supplier */}
                      {bolleAperte.length === 0 ? (
                        <p className="py-2 text-xs text-slate-400">{t.statements.noBolleAttesa}</p>
                      ) : (
                        <div className="divide-y divide-slate-600/45 overflow-hidden rounded-lg border border-slate-600/45 bg-slate-900/25">
                          {/* Auto-suggest button */}
                          {ocrTotal !== null && (bolleSameSupplier.length > 0 || bolleOther.length > 0) && (
                            <div className="flex items-center justify-between gap-2 bg-slate-900/40 px-3 py-2">
                              <span className="text-[11px] text-slate-200">
                                {t.statements.docTotalLabel} <span className="font-semibold text-slate-100">{formatCurrency(ocrTotal, countryCode, rowCurrency)}</span>
                              </span>
                              <button
                                onClick={() => autoSuggest(doc.id, [...bolleSameSupplier, ...bolleOther], ocrTotal)}
                                className="whitespace-nowrap rounded-md border border-cyan-500/40 bg-cyan-500/15 px-2 py-1 text-[10px] font-semibold text-cyan-200 transition-colors hover:bg-cyan-500/25"
                              >
                                ✦ Suggerisci auto
                              </button>
                            </div>
                          )}

                          {/* Same supplier bolle */}
                          {bolleSameSupplier.length > 0 && (
                            <>
                              <div className="bg-slate-900/55 px-3 py-1.5">
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                  {nomeFornitore ?? 'Stesso fornitore'} · {bolleSameSupplier.length} bolla{bolleSameSupplier.length !== 1 ? 'e' : ''}
                                </span>
                              </div>
                              {bolleSameSupplier.map(b => {
                                const checked = selIds.includes(b.id)
                                return (
                                  <label key={b.id} className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-slate-800/55 ${checked ? 'bg-cyan-500/12' : ''}`}>
                                    <input type="checkbox" checked={checked} onChange={() => toggleBolla(b.id)}
                                      className="h-4 w-4 cursor-pointer rounded border-slate-500 bg-slate-800 text-cyan-500 focus:ring-cyan-500/40" />
                                    <span className="flex-1 text-sm text-slate-200">
                                      {b.numero_bolla ? <span className="font-mono font-medium">#{b.numero_bolla}</span> : '—'}{' '}
                                      <span className="text-xs text-slate-400">· {fmt(b.data)}</span>
                                    </span>
                                    {b.importo !== null && (
                                      <span className={`text-sm font-semibold tabular-nums ${checked ? 'text-cyan-300' : 'text-slate-200'}`}>
                                        {formatCurrency(b.importo, countryCode, rowCurrency)}
                                      </span>
                                    )}
                                  </label>
                                )
                              })}
                            </>
                          )}

                          {/* Other supplier bolle */}
                          {bolleOther.length > 0 && (
                            <>
                              <div className="bg-slate-900/55 px-3 py-1.5">
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                  Altri fornitori · {bolleOther.length}
                                </span>
                              </div>
                              {bolleOther.map(b => {
                                const checked = selIds.includes(b.id)
                                return (
                                  <label key={b.id} className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-slate-800/55 ${checked ? 'bg-cyan-500/12' : ''}`}>
                                    <input type="checkbox" checked={checked} onChange={() => toggleBolla(b.id)}
                                      className="h-4 w-4 cursor-pointer rounded border-slate-500 bg-slate-800 text-cyan-500 focus:ring-cyan-500/40" />
                                    <span className="flex-1 text-sm text-slate-200">
                                      <span className="text-[11px] text-slate-400">{b.fornitore_nome} · </span>
                                      {b.numero_bolla ? <span className="font-mono font-medium">#{b.numero_bolla}</span> : '—'}{' '}
                                      <span className="text-xs text-slate-400">· {fmt(b.data)}</span>
                                    </span>
                                    {b.importo !== null && (
                                      <span className="text-sm font-semibold tabular-nums text-slate-200">
                                        {formatCurrency(b.importo, countryCode, rowCurrency)}
                                      </span>
                                    )}
                                  </label>
                                )
                              })}
                            </>
                          )}
                        </div>
                      )}

                      {/* Summary row: selected sum + diff badge + action buttons */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Selected sum */}
                        {hasSel && (
                          <span className="text-xs font-medium text-slate-400">
                            {t.statements.selectedSumLabel}{' '}
                            <span className="font-bold text-slate-100">{formatCurrency(selSum, countryCode, rowCurrency)}</span>
                            {' '}
                            {(selIds.length === 1 ? t.statements.selectedBolle_one : t.statements.selectedBolle_other).replace(/\{n\}/g, String(selIds.length))}
                          </span>
                        )}

                        {/* Difference badge */}
                        {hasSel && diff !== null && diff !== 0 && (
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${
                            diff > 0
                              ? 'bg-orange-500/20 text-orange-200 ring-orange-500/35'
                              : 'bg-amber-500/20 text-amber-200 ring-amber-500/35'
                          }`}>
                              {diff > 0
                              ? `${t.statements.exceeds} ${formatCurrency(diff, countryCode, rowCurrency)}`
                              : `${t.statements.missingAmt} ${formatCurrency(Math.abs(diff), countryCode, rowCurrency)}`}
                          </span>
                        )}
                        {hasSel && diff === 0 && ocrTotal !== null && (
                          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-200 ring-1 ring-emerald-500/35">
                            ✓ {t.statements.exactAmount}
                          </span>
                        )}

                        <div className="ml-auto flex items-center gap-2">
                          <button
                            onClick={() => associa(doc.id)}
                            disabled={!hasSel || stato === 'loading'}
                            className="min-h-[44px] rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-cyan-600 active:bg-cyan-700 disabled:opacity-40 touch-manipulation whitespace-nowrap md:min-h-0 md:px-3 md:py-1.5 md:text-xs"
                          >
                            {stato === 'loading' ? t.statements.btnAssigning
                              : stato === 'done' ? t.statements.doneStatus
                              : stato === 'error' ? t.statements.errorStatus
                              : hasSel ? `${t.statements.btnAssign}${selIds.length > 1 ? ` (${selIds.length})` : ''}` : t.statements.btnAssign}
                          </button>
                          <button
                            onClick={() => scarta(doc.id)}
                            disabled={stato === 'loading'}
                            className="min-h-[44px] rounded-lg border border-slate-600/70 bg-slate-800/80 px-3 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700/90 active:bg-slate-800 disabled:opacity-40 touch-manipulation md:min-h-0 md:py-1.5 md:text-xs"
                          >
                            {t.statements.btnDiscard}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {(doc.stato === 'in_attesa' || doc.stato === 'da_associare') && pendingKindForDoc(doc) === 'ordine' && (
                  <div className="flex justify-end px-3 pb-3">
                    <button
                      onClick={() => scarta(doc.id)}
                      disabled={stato === 'loading'}
                      className="min-h-[44px] rounded-lg border border-slate-600/70 bg-slate-800/80 px-3 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700/90 active:bg-slate-800 disabled:opacity-40 touch-manipulation md:min-h-0 md:py-1.5 md:text-xs"
                    >
                      {t.statements.btnDiscard}
                    </button>
                  </div>
                )}

                {/* Statement actions (separate from match actions) */}
                {(doc.stato === 'in_attesa' || doc.stato === 'da_associare') && isStmt && (
                  <div className="flex items-center gap-2 px-3 pb-3">
                    <button
                      onClick={() => scarta(doc.id)}
                      disabled={stato === 'loading'}
                      className="min-h-[44px] rounded-lg border border-slate-600/70 bg-slate-800/80 px-3 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700/90 active:bg-slate-800 disabled:opacity-40 touch-manipulation md:min-h-0 md:py-1.5 md:text-xs"
                    >
                      {t.statements.btnDiscard}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {rememberBar && (
        <div className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-lg rounded-xl border border-cyan-500/40 bg-slate-800/95 p-4 shadow-xl backdrop-blur-md md:left-auto md:right-6 md:mx-0">
          <p className="text-sm font-medium text-slate-100">{t.statements.rememberAssociationTitle}</p>
          <p className="mt-1 truncate text-xs text-slate-200">{rememberBar.email}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg bg-cyan-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400"
              onClick={async () => {
                const res = await fetch('/api/fornitore-emails/remember', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    fornitore_id: rememberBar.fornitoreId,
                    email: rememberBar.email,
                  }),
                })
                if (res.ok) setRememberBar(null)
              }}
            >
              {t.statements.rememberAssociationSave}
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700"
              onClick={() => setRememberBar(null)}
            >
              {t.statements.btnClose}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

/* ══════════════════════════════════════════════════════════════
   TAB 2 — Verification Status  (Triple-Check + Classic view)
   ══════════════════════════════════════════════════════════════ */

type CheckStatus =
  | 'pending'
  | 'ok'
  | 'fattura_mancante'
  | 'bolle_mancanti'
  | 'errore_importo'
  | 'rekki_prezzo_discordanza'

interface CheckResult {
  numero:           string
  importoStatement: number
  status:           CheckStatus
  data_doc:         string | null
  fattura: { id: string; numero_fattura: string | null; importo: number | null; data: string; file_url: string | null; fornitore_id: string } | null
  bolle:   { id: string; numero_bolla: string | null; importo: number | null; data: string }[]
  deltaImporto: number | null
  fornitore: { id: string; nome: string; email: string | null } | null
}

const VALID_CHECK_STATUSES = new Set<CheckStatus>([
  'pending', 'ok', 'fattura_mancante', 'bolle_mancanti', 'errore_importo', 'rekki_prezzo_discordanza',
])

/** Evita crash UI / hydration se il DB ha valore vuoto, legacy o migration non applicata. */
function normalizeCheckStatus(raw: unknown): CheckStatus {
  if (typeof raw === 'string' && VALID_CHECK_STATUSES.has(raw as CheckStatus)) return raw as CheckStatus
  return 'pending'
}

const STATUS_STYLE: Record<CheckStatus, { cls: string; dot: string; icon: string }> = {
  pending:                   { cls: 'border border-slate-400/45 bg-slate-800/50 text-slate-100',        dot: 'bg-slate-400',  icon: '…' },
  ok:                        { cls: 'border border-emerald-500/35 bg-emerald-500/15 text-emerald-200',   dot: 'bg-green-500',  icon: '✓' },
  fattura_mancante:          { cls: 'border border-yellow-500/35 bg-yellow-500/15 text-yellow-200', dot: 'bg-yellow-400', icon: '!' },
  bolle_mancanti:            { cls: 'border border-orange-500/35 bg-orange-500/15 text-orange-200', dot: 'bg-orange-500', icon: '⚠' },
  errore_importo:            { cls: 'border border-red-500/35 bg-red-500/15 text-red-200',          dot: 'bg-red-500',    icon: '✗' },
  rekki_prezzo_discordanza:  { cls: 'border border-amber-500/40 bg-amber-500/12 text-amber-100',   dot: 'bg-amber-400',  icon: '⚠' },
}
function useStatusConfig() {
  const t = useT()
  return {
    pending:          { label: t.statements.statusCheckPending,   ...STATUS_STYLE.pending },
    ok:               { label: t.statements.statusOk,               ...STATUS_STYLE.ok },
    fattura_mancante: { label: t.statements.statusFatturaMancante,  ...STATUS_STYLE.fattura_mancante },
    bolle_mancanti:   { label: t.statements.statusBolleManc,        ...STATUS_STYLE.bolle_mancanti },
    errore_importo:            { label: t.statements.statusErrImporto,            ...STATUS_STYLE.errore_importo },
    rekki_prezzo_discordanza:  { label: t.statements.statusRekkiPrezzo,            ...STATUS_STYLE.rekki_prezzo_discordanza },
  } as Record<CheckStatus, { label: string; cls: string; dot: string; icon: string }>
}

const STMT_MIGRATION_SQL = `-- Esegui nel Supabase Dashboard → SQL Editor
CREATE TABLE IF NOT EXISTS public.statements (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sede_id       uuid REFERENCES public.sedi(id) ON DELETE CASCADE,
  fornitore_id  uuid REFERENCES public.fornitori(id) ON DELETE SET NULL,
  doc_id        uuid,
  email_subject text,
  received_at   timestamptz DEFAULT now(),
  file_url      text,
  status        text DEFAULT 'processing' CHECK (status IN ('processing','done','error')),
  total_rows    int DEFAULT 0,
  missing_rows  int DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.statement_rows (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  statement_id  uuid NOT NULL REFERENCES public.statements(id) ON DELETE CASCADE,
  numero_doc    text NOT NULL,
  importo       numeric(12,2),
  data_doc      date,
  check_status  text DEFAULT 'pending'
    CHECK (check_status IN ('pending','ok','fattura_mancante','bolle_mancanti','errore_importo','rekki_prezzo_discordanza')),
  fattura_id    uuid REFERENCES public.fatture(id) ON DELETE SET NULL,
  delta_importo numeric(12,2),
  fornitore_id  uuid REFERENCES public.fornitori(id) ON DELETE SET NULL,
  fattura_numero text,
  bolle_json    jsonb,
  created_at    timestamptz DEFAULT now()
);
ALTER TABLE public.statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statement_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stmt_select"  ON public.statements     FOR SELECT USING (auth.role() IN ('authenticated','service_role'));
CREATE POLICY "stmt_write"   ON public.statements     FOR ALL    USING (auth.role() = 'service_role');
CREATE POLICY "srow_select"  ON public.statement_rows FOR SELECT USING (auth.role() IN ('authenticated','service_role'));
CREATE POLICY "srow_write"   ON public.statement_rows FOR ALL    USING (auth.role() = 'service_role');`

function MigrationCard() {
  const t = useT()
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(STMT_MIGRATION_SQL).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2500)
    })
  }
  return (
    <div className="app-card mb-6 overflow-hidden border-amber-500/25">
      <div className="app-card-bar" aria-hidden />
      <div className="flex items-start gap-3 px-5 py-4">
        <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-200">⬇ {t.statements.migrationTitle}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-amber-300/90">{t.statements.migrationSubtitle}</p>
          <ol className="mt-2 space-y-1 text-xs text-amber-100/90">
            <li className="flex items-center gap-2">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-500/30 text-[10px] font-bold text-amber-100">1</span>
              {t.statements.migrationStep1}
            </li>
            <li className="flex items-center gap-2">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-500/30 text-[10px] font-bold text-amber-100">2</span>
              <a href="https://supabase.com/dashboard/project/dubocvwsdzrqrrxsedas/sql/new"
                target="_blank" rel="noopener noreferrer"
                className="font-semibold text-amber-200 underline transition-colors hover:text-amber-100">SQL Editor ↗</a>
              {' '}— {t.statements.migrationStep2}
            </li>
          </ol>
        </div>
        <button onClick={copy}
          className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-all ${
            copied ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-200' : 'border-amber-500/40 bg-amber-500/20 text-amber-100 hover:bg-amber-500/30'
          }`}>
          {copied ? (
            <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>{t.statements.migrationCopied}</>
          ) : (
            <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>{t.statements.migrationCopySQL}</>
          )}
        </button>
      </div>
      <details className="border-t border-amber-500/25">
        <summary className="cursor-pointer select-none px-5 py-2 text-[11px] text-amber-300/90 transition-colors hover:bg-slate-700/50">{t.statements.migrationShowSQL}</summary>
        <pre className="overflow-x-auto whitespace-pre bg-slate-700/50 px-5 py-3 font-mono text-[10px] text-amber-100/90">{STMT_MIGRATION_SQL}</pre>
      </details>
    </div>
  )
}

export function VerificationStatusTab({ sedeId, fornitoreId, countryCode, currency, year, month }: { sedeId?: string; fornitoreId?: string; countryCode?: string; currency?: string; year?: number; month?: number }) {
  const now = new Date()
  const loc = getLocale(countryCode)
  const resolvedCurrency = currency ?? loc.currency ?? 'EUR'
  const { showToast } = useToast()
  const t = useT()
  const formatStmtDate = useFmt()
  const MONTHS = t.statements.months
  const STATUS_CONFIG = useStatusConfig()

  /* ── Statement list (received via email) ─────────────────── */
  type StmtRecord = {
    id: string; email_subject: string | null; received_at: string
    file_url: string | null; status: 'processing'|'done'|'error'
    total_rows: number; missing_rows: number; fornitore_nome: string | null
  }
  const [stmts,          setStmts]          = useState<StmtRecord[]>([])
  const [stmtsLoading,   setStmtsLoading]   = useState(true)
  const [needsMigration, setNeedsMigration] = useState(false)
  const [selectedStmt,   setSelectedStmt]   = useState<StmtRecord | null>(null)

  /* ── Triple-check state ───────────────────────────── */
  const [checkResults,   setCheckResults]   = useState<CheckResult[] | null>(null)
  const [checkLoading,   setCheckLoading]   = useState(false)
  const [, setCheckError] = useState<string | null>(null)
  type SollecitoEntry = { status: 'idle'|'loading'|'sent'|'error'; sentAt?: string }
  const [solleciti,      setSolleciti]      = useState<Record<string, SollecitoEntry>>({})
  const [checkFilter,    setCheckFilter]    = useState<'all'|'ok'|'fattura_mancante'|'bolle_mancanti'|'errore_importo'|'rekki_prezzo_discordanza'>('all')

  /* ── Classic bolla/fattura overview state ─────────── */
  // Use external year/month when provided (controlled by parent), otherwise local state
  const [anno, setAnno]     = useState(year ?? now.getFullYear())
  const [mese, setMese]     = useState(month ?? now.getMonth() + 1)

  // Sync with external props when they change
  useEffect(() => { if (year)  setAnno(year)  }, [year])
  useEffect(() => { if (month) setMese(month) }, [month])
  const [gruppi, setGruppi] = useState<SupplierGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [invio, setInvio]   = useState<Record<string, 'idle'|'loading'|'sent'|'error'>>({})
  const [selezione, setSelezione] = useState<Set<string>>(new Set())
  const [invioMultiplo, setInvioMultiplo] = useState<'idle'|'loading'|'sent'|'error'>('idle')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setSelezione(new Set())
    const supabase = createClient()
    const from = `${anno}-${String(mese).padStart(2,'0')}-01`
    const to   = new Date(anno, mese, 1).toISOString().split('T')[0]
    let bolleQuery = supabase
      .from('bolle')
      .select('id, data, stato, fornitore_id, fornitori(nome), fatture(id, data, file_url)')
      .gte('data', from).lt('data', to)
      .order('data', { ascending: true })
    if (sedeId) bolleQuery = bolleQuery.eq('sede_id', sedeId) as typeof bolleQuery
    if (fornitoreId) bolleQuery = bolleQuery.eq('fornitore_id', fornitoreId) as typeof bolleQuery
    const { data: bolle } = await bolleQuery
    if (!bolle) { setGruppi([]); setLoading(false); return }
    const map = new Map<string, SupplierGroup>()
    for (const b of bolle) {
      const f    = (Array.isArray(b.fornitori) ? b.fornitori[0] : b.fornitori) as { nome: string } | null
      const nome = f?.nome ?? t.statements.unknownSupplier
      if (!map.has(b.fornitore_id)) map.set(b.fornitore_id, { fornitore_id: b.fornitore_id, nome, bolle: [] })
      const fat = Array.isArray(b.fatture) ? b.fatture : b.fatture ? [b.fatture] : []
      map.get(b.fornitore_id)!.bolle.push({
        id: b.id, data: b.data, stato: b.stato, fornitore_id: b.fornitore_id,
        fattura: fat.length > 0 ? (fat[0] as BollaConFattura['fattura']) : null,
      })
    }
    setGruppi([...map.values()])
    setLoading(false)
  }, [anno, mese, sedeId, fornitoreId, t.statements.unknownSupplier])

  useEffect(() => { fetchData() }, [fetchData])

  // Restore sent-sollecito state from server logs on mount
  useEffect(() => {
    if (!sedeId) return
    fetch(`/api/invia-sollecito?sede_id=${sedeId}`)
      .then(r => r.ok ? r.json() : [])
      .then((logs: { numero_doc: string | null; sent_at: string }[]) => {
        if (!logs.length) return
        const restored: Record<string, SollecitoEntry> = {}
        for (const l of logs) {
          if (l.numero_doc) restored[l.numero_doc] = { status: 'sent', sentAt: l.sent_at }
        }
        setSolleciti(prev => ({ ...restored, ...prev }))
      })
      .catch(() => { /* non-critical */ })
  }, [sedeId])

  async function requestSingle(bollaId: string) {
    setInvio(p => ({ ...p, [bollaId]: 'loading' }))
    const res = await fetch('/api/richiedi-fattura', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bolla_id: bollaId, sede_id: sedeId }),
    })
    setInvio(p => ({ ...p, [bollaId]: res.ok ? 'sent' : 'error' }))
  }

  async function requestSelected() {
    if (!selezione.size) return
    setInvioMultiplo('loading')
    const res = await fetch('/api/richiedi-fattura', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bolla_ids: [...selezione], sede_id: sedeId }),
    })
    setInvioMultiplo(res.ok ? 'sent' : 'error')
    if (res.ok) setSelezione(new Set())
    setTimeout(() => setInvioMultiplo('idle'), 3000)
  }

  /* ── Fetch statement list + auto-process pending docs ──────────────── */
  const fetchStmts = useCallback(async (autoOpenLatest = false) => {
    setStmtsLoading(true)

    // Step 1: process any pending statement docs that haven't been parsed yet
    try {
      const body = JSON.stringify({ sede_id: sedeId ?? null, fornitore_id: fornitoreId ?? null })
      const proc = await fetch('/api/process-pending-statements', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
      })
      if (proc.status === 409) {
        // Tables don't exist yet
        setNeedsMigration(true)
        setStmtsLoading(false)
        return
      }
      if (proc.ok) {
        const procJson = await proc.json() as { processed?: number }
        if ((procJson.processed ?? 0) > 0) autoOpenLatest = true
      }
    } catch { /* non-critical — tables may not exist */ }

    // Step 2: fetch the list
    const params = new URLSearchParams()
    if (sedeId)      params.set('sede_id',      sedeId)
    if (fornitoreId) params.set('fornitore_id', fornitoreId)
    const qs  = params.toString() ? `?${params.toString()}` : ''
    const res = await fetch(`/api/statements${qs}`)
    if (res.ok) {
      const json = await res.json() as { statements: StmtRecord[]; needsMigration?: boolean }
      const list = json.statements ?? []
      setStmts(list)
      setNeedsMigration(json.needsMigration ?? false)

      // Auto-open the most recent done statement (with or without anomalies)
      if (autoOpenLatest && list.length > 0) {
        const latest = list.find(s => s.status === 'done') ?? list[0]
        if (latest) {
          setTimeout(() => loadStatementRows(latest), 50)
        }
      }
    }
    setStmtsLoading(false)
  // loadStatementRows is stable (defined below) — safe to omit from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sedeId, fornitoreId])

  useEffect(() => { fetchStmts(true) }, [fetchStmts])

  useEffect(() => {
    const onLayoutRefresh = () => {
      void fetchStmts(false)
      void fetchData()
    }
    window.addEventListener(STATEMENTS_LAYOUT_REFRESH_EVENT, onLayoutRefresh)
    return () => window.removeEventListener(STATEMENTS_LAYOUT_REFRESH_EVENT, onLayoutRefresh)
  }, [fetchStmts, fetchData])

  /* ── Load rows for a specific statement ─────────────────────────────── */
  async function loadStatementRows(stmt: StmtRecord) {
    setSelectedStmt(stmt)
    setCheckResults(null)
    setCheckError(null)
    if (stmt.status === 'processing') {
      setCheckError(t.statements.stmtProcessing)
      return
    }
    setCheckLoading(true)
    const res = await fetch(`/api/statements?id=${stmt.id}`)
    if (!res.ok) {
      showToast(t.statements.loadError, 'error')
      setCheckLoading(false)
      setSelectedStmt(null)
      return
    }
    type RowFromDb = {
      id: string; numero_doc: string; importo: number; data_doc: string | null
      check_status: string | null | undefined
      delta_importo: number | null
      fattura_id: string | null; fattura_numero: string | null
      bolle_json: CheckResult['bolle'] | null
      fornitore_id: string | null
      fornitori: { id: string; nome: string; email: string | null } | null
    }
    const raw = await res.json()
    if (!Array.isArray(raw)) {
      showToast(t.statements.loadError, 'error')
      setCheckLoading(false)
      setSelectedStmt(null)
      return
    }
    const rows = raw as RowFromDb[]
    const mapped: CheckResult[] = rows.map(r => ({
      numero:           r.numero_doc,
      importoStatement: Number(r.importo),
      status:           normalizeCheckStatus(r.check_status),
      data_doc:         r.data_doc ?? null,
      fattura:          r.fattura_id ? {
        id: r.fattura_id, numero_fattura: r.fattura_numero, importo: Number(r.importo),
        data: r.data_doc ?? '', file_url: null, fornitore_id: r.fornitore_id ?? '',
      } : null,
      bolle:            r.bolle_json ?? [],
      deltaImporto:     r.delta_importo,
      fornitore:        r.fornitori ? { id: r.fornitori.id, nome: r.fornitori.nome, email: r.fornitori.email } : null,
    }))
    setCheckResults(mapped)
    setCheckLoading(false)
  }

  async function inviaSollecito(result: CheckResult) {
    const key = result.numero
    if (!result.fornitore?.id) return
    setSolleciti(p => ({ ...p, [key]: { status: 'loading' } }))
    const res = await fetch('/api/invia-sollecito', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fornitore_id: result.fornitore.id,
        numero_doc:   result.numero,
        importo:      result.importoStatement,
        tipo:         result.status === 'fattura_mancante' ? 'fattura' : 'bolle',
        data_doc:     result.fattura?.data ?? null,
        sede_id:      sedeId ?? null,
        currency,
      }),
    })
    if (res.ok) {
      const json = await res.json() as { sent_at?: string }
      setSolleciti(p => ({ ...p, [key]: { status: 'sent', sentAt: json.sent_at ?? new Date().toISOString() } }))
    } else {
      let msg = t.statements.sendError
      try { const j = await res.json() as { error?: string }; if (j.error) msg = j.error } catch {}
      showToast(msg, 'error')
      setSolleciti(p => ({ ...p, [key]: { status: 'idle' } }))
    }
  }

  const tutteBolle  = gruppi.flatMap(g => g.bolle)
  const completi    = tutteBolle.filter(b => b.fattura).length
  const mancanti    = tutteBolle.filter(b => !b.fattura).length
  const mancantiIds = tutteBolle.filter(b => !b.fattura).map(b => b.id)
  const anni        = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i)

  return (
    <>
      {/* ════════ SECTION 1 — Statement inbox (received via email) ════════ */}
      <div className="app-card mb-6 overflow-hidden">
        <div className="app-card-bar" aria-hidden />
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-700/50 bg-slate-700/70 px-5 py-4">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-cyan-400/90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            <p className="text-sm font-semibold text-slate-100">{t.statements.stmtReceived}</p>
            {stmts.length > 0 && (
              <span className="text-xs text-slate-300 font-normal">{t.statements.stmtClickHint}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {selectedStmt && (
              <button onClick={() => { setSelectedStmt(null); setCheckResults(null); setCheckError(null) }}
                className="text-xs text-slate-200 hover:text-slate-200 font-medium">
                ← {t.statements.stmtBackToList}
              </button>
            )}
            <button onClick={() => fetchStmts(false)}
              className="text-xs font-medium text-slate-200 underline-offset-2 transition-colors hover:text-white hover:underline">
              {t.statements.btnRefresh} ↺
            </button>
          </div>
        </div>

        {/* Migration needed */}
        {needsMigration && (
          <div className="px-5 py-6 flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <div>
              <p className="text-sm font-semibold text-amber-200">{t.statements.needsMigrationTitle}</p>
              <p className="mt-1 text-xs leading-relaxed text-amber-300/90">
                {t.statements.needsMigrationBody}
              </p>
            </div>
          </div>
        )}

        {/* Statement list */}
        {!needsMigration && !selectedStmt && (
          stmtsLoading ? (
            <div className="px-5 py-10 text-center">
              <div className="inline-flex items-center gap-2 text-sm text-slate-300">
                <svg className="w-4 h-4 animate-spin text-cyan-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                {t.statements.stmtInboxEmailScanning}
              </div>
            </div>
          ) : stmts.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm font-medium text-slate-200">{t.statements.stmtEmpty}</p>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed max-w-xs mx-auto">
                {t.statements.stmtInboxEmptyDetail}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {stmts.map(s => (
                <button key={s.id} onClick={() => loadStatementRows(s)}
                  className="w-full text-left flex items-center gap-4 px-5 py-4 hover:bg-slate-700/60 active:bg-slate-700/90 transition-colors">
                  {/* Status dot */}
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    s.status === 'processing' ? 'bg-blue-400 animate-pulse' :
                    s.missing_rows > 0 ? 'bg-red-400' : 'bg-green-400'
                  }`} />
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-100 truncate">
                      {s.fornitore_nome ?? s.email_subject ?? 'Statement'}
                    </p>
                    {s.email_subject && s.fornitore_nome && (
                      <p className="text-xs text-slate-300 truncate">{s.email_subject}</p>
                    )}
                    <p className="text-xs text-slate-300 mt-0.5">
                      {formatStmtDate(s.received_at)}
                    </p>
                  </div>
                  {/* Counts */}
                  {s.status === 'processing' ? (
                    <span className="text-xs font-medium text-cyan-400">{t.statements.stmtListProcessing}</span>
                  ) : s.status === 'error' ? (
                    <span className="text-xs text-red-500 font-medium">{t.statements.stmtListParseError}</span>
                  ) : (
                    <div className="text-right shrink-0">
                      <p className="text-xs font-semibold text-slate-200">{t.statements.stmtRowsCount.replace(/\{n\}/g, String(s.total_rows))}</p>
                      {s.missing_rows > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-red-500/35 bg-red-500/15 px-1.5 py-0.5 text-[10px] font-bold text-red-200">
                          {(s.missing_rows === 1 ? t.statements.stmtAnomalies_one : t.statements.stmtAnomalies_other).replace(/\{n\}/g, String(s.missing_rows))}
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-emerald-400">✓ OK</span>
                      )}
                    </div>
                  )}
                  <svg className="w-4 h-4 shrink-0 text-slate-300 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          )
        )}

        {/* Selected statement — loading rows */}
        {selectedStmt && checkLoading && (
          <div className="px-5 py-10 text-center text-sm text-slate-300">{t.statements.loadingResults}</div>
        )}
        {/* errors are shown as toasts — no inline error block needed */}

        {/* Selected statement header */}
        {selectedStmt && checkResults && (
          <div className="px-5 py-3 bg-slate-700/70 border-b border-slate-700/50 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="truncate text-xs font-semibold text-slate-200">
                {selectedStmt.fornitore_nome ?? selectedStmt.email_subject ?? 'Statement'}
              </p>
              <p className="text-[10px] text-slate-300">
                {t.statements.receivedOn} {formatStmtDate(selectedStmt.received_at)}
                {selectedStmt.file_url && (
                  <> · <a href={openDocumentUrl({ statementId: selectedStmt.id })} target="_blank" rel="noopener noreferrer"
                    className="text-cyan-400 transition-colors hover:text-cyan-300 hover:underline">{t.statements.openPdf}</a></>
                )}
              </p>
            </div>
            <button
              onClick={() => fetch(`/api/statements?id=${selectedStmt.id}&action=recheck`).then(() => loadStatementRows(selectedStmt))}
              className="text-xs font-medium text-slate-200 underline-offset-2 transition-colors hover:text-white hover:underline"
            >
              ↺ {t.statements.reanalyze}
            </button>
          </div>
        )}

        {/* Results */}
        {checkResults && (
          <div>
            {/* ── Inline header: title + filter chips + clear ── */}
            {(() => {
              const countOk   = checkResults.filter(r => r.status === 'ok').length
              const countFM   = checkResults.filter(r => r.status === 'fattura_mancante').length
              const countBM   = checkResults.filter(r => r.status === 'bolle_mancanti').length
              const countEI   = checkResults.filter(r => r.status === 'errore_importo').length
              const countRK   = checkResults.filter(r => r.status === 'rekki_prezzo_discordanza').length
              const chips: { id: typeof checkFilter; dot: string; label: string; count: number }[] = [
                { id: 'ok',               dot: 'bg-green-500',  label: t.statements.kpiVerifiedOk,       count: countOk  },
                { id: 'fattura_mancante', dot: 'bg-orange-500', label: t.statements.statusFatturaMancante, count: countFM  },
                { id: 'bolle_mancanti',   dot: 'bg-amber-400',  label: t.statements.statusBolleManc,      count: countBM  },
                { id: 'errore_importo',   dot: 'bg-red-500',    label: t.statements.statusErrImporto,     count: countEI  },
                { id: 'rekki_prezzo_discordanza', dot: 'bg-amber-300', label: t.statements.statusRekkiPrezzo, count: countRK  },
              ]
              return (
                <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-700/50 flex-wrap">
                  <span className="text-sm font-bold text-slate-100 shrink-0">{t.statements.tabVerifica}</span>
                  <div className="flex items-center gap-2 flex-wrap flex-1">
                    {chips.map(chip => (
                      <button key={chip.id} onClick={() => setCheckFilter(checkFilter === chip.id ? 'all' : chip.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all whitespace-nowrap ${
                          checkFilter === chip.id
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-slate-700/90 text-slate-200 border-slate-600/50 hover:border-slate-500'
                        }`}>
                        <span className={`w-2 h-2 rounded-full ${chip.dot} ${checkFilter === chip.id ? 'opacity-80' : ''}`} />
                        {chip.label}
                        <span className="font-bold">· {chip.count}</span>
                      </button>
                    ))}
                  </div>
                  {checkFilter !== 'all' && (
                    <button onClick={() => setCheckFilter('all')}
                      className="text-xs font-medium text-slate-200 underline-offset-2 transition-colors hover:text-white hover:underline shrink-0">
                      {t.statements.clearFilter}
                    </button>
                  )}
                </div>
              )
            })()}

            {/* Per-line results — mobile cards */}
            <div className="md:hidden divide-y divide-slate-800/60">
            {checkResults.filter(r => checkFilter === 'all' || r.status === checkFilter).map(r => {
              const cfg        = STATUS_CONFIG[r.status]
              const needAction =
                r.status === 'fattura_mancante' ||
                r.status === 'bolle_mancanti' ||
                r.status === 'errore_importo' ||
                r.status === 'rekki_prezzo_discordanza'
              const sollEntry  = solleciti[r.numero] ?? { status: 'idle' }
              const sollecitoState = sollEntry.status
              const hasEmail   = !!(r.fornitore?.email)

              return (
                <div key={r.numero} className={`flex items-start gap-4 px-5 py-4 border-b border-slate-600/50 last:border-0 ${
                  r.status === 'rekki_prezzo_discordanza'
                    ? 'bg-amber-950/45 ring-1 ring-inset ring-amber-400/35'
                    : r.status === 'errore_importo'
                      ? 'bg-red-950/20 ring-1 ring-inset ring-red-500/15'
                      : r.status === 'pending'
                        ? 'bg-slate-700/40'
                        : r.status !== 'ok'
                          ? 'bg-slate-700/50'
                          : ''
                }`}>
                  <div className={`mt-0.5 w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-sm font-semibold font-mono ${r.status === 'rekki_prezzo_discordanza' ? 'text-slate-50' : 'text-slate-100'}`}>{r.numero}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.cls}`}>{cfg.icon} {cfg.label}</span>
                      {r.status === 'ok' && (
                        <span className="text-xs font-medium text-emerald-400">{formatCurrency(r.importoStatement, countryCode, resolvedCurrency)} ✓</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-200 space-y-0.5">
                      <p>{t.statements.reconcileStatement} <span className="font-semibold text-slate-200">{formatCurrency(r.importoStatement, countryCode, resolvedCurrency)}</span>
                        {r.fattura?.importo !== null && r.fattura?.importo !== undefined && (
                          <> · {t.statements.reconcileDB}{' '}
                            <span className={`font-semibold ${
                              r.status === 'errore_importo'
                                ? 'text-red-300'
                                : r.status === 'rekki_prezzo_discordanza'
                                  ? 'text-amber-400'
                                  : 'text-slate-200'
                            }`}>{formatCurrency(r.fattura.importo, countryCode, resolvedCurrency)}</span>
                            {r.status === 'rekki_prezzo_discordanza' && (
                              <span className="ml-1 block text-[10px] font-medium text-amber-100">{t.bolle.verificaPrezzoFornitore} · {t.bolle.prezzoDaApp}</span>
                            )}
                            {(r.status === 'errore_importo' || r.status === 'rekki_prezzo_discordanza') && r.deltaImporto !== null && (
                              <span className={`ml-1 font-bold ${r.status === 'rekki_prezzo_discordanza' ? 'text-amber-400' : 'text-red-300'}`}>
                                (Δ {r.deltaImporto > 0 ? '+' : ''}{formatCurrency(Math.abs(r.deltaImporto), countryCode, resolvedCurrency)})
                              </span>
                            )}
                          </>
                        )}
                      </p>
                      {r.fattura && (
                        <p>{t.fatture.invoice}: <span className="font-medium text-slate-200">{r.fattura.numero_fattura ?? '—'}</span>
                          {r.fattura.file_url && <a href={openDocumentUrl({ fatturaId: r.fattura.id })} target="_blank" rel="noopener noreferrer" className="ml-1 text-cyan-400 transition-colors hover:text-cyan-300 hover:underline">PDF →</a>}
                        </p>
                      )}
                      {r.bolle.length > 0 && (
                        <p>{t.nav.bolle}: {r.bolle.map(b => (
                          <span key={b.id} className="inline-flex items-center gap-1 mr-1.5">
                            <span className="font-mono text-slate-200">{b.numero_bolla ?? '—'}</span>
                            {b.importo !== null && <span className="text-slate-200">({formatCurrency(b.importo, countryCode, resolvedCurrency)})</span>}
                          </span>
                        ))}</p>
                      )}
                      {r.status === 'bolle_mancanti' && <p className="text-orange-300 font-medium">{t.statements.noBolleDelivery}</p>}
                      {r.fornitore && (
                        <p className="text-slate-300">{r.fornitore.nome}{r.fornitore.email && <span> · {r.fornitore.email}</span>}</p>
                      )}
                    </div>
                  </div>
                  {needAction && (
                    sollecitoState === 'sent' ? (
                      <div className="shrink-0 flex flex-col items-center gap-0.5 text-center">
                        <span className="flex items-center gap-1 rounded-lg border border-emerald-500/35 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-200">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                          {t.statements.btnSent}
                        </span>
                        {sollEntry.sentAt && <span className="text-[10px] text-slate-300">{new Intl.DateTimeFormat(loc.currencyLocale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(sollEntry.sentAt))}</span>}
                        <button onClick={() => inviaSollecito(r)} className="text-[10px] font-medium text-slate-300 hover:text-white underline underline-offset-2 mt-0.5">{t.statements.btnSendReminder}</button>
                      </div>
                    ) : (
                      <button onClick={() => inviaSollecito(r)} disabled={!hasEmail || sollecitoState === 'loading'} title={!hasEmail ? t.statements.noEmailForSupplier : undefined}
                        className={`shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border transition-colors min-h-[38px] touch-manipulation ${
                          !hasEmail ? 'cursor-not-allowed border-slate-600/50 bg-slate-700/60 text-slate-400'
                          : r.status === 'fattura_mancante' ? 'border-yellow-500/40 bg-yellow-500/15 text-yellow-100 hover:bg-yellow-500/25'
                          : 'border-orange-500/40 bg-orange-500/15 text-orange-100 hover:bg-orange-500/25'}`}>
                        {sollecitoState === 'loading' ? (
                          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        )}
                        {sollecitoState === 'loading' ? t.statements.btnSending : t.statements.btnSendReminder}
                      </button>
                    )
                  )}
                </div>
              )
            })}
            </div>

            {/* Per-line results — desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <colgroup>
                  <col className="w-8" />{/* chevron */}
                  <col className="w-36" />{/* reference */}
                  <col className="w-40" />{/* status */}
                  <col className="w-28" />{/* stmt date */}
                  <col className="w-28" />{/* sys date */}
                  <col className="w-28" />{/* stmt amount */}
                  <col className="w-28" />{/* sys amount */}
                  <col className="w-24" />{/* checks */}
                  <col />{/* action */}
                </colgroup>
                <thead>
                  <tr className="border-b border-slate-700/50">
                    <th className="px-2 py-2.5" />
                    <th className="text-left px-4 py-2.5 text-[10px] font-bold text-slate-300 uppercase tracking-widest">{t.statements.colRef}</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-bold text-slate-300 uppercase tracking-widest">{t.statements.colStatus}</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-bold text-slate-300 uppercase tracking-widest">{t.statements.tripleColStmtDate}</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-bold text-slate-300 uppercase tracking-widest">{t.statements.tripleColSysDate}</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-bold text-slate-300 uppercase tracking-widest">{t.statements.tripleColStmtAmount}</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-bold text-slate-300 uppercase tracking-widest">{t.statements.tripleColSysAmount}</th>
                    <th className="text-center px-4 py-2.5 text-[10px] font-bold text-slate-300 uppercase tracking-widest">{t.statements.tripleColChecks}</th>
                    <th className="text-center px-4 py-2.5 text-[10px] font-bold text-slate-300 uppercase tracking-widest">{t.statements.colAction}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {checkResults.filter(r => checkFilter === 'all' || r.status === checkFilter).map(r => {
                    const cfg        = STATUS_CONFIG[r.status]
                    const needAction =
                      r.status === 'fattura_mancante' ||
                      r.status === 'bolle_mancanti' ||
                      r.status === 'errore_importo' ||
                      r.status === 'rekki_prezzo_discordanza'
                    const sollEntry  = solleciti[r.numero] ?? { status: 'idle' }
                    const sollecitoState = sollEntry.status
                    const hasEmail   = !!(r.fornitore?.email)
                    const fmtDate = (d: string | null | undefined) =>
                      d ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(d)) : '—'

                    // 4 check segments: row-exists · invoice · bolle · amount-match
                    const checks = [
                      r.status !== 'pending',
                      r.fattura !== null,
                      r.bolle.length > 0,
                      r.status === 'ok' || r.status === 'bolle_mancanti' || r.status === 'rekki_prezzo_discordanza',
                    ]

                    return (
                      <tr key={r.numero} className={`hover:bg-slate-700/60 transition-colors group ${
                        r.status === 'rekki_prezzo_discordanza'
                          ? 'bg-amber-950/45 ring-1 ring-inset ring-amber-400/35'
                          : r.status === 'errore_importo'
                            ? 'bg-red-950/20 ring-1 ring-inset ring-red-500/15'
                            : ''
                      }`}>
                        {/* Chevron */}
                        <td className="pl-4 pr-0 py-3.5">
                          <svg className="w-3 h-3 text-slate-300 group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M7 10l5 5 5-5z" />
                          </svg>
                        </td>

                        {/* Reference */}
                        <td className="px-4 py-3.5">
                          <span className={`font-mono text-xs font-bold ${r.status === 'rekki_prezzo_discordanza' ? 'text-slate-50' : 'text-slate-100'}`}>{r.numero}</span>
                        </td>

                        {/* Status badge */}
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${cfg.cls}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_STYLE[r.status].dot}`} />
                            {cfg.label}
                          </span>
                        </td>

                        {/* Stmt Date */}
                        <td className="px-4 py-3.5 text-xs text-slate-200 whitespace-nowrap">{fmtDate(r.data_doc)}</td>

                        {/* Sys Date (fattura date) */}
                        <td className="px-4 py-3.5 text-xs text-slate-200 whitespace-nowrap">{fmtDate(r.fattura?.data)}</td>

                        {/* Stmt Amount */}
                        <td className={`px-4 py-3.5 text-right font-bold tabular-nums text-sm whitespace-nowrap ${r.status === 'rekki_prezzo_discordanza' ? 'text-amber-50' : 'text-slate-100'}`}>
                          {formatCurrency(r.importoStatement, countryCode, resolvedCurrency)}
                        </td>

                        {/* Sys Amount */}
                        <td className="px-4 py-3.5 text-right tabular-nums text-sm whitespace-nowrap">
                          {r.fattura?.importo !== null && r.fattura?.importo !== undefined ? (
                            <div className="inline-flex flex-col items-end gap-0.5">
                              <span className={
                                r.status === 'errore_importo'
                                  ? 'text-red-300 font-bold'
                                  : r.status === 'rekki_prezzo_discordanza'
                                    ? 'text-amber-400 font-bold'
                                    : 'text-slate-200'
                              }>
                                {formatCurrency(r.fattura.importo, countryCode, resolvedCurrency)}
                              </span>
                              {r.status === 'rekki_prezzo_discordanza' && r.deltaImporto !== null && (
                                <span className="text-[10px] font-bold text-amber-400">
                                  Δ {r.deltaImporto > 0 ? '+' : ''}{formatCurrency(Math.abs(r.deltaImporto), countryCode, resolvedCurrency)}
                                </span>
                              )}
                              {r.status === 'rekki_prezzo_discordanza' && (
                                <span className="text-[9px] font-medium text-amber-100 max-w-[160px] text-right leading-tight">
                                  {t.bolle.verificaPrezzoFornitore} · {t.bolle.prezzoDaApp}
                                </span>
                              )}
                            </div>
                          ) : <span className="text-slate-400">—</span>}
                        </td>

                        {/* Checks — 4 colored segments */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-0.5 justify-center">
                            {checks.map((pass, i) => {
                              const isLast = i === 3
                              if (r.status === 'rekki_prezzo_discordanza' && isLast) {
                                return <div key={i} title={t.statements.rekkiCheckSegmentTooltip} className="h-2 w-5 rounded-sm bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.45)]" />
                              }
                              return <div key={i} className={`h-2 w-5 rounded-sm ${pass ? 'bg-green-500' : 'bg-slate-600'}`} />
                            })}
                          </div>
                        </td>

                        {/* Action */}
                        <td className="px-4 py-3.5 text-center">
                          {needAction && (
                            sollecitoState === 'sent' ? (
                              <div className="inline-flex flex-col items-center gap-0.5">
                                <span className="flex items-center gap-1 rounded-lg border border-emerald-500/35 bg-emerald-500/15 px-2 py-1 text-[10px] font-bold text-emerald-200">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                  {t.statements.btnSent}
                                </span>
                                {sollEntry.sentAt && <span className="text-[9px] text-slate-400 mt-0.5">{new Intl.DateTimeFormat(loc.currencyLocale, { day: '2-digit', month: 'short' }).format(new Date(sollEntry.sentAt))}</span>}
                              </div>
                            ) : (
                              <button onClick={() => inviaSollecito(r)} disabled={!hasEmail || sollecitoState === 'loading'}
                                title={!hasEmail ? t.statements.noEmailForSupplier : undefined}
                                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
                                  !hasEmail ? 'cursor-not-allowed border-slate-600/50 bg-slate-700/60 text-slate-400'
                                  : 'border-amber-500/40 bg-amber-500/20 text-amber-100 hover:bg-amber-500/30'
                                }`}>
                                {sollecitoState === 'loading' ? (
                                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                                ) : (
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                )}
                                {sollecitoState === 'loading' ? t.statements.btnSending : t.statements.btnSendReminder}
                              </button>
                            )
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Migration guide (shown only when tables are missing) ── */}
      {needsMigration && (
        <MigrationCard />
      )}

      {/* ════════ SECTION 2 — Classic bolla/fattura overview ════════ */}
      <div className="mb-3">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{t.statements.bolleSummaryByPeriod}</p>
      </div>

      {/* Period selector */}
      <div className="flex flex-wrap gap-3 mb-5">
        <select value={mese} onChange={e => setMese(Number(e.target.value))}
          className="rounded-lg border border-slate-600/50 bg-slate-700/90 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 [color-scheme:dark]">
          {MONTHS.map((m,i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <select value={anno} onChange={e => setAnno(Number(e.target.value))}
          className="rounded-lg border border-slate-600/50 bg-slate-700/90 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 [color-scheme:dark]">
          {anni.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* Global KPIs */}
      {!loading && tutteBolle.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: t.bolle.title,       value: tutteBolle.length, cls: 'text-slate-100' },
            { label: t.statements.classicComplete, value: completi, cls: 'text-emerald-400' },
            { label: t.statements.classicMissing,  value: mancanti, cls: 'text-red-500' },
          ].map(c => (
            <div key={c.label} className="app-card flex flex-col overflow-hidden text-center">
              <div className="app-card-bar shrink-0" aria-hidden />
              <div className="p-4">
                <p className={`text-2xl font-bold ${c.cls}`}>{c.value}</p>
                <p className="text-xs text-slate-200 mt-0.5 uppercase tracking-wide">{c.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bulk select bar */}
      {selezione.size > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <span className="flex-1 text-sm font-medium text-amber-200">
            {selezione.size} bolla{selezione.size !== 1 ? 'e' : ''} selezionata{selezione.size !== 1 ? '' : ''}
          </span>
          <button onClick={requestSelected} disabled={invioMultiplo === 'loading'}
            className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 min-h-[44px] bg-amber-500 hover:bg-amber-600 active:bg-amber-700 disabled:opacity-50 text-white rounded-lg touch-manipulation">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {invioMultiplo === 'loading' ? t.statements.classicRequesting : invioMultiplo === 'sent' ? t.statements.classicSent : t.statements.classicRequestAll}
          </button>
          <button onClick={() => setSelezione(new Set())} className="text-xs text-slate-400 hover:text-slate-200">{t.common.cancel}</button>
        </div>
      )}

      {!loading && mancanti > 0 && selezione.size === 0 && (
        <button onClick={() => setSelezione(new Set(mancantiIds))}
          className="mb-4 text-sm text-cyan-400 font-medium hover:opacity-75">
          {t.statements.classicMissing} ({mancanti})
        </button>
      )}

      {loading ? (
        <div className="app-card flex flex-col overflow-hidden text-center">
          <div className="app-card-bar shrink-0" aria-hidden />
          <div className="px-6 py-16">
            <p className="text-sm text-slate-200">{t.common.loading}</p>
          </div>
        </div>
      ) : gruppi.length === 0 ? (
        <div className="app-card flex flex-col overflow-hidden text-center">
          <div className="app-card-bar shrink-0" aria-hidden />
          <div className="px-6 py-16">
            <p className="text-sm font-medium text-slate-200">{t.statements.stmtEmpty} — {t.statements.months[mese-1]} {anno}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {gruppi.map(g => {
            const gTotal    = g.bolle.length
            const gVerified = g.bolle.filter(b => b.fattura).length
            const gMissing  = g.bolle.filter(b => !b.fattura).length
            const allGood   = gMissing === 0

            return (
              <div key={g.fornitore_id} className="app-card overflow-hidden">
                <div className="app-card-bar" aria-hidden />
                {/* Supplier header with Verification Triangle */}
                <div className="border-b border-slate-700/50 bg-slate-700/60 px-5 py-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <h2 className="font-semibold text-slate-100">{g.nome}</h2>
                      <p className="text-xs text-slate-400 mt-0.5">{gTotal} bolla{gTotal !== 1 ? 'e' : ''} nel periodo</p>
                    </div>
                    {/* Verification Triangle */}
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col items-center px-3 py-1.5 bg-slate-700/90 border border-slate-600/50 rounded-lg min-w-[60px]">
                        <span className="text-xs font-bold text-slate-200">{gTotal}</span>
                        <span className="text-[9px] text-slate-400 uppercase tracking-wide">Bolle</span>
                      </div>
                      <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                      <div className="flex flex-col items-center px-3 py-1.5 bg-slate-700/90 border border-slate-600/50 rounded-lg min-w-[60px]">
                        <span className="text-xs font-bold text-emerald-400">{gVerified}</span>
                        <span className="text-[9px] text-slate-400 uppercase tracking-wide">Fatture</span>
                      </div>
                      <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                      <div className={`flex min-w-[60px] flex-col items-center rounded-lg border px-3 py-1.5 ${allGood ? 'border-emerald-500/35 bg-emerald-500/10' : 'border-red-500/35 bg-red-500/10'}`}>
                        <span className={`text-xs font-bold ${allGood ? 'text-emerald-300' : 'text-red-300'}`}>{gMissing}</span>
                        <span className={`text-[9px] uppercase tracking-wide ${allGood ? 'text-green-400' : 'text-red-400'}`}>Diff.</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* GRN rows */}
                <div className="divide-y divide-slate-800/60">
                  {g.bolle.map(bolla => {
                    const missing = !bolla.fattura
                    const stato   = invio[bolla.id]
                    return (
                      <div key={bolla.id} className={`flex flex-wrap items-center gap-3 px-5 py-3.5 ${missing ? 'bg-amber-500/10' : ''}`}>
                        {missing && (
                          <input type="checkbox" checked={selezione.has(bolla.id)}
                            onChange={() => setSelezione(p => {
                              const n = new Set(p)
                              if (n.has(bolla.id)) n.delete(bolla.id); else n.add(bolla.id)
                              return n
                            })}
                            className="rounded border-slate-600 text-cyan-400 focus:ring-cyan-500"
                          />
                        )}
                        <span className="text-sm text-slate-200 font-medium">{fmt(bolla.data)}</span>
                        <span className="flex-1" />
                        {bolla.fattura ? (
                          <>
                            <span className="rounded-full border border-emerald-500/35 bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-200">✓ Verificata</span>
                            {bolla.fattura.file_url && (
                              <a href={openDocumentUrl({ fatturaId: bolla.fattura.id })} target="_blank" rel="noopener noreferrer"
                                className="text-xs text-cyan-400 transition-colors hover:text-cyan-300 hover:underline">{fmt(bolla.fattura.data)} →</a>
                            )}
                          </>
                        ) : (
                          <>
                            <span className="rounded-full border border-red-500/35 bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-300">Fattura mancante</span>
                            <button onClick={() => requestSingle(bolla.id)} disabled={stato === 'loading' || stato === 'sent'}
                              className="flex min-h-[44px] items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-2.5 text-xs font-semibold text-amber-100 transition-colors hover:bg-amber-500/25 disabled:opacity-50 touch-manipulation">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              {stato === 'loading' ? 'Invio…' : stato === 'sent' ? 'Inviato ✓' : 'Richiedi'}
                            </button>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Supplier-level request if any missing */}
                {gMissing > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-red-500/25 bg-red-500/10 px-5 py-3">
                    <p className="text-xs text-red-300">{gMissing} fattura{gMissing > 1 ? 'e' : ''} mancante{gMissing > 1 ? '' : ''}</p>
                    <button
                      onClick={() => setSelezione(prev => {
                        const n = new Set(prev)
                        g.bolle.filter(b => !b.fattura).forEach(b => n.add(b.id))
                        return n
                      })}
                      className="text-xs font-semibold text-amber-300 transition-colors hover:text-amber-200"
                    >
                      Seleziona tutte per questo fornitore →
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
