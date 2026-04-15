'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useT } from '@/lib/use-t'

type Props = {
  logId: string
  fileUrl: string | null
  mittente: string
  sedeId: string | null
}

export default function LogSupplierAiSuggest({ logId, fileUrl, mittente, sedeId }: Props) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [nome, setNome] = useState<string | null>(null)
  const [piva, setPiva] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)

  const runSuggest = async () => {
    setOpen(true)
    setLoading(true)
    setErr(null)
    setNome(null)
    setPiva(null)
    setEmail(null)
    try {
      const res = await fetch('/api/admin/log-ai-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId }),
      })
      const json = await res.json()
      if (!res.ok) {
        setErr(json.error ?? t.log.aiSuggestError)
        return
      }
      setNome(json.nome ?? null)
      setPiva(json.piva ?? null)
      setEmail(json.email ?? (mittente.includes('@') ? mittente.toLowerCase() : null))
    } catch {
      setErr(t.log.aiSuggestError)
    } finally {
      setLoading(false)
    }
  }

  const buildNewHref = () => {
    const q = new URLSearchParams()
    if (nome?.trim()) q.set('prefill_nome', nome.trim())
    if (piva?.trim()) q.set('prefill_piva', piva.trim())
    const em = email?.trim() || (mittente.includes('@') ? mittente.toLowerCase() : '')
    if (em) q.set('prefill_email', em)
    if (mittente.includes('@')) q.set('remember_mittente', mittente.toLowerCase())
    if (sedeId?.trim()) q.set('prefill_sede_id', sedeId.trim())
    return `/fornitori/new?${q.toString()}`
  }

  if (!fileUrl) return null

  return (
    <>
      <button
        type="button"
        onClick={runSuggest}
        className="rounded-lg border border-violet-500/40 bg-violet-500/15 px-2 py-1 text-[11px] font-semibold text-violet-100 transition-colors hover:bg-violet-500/25"
      >
        {t.log.aiSuggest}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center app-workspace-scrim p-4 backdrop-blur-sm sm:items-center" role="dialog">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-app-line-30 app-workspace-surface-elevated p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-app-fg">{t.log.aiSuggestTitle}</h3>
            {loading && <p className="mt-3 text-xs text-app-fg-muted">{t.log.aiSuggestLoading}</p>}
            {err && (
              <p className="mt-3 rounded-lg border border-red-500/35 bg-red-950/40 px-3 py-2 text-xs text-red-200">{err}</p>
            )}
            {!loading && !err && (
              <dl className="mt-4 space-y-2 text-xs">
                <div>
                  <dt className="text-app-fg-muted">{t.fornitori.nome}</dt>
                  <dd className="font-medium text-app-fg">{nome ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-app-fg-muted">{t.fornitori.pivaLabel}</dt>
                  <dd className="font-mono text-app-fg">{piva ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-app-fg-muted">{t.fornitori.email}</dt>
                  <dd className="text-app-fg">{email ?? mittente ?? '—'}</dd>
                </div>
              </dl>
            )}
            <p className="mt-4 text-[11px] leading-snug text-app-fg-muted">{t.log.associateRememberHint}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-app-line-28 px-3 py-2 text-xs font-medium text-app-fg-muted hover:bg-app-line-12"
              >
                {t.statements.btnClose}
              </button>
              {!loading && !err && (
                <Link
                  href={buildNewHref()}
                  className="rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white hover:bg-app-cyan-500"
                  onClick={() => setOpen(false)}
                >
                  {t.log.openCreateSupplier}
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
