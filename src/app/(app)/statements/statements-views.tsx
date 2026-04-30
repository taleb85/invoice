'use client'

import { Fragment, useEffect, useState, useCallback, useRef, useMemo, useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { thumbnailUrl } from '@/lib/storage-transform'
import { getLocale, formatCurrency } from '@/lib/localization'
import { useMe } from '@/lib/me-context'
import { useLocale } from '@/lib/locale-context'
import { useToast } from '@/lib/toast-context'
import { useT } from '@/lib/use-t'
import { parseAnyAmount } from '@/lib/ocr-amount'
import { NewFornitoreLink } from '@/components/NewFornitoreLink'
import { fornitoreNomeMaiuscolo } from '@/lib/fornitore-display'
import { openDocumentUrl } from '@/lib/open-document-url'
import { OpenDocumentInAppButton } from '@/components/OpenDocumentInAppButton'
import {
  findUniqueFornitoreForPendingDoc,
  normalizeAddressKey,
  resolveBolleMatchForPendingInvoice,
} from '@/lib/auto-resolve-pending-doc'
import { inferPendingDocumentKindForQueueRow } from '@/lib/document-bozza-routing'
import { STATEMENTS_LAYOUT_REFRESH_EVENT } from '@/lib/statements-layout-refresh'
import {
  SUMMARY_HIGHLIGHT_ACCENTS,
  SUMMARY_HIGHLIGHT_SURFACE_CLASS,
  type SummaryHighlightAccent,
} from '@/lib/summary-highlight-accent'
import { SUPPLIER_DETAIL_TAB_HIGHLIGHT } from '@/lib/supplier-detail-tab-theme'
import { buildListLocationPath, hrefWithReturnTo } from '@/lib/return-navigation'
import { saveScrollForListPath } from '@/lib/return-navigation-client'
import { BackButton } from '@/components/BackButton'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { AppPageHeaderTitleWithDashboardShortcut } from '@/components/AppPageHeaderDashboardShortcut'
import StatementsSummaryHighlight from '@/components/StatementsSummaryHighlight'
import { attachmentKindFromFileUrl, embedSrcForInlineViewer } from '@/lib/attachment-kind'
import { checkResultMatchesVerificaProdotto } from '@/lib/listino-display'
import { shouldAutoRegisterPendingFattura } from '@/lib/pending-auto-register-fattura'
import { iconAccentClass as icon } from '@/lib/icon-accent-classes'
import { APP_PAGE_HEADER_STRIP_H1_CLASS } from '@/lib/app-shell-layout'

async function parsePendingQueueMutationError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: unknown }
    if (typeof j?.error === 'string' && j.error.trim()) return j.error.trim()
  } catch {
    /* ignore */
  }
  return res.statusText.trim() || `HTTP ${res.status}`
}

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
  matched_by:
    | 'email'
    | 'alias'
    | 'domain'
    | 'piva'
    | 'ragione_sociale'
    | 'rekki_supplier'
    | 'unknown'
    | string
    | null
  estrazione_utile?: boolean | null
  tipo_documento?:    'fattura' | 'bolla' | 'altro' | null
  note_corpo_mail?:   string | null
  /** User-selected tipo documento in coda (estratto vs bolla vs fattura vs ordine) */
  pending_kind?:      'statement' | 'bolla' | 'fattura' | 'ordine' | null
  /** Scansione email: fattura già presente in archivio */
  duplicate_skipped_fattura_id?: string | null
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
  stato: 'in_attesa' | 'da_associare' | 'da_revisionare' | 'associato' | 'scartato' | 'bozza_creata'
  is_statement: boolean
  metadata?: OcrMetadata | null
  fornitore?: { nome: string; email?: string } | null
}

/** Coda manuale (incl. varianti legacy ancora in DB). */
function docNeedsManualProcessing(stato: Documento['stato']): boolean {
  return (
    stato === 'da_revisionare' ||
    stato === 'in_attesa' ||
    stato === 'da_associare' ||
    stato === 'bozza_creata'
  )
}

/** Abbinamento bolle / finalizza tipo (esclude ancora righe legacy «bozza creata»). */
function docAllowsAssociationFlow(stato: Documento['stato']): boolean {
  return stato === 'da_revisionare' || stato === 'in_attesa' || stato === 'da_associare'
}

function pendingDocQuickStripLabel(doc: Documento): string {
  const rs = doc.metadata?.ragione_sociale?.trim()
  if (rs) return rs.length > 42 ? `${rs.slice(0, 40)}…` : rs
  const subj = doc.oggetto_mail?.trim()
  if (subj) return subj.length > 48 ? `${subj.slice(0, 46)}…` : subj
  const fn = doc.file_name?.trim()
  if (fn) return fn.length > 48 ? `${fn.slice(0, 46)}…` : fn
  return doc.id.slice(0, 8)
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

/** Data «ufficiale» del documento: colonna DB, altrimenti data_fattura in metadata OCR. */
function officialDateIsoForPendingDoc(doc: Documento): string | null {
  const col = doc.data_documento?.trim()
  if (col) return col
  const raw = doc.metadata?.data_fattura?.trim()
  if (!raw) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const d = new Date(raw)
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  const itMatch = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (itMatch) {
    const [, dd, mm, yyyy] = itMatch
    const d2 = new Date(`${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`)
    if (!Number.isNaN(d2.getTime())) return d2.toISOString().slice(0, 10)
  }
  return null
}

/** Campi opzionali in `statements.extracted_pdf_dates` (jsonb). */
type StmtExtractedPdfDates = {
  issued_date?: string | null
  last_payment_date?: string | null
  account_no?: string | null
  credit_limit?: string | number | null
  available_credit?: string | null
  payment_terms?: string | null
  last_payment_amount?: number | null
}

function stmtOfficialDateIso(s: { extracted_pdf_dates?: StmtExtractedPdfDates | null }): string | null {
  const pdf = s.extracted_pdf_dates
  const issued = pdf?.issued_date?.trim()
  if (issued) return issued
  const lastPay = pdf?.last_payment_date?.trim()
  return lastPay || null
}

function hasStmtPdfSummary(pdf: StmtExtractedPdfDates | null | undefined): boolean {
  if (!pdf || typeof pdf !== 'object') return false
  if (pdf.account_no?.trim()) return true
  if (pdf.issued_date?.trim()) return true
  if (pdf.last_payment_date?.trim()) return true
  if (pdf.credit_limit != null && String(pdf.credit_limit).trim() !== '') return true
  if (pdf.available_credit?.trim()) return true
  if (pdf.payment_terms?.trim()) return true
  if (pdf.last_payment_amount != null && Number.isFinite(pdf.last_payment_amount)) return true
  return false
}

function StmtPdfSummaryGrid({
  pdf,
  t,
  formatStmtDate,
  countryCode,
}: {
  pdf: StmtExtractedPdfDates
  t: ReturnType<typeof useT>
  formatStmtDate: (d: string | null) => string
  countryCode?: string
}) {
  const cc = countryCode ?? 'UK'
  const fmtMoney = (n: number) => formatCurrency(n, cc)
  const fmtLimit = (v: string | number | null | undefined) => {
    if (v == null) return null
    const s = String(v).trim()
    if (!s) return null
    const n = Number(s.replace(/,/g, ''))
    if (Number.isFinite(n)) return fmtMoney(n)
    return s
  }

  type Row = { k: string; label: string; value: string }
  const rows: Row[] = []
  const acc = pdf.account_no?.trim()
  if (acc) rows.push({ k: 'acc', label: t.statements.stmtPdfMetaAccountNo, value: acc })
  const issued = pdf.issued_date?.trim()
  if (issued) rows.push({ k: 'iss', label: t.statements.stmtPdfMetaIssuedDate, value: formatStmtDate(issued) })
  const lim = fmtLimit(pdf.credit_limit)
  if (lim) rows.push({ k: 'lim', label: t.statements.stmtPdfMetaCreditLimit, value: lim })
  const avail = pdf.available_credit?.trim()
  if (avail) {
    const n = Number(avail.replace(/,/g, ''))
    rows.push({
      k: 'ava',
      label: t.statements.stmtPdfMetaAvailableCredit,
      value: Number.isFinite(n) ? fmtMoney(n) : avail,
    })
  }
  const terms = pdf.payment_terms?.trim()
  if (terms) rows.push({ k: 'term', label: t.statements.stmtPdfMetaPaymentTerms, value: terms })
  if (pdf.last_payment_amount != null && Number.isFinite(pdf.last_payment_amount)) {
    rows.push({
      k: 'lpa',
      label: t.statements.stmtPdfMetaLastPaymentAmt,
      value: fmtMoney(pdf.last_payment_amount),
    })
  }
  const lp = pdf.last_payment_date?.trim()
  if (lp) rows.push({ k: 'lpd', label: t.statements.stmtPdfMetaLastPaymentDate, value: formatStmtDate(lp) })

  if (!rows.length) return null

  return (
    <div className="mt-2 rounded-lg border border-slate-600/45 bg-slate-900/35 px-3 py-2.5 ring-1 ring-inset ring-slate-500/10">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t.statements.stmtPdfSummaryTitle}</p>
      <dl className="mt-2 grid grid-cols-1 gap-y-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-6">
        {rows.map(r => (
          <Fragment key={r.k}>
            <dt className="text-xs font-semibold text-slate-300">{r.label}</dt>
            <dd className="text-xs font-medium tabular-nums text-slate-100 sm:text-right">{r.value}</dd>
          </Fragment>
        ))}
      </dl>
    </div>
  )
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

/** Nessun chip tipo ancora persistito (né flag estratto legacy). */
function docLacksPersistedPendingKind(doc: Documento, statementDocs: Set<string>): boolean {
  const pk = doc.metadata?.pending_kind
  if (pk === 'statement' || pk === 'bolla' || pk === 'fattura' || pk === 'ordine') return false
  if (statementDocs.has(doc.id) || doc.is_statement) return false
  return true
}

/** Categoria documento in coda Da confermare (estratto / bolla / fattura / ordine). */
function pendingKindForDoc(
  doc: Documento,
  statementDocs: Set<string>,
): 'statement' | 'bolla' | 'fattura' | 'ordine' | null {
  const pk = doc.metadata?.pending_kind
  if (pk === 'statement') return 'statement'
  if (pk === 'bolla' || pk === 'fattura' || pk === 'ordine') return pk
  if (statementDocs.has(doc.id) || doc.is_statement) return 'statement'
  return null
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
  backNav,
}: {
  sedeId?: string
  fornitoreId?: string
  countryCode?: string
  currency?: string
  /** Set on `/statements/da-processare` and `/statements/verifica` — layout supplies header and scheda nav. */
  section?: Tab
  /** e.g. `/sedi/[id]/statements`: torna alla scheda sede. */
  backNav?: { href: string; label: string }
}) {
  const [tab, setTab] = useState<Tab>('pending')
  const t = useT()

  const showPageHeader = !fornitoreId && section === undefined
  const showSwitcher = section === undefined
  const active: Tab = section ?? tab

  const wrapperClass =
    fornitoreId ? '' : section !== undefined ? 'w-full min-w-0' : 'w-full min-w-0 app-shell-page-padding'

  return (
    <div className={wrapperClass}>
      {backNav && !showPageHeader ? (
        <BackButton href={backNav.href} label={backNav.label} iconOnly className="mb-3" />
      ) : null}
      {showPageHeader && (
        <>
          <AppPageHeaderStrip
            accent={active === 'pending' ? 'amber' : 'cyan'}
            leadingAccessory={
              backNav ? (
                <BackButton href={backNav.href} label={backNav.label} iconOnly className="mb-0 shrink-0" />
              ) : undefined
            }
          >
            <AppPageHeaderTitleWithDashboardShortcut>
              <h1 className={APP_PAGE_HEADER_STRIP_H1_CLASS}>{t.statements.heading}</h1>
            </AppPageHeaderTitleWithDashboardShortcut>
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

/** Etichetta riga numero: `numero_fattura` in DB è generico OCR — non dire «fattura» se tipo non confermato. */
function ocrDocNumberFieldLabel(
  m: OcrMetadata,
  t: { common: { invoiceNum: string; documentRef: string }; bolle: { colNumero: string } },
): string {
  const pk = m.pending_kind ?? null
  const td = m.tipo_documento ?? null
  if (pk === 'fattura') return t.common.invoiceNum
  if (pk === 'bolla') return t.bolle.colNumero
  if (pk === 'statement' || pk === 'ordine') return t.common.documentRef
  if (td === 'fattura') return t.common.invoiceNum
  if (td === 'bolla') return t.bolle.colNumero
  return t.common.documentRef
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
    <div className="mx-1 mt-2 overflow-hidden rounded-xl border border-[rgba(34,211,238,0.15)] bg-slate-800/85 ring-1 ring-inset ring-violet-500/15">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-[rgba(34,211,238,0.15)] bg-violet-950/50 px-3 py-2">
        <svg className="h-3.5 w-3.5 shrink-0 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-violet-200">{t.common.aiExtracted}</span>
        <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-1.5">
          {showCreateSupplier && newFornitoreHref && (
            <NewFornitoreLink
              href={newFornitoreHref}
              className="shrink-0 rounded-md border border-[rgba(34,211,238,0.15)] bg-emerald-500/15 px-2 py-1 text-[10px] font-semibold text-emerald-100 transition-colors hover:bg-emerald-500/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
            >
              {t.statements.btnCreateSupplierFromAi}
            </NewFornitoreLink>
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
            <span className="text-slate-300">{ocrDocNumberFieldLabel(metadata, t)} · </span>
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
                    ? 'border-[rgba(34,211,238,0.15)] bg-amber-500/15 text-amber-200'
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
                  className="rounded border border-[rgba(34,211,238,0.15)] px-1 py-0.5 text-[9px] leading-none text-violet-300 transition-colors hover:bg-violet-500/15"
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
    const iso = officialDateIsoForPendingDoc(doc)
    if (iso) {
      const dt = new Date(iso)
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
      <div className="grid grid-cols-3 gap-px bg-slate-900/50 sm:grid-cols-3">
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
                  {bolla.fattura.file_url && (
                    <>
                      {' · '}
                      <OpenDocumentInAppButton
                        fatturaId={bolla.fattura.id}
                        fileUrl={bolla.fattura.file_url}
                        className="inline border-0 bg-transparent p-0 font-inherit text-xs text-cyan-400 underline hover:text-cyan-300"
                      >
                        {t.fatture.apri}
                      </OpenDocumentInAppButton>
                    </>
                  )}
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(34,211,238,0.15)] bg-red-950/35 px-4 py-3">
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
            <svg className={`w-3.5 h-3.5 ${icon.emailSync}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Richiedi documenti mancanti
          </button>
        </div>
      )}
      {!loading && missing.length === 0 && bolle.length > 0 && (
        <div className="flex items-center gap-2 border-t border-[rgba(34,211,238,0.15)] bg-emerald-950/30 px-4 py-3">
          <svg className="h-4 w-4 shrink-0 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-xs font-medium text-emerald-200">{t.statements.allBolleInvoicedOk}</p>
        </div>
      )}

      {/* Statement total from AI vs number of matched invoices */}
      {!loading && doc.metadata?.totale_iva_inclusa !== null && doc.metadata?.totale_iva_inclusa !== undefined && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(34,211,238,0.15)] bg-violet-950/25 px-4 py-3">
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
export function PendingMatchesTab({
  sedeId,
  fornitoreId,
  countryCode,
  currency,
  year,
  month,
  ledgerDateFrom,
  ledgerDateToExclusive,
  cardAccent = 'amber',
}: {
  sedeId?: string
  fornitoreId?: string
  countryCode?: string
  currency?: string
  year?: number
  month?: number
  /** Scheda fornitore: filtra `created_at` come le altre tab (Da / A, fine esclusa). */
  ledgerDateFrom?: string
  ledgerDateToExclusive?: string
  /** Scheda fornitore: allinea barra/bordo al tab (es. `amber` per «Documenti»). */
  cardAccent?: SummaryHighlightAccent
}) {
  const t = useT()
  const { timezone } = useLocale()
  const router = useRouter()
  const pathname = usePathname() ?? ''
  const pendingUrlSearchParams = useSearchParams()
  const pendingListReturnPath = buildListLocationPath(pathname, pendingUrlSearchParams)
  const [bulkAnalyzing, setBulkAnalyzing] = useState(false)
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
  const [reanalyzingDocId, setReanalyzingDocId] = useState<string | null>(null)
  const [rememberBar, setRememberBar] = useState<{
    fornitoreId: string
    email: string
  } | null>(null)
  /** In abbinamento fattura–bolla: mostra anche bolle di altri fornitori (stessa sede) o tutta la sede se il doc non ha ancora `fornitore_id`. */
  const [matchIncludeAllSuppliersBolles, setMatchIncludeAllSuppliersBolles] = useState<Record<string, boolean>>({})

  const autoLinkTriedRef = useRef(new Set<string>())
  const autoAssocTriedRef = useRef(new Set<string>())
  const autoPendingKindTriedRef = useRef(new Set<string>())
  const autoRegisterFatturaTriedRef = useRef(new Set<string>())
  const [autoRegisterSetting, setAutoRegisterSetting] = useState(false)
  const [emailAutoSavedToday, setEmailAutoSavedToday] = useState<number | null>(null)

  const addressClusterPeersByDocId = useMemo(() => {
    const pendingLike = docs.filter((d) => docNeedsManualProcessing(d.stato))
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
    if (filter === 'in_attesa') {
      params.set('stati', 'da_revisionare')
    } else {
      params.set('stati', 'in_attesa,da_associare,bozza_creata,da_revisionare')
    }
    if (sedeId) params.set('sede_id', sedeId)
    if (fornitoreId) params.set('fornitore_id', fornitoreId)
    if (fornitoreId && ledgerDateFrom && ledgerDateToExclusive) {
      params.set('from', ledgerDateFrom)
      params.set('to', ledgerDateToExclusive)
    } else if (year && month) {
      params.set('from', `${year}-${String(month).padStart(2, '0')}-01`)
      params.set('to', new Date(year, month, 1).toISOString().split('T')[0])
    }
    const res = await fetch(`/api/documenti-da-processare?${params.toString()}`)
    const data = res.ok ? await res.json() : []
    setDocs((data ?? []).map((d: Record<string, unknown>) => ({ ...d, is_statement: (d.is_statement as boolean | null) ?? false })) as Documento[])
    setLoading(false)
  }, [filter, sedeId, fornitoreId, year, month, ledgerDateFrom, ledgerDateToExclusive])

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

  useEffect(() => {
    if (!sedeId) {
      setEmailAutoSavedToday(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const r = await fetch(
          `/api/email-sync-auto-saved-count?timezone=${encodeURIComponent(timezone ?? 'Europe/Rome')}`,
        )
        const j = r.ok ? ((await r.json()) as { count?: number }) : { count: 0 }
        if (!cancelled) setEmailAutoSavedToday(typeof j.count === 'number' ? j.count : 0)
      } catch {
        if (!cancelled) setEmailAutoSavedToday(0)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sedeId, timezone])

  /**
   * Ricarica documenti e bolle, poi per ogni voce in elenco:
   * collega il fornitore se l’abbinamento è univoco (P.IVA / email / indirizzo / ragione sociale),
   * associa alle bolle se OCR + bolle coincide (somma greedy esatta oppure combinazione univoca entro tol. ~5 %) con data entro finestra giorni dalla data documento quando nota.
   */
  const runRefreshAndBulkAutoMatch = useCallback(async () => {
    setBulkAnalyzing(true)
    autoLinkTriedRef.current = new Set()
    autoAssocTriedRef.current = new Set()
    autoPendingKindTriedRef.current = new Set()
    try {
      const params = new URLSearchParams()
      if (filter === 'in_attesa') {
        params.set('stati', 'da_revisionare')
      } else {
        params.set('stati', 'in_attesa,da_associare,bozza_creata,da_revisionare')
      }
      if (sedeId) params.set('sede_id', sedeId)
      if (fornitoreId) params.set('fornitore_id', fornitoreId)
      if (fornitoreId && ledgerDateFrom && ledgerDateToExclusive) {
        params.set('from', ledgerDateFrom)
        params.set('to', ledgerDateToExclusive)
      } else if (year && month) {
        params.set('from', `${year}-${String(month).padStart(2, '0')}-01`)
        params.set('to', new Date(year, month, 1).toISOString().split('T')[0])
      }
      const bolleParts: string[] = []
      if (sedeId) bolleParts.push(`sede_id=${sedeId}`)
      if (fornitoreId) bolleParts.push(`fornitore_id=${fornitoreId}`)
      const bolleUrl = '/api/bolle-aperte' + (bolleParts.length ? `?${bolleParts.join('&')}` : '')

      const [docRes, bolleRes] = await Promise.all([
        fetch(`/api/documenti-da-processare?${params}`),
        fetch(bolleUrl),
      ])
      let docFetchErr: string | null = null
      let bolleFetchErr: string | null = null
      const rawDocs = docRes.ok ? ((await docRes.json()) ?? []) : []
      if (!docRes.ok) docFetchErr = await parsePendingQueueMutationError(docRes)
      const rawBolle = bolleRes.ok ? ((await bolleRes.json()) ?? []) : []
      if (!bolleRes.ok) bolleFetchErr = await parsePendingQueueMutationError(bolleRes)

      const freshDocs = (rawDocs ?? []).map(
        (d: Record<string, unknown>) =>
          ({ ...d, is_statement: (d.is_statement as boolean | null) ?? false }) as Documento,
      )
      const freshBolle: BollaAperta[] = (rawBolle ?? []).map(
        (b: {
          id: string
          data: string
          importo: number | null
          numero_bolla: string | null
          fornitore_id: string
          fornitori: { nome: string } | { nome: string }[] | null
        }) => ({
          id: b.id,
          data: b.data,
          importo: b.importo ?? null,
          numero_bolla: b.numero_bolla ?? null,
          fornitore_id: b.fornitore_id,
          fornitore_nome: (Array.isArray(b.fornitori) ? b.fornitori[0] : b.fornitori)?.nome ?? '—',
        }),
      )

      const processable = (d: Documento) => docNeedsManualProcessing(d.stato)
      const working = freshDocs.filter(processable).map((d: Documento) => ({ ...d }))

      const supabase = createClient()
      let linked = 0
      let associated = 0
      let postErrCount = 0
      let firstPostErr = ''

      for (const doc of working) {
        if (doc.fornitore_id) continue
        const match = await findUniqueFornitoreForPendingDoc(supabase, {
          docSedeId: doc.sede_id,
          fallbackSedeId: sedeId ?? null,
          profileSedeId: me?.sede_id ?? null,
          fornitoreFilterId: fornitoreId ?? null,
          metadata: doc.metadata,
          mittente: doc.mittente,
        })
        if (!match) continue
        const res = await fetch('/api/documenti-da-processare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: doc.id, azione: 'aggiorna_fornitore', fornitore_id: match.id }),
        })
        if (res.ok) {
          doc.fornitore_id = match.id
          doc.fornitore = { nome: match.nome }
          linked++
        } else {
          postErrCount++
          if (!firstPostErr) firstPostErr = await parsePendingQueueMutationError(res)
        }
      }

      const usedBollaIds = new Set<string>()
      for (const doc of working) {
        if (!docAllowsAssociationFlow(doc.stato)) continue
        if (!doc.fornitore_id) continue
        if (doc.is_statement || doc.metadata?.pending_kind === 'statement') continue
        if (doc.metadata?.pending_kind === 'ordine') continue
        const ocr = doc.metadata?.totale_iva_inclusa ?? null
        if (ocr == null || ocr <= 0) continue
        const relevant = freshBolle.filter(
          (b) =>
            b.fornitore_id === doc.fornitore_id &&
            b.importo != null &&
            b.importo > 0 &&
            !usedBollaIds.has(b.id),
        )
        if (!relevant.length) continue
        const invoiceDateIso = officialDateIsoForPendingDoc(doc)
        const ids = resolveBolleMatchForPendingInvoice(relevant, ocr, invoiceDateIso)
        if (!ids?.length) continue
        const res = await fetch('/api/documenti-da-processare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: doc.id, azione: 'associa', bolla_ids: ids }),
        })
        if (res.ok) {
          associated++
          for (const id of ids) usedBollaIds.add(id)
        } else {
          postErrCount++
          if (!firstPostErr) firstPostErr = await parsePendingQueueMutationError(res)
        }
      }

      await fetchDocs()
      await fetchBolleAperte()
      await fetchFornitori()
      window.dispatchEvent(new Event(STATEMENTS_LAYOUT_REFRESH_EVENT))
      router.refresh()

      if (docFetchErr) {
        showToast(docFetchErr, 'error')
      } else {
        if (bolleFetchErr) {
          showToast(bolleFetchErr, 'error')
        }
        const total = linked + associated
        if (total === 0) {
          if (postErrCount && firstPostErr) {
            showToast(firstPostErr, 'error')
          } else if (!bolleFetchErr) {
            showToast(t.statements.bulkAutoMatchNone, 'success')
          }
        } else {
          showToast(
            t.statements.bulkAutoMatchSummary
              .replace(/\{linked\}/g, String(linked))
              .replace(/\{associated\}/g, String(associated)),
            'success',
          )
          if (postErrCount && firstPostErr) showToast(firstPostErr, 'info')
        }
      }
    } catch {
      showToast(t.statements.assignFailed, 'error')
    } finally {
      setBulkAnalyzing(false)
    }
  }, [
    filter,
    sedeId,
    fornitoreId,
    year,
    month,
    ledgerDateFrom,
    ledgerDateToExclusive,
    me?.sede_id,
    fetchDocs,
    fetchBolleAperte,
    fetchFornitori,
    router,
    showToast,
    t.statements.assignFailed,
    t.statements.bulkAutoMatchNone,
    t.statements.bulkAutoMatchSummary,
  ])

  useEffect(() => { fetchDocs(); fetchBolleAperte(); fetchFornitori() }, [fetchDocs, fetchBolleAperte, fetchFornitori])

  useEffect(() => {
    autoPendingKindTriedRef.current = new Set()
    autoRegisterFatturaTriedRef.current = new Set()
  }, [filter, sedeId, fornitoreId, year, month, ledgerDateFrom, ledgerDateToExclusive])

  useEffect(() => {
    const sid = sedeId ?? me?.sede_id
    if (!sid) return
    let cancelled = false
    void fetch(`/api/sedi/${sid}/approval-settings`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { auto_register_fatture?: boolean } | null) => {
        if (!cancelled && d) setAutoRegisterSetting(Boolean(d.auto_register_fatture))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [sedeId, me?.sede_id])

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
        if (!docNeedsManualProcessing(doc.stato)) continue
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

  // Pre-seleziona chip tipo documento (stesse euristiche della scan email + OCR) se manca pending_kind; conferma utente con Finalizza.
  useEffect(() => {
    if (loading || !docs.length) return
    void (async () => {
      for (const doc of docs) {
        if (!docNeedsManualProcessing(doc.stato)) continue
        if (autoPendingKindTriedRef.current.has(doc.id)) continue
        if (!docLacksPersistedPendingKind(doc, statementDocs)) {
          autoPendingKindTriedRef.current.add(doc.id)
          continue
        }

        const kind = inferPendingDocumentKindForQueueRow({
          oggetto_mail: doc.oggetto_mail,
          file_name: doc.file_name,
          metadata: doc.metadata,
        })
        if (!kind) {
          autoPendingKindTriedRef.current.add(doc.id)
          continue
        }

        const res = await fetch('/api/documenti-da-processare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: doc.id,
            azione: 'mark_statement',
            is_statement: kind === 'statement',
            kind,
          }),
        })
        autoPendingKindTriedRef.current.add(doc.id)
        if (!res.ok) continue

        setDocs((prev) =>
          prev.map((d) =>
            d.id !== doc.id
              ? d
              : {
                  ...d,
                  is_statement: kind === 'statement',
                  metadata: { ...(d.metadata ?? {}), pending_kind: kind } as OcrMetadata,
                },
          ),
        )
        if (kind === 'statement') {
          setStatementDocs((prev) => new Set(prev).add(doc.id))
        }
      }
    })()
  }, [loading, docs, statementDocs])

  // Auto-associa bolle: stesso fornitore; finestra ±30 giorni data doc ↔ bolla quando nota; somma OCR = subset bolle (esatto o univoco entro tol. ~5%, come suggerimento checkbox).
  useEffect(() => {
    if (loading || !bolleAperte.length || !docs.length) return
    void (async () => {
      let didAssoc = false
      for (const doc of docs) {
        if (!docAllowsAssociationFlow(doc.stato)) continue
        if (!doc.fornitore_id) continue
        if (doc.is_statement || doc.metadata?.pending_kind === 'statement') continue
        if (doc.metadata?.pending_kind === 'ordine') continue
        const ocr = doc.metadata?.totale_iva_inclusa ?? null
        if (ocr == null || ocr <= 0) continue
        if (autoAssocTriedRef.current.has(doc.id)) continue

        const relevant = bolleAperte.filter((b) => b.fornitore_id === doc.fornitore_id && b.importo != null && b.importo > 0)
        if (!relevant.length) {
          autoAssocTriedRef.current.add(doc.id)
          continue
        }

        const invoiceDateIso = officialDateIsoForPendingDoc(doc)
        const ids = resolveBolleMatchForPendingInvoice(relevant, ocr, invoiceDateIso)
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

  // Auto-finalizza ordini Rekki: se pending_kind=ordine e fornitore già collegato, registra senza input manuale
  const autoFinalizeOrdineTriedRef = useRef(new Set<string>())
  useEffect(() => {
    if (loading || !docs.length) return
    void (async () => {
      let anyDone = false
      for (const doc of docs) {
        if (!docAllowsAssociationFlow(doc.stato)) continue
        if (doc.metadata?.pending_kind !== 'ordine') continue
        if (!doc.fornitore_id) continue
        if (autoFinalizeOrdineTriedRef.current.has(doc.id)) continue
        autoFinalizeOrdineTriedRef.current.add(doc.id)

        const res = await fetch('/api/documenti-da-processare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: doc.id, azione: 'associa', finalizza_da_tipo: true, bolla_ids: [] }),
        })
        if (res.ok) {
          setActions((p) => ({ ...p, [doc.id]: 'done' }))
          anyDone = true
        }
      }
      if (anyDone) {
        setTimeout(() => void fetchDocs(), 600)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, docs])

  // Registrazione automatica fattura (solo se sede ha flag + criteri AI/sede)
  useEffect(() => {
    if (loading || !autoRegisterSetting || !docs.length) return
    void (async () => {
      let anyDone = false
      for (const doc of docs) {
        if (!docAllowsAssociationFlow(doc.stato)) continue
        const pk = pendingKindForDoc(doc, statementDocs)
        const openSame = bolleAperte.filter((b) => b.fornitore_id === doc.fornitore_id).length
        if (
          !shouldAutoRegisterPendingFattura({
            fornitoreId: doc.fornitore_id,
            pendingKind: pk,
            metadata: doc.metadata ?? undefined,
            openBolleSameSupplierCount: openSame,
          })
        ) {
          continue
        }
        if (autoRegisterFatturaTriedRef.current.has(doc.id)) continue

        const res = await fetch('/api/documenti-da-processare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: doc.id, azione: 'associa', finalizza_da_tipo: true, bolla_ids: [] }),
        })
        if (res.ok) {
          autoRegisterFatturaTriedRef.current.add(doc.id)
          const nomeForn = (doc.fornitore as { nome: string } | null)?.nome ?? '—'
          const num = doc.metadata?.numero_fattura?.trim() || '—'
          showToast(
            t.statements.autoRegisterFatturaToast
              .replace(/\{numero\}/g, num)
              .replace(/\{fornitore\}/g, nomeForn),
            'success',
          )
          setActions((p) => ({ ...p, [doc.id]: 'done' }))
          anyDone = true
        } else {
          autoRegisterFatturaTriedRef.current.add(doc.id)
          let msg = t.statements.assignFailed
          try {
            const j = (await res.json()) as { error?: string }
            if (j.error?.trim()) msg = j.error.trim()
          } catch { /* ignore */ }
          showToast(msg, 'error')
        }
      }
      if (anyDone) {
        setTimeout(() => {
          void fetchDocs()
          void fetchBolleAperte()
        }, 400)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, docs, bolleAperte, autoRegisterSetting, statementDocs])

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
      autoSuggest(doc, relevant, ocrTotal)
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

  /** Pre-seleziona checkbox bolle usando la stessa logica di abbina-auto (finestra date + somma esatta o combinazione univoca entro tol. importo). */
  function autoSuggest(doc: Documento, bolle: BollaAperta[], totalTarget: number | null) {
    if (!totalTarget || totalTarget <= 0 || !bolle.length) return
    const invoiceDateIso = officialDateIsoForPendingDoc(doc)
    const found = resolveBolleMatchForPendingInvoice(bolle, totalTarget, invoiceDateIso)
    if (!found?.length) return
    setSelezione((p) => ({ ...p, [doc.id]: found }))
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
      showToast(t.statements.finalizeSuccess, 'success')
      setTimeout(() => {
        void fetchDocs()
        void fetchBolleAperte()
      }, 400)
    } finally {
      setFinalizingTipoId(null)
    }
  }

  async function reanalyzeDocOcr(docId: string) {
    setReanalyzingDocId(docId)
    try {
      const res = await fetch('/api/documenti-da-processare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: docId, azione: 'rianalizza_ocr' }),
      })
      if (!res.ok) {
        let msg = t.common.error
        try {
          const j = (await res.json()) as { error?: string }
          if (j.error?.trim()) msg = j.error.trim()
        } catch {
          /* ignore */
        }
        showToast(msg, 'error')
        return
      }
      showToast(t.statements.reanalyzeDocSuccess, 'success')
      setTimeout(() => {
        void fetchDocs()
        void fetchBolleAperte()
      }, 350)
    } finally {
      setReanalyzingDocId(null)
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
  const inAttesa = docs.filter(d => docNeedsManualProcessing(d.stato)).length
  const unknownSenderQuickDocs = useMemo(
    () => docs.filter((d) => docNeedsManualProcessing(d.stato) && !d.fornitore_id),
    [docs],
  )

  const listShellTheme = SUMMARY_HIGHLIGHT_ACCENTS[cardAccent]
  /** In scheda fornitore: stesso guscio/tab «Documenti» del resto della pagina. */
  const supplierDocShell = Boolean(fornitoreId)
  const queueShellClass = supplierDocShell ? 'supplier-detail-tab-shell' : SUMMARY_HIGHLIGHT_SURFACE_CLASS
  const queueShellBar = supplierDocShell
    ? SUPPLIER_DETAIL_TAB_HIGHLIGHT.documenti.bar
    : listShellTheme.bar

  const pendingDocRowTheme = (docStato: Documento['stato']) => {
    if (docStato === 'associato') return SUMMARY_HIGHLIGHT_ACCENTS.emerald
    if (docStato === 'scartato') {
      return {
        border: 'border-slate-600/45',
        bar: 'bg-gradient-to-r from-slate-600/35 to-transparent',
      } as const
    }
    return listShellTheme
  }

  return (
    <>
      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button onClick={() => setFilter('in_attesa')}
            className={`min-h-[44px] rounded-lg px-3 py-2 text-xs font-medium transition-colors touch-manipulation ${
              filter === 'in_attesa'
                ? 'border border-[rgba(34,211,238,0.15)] bg-orange-500/15 text-orange-50 shadow-[0_0_20px_-8px_rgba(249,115,22,0.35)]'
                : supplierDocShell
                  ? 'border border-transparent bg-transparent text-app-fg-muted hover:bg-amber-500/10 hover:text-app-fg'
                  : 'border border-transparent bg-slate-800/70 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}>
            {t.statements.tabPending} {inAttesa > 0 && <span className="ml-1 rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-slate-950">{inAttesa}</span>}
          </button>
          <button onClick={() => setFilter('tutti')}
            className={`min-h-[44px] rounded-lg px-3 py-2 text-xs font-medium transition-colors touch-manipulation ${
              filter === 'tutti'
                ? supplierDocShell
                  ? 'border border-app-line-35 bg-transparent text-app-fg ring-1 ring-white/10'
                  : 'border border-slate-500/55 bg-slate-800/90 text-slate-50 ring-1 ring-white/5'
                : supplierDocShell
                  ? 'border border-transparent bg-transparent text-app-fg-muted hover:bg-white/[0.05] hover:text-app-fg'
                  : 'border border-transparent bg-slate-800/70 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}>
            {t.statements.tabAll}
          </button>
        </div>
        <div className="flex min-h-[44px] flex-wrap items-center justify-end gap-x-2 gap-y-1 md:min-h-0 md:py-1">
          {emailAutoSavedToday != null && emailAutoSavedToday > 0 && (
            <p
              className={`text-[11px] font-medium tabular-nums ${supplierDocShell ? 'text-emerald-200/95' : 'text-emerald-300/90'}`}
            >
              {t.statements.emailSyncAutoSavedToday.replace(/\{n\}/g, String(emailAutoSavedToday))}
            </p>
          )}
          <p className={`text-xs font-medium ${supplierDocShell ? 'text-app-fg-muted' : 'text-slate-300'}`}>
            {bolleAperte.length} {bolleAperte.length === 1 ? t.statements.bolleAperteOne : t.statements.bolleApertePlural}
          </p>
          <button
            type="button"
            onClick={() => void runRefreshAndBulkAutoMatch()}
            disabled={bulkAnalyzing}
            title={t.statements.bulkAutoMatchButtonTitle}
            className="inline-flex min-h-[44px] shrink-0 touch-manipulation items-center justify-center gap-2 rounded-lg border border-cyan-500/40 bg-gradient-to-r from-cyan-500/15 to-teal-500/10 px-3.5 py-2 text-xs font-semibold text-cyan-50 shadow-[0_0_24px_-12px_rgba(34,211,238,0.55)] ring-1 ring-cyan-500/20 transition-colors hover:border-cyan-400/55 hover:from-cyan-500/22 hover:to-teal-500/14 hover:ring-cyan-400/30 disabled:pointer-events-none disabled:opacity-45 md:min-h-0 md:py-1.5 md:px-3"
            aria-label={t.statements.bulkAutoMatchButtonLabel}
            aria-busy={bulkAnalyzing}
          >
            {bulkAnalyzing ? (
              <svg
                className="h-4 w-4 shrink-0 animate-spin text-cyan-200"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            ) : (
              <svg
                className="h-4 w-4 shrink-0 text-cyan-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              </svg>
            )}
            <span className="whitespace-nowrap">{t.statements.bulkAutoMatchButtonLabel}</span>
          </button>
        </div>
      </div>

      {!supplierDocShell && unknownSenderQuickDocs.length > 0 && (
        <div
          role="region"
          aria-label={t.statements.unknownSenderQuickStripAria}
          className="mb-4 overflow-hidden rounded-[10px] border-t-2 border-t-orange-400/75 border-x-0 border-b-0 bg-white/[0.04] px-3 py-2.5 sm:px-4"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
            <p className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-orange-200/95 sm:max-w-[11rem] sm:leading-snug">
              {t.statements.unknownSenderQuickStripTitle.replace(
                /\{n\}/g,
                String(unknownSenderQuickDocs.length),
              )}
            </p>
            <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
              {unknownSenderQuickDocs.slice(0, 14).map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  title={t.statements.unknownSenderQuickStripChipTitle}
                  onClick={() => {
                    document
                      .getElementById(`pending-doc-row-${doc.id}`)
                      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }}
                  className="max-w-[min(100%,14rem)] truncate rounded-full border border-orange-400/35 bg-orange-950/40 px-2.5 py-1 text-left text-[11px] font-medium text-orange-100 transition-colors hover:border-orange-400/55 hover:bg-orange-950/55"
                >
                  {pendingDocQuickStripLabel(doc)}
                </button>
              ))}
              {unknownSenderQuickDocs.length > 14 && (
                <span className="self-center text-[11px] tabular-nums text-orange-200/65">
                  +{unknownSenderQuickDocs.length - 14}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-2 backdrop-blur-md sm:p-3"
          onClick={() => setPreview(null)}
        >
          <div
            className="flex h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] w-full max-w-[min(96vw,1200px)] flex-col gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            {isPdf(preview) ? (
              <iframe
                title=""
                src={embedSrcForInlineViewer(preview, attachmentKindFromFileUrl(preview))}
                className="min-h-0 w-full flex-1 rounded-xl border border-slate-600/40 bg-white"
              />
            ) : (
              <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto">
                <Image
                  src={preview}
                  alt=""
                  width={1200}
                  height={1600}
                  unoptimized
                  className="h-auto max-h-[calc(100dvh-4rem)] w-full object-contain rounded-xl"
                />
              </div>
            )}
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="shrink-0 rounded-lg py-2 text-sm text-white/80 hover:text-white"
            >
              {t.statements.btnClose}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className={`${queueShellClass} overflow-hidden`}>
          <div className={`app-card-bar-accent ${queueShellBar}`} aria-hidden />
          <div className="px-6 py-16 text-center">
            <p className={`text-sm ${supplierDocShell ? 'text-app-fg-muted' : 'text-slate-300'}`}>{t.common.loading}</p>
          </div>
        </div>
      ) : docs.length === 0 ? (
        <div className={`${queueShellClass} overflow-hidden`}>
          <div className={`app-card-bar-accent ${queueShellBar}`} aria-hidden />
          <div className="px-6 py-16 text-center">
            <svg
              className={`mx-auto mb-4 h-14 w-14 opacity-90 ${supplierDocShell ? 'text-app-fg-muted' : 'text-slate-400'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className={`text-sm font-medium ${supplierDocShell ? 'text-app-fg-muted' : 'text-slate-300'}`}>
              {filter === 'in_attesa' ? t.statements.noPendingDocs : t.statements.noDocsFound}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => {
            const stato          = actions[doc.id] ?? 'idle'
            const isImage        = doc.content_type?.startsWith('image/')
            const thumb          = isImage ? thumbnailUrl(doc.file_url) : null
            const nomeFornitore  = (doc.fornitore as { nome: string } | null)?.nome ?? null
            const isUnknown      = !nomeFornitore
            const isStmt         = statementDocs.has(doc.id) || doc.is_statement
            const fornitoreDocId = doc.fornitore_id ?? null
            const matchExpandedAllSuppliers =
              matchIncludeAllSuppliersBolles[doc.id] ?? false
            /** Default: solo bolle dello stesso fornitore della fattura; opzionale elenco sede completo. */
            const bolleListaPrincipale: BollaAperta[] =
              fornitoreDocId !== null
                ? bolleAperte.filter((b) => b.fornitore_id === fornitoreDocId)
                : matchExpandedAllSuppliers
                  ? bolleAperte
                  : []
            /** Solo con doc già associato a fornitore + toggle "tutti i fornitore". */
            const bolleAltriFornitoriEspansi: BollaAperta[] =
              fornitoreDocId !== null && matchExpandedAllSuppliers
                ? bolleAperte.filter((b) => b.fornitore_id !== fornitoreDocId)
                : []
            const bolleAbbinamentoPool: BollaAperta[] = [
              ...bolleListaPrincipale,
              ...bolleAltriFornitoriEspansi,
            ]
            const canSearchMoreBolles =
              fornitoreDocId !== null
                ? bolleAperte.some((b) => b.fornitore_id !== fornitoreDocId)
                : bolleAperte.length > 0
            const rowTheme = pendingDocRowTheme(doc.stato)
            const officialDocDateIso = officialDateIsoForPendingDoc(doc)

            return (
              <div
                key={doc.id}
                id={`pending-doc-row-${doc.id}`}
                className={`${
                  supplierDocShell ? 'supplier-detail-tab-shell' : SUMMARY_HIGHLIGHT_SURFACE_CLASS
                } overflow-hidden transition-opacity ${stato === 'done' ? 'opacity-[0.58] saturate-[0.85]' : ''} ${
                  rowTheme.border
                }`}
              >
                <div className={`app-card-bar-accent ${rowTheme.bar}`} aria-hidden />
                <div className="flex gap-2.5 p-2.5 md:gap-3 md:p-3">
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
                    className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-app-line-28 bg-transparent transition-opacity hover:opacity-80 md:h-8 md:w-8`}
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
                      : (
                        <svg
                          className={`h-6 w-6 md:h-4 md:w-4 ${supplierDocShell ? 'text-slate-400' : 'text-app-fg-muted'}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      )}
                  </button>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <div className="relative flex min-w-0 items-center gap-1.5">
                        <p
                          className={`truncate text-sm font-semibold ${
                            isUnknown ? 'text-orange-200' : supplierDocShell ? 'text-slate-100' : 'text-app-fg'
                          }`}
                        >
                          {nomeFornitore ?? `⚠ ${t.statements.unknownSender}`}
                        </p>
                        {docAllowsAssociationFlow(doc.stato) && (
                          <button onClick={() => setEditSupplier(editSupplier === doc.id ? null : doc.id)}
                            title={t.statements.editSupplierTitle}
                            className={`shrink-0 rounded-md p-1 transition-colors hover:text-cyan-200 ${
                              supplierDocShell
                                ? 'text-slate-300 hover:bg-slate-700/80'
                                : 'text-app-fg-muted hover:bg-app-line-10'
                            }`}>
                            <svg className={`w-3.5 h-3.5 ${icon.settingsTools}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-x-2 gap-y-1.5">
                        {/* Tipo documento: ordine / bolla / fattura / estratto (mutua esclusione, persistito su DB) */}
                        {docAllowsAssociationFlow(doc.stato) && (() => {
                          const pk = pendingKindForDoc(doc, statementDocs)
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
                              activeCls: 'border-[rgba(34,211,238,0.15)] bg-fuchsia-500/15 text-fuchsia-200',
                            },
                            {
                              kind: 'bolla',
                              label: t.statements.docKindBolla,
                              title: t.statements.docKindHintBolla,
                              activeCls: 'border-[rgba(34,211,238,0.15)] bg-amber-500/15 text-amber-200',
                            },
                            {
                              kind: 'fattura',
                              label: t.statements.docKindFattura,
                              title: t.statements.docKindHintFattura,
                              activeCls: 'border-[rgba(34,211,238,0.15)] bg-emerald-500/15 text-emerald-200',
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
                                    pk === kind
                                      ? activeCls
                                      : 'border-app-line-30 bg-transparent text-app-fg-muted hover:border-app-line-35 hover:bg-app-line-10 hover:text-app-fg'
                                  }`}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          )
                        })()}
                        {docAllowsAssociationFlow(doc.stato) && pendingKindForDoc(doc, statementDocs) !== null && (
                          !doc.fornitore_id ? (
                            <p className="max-w-[11rem] text-right text-[11px] leading-snug text-orange-200/95 sm:max-w-none sm:text-left">
                              {t.statements.finalizeNeedsSupplier}
                            </p>
                          ) : (
                            <button
                              type="button"
                              disabled={finalizingTipoId === doc.id || (actions[doc.id] ?? 'idle') === 'loading'}
                              onClick={() => void finalizzaTipo(doc.id)}
                              className={`min-h-[36px] shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 touch-manipulation ${
                                pendingKindForDoc(doc, statementDocs) === 'ordine'
                                  ? 'border-[rgba(34,211,238,0.15)] bg-fuchsia-500/15 text-fuchsia-100 hover:bg-fuchsia-500/25'
                                  : 'border-[rgba(34,211,238,0.15)] bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25'
                              }`}
                            >
                              {finalizingTipoId === doc.id
                                ? t.statements.btnFinalizing
                                : pendingKindForDoc(doc, statementDocs) === 'fattura'
                                  ? t.statements.btnFinalizeFattura
                                  : pendingKindForDoc(doc, statementDocs) === 'bolla'
                                    ? t.statements.btnFinalizeBolla
                                    : pendingKindForDoc(doc, statementDocs) === 'ordine'
                                      ? t.statements.btnFinalizeOrdine
                                      : t.statements.btnFinalizeStatement}
                            </button>
                          )
                        )}
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${
                          doc.stato === 'bozza_creata'
                            ? 'bg-emerald-500/20 text-emerald-200 ring-emerald-500/35'
                            : docAllowsAssociationFlow(doc.stato)
                              ? 'bg-orange-500/20 text-orange-100 ring-orange-500/40'
                              : doc.stato === 'associato'
                                ? 'bg-emerald-500/25 text-emerald-100 ring-emerald-500/40'
                                : 'bg-slate-800/90 text-slate-200 ring-slate-600/60'
                        }`}>
                          {doc.stato === 'bozza_creata' ? t.statements.tagBozzaCreata
                            : docAllowsAssociationFlow(doc.stato) ? t.statements.tagPending
                            : doc.stato === 'associato' ? t.statements.tagAssociated
                            : t.statements.tagDiscarded}
                        </span>
                        {docNeedsManualProcessing(doc.stato) && (
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

                    <p
                      className={`mb-0.5 truncate text-xs ${supplierDocShell ? 'text-slate-300' : 'text-app-fg-muted'}`}
                    >
                      {doc.oggetto_mail ?? doc.mittente}
                    </p>
                    <div
                      className={`flex flex-wrap items-center gap-3 text-xs ${supplierDocShell ? 'text-slate-300' : 'text-app-fg-muted'}`}
                    >
                      {officialDocDateIso ? (
                        <span className="font-medium text-cyan-300">
                          {t.statements.labelDocDate} {fmt(officialDocDateIso)}
                        </span>
                      ) : null}
                      <span className={officialDocDateIso ? 'text-slate-400' : ''}>
                        {t.statements.labelReceived} {fmt(doc.created_at)}
                      </span>
                      <OpenDocumentInAppButton
                        documentoId={doc.id}
                        fileUrl={doc.file_url}
                        className="border-0 bg-transparent p-0 text-left text-xs font-inherit text-cyan-300 hover:text-cyan-200 hover:underline"
                      >
                        {t.statements.openFile}
                      </OpenDocumentInAppButton>
                      {docNeedsManualProcessing(doc.stato) && doc.file_url && (
                        <button
                          type="button"
                          disabled={reanalyzingDocId === doc.id}
                          title={t.statements.reanalyzeDocTitle}
                          onClick={() => void reanalyzeDocOcr(doc.id)}
                          className="border-0 bg-transparent p-0 text-xs font-semibold text-amber-200/95 hover:text-amber-100 hover:underline disabled:opacity-45"
                        >
                          {reanalyzingDocId === doc.id ? t.common.loading : t.statements.reanalyzeDocButton}
                        </button>
                      )}
                      {doc.stato === 'bozza_creata' && doc.metadata?.bozza_id && (
                        <Link
                          href={hrefWithReturnTo(
                            `/${doc.metadata.bozza_tipo === 'fattura' ? 'fatture' : 'bolle'}/${doc.metadata.bozza_id}`,
                            pendingListReturnPath,
                          )}
                          onClick={() => saveScrollForListPath(pendingListReturnPath)}
                          className="inline-flex items-center gap-1 font-semibold text-emerald-400 hover:text-emerald-300 hover:underline"
                        >
                          <svg
                            className={`w-3 h-3 ${doc.metadata.bozza_tipo === 'fattura' ? icon.fatture : icon.bolle}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          {doc.metadata.bozza_tipo === 'fattura' ? t.statements.gotoFatturaDraft : t.statements.gotoBollaDraft}
                        </Link>
                      )}
                    </div>
                  </div>
                </div>

                {addressClusterPeersByDocId.has(doc.id) &&
                  docNeedsManualProcessing(doc.stato) && (
                  <div
                    className={`mx-3 mb-2 rounded-lg border border-cyan-500/35 px-3 py-2 ring-1 ring-inset ring-cyan-400/10 ${
                      supplierDocShell ? 'bg-cyan-950/40' : 'bg-transparent'
                    }`}
                  >
                    <p
                      className={`text-[11px] leading-snug ${
                        supplierDocShell ? 'text-cyan-50/95' : 'text-app-fg-muted'
                      }`}
                    >
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
                        docAllowsAssociationFlow(doc.stato)
                          ? () => setEditSupplier(doc.id)
                          : undefined
                      }
                    />
                  </div>
                )}

                {/* Statement Panel: solo con fornitore (altrimenti la verifica mensile non ha senso) */}
                {isStmt && docAllowsAssociationFlow(doc.stato) && doc.fornitore_id && (
                  <div className="px-3 pb-3">
                    <StatementPanel doc={doc} onRequestMissing={() => {}} countryCode={countryCode} />
                  </div>
                )}

                {/* Match actions — multi-select. Se è «estratto» ma fornitore mancante, mostra comunque le bolle per poter associare e fissare il fornitore. Ordine: solo finalizza in header, niente bolle. */}
                {docAllowsAssociationFlow(doc.stato) &&
                  pendingKindForDoc(doc, statementDocs) !== 'ordine' &&
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
                        <p
                          className={`py-2 text-xs ${supplierDocShell ? 'text-slate-400' : 'text-app-fg-muted'}`}
                        >
                          {t.statements.noBolleAttesa}
                        </p>
                      ) : (
                        <div
                          className={`divide-y overflow-hidden rounded-lg border ${
                            supplierDocShell
                              ? 'divide-slate-600/45 border-slate-600/45 bg-slate-900/25'
                              : 'divide-app-line-15 border-app-line-28 bg-transparent'
                          }`}
                        >
                          {/* Auto-suggest button */}
                          {ocrTotal !== null && bolleAbbinamentoPool.length > 0 && (
                            <div
                              className={`flex items-center justify-between gap-2 px-3 py-2 ${
                                supplierDocShell ? 'bg-slate-900/40' : 'border-b border-app-line-15 bg-transparent'
                              }`}
                            >
                              <span
                                className={`text-[11px] ${supplierDocShell ? 'text-slate-200' : 'text-app-fg-muted'}`}
                              >
                                {t.statements.docTotalLabel}{' '}
                                <span
                                  className={`font-semibold ${supplierDocShell ? 'text-slate-100' : 'text-app-fg'}`}
                                >
                                  {formatCurrency(ocrTotal, countryCode, rowCurrency)}
                                </span>
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  autoSuggest(doc, bolleAbbinamentoPool, ocrTotal)
                                }
                                className="whitespace-nowrap rounded-md border border-cyan-500/40 bg-cyan-500/15 px-2 py-1 text-[10px] font-semibold text-cyan-200 transition-colors hover:bg-cyan-500/25"
                              >
                                ✦ Suggerisci auto
                              </button>
                            </div>
                          )}

                          {/* Bolle in sospeso (stesso fornitore della fattura) | tutta la sede se doc senza fornitore + ricerca */}
                          {bolleListaPrincipale.length > 0 ? (
                            <>
                              <div
                                className={`px-3 py-2 ${supplierDocShell ? 'bg-slate-900/55' : 'border-b border-app-line-15 bg-transparent'}`}
                              >
                                <span
                                  className={`block text-[10px] font-semibold uppercase tracking-wide ${
                                    supplierDocShell ? 'text-slate-400' : 'text-app-fg-muted'
                                  }`}
                                >
                                  {t.statements.bolleDaCollegamentiSectionTitle}
                                </span>
                                <span className={`mt-1 block text-[11px] ${supplierDocShell ? 'text-slate-200' : 'text-app-fg-muted'}`}>
                                  {fornitoreDocId != null ? (
                                    <>
                                      {nomeFornitore ?? '—'} · {bolleListaPrincipale.length} bolla
                                      {bolleListaPrincipale.length !== 1 ? 'e' : ''}
                                    </>
                                  ) : (
                                    <>
                                      {t.statements.bollesFullSiteListSubtitle} · {bolleListaPrincipale.length} bolla
                                      {bolleListaPrincipale.length !== 1 ? 'e' : ''}
                                    </>
                                  )}
                                </span>
                              </div>
                              {bolleListaPrincipale.map((b) => {
                                const checked = selIds.includes(b.id)
                                return (
                                  <label
                                    key={b.id}
                                    className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors ${
                                      supplierDocShell
                                        ? `hover:bg-slate-800/55 ${checked ? 'bg-cyan-500/12' : ''}`
                                        : `hover:bg-app-line-10 ${checked ? 'bg-cyan-500/[0.08]' : ''}`
                                    }`}
                                  >
                                    <input type="checkbox" checked={checked} onChange={() => toggleBolla(b.id)}
                                      className="h-4 w-4 cursor-pointer rounded border-app-line-35 bg-transparent text-cyan-500 focus:ring-cyan-500/40" />
                                    <span
                                      className={`flex-1 text-sm ${supplierDocShell ? 'text-slate-200' : 'text-app-fg'}`}
                                    >
                                      {!fornitoreDocId ? (
                                        <span className={`text-[11px] ${supplierDocShell ? 'text-slate-400' : 'text-app-fg-muted'}`}>
                                          {b.fornitore_nome} ·{' '}
                                        </span>
                                      ) : null}
                                      {b.numero_bolla ? (
                                        <span className="font-mono font-medium">#{b.numero_bolla}</span>
                                      ) : (
                                        '—'
                                      )}{' '}
                                      <span
                                        className={`text-xs ${supplierDocShell ? 'text-slate-400' : 'text-app-fg-muted'}`}
                                      >
                                        · {fmt(b.data)}
                                      </span>
                                    </span>
                                    {b.importo !== null && (
                                      <span
                                        className={`text-sm font-semibold tabular-nums ${
                                          checked
                                            ? 'text-cyan-300'
                                            : supplierDocShell
                                              ? 'text-slate-200'
                                              : 'text-app-fg-muted'
                                        }`}
                                      >
                                        {formatCurrency(b.importo, countryCode, rowCurrency)}
                                      </span>
                                    )}
                                  </label>
                                )
                              })}
                            </>
                          ) : (
                            <p
                              className={`px-3 py-2.5 text-xs leading-snug ${
                                supplierDocShell ? 'text-slate-400' : 'text-app-fg-muted'
                              }`}
                            >
                              {!fornitoreDocId && !matchExpandedAllSuppliers && bolleAperte.length > 0
                                ? t.statements.bollesMatchAssociateSupplierHint
                                : fornitoreDocId
                                  ? t.statements.bollePendingNoneForThisSupplier
                                  : t.statements.noBolleAttesa}
                            </p>
                          )}

                          {canSearchMoreBolles ? (
                            <div
                              className={`px-3 py-2 ${
                                supplierDocShell ? 'border-t border-slate-700/55 bg-slate-900/35' : 'border-t border-app-line-15 bg-app-line-06/50'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setMatchIncludeAllSuppliersBolles((prev) => ({
                                    ...prev,
                                    [doc.id]: !matchExpandedAllSuppliers,
                                  }))
                                }
                                className={`text-[11px] font-semibold underline decoration-dotted underline-offset-2 transition-colors ${
                                  supplierDocShell
                                    ? 'text-cyan-200/95 hover:text-cyan-50'
                                    : 'text-cyan-500/95 hover:text-cyan-300'
                                }`}
                              >
                                {matchExpandedAllSuppliers
                                  ? t.statements.bollesShowOnlyThisSupplier
                                  : t.statements.bollesSearchAcrossAllSuppliers}
                              </button>
                            </div>
                          ) : null}

                          {/* Lista estesa (altri fornitori) — solo dopo "Cerca tra tutti..." con doc già associato */}
                          {bolleAltriFornitoriEspansi.length > 0 && (
                            <>
                              <div
                                className={`px-3 py-1.5 ${supplierDocShell ? 'bg-slate-900/55' : 'border-t border-app-line-15 bg-transparent'}`}
                              >
                                <span
                                  className={`text-[10px] font-semibold uppercase tracking-wide ${
                                    supplierDocShell ? 'text-slate-400' : 'text-app-fg-muted'
                                  }`}
                                >
                                  {t.statements.bollesExtendedOtherSuppliersSubtitle} ·{' '}
                                  {bolleAltriFornitoriEspansi.length}
                                </span>
                              </div>
                              {bolleAltriFornitoriEspansi.map((b) => {
                                const checked = selIds.includes(b.id)
                                return (
                                  <label
                                    key={b.id}
                                    className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors ${
                                      supplierDocShell
                                        ? `hover:bg-slate-800/55 ${checked ? 'bg-cyan-500/12' : ''}`
                                        : `hover:bg-app-line-10 ${checked ? 'bg-cyan-500/[0.08]' : ''}`
                                    }`}
                                  >
                                    <input type="checkbox" checked={checked} onChange={() => toggleBolla(b.id)}
                                      className="h-4 w-4 cursor-pointer rounded border-app-line-35 bg-transparent text-cyan-500 focus:ring-cyan-500/40" />
                                    <span className={`flex-1 text-sm ${supplierDocShell ? 'text-slate-200' : 'text-app-fg'}`}>
                                      <span
                                        className={`text-[11px] ${supplierDocShell ? 'text-slate-400' : 'text-app-fg-muted'}`}
                                      >
                                        {b.fornitore_nome} ·{' '}
                                      </span>
                                      {b.numero_bolla ? <span className="font-mono font-medium">#{b.numero_bolla}</span> : '—'}{' '}
                                      <span
                                        className={`text-xs ${supplierDocShell ? 'text-slate-400' : 'text-app-fg-muted'}`}
                                      >
                                        · {fmt(b.data)}
                                      </span>
                                    </span>
                                    {b.importo !== null && (
                                      <span
                                        className={`text-sm font-semibold tabular-nums ${
                                          supplierDocShell ? 'text-slate-200' : 'text-app-fg-muted'
                                        }`}
                                      >
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
                          <span
                            className={`text-xs font-medium ${supplierDocShell ? 'text-slate-400' : 'text-app-fg-muted'}`}
                          >
                            {t.statements.selectedSumLabel}{' '}
                            <span className={`font-bold ${supplierDocShell ? 'text-slate-100' : 'text-app-fg'}`}>
                              {formatCurrency(selSum, countryCode, rowCurrency)}
                            </span>
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

                {docAllowsAssociationFlow(doc.stato) && pendingKindForDoc(doc, statementDocs) === 'ordine' && (
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
                {docAllowsAssociationFlow(doc.stato) && isStmt && (
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
  ok:                        { cls: 'border border-[rgba(34,211,238,0.15)] bg-emerald-500/15 text-emerald-200',   dot: 'bg-green-500',  icon: '✓' },
  fattura_mancante:          { cls: 'border border-[rgba(34,211,238,0.15)] bg-yellow-500/15 text-yellow-200', dot: 'bg-yellow-400', icon: '!' },
  bolle_mancanti:            { cls: 'border border-[rgba(34,211,238,0.15)] bg-orange-500/15 text-orange-200', dot: 'bg-orange-500', icon: '⚠' },
  errore_importo:            { cls: 'border border-[rgba(34,211,238,0.15)] bg-red-500/15 text-red-200',          dot: 'bg-red-500',    icon: '✗' },
  rekki_prezzo_discordanza:  { cls: 'border border-[rgba(34,211,238,0.15)] bg-amber-500/12 text-amber-100',   dot: 'bg-amber-400',  icon: '⚠' },
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
CREATE POLICY "srow_write"   ON public.statement_rows FOR ALL    USING (auth.role() = 'service_role');

ALTER TABLE public.statements ADD COLUMN IF NOT EXISTS extracted_pdf_dates jsonb;`

function MigrationCard() {
  const t = useT()
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(STMT_MIGRATION_SQL).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2500)
    })
  }
  return (
    <div className={`${SUMMARY_HIGHLIGHT_SURFACE_CLASS} mb-6 overflow-hidden border-[rgba(34,211,238,0.15)]`}>
      <div className={`app-card-bar-accent ${SUMMARY_HIGHLIGHT_ACCENTS.amber.bar}`} aria-hidden />
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
            copied ? 'border-[rgba(34,211,238,0.15)] bg-emerald-500/20 text-emerald-200' : 'border-[rgba(34,211,238,0.15)] bg-amber-500/20 text-amber-100 hover:bg-amber-500/30'
          }`}>
          {copied ? (
            <><svg className={`w-3.5 h-3.5 ${icon.success}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>{t.statements.migrationCopied}</>
          ) : (
            <><svg className={`w-3.5 h-3.5 ${icon.settingsTools}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>{t.statements.migrationCopySQL}</>
          )}
        </button>
      </div>
      <details className="border-t border-[rgba(34,211,238,0.15)]">
        <summary className="cursor-pointer select-none px-5 py-2 text-[11px] text-amber-300/90 transition-colors hover:bg-slate-700/50">{t.statements.migrationShowSQL}</summary>
        <pre className="overflow-x-auto whitespace-pre bg-slate-700/50 px-5 py-3 font-mono text-[10px] text-amber-100/90">{STMT_MIGRATION_SQL}</pre>
      </details>
    </div>
  )
}

export type SupplierDesktopVerificaMode = 'full' | 'classicToolbar' | 'statementsPanel'

export function VerificationStatusTab({
  sedeId,
  fornitoreId,
  countryCode,
  currency,
  year,
  month,
  ledgerDateFrom,
  ledgerDateToExclusive,
  cardAccent = 'cyan',
  supplierDesktopVerificaMode,
}: {
  sedeId?: string
  fornitoreId?: string
  countryCode?: string
  currency?: string
  year?: number
  month?: number
  /** Scheda fornitore: stesso intervallo date del navigatore header (fine esclusa in query). */
  ledgerDateFrom?: string
  ledgerDateToExclusive?: string
  /** Scheda fornitore: allinea barra/bordo al tab (es. `cyan` per «Verifica»). */
  cardAccent?: SummaryHighlightAccent
  /**
   * Desktop scheda fornitore: split «bolle periodo» sopra la griglia KPI vs inbox nel pannello.
   * Solo con `fornitoreId`; altrimenti ignorato.
   */
  supplierDesktopVerificaMode?: SupplierDesktopVerificaMode
}) {
  const router = useRouter()
  const [stmtHeaderRefreshPending, startStmtHeaderRefresh] = useTransition()
  const now = new Date()
  const loc = getLocale(countryCode)
  const resolvedCurrency = currency ?? loc.currency ?? 'EUR'
  const { showToast } = useToast()
  const t = useT()
  const formatStmtDate = useFmt()
  const MONTHS = t.statements.months
  const STATUS_CONFIG = useStatusConfig()
  const shell = SUMMARY_HIGHLIGHT_ACCENTS[cardAccent]
  const vsEmbeddedSupplier = Boolean(fornitoreId)
  const vsTabHi = vsEmbeddedSupplier ? SUPPLIER_DETAIL_TAB_HIGHLIGHT.verifica : null
  const vsCardWrap = vsEmbeddedSupplier ? 'supplier-detail-tab-shell' : SUMMARY_HIGHLIGHT_SURFACE_CLASS
  const vsCardBorder = vsEmbeddedSupplier ? vsTabHi!.border : shell.border
  const vsCardBar = vsEmbeddedSupplier ? vsTabHi!.bar : shell.bar
  const vsBarEl = 'app-card-bar-accent'
  /** Inside unified Section 2 shell on supplier desktop: one accent bar only — nested blocks use border tokens. */
  const vsS2NestedBorder = 'rounded-xl border border-app-line-15 overflow-hidden'
  const vsS2KpiCard = vsEmbeddedSupplier
    ? `${vsS2NestedBorder} flex flex-col text-center`
    : `${vsCardWrap} flex flex-col overflow-hidden text-center ${vsCardBorder}`
  const vsS2LoadingEmptyWrap = vsEmbeddedSupplier
    ? 'flex flex-col overflow-hidden text-center py-12'
    : `${vsCardWrap} flex flex-col overflow-hidden text-center ${vsCardBorder}`
  const vsS2GroupWrap = vsEmbeddedSupplier
    ? vsS2NestedBorder
    : `${vsCardWrap} overflow-hidden ${vsCardBorder}`

  const verificaMode: SupplierDesktopVerificaMode =
    fornitoreId && supplierDesktopVerificaMode ? supplierDesktopVerificaMode : 'full'
  const s2ShellMb = verificaMode === 'classicToolbar' ? 'mb-0' : 'mb-5'
  /** Blocco «bolle periodo» sotto inbox su desktop fornitore: layout più denso. */
  const vsCompactS2 = verificaMode === 'classicToolbar'
  /** Inbox estratti in cima al pannello tab Verifica (desktop fornitore): card più compatta. */
  const vsCompactS1 = verificaMode === 'statementsPanel' && vsEmbeddedSupplier

  /* ── Statement list (received via email) ─────────────────── */
  type StmtRecord = {
    id: string
    email_subject: string | null
    received_at: string
    extracted_pdf_dates?: StmtExtractedPdfDates | null
    file_url: string | null
    status: 'processing' | 'done' | 'error'
    total_rows: number
    missing_rows: number
    fornitore_nome: string | null
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
  const searchParams = useSearchParams()
  useEffect(() => {
    const raw = searchParams.get('stato')?.trim().toLowerCase()
    if (raw === 'anomalia' || raw === 'rekki_prezzo_discordanza') {
      setCheckFilter('rekki_prezzo_discordanza')
    }
  }, [searchParams])

  const verificaProdottoRaw = searchParams.get('verifica_prodotto')?.trim() ?? ''

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
    const useLedgerRange = Boolean(fornitoreId && ledgerDateFrom && ledgerDateToExclusive)
    const from = useLedgerRange ? ledgerDateFrom! : `${anno}-${String(mese).padStart(2,'0')}-01`
    const to   = useLedgerRange ? ledgerDateToExclusive! : new Date(anno, mese, 1).toISOString().split('T')[0]
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
  }, [anno, mese, sedeId, fornitoreId, ledgerDateFrom, ledgerDateToExclusive, t.statements.unknownSupplier])

  useEffect(() => {
    if (verificaMode === 'statementsPanel') return
    fetchData()
  }, [fetchData, verificaMode])

  // Restore sent-sollecito state from server logs on mount
  useEffect(() => {
    if (verificaMode === 'statementsPanel') return
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
  }, [sedeId, verificaMode])

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

  useEffect(() => {
    if (verificaMode === 'classicToolbar') return
    void fetchStmts(true)
  }, [fetchStmts, verificaMode])

  useEffect(() => {
    const onLayoutRefresh = () => {
      if (verificaMode !== 'classicToolbar') void fetchStmts(false)
      if (verificaMode !== 'statementsPanel') void fetchData()
    }
    window.addEventListener(STATEMENTS_LAYOUT_REFRESH_EVENT, onLayoutRefresh)
    return () => window.removeEventListener(STATEMENTS_LAYOUT_REFRESH_EVENT, onLayoutRefresh)
  }, [fetchStmts, fetchData, verificaMode])

  useEffect(() => {
    setSelectedStmt(null)
    setCheckResults(null)
    setCheckError(null)
  }, [sedeId, fornitoreId])

  useEffect(() => {
    if (stmtsLoading || !selectedStmt) return
    if (stmts.some(s => s.id === selectedStmt.id)) return
    setSelectedStmt(null)
    setCheckResults(null)
    setCheckError(null)
  }, [stmts, stmtsLoading, selectedStmt])

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

  const periodSelectCls = vsEmbeddedSupplier
    ? vsCompactS2
      ? 'rounded-md border border-app-line-28 bg-transparent px-2 py-1.5 text-xs text-app-fg focus:border-app-line-40 focus:outline-none focus:ring-1 focus:ring-app-line-30 [color-scheme:dark]'
      : 'rounded-lg border border-app-line-28 bg-transparent px-3 py-2 text-sm text-app-fg focus:border-app-line-40 focus:outline-none focus:ring-1 focus:ring-app-line-30 [color-scheme:dark]'
    : 'rounded-lg border border-app-line-28 bg-transparent px-3 py-2 text-sm text-app-fg focus:border-app-line-40 focus:outline-none focus:ring-1 focus:ring-app-line-30 [color-scheme:dark]'

  const hideEmbeddedPeriodSelects =
    Boolean(vsEmbeddedSupplier && ledgerDateFrom && ledgerDateToExclusive)

  const periodSelects = hideEmbeddedPeriodSelects ? null : (
    <>
      <select value={mese} onChange={(e) => setMese(Number(e.target.value))} className={periodSelectCls}>
        {MONTHS.map((m, i) => (
          <option key={i + 1} value={i + 1}>
            {m}
          </option>
        ))}
      </select>
      <select value={anno} onChange={(e) => setAnno(Number(e.target.value))} className={periodSelectCls}>
        {anni.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
    </>
  )

  return (
    <>
      {/* ── Migration guide (shown only when tables are missing) ── */}
      {needsMigration && verificaMode !== 'classicToolbar' && (
        <MigrationCard />
      )}

      {verificaMode !== 'classicToolbar' && (
      <>
      {/* ════════ SECTION 1 — Statement inbox (received via email) ════════ */}
      <div className={`${vsCardWrap} ${vsCompactS1 ? 'mb-3' : 'mb-4'} w-full min-w-0 overflow-hidden ${vsCardBorder}`}>
        <div className={`${vsBarEl} ${vsCardBar}`} aria-hidden />
        {/* Header */}
        <div
          className={
            vsEmbeddedSupplier
              ? vsCompactS1
                ? 'flex items-center justify-between gap-2 border-b border-app-soft-border bg-transparent px-3 py-2'
                : 'flex min-h-10 items-center justify-between gap-3 border-b border-app-soft-border bg-transparent px-4 py-2.5'
              : 'flex min-h-10 items-center justify-between gap-3 border-b border-app-soft-border bg-transparent px-4 py-2.5'
          }
        >
          <div className={`flex min-w-0 flex-1 items-center ${vsCompactS1 ? 'gap-1.5' : 'gap-2'}`}>
            <svg
              className={`${vsCompactS1 ? 'h-3 w-3' : 'h-3.5 w-3.5'} shrink-0 text-cyan-400/90`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            <p
              className={`font-semibold ${vsCompactS1 ? 'text-xs' : 'text-sm'} text-app-fg`}
            >
              {t.statements.stmtReceived}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            {selectedStmt && (
              <button
                type="button"
                onClick={() => {
                  setSelectedStmt(null)
                  setCheckResults(null)
                  setCheckError(null)
                }}
                className={
                  vsEmbeddedSupplier
                    ? vsCompactS1
                      ? 'inline-flex items-center gap-1 rounded-md border border-app-line-28 bg-transparent px-2 py-1 text-[11px] font-semibold text-app-fg transition-colors hover:border-app-cyan-500/35 hover:bg-cyan-500/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-line-40'
                      : 'inline-flex items-center gap-1 rounded-lg border-t-2 border-t-[#22d3ee] border-x-0 border-b-0 bg-white/[0.04] px-2.5 py-1.5 text-xs font-semibold text-app-fg transition-colors hover:border-app-cyan-500/35 hover:bg-cyan-500/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-line-40'
                    : 'inline-flex items-center gap-1 rounded-lg border-t-2 border-t-[#22d3ee] border-x-0 border-b-0 bg-white/[0.04] px-2.5 py-1.5 text-xs font-semibold text-app-fg transition-colors hover:border-app-cyan-500/35 hover:bg-cyan-500/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-line-40'
                }
              >
                <svg className={`${vsCompactS1 ? 'h-3 w-3' : 'h-3.5 w-3.5'} shrink-0 opacity-90 ${icon.statements}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                {t.statements.stmtBackToList}
              </button>
            )}
            <button
              type="button"
              disabled={stmtHeaderRefreshPending}
              aria-busy={stmtHeaderRefreshPending}
              onClick={() =>
                startStmtHeaderRefresh(() => {
                  window.dispatchEvent(new Event(STATEMENTS_LAYOUT_REFRESH_EVENT))
                  router.refresh()
                  void fetchStmts(false)
                })
              }
              className={
                vsEmbeddedSupplier
                  ? vsCompactS1
                    ? 'inline-flex items-center gap-1 rounded-md border border-app-line-28 bg-transparent px-2 py-1 text-[11px] font-semibold text-app-fg transition-colors hover:border-app-cyan-500/35 hover:bg-cyan-500/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-line-40 disabled:pointer-events-none disabled:opacity-50'
                    : 'inline-flex items-center gap-1 rounded-lg border-t-2 border-t-[#22d3ee] border-x-0 border-b-0 bg-white/[0.04] px-2.5 py-1.5 text-xs font-semibold text-app-fg transition-colors hover:border-app-cyan-500/35 hover:bg-cyan-500/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-line-40 disabled:pointer-events-none disabled:opacity-50'
                  : 'inline-flex items-center gap-1 rounded-lg border-t-2 border-t-[#22d3ee] border-x-0 border-b-0 bg-white/[0.04] px-2.5 py-1.5 text-xs font-semibold text-app-fg transition-colors hover:border-app-cyan-500/35 hover:bg-cyan-500/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-line-40 disabled:pointer-events-none disabled:opacity-50'
              }
            >
              <svg
                className={`${vsCompactS1 ? 'h-3 w-3' : 'h-3.5 w-3.5'} shrink-0 opacity-90 ${icon.emailSync} ${stmtHeaderRefreshPending ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {t.statements.btnRefresh}
            </button>
          </div>
        </div>

        {/* Migration needed */}
        {needsMigration && (
          <div className={vsCompactS1 ? 'flex items-start gap-2 px-3 py-3' : 'flex items-start gap-2.5 px-4 py-4'}>
            <svg
              className={`${vsCompactS1 ? 'h-4 w-4' : 'w-5 h-5'} shrink-0 text-amber-500 mt-0.5`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
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
            <div className={vsCompactS1 ? 'px-3 py-4 text-center' : 'px-4 py-6 text-center'}>
              <div
                className={`inline-flex items-center gap-2 ${vsCompactS1 ? 'text-xs' : 'text-sm'} text-app-fg-muted`}
              >
                <svg className={`${vsCompactS1 ? 'h-3.5 w-3.5' : 'h-4 w-4'} animate-spin text-cyan-500`} fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                {t.statements.stmtInboxEmailScanning}
              </div>
            </div>
          ) : stmts.length === 0 ? (
            <div className={vsCompactS1 ? 'px-3 py-4 text-center' : 'px-4 py-6 text-center'}>
              <p className={`font-medium ${vsCompactS1 ? 'text-xs' : 'text-sm'} text-app-fg`}>
                {t.statements.stmtEmpty}
              </p>
              <p
                className={`mx-auto mt-1 text-xs leading-snug sm:leading-relaxed ${vsCompactS1 ? 'max-w-2xl' : 'max-w-xs'} text-app-fg-muted`}
              >
                {t.statements.stmtInboxEmptyDetail}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-app-line-15">
              {stmts.map(s => (
                <button key={s.id} onClick={() => loadStatementRows(s)}
                  className={
                    vsEmbeddedSupplier
                      ? vsCompactS1
                        ? 'flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-cyan-500/[0.08] active:bg-cyan-500/[0.12]'
                        : 'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-cyan-500/[0.08] active:bg-cyan-500/[0.12]'
                      : 'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-cyan-500/[0.08] active:bg-cyan-500/[0.12]'
                  }
                >
                  {/* Status dot */}
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    s.status === 'processing' ? 'bg-blue-400 animate-pulse' :
                    s.missing_rows > 0 ? 'bg-red-400' : 'bg-green-400'
                  }`} />
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`truncate font-medium ${vsCompactS1 && vsEmbeddedSupplier ? 'text-xs' : 'text-sm'} text-app-fg`}
                    >
                      {s.fornitore_nome ?? s.email_subject ?? 'Statement'}
                    </p>
                    {s.email_subject && s.fornitore_nome && (
                      <p className="truncate text-xs text-app-fg-muted">
                        {s.email_subject}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-app-fg-muted">
                      {(() => {
                        const official = stmtOfficialDateIso(s)
                        if (official) {
                          return (
                            <>
                              <span className="font-medium tabular-nums text-app-fg">
                                {formatStmtDate(official)}
                              </span>
                              <span className="text-app-fg-muted"> · </span>
                              <span className="text-app-fg-muted">
                                {t.statements.labelReceived} {formatStmtDate(s.received_at)}
                              </span>
                            </>
                          )
                        }
                        return formatStmtDate(s.received_at)
                      })()}
                    </p>
                  </div>
                  {/* Counts */}
                  {s.status === 'processing' ? (
                    <span className="text-xs font-medium text-cyan-400">{t.statements.stmtListProcessing}</span>
                  ) : s.status === 'error' ? (
                    <span className="text-xs text-red-500 font-medium">{t.statements.stmtListParseError}</span>
                  ) : (
                    <div className="text-right shrink-0">
                      <p className="text-xs font-semibold text-app-fg-muted">
                        {t.statements.stmtRowsCount.replace(/\{n\}/g, String(s.total_rows))}
                      </p>
                      {s.missing_rows > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(34,211,238,0.15)] bg-red-500/15 px-1.5 py-0.5 text-[10px] font-bold text-red-200">
                          {(s.missing_rows === 1 ? t.statements.stmtAnomalies_one : t.statements.stmtAnomalies_other).replace(/\{n\}/g, String(s.missing_rows))}
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-emerald-400">✓ OK</span>
                      )}
                    </div>
                  )}
                  <svg
                    className="w-4 h-4 shrink-0 opacity-80 text-app-fg-muted"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          )
        )}

        {/* Selected statement — loading rows */}
        {selectedStmt && checkLoading && (
          <div
            className="px-4 py-6 text-center text-sm text-app-fg-muted"
          >
            {t.statements.loadingResults}
          </div>
        )}
        {/* errors are shown as toasts — no inline error block needed */}

        {/* Intestazione estratto + riepilogo campi letti dal PDF (account, plafond, ultimo pagamento, …) */}
        {selectedStmt && (
          <div className="flex min-h-10 items-start justify-between gap-3 border-b border-app-soft-border bg-transparent px-4 py-2.5">
            <div className="min-w-0 flex-1 pr-2">
              <p className="truncate text-sm font-semibold text-app-fg">
                {selectedStmt.fornitore_nome ?? selectedStmt.email_subject ?? 'Statement'}
              </p>
              {hasStmtPdfSummary(selectedStmt.extracted_pdf_dates) && (
                <StmtPdfSummaryGrid
                  pdf={selectedStmt.extracted_pdf_dates as StmtExtractedPdfDates}
                  t={t}
                  formatStmtDate={formatStmtDate}
                  countryCode={countryCode}
                />
              )}
              <div
                className={`text-xs font-normal text-app-fg-muted ${hasStmtPdfSummary(selectedStmt.extracted_pdf_dates) ? 'mt-2' : 'mt-1'}`}
              >
                <span className="text-app-fg-muted">{t.statements.receivedOn}</span>{' '}
                <span className="tabular-nums text-app-fg">{formatStmtDate(selectedStmt.received_at)}</span>
                {selectedStmt.file_url && (
                  <>
                    <span className="text-app-fg-muted"> · </span>
                    <OpenDocumentInAppButton
                      statementId={selectedStmt.id}
                      fileUrl={selectedStmt.file_url}
                      className="ml-0.5 inline-flex shrink-0 items-center rounded-lg border border-app-cyan-400/40 bg-transparent px-2.5 py-1.5 text-xs font-semibold text-app-cyan-200 transition-colors hover:border-app-cyan-400/60 hover:bg-cyan-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-line-40"
                    >
                      {t.statements.openPdf}
                    </OpenDocumentInAppButton>
                  </>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                fetch(`/api/statements?id=${selectedStmt.id}&action=recheck`).then(() => loadStatementRows(selectedStmt))
              }
              className="inline-flex shrink-0 items-center gap-1 self-start rounded-lg border border-app-line-28 bg-transparent px-2.5 py-1.5 text-xs font-semibold text-app-fg transition-colors hover:border-app-cyan-500/40 hover:bg-cyan-500/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-line-40"
            >
              <svg className={`h-3.5 w-3.5 shrink-0 opacity-90 ${icon.emailSync}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {t.statements.reanalyze}
            </button>
          </div>
        )}

        {/* Results */}
        {checkResults && (
          <div className="min-w-0 w-full">
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
                <div className="flex min-h-10 flex-wrap items-center gap-2 border-b border-app-soft-border bg-transparent px-4 py-2.5">
                  <span className="shrink-0 text-sm font-bold text-app-fg">
                    {t.statements.tabVerifica}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                    {chips.map(chip => (
                      <button key={chip.id} onClick={() => setCheckFilter(checkFilter === chip.id ? 'all' : chip.id)}
                        className={`flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold transition-all whitespace-nowrap ${
                          checkFilter === chip.id
                            ? 'border-app-cyan-400/45 bg-cyan-500/15 text-app-fg'
                            : 'border-app-line-28 bg-transparent text-app-fg-muted hover:border-app-line-40 hover:bg-white/[0.04]'
                        }`}>
                        <span className={`w-2 h-2 rounded-full ${chip.dot} ${checkFilter === chip.id ? 'opacity-80' : ''}`} />
                        {chip.label}
                        <span className="font-bold">· {chip.count}</span>
                      </button>
                    ))}
                  </div>
                  {checkFilter !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setCheckFilter('all')}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-app-line-28 bg-transparent px-2.5 py-1.5 text-xs font-semibold text-app-fg transition-colors hover:border-app-cyan-500/40 hover:bg-cyan-500/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-line-40"
                    >
                      <svg className={`h-3.5 w-3.5 shrink-0 opacity-90 ${icon.settingsTools}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      {t.statements.clearFilter}
                    </button>
                  )}
                </div>
              )
            })()}

            {/* Per-line results — mobile cards */}
            <div className="md:hidden divide-y divide-app-soft-border">
            {checkResults.filter(
              r =>
                (checkFilter === 'all' || r.status === checkFilter) &&
                checkResultMatchesVerificaProdotto(r, verificaProdottoRaw),
            ).map(r => {
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
                <div
                  key={r.numero}
                  className={`flex items-start gap-3 border-b border-app-line-15 px-4 py-3 last:border-0 ${
                    r.status === 'rekki_prezzo_discordanza'
                      ? 'bg-amber-950/45 ring-1 ring-inset ring-amber-400/35'
                      : r.status === 'errore_importo'
                        ? 'bg-red-950/20 ring-1 ring-inset ring-red-500/15'
                        : r.status === 'pending'
                          ? vsEmbeddedSupplier
                            ? 'bg-slate-700/40'
                            : 'bg-transparent'
                          : r.status !== 'ok'
                            ? vsEmbeddedSupplier
                              ? 'bg-slate-700/50'
                              : 'bg-transparent'
                            : ''
                  }`}
                >
                  <div className={`mt-0.5 w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span
                        className={`text-sm font-semibold font-mono ${
                          r.status === 'rekki_prezzo_discordanza' ? 'text-slate-50' : 'text-app-fg'
                        }`}
                      >
                        {r.numero}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.cls}`}>{cfg.icon} {cfg.label}</span>
                      {r.status === 'ok' && (
                        <span className="text-xs font-medium text-emerald-400">{formatCurrency(r.importoStatement, countryCode, resolvedCurrency)} ✓</span>
                      )}
                    </div>
                    <div className="space-y-0.5 text-xs text-app-fg-muted">
                      <p>
                        {t.statements.reconcileStatement}{' '}
                        <span className="font-semibold text-app-fg">
                          {formatCurrency(r.importoStatement, countryCode, resolvedCurrency)}
                        </span>
                        {r.fattura?.importo !== null && r.fattura?.importo !== undefined && (
                          <> · {t.statements.reconcileDB}{' '}
                            <span className={`font-semibold ${
                              r.status === 'errore_importo'
                                ? 'text-red-300'
                                : r.status === 'rekki_prezzo_discordanza'
                                  ? 'text-amber-400'
                                  : 'text-app-fg'
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
                        <p>
                          {t.fatture.invoice}:{' '}
                          <span className="font-medium text-app-fg">{r.fattura.numero_fattura ?? '—'}</span>
                          {r.fattura.file_url && (
                            <OpenDocumentInAppButton
                              fatturaId={r.fattura.id}
                              fileUrl={r.fattura.file_url}
                              className="ml-1 inline border-0 bg-transparent p-0 font-inherit text-cyan-400 transition-colors hover:text-cyan-300 hover:underline"
                            >
                              PDF →
                            </OpenDocumentInAppButton>
                          )}
                        </p>
                      )}
                      {r.bolle.length > 0 && (
                        <p>{t.nav.bolle}: {r.bolle.map(b => (
                          <span key={b.id} className="inline-flex items-center gap-1 mr-1.5">
                            <span className="font-mono text-app-fg">{b.numero_bolla ?? '—'}</span>
                            {b.importo !== null && (
                              <span className="text-app-fg">({formatCurrency(b.importo, countryCode, resolvedCurrency)})</span>
                            )}
                          </span>
                        ))}</p>
                      )}
                      {r.status === 'bolle_mancanti' && <p className="text-orange-300 font-medium">{t.statements.noBolleDelivery}</p>}
                      {r.fornitore && (
                        <p className="text-app-fg-muted">
                          {fornitoreNomeMaiuscolo(r.fornitore.nome)}
                          {r.fornitore.email && <span> · {r.fornitore.email}</span>}
                        </p>
                      )}
                    </div>
                  </div>
                  {needAction && (
                    sollecitoState === 'sent' ? (
                      <div className="shrink-0 flex flex-col items-center gap-0.5 text-center">
                        <span className="flex items-center gap-1 rounded-lg border border-[rgba(34,211,238,0.15)] bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-200">
                          <svg className={`w-3.5 h-3.5 ${icon.success}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                          {t.statements.btnSent}
                        </span>
                        {sollEntry.sentAt && (
                          <span className="text-[10px] text-app-fg-muted">
                            {new Intl.DateTimeFormat(loc.currencyLocale, {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            }).format(new Date(sollEntry.sentAt))}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => inviaSollecito(r)}
                          className="mt-0.5 text-[10px] font-medium text-app-fg-muted underline underline-offset-2 hover:text-app-fg"
                        >
                          {t.statements.btnSendReminder}
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => inviaSollecito(r)} disabled={!hasEmail || sollecitoState === 'loading'} title={!hasEmail ? t.statements.noEmailForSupplier : undefined}
                        className={`shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border transition-colors min-h-[38px] touch-manipulation ${
                          !hasEmail
                            ? 'cursor-not-allowed border-app-line-28 bg-transparent text-app-fg-muted'
                          : r.status === 'fattura_mancante' ? 'border-[rgba(34,211,238,0.15)] bg-yellow-500/15 text-yellow-100 hover:bg-yellow-500/25'
                          : 'border-[rgba(34,211,238,0.15)] bg-orange-500/15 text-orange-100 hover:bg-orange-500/25'}`}>
                        {sollecitoState === 'loading' ? (
                          <svg className={`w-3.5 h-3.5 animate-spin ${icon.emailSync}`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                        ) : (
                          <svg className={`w-3.5 h-3.5 ${icon.emailSync}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        )}
                        {sollecitoState === 'loading' ? t.statements.btnSending : t.statements.btnSendReminder}
                      </button>
                    )
                  )}
                </div>
              )
            })}
            </div>

            {/* Per-line results — desktop table (table-fixed + % colgroup = usa tutta la larghezza) */}
            <div className="hidden min-w-0 w-full overflow-x-auto md:block">
              <table className="w-full min-w-[860px] table-fixed text-sm leading-tight">
                <colgroup>
                  <col className="w-[2%]" />
                  <col className="w-[12%]" />
                  <col className="w-[14%]" />
                  <col className="w-[8%]" />
                  <col className="w-[8%]" />
                  <col className="w-[15%]" />
                  <col className="w-[14%]" />
                  <col className="w-[7%]" />
                  <col className="w-[20%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-app-line-15">
                    <th className="py-2 pl-1 pr-0" />
                    <th className="py-2 pl-0 pr-1 text-left text-[10px] font-bold uppercase tracking-wide text-app-fg-muted">
                      {t.statements.colRef}
                    </th>
                    <th className="py-2 pl-0 pr-1 text-left text-[10px] font-bold uppercase tracking-wide text-app-fg-muted">
                      {t.statements.colStatus}
                    </th>
                    <th className="py-2 pl-0 pr-1 text-left text-[10px] font-bold uppercase tracking-wide text-app-fg-muted">
                      {t.statements.tripleColStmtDate}
                    </th>
                    <th className="py-2 pl-0 pr-1 text-left text-[10px] font-bold uppercase tracking-wide text-app-fg-muted">
                      {t.statements.tripleColSysDate}
                    </th>
                    <th className="py-2 pl-0 pr-1 text-right text-[10px] font-bold uppercase tracking-wide text-app-fg-muted">
                      {t.statements.tripleColStmtAmount}
                    </th>
                    <th className="py-2 pl-0 pr-1 text-right text-[10px] font-bold uppercase tracking-wide text-app-fg-muted">
                      {t.statements.tripleColSysAmount}
                    </th>
                    <th className="py-2 px-0.5 text-center text-[10px] font-bold uppercase tracking-wide text-app-fg-muted">
                      {t.statements.tripleColChecks}
                    </th>
                    <th className="py-2 pl-1 pr-2 text-center text-[10px] font-bold uppercase tracking-wide text-app-fg-muted">
                      {t.statements.colAction}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-line-15">
                  {checkResults.filter(
                    r =>
                      (checkFilter === 'all' || r.status === checkFilter) &&
                      checkResultMatchesVerificaProdotto(r, verificaProdottoRaw),
                  ).map(r => {
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
                      <tr
                        key={r.numero}
                        className={`hover:bg-cyan-500/[0.06] transition-colors group ${
                        r.status === 'rekki_prezzo_discordanza'
                          ? 'bg-amber-950/45 ring-1 ring-inset ring-amber-400/35'
                          : r.status === 'errore_importo'
                            ? 'bg-red-950/20 ring-1 ring-inset ring-red-500/15'
                            : ''
                      }`}
                      >
                        {/* Chevron */}
                        <td className="py-2 pl-1 pr-0 align-middle">
                          <svg
                            className="mx-auto h-3 w-3 text-app-fg-muted transition-colors group-hover:text-app-fg"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M7 10l5 5 5-5z" />
                          </svg>
                        </td>

                        {/* Reference */}
                        <td className="min-w-0 py-2 pl-0 pr-1 align-middle">
                          <span
                            className={`block truncate font-mono text-xs font-bold ${
                              r.status === 'rekki_prezzo_discordanza' ? 'text-slate-50' : 'text-app-fg'
                            }`}
                            title={r.numero}
                          >
                            {r.numero}
                          </span>
                        </td>

                        {/* Status badge */}
                        <td className="min-w-0 py-2 pl-0 pr-1 align-middle">
                          <span
                            className={`inline-flex max-w-full items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] font-semibold leading-tight ${cfg.cls}`}
                          >
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_STYLE[r.status].dot}`} />
                            <span className="min-w-0 break-words text-left">{cfg.label}</span>
                          </span>
                        </td>

                        {/* Stmt Date */}
                        <td className="whitespace-nowrap py-2 pl-0 pr-1 align-middle text-xs text-app-fg-muted">
                          {fmtDate(r.data_doc)}
                        </td>

                        {/* Sys Date (fattura date) */}
                        <td className="whitespace-nowrap py-2 pl-0 pr-1 align-middle text-xs text-app-fg-muted">
                          {fmtDate(r.fattura?.data)}
                        </td>

                        {/* Stmt Amount */}
                        <td
                          className={`whitespace-nowrap py-2 pl-0 pr-1 text-right align-middle text-sm font-bold tabular-nums tracking-tight ${
                            r.status === 'rekki_prezzo_discordanza' ? 'text-amber-50' : 'text-app-fg'
                          }`}
                        >
                          {formatCurrency(r.importoStatement, countryCode, resolvedCurrency)}
                        </td>

                        {/* Sys Amount */}
                        <td className="min-w-0 py-2 pl-0 pr-1 text-right align-middle tabular-nums text-sm whitespace-nowrap">
                          {r.fattura?.importo !== null && r.fattura?.importo !== undefined ? (
                            <div className="inline-flex flex-col items-end gap-0.5">
                              <span className={
                                r.status === 'errore_importo'
                                  ? 'text-red-300 font-bold'
                                  : r.status === 'rekki_prezzo_discordanza'
                                    ? 'text-amber-400 font-bold'
                                    : 'text-app-fg'
                              }>
                                {formatCurrency(r.fattura.importo, countryCode, resolvedCurrency)}
                              </span>
                              {r.status === 'rekki_prezzo_discordanza' && r.deltaImporto !== null && (
                                <span className="text-[10px] font-bold text-amber-400">
                                  Δ {r.deltaImporto > 0 ? '+' : ''}{formatCurrency(Math.abs(r.deltaImporto), countryCode, resolvedCurrency)}
                                </span>
                              )}
                              {r.status === 'rekki_prezzo_discordanza' && (
                                <span className="max-w-full text-right text-[9px] font-medium leading-tight text-amber-100">
                                  {t.bolle.verificaPrezzoFornitore} · {t.bolle.prezzoDaApp}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-app-fg-muted">—</span>
                          )}
                        </td>

                        {/* Checks — 4 colored segments */}
                        <td className="py-2 px-0.5 align-middle">
                          <div className="flex items-center justify-center gap-px">
                            {checks.map((pass, i) => {
                              const isLast = i === 3
                              if (r.status === 'rekki_prezzo_discordanza' && isLast) {
                                return (
                                  <div
                                    key={i}
                                    title={t.statements.rekkiCheckSegmentTooltip}
                                    className="h-2 w-5 shrink-0 rounded-sm bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.45)]"
                                  />
                                )
                              }
                              return (
                                <div
                                  key={i}
                                  className={`h-2 w-5 shrink-0 rounded-sm ${pass ? 'bg-green-500' : 'bg-app-line-35'}`}
                                />
                              )
                            })}
                          </div>
                        </td>

                        {/* Action */}
                        <td className="py-2 pl-1 pr-2 text-center align-middle">
                          {needAction && (
                            sollecitoState === 'sent' ? (
                              <div className="mx-auto inline-flex max-w-full flex-col items-center gap-0.5">
                                <span className="flex items-center gap-0.5 rounded-md border border-[rgba(34,211,238,0.15)] bg-emerald-500/15 px-2 py-1 text-[11px] font-bold text-emerald-200">
                                  <svg className={`h-3.5 w-3.5 shrink-0 ${icon.success}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                  </svg>
                                  {t.statements.btnSent}
                                </span>
                                {sollEntry.sentAt && (
                                  <span className="text-[10px] text-app-fg-muted">
                                    {new Intl.DateTimeFormat(loc.currencyLocale, { day: '2-digit', month: 'short' }).format(
                                      new Date(sollEntry.sentAt),
                                    )}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => inviaSollecito(r)}
                                disabled={!hasEmail || sollecitoState === 'loading'}
                                title={!hasEmail ? t.statements.noEmailForSupplier : undefined}
                                className={`mx-auto flex w-full max-w-[9.5rem] items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-bold transition-colors ${
                                  !hasEmail
                                    ? 'cursor-not-allowed border-app-line-28 bg-transparent text-app-fg-muted'
                                    : 'border-[rgba(34,211,238,0.15)] bg-amber-500/20 text-amber-100 hover:bg-amber-500/30'
                                }`}
                              >
                                {sollecitoState === 'loading' ? (
                                  <svg className={`h-3.5 w-3.5 shrink-0 animate-spin ${icon.emailSync}`} fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                  </svg>
                                ) : (
                                  <svg className={`h-3.5 w-3.5 shrink-0 ${icon.emailSync}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                    />
                                  </svg>
                                )}
                                <span className="min-w-0 text-left leading-tight">
                                  {sollecitoState === 'loading' ? t.statements.btnSending : t.statements.btnSendReminder}
                                </span>
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
      </>
      )}
      {verificaMode !== 'statementsPanel' && (
      <>
      {/* ════════ SECTION 2 — Classic bolla/fattura overview ════════ */}
      <div
        className={
          vsEmbeddedSupplier
            ? `supplier-detail-tab-shell ${s2ShellMb} overflow-hidden ${vsTabHi!.border}`
            : 'contents'
        }
      >
        {vsEmbeddedSupplier ? (
          <>
            <div className={`app-card-bar-accent ${vsTabHi!.bar}`} aria-hidden />
            <div
              className={
                vsCompactS2
                  ? 'flex min-w-0 flex-nowrap items-center justify-between gap-2 overflow-x-auto border-b border-app-line-20 px-3 py-2 sm:gap-3 sm:px-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
                  : 'flex min-w-0 flex-nowrap items-center justify-between gap-3 overflow-x-auto border-b border-app-line-20 px-4 py-2.5 sm:px-5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
              }
            >
              <p
                className={
                  vsCompactS2
                    ? 'min-w-0 flex-1 truncate text-[10px] font-semibold uppercase tracking-wide text-app-fg-muted'
                    : 'min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wide text-app-fg-muted'
                }
              >
                {t.statements.bolleSummaryByPeriod}
              </p>
              <div className={vsCompactS2 ? 'flex shrink-0 items-center gap-2' : 'flex shrink-0 items-center gap-3'}>
                {periodSelects}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="mb-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-app-fg-muted">
                {t.statements.bolleSummaryByPeriod}
              </p>
            </div>
            <div className="mb-5 flex flex-wrap gap-3">{periodSelects}</div>
          </>
        )}

        <div
          className={
            vsEmbeddedSupplier
              ? vsCompactS2
                ? 'space-y-2 px-3 pb-3 pt-1.5 sm:px-4 sm:pb-3'
                : 'space-y-4 px-4 pb-4 pt-2 sm:px-5 sm:pb-5'
              : undefined
          }
        >
      {/* Global KPIs */}
      {!loading && tutteBolle.length > 0 && (
        <div className={`grid grid-cols-1 sm:grid-cols-3 ${vsCompactS2 ? 'gap-2' : 'gap-3'} ${vsEmbeddedSupplier ? '' : 'mb-5'}`}>
          {[
            { label: t.bolle.title, value: tutteBolle.length, cls: 'text-app-fg' },
            { label: t.statements.classicComplete, value: completi, cls: 'text-emerald-400' },
            { label: t.statements.classicMissing,  value: mancanti, cls: 'text-red-500' },
          ].map(c => (
            <div key={c.label} className={vsS2KpiCard}>
              {!vsEmbeddedSupplier ? (
                <div className={`${vsBarEl} shrink-0 ${vsCardBar}`} aria-hidden />
              ) : null}
              <div className={vsCompactS2 ? 'p-2.5 sm:p-3' : 'p-4'}>
                <p className={`${vsCompactS2 ? 'text-xl' : 'text-2xl'} font-bold ${c.cls}`}>{c.value}</p>
                <p
                  className="mt-0.5 text-xs uppercase tracking-wide text-app-fg-muted"
                >
                  {c.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bulk select bar */}
      {selezione.size > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-[rgba(34,211,238,0.15)] bg-amber-500/10 px-4 py-3">
          <span className="flex-1 text-sm font-medium text-amber-200">
            {selezione.size} bolla{selezione.size !== 1 ? 'e' : ''} selezionata{selezione.size !== 1 ? '' : ''}
          </span>
          <button onClick={requestSelected} disabled={invioMultiplo === 'loading'}
            className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 min-h-[44px] bg-amber-500 hover:bg-amber-600 active:bg-amber-700 disabled:opacity-50 text-white rounded-lg touch-manipulation">
            <svg className={`w-4 h-4 ${icon.emailSync}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {invioMultiplo === 'loading' ? t.statements.classicRequesting : invioMultiplo === 'sent' ? t.statements.classicSent : t.statements.classicRequestAll}
          </button>
          <button
            type="button"
            onClick={() => setSelezione(new Set())}
            className="text-xs text-app-fg-muted hover:text-app-fg"
          >
            {t.common.cancel}
          </button>
        </div>
      )}

      {!loading && mancanti > 0 && selezione.size === 0 && (
        <button onClick={() => setSelezione(new Set(mancantiIds))}
          className="mb-4 text-sm text-cyan-400 font-medium hover:opacity-75">
          {t.statements.classicMissing} ({mancanti})
        </button>
      )}

      {loading ? (
        <div
          className={
            vsEmbeddedSupplier && vsCompactS2
              ? 'flex flex-col overflow-hidden text-center py-5'
              : vsS2LoadingEmptyWrap
          }
        >
          {!vsEmbeddedSupplier ? (
            <div className={`${vsBarEl} shrink-0 ${vsCardBar}`} aria-hidden />
          ) : null}
          <div
            className={
              vsEmbeddedSupplier
                ? vsCompactS2
                  ? 'px-4 py-4'
                  : 'px-6 py-8'
                : 'px-6 py-16'
            }
          >
            <p
              className={
                vsCompactS2 && vsEmbeddedSupplier ? 'text-xs text-app-fg-muted' : 'text-sm text-app-fg-muted'
              }
            >
              {t.common.loading}
            </p>
          </div>
        </div>
      ) : gruppi.length === 0 ? (
        <div
          className={
            vsEmbeddedSupplier && vsCompactS2
              ? 'flex flex-col overflow-hidden text-center py-5'
              : vsS2LoadingEmptyWrap
          }
        >
          {!vsEmbeddedSupplier ? (
            <div className={`${vsBarEl} shrink-0 ${vsCardBar}`} aria-hidden />
          ) : null}
          <div
            className={
              vsEmbeddedSupplier
                ? vsCompactS2
                  ? 'px-4 py-5'
                  : 'px-6 py-10'
                : 'px-6 py-16'
            }
          >
            <p
              className={`${vsCompactS2 && vsEmbeddedSupplier ? 'text-xs' : 'text-sm'} font-medium text-app-fg-muted`}
            >
              {t.statements.bollePeriodEmpty} — {t.statements.months[mese - 1]} {anno}
            </p>
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
              <div key={g.fornitore_id} className={vsS2GroupWrap}>
                {!vsEmbeddedSupplier ? (
                  <div className={`${vsBarEl} ${vsCardBar}`} aria-hidden />
                ) : null}
                {/* Supplier header with Verification Triangle */}
                <div className="border-b border-app-soft-border bg-transparent px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="font-semibold text-app-fg">{g.nome}</h2>
                      <p className="mt-0.5 text-xs text-app-fg-muted">
                        {gTotal} bolla{gTotal !== 1 ? 'e' : ''} nel periodo
                      </p>
                    </div>
                    {/* Verification Triangle */}
                    <div className="flex items-center gap-2">
                      <div
                        className="flex min-w-[60px] flex-col items-center rounded-lg border border-app-line-28 bg-transparent px-3 py-1.5"
                      >
                        <span className="text-xs font-bold text-app-fg">{gTotal}</span>
                        <span className="text-[9px] uppercase tracking-wide text-app-fg-muted">Bolle</span>
                      </div>
                      <svg className="h-3 w-3 text-app-fg-muted"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                      <div
                        className="flex min-w-[60px] flex-col items-center rounded-lg border-t-2 border-t-[#22d3ee] border-x-0 border-b-0 bg-white/[0.04] px-3 py-1.5"
                      >
                        <span className="text-xs font-bold text-emerald-400">{gVerified}</span>
                        <span className="text-[9px] uppercase tracking-wide text-app-fg-muted">Fatture</span>
                      </div>
                      <svg className="h-3 w-3 text-app-fg-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                      <div
                        className={`flex min-w-[60px] flex-col items-center rounded-lg border px-3 py-1.5 ${
                          allGood ? 'border-[rgba(34,211,238,0.15)] bg-emerald-500/10' : 'border-[rgba(34,211,238,0.15)] bg-red-500/10'
                        }`}
                      >
                        <span className={`text-xs font-bold ${allGood ? 'text-emerald-300' : 'text-red-300'}`}>{gMissing}</span>
                        <span className={`text-[9px] uppercase tracking-wide ${allGood ? 'text-green-400' : 'text-red-400'}`}>Diff.</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* GRN rows */}
                <div className="divide-y divide-app-soft-border">
                  {g.bolle.map(bolla => {
                    const missing = !bolla.fattura
                    const stato   = invio[bolla.id]
                    return (
                      <div
                        key={bolla.id}
                        className={`flex flex-wrap items-center gap-3 px-5 py-3.5 ${
                          missing ? 'bg-amber-500/[0.08]' : ''
                        }`}
                      >
                        {missing && (
                          <input type="checkbox" checked={selezione.has(bolla.id)}
                            onChange={() => setSelezione(p => {
                              const n = new Set(p)
                              if (n.has(bolla.id)) n.delete(bolla.id); else n.add(bolla.id)
                              return n
                            })}
                            className="rounded border-app-line-35 bg-transparent text-cyan-400 focus:ring-cyan-500"
                          />
                        )}
                        <span className="text-sm font-medium text-app-fg">{fmt(bolla.data)}</span>
                        <span className="flex-1" />
                        {bolla.fattura ? (
                          <>
                            <span className="rounded-full border border-[rgba(34,211,238,0.15)] bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-200">✓ Verificata</span>
                            {bolla.fattura.file_url && (
                              <OpenDocumentInAppButton
                                fatturaId={bolla.fattura.id}
                                fileUrl={bolla.fattura.file_url}
                                className="border-0 bg-transparent p-0 text-xs font-inherit text-cyan-400 transition-colors hover:text-cyan-300 hover:underline"
                              >
                                {fmt(bolla.fattura.data)} →
                              </OpenDocumentInAppButton>
                            )}
                          </>
                        ) : (
                          <>
                            <span className="rounded-full border border-[rgba(34,211,238,0.15)] bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-300">Fattura mancante</span>
                            <button onClick={() => requestSingle(bolla.id)} disabled={stato === 'loading' || stato === 'sent'}
                              className="flex min-h-[44px] items-center gap-1 rounded-lg border border-[rgba(34,211,238,0.15)] bg-amber-500/15 px-3 py-2.5 text-xs font-semibold text-amber-100 transition-colors hover:bg-amber-500/25 disabled:opacity-50 touch-manipulation">
                              <svg className={`w-3 h-3 ${icon.emailSync}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[rgba(34,211,238,0.15)] bg-red-500/10 px-5 py-3">
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
        </div>
      </div>
      </>
      )}



    </>
  )
}
