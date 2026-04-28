import type { SupabaseClient } from '@supabase/supabase-js'

/** Stesso shape usato in scan-emails/route per `fornitori`. */
export type FornitoreScanRow = {
  id: string
  nome: string
  sede_id: string | null
  language?: string | null
  rekki_link?: string | null
  rekki_supplier_id?: string | null
  email?: string | null
}

/**
 * Risolve solo contatti diretti registrati (`fornitore_emails`, email primaria sulla riga).
 * Nessun fallback su dominio o inferenza da documento.
 */
export async function resolveFornitoreFromScanEmail(
  supabase: SupabaseClient,
  senderEmailRaw: string,
  sedeFilter?: string | null,
): Promise<FornitoreScanRow | null> {
  const senderEmail = (senderEmailRaw ?? '').trim()
  if (!senderEmail.includes('@')) return null

  const aliasQuery = supabase
    .from('fornitore_emails')
    .select(
      'fornitore_id, fornitori!inner(id, nome, sede_id, language, rekki_link, rekki_supplier_id, email)',
    )
    .ilike('email', senderEmail)
    .limit(1)
  if (sedeFilter) aliasQuery.eq('fornitori.sede_id', sedeFilter)
  const { data: aliasRows } = await aliasQuery
  if (aliasRows?.length) {
    const found = (aliasRows[0] as unknown as { fornitori: FornitoreScanRow }).fornitori
    return found
  }

  const fornitoriQuery = supabase
    .from('fornitori')
    .select('id, nome, sede_id, language, rekki_link, rekki_supplier_id, email')
    .ilike('email', senderEmail)
    .limit(1)
  if (sedeFilter) fornitoriQuery.eq('sede_id', sedeFilter)
  const { data: fornitori } = await fornitoriQuery
  if (fornitori?.length) return fornitori[0] as FornitoreScanRow

  return null
}
