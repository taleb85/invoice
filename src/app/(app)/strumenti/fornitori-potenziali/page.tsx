'use client'

import { useCallback, useEffect, useState } from 'react'
import { useToast } from '@/lib/toast-context'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { BackButton } from '@/components/BackButton'
import {
  APP_PAGE_HEADER_STRIP_H1_CLASS,
  APP_SHELL_SECTION_PAGE_STACK_CLASS,
} from '@/lib/app-shell-layout'

type Catalogo = {
  file_url: string | null
  tipo_documento: string | null
  nome_file: string | null
}

type ListinoSupplier = {
  id: string
  data_ricezione: string | null
  nome_azienda: string
  nome_contatto: string | null
  email_contatto: string | null
  partita_iva: string | null
  settore_merceologico: string | null
  cataloghi: Catalogo[]
}

export default function ListiniSuppliersPage() {
  const { showToast } = useToast()
  const [rows, setRows] = useState<ListinoSupplier[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/potential-suppliers')
      if (!res.ok) throw new Error(`Errore ${res.status}`)
      const data = await res.json()
      setRows(data)
    } catch {
      showToast('Errore caricamento listini', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { loadData() }, [loadData])

  const handleDelete = useCallback(async (id: string, nome: string) => {
    if (!window.confirm(`Eliminare "${nome}" e il suo listino?`)) return
    try {
      const res = await fetch(`/api/potential-suppliers?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Errore')
      showToast(`"${nome}" eliminato`, 'success')
      loadData()
    } catch {
      showToast('Errore eliminazione', 'error')
    }
  }, [showToast, loadData])

  const formatDateTime = (iso: string | null) => {
    if (!iso) return '—'
    try {
      return new Intl.DateTimeFormat('it-IT', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      }).format(new Date(iso))
    } catch { return iso }
  }

  return (
    <div className={APP_SHELL_SECTION_PAGE_STACK_CLASS}>
      <AppPageHeaderStrip
        accent="emerald"
        leadingAccessory={<BackButton href="/strumenti" label="Strumenti" iconOnly className="mb-0 shrink-0" />}
        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>}
      >
        <h1 className={APP_PAGE_HEADER_STRIP_H1_CLASS}>Fornitori Potenziali</h1>
      </AppPageHeaderStrip>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-sky-400" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-white/40">
          Nessun listino ricevuto.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-[1.5px] text-white/40">Fornitore</th>
                <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-[1.5px] text-white/40">Contatto</th>
                <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-[1.5px] text-white/40">Settore</th>
                <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-[1.5px] text-white/40">Ricevuto</th>
                <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-[1.5px] text-white/40">Documento</th>
                <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-[1.5px] text-white/40">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const catalogo = r.cataloghi?.[0]
                return (
                  <tr key={r.id} className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]">
                    <td className="px-2 py-2.5">
                      <div className="font-semibold text-white">{r.nome_azienda}</div>
                      {r.partita_iva && (
                        <div className="text-[11px] text-white/40">IVA: {r.partita_iva}</div>
                      )}
                    </td>
                    <td className="px-2 py-2.5">
                      {r.nome_contatto && <div className="text-white/80">{r.nome_contatto}</div>}
                      {r.email_contatto && (
                        <a href={`mailto:${r.email_contatto}`} className="text-[11px] text-sky-400 transition-colors hover:text-sky-300">
                          {r.email_contatto}
                        </a>
                      )}
                      {!r.nome_contatto && !r.email_contatto && (
                        <span className="text-white/40">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-white/60">
                      {r.settore_merceologico ?? '—'}
                    </td>
                    <td className="px-2 py-2.5 whitespace-nowrap text-white/60">
                      {formatDateTime(r.data_ricezione)}
                    </td>
                    <td className="px-2 py-2.5">
                      {catalogo?.file_url ? (
                        <a
                          href={catalogo.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-950/25 px-3 py-1.5 text-xs font-semibold text-cyan-300 transition-colors hover:bg-cyan-950/40"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          {catalogo.nome_file ?? 'Apri listino'}
                        </a>
                      ) : (
                        <span className="text-white/30">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2.5">
                      <button
                        type="button"
                        onClick={() => handleDelete(r.id, r.nome_azienda)}
                        className="text-[11px] text-red-400 transition-colors hover:text-red-300"
                      >
                        Elimina
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
