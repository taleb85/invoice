import { extractEmailFromSenderHeader } from '@/lib/sender-email'

/** Query verso `/fornitori/new` coerente con `statements-views` / AI Inbox. */
export function buildNewFornitorePrefillHref(opts: {
  prefillNome?: string | null
  mittenteHeader?: string | null
  sedeId?: string | null
}): string {
  const params = new URLSearchParams()
  const nome = opts.prefillNome?.trim()
  if (nome) params.set('prefill_nome', nome)
  const sede = opts.sedeId?.trim()
  if (sede) params.set('prefill_sede_id', sede)
  const email = opts.mittenteHeader ? extractEmailFromSenderHeader(opts.mittenteHeader) : null
  if (email?.includes('@')) {
    params.set('prefill_email', email)
    params.set('remember_mittente', email)
  }
  const qs = params.toString()
  return `/fornitori/new${qs ? `?${qs}` : ''}`
}
