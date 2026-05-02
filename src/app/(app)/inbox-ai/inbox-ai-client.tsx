'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { DupBollaGroup, DupFatturaGroup } from '@/lib/inbox-ai-duplicate-groups'
import { SUMMARY_HIGHLIGHT_SURFACE_CLASS } from '@/lib/summary-highlight-accent'
import { createClient } from '@/utils/supabase/client'
import { OpenDocumentInAppButton } from '@/components/OpenDocumentInAppButton'
import { compareInboxQueueNewestFirst } from '@/lib/inbox-ai-doc-queue-sort'
import {
  GEMINI_AUTO_DISCARD_ALTRIO_MIN_CONF,
  inboxClassificationShouldAutoDiscard,
} from '@/lib/gemini-inbox-classify'
import { useT } from '@/lib/use-t'
import { Ban, UserPlus } from 'lucide-react'
import { GlyphCheck } from '@/components/ui/glyph-icons'
import { extractEmailFromSenderHeader } from '@/lib/sender-email'
import { useToast } from '@/lib/toast-context'
import { useRouter } from 'next/navigation'

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
  /** Se valorizzato, ordinamento coda allineato al giorno documento come in batch Gemini */
  data_documento?: string | null
  stato: string
  fornitore_id: string | null
  fornitore?: { nome?: string | null } | null
  mittente?: string | null
  metadata?: unknown
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

function parseInitialTab(raw: string | undefined): TabId {
  const p = raw?.trim().toLowerCase()
  if (p === 'audit' || p === 'docs' || p === 'fatture' || p === 'bolle' || p === 'rekki') return p
  return 'docs'
}

function tipoAiToPendingKind(tipo: string): 'fattura' | 'bolla' | 'statement' | 'ordine' | 'listino' | null {
  const k = tipo.toLowerCase().trim()
  if (k === 'fattura') return 'fattura'
  if (k === 'bolla' || k === 'ddt') return 'bolla'
  if (k === 'estratto_conto') return 'statement'
  if (k === 'ordine') return 'ordine'
  if (k === 'listino') return 'listino'
  return null
}

/** Conferma automatica dopo la risposta Gemini (stesso criterio visivo del %. mostrato). */
const AUTO_FINALIZE_AI_CONF_MIN = 0.95
/** Fattura/bolla/… rimangono a 0.95; listino permette più varianti Gemini (≈90% reali). */
const AUTO_FINALIZE_LISTINO_CONF_MIN = 0.9
/** Batch `gemini_classify` (stesso `BATCH` in `api/admin/reprocess-pending-docs`). */
const INBOX_AI_GEMINI_CLASSIFY_BATCH = 5

function suggestionConf01(s: GeminiSuggestion): number {
  const x =
    typeof s.confidenza === 'number' ? s.confidenza : Number.parseFloat(String(s.confidenza))
  if (!Number.isFinite(x)) return 0.5
  return Math.min(1, Math.max(0, x))
}

function pdfNomeFromMetadata(meta: unknown): string {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return ''
  const r = (meta as { ragione_sociale?: string | null }).ragione_sociale
  return typeof r === 'string' && r.trim() ? r.trim() : ''
}

export default function InboxAiClient(props: {
  sedeId: string | null
  /** Nessuna sede operativa per operatore — blocco totale */
  blockedNoSede: boolean
  /** Deep-link dalla pagina Centro operazioni o bookmark (`?tab=audit`). */
  initialTab?: string | null
}) {
  const { sedeId, blockedNoSede, initialTab } = props
  const t = useT()
  const { showToast } = useToast()
  const router = useRouter()
  const [tab, setTab] = useState<TabId>(() => parseInitialTab(initialTab ?? undefined))
  const [docs, setDocs] = useState<PendingDocRow[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [dupFat, setDupFat] = useState<DupFatturaGroup[]>([])
  const [dupBol, setDupBol] = useState<DupBollaGroup[]>([])
  const [dupLoading, setDupLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<Record<string, GeminiSuggestion>>({})
  const [analyzeBusy, setAnalyzeBusy] = useState(false)
  /** ID documenti del batch corrente (evidenza UI durante la POST + post-elaborazioni). */
  const [analyzeTargetIds, setAnalyzeTargetIds] = useState<string[]>([])
  const [confirmAllBusy, setConfirmAllBusy] = useState(false)
  const [resolvedToday, setResolvedToday] = useState(0)
  const [actionBusy, setActionBusy] = useState<string | null>(null)
  const [dupBusy, setDupBusy] = useState<string | null>(null)

  const [auditRows, setAuditRows] = useState<AuditMatchRow[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [fornitori, setFornitori] = useState<FornitoreOption[]>([])
  const [reassignSel, setReassignSel] = useState<Record<string, string>>({})
  const [auditBusy, setAuditBusy] = useState<string | null>(null)
  const [supplierModal, setSupplierModal] = useState<PendingDocRow | null>(null)
  const [supplierNomeDraft, setSupplierNomeDraft] = useState('')
  const [supplierEmailDraft, setSupplierEmailDraft] = useState('')
  const [supplierSaveBusy, setSupplierSaveBusy] = useState(false)

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

  /** Stessa regola del POST `gemini_classify` per evitare ordine “dal basso” vs analisi. */
  const docsNewestFirst = useMemo(() => {
    return [...docs].sort(compareInboxQueueNewestFirst)
  }, [docs])

  /** Quanti documenti analizzati possono essere confermati in un colpo solo (tipo riconosciuto + fornitore). */
  const confirmAllEligibleCount = useMemo(() => {
    return docsNewestFirst.filter((d) => {
      const sug = suggestions[d.id]
      if (!sug) return false
      const kind = tipoAiToPendingKind(sug.tipo_suggerito)
      return !!(kind && d.fornitore_id)
    }).length
  }, [docsNewestFirst, suggestions])

  /** Conteggio documenti dentro i gruppi duplicati (il badge deve riflettere le righe in elenco, non solo i gruppi). */
  const dupFattureRigheCount = useMemo(
    () => dupFat.reduce((s, g) => s + g.fatture.length, 0),
    [dupFat],
  )
  const dupBolleRigheCount = useMemo(
    () => dupBol.reduce((s, g) => s + g.bolle.length, 0),
    [dupBol],
  )

  const runAnalyze = async () => {
    if (!sedeId) return
    const excludeSet = new Set(excludedForNextBatch)
    const snapshotBatch = docsNewestFirst
      .filter((d) => !excludeSet.has(d.id))
      .slice(0, INBOX_AI_GEMINI_CLASSIFY_BATCH)
      .map((d) => d.id)
    setAnalyzeTargetIds(snapshotBatch)
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

      /** Stessa copia lista usata dall’analisi dopo ogni finalize (stato aggiorna in modo asincrono). */
      let workingDocs = [...docs]
      const discardedAuto = new Set<string>()
      let didMutateQueue = false

      for (const s of list) {
        if (!inboxClassificationShouldAutoDiscard(s)) continue
        const row = workingDocs.find((d) => d.id === s.doc_id)
        if (!row) continue
        try {
          await postDoc({ id: s.doc_id, azione: 'scarta' })
          discardedAuto.add(s.doc_id)
          workingDocs = workingDocs.filter((d) => d.id !== s.doc_id)
          setDocs((d) => d.filter((x) => x.id !== s.doc_id))
          setSuggestions((prev) => {
            const next = { ...prev }
            delete next[s.doc_id]
            return next
          })
          setResolvedToday(bumpResolved(1))
          didMutateQueue = true
        } catch (e) {
          window.alert(e instanceof Error ? e.message : 'Scarto automatico non riuscito')
          break
        }
      }

      if (discardedAuto.size > 0) {
        showToast(t.log.activityAiInboxAutoDiscardedToast.replace(/\{n\}/g, String(discardedAuto.size)), 'success')
      }

      for (const s of list) {
        if (discardedAuto.has(s.doc_id)) continue
        const row = workingDocs.find((d) => d.id === s.doc_id)
        if (!row) continue
        const kind = tipoAiToPendingKind(s.tipo_suggerito)
        if (!kind || !row.fornitore_id) continue
        const conf = suggestionConf01(s)
        const minConf =
          kind === 'listino' ? AUTO_FINALIZE_LISTINO_CONF_MIN : AUTO_FINALIZE_AI_CONF_MIN
        if (conf < minConf) continue
        const ok = await finalizeWithKind(row.id, kind)
        if (!ok) break
        didMutateQueue = true
        workingDocs = workingDocs.filter((d) => d.id !== row.id)
      }

      if (didMutateQueue) router.refresh()
    } finally {
      setAnalyzeBusy(false)
      setAnalyzeTargetIds([])
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

  const finalizeWithKind = async (
    docId: string,
    kind: 'fattura' | 'bolla' | 'statement' | 'ordine' | 'listino',
  ): Promise<boolean> => {
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
      return true
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Operazione non riuscita')
      return false
    } finally {
      setActionBusy(null)
    }
  }

  /** Registra come fattura, bolla o listino (pulsanti manuali sulla riga). */
  const finalizeAs = async (
    docId: string,
    kind: 'fattura' | 'bolla' | 'listino',
  ) => {
    await finalizeWithKind(docId, kind)
  }

  /** Una conferma dopo l’analisi AI: registra nell’ordine lista (recenti prima) tutti i documenti con suggerimento applicabile. */
  const confirmAllAiSuggestions = async () => {
    const queued: {
      row: PendingDocRow
      kind: NonNullable<ReturnType<typeof tipoAiToPendingKind>>
    }[] = []
    for (const d of docsNewestFirst) {
      const sug = suggestions[d.id]
      if (!sug) continue
      const kind = tipoAiToPendingKind(sug.tipo_suggerito)
      if (!kind || !d.fornitore_id) continue
      queued.push({ row: d, kind })
    }
    if (queued.length === 0) {
      window.alert(
        'Nessun documento pronto per la conferma massiva: serve fornitore associato e tipo (fattura, bolla, listino, ordine, estratto) riconosciuto dall’AI.',
      )
      return
    }
    setConfirmAllBusy(true)
    try {
      for (const { row, kind } of queued) {
        const ok = await finalizeWithKind(row.id, kind)
        if (!ok) break
      }
    } finally {
      setConfirmAllBusy(false)
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
      showToast(t.log.activityDocDiscardedToast, 'success')
      router.refresh()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Operazione non riuscita', 'error')
    } finally {
      setActionBusy(null)
    }
  }

  const ignoreSenderAndDiscard = async (doc: PendingDocRow) => {
    const email = extractEmailFromSenderHeader(doc.mittente ?? '')
    if (!email?.includes('@')) {
      showToast(t.log.activityNeedEmailOnRow, 'error')
      return
    }
    if (!sedeId) return
    setActionBusy(doc.id)
    try {
      const bl = await fetch('/api/email-blacklist', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mittente: doc.mittente?.trim() || email,
          motivo: 'non_fornitore',
          sede_id: sedeId,
        }),
      })
      const bj = (await bl.json().catch(() => ({}))) as { error?: string }
      if (!bl.ok) {
        showToast(bj.error ?? t.log.blacklistError, 'error')
        return
      }
      await postDoc({ id: doc.id, azione: 'scarta' })
      setDocs((d) => d.filter((x) => x.id !== doc.id))
      setSuggestions((s) => {
        const n = { ...s }
        delete n[doc.id]
        return n
      })
      setResolvedToday(bumpResolved(1))
      showToast(t.log.activityIgnoreSenderDoneToast, 'success')
      router.refresh()
    } catch (e) {
      showToast(e instanceof Error ? e.message : t.log.blacklistError, 'error')
    } finally {
      setActionBusy(null)
    }
  }

  const openSupplierModal = (doc: PendingDocRow) => {
    const email = extractEmailFromSenderHeader(doc.mittente ?? '') ?? ''
    const sug = suggestions[doc.id]
    const fromAi = typeof sug?.fornitore_suggerito === 'string' ? sug.fornitore_suggerito.trim() : ''
    const fromPdf = pdfNomeFromMetadata(doc.metadata)
    setSupplierNomeDraft(fromAi || fromPdf || '')
    setSupplierEmailDraft(email)
    setSupplierModal(doc)
  }

  const submitSupplierModal = async () => {
    const doc = supplierModal
    if (!doc || !sedeId) return
    const nome = supplierNomeDraft.trim()
    const email = supplierEmailDraft.trim().toLowerCase()
    if (!nome) {
      showToast(`${t.fornitori.nome}: obbligatorio`, 'error')
      return
    }
    if (!email.includes('@')) {
      showToast(t.log.activityNeedEmailOnRow, 'error')
      return
    }
    setSupplierSaveBusy(true)
    try {
      const res = await fetch('/api/fornitori', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ nome, email, sede_id: sedeId }),
      })
      const j = (await res.json()) as {
        error?: string
        retroactive?: { processed: number; scanned?: number; errors?: string[] }
      }
      if (!res.ok) {
        showToast(j.error ?? 'Errore salvataggio', 'error')
        return
      }
      const n = j.retroactive?.processed ?? 0
      showToast(
        t.log.activitySupplierAddedReprocessedToast.replace(/\{n\}/g, String(n)),
        'success',
      )
      setSupplierModal(null)
      setDocs((d) => d.filter((x) => x.id !== doc.id))
      setSuggestions((s) => {
        const next = { ...s }
        delete next[doc.id]
        return next
      })
      await loadDocs()
      router.refresh()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Errore', 'error')
    } finally {
      setSupplierSaveBusy(false)
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
    if (id === 'fatture') return dupFattureRigheCount
    if (id === 'bolle') return dupBolleRigheCount
    if (id === 'audit') return auditRows.length
    if (id === 'rekki') return 0
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
      <p className="rounded-xl border border-app-line-35 bg-app-line-10 px-4 py-3 text-sm text-app-fg-muted">
        Seleziona una sede (menu sede admin) per caricare documenti e duplicati in questa vista.
      </p>
    )
  }

  return (
    <div className={SUMMARY_HIGHLIGHT_SURFACE_CLASS}>
      <div className="app-card-bar-accent shrink-0 bg-gradient-to-r from-slate-500/40 via-slate-400/30 to-slate-500/35" aria-hidden />
      <div className="space-y-5 p-4 sm:p-5">
        <div className="flex flex-col gap-3 border-b border-white/10 pb-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-teal-200/95">{resolvedToday} risolti oggi</p>
          {tab === 'docs' ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void runAnalyze()}
                disabled={analyzeBusy || confirmAllBusy || docs.length === 0}
                className="rounded-lg bg-gradient-to-r from-teal-600 to-sky-600 px-3 py-2 text-xs font-bold text-white shadow disabled:opacity-40"
              >
                {analyzeBusy ? 'Analisi AI…' : 'Analizza con AI (prossimi 5)'}
              </button>
              <button
                type="button"
                onClick={() => void confirmAllAiSuggestions()}
                disabled={
                  analyzeBusy || confirmAllBusy || docs.length === 0 || confirmAllEligibleCount === 0
                }
                title={
                  confirmAllEligibleCount === 0
                    ? 'Analizza con AI con fornitore associato: il pulsante attiva quando c’è almeno un documento confermabile in blocco.'
                    : `Applica suggerimento e registra per ${confirmAllEligibleCount} documento/i (ordine lista, recenti prima).`
                }
                className="rounded-md border border-cyan-400/50 bg-gradient-to-r from-cyan-600/90 to-teal-600/90 px-2.5 py-2 text-xs font-bold text-white shadow disabled:opacity-35"
              >
                {confirmAllBusy ? 'Conferma in corso…' : `Conferma suggeriti (${confirmAllEligibleCount})`}
              </button>
            </div>
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
              <span className="font-mono text-app-fg">da_revisionare</span>). Con{' '}
              <span className="font-semibold text-app-fg">fornitore associato</span>, registrazione automatica se confidenza ok: almeno{' '}
              <span className="font-semibold text-app-fg">95%</span> per fattura/bolla/ordine/estratto; almeno{' '}
              <span className="font-semibold text-app-fg">90%</span> per{' '}
              <span className="font-mono text-app-fg">listino</span> (
              <span lang="en" className="text-app-fg/90">
                e.g. &quot;Price Update&quot;, price lists
              </span>
              ).{' '}
              <span className="font-semibold text-app-fg">Tipo altro</span>
              chiaramente non contabile alla stessa confidenza{' '}
              <span className="font-semibold text-app-fg">
                (~{Math.round(GEMINI_AUTO_DISCARD_ALTRIO_MIN_CONF * 100)}%)
              </span>{' '}
              viene{' '}
              <span className="font-semibold text-app-fg">scartato in automatico</span> dall’analisi AI.{' '}
              Altrimenti{' '}
              <span className="font-semibold text-app-fg">Conferma suggeriti</span> o i pulsanti riga (incluso{' '}
              <span className="font-semibold text-app-fg">Registra listino</span>
              ). Ogni analisi mostra un segno di spunta e il dettaglio.
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
              <p className="text-sm text-app-fg-muted">{t.log.activityQueueEmptyCelebrate}</p>
            ) : (
              <ul className="space-y-3" aria-busy={analyzeBusy}>
                {docsNewestFirst.map((d) => {
                  const sug = suggestions[d.id]
                  const supplier =
                    d.fornitore?.nome ?? (d.fornitore_id ? '(fornitore ID)' : '— sconosciuto —')
                  const busyRow = actionBusy === d.id
                  const needsSupplier = !d.fornitore_id
                  const inGeminiAnalyze = analyzeBusy && analyzeTargetIds.includes(d.id)
                  return (
                    <li
                      key={d.id}
                      className={`rounded-xl border px-3 py-3 sm:px-4 ${
                        inGeminiAnalyze
                          ? 'border-cyan-400/50 bg-gradient-to-br from-cyan-950/[0.33] to-white/[0.04] shadow-[0_0_28px_-8px_rgba(34,211,238,0.38)]'
                          : sug
                            ? 'border-teal-500/35 bg-gradient-to-br from-teal-950/25 to-white/[0.03]'
                            : 'border-white/10 bg-white/[0.03]'
                      } ${inGeminiAnalyze ? 'animate-pulse' : ''}`}
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 gap-2.5">
                          <div
                            className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm ${
                              inGeminiAnalyze
                                ? 'border-cyan-400/45 bg-cyan-950/35'
                                : 'border-white/10 bg-black/20'
                            }`}
                            title={
                              sug
                                ? 'Analizzato dall’AI'
                                : inGeminiAnalyze
                                  ? 'Analisi Gemini in corso…'
                                  : 'In attesa di analisi'
                            }
                          >
                            {sug ? (
                              <GlyphCheck className="h-3.5 w-3.5 text-emerald-300" aria-hidden />
                            ) : inGeminiAnalyze ? (
                              <span
                                className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-cyan-200/90 border-t-transparent"
                                aria-hidden
                              />
                            ) : (
                              <span className="text-app-fg-subtle" aria-hidden>
                                ○
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                              <p className="min-w-0 flex-1 truncate text-sm font-semibold text-app-fg">
                                {d.file_name ?? 'Senza nome file'}
                              </p>
                              {d.file_url ? (
                                <OpenDocumentInAppButton
                                  documentoId={d.id}
                                  fileUrl={d.file_url}
                                  className="shrink-0 text-[11px] font-semibold text-cyan-400/95 hover:text-cyan-300 hover:underline"
                                  title={t.bolle.viewDocument}
                                >
                                  {t.bolle.viewDocument}
                                </OpenDocumentInAppButton>
                              ) : null}
                            </div>
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
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-1.5 sm:max-w-[min(100%,24rem)] sm:justify-end">
                          {needsSupplier ? (
                            <>
                              <button
                                type="button"
                                disabled={busyRow}
                                onClick={() => void ignoreSenderAndDiscard(d)}
                                className="inline-flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-950/35 px-2 py-1 text-[11px] font-bold text-rose-100 disabled:opacity-35"
                              >
                                <Ban className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
                                {t.log.activityInboxIgnoreSender}
                              </button>
                              <button
                                type="button"
                                disabled={busyRow}
                                onClick={() => openSupplierModal(d)}
                                className="inline-flex items-center gap-1 rounded-md border border-teal-500/45 bg-teal-500/15 px-2 py-1 text-[11px] font-bold text-teal-100 disabled:opacity-35"
                              >
                                <UserPlus className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
                                {t.log.activityInboxAddSupplier}
                              </button>
                            </>
                          ) : null}
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
                            disabled={busyRow || !d.fornitore_id}
                            title={
                              !d.fornitore_id
                                ? 'Associa un fornitore al documento prima di registrare'
                                : 'Salva come fattura tecnica — poi dal listino fornitore puoi estrarre i prezzi (Analizza)'
                            }
                            onClick={() => void finalizeAs(d.id, 'listino')}
                            className="rounded-md border border-sky-500/45 bg-sky-500/15 px-2 py-1 text-[11px] font-bold text-sky-100 disabled:opacity-35"
                          >
                            Registra listino
                          </button>
                          <button
                            type="button"
                            disabled={busyRow}
                            onClick={() => void ignoreDoc(d.id)}
                            className="rounded-md border border-white/15 px-2 py-1 text-[11px] font-semibold text-app-fg-muted hover:bg-white/10"
                          >
                            {t.log.activityInboxDiscard}
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
                <span className="inline-flex items-center justify-center gap-1.5">
                  Tutti gli abbinamenti sono corretti
                  <GlyphCheck className="h-4 w-4 text-emerald-300" aria-hidden />
                </span>
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
                            {f.file_url?.trim() ? (
                              <OpenDocumentInAppButton
                                fatturaId={f.id}
                                fileUrl={f.file_url}
                                className="rounded border border-white/15 px-2 py-0.5 text-[11px] text-app-cyan-400 hover:bg-white/10"
                                title={t.bolle.viewDocument}
                              >
                                Dettaglio
                              </OpenDocumentInAppButton>
                            ) : (
                              <Link
                                href={`/fatture/${f.id}`}
                                className="rounded border border-white/15 px-2 py-0.5 text-[11px] text-app-cyan-400 hover:bg-white/10"
                              >
                                Dettaglio
                              </Link>
                            )}
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
                            {b.file_url?.trim() ? (
                              <OpenDocumentInAppButton
                                bollaId={b.id}
                                fileUrl={b.file_url}
                                className="rounded border border-white/15 px-2 py-0.5 text-[11px] text-app-cyan-400 hover:bg-white/10"
                                title={t.bolle.viewDocument}
                              >
                                Dettaglio
                              </OpenDocumentInAppButton>
                            ) : (
                              <Link
                                href={`/bolle/${b.id}`}
                                className="rounded border border-white/15 px-2 py-0.5 text-[11px] text-app-cyan-400 hover:bg-white/10"
                              >
                                Dettaglio
                              </Link>
                            )}
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
            <span className="inline-flex items-center justify-center gap-1.5">
              Nessuna anomalia presente
              <GlyphCheck className="h-4 w-4 text-emerald-300" aria-hidden />
            </span>
          </div>
        ) : null}
      </div>

      {supplierModal ? (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 p-4 sm:items-center"
          role="dialog"
          aria-modal
          aria-labelledby="inbox-add-supplier-title"
        >
          <div className="app-card max-h-[90dvh] w-full max-w-md overflow-y-auto border border-white/15 p-4 shadow-2xl">
            <h2 id="inbox-add-supplier-title" className="text-base font-semibold text-app-fg">
              {t.log.activityAddSupplierModalTitle}
            </h2>
            <p className="mt-1 text-xs text-app-fg-muted">
              {t.fornitori.nome} · {t.log.activityPdfNameLabel}
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-medium text-app-fg-muted">
                {t.fornitori.nome}
                <input
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-app-fg"
                  value={supplierNomeDraft}
                  onChange={(e) => setSupplierNomeDraft(e.target.value)}
                  autoComplete="organization"
                />
              </label>
              <label className="block text-xs font-medium text-app-fg-muted">
                {t.fornitori.email}
                <input
                  type="email"
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-app-fg"
                  value={supplierEmailDraft}
                  onChange={(e) => setSupplierEmailDraft(e.target.value)}
                  autoComplete="email"
                />
              </label>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-white/15 px-3 py-2 text-sm text-app-fg-muted hover:bg-white/10"
                onClick={() => setSupplierModal(null)}
                disabled={supplierSaveBusy}
              >
                {t.log.activityCancel}
              </button>
              <button
                type="button"
                disabled={supplierSaveBusy}
                className="rounded-lg bg-gradient-to-r from-teal-600 to-sky-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
                onClick={() => void submitSupplierModal()}
              >
                {supplierSaveBusy ? '…' : t.log.activitySaveSupplier}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
