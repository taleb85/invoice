'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { useManualDeliverySede } from '@/lib/use-effective-sede-id'
import { useLocale } from '@/lib/locale-context'
import { useT } from '@/lib/use-t'
import ManualDeliveryForm from '@/components/ManualDeliveryForm'

type FornitoreRow = { id: string; nome: string }

export type ManualDeliveryMobilePanelProps = {
  /** Override sede per query/API (mantiene le stesse regole di visibilità del contesto). */
  sedeId?: string | null
  /** Pre-seleziona fornitore quando presente nella lista sede. */
  fornitoreId?: string | null
}

/**
 * Contenuto “ricevuto senza bolla”: operatore o admin con sede attiva (cookie / profilo / operatore attivo).
 * Titolo mostrato nel foglio aperto dalla bottom bar, non più come H2 sulla dashboard.
 */
export default function ManualDeliveryMobilePanel(props?: ManualDeliveryMobilePanelProps) {
  const { sedeId: sedeIdProp, fornitoreId: fornitoreIdProp } = props ?? {}
  const { me, meLoading, effectiveSedeId: ctxSedeId, visible: ctxVisible } = useManualDeliverySede()
  const { locale } = useLocale()
  const t = useT()

  const [fornitori, setFornitori] = useState<FornitoreRow[]>([])
  const [fornitoreId, setFornitoreId] = useState('')
  const [loadErr, setLoadErr] = useState<string | null>(null)

  const effectiveSedeId = sedeIdProp?.trim() || ctxSedeId
  const visible = ctxVisible && !!effectiveSedeId

  const preferredFornitoreId = fornitoreIdProp?.trim() || null

  useEffect(() => {
    if (!visible || !effectiveSedeId) {
      setFornitori([])
      setFornitoreId('')
      setLoadErr(null)
      return
    }
    const supabase = createClient()
    ;(async () => {
      const { data, error } = await supabase
        .from('fornitori')
        .select('id, nome')
        .eq('sede_id', effectiveSedeId)
        .order('nome')
      if (error) {
        setLoadErr(error.message)
        setFornitori([])
        return
      }
      setLoadErr(null)
      const rows = (data ?? []) as FornitoreRow[]
      setFornitori(rows)
      setFornitoreId((prev) => {
        if (preferredFornitoreId && rows.some((r) => r.id === preferredFornitoreId)) return preferredFornitoreId
        if (prev && rows.some((r) => r.id === prev)) return prev
        return rows[0]?.id ?? ''
      })
    })()
  }, [visible, effectiveSedeId, preferredFornitoreId])

  if (meLoading && !me) {
    return <p className="text-sm text-slate-400">{t.common.loading}</p>
  }

  if (!visible) {
    return <p className="text-sm text-slate-400">{t.dashboard.manualDeliveryNeedSede}</p>
  }

  return (
    <div className="space-y-3" aria-label={t.dashboard.digitalizzaRicevuto}>
      {loadErr ? (
        <p className="text-xs font-medium text-red-400" role="alert">
          {loadErr}
        </p>
      ) : null}

      {fornitori.length === 0 && !loadErr ? (
        <div className="app-card overflow-hidden">
          <div className="app-card-bar" aria-hidden />
          <div className="px-4 py-5 text-center">
            <p className="text-sm text-slate-400">{t.fornitori.noSuppliers}</p>
            <Link
              href="/fornitori/new"
              className="mt-3 inline-block text-sm font-semibold text-cyan-400 hover:text-cyan-300"
            >
              {t.fornitori.addFirst}
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="app-card overflow-hidden">
            <div className="app-card-bar" aria-hidden />
            <div className="p-4">
              <label
                htmlFor="dashboard-manual-fornitore"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-cyan-400/80"
              >
                {t.bolle.fornitoreLabel}
              </label>
              <select
                id="dashboard-manual-fornitore"
                value={fornitoreId}
                onChange={(e) => setFornitoreId(e.target.value)}
                className="w-full rounded-xl border border-slate-600/60 bg-slate-800/70 px-3.5 py-2.5 text-sm text-slate-100 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              >
                {fornitori.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {fornitoreId ? (
            <ManualDeliveryForm fornitoreId={fornitoreId} sedeId={effectiveSedeId} languageHint={locale} />
          ) : null}
        </>
      )}
    </div>
  )
}
