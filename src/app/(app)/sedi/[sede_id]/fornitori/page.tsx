'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { getLocale } from '@/lib/localization'
import { segmentParam } from '@/lib/segment-param'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { AppPageHeaderTitleWithDashboardShortcut } from '@/components/AppPageHeaderDashboardShortcut'
import AppSummaryHighlightCard from '@/components/AppSummaryHighlightCard'
import { useT } from '@/lib/use-t'

interface FornitoreRow {
  id: string
  nome: string
  piva: string | null
  email: string | null
  created_at: string
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function AddFornitoreModal({
  sedeId,
  countryCode,
  onClose,
  onSaved,
}: {
  sedeId: string
  countryCode: string
  onClose: () => void
  onSaved: (f: FornitoreRow) => void
}) {
  const loc = getLocale(countryCode)
  const [nome, setNome]   = useState('')
  const [piva, setPiva]   = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const firstInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    firstInputRef.current?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!nome.trim()) {
      setError('La Ragione Sociale è obbligatoria.')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/fornitori', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nome.trim(), piva: piva.trim(), email: email.trim(), sede_id: sedeId }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Errore durante il salvataggio.')
        return
      }
      onSaved(json.fornitore)
    } catch {
      setError('Errore di rete. Riprova.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" aria-modal="true" role="dialog">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-800/35 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-slate-700/90 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Nuovo Fornitore</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-200 hover:bg-slate-700/80 rounded-lg transition-colors"
            aria-label="Chiudi"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-start gap-2 px-3.5 py-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          <div>
            <label htmlFor="nome" className="block text-xs font-medium text-gray-700 mb-1.5">
              Ragione Sociale <span className="text-red-500">*</span>
            </label>
            <input
              ref={firstInputRef}
              id="nome"
              type="text"
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="es. Mario Rossi S.r.l."
              className="w-full px-3.5 py-2.5 text-sm border border-slate-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 placeholder:text-gray-400"
              required
            />
          </div>

          <div>
            <label htmlFor="piva" className="block text-xs font-medium text-gray-700 mb-1.5">
              {loc.vatLabel}
              <span className="text-gray-400 font-normal ml-1">(utile per l&apos;analisi AI)</span>
            </label>
            <input
              id="piva"
              type="text"
              value={piva}
              onChange={e => setPiva(e.target.value)}
              placeholder="es. 01234567890"
              maxLength={11}
              inputMode="numeric"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 placeholder:text-gray-400"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-xs font-medium text-gray-700 mb-1.5">
              Email per i documenti
              <span className="text-gray-400 font-normal ml-1">(fondamentale per il matching IMAP)</span>
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="es. fatture@fornitore.it"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 placeholder:text-gray-400"
            />
            <p className="mt-1.5 text-xs text-gray-400">
              Questa email verrà usata per abbinare automaticamente le fatture ricevute.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-slate-200 hover:text-slate-200 hover:bg-slate-700/80 rounded-lg transition-colors disabled:opacity-50"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Salvataggio…
                </>
              ) : (
                'Salva Fornitore'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SedeFornitoriPage() {
  const sede_id = segmentParam(useParams().sede_id)
  const t = useT()

  const [fornitori, setFornitori] = useState<FornitoreRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [deleting, setDeleting]   = useState<string | null>(null)
  const [sedeName, setSedeName]   = useState<string>('Sede')
  const [countryCode, setCountryCode] = useState('UK')

  const fetchFornitori = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('fornitori')
      .select('id, nome, piva, email, created_at')
      .eq('sede_id', sede_id)
      .order('nome')
    setFornitori((data as FornitoreRow[]) ?? [])
    setLoading(false)
  }, [sede_id])

  // Fetch the sede name + country_code for the breadcrumb and localization
  const fetchSedeName = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('sedi')
      .select('nome, country_code')
      .eq('id', sede_id)
      .single()
    if (data?.nome) setSedeName(data.nome)
    if ((data as { country_code?: string } | null)?.country_code) {
      setCountryCode((data as { country_code: string }).country_code)
    }
  }, [sede_id])

  useEffect(() => {
    fetchFornitori()
    fetchSedeName()
  }, [fetchFornitori, fetchSedeName])

  const handleSaved = (f: FornitoreRow) => {
    setFornitori(prev => [...prev, f].sort((a, b) => a.nome.localeCompare(b.nome)))
    setShowModal(false)
  }

  const handleDelete = async (id: string, nome: string) => {
    if (!window.confirm(`Eliminare il fornitore "${nome}"? L'operazione non è reversibile.`)) return
    setDeleting(id)
    try {
      await fetch(`/api/fornitori?id=${id}`, { method: 'DELETE' })
      setFornitori(prev => prev.filter(f => f.id !== id))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <>
      {showModal && (
        <AddFornitoreModal
          sedeId={sede_id}
          countryCode={countryCode}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}

      <div className="app-shell-page-padding max-w-5xl">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-gray-400 mb-6">
          <Link href="/sedi" className="hover:text-gray-600 transition-colors">Sedi</Link>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <Link href={`/sedi/${sede_id}`} className="hover:text-gray-600 transition-colors">{sedeName}</Link>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-gray-600 font-medium">Fornitori</span>
        </nav>

        <AppPageHeaderStrip accent="sky">
          <AppPageHeaderTitleWithDashboardShortcut dashboardLabel={t.nav.dashboard}>
            <h1 className="app-page-title text-2xl font-bold">Fornitori</h1>
          </AppPageHeaderTitleWithDashboardShortcut>
          <div className="flex min-w-0 w-full max-w-full flex-row flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end sm:gap-3 sm:shrink-0">
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-cyan-600"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nuovo Fornitore
            </button>
          </div>
        </AppPageHeaderStrip>

        <AppSummaryHighlightCard
          accent="sky"
          label={t.common.total}
          primary={fornitori.length}
          secondary={t.fornitori.countLabel}
        />

        {/* Table / Empty state */}
        <div className="bg-slate-700/90 rounded-xl border border-slate-700/50 overflow-hidden">
          {loading ? (
            <div className="divide-y divide-gray-50">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="px-6 py-4 flex gap-4 animate-pulse">
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-700/80 rounded w-1/3" />
                    <div className="h-3 bg-slate-700/80 rounded w-1/2" />
                  </div>
                  <div className="h-4 bg-slate-700/80 rounded w-24" />
                </div>
              ))}
            </div>
          ) : fornitori.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <svg className="w-14 h-14 text-gray-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-gray-400 text-sm font-medium mb-1">Nessun fornitore ancora registrato</p>
              <p className="text-gray-400 text-xs mb-4">Aggiungi il primo fornitore oppure usa il Discovery per importarli dalle email.</p>
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-1.5 text-sm text-cyan-600 font-medium hover:underline"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Aggiungi il primo fornitore
              </button>
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-gray-50">
                {fornitori.map((f) => (
                  <div key={f.id} className="px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{f.nome}</p>
                        {f.email && (
                          <p className="text-sm text-gray-500 mt-0.5 truncate">{f.email}</p>
                        )}
                        {f.piva && (
                          <p className="text-xs text-gray-400 mt-0.5">{getLocale(countryCode).vatLabel} {f.piva}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(f.id, f.nome)}
                        disabled={deleting === f.id}
                        className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                        title="Elimina fornitore"
                        aria-label="Elimina fornitore"
                      >
                        {deleting === f.id ? (
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <table className="hidden md:table w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/50 text-xs text-gray-500 font-medium uppercase tracking-wide">
                    <th className="text-left px-6 py-3">Ragione Sociale</th>
                    <th className="text-left px-6 py-3">{getLocale(countryCode).vatLabel}</th>
                    <th className="text-left px-6 py-3">Email Principale</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {fornitori.map((f) => (
                    <tr key={f.id} className="hover:bg-slate-700/70 transition-colors group">
                      <td className="px-6 py-4 font-medium text-gray-900">{f.nome}</td>
                      <td className="px-6 py-4 text-gray-500 tabular-nums">{f.piva ?? <span className="text-gray-300">—</span>}</td>
                      <td className="px-6 py-4 text-gray-500">
                        {f.email ? (
                          <a
                            href={`mailto:${f.email}`}
                            className="hover:text-cyan-600 hover:underline transition-colors"
                          >
                            {f.email}
                          </a>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDelete(f.id, f.nome)}
                          disabled={deleting === f.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-40"
                          title="Elimina fornitore"
                        >
                          {deleting === f.id ? (
                            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                          Elimina
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        {/* Footer hint */}
        {!loading && fornitori.length > 0 && (
          <p className="mt-4 text-xs text-gray-400 text-center">
            Vuoi importare altri fornitori dalle email?{' '}
            <Link href={`/sedi/${sede_id}/discovery`} className="text-cyan-600 hover:underline font-medium">
              Vai al Rilevamento Fornitori →
            </Link>
          </p>
        )}
      </div>
    </>
  )
}
