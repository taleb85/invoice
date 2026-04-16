'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/use-t'
import { useLocale } from '@/lib/locale-context'
import { formatDate as formatDateLib } from '@/lib/locale'
import { compareIsoDateStrings } from '@/lib/listino-document-date'
import { APP_SECTION_TABLE_HEAD_ROW, APP_SECTION_TABLE_TBODY } from '@/lib/app-shell-layout'

export type ListinoDocReferenceRow = { prodotto: string; prezzo: number; data_prezzo: string }

function latestRowForProduct(rows: ListinoDocReferenceRow[], prodotto: string): ListinoDocReferenceRow | null {
  const p = prodotto.trim()
  let best: ListinoDocReferenceRow | null = null
  for (const r of rows) {
    if (r.prodotto.trim() !== p) continue
    if (!best || compareIsoDateStrings(r.data_prezzo, best.data_prezzo) > 0) best = r
  }
  return best
}

function maxListinoDateForProduct(rows: ListinoDocReferenceRow[], prodotto: string): string | null {
  const latest = latestRowForProduct(rows, prodotto)
  return latest ? latest.data_prezzo.slice(0, 10) : null
}

/** Riferimento listino su scheda documento: evidenzia righe «bloccate» e consente forzatura (stesso accesso di `/api/listino/prezzi`). */
export default function ListinoDocReferenceTable({
  documentDateIso,
  fornitoreId,
  rows,
  allowAdminForce,
}: {
  documentDateIso: string
  fornitoreId: string
  rows: ListinoDocReferenceRow[]
  /** Utente autenticato: il server applica comunque i controlli sede su `POST /api/listino/prezzi`. */
  allowAdminForce: boolean
}) {
  const t = useT()
  const { locale, timezone } = useLocale()
  const router = useRouter()
  const [workingKey, setWorkingKey] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const doc = documentDateIso.slice(0, 10)

  const formatDate = useCallback(
    (d: string) => formatDateLib(d, locale, timezone, { day: '2-digit', month: 'short', year: 'numeric' }),
    [locale, timezone],
  )

  const rowMeta = useMemo(() => {
    return rows.map((row) => {
      const maxD = maxListinoDateForProduct(rows, row.prodotto)
      const blocked = maxD != null && compareIsoDateStrings(doc, maxD) < 0
      const latest = latestRowForProduct(rows, row.prodotto)
      const isLatestForProduct =
        latest != null &&
        latest.prodotto.trim() === row.prodotto.trim() &&
        latest.data_prezzo.slice(0, 10) === row.data_prezzo.slice(0, 10)
      return { row, blocked, isLatestForProduct, key: `${row.prodotto}-${row.data_prezzo}` }
    })
  }, [rows, doc])

  const forceRow = async (row: ListinoDocReferenceRow) => {
    const latest = latestRowForProduct(rows, row.prodotto)
    if (!latest) return
    setMsg(null)
    setWorkingKey(`${row.prodotto}-${row.data_prezzo}`)
    try {
      const res = await fetch('/api/listino/prezzi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fornitore_id: fornitoreId,
          rows: [
            {
              prodotto: latest.prodotto.trim(),
              prezzo: latest.prezzo,
              data_prezzo: doc,
              note: `Forzatura da documento (data listino = data documento; ultimo prezzo noto £${Number(latest.prezzo).toFixed(2)} al ${latest.data_prezzo.slice(0, 10)})`,
              force_outdated: true,
            },
          ],
        }),
      })
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setMsg({ kind: 'err', text: j.error ?? t.appStrings.listinoDocForceErr })
        return
      }
      setMsg({ kind: 'ok', text: t.appStrings.listinoDocForceOk })
      router.refresh()
    } catch {
      setMsg({ kind: 'err', text: t.appStrings.listinoDocForceErr })
    } finally {
      setWorkingKey(null)
    }
  }

  if (rows.length === 0) return null

  return (
    <div className="overflow-x-auto">
      {msg ? (
        <p
          className={`mb-2 text-[11px] ${msg.kind === 'ok' ? 'text-emerald-200/90' : 'text-red-200/90'}`}
          role={msg.kind === 'err' ? 'alert' : undefined}
        >
          {msg.text}
        </p>
      ) : null}
      <table className="w-full text-left text-xs">
        <thead>
          <tr className={`${APP_SECTION_TABLE_HEAD_ROW} text-app-fg-muted`}>
            <th className="py-2 pr-3 font-medium">{t.fornitori.listinoProdotti}</th>
            <th className="py-2 pr-3 text-right font-medium">{t.fornitori.listinoColImporto}</th>
            <th className="py-2 pr-3 font-medium">{t.fornitori.listinoColData}</th>
            <th className="py-2 font-medium text-right">{t.fornitori.listinoRowActionsLabel}</th>
          </tr>
        </thead>
        <tbody className={APP_SECTION_TABLE_TBODY}>
          {rowMeta.map(({ row, blocked, isLatestForProduct, key }) => (
            <tr key={key}>
              <td className="max-w-[200px] truncate py-2 pr-3 text-app-fg-muted">{row.prodotto}</td>
              <td className="py-2 pr-3 text-right font-mono tabular-nums text-app-fg">{Number(row.prezzo).toFixed(2)}</td>
              <td className="whitespace-nowrap py-2 pr-3 text-app-fg-muted">{formatDate(row.data_prezzo)}</td>
              <td className="py-2 text-right">
                {blocked && isLatestForProduct ? (
                  <div className="flex flex-col items-end gap-1">
                    <span className="rounded border border-amber-500/35 bg-amber-950/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-100">
                      {t.appStrings.listinoDocRowBlockedBadge}
                    </span>
                    {allowAdminForce ? (
                      <button
                        type="button"
                        disabled={workingKey != null}
                        onClick={() => void forceRow(row)}
                        className="rounded-md border border-violet-500/45 bg-violet-950/50 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-violet-100 transition-colors hover:bg-violet-900/45 disabled:opacity-40"
                      >
                        {workingKey === key ? t.appStrings.listinoDocForceWorking : t.appStrings.listinoDocForceButton}
                      </button>
                    ) : null}
                  </div>
                ) : blocked && !isLatestForProduct ? null : (
                  <span className="text-[10px] text-app-fg-muted">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
