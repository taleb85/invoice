'use client'

import { useState, useCallback, useId } from 'react'
import Link from 'next/link'
import { useT } from '@/lib/use-t'

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
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
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
    if (!form.nome.trim()) { setError('Company name is required'); return }
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
      if (!res.ok) throw new Error(json.error ?? 'Error creating supplier')
      onAdded(sender.email)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-slate-900/90 rounded-xl border border-slate-600/50 overflow-hidden">
      {/* Main row */}
      <div className="flex items-center gap-3 p-4">
        <EmailAvatar email={sender.email} />

        <div className="min-w-0 flex-1">
          <p className="font-medium text-slate-100 truncate text-sm">{sender.email}</p>
          {sender.display_name && (
            <p className="text-xs text-slate-500 truncate">{sender.display_name}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Attachment count badge */}
          <span className="flex items-center gap-1 px-2 py-0.5 border border-cyan-500/35 bg-cyan-500/15 text-cyan-200 text-xs font-medium rounded-full">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            {sender.attachment_count}
          </span>

          {/* Sede badge */}
          {sender.sede_nome && (
            <span className="px-2 py-0.5 border border-violet-500/35 bg-violet-500/15 text-violet-200 text-xs font-medium rounded-full">
              {sender.sede_nome}
            </span>
          )}

          {/* Last seen */}
          <span className="text-xs text-slate-400 hidden sm:block">{formatDate(sender.last_seen)}</span>

          {/* Add button */}
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={expanded ? 'M5 15l7-7 7 7' : 'M12 4v16m8-8H4'} />
            </svg>
            {expanded ? 'Cancel' : 'Add Supplier'}
          </button>
        </div>
      </div>

      {/* Inline form */}
      {expanded && (
        <div className="border-t border-slate-700/50 bg-slate-800/70 p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Create New Supplier</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Company name */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Company Name *</label>
              <input
                type="text"
                value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                placeholder="e.g. Acme S.r.l."
                className="w-full rounded-lg border border-slate-600/50 bg-slate-900/90 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Email (readonly) */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Email (discovered)</label>
              <input
                type="text"
                value={form.email}
                readOnly
                className="w-full px-3 py-2 text-sm border border-slate-600/50 rounded-lg bg-slate-950/50 text-slate-400 cursor-not-allowed"
              />
            </div>

            {/* VAT */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">VAT</label>
              <input
                type="text"
                value={form.piva}
                onChange={e => setForm(f => ({ ...f, piva: e.target.value }))}
                placeholder="12345678901"
                className="w-full rounded-lg border border-slate-600/50 bg-slate-900/90 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Sede */}
            {sedi.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Branch (Sede)</label>
                <select
                  value={form.sede_id}
                  onChange={e => setForm(f => ({ ...f, sede_id: e.target.value }))}
                  className="w-full rounded-lg border border-slate-600/50 bg-slate-900/90 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 [color-scheme:dark]"
                >
                  <option value="">— No specific branch —</option>
                  {sedi.map(s => (
                    <option key={s.id} value={s.id}>{s.nome}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {error && (
            <p className="mt-2 text-xs text-red-300 bg-red-500/10 px-3 py-1.5 rounded-lg">{error}</p>
          )}

          <div className="mt-3 flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {saving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Creating…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Create Supplier
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
export function DiscoveryContent({ sedeId }: { sedeId?: string }) {
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
      // Fetch sedi for the "Add Supplier" form
      const meRes = await fetch('/api/me')
      if (meRes.ok) {
        const me = await meRes.json()
        setSedi(me.all_sedi ?? [])
      }

      const url = '/api/discovery-fornitori' + (sedeId ? `?sede_id=${sedeId}` : '')
      const res = await fetch(url)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Scan failed')
      setResult(json as ScanResult)
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setScanning(false)
    }
  }, [sedeId])

  const handleAdded = (email: string) => {
    setAdded(prev => new Set([...prev, email]))
  }

  const visibleSenders = result?.unknown.filter(s => !added.has(s.email)) ?? []

  return (
    <div className="w-full min-w-0 p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-3 mb-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 text-sm text-slate-500 min-w-0">
              <Link href="/impostazioni" className="hover:text-slate-700 transition-colors shrink-0">Settings</Link>
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="truncate">Supplier Discovery</span>
            </div>
            <Link
              href="/guida"
              className="md:hidden shrink-0 flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-gradient-to-br from-[#1e3a5f] to-[#172554] shadow-md shadow-slate-900/20 transition-all touch-manipulation hover:border-cyan-400/35 hover:brightness-110 active:scale-[0.98]"
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
          <h1 className="text-2xl font-bold text-slate-100">Inbox Explorer</h1>
          <p className="mt-1 text-sm text-slate-500">
            Scans your connected mailboxes (last 30 days) and surfaces senders with attachments who are not yet registered as suppliers.
          </p>
        </div>

        <button
          onClick={handleScan}
          disabled={scanning}
          className="flex items-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors whitespace-nowrap shrink-0"
        >
          {scanning ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Scanning inbox…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {result ? 'Re-scan Inbox' : 'Scan Inbox'}
            </>
          )}
        </button>
      </div>

      {/* Scan error */}
      {scanError && (
        <div className="mb-6 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-red-700">{scanError}</p>
        </div>
      )}

      {/* No IMAP configured */}
      {!scanning && result && result.scanned_sedi === 0 && !result.has_global_imap && (
        <div className="mb-6 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-amber-800">No IMAP accounts configured</p>
            <p className="text-xs text-amber-700 mt-1">
              Configure IMAP credentials in your branch settings (<Link href="/sedi" className="underline">Branches</Link>) to enable inbox scanning.
            </p>
          </div>
        </div>
      )}

      {/* IMAP errors */}
      {result && result.errors.length > 0 && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-800 mb-2">Partial scan — some mailboxes had errors:</p>
          <ul className="space-y-1">
            {result.errors.map((e, i) => (
              <li key={i} className="text-xs text-amber-700">• {e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Stats bar */}
          <div className="flex items-center gap-4 mb-5">
            <div className="flex items-center gap-2 rounded-lg border border-slate-700/50 bg-slate-800/70 px-3 py-1.5">
              <span className="text-xs font-medium text-slate-300">
                {visibleSenders.length} unknown sender{visibleSenders.length !== 1 ? 's' : ''} found
              </span>
            </div>
            {added.size > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-1.5">
                <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-xs font-medium text-emerald-200">{added.size} added as supplier{added.size !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>

          {/* Empty state */}
          {visibleSenders.length === 0 ? (
            <div className="text-center py-16 bg-slate-900/90 rounded-xl border border-slate-600/50">
              <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="font-medium text-slate-300">All senders are already registered</p>
              <p className="text-sm text-slate-400 mt-1">No unknown senders with attachments found in the last 30 days.</p>
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

      {/* Pre-scan state */}
      {!scanning && !result && !scanError && (
        <div className="rounded-xl border border-dashed border-slate-600/50 bg-slate-900/90 py-20 text-center">
          <svg className="w-14 h-14 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <p className="font-semibold text-slate-500 text-lg">Ready to scan</p>
          <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
            Click <strong className="text-slate-500">Scan Inbox</strong> to analyse the last 30 days of emails and discover potential new suppliers.
          </p>
        </div>
      )}
    </div>
  )
}

export default function SupplierDiscoveryPage() {
  return <DiscoveryContent />
}
