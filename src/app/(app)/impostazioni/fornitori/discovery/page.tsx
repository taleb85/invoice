'use client'

import { useState, useCallback, useId } from 'react'
import Link from 'next/link'
import { useT } from '@/lib/use-t'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { AppPageHeaderTitleWithDashboardShortcut } from '@/components/AppPageHeaderDashboardShortcut'
import { VatLookupField } from '@/components/vat-lookup-field'
import { BackButton } from '@/components/BackButton'

interface DiscoveredSender {
  email: string
  display_name: string | null
  attachment_count: number
  last_seen: string
  sede_nome: string | null
  sede_id: string | null
}

interface ScanResult {
  unknown: DiscoveredSender[]
  errors: string[]
  scanned_sedi: number
  has_global_imap: boolean
}

interface Sede {
  id: string
  nome: string
}

interface AddFormState {
  email: string
  nome: string
  piva: string
  sede_id: string
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

function EmailAvatar({ email }: { email: string }) {
  const letter = email[0]?.toUpperCase() ?? '?'
  const hue = email.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
      style={{ background: `hsl(${hue}, 55%, 45%)` }}
    >
      {letter}
    </div>
  )
}

function ScannerRow({
  sender,
  sedi,
  onAdded,
}: {
  sender: DiscoveredSender
  sedi: Sede[]
  onAdded: (email: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [form, setForm] = useState<AddFormState>({
    email: sender.email,
    nome: sender.display_name ?? '',
    piva: '',
    sede_id: sender.sede_id ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!form.nome.trim()) { setError('Il nome dell\'azienda è obbligatorio'); return }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/discovery-fornitori', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          nome: form.nome,
          piva: form.piva || undefined,
          sede_id: form.sede_id || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Errore durante la creazione del fornitore')
      onAdded(sender.email)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="app-workspace-surface-elevated rounded-lg border-t-2 border-t-[#22d3ee] border-x-0 border-b-0 overflow-hidden">
      {/* Riga principale */}
      <div className="flex items-center gap-3 p-4">
        <EmailAvatar email={sender.email} />

        <div className="min-w-0 flex-1">
          <p className="font-medium text-app-fg truncate text-sm">{sender.email}</p>
          {sender.display_name && (
            <p className="text-xs text-app-fg-muted truncate">{sender.display_name}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Badge allegati */}
          <span className="flex items-center gap-1 px-2 py-0.5 border border-app-line-35 bg-app-line-15 text-app-fg-muted text-xs font-medium rounded-full">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            {sender.attachment_count}
          </span>

          {/* Badge sede */}
          {sender.sede_nome && (
            <span className="px-2 py-0.5 border border-[rgba(34,211,238,0.15)] bg-violet-500/15 text-violet-200 text-xs font-medium rounded-full">
              {sender.sede_nome}
            </span>
          )}

          {/* Ultima data */}
          <span className="text-xs text-app-fg-muted hidden sm:block">{formatDate(sender.last_seen)}</span>

          {/* Pulsante aggiungi */}
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition-colors touch-manipulation"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={expanded ? 'M5 15l7-7 7 7' : 'M12 4v16m8-8H4'} />
            </svg>
            {expanded ? 'Annulla' : 'Aggiungi Fornitore'}
          </button>
        </div>
      </div>

      {/* Form inline */}
      {expanded && (
        <div className="border-t border-app-line-22 app-workspace-inset-bg-soft p-4">
          <p className="text-xs font-semibold text-app-fg-muted uppercase tracking-wide mb-3">Crea Nuovo Fornitore</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Ragione sociale */}
            <div>
              <label className="block text-xs font-medium text-app-fg-muted mb-1">Ragione Sociale *</label>
              <input
                type="text"
                value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                placeholder="es. Rossi S.r.l."
                className="w-full rounded-lg border border-app-line-25 app-workspace-surface-elevated px-3 py-2 text-sm text-app-fg placeholder:text-app-fg-muted focus:outline-none focus:ring-2 focus:ring-emerald-500 [color-scheme:dark]"
              />
            </div>

            {/* Email (sola lettura) */}
            <div>
              <label className="block text-xs font-medium text-app-fg-muted mb-1">Email (rilevata)</label>
              <input
                type="text"
                value={form.email}
                readOnly
                className="w-full px-3 py-2 text-sm border border-app-line-25 rounded-lg app-workspace-inset-bg-soft text-app-fg-muted cursor-not-allowed [color-scheme:dark]"
              />
            </div>

            {/* P.IVA */}
            <div>
              <label className="block text-xs font-medium text-app-fg-muted mb-1">P.IVA</label>
              <VatLookupField
                value={form.piva}
                onChange={(val) => setForm(f => ({ ...f, piva: val }))}
                onFound={(data) => setForm(f => ({
                  ...f,
                  nome: data.ragione_sociale ?? f.nome,
                }))}
                inputClassName="w-full rounded-lg border border-app-line-25 app-workspace-surface-elevated px-3 py-2 text-sm text-app-fg placeholder:text-app-fg-muted focus:outline-none focus:ring-2 focus:ring-emerald-500 [color-scheme:dark]"
                placeholder="12345678901"
              />
            </div>

            {/* Sede */}
            {sedi.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-app-fg-muted mb-1">Sede</label>
                <select
                  value={form.sede_id}
                  onChange={e => setForm(f => ({ ...f, sede_id: e.target.value }))}
                  className="w-full rounded-lg border border-app-line-25 app-workspace-surface-elevated px-3 py-2 text-sm text-app-fg focus:outline-none focus:ring-2 focus:ring-emerald-500 [color-scheme:dark]"
                >
                  <option value="">— Nessuna sede specifica —</option>
                  {sedi.map(s => (
                    <option key={s.id} value={s.id}>{s.nome}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {error && (
            <p className="mt-2 text-xs text-red-300 bg-red-500/10 border border-[rgba(34,211,238,0.15)] px-3 py-1.5 rounded-lg">{error}</p>
          )}

          <div className="mt-3 flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors touch-manipulation"
            >
              {saving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Salvataggio…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Crea Fornitore
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Named export so sede-specific wrapper pages can render with a fixed sedeId. */
export function DiscoveryContent({
  sedeId,
  backNav,
}: {
  sedeId?: string
  backNav?: { href: string; label: string }
}) {
  const t = useT()
  const helpIconGradIdRaw = useId()
  const helpIconGradId = `disc-fluxo-help-${helpIconGradIdRaw.replace(/[^a-zA-Z0-9_-]/g, '') || 'g'}`
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [sedi, setSedi] = useState<Sede[]>([])
  const [scanError, setScanError] = useState<string | null>(null)
  const [added, setAdded] = useState<Set<string>>(new Set())

  const handleScan = useCallback(async () => {
    setScanning(true)
    setScanError(null)
    try {
      const meRes = await fetch('/api/me')
      if (meRes.ok) {
        const me = await meRes.json()
        setSedi(me.all_sedi ?? [])
      }

      const url = '/api/discovery-fornitori' + (sedeId ? `?sede_id=${sedeId}` : '')
      const res = await fetch(url)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Scansione fallita')
      setResult(json as ScanResult)
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Errore sconosciuto')
    } finally {
      setScanning(false)
    }
  }, [sedeId])

  const handleAdded = (email: string) => {
    setAdded(prev => new Set([...prev, email]))
  }

  const visibleSenders = result?.unknown.filter(s => !added.has(s.email)) ?? []

  return (
    <div className="w-full min-w-0 app-shell-page-padding">
      <AppPageHeaderStrip
        rowAlign="start"
        accent="slate"
        leadingAccessory={
          backNav ? <BackButton href={backNav.href} label={backNav.label} iconOnly className="mb-0 shrink-0" /> : undefined
        }
        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>}
      >
        <AppPageHeaderTitleWithDashboardShortcut className="min-w-0 flex-1 items-start gap-3">
          <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
            {!backNav ? (
            <div className="flex min-w-0 items-center gap-2 text-sm text-app-fg-muted">
              <Link href="/impostazioni" className="shrink-0 transition-colors hover:text-app-fg">
                Impostazioni
              </Link>
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="truncate">Scoperta Fornitori</span>
            </div>
            ) : null}
            <Link
              href="/guida"
              className="flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-xl border border-white/20 bg-gradient-to-br from-[#1e3a5f] to-[#172554] shadow-md shadow-black/25 transition-all hover:border-app-a-35 hover:brightness-110 active:scale-[0.98] md:hidden"
              aria-label={t.nav.guida}
              title={t.nav.guida}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" aria-hidden>
                <defs>
                  <linearGradient id={helpIconGradId} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#6b8ef5" />
                    <stop offset="100%" stopColor="#22d3ee" />
                  </linearGradient>
                </defs>
                <path
                  stroke={`url(#${helpIconGradId})`}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </Link>
          </div>
          <h1 className="app-page-title text-2xl font-bold">Esplora Email</h1>
          <p className="mt-1 text-sm text-app-fg-muted">
            Analizza le caselle email collegate (ultimi 30 giorni) e mostra i mittenti con allegati
            non ancora registrati come fornitori.
          </p>
        </AppPageHeaderTitleWithDashboardShortcut>
        <div className="flex min-w-0 w-full max-w-full flex-row flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end sm:gap-3 sm:shrink-0">
          <button
            type="button"
            onClick={handleScan}
            disabled={scanning}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium whitespace-nowrap text-white transition-colors hover:bg-accent-hover disabled:opacity-50 touch-manipulation"
          >
            {scanning ? (
              <>
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Scansione in corso…
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {result ? 'Ripeti Scansione' : 'Scansiona Casella'}
              </>
            )}
          </button>
        </div>
      </AppPageHeaderStrip>

      {/* Errore scansione */}
      {scanError && (
        <div className="mb-6 flex items-start gap-3 bg-red-500/10 border border-[rgba(34,211,238,0.15)] rounded-xl p-4">
          <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-red-300">{scanError}</p>
        </div>
      )}

      {/* Nessun account IMAP configurato */}
      {!scanning && result && result.scanned_sedi === 0 && !result.has_global_imap && (
        <div className="mb-6 flex items-start gap-3 bg-amber-500/10 border border-[rgba(34,211,238,0.15)] rounded-xl p-4">
          <svg className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-amber-200">Nessun account IMAP configurato</p>
            <p className="text-xs text-amber-300 mt-1">
              Configura le credenziali IMAP nelle impostazioni della sede (<Link href="/sedi" className="underline hover:text-amber-100">Sedi</Link>) per abilitare la scansione della posta.
            </p>
          </div>
        </div>
      )}

      {/* Errori parziali IMAP */}
      {result && result.errors.length > 0 && (
        <div className="mb-6 bg-amber-500/10 border border-[rgba(34,211,238,0.15)] rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-200 mb-2">Scansione parziale — alcune caselle hanno avuto errori:</p>
          <ul className="space-y-1">
            {result.errors.map((e, i) => (
              <li key={i} className="text-xs text-amber-300">• {e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Risultati */}
      {result && (
        <>
          {/* Barra statistiche */}
          <div className="flex items-center gap-4 mb-5">
            <div className="flex items-center gap-2 rounded-lg border border-app-line-22 app-workspace-inset-bg-soft px-3 py-1.5">
              <span className="text-xs font-medium text-app-fg-muted">
                {visibleSenders.length} {visibleSenders.length === 1 ? 'mittente sconosciuto trovato' : 'mittenti sconosciuti trovati'}
              </span>
            </div>
            {added.size > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-[rgba(34,211,238,0.15)] bg-emerald-500/10 px-3 py-1.5">
                <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-xs font-medium text-emerald-200">
                  {added.size} {added.size === 1 ? 'fornitore aggiunto' : 'fornitori aggiunti'}
                </span>
              </div>
            )}
          </div>

          {/* Stato vuoto */}
          {visibleSenders.length === 0 ? (
            <div className="text-center py-16 app-workspace-surface-elevated rounded-xl border border-app-line-25">
              <svg className="w-12 h-12 text-emerald-400/60 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="font-medium text-app-fg">Tutti i mittenti sono già registrati</p>
              <p className="text-sm text-app-fg-muted mt-1">Nessun mittente sconosciuto con allegati negli ultimi 30 giorni.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleSenders.map(sender => (
                <ScannerRow
                  key={sender.email}
                  sender={sender}
                  sedi={sedi}
                  onAdded={handleAdded}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Stato pre-scansione */}
      {!scanning && !result && !scanError && (
        <div className="rounded-lg border-t-2 border-t-[#22d3ee] border-x-0 border-b-0 app-workspace-surface-elevated py-20 text-center">
          <svg className="w-14 h-14 text-app-fg-muted mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <p className="font-semibold text-app-fg text-lg">Pronto per la scansione</p>
          <p className="text-sm text-app-fg-muted mt-1 max-w-sm mx-auto">
            Premi <strong className="text-app-fg">Scansiona Casella</strong> per analizzare gli ultimi 30 giorni di email e scoprire potenziali nuovi fornitori.
          </p>
        </div>
      )}
    </div>
  )
}

export default function SupplierDiscoveryPage() {
  return <DiscoveryContent />
}
