'use client'

import { useEffect, useState } from 'react'
import { useT } from '@/lib/use-t'

type RekkiHit = { id: string; name: string }

export default function RekkiSupplierIntegration({
  fornitoreId,
  piva,
  initialRekkiId,
  initialRekkiLink,
  onSaved,
}: {
  fornitoreId: string
  piva: string | null
  initialRekkiId?: string | null
  initialRekkiLink?: string | null
  onSaved?: () => void
}) {
  const t = useT()
  const [rekkiId, setRekkiId] = useState(initialRekkiId?.trim() ?? '')
  const [rekkiLink, setRekkiLink] = useState(initialRekkiLink?.trim() ?? '')
  const [lookupMsg, setLookupMsg] = useState<string | null>(null)
  const [hits, setHits] = useState<RekkiHit[]>([])
  const [loading, setLoading] = useState<'lookup' | 'save' | null>(null)

  useEffect(() => {
    setRekkiId(initialRekkiId?.trim() ?? '')
    setRekkiLink(initialRekkiLink?.trim() ?? '')
  }, [fornitoreId, initialRekkiId, initialRekkiLink])

  const lookup = async () => {
    if (!piva?.trim()) {
      setLookupMsg(t.fornitori.rekkiLookupNeedVat)
      return
    }
    setLoading('lookup')
    setLookupMsg(null)
    setHits([])
    try {
      const res = await fetch('/api/fornitore-rekki', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'lookup', piva }),
      })
      const j = (await res.json()) as { suppliers?: RekkiHit[]; message?: string }
      setHits(Array.isArray(j.suppliers) ? j.suppliers : [])
      setLookupMsg(j.message ?? null)
    } catch {
      setLookupMsg(t.ui.networkError)
    } finally {
      setLoading(null)
    }
  }

  const save = async () => {
    const rid = rekkiId.trim()
    if (!rid) return
    setLoading('save')
    try {
      const res = await fetch('/api/fornitore-rekki', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          fornitore_id: fornitoreId,
          rekki_supplier_id: rid,
          rekki_link: rekkiLink.trim() || null,
        }),
      })
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        alert(j.error ?? t.common.error)
        return
      }
      onSaved?.()
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="app-card overflow-hidden">
      <div className="app-card-bar" aria-hidden />
      <div className="flex items-center gap-2 border-b border-slate-700/60 px-5 py-3">
        <svg className="h-3.5 w-3.5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t.fornitori.rekkiIntegrationTitle}</p>
      </div>
      <div className="space-y-4 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void lookup()}
            disabled={loading !== null}
            className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-violet-500 disabled:opacity-40"
          >
            {loading === 'lookup' ? t.common.loading : t.fornitori.rekkiLookupByVat}
          </button>
          {piva?.trim() ? (
            <span className="font-mono text-[11px] text-slate-500">VAT: {piva}</span>
          ) : (
            <span className="text-[11px] text-amber-400/90">{t.fornitori.rekkiLookupNeedVat}</span>
          )}
        </div>
        {lookupMsg && <p className="text-xs text-slate-400">{lookupMsg}</p>}
        {hits.length > 0 && (
          <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-700/60 bg-slate-900/50 p-2">
            {hits.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => setRekkiId(h.id)}
                  className="w-full rounded-md px-2 py-1.5 text-left text-xs text-slate-200 transition-colors hover:bg-slate-800/80"
                >
                  <span className="font-mono text-violet-300">{h.id}</span>
                  <span className="ml-2 text-slate-400">{h.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500">{t.fornitori.rekkiIdLabel}</label>
            <input
              type="text"
              value={rekkiId}
              onChange={(e) => setRekkiId(e.target.value)}
              placeholder={t.fornitori.rekkiIdPlaceholder}
              className="w-full rounded-lg border border-slate-600/60 bg-slate-800/70 px-3 py-2 font-mono text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-500">{t.fornitori.rekkiLinkLabel}</label>
            <input
              type="url"
              value={rekkiLink}
              onChange={(e) => setRekkiLink(e.target.value)}
              placeholder={t.fornitori.rekkiLinkPlaceholder}
              className="w-full rounded-lg border border-slate-600/60 bg-slate-800/70 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => void save()}
          disabled={loading !== null || !rekkiId.trim()}
          className="rounded-lg bg-cyan-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-cyan-500 disabled:opacity-40"
        >
          {loading === 'save' ? t.common.saving : t.fornitori.rekkiSaveRekkiMapping}
        </button>
      </div>
    </div>
  )
}
