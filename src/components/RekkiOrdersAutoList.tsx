'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { formatDistanceToNow } from 'date-fns'
import { it } from 'date-fns/locale'

interface AutoOrder {
  id: string
  email_subject: string | null
  email_received_at: string | null
  processed_at: string
  products_extracted: number
  products_updated: number
  products_created: number
  status: 'processing' | 'completed' | 'error'
  error_message: string | null
  metadata: {
    lines?: Array<{
      prodotto: string
      quantita: number
      prezzo_unitario: number
    }>
    price_changes?: Array<{
      prodotto: string
      oldPrice: number | null
      newPrice: number
      action: 'updated' | 'created'
    }>
  }
}

export default function RekkiOrdersAutoList({
  fornitoreId,
}: {
  fornitoreId: string
}) {
  const [orders, setOrders] = useState<AutoOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<AutoOrder | null>(null)
  const [pollingStatus, setPollingStatus] = useState<'idle' | 'polling' | 'error'>('idle')
  const [lastPollTime, setLastPollTime] = useState<Date | null>(null)

  useEffect(() => {
    loadOrders()
    
    // Subscribe to realtime updates
    const supabase = createClient()
    const channel = supabase
      .channel('rekki_auto_orders_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rekki_auto_orders',
          filter: `fornitore_id=eq.${fornitoreId}`,
        },
        () => {
          loadOrders()
        }
      )
      .subscribe()
    
    return () => {
      channel.unsubscribe()
    }
  }, [fornitoreId])

  const loadOrders = async () => {
    setLoading(true)
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('rekki_auto_orders')
      .select('*')
      .eq('fornitore_id', fornitoreId)
      .order('processed_at', { ascending: false })
      .limit(20)
    
    if (!error && data) {
      setOrders(data as AutoOrder[])
    }
    setLoading(false)
  }

  const triggerManualPoll = async () => {
    setPollingStatus('polling')
    try {
      const res = await fetch('/api/cron/rekki-auto-poll?secret=' + encodeURIComponent(process.env.NEXT_PUBLIC_CRON_SECRET || ''), {
        method: 'GET',
      })
      
      if (res.ok) {
        const result = await res.json()
        setLastPollTime(new Date())
        setPollingStatus('idle')
        
        if (result.messagesProcessed > 0) {
          await loadOrders()
        }
      } else {
        setPollingStatus('error')
      }
    } catch (err) {
      console.error('Poll error:', err)
      setPollingStatus('error')
    }
  }

  if (loading) {
    return (
      <div className="supplier-detail-tab-shell overflow-hidden border-violet-500/25">
        <div className="app-card-bar-accent bg-gradient-to-r from-violet-500/80 to-purple-500/60" aria-hidden />
        <div className="px-5 py-8 text-center">
          <div className="inline-flex h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          <p className="mt-3 text-sm text-app-fg-muted">Caricamento ordini automatici...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="supplier-detail-tab-shell overflow-hidden border-violet-500/25">
      <div className="app-card-bar-accent bg-gradient-to-r from-violet-500/80 to-purple-500/60" aria-hidden />
      
      <div className="px-5 py-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-app-fg">Ordini Rekki Automatici</h3>
            <p className="mt-1 text-xs leading-relaxed text-app-fg-muted">
              Email di conferma ordine processate automaticamente da orders@rekki.com
            </p>
          </div>
          <button
            type="button"
            onClick={triggerManualPoll}
            disabled={pollingStatus === 'polling'}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-300 transition-colors hover:bg-violet-500/20 disabled:opacity-50"
          >
            {pollingStatus === 'polling' ? (
              <>
                <div className="h-3 w-3 animate-spin rounded-full border border-violet-300 border-t-transparent" />
                Controllo...
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Controlla ora
              </>
            )}
          </button>
        </div>

        {lastPollTime && (
          <div className="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
            Ultimo controllo: {formatDistanceToNow(lastPollTime, { addSuffix: true, locale: it })}
          </div>
        )}

        {orders.length === 0 ? (
          <div className="rounded-lg border border-app-line-22 bg-app-line-10/50 px-4 py-8 text-center">
            <svg className="mx-auto h-12 w-12 text-app-fg-muted/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <p className="mt-3 text-sm font-semibold text-app-fg-muted">
              Nessun ordine automatico ancora
            </p>
            <p className="mt-1 text-xs text-app-fg-muted">
              Le email da orders@rekki.com saranno processate automaticamente ogni 15 minuti
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {orders.map(order => (
              <button
                key={order.id}
                type="button"
                onClick={() => setSelectedOrder(selectedOrder?.id === order.id ? null : order)}
                className="w-full rounded-lg border border-app-line-22 bg-app-line-10/30 px-3 py-2.5 text-left transition-colors hover:border-violet-500/40 hover:bg-violet-500/5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-app-fg">
                        {order.email_subject || 'Order Confirmation'}
                      </p>
                      {order.status === 'completed' && (
                        <span className="shrink-0 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-300">
                          ✓ OK
                        </span>
                      )}
                      {order.status === 'error' && (
                        <span className="shrink-0 rounded-full bg-red-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-red-300">
                          ⚠ Errore
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-[11px] text-app-fg-muted">
                      <span>
                        {order.email_received_at 
                          ? formatDistanceToNow(new Date(order.email_received_at), { addSuffix: true, locale: it })
                          : formatDistanceToNow(new Date(order.processed_at), { addSuffix: true, locale: it })}
                      </span>
                      <span>•</span>
                      <span>{order.products_extracted} prodotti</span>
                      {order.products_updated > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-emerald-300">{order.products_updated} aggiornati</span>
                        </>
                      )}
                      {order.products_created > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-violet-300">{order.products_created} nuovi</span>
                        </>
                      )}
                    </div>
                  </div>
                  <svg 
                    className={`h-4 w-4 shrink-0 text-app-fg-muted transition-transform ${selectedOrder?.id === order.id ? 'rotate-180' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {/* Expanded details */}
                {selectedOrder?.id === order.id && (
                  <div className="mt-3 space-y-2 border-t border-app-line-22 pt-3">
                    {order.error_message && (
                      <div className="rounded-md bg-red-500/10 px-2 py-1.5 text-xs text-red-200">
                        {order.error_message}
                      </div>
                    )}
                    
                    {order.metadata?.price_changes && order.metadata.price_changes.length > 0 && (
                      <div>
                        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-app-fg-muted">
                          Modifiche Prezzi
                        </p>
                        <div className="space-y-1">
                          {order.metadata.price_changes.map((change, idx) => (
                            <div key={idx} className="flex items-center justify-between rounded bg-app-line-15 px-2 py-1 text-xs">
                              <span className="text-app-fg">{change.prodotto}</span>
                              <span className="flex items-center gap-2 font-mono tabular-nums">
                                {change.oldPrice !== null && (
                                  <>
                                    <span className="text-app-fg-muted line-through">
                                      £{change.oldPrice.toFixed(2)}
                                    </span>
                                    <span className="text-app-fg-muted">→</span>
                                  </>
                                )}
                                <span className={change.action === 'created' ? 'text-violet-300' : 'text-emerald-300'}>
                                  £{change.newPrice.toFixed(2)}
                                </span>
                                {change.action === 'created' && (
                                  <span className="text-[9px] text-violet-300">NEW</span>
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Help text */}
        <details className="mt-4 rounded-lg border border-app-line-22 bg-app-line-10/50 px-3 py-2">
          <summary className="cursor-pointer text-xs font-semibold text-violet-300 hover:text-violet-200">
            Come funziona il pilota automatico?
          </summary>
          <div className="mt-2 space-y-2 text-xs leading-relaxed text-app-fg-muted">
            <p>Il sistema controlla automaticamente ogni 15 minuti:</p>
            <ul className="ml-4 list-disc space-y-1">
              <li>Nuove email non lette da orders@rekki.com</li>
              <li>Estrae prodotti, quantità e prezzi automaticamente</li>
              <li>Aggiorna il listino con i nuovi prezzi pattuiti</li>
              <li>Crea uno statement per confronto con fatture</li>
              <li>Marca l'email come letta e applica label "Rekki/Processed"</li>
            </ul>
            <p className="font-semibold text-violet-300">
              💡 Nessuna azione manuale richiesta!
            </p>
          </div>
        </details>
      </div>
    </div>
  )
}
