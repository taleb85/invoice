'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { thumbnailUrl } from '@/lib/storage-transform'
import { getLocale, formatCurrency } from '@/lib/localization'

/* ── Constants ──────────────────────────────────────────────── */
const MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']

/* ── Types ──────────────────────────────────────────────────── */
type OcrMetadata = {
  ragione_sociale:    string | null
  p_iva:              string | null
  data_fattura:       string | null
  numero_fattura:     string | null
  totale_iva_inclusa: number | null
  matched_by:         'email' | 'alias' | 'domain' | 'piva' | 'unknown' | null
}

type Documento = {
  id: string
  created_at: string
  fornitore_id: string | null
  mittente: string
  oggetto_mail: string | null
  file_url: string
  file_name: string | null
  content_type: string | null
  data_documento: string | null
  stato: 'in_attesa' | 'da_associare' | 'associato' | 'scartato'
  is_statement: boolean
  metadata?: OcrMetadata | null
  fornitore?: { nome: string; email?: string } | null
}

type BollaAperta = { id: string; data: string; fornitore_id: string; fornitore_nome: string }
type Fornitore   = { id: string; nome: string }

type BollaConFattura = {
  id: string
  data: string
  stato: string
  fornitore_id: string
  fattura: { id: string; data: string; file_url: string | null } | null
}
type SupplierGroup = { fornitore_id: string; nome: string; bolle: BollaConFattura[] }

function fmt(d: string | null) {
  if (!d) return '—'
  return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d))
}

function monthLabel(d: string | null) {
  if (!d) return '—'
  const dt = new Date(d)
  return `${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`
}

/* ── Tab selector ───────────────────────────────────────────── */
type Tab = 'pending' | 'status'

/** Named export so sede-specific and fornitore-specific wrapper pages can render with a fixed context. */
export function StatementsContent({ sedeId, fornitoreId, countryCode }: { sedeId?: string; fornitoreId?: string; countryCode?: string }) {
  const [tab, setTab] = useState<Tab>('pending')

  return (
    <div className={fornitoreId ? '' : 'p-4 md:p-8 max-w-5xl'}>
      {!fornitoreId && (
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Verifica Estratti Conto Mensili</h1>
          <p className="text-sm text-gray-500 mt-1">
            Associa i documenti ricevuti alle bolle aperte e verifica gli estratti conto dei fornitori
          </p>
        </div>
      )}

      {/* Tab bar — horizontally scrollable on mobile */}
      <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 mb-6" style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-max">
          <button
            onClick={() => setTab('pending')}
            className={`px-4 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap touch-manipulation ${tab === 'pending' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700 active:bg-white/60'}`}
          >
            Da Associare
          </button>
          <button
            onClick={() => setTab('status')}
            className={`px-4 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap touch-manipulation ${tab === 'status' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700 active:bg-white/60'}`}
          >
            Stato Verifica
          </button>
        </div>
      </div>

      {tab === 'pending'
        ? <PendingMatchesTab sedeId={sedeId} fornitoreId={fornitoreId} countryCode={countryCode} />
        : <VerificationStatusTab sedeId={sedeId} fornitoreId={fornitoreId} countryCode={countryCode} />}
    </div>
  )
}

export default function StatementsPage() {
  return <StatementsContent />
}

/* ══════════════════════════════════════════════════════════════
   Popup "Edit Supplier"
   ══════════════════════════════════════════════════════════════ */
function EditSupplierPopup({
  docId, current, fornitori, onSaved, onClose,
}: {
  docId: string
  current: string | null
  fornitori: Fornitore[]
  onSaved: (fornitoreId: string, nome: string) => void
  onClose: () => void
}) {
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
    setSaving(false)
    if (res.ok) { onSaved(f.id, f.nome); onClose() }
  }

  return (
    <div ref={ref} className="absolute z-30 top-full mt-1 left-0 w-64 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
      <div className="p-2 border-b border-gray-100">
        <input
          autoFocus value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Cerca fornitore…"
          className="w-full text-sm px-3 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>
      <ul className="max-h-52 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <li className="px-3 py-2 text-xs text-gray-400">Nessun risultato</li>
        ) : filtered.map(f => (
          <li key={f.id}>
            <button disabled={saving} onClick={() => pick(f)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${f.id === current ? 'font-semibold text-accent' : 'text-gray-700'}`}>
              {f.nome}{f.id === current && <span className="ml-1 text-[10px] text-accent">✓</span>}
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
function AiDataCard({ metadata, matchConfidence, countryCode }: { metadata: OcrMetadata; matchConfidence?: string; countryCode?: string }) {
  const loc = getLocale(countryCode)
  const confidenceLabel: Record<string, { label: string; cls: string }> = {
    email:   { label: 'Associato per email',   cls: 'text-green-700 bg-green-100' },
    alias:   { label: 'Associato per alias',   cls: 'text-green-700 bg-green-100' },
    domain:  { label: 'Associato per dominio', cls: 'text-blue-700 bg-blue-100' },
    piva:    { label: `Associato per ${loc.vat}`, cls: 'text-purple-700 bg-purple-100' },
    unknown: { label: 'Non associato',         cls: 'text-amber-700 bg-amber-100' },
  }
  const conf = confidenceLabel[metadata.matched_by ?? 'unknown'] ?? confidenceLabel.unknown

  return (
    <div className="mt-2 mx-1 rounded-xl border border-violet-200 bg-violet-50/50 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-violet-200 bg-violet-50">
        {/* Brain / AI icon */}
        <svg className="w-3.5 h-3.5 text-violet-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <span className="text-[10px] font-semibold text-violet-600 uppercase tracking-wide">Dati estratti dall&apos;IA</span>
        <span className={`ml-auto text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${conf.cls}`}>{conf.label}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 px-3 py-2.5 text-xs">
        {metadata.ragione_sociale && (
          <div className="col-span-2">
            <span className="text-gray-400">Azienda · </span>
            <span className="font-medium text-gray-700">{metadata.ragione_sociale}</span>
          </div>
        )}
        {metadata.p_iva && (
          <div>
            <span className="text-gray-400">{loc.vatLabel} · </span>
            <span className="font-medium text-gray-700 font-mono">{metadata.p_iva}</span>
          </div>
        )}
        {metadata.numero_fattura && (
          <div>
            <span className="text-gray-400">N. Fattura · </span>
            <span className="font-medium text-gray-700">{metadata.numero_fattura}</span>
          </div>
        )}
        {metadata.data_fattura && (
          <div>
            <span className="text-gray-400">Data · </span>
            <span className="font-medium text-gray-700">{fmt(metadata.data_fattura)}</span>
          </div>
        )}
        {metadata.totale_iva_inclusa !== null && (
          <div>
            <span className="text-gray-400">Totale ({loc.vat} incl.) · </span>
            <span className="font-semibold text-gray-900">{formatCurrency(metadata.totale_iva_inclusa, countryCode)}</span>
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
    <div className="mt-3 mx-1 bg-blue-50/60 border border-blue-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-blue-50 border-b border-blue-200">
        <div className="flex items-center gap-2">
          {/* ClipboardCheck icon */}
          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <span className="text-sm font-semibold text-blue-800">Verifica Estratto Conto</span>
          <span className="text-xs text-blue-500">
            — {(doc.fornitore as { nome: string } | null)?.nome ?? 'Fornitore sconosciuto'}
          </span>
        </div>
        {/* Month picker */}
        <div className="flex items-center gap-1.5">
          <select value={month.month} onChange={e => setMonth(p => ({ ...p, month: Number(e.target.value) }))}
            className="text-xs border border-blue-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
            {MONTHS.map((m,i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
          <select value={month.year} onChange={e => setMonth(p => ({ ...p, year: Number(e.target.value) }))}
            className="text-xs border border-blue-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
            {Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - i).map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-px bg-blue-200">
        {[
          { label: 'Bolle', value: bolle.length, color: 'text-gray-800' },
          { label: 'Fatture', value: matched.length, color: 'text-green-700' },
          { label: 'Differenza', value: missing.length, color: missing.length > 0 ? 'text-red-600' : 'text-green-700' },
        ].map(c => (
          <div key={c.label} className="bg-white px-4 py-3 text-center">
            <p className={`text-xl font-bold ${c.color}`}>{loading ? '—' : c.value}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Checklist */}
      <div className="bg-white divide-y divide-gray-50">
        {loading ? (
          <p className="text-xs text-gray-400 text-center py-4">Caricamento…</p>
        ) : bolle.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">
            Nessuna bolla trovata per questo fornitore in {MONTHS[month.month-1]} {month.year}
          </p>
        ) : bolle.map(bolla => (
          <div key={bolla.id} className="flex items-center gap-3 px-4 py-2.5">
            <span className={`flex-none w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold ${bolla.fattura ? 'bg-green-500' : 'bg-red-400'}`}>
              {bolla.fattura ? '✓' : '✗'}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-700 font-medium">Bolla · {fmt(bolla.data)}</p>
              {bolla.fattura ? (
                <p className="text-xs text-green-600">Fattura del {fmt(bolla.fattura.data)}
                  {bolla.fattura.file_url && <> · <a href={bolla.fattura.file_url} target="_blank" rel="noopener noreferrer" className="underline">Apri →</a></>}
                </p>
              ) : (
                <p className="text-xs text-red-500">Fattura mancante</p>
              )}
            </div>
            {bolla.fattura ? (
              <span className="text-[10px] font-semibold px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Verificata</span>
            ) : (
              <span className="text-[10px] font-semibold px-2 py-0.5 bg-red-100 text-red-600 rounded-full">Discrepanza</span>
            )}
          </div>
        ))}
      </div>

      {/* Request Missing Documents button */}
      {!loading && missing.length > 0 && (
        <div className="px-4 py-3 bg-red-50 border-t border-red-100 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-red-700 font-medium">{missing.length} fattura{missing.length > 1 ? 'e' : ''} mancante{missing.length > 1 ? 'i' : ''} in questo estratto</p>
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
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Richiedi documenti mancanti
          </button>
        </div>
      )}
      {!loading && missing.length === 0 && bolle.length > 0 && (
        <div className="px-4 py-3 bg-green-50 border-t border-green-100 flex items-center gap-2">
          <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-xs text-green-700 font-medium">Tutte le bolle hanno una fattura corrispondente — estratto verificato ✓</p>
        </div>
      )}

      {/* Statement total from AI vs number of matched invoices */}
      {!loading && doc.metadata?.totale_iva_inclusa !== null && doc.metadata?.totale_iva_inclusa !== undefined && (
        <div className="px-4 py-3 border-t border-violet-200 bg-violet-50/40 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span className="text-xs text-violet-700 font-medium">
              Totale estratto (IA): {formatCurrency(doc.metadata.totale_iva_inclusa, countryCode)}
            </span>
          </div>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            missing.length === 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
          }`}>
            {matched.length}/{bolle.length} bolle associate
          </span>
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   TAB 1 — Pending Matches
   ══════════════════════════════════════════════════════════════ */
function PendingMatchesTab({ sedeId, fornitoreId, countryCode }: { sedeId?: string; fornitoreId?: string; countryCode?: string }) {
  const [docs, setDocs]                     = useState<Documento[]>([])
  const [loading, setLoading]               = useState(true)
  const [filter, setFilter]                 = useState<'in_attesa' | 'tutti'>('in_attesa')
  const [bolleAperte, setBolleAperte]       = useState<BollaAperta[]>([])
  const [fornitori, setFornitori]           = useState<Fornitore[]>([])
  const [selezione, setSelezione]           = useState<Record<string, string>>({})
  const [actions, setActions]               = useState<Record<string, 'idle'|'loading'|'done'|'error'>>({})
  const [preview, setPreview]               = useState<string | null>(null)
  const [editSupplier, setEditSupplier]     = useState<string | null>(null)
  const [statementDocs, setStatementDocs]   = useState<Set<string>>(new Set())  // tracked locally
  const [markingStatement, setMarkingStatement] = useState<string | null>(null)

  const fetchDocs = useCallback(async () => {
    setLoading(true)
    // Use the server-side API (service client) to bypass RLS so that documents
    // with sede_id = NULL (global IMAP / unknown sender) are visible to all users.
    const params = new URLSearchParams()
    if (filter === 'in_attesa') params.set('stati', 'in_attesa,da_associare')
    if (sedeId) params.set('sede_id', sedeId)
    if (fornitoreId) params.set('fornitore_id', fornitoreId)
    const res = await fetch(`/api/documenti-da-processare?${params.toString()}`)
    const data = res.ok ? await res.json() : []
    console.log('[Statements] pending docs:', data?.length ?? 0, res.ok ? 'ok' : `ERROR: ${res.status}`)
    setDocs((data ?? []).map((d: Record<string, unknown>) => ({ ...d, is_statement: (d.is_statement as boolean | null) ?? false })) as Documento[])
    setLoading(false)
  }, [filter, sedeId, fornitoreId])

  const fetchBolleAperte = useCallback(async () => {
    const parts: string[] = []
    if (sedeId) parts.push(`sede_id=${sedeId}`)
    if (fornitoreId) parts.push(`fornitore_id=${fornitoreId}`)
    const url = '/api/bolle-aperte' + (parts.length ? '?' + parts.join('&') : '')
    const res = await fetch(url)
    if (!res.ok) return
    const data = await res.json()
    setBolleAperte(
      (data ?? []).map((b: { id: string; data: string; fornitore_id: string; fornitori: { nome: string } | { nome: string }[] | null }) => ({
        id: b.id, data: b.data, fornitore_id: b.fornitore_id,
        fornitore_nome: (Array.isArray(b.fornitori) ? b.fornitori[0] : b.fornitori)?.nome ?? '—',
      }))
    )
  }, [sedeId, fornitoreId])

  const fetchFornitori = useCallback(async () => {
    if (fornitoreId) return  // already scoped to one supplier — skip full list fetch
    const supabase = createClient()
    let q = supabase.from('fornitori').select('id, nome').order('nome')
    if (sedeId) q = q.eq('sede_id', sedeId) as typeof q
    const { data } = await q
    setFornitori(data ?? [])
  }, [sedeId, fornitoreId])

  useEffect(() => { fetchDocs(); fetchBolleAperte(); fetchFornitori() }, [fetchDocs, fetchBolleAperte, fetchFornitori])

  async function associa(docId: string) {
    const bollaId = selezione[docId]
    if (!bollaId) return
    setActions(p => ({ ...p, [docId]: 'loading' }))
    const res = await fetch('/api/documenti-da-processare', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: docId, azione: 'associa', bolla_id: bollaId }),
    })
    if (res.ok) {
      setActions(p => ({ ...p, [docId]: 'done' }))
      setTimeout(() => { fetchDocs(); fetchBolleAperte() }, 600)
    } else {
      setActions(p => ({ ...p, [docId]: 'error' }))
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

  async function toggleStatement(docId: string) {
    setMarkingStatement(docId)
    // Try to persist to DB (requires is_statement column); fallback to local state
    const isNowStatement = !statementDocs.has(docId)
    try {
      await fetch('/api/documenti-da-processare', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: docId, azione: 'mark_statement', is_statement: isNowStatement }),
      })
    } catch { /* column may not exist yet — local state still works */ }
    setStatementDocs(prev => {
      const next = new Set(prev)
      if (next.has(docId)) next.delete(docId); else next.add(docId)
      return next
    })
    setMarkingStatement(null)
  }

  function handleSupplierUpdated(docId: string, fornitoreId: string, nome: string) {
    setDocs(prev => prev.map(d => d.id === docId ? { ...d, fornitore_id: fornitoreId, fornitore: { nome } } : d))
  }

  const isPdf = (url: string) => url.toLowerCase().includes('.pdf')
  const inAttesa = docs.filter(d => d.stato === 'in_attesa' || d.stato === 'da_associare').length

  return (
    <>
      {/* Filter bar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button onClick={() => setFilter('in_attesa')}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${filter === 'in_attesa' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
            In attesa {inAttesa > 0 && <span className="ml-1 bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{inAttesa}</span>}
          </button>
          <button onClick={() => setFilter('tutti')}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${filter === 'tutti' ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-500'}`}>
            Tutti
          </button>
        </div>
        <p className="text-xs text-gray-400">{bolleAperte.length} bolla{bolleAperte.length !== 1 ? 'e' : ''} aperta{bolleAperte.length !== 1 ? '' : ''} disponibile</p>
      </div>

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            {isPdf(preview)
              ? <iframe src={preview} className="w-full h-[80vh] rounded-xl" />
              : <img src={preview} className="w-full max-h-[80vh] object-contain rounded-xl" alt="Preview" />}
            <button onClick={() => setPreview(null)} className="mt-3 w-full text-sm text-white/70 hover:text-white">Chiudi</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-100 px-6 py-16 text-center">
          <p className="text-gray-400 text-sm">Caricamento…</p>
        </div>
      ) : docs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 px-6 py-16 text-center">
          <svg className="w-14 h-14 text-gray-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-400 text-sm font-medium">
            {filter === 'in_attesa' ? 'Nessun documento da esaminare' : 'Nessun documento trovato'}
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
              <div key={doc.id} className={`bg-white border rounded-xl overflow-hidden transition-opacity ${stato === 'done' ? 'opacity-40' : ''} ${doc.stato === 'associato' ? 'border-green-100' : doc.stato === 'da_associare' ? 'border-blue-100' : 'border-gray-100'}`}>
                <div className="flex gap-4 p-4">
                  {/* Thumbnail */}
                  <button onClick={() => setPreview(doc.file_url)}
                    className="shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-gray-50 border border-gray-100 flex items-center justify-center hover:opacity-80 transition-opacity">
                    {thumb
                      ? <img src={thumb} alt="" className="w-full h-full object-cover" />
                      : <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="relative flex items-center gap-1.5 min-w-0">
                        <p className={`font-semibold text-sm truncate ${isUnknown ? 'text-amber-600' : 'text-gray-900'}`}>
                          {nomeFornitore ?? '⚠ Mittente sconosciuto'}
                        </p>
                        {(doc.stato === 'in_attesa' || doc.stato === 'da_associare') && (
                          <button onClick={() => setEditSupplier(editSupplier === doc.id ? null : doc.id)}
                            title="Modifica fornitore"
                            className="shrink-0 p-1 rounded-md text-gray-400 hover:text-accent hover:bg-gray-100 transition-colors">
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
                          />
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Mark as Statement toggle */}
                        {(doc.stato === 'in_attesa' || doc.stato === 'da_associare') && doc.fornitore_id && (
                          <button
                            onClick={() => toggleStatement(doc.id)}
                            disabled={markingStatement === doc.id}
                            title={isStmt ? 'Rimuovi da estratto conto' : 'Aggiungi a estratto conto'}
                            className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${isStmt ? 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200' : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'}`}
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                            </svg>
                            {isStmt ? 'Estratto ✓' : 'Estratto mensile'}
                          </button>
                        )}
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          (doc.stato === 'in_attesa' || doc.stato === 'da_associare') ? (isUnknown ? 'bg-amber-100 text-amber-700' : 'bg-amber-100 text-amber-700')
                          : doc.stato === 'associato' ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                        }`}>
                          {(doc.stato === 'in_attesa' || doc.stato === 'da_associare') ? 'In attesa' : doc.stato === 'associato' ? 'Verificato' : 'Scartato'}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-gray-400 truncate mb-0.5">{doc.oggetto_mail ?? doc.mittente}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                      <span>Ricevuto: {fmt(doc.created_at)}</span>
                      {doc.data_documento && <span className="text-accent font-medium">Data doc.: {fmt(doc.data_documento)}</span>}
                      <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Apri file →</a>
                    </div>
                  </div>
                </div>

                {/* AI Extracted Data card */}
                {doc.metadata && (doc.metadata.numero_fattura || doc.metadata.totale_iva_inclusa !== null || doc.metadata.ragione_sociale || doc.metadata.p_iva) && (
                  <div className="px-4 pb-2">
                    <AiDataCard metadata={doc.metadata} countryCode={countryCode} />
                  </div>
                )}

                {/* Statement Panel */}
                {isStmt && (doc.stato === 'in_attesa' || doc.stato === 'da_associare') && (
                  <div className="px-4 pb-4">
                    <StatementPanel doc={doc} onRequestMissing={() => {}} countryCode={countryCode} />
                  </div>
                )}

                {/* Match actions */}
                {(doc.stato === 'in_attesa' || doc.stato === 'da_associare') && !isStmt && (
                  <div className="px-4 pb-4 flex items-center gap-2 flex-wrap">
                    <select
                      value={selezione[doc.id] ?? ''}
                      onChange={e => setSelezione(p => ({ ...p, [doc.id]: e.target.value }))}
                      className="flex-1 min-w-0 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent bg-white"
                    >
                      <option value="">{bolleAperte.length === 0 ? 'Nessuna bolla aperta' : 'Seleziona bolla da associare…'}</option>
                      {bolleSameSupplier.length > 0 && (
                        <optgroup label={`${nomeFornitore ?? 'Same supplier'} (${bolleSameSupplier.length})`}>
                          {bolleSameSupplier.map(b => (
                            <option key={b.id} value={b.id}>📅 {fmt(b.data)}</option>
                          ))}
                        </optgroup>
                      )}
                      {bolleOther.length > 0 && (
                        <optgroup label={`Altri fornitori (${bolleOther.length})`}>
                          {bolleOther.map(b => (
                            <option key={b.id} value={b.id}>{b.fornitore_nome} · {fmt(b.data)}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    <button
                      onClick={() => associa(doc.id)}
                      disabled={!selezione[doc.id] || stato === 'loading'}
                      className="px-4 py-2.5 min-h-[44px] bg-accent hover:bg-accent-hover active:bg-[#0e1a2a] disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap touch-manipulation"
                    >
                      {stato === 'loading' ? 'Associazione…' : stato === 'done' ? 'Completato ✓' : stato === 'error' ? 'Errore ✗' : 'Associa'}
                    </button>
                    <button
                      onClick={() => scarta(doc.id)}
                      disabled={stato === 'loading'}
                      className="px-3 py-2.5 min-h-[44px] bg-gray-100 hover:bg-gray-200 active:bg-gray-300 disabled:opacity-40 text-gray-600 text-sm font-medium rounded-lg transition-colors touch-manipulation"
                    >
                      Scarta
                    </button>
                  </div>
                )}

                {/* Statement actions (separate from match actions) */}
                {(doc.stato === 'in_attesa' || doc.stato === 'da_associare') && isStmt && (
                  <div className="px-4 pb-4 flex items-center gap-2">
                    <button
                      onClick={() => scarta(doc.id)}
                      disabled={stato === 'loading'}
                      className="px-3 py-2.5 min-h-[44px] bg-gray-100 hover:bg-gray-200 active:bg-gray-300 disabled:opacity-40 text-gray-600 text-sm font-medium rounded-lg transition-colors touch-manipulation"
                    >
                      Scarta
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

/* ══════════════════════════════════════════════════════════════
   TAB 2 — Verification Status (Supplier Triangle View)
   ══════════════════════════════════════════════════════════════ */
function VerificationStatusTab({ sedeId, fornitoreId, countryCode: _countryCode }: { sedeId?: string; fornitoreId?: string; countryCode?: string }) {
  const now = new Date()
  const [anno, setAnno]     = useState(now.getFullYear())
  const [mese, setMese]     = useState(now.getMonth() + 1)
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
      const nome = f?.nome ?? 'Fornitore sconosciuto'
      if (!map.has(b.fornitore_id)) map.set(b.fornitore_id, { fornitore_id: b.fornitore_id, nome, bolle: [] })
      const fat = Array.isArray(b.fatture) ? b.fatture : b.fatture ? [b.fatture] : []
      map.get(b.fornitore_id)!.bolle.push({
        id: b.id, data: b.data, stato: b.stato, fornitore_id: b.fornitore_id,
        fattura: fat.length > 0 ? (fat[0] as BollaConFattura['fattura']) : null,
      })
    }
    setGruppi([...map.values()])
    setLoading(false)
  }, [anno, mese, sedeId, fornitoreId])

  useEffect(() => { fetchData() }, [fetchData])

  async function requestSingle(bollaId: string) {
    setInvio(p => ({ ...p, [bollaId]: 'loading' }))
    const res = await fetch('/api/richiedi-fattura', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bolla_id: bollaId }),
    })
    setInvio(p => ({ ...p, [bollaId]: res.ok ? 'sent' : 'error' }))
  }

  async function requestSelected() {
    if (!selezione.size) return
    setInvioMultiplo('loading')
    const res = await fetch('/api/richiedi-fattura', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bolla_ids: [...selezione] }),
    })
    setInvioMultiplo(res.ok ? 'sent' : 'error')
    if (res.ok) setSelezione(new Set())
    setTimeout(() => setInvioMultiplo('idle'), 3000)
  }

  const tutteBolle  = gruppi.flatMap(g => g.bolle)
  const completi    = tutteBolle.filter(b => b.fattura).length
  const mancanti    = tutteBolle.filter(b => !b.fattura).length
  const mancantiIds = tutteBolle.filter(b => !b.fattura).map(b => b.id)
  const anni        = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i)

  return (
    <>
      {/* Period selector */}
      <div className="flex flex-wrap gap-3 mb-5">
        <select value={mese} onChange={e => setMese(Number(e.target.value))}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent bg-white">
          {MONTHS.map((m,i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <select value={anno} onChange={e => setAnno(Number(e.target.value))}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent bg-white">
          {anni.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* Global KPIs */}
      {!loading && tutteBolle.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Bolle totali', value: tutteBolle.length, cls: 'text-gray-900' },
            { label: 'Verificate', value: completi, cls: 'text-green-600' },
            { label: 'Fatture mancanti', value: mancanti, cls: 'text-red-500' },
          ].map(c => (
            <div key={c.label} className="bg-white border border-gray-100 rounded-xl p-4 text-center">
              <p className={`text-2xl font-bold ${c.cls}`}>{c.value}</p>
              <p className="text-xs text-gray-500 mt-0.5 uppercase tracking-wide">{c.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Bulk select bar */}
      {selezione.size > 0 && (
        <div className="mb-4 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <span className="text-sm text-amber-700 font-medium flex-1">
            {selezione.size} bolla{selezione.size !== 1 ? 'e' : ''} selezionata{selezione.size !== 1 ? '' : ''}
          </span>
          <button onClick={requestSelected} disabled={invioMultiplo === 'loading'}
            className="flex items-center gap-1.5 text-sm font-semibold px-4 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {invioMultiplo === 'loading' ? 'Invio…' : invioMultiplo === 'sent' ? 'Inviato ✓' : 'Richiedi documenti mancanti'}
          </button>
          <button onClick={() => setSelezione(new Set())} className="text-xs text-gray-400 hover:text-gray-600">Annulla</button>
        </div>
      )}

      {!loading && mancanti > 0 && selezione.size === 0 && (
        <button onClick={() => setSelezione(new Set(mancantiIds))}
          className="mb-4 text-sm text-accent font-medium hover:opacity-75">
          Seleziona tutte le fatture mancanti ({mancanti})
        </button>
      )}

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-100 px-6 py-16 text-center">
          <p className="text-gray-400 text-sm">Caricamento…</p>
        </div>
      ) : gruppi.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 px-6 py-16 text-center">
          <p className="text-gray-400 text-sm font-medium">Nessuna bolla trovata per {MONTHS[mese-1]} {anno}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {gruppi.map(g => {
            const gTotal    = g.bolle.length
            const gVerified = g.bolle.filter(b => b.fattura).length
            const gMissing  = g.bolle.filter(b => !b.fattura).length
            const allGood   = gMissing === 0

            return (
              <div key={g.fornitore_id} className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                {/* Supplier header with Verification Triangle */}
                <div className="px-5 py-4 bg-gray-50 border-b border-gray-100">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <h2 className="font-semibold text-gray-900">{g.nome}</h2>
                      <p className="text-xs text-gray-400 mt-0.5">{gTotal} bolla{gTotal !== 1 ? 'e' : ''} nel periodo</p>
                    </div>
                    {/* Verification Triangle */}
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col items-center px-3 py-1.5 bg-white border border-gray-200 rounded-lg min-w-[60px]">
                        <span className="text-xs font-bold text-gray-700">{gTotal}</span>
                        <span className="text-[9px] text-gray-400 uppercase tracking-wide">Bolle</span>
                      </div>
                      <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                      <div className="flex flex-col items-center px-3 py-1.5 bg-white border border-gray-200 rounded-lg min-w-[60px]">
                        <span className="text-xs font-bold text-green-600">{gVerified}</span>
                        <span className="text-[9px] text-gray-400 uppercase tracking-wide">Fatture</span>
                      </div>
                      <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                      <div className={`flex flex-col items-center px-3 py-1.5 border rounded-lg min-w-[60px] ${allGood ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                        <span className={`text-xs font-bold ${allGood ? 'text-green-600' : 'text-red-600'}`}>{gMissing}</span>
                        <span className={`text-[9px] uppercase tracking-wide ${allGood ? 'text-green-400' : 'text-red-400'}`}>Diff.</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* GRN rows */}
                <div className="divide-y divide-gray-50">
                  {g.bolle.map(bolla => {
                    const missing = !bolla.fattura
                    const stato   = invio[bolla.id]
                    return (
                      <div key={bolla.id} className={`flex items-center gap-3 px-5 py-3.5 flex-wrap ${missing ? 'bg-amber-50/40' : ''}`}>
                        {missing && (
                          <input type="checkbox" checked={selezione.has(bolla.id)}
                            onChange={() => setSelezione(p => {
                              const n = new Set(p)
                              if (n.has(bolla.id)) n.delete(bolla.id); else n.add(bolla.id)
                              return n
                            })}
                            className="rounded border-gray-300 text-accent focus:ring-accent"
                          />
                        )}
                        <span className="text-sm text-gray-700 font-medium">{fmt(bolla.data)}</span>
                        <span className="flex-1" />
                        {bolla.fattura ? (
                          <>
                            <span className="text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full font-medium">✓ Verificata</span>
                            {bolla.fattura.file_url && (
                              <a href={bolla.fattura.file_url} target="_blank" rel="noopener noreferrer"
                                className="text-xs text-accent hover:underline">{fmt(bolla.fattura.data)} →</a>
                            )}
                          </>
                        ) : (
                          <>
                            <span className="text-xs text-red-600 bg-red-100 px-2 py-0.5 rounded-full font-medium">Fattura mancante</span>
                            <button onClick={() => requestSingle(bolla.id)} disabled={stato === 'loading' || stato === 'sent'}
                              className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50 bg-amber-50 text-amber-700 hover:bg-amber-100">
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
                  <div className="px-5 py-3 bg-red-50/40 border-t border-red-100 flex items-center justify-between flex-wrap gap-2">
                    <p className="text-xs text-red-600">{gMissing} fattura{gMissing > 1 ? 'e' : ''} mancante{gMissing > 1 ? '' : ''}</p>
                    <button
                      onClick={() => setSelezione(prev => {
                        const n = new Set(prev)
                        g.bolle.filter(b => !b.fattura).forEach(b => n.add(b.id))
                        return n
                      })}
                      className="text-xs font-semibold text-amber-700 hover:text-amber-800"
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
