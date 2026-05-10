'use client'

import { useEffect, useState } from 'react'
import { useMe } from '@/lib/me-context'
import { useActiveOperator } from '@/lib/active-operator-context'
import { effectiveIsAdminSedeUi, effectiveIsMasterAdminPlane } from '@/lib/effective-operator-ui'
import { useManualDeliverySede } from '@/lib/use-effective-sede-id'

type DocRow = {
  id: string
  oggetto_mail: string | null
  file_name: string | null
  stato: string
  created_at: string | null
  metadata: Record<string, unknown> | null
}

type Grouped = {
  kind: string
  count: number
  docs: DocRow[]
}

const KIND_LABEL: Record<string, string> = {
  fattura: '🧾 Fatture',
  bolla: '📦 Bolle',
  statement: '📊 Estratti conto',
  ordine: '📋 Ordini',
  nota_credito: '💳 Note credito',
  comunicazione: '💬 Comunicazioni',
  listino: '📄 Listini',
}

const KIND_ORDER = ['fattura', 'bolla', 'statement', 'ordine', 'nota_credito', 'listino', 'comunicazione']

export default function PendingKindBrowser() {
  const { me } = useMe()
  const { activeOperator } = useActiveOperator()
  const sedeCtx = useManualDeliverySede()
  const sedeId = sedeCtx.effectiveSedeId
  const [groups, setGroups] = useState<Grouped[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [total, setTotal] = useState(0)

  const canView = effectiveIsMasterAdminPlane(me, activeOperator) || effectiveIsAdminSedeUi(me, activeOperator)
  if (!canView) return null

  useEffect(() => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ limit: '500' })
    if (sedeId) params.set('sede_id', sedeId)

    fetch(`/api/documenti-da-processare?${params.toString()}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Errore caricamento'))))
      .then((data: DocRow[]) => {
        const byKind = new Map<string, DocRow[]>()
        for (const doc of data) {
          const kind = (doc.metadata?.pending_kind as string) ?? 'sconosciuto'
          if (!byKind.has(kind)) byKind.set(kind, [])
          byKind.get(kind)!.push(doc)
        }
        const grouped: Grouped[] = KIND_ORDER
          .filter((k) => byKind.has(k))
          .map((k) => ({ kind: k, count: byKind.get(k)!.length, docs: byKind.get(k)! }))
        const otherKinds = [...byKind.keys()].filter((k) => !KIND_ORDER.includes(k))
        for (const k of otherKinds) {
          grouped.push({ kind: k, count: byKind.get(k)!.length, docs: byKind.get(k)! })
        }
        setGroups(grouped)
        setTotal(data.length)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [sedeId])

  return (
    <article className="app-card min-h-0 min-w-0 overflow-hidden p-5">
      <h3 className="text-sm font-semibold text-app-fg">
        Documenti in coda per categoria
        {!loading && <span className="ml-2 text-xs font-normal text-app-fg-muted">({total} totali)</span>}
      </h3>
      <p className="mt-1 mb-3 text-xs text-app-fg-muted">
        Ogni documento è classificato con un <code className="text-[10px]">pending_kind</code>.
        Verifica che la categoria sia corretta prima di procedere.
      </p>

      {loading && <p className="text-xs text-app-fg-muted py-4">Caricamento…</p>}
      {error && <p className="text-xs text-red-400 py-2">{error}</p>}

      {!loading && !error && groups.length === 0 && (
        <p className="text-xs text-app-fg-muted py-4">Nessun documento in coda.</p>
      )}

      <div className="space-y-3">
        {groups.map((g) => (
          <div key={g.kind} className="rounded-lg border border-app-line-25 overflow-hidden">
            <button
              type="button"
              onClick={() => setExpanded(expanded === g.kind ? null : g.kind)}
              className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-xs font-medium text-app-fg hover:bg-app-line-10 transition-colors"
            >
              <span>{KIND_LABEL[g.kind] ?? `❓ ${g.kind}`}</span>
              <span className="inline-flex items-center gap-1.5">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  g.kind === 'fattura' ? 'bg-emerald-500/15 text-emerald-200' :
                  g.kind === 'statement' ? 'bg-amber-500/15 text-amber-200' :
                  g.kind === 'bolla' ? 'bg-indigo-500/15 text-indigo-200' :
                  g.kind === 'comunicazione' ? 'bg-slate-500/15 text-slate-200' :
                  'bg-cyan-500/15 text-cyan-200'
                }`}>
                  {g.count}
                </span>
                <svg className={`h-3 w-3 text-app-fg-muted transition-transform ${expanded === g.kind ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </button>
            {expanded === g.kind && (
              <div className="border-t border-app-line-15">
                {g.docs.map((doc) => {
                  const tipoDoc = doc.metadata?.tipo_documento as string | null | undefined
                  return (
                    <div key={doc.id} className="flex items-start gap-2 border-b border-app-line-10 px-4 py-2 text-xs last:border-0">
                      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                        doc.stato === 'in_attesa' ? 'bg-amber-400' :
                        doc.stato === 'da_associare' ? 'bg-blue-400' :
                        doc.stato === 'da_processare' ? 'bg-cyan-400' :
                        'bg-slate-400'
                      }`} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-app-fg">
                          {doc.oggetto_mail ?? doc.file_name ?? '—'}
                        </p>
                        <p className="truncate text-[10px] text-app-fg-muted">
                          {doc.file_name && doc.oggetto_mail ? `${doc.file_name} · ` : ''}
                          Stato: {doc.stato}
                          {doc.created_at ? ` · ${new Date(doc.created_at).toLocaleDateString('it-IT')}` : ''}
                        </p>
                        {tipoDoc && (
                          <p className="truncate text-[10px] text-cyan-300">
                            OCR: {tipoDoc}
                          </p>
                        )}
                      </div>
                      <code className="shrink-0 text-[9px] text-app-fg-muted font-mono">{doc.id.slice(0, 8)}</code>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </article>
  )
}
