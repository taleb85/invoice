'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMe } from '@/lib/me-context'
import { useToast } from '@/lib/toast-context'

type DupGroup = {
  group_key: string
  group_kind: 'same_file_url' | 'shell_fatture'
  file_url: string | null
  fornitore_id: string | null
  fornitore_nome: string | null
  data_doc: string | null
  count: number
  keep_id: string
  keep_reason: string
  delete_ids: string[]
  fatture: Array<{
    id: string
    file_url: string | null
    data: string | null
    importo: number | null
    numero_fattura: string | null
    bolla_id: string | null
    created_at: string
    approval_status: string | null
    keep: boolean
  }>
}

type Props = {
  fornitoreId?: string
  className?: string
}

/**
 * Badge che compare solo se esistono fatture con lo STESSO `file_url`
 * (duplicati di registrazione automatica). Permette all'admin di
 * eliminarle tenendo la "migliore" (con bolla → numero → importo → più vecchia).
 */
export default function FattureDuplicatesByFileCleanup({ fornitoreId, className = '' }: Props) {
  const { me } = useMe()
  const { showToast } = useToast()
  const router = useRouter()
  const [groups, setGroups] = useState<DupGroup[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [showDetail, setShowDetail] = useState(false)

  const canRun = Boolean(me?.is_admin || me?.is_admin_sede)

  const load = useCallback(async () => {
    if (!canRun) return
    const qs = new URLSearchParams()
    if (fornitoreId) qs.set('fornitore_id', fornitoreId)
    try {
      const res = await fetch(`/api/admin/fatture-duplicates-by-file?${qs.toString()}`, { credentials: 'include' })
      if (!res.ok) return
      const j = await res.json() as { groups?: DupGroup[] }
      setGroups(j.groups ?? [])
    } catch {
      // silenzioso: se la chiamata fallisce non rompiamo la pagina
    }
  }, [canRun, fornitoreId])

  useEffect(() => {
    void load()
  }, [load])

  if (!canRun) return null
  if (!groups || groups.length === 0) return null

  const extrasToDelete = groups.reduce((acc, g) => acc + g.delete_ids.length, 0)
  const sameFileCount = groups.filter(g => g.group_kind === 'same_file_url').length
  const shellCount = groups.filter(g => g.group_kind === 'shell_fatture').length

  const handleDelete = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/admin/fatture-duplicates-by-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'delete-extras',
          fornitore_id: fornitoreId ?? null,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: 'Errore' }))
        showToast(j.error ?? 'Errore eliminazione duplicati', 'error')
        return
      }
      const j = await res.json() as { deleted?: number }
      showToast(`${j.deleted ?? 0} fatture duplicate eliminate`, 'success')
      setConfirming(false)
      setShowDetail(false)
      setGroups([])
      window.dispatchEvent(new CustomEvent('fattura-mutated', { detail: { source: 'cleanup' } }))
      router.refresh()
    } catch {
      showToast('Errore di connessione', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`mb-3 rounded-xl border border-rose-500/30 bg-rose-500/8 px-4 py-3 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-rose-200">
            Rilevati {groups.length} {groups.length === 1 ? 'gruppo' : 'gruppi'} di fatture duplicate
            {' '}({extrasToDelete} record in eccesso)
          </p>
          <p className="mt-0.5 text-[11px] text-rose-100/80">
            {sameFileCount > 0 && (
              <>{sameFileCount} {sameFileCount === 1 ? 'gruppo' : 'gruppi'} con stesso file PDF. </>
            )}
            {shellCount > 0 && (
              <>{shellCount} {shellCount === 1 ? 'gruppo' : 'gruppi'} di fatture senza numero né importo (stesso fornitore + data) — tipiche conversioni automatiche da estratti conto duplicati. </>
            )}
            Per ogni gruppo verrà tenuta una sola fattura (con bolla, numero o importo se presenti).
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowDetail(v => !v)}
            className="rounded-lg border border-rose-500/30 bg-transparent px-2.5 py-1.5 text-xs font-semibold text-rose-100 transition-colors hover:bg-rose-500/15"
          >
            {showDetail ? 'Nascondi dettaglio' : 'Mostra dettaglio'}
          </button>
          {confirming ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={handleDelete}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/45 bg-rose-500/25 px-3 py-1.5 text-xs font-semibold text-rose-50 transition-colors hover:bg-rose-500/35 disabled:opacity-50"
              >
                {busy ? (
                  <>
                    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-rose-200 border-t-transparent" />
                    Eliminazione…
                  </>
                ) : (
                  `Sì, elimina ${extrasToDelete}`
                )}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirming(false)}
                className="rounded-lg border border-app-line-28 bg-transparent px-2.5 py-1.5 text-xs font-semibold text-app-fg transition-colors hover:bg-app-line-10 disabled:opacity-50"
              >
                Annulla
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-100 transition-colors hover:bg-rose-500/25"
            >
              Pulisci duplicati
            </button>
          )}
        </div>
      </div>

      {showDetail && (
        <div className="mt-3 space-y-2 border-t border-rose-500/20 pt-3">
          {groups.map((g) => (
            <div key={g.group_key} className="rounded-lg border border-rose-500/20 bg-rose-500/[0.04] px-3 py-2 text-xs">
              <p className="font-semibold text-rose-100">
                <span className={`mr-2 rounded-full px-1.5 py-0.5 text-[10px] uppercase ${g.group_kind === 'same_file_url' ? 'bg-rose-500/15 text-rose-100' : 'bg-amber-500/15 text-amber-100'}`}>
                  {g.group_kind === 'same_file_url' ? 'stesso PDF' : 'shell fattura'}
                </span>
                {g.fornitore_nome ?? 'Fornitore sconosciuto'}
                {g.data_doc ? <> · <span className="tabular-nums">{g.data_doc}</span></> : null}
                {' · '}{g.count} record · tenere: <span className="font-mono text-emerald-300">{g.keep_id.slice(0, 8)}…</span>
              </p>
              <p className="mt-0.5 text-[11px] text-rose-100/70">Motivo: {g.keep_reason}</p>
              <ul className="mt-1.5 space-y-0.5 text-[11px] text-rose-100/80">
                {g.fatture.map(f => (
                  <li key={f.id} className={`flex flex-wrap items-center gap-2 ${f.keep ? 'text-emerald-200' : 'text-rose-200/70 line-through decoration-rose-400/40'}`}>
                    <span className="font-mono">{f.id.slice(0, 8)}…</span>
                    <span>{f.data ?? '—'}</span>
                    <span>{f.numero_fattura ?? '(senza n°)'}</span>
                    <span>{f.importo != null ? `€ ${f.importo.toFixed(2)}` : '(senza importo)'}</span>
                    {f.bolla_id ? <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 font-semibold text-emerald-200">bolla</span> : null}
                    {f.keep ? <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 font-semibold text-emerald-100">TIENI</span> : <span className="rounded-full bg-rose-500/20 px-1.5 py-0.5 font-semibold text-rose-100">elimina</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
