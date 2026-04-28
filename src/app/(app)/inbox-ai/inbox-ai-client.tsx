'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { DupBollaGroup, DupFatturaGroup } from '@/lib/inbox-ai-duplicate-groups'
import { SUMMARY_HIGHLIGHT_SURFACE_CLASS } from '@/lib/summary-highlight-accent'
import { createClient } from '@/utils/supabase/client'

type GeminiSuggestion = {
  doc_id: string
  tipo_suggerito: string
  fornitore_suggerito: string | null
  azione_consigliata: string
  confidenza: number
  error?: string
}

type PendingDocRow = {
  id: string
  file_name: string | null
  file_url: string | null
  created_at: string
  stato: string
  fornitore_id: string | null
  fornitore?: { nome?: string | null } | null
}

type TabId = 'docs' | 'fatture' | 'bolle' | 'rekki' | 'audit'

type AuditMatchRow = {
  id: string
  mittente: string | null
  file_name: string | null
  fattura_id: string | null
  bolla_id: string | null
  assigned_fornitore_id: string | null
  fornitore_fattura: string | null
  fornitore_bolla: string | null
}

type FornitoreOption = { id: string; nome: string | null }

function todayYmd(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function readResolvedToday(): number {
  if (typeof window === 'undefined') return 0
  try {
    const raw = window.localStorage.getItem('inbox-ai-resolved')
    const o = JSON.parse(raw ?? '{}') as { date?: string; n?: number }
    if (o.date !== todayYmd()) return 0
    return typeof o.n === 'number' && Number.isFinite(o.n) ? o.n : 0
  } catch {
    return 0
  }
}

function bumpResolved(by: number) {
  try {
    const prev = readResolvedToday()
    const n = prev + by
    window.localStorage.setItem(
      'inbox-ai-resolved',
      JSON.stringify({ date: todayYmd(), n }),
    )
    return n
  } catch {
    return readResolvedToday()
  }
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export default function InboxAiClient(props: {
  sedeId: string | null
  /** Nessuna sede operativa per operatore — blocco totale */
  blockedNoSede: boolean
}) {
  const { sedeId, blockedNoSede } = props
  const [tab, setTab] = useState<TabId>('docs')
  const [docs, setDocs] = useState<PendingDocRow[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [dupFat, setDupFat] = useState<DupFatturaGroup[]>([])
  const [dupBol, setDupBol] = useState<DupBollaGroup[]>([])
  const [dupLoading, setDupLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<Record<string, GeminiSuggestion>>({})
  const [analyzeBusy, setAnalyzeBusy] = useState(false)
  const [resolvedToday, setResolvedToday] = useState(0)
  const [actionBusy, setActionBusy] = useState<string | null>(null)
  const [dupBusy, setDupBusy] = useState<string | null>(null)

  const [auditRows, setAuditRows] = useState<AuditMatchRow[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [fornitori, setFornitori] = useState<FornitoreOption[]>([])
  const [reassignSel, setReassignSel] = useState<Record<string, string>>({})
  const [auditBusy, setAuditBusy] = useState<string | null>(null)

  useEffect(() => {
    setResolvedToday(readResolvedToday())
  }, [])

  const loadDocs = useCallback(async () => {
    if (!sedeId || blockedNoSede) return
    setDocsLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('stati', 'da_associare,da_revisionare')
      params.set('sede_id', sedeId)
      const res = await fetch(`/api/documenti-da-processare?${params.toString()}`, {
        credentials: 'include',
      })
      const raw = await res.text()
      let data: unknown
      try {
        data = JSON.parse(raw) as unknown
      } catch {
        setDocs([])
        return
      }
      if (!res.ok || !Array.isArray(data)) {
        setDocs([])
        return
      }
      setDocs(data as PendingDocRow[])
    } finally {
      setDocsLoading(false)
    }
  }, [blockedNoSede, sedeId])

  const loadAudit = useCallback(async () => {
    if (!sedeId || blockedNoSede) return
    setAuditLoading(true)
    try {
      const res = await fetch('/api/admin/audit-fornitore-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sede_id: sedeId }),
      })
      const j = (await res.json()) as { rows?: AuditMatchRow[]; error?: string }
      if (!res.ok) {
        setAuditRows([])
        return
      }
      setAuditRows(j.rows ?? [])
    } finally {
      setAuditLoading(false)
    }
  }, [blockedNoSede, sedeId])

  useEffect(() => {
    if (!sedeId || blockedNoSede) {
      setFornitori([])
      return
    }
    let cancelled = false
    ;(async () => {
      const sb = createClient()
      const { data } = await sb.from('fornitori').select('id, nome').eq('sede_id', sedeId).order('nome')
      if (!cancelled) setFornitori((data ?? []) as FornitoreOption[])
    })()
    return () => {
      cancelled = true
    }
  }, [blockedNoSede, sedeId])

  useEffect(() => {
    void loadAudit()
  }, [loadAudit])

  const loadDuplicates = useCallback(async () => {
    if (!sedeId || blockedNoSede) return
    setDupLoading(true)
    try {
      const res = await fetch(`/api/admin/inbox-ai/duplicates?sede_id=${encodeURIComponent(sedeId)}`, {
        credentials: 'include',
      })
      const j = (await res.json()) as {
        ok?: boolean
        fatture_groups?: DupFatturaGroup[]
        bolle_groups?: DupBollaGroup[]
        error?: string
      }
      if (!res.ok) {
        setDupFat([])
        setDupBol([])
        return
      }
      setDupFat(j.fatture_groups ?? [])
      setDupBol(j.bolle_groups ?? [])
    } finally {
      setDupLoading(false)
    }
  }, [blockedNoSede, sedeId])

  useEffect(() => {
    void loadDocs()
  }, [loadDocs])

  useEffect(() => {
    if (tab === 'fatture' || tab === 'bolle') void loadDuplicates()
  }, [tab, loadDuplicates])

  const excludedForNextBatch = useMemo(() => {
    return Object.keys(suggestions)
  }, [suggestions])

  const runAnalyze = async () => {
    if (!sedeId) return
    setAnalyzeBusy(true)
    try {
      const res = await fetch('/api/admin/reprocess-pending-docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          mode: 'gemini_classify',
          sede_id: sedeId,
          exclude_doc_ids: excludedForNextBatch,
        }),
      })
      const j = (await res.json()) as { suggestions?: GeminiSuggestion[]; error?: string }
      if (!res.ok) {
        window.alert(j.error ?? 'Analisi non riuscita')
        return
      }
      const list = j.suggestions ?? []
      setSuggestions((prev) => {
        const next = { ...prev }
        for (const s of list) next[s.doc_id] = s
        return next
      })
    } finally {
      setAnalyzeBusy(false)
    }
  }

  const postDoc = async (body: Record<string, unknown>) => {
    const res = await fetch('/api/documenti-da-processare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
    const j = (await res.json()) as { error?: string; ok?: boolean }
    if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`)
  }

  const finalizeAs = async (docId: string, kind: 'fattura' | 'bolla') => {
    setActionBusy(docId)
    try {
      await postDoc({ id: docId, azione: 'set_pending_kind', kind })
      await postDoc({ id: docId, azione: 'finalizza_tipo' })
      setDocs((d) => d.filter((x) => x.id !== docId))
      setSuggestions((s) => {
        const n = { ...s }
        delete n[docId]
        return n
      })
      const n = bumpResolved(1)
      setResolvedToday(n)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Operazione non riuscita')
    } finally {
      setActionBusy(null)
    }
  }

  const ignoreDoc = async (docId: string) => {
    setActionBusy(docId)
    try {
      await postDoc({ id: docId, azione: 'scarta' })
      setDocs((d) => d.filter((x) => x.id !== docId))
      setSuggestions((s) => {
        const n = { ...s }
        delete n[docId]
        return n
      })
      const n = bumpResolved(1)
      setResolvedToday(n)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Operazione non riuscita')
    } finally {
      setActionBusy(null)
    }
  }

  const deleteDupFatture = async (group: DupFatturaGroup, keepId: string) => {
    const del = group.fatture.map((f) => f.id).filter((id) => id !== keepId)
    if (del.length === 0) return
    if (!window.confirm(`Eliminare ${del.length} fattura/e duplicate e tenere quella selezionata?`)) return
    setDupBusy(group.group_key)
    try {
      const res = await fetch('/api/duplicates/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ entity: 'fatture', ids: del }),
      })
      const j = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(j.error ?? 'Eliminazione non riuscita')
      await loadDuplicates()
      setResolvedToday(bumpResolved(del.length))
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Errore')
    } finally {
      setDupBusy(null)
    }
  }

  const deleteDupBolle = async (group: DupBollaGroup, keepId: string) => {
    const del = group.bolle.map((b) => b.id).filter((id) => id !== keepId)
    if (del.length === 0) return
    if (!window.confirm(`Eliminare ${del.length} bolla/e duplicate e tenere quella selezionata?`)) return
    setDupBusy(group.group_key)
    try {
      const res = await fetch('/api/duplicates/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ entity: 'bolle', ids: del }),
      })
      const j = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(j.error ?? 'Eliminazione non riuscita')
      await loadDuplicates()
      setResolvedToday(bumpResolved(del.length))
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Errore')
    } finally {
      setDupBusy(null)
    }
  }

  const tabBadge = (id: TabId) => {
    if (id === 'docs') return docs.length
    if (id === 'fatture') return dupFat.length
    if (id === 'bolle') return dupBol.length
    if (id === 'audit') return auditRows.length
    return 0
  }

  const addEmailToFornitore = async (row: AuditMatchRow) => {
    const fid = row.assigned_fornitore_id
    if (!fid || !row.mittente?.trim()) return
    setAuditBusy(row.id)
    try {
      const res = await fetch('/api/fornitore-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fornitore_id: fid, email: row.mittente }),
      })
      const j = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(j.error ?? 'Errore')
      setAuditRows((r) => r.filter((x) => x.id !== row.id))
      setResolvedToday(bumpResolved(1))
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Operazione non riuscita')
    } finally {
      setAuditBusy(null)
    }
  }

  const reassignFornitore = async (row: AuditMatchRow) => {
    const nuovo = reassignSel[row.id]?.trim()
    if (!nuovo) {
      window.alert('Seleziona un fornitore')
      return
    }
    setAuditBusy(row.id)
    try {
      const res = await fetch('/api/admin/audit-fornitore-match/reassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          sede_id: sedeId,
          documento_id: row.id,
          nuovo_fornitore_id: nuovo,
        }),
      })
      const j = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(j.error ?? 'Errore')
      setAuditRows((r) => r.filter((x) => x.id !== row.id))
      setResolvedToday(bumpResolved(1))
      setReassignSel((s) => {
        const next = { ...s }
        delete next[row.id]
        return next
      })
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Operazione non riuscita')
    } finally {
      setAuditBusy(null)
    }
  }

  const assignedLabel = (row: AuditMatchRow) => {
    const bits: string[] = []
    if (row.fornitore_fattura?.trim()) bits.push(`Fattura: ${row.fornitore_fattura.trim()}`)
    if (row.fornitore_bolla?.trim()) bits.push(`Bolla: ${row.fornitore_bolla.trim()}`)
    return bits.length > 0 ? bits.join(' · ') : '—'
  }

  if (blockedNoSede) {
    return (
      <p className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
        Nessuna sede operativa sul profilo: imposta la sede per usare AI Inbox.
      </p>
    )
  }

  if (!sedeId) {
    return (
      <p className="rounded-xl border border-cyan-500/25 bg-cyan-950/20 px-4 py-3 text-sm text-cyan-100">
        Seleziona una sede (menu sede admin) per caricare documenti e duplicati in questa vista.
      </p>
    )
  }

  return (
    <div className={`${SUMMARY_HIGHLIGHT_SURFACE_CLASS} border-cyan-500/25`}>
      <div className="app-card-bar-accent shrink-0 bg-gradient-to-r from-teal-500/55 via-sky-500/45 to-violet-500/40" aria-hidden />
      <div className="space-y-5 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
          <p className="text-sm font-medium text-teal-200/95">
            {resolvedToday} risolti oggi
          </p>
          {tab === 'docs' ? (
            <button
              type="button"
              onClick={() => void runAnalyze()}
              disabled={analyzeBusy || docs.length === 0}
              className="rounded-lg bg-gradient-to-r from-teal-600 to-sky-600 px-3 py-2 text-xs font-bold text-white shadow disabled:opacity-40"
            >
              {analyzeBusy ? 'Analisi AI…' : 'Analizza con AI (prossimi 5)'}
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1">
          {(
            [
              ['docs', `Documenti (${tabBadge('docs')})`] as const,
              ['audit', `Abbinamenti (${tabBadge('audit')})`] as const,
              ['fatture', `Fatture dup. (${tabBadge('fatture')})`] as const,
              ['bolle', `Bolle dup. (${tabBadge('bolle')})`] as const,
              ['rekki', 'Anomalie Rekki (0)'] as const,
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                tab === id
                  ? 'bg-teal-500/25 text-teal-100 ring-1 ring-teal-400/40'
                  : 'bg-white/[0.05] text-app-fg-muted hover:bg-white/10'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'docs' ? (
          <section className="space-y-3">
            <p className="text-xs text-app-fg-muted">
              Documenti in coda (<span className="font-mono text-app-fg">da_associare</span> /{' '}
              <span className="font-mono text-app-fg">da_revisionare</span>). L’analisi AI suggerisce tipo e azione senza modificare il database finché non applichi un’azione.
            </p>
            {docsLoading ? (
              <ul className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <li
                    key={i}
                    className="h-24 animate-pulse rounded-lg bg-white/[0.06]"
                  />
                ))}
              </ul>
            ) : docs.length === 0 ? (
              <p className="text-sm text-app-fg-muted">Nessun documento da processare in questa sede.</p>
            ) : (
              <ul className="space-y-3">
                {docs.map((d) => {
                  const sug = suggestions[d.id]
                  const supplier =
                    d.fornitore?.nome ?? (d.fornitore_id ? '(fornitore ID)' : '— sconosciuto —')
                  const busyRow = actionBusy === d.id
                  return (
                    <li
                      key={d.id}
                      className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 sm:px-4"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-app-fg">
                            {d.file_name ?? 'Senza nome file'}
                          </p>
                          <p className="text-xs text-app-fg-muted">
                            Fornitore: <span className="text-app-fg">{supplier}</span> · Ricezione:{' '}
                            {fmtDate(d.created_at)} ·{' '}
                            <span className="rounded bg-white/10 px-1 font-mono text-[10px]">{d.stato}</span>
                          </p>
                          {sug ? (
                            <div className="mt-2 rounded-lg border border-teal-500/20 bg-teal-950/20 px-2 py-2 text-[11px] leading-snug text-teal-100/95">
                              <span className="font-semibold text-teal-200">AI</span>: tipo{' '}
                              <span className="font-mono">{sug.tipo_suggerito}</span>
                              {sug.fornitore_suggerito ? (
                                <> · fornitore letto: {sug.fornitore_suggerito}</>
                              ) : null}{' '}
                              · {(sug.confidenza * 100).toFixed(0)}% confidenza
                              <br />
                              <span className="text-app-fg-muted">{sug.azione_consigliata}</span>
                              {sug.error ? (
                                <span className="mt-1 block text-rose-300">{sug.error}</span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-1.5 sm:justify-end">
                          <button
                            type="button"
                            disabled={busyRow || !d.fornitore_id}
                            title={!d.fornitore_id ? 'Associa un fornitore al documento prima di registrare' : ''}
                            onClick={() => void finalizeAs(d.id, 'fattura')}
                            className="rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2 py-1 text-[11px] font-bold text-emerald-100 disabled:opacity-35"
                          >
                            Registra fattura
                          </button>
                          <button
                            type="button"
                            disabled={busyRow || !d.fornitore_id}
                            onClick={() => void finalizeAs(d.id, 'bolla')}
                            className="rounded-md border border-violet-500/40 bg-violet-500/15 px-2 py-1 text-[11px] font-bold text-violet-100 disabled:opacity-35"
                          >
                            Registra bolla
                          </button>
                          <button
                            type="button"
                            disabled={busyRow}
                            onClick={() => void ignoreDoc(d.id)}
                            className="rounded-md border border-white/15 px-2 py-1 text-[11px] font-semibold text-app-fg-muted hover:bg-white/10"
                          >
                            Ignora
                          </button>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        ) : null}

        {tab === 'audit' ? (
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
              <p className="text-sm font-semibold text-teal-100/95">
                {auditLoading ? 'Caricamento…' : `${auditRows.length} abbinamenti da verificare`}
              </p>
              <button
                type="button"
                disabled={auditLoading}
                onClick={() => void loadAudit()}
                className="rounded-md border border-white/15 px-2 py-1 text-[11px] text-app-fg-muted hover:bg-white/10"
              >
                Aggiorna
              </button>
            </div>
            <p className="text-xs text-app-fg-muted">
              Documenti già salvati come <span className="font-mono">associato</span> dove l’email del mittente non è tra le email riconosciute del fornitore collegato alla fattura o alla bolla.
            </p>
            {auditLoading ? (
              <ul className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <li key={i} className="h-24 animate-pulse rounded-lg bg-white/[0.06]" />
                ))}
              </ul>
            ) : auditRows.length === 0 ? (
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/15 px-4 py-6 text-center text-sm text-emerald-100/95">
                Tutti gli abbinamenti sono corretti <span aria-hidden>✅</span>
              </div>
            ) : (
              <ul className="space-y-3">
                {auditRows.map((row) => {
                  const busy = auditBusy === row.id
                  return (
                    <li
                      key={row.id}
                      className="rounded-xl border border-amber-500/25 bg-amber-950/10 px-3 py-3 sm:px-4"
                    >
                      <div className="flex flex-col gap-2">
                        <p className="text-sm font-semibold text-app-fg">
                          {row.file_name?.trim() || 'Senza nome file'}
                        </p>
                        <p className="truncate font-mono text-[11px] text-app-fg-muted">
                          Mittente: {row.mittente ?? '—'}
                        </p>
                        <p className="text-xs text-cyan-100/95">
                          Fornitore assegnato:{' '}
                          <span className="text-app-fg">{assignedLabel(row)}</span>
                        </p>
                        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                          <button
                            type="button"
                            disabled={busy || !row.assigned_fornitore_id || !row.mittente?.trim()}
                            onClick={() => void addEmailToFornitore(row)}
                            className="rounded-md border border-teal-500/40 bg-teal-500/15 px-2 py-1.5 text-[11px] font-semibold text-teal-100 disabled:opacity-40"
                          >
                            Aggiungi email al fornitore
                          </button>
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                            <label className="flex items-center gap-2 text-[11px] text-app-fg-muted">
                              Cambia fornitore
                              <select
                                className="max-w-[min(100%,220px)] rounded border border-white/15 bg-black/30 px-1 py-1 text-[11px] text-app-fg"
                                value={reassignSel[row.id] ?? ''}
                                disabled={busy}
                                onChange={(e) =>
                                  setReassignSel((s) => ({ ...s, [row.id]: e.target.value }))
                                }
                              >
                                <option value="">— fornitore —</option>
                                {fornitori.map((f) => (
                                  <option key={f.id} value={f.id}>
                                    {f.nome ?? f.id.slice(0, 8)}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <button
                              type="button"
                              disabled={busy || !reassignSel[row.id]}
                              onClick={() => void reassignFornitore(row)}
                              className="rounded-md border border-violet-500/40 bg-violet-500/15 px-2 py-1.5 text-[11px] font-semibold text-violet-100 disabled:opacity-40"
                            >
                              Applica nuovo fornitore
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        ) : null}

        {tab === 'fatture' ? (
          <section className="space-y-3">
            {dupLoading ? (
              <ul className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <li key={i} className="h-32 animate-pulse rounded-lg bg-white/[0.06]" />
                ))}
              </ul>
            ) : dupFat.length === 0 ? (
              <p className="text-sm text-app-fg-muted">Nessun gruppo di fatture duplicate per questa sede.</p>
            ) : (
              <ul className="space-y-4">
                {dupFat.map((g) => (
                  <li
                    key={g.group_key}
                    className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 px-3 py-3 sm:px-4"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200/90">
                      {g.fornitore_nome ?? g.fornitore_id} · n. {g.numero_display}
                    </p>
                    <p className="mt-1 text-[11px] text-app-fg-muted">{g.ai_keep_reason}</p>
                    <ul className="mt-2 space-y-2">
                      {g.fatture.map((f) => (
                        <li
                          key={f.id}
                          className="flex flex-col gap-1 rounded-lg border border-white/10 bg-black/20 px-2 py-2 text-xs sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <span className="font-mono text-[10px] text-app-fg-muted">{f.id.slice(0, 8)}…</span>{' '}
                            Data {f.data} · €{f.importo != null ? f.importo.toFixed(2) : '—'}
                            {f.bolla_id ? (
                              <span className="ms-2 rounded bg-cyan-500/20 px-1 text-[10px] text-cyan-200">
                                bolla collegata
                              </span>
                            ) : null}
                            {f.id === g.ai_keep_id ? (
                              <span className="ms-2 rounded bg-teal-500/25 px-1 text-[10px] text-teal-100">
                                suggerita AI
                              </span>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            <Link
                              href={`/fatture/${f.id}`}
                              className="rounded border border-white/15 px-2 py-0.5 text-[11px] text-app-cyan-400 hover:bg-white/10"
                            >
                              Dettaglio
                            </Link>
                            <button
                              type="button"
                              disabled={dupBusy === g.group_key}
                              onClick={() => void deleteDupFatture(g, f.id)}
                              className="rounded border border-rose-500/35 bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-100"
                            >
                              Tieni questa / elimina le altre
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {tab === 'bolle' ? (
          <section className="space-y-3">
            {dupLoading ? (
              <ul className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <li key={i} className="h-32 animate-pulse rounded-lg bg-white/[0.06]" />
                ))}
              </ul>
            ) : dupBol.length === 0 ? (
              <p className="text-sm text-app-fg-muted">Nessun gruppo di bolle duplicate per questa sede.</p>
            ) : (
              <ul className="space-y-4">
                {dupBol.map((g) => (
                  <li
                    key={g.group_key}
                    className="rounded-xl border border-violet-500/25 bg-violet-950/15 px-3 py-3 sm:px-4"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-violet-200/90">
                      {g.fornitore_nome ?? g.fornitore_id} · n. {g.numero_display}
                    </p>
                    <p className="mt-1 text-[11px] text-app-fg-muted">{g.ai_keep_reason}</p>
                    <ul className="mt-2 space-y-2">
                      {g.bolle.map((b) => (
                        <li
                          key={b.id}
                          className="flex flex-col gap-1 rounded-lg border border-white/10 bg-black/20 px-2 py-2 text-xs sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <span className="font-mono text-[10px] text-app-fg-muted">{b.id.slice(0, 8)}…</span>{' '}
                            Data {b.data} · €{b.importo != null ? b.importo.toFixed(2) : '—'}
                            {b.ha_fattura_collegata ? (
                              <span className="ms-2 rounded bg-emerald-500/20 px-1 text-[10px] text-emerald-200">
                                ha fattura
                              </span>
                            ) : null}
                            {b.id === g.ai_keep_id ? (
                              <span className="ms-2 rounded bg-teal-500/25 px-1 text-[10px] text-teal-100">
                                suggerita AI
                              </span>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            <Link
                              href={`/bolle/${b.id}`}
                              className="rounded border border-white/15 px-2 py-0.5 text-[11px] text-app-cyan-400 hover:bg-white/10"
                            >
                              Dettaglio
                            </Link>
                            <button
                              type="button"
                              disabled={dupBusy === g.group_key}
                              onClick={() => void deleteDupBolle(g, b.id)}
                              className="rounded border border-rose-500/35 bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-100"
                            >
                              Tieni questa / elimina le altre
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {tab === 'rekki' ? (
          <div className="rounded-lg border border-emerald-500/25 bg-emerald-950/15 px-4 py-8 text-center text-sm text-emerald-100/95">
            Nessuna anomalia presente <span aria-hidden>✅</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
