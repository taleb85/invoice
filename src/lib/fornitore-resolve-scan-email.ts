import type { SupabaseClient } from '@supabase/supabase-js'

/** Stesso subset usato in scan-emails/route per domini «non fornitore». */
const GENERIC_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'icloud.com',
  'libero.it',
  'pec.it',
  'legalmail.it',
  'aruba.it',
  'msn.com',
  'proton.me',
  'protonmail.com',
  'me.com',
])

export function isGenericSupplierEmailDomain(domain: string): boolean {
  return GENERIC_EMAIL_DOMAINS.has(domain.trim().toLowerCase())
}

export function extractEmailDomainLower(email: string): string | null {
  const e = email.trim().toLowerCase()
  const at = e.lastIndexOf('@')
  if (at < 1 || at === e.length - 1) return null
  return e.slice(at + 1) || null
}

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

/**
 * Match fornitore per dominio email mittente (es. miriam@stellacoffeeandtea.com → altre righe @stellacoffeeandtea.com).
 * Ignora domini generici (Gmail, ecc.). Più fornitori distinti con stesso dominio → 'ambiguous'.
 */
export async function resolveFornitoreByEmailDomain(
  supabase: SupabaseClient,
  senderEmailNormalized: string,
  sedeFilter?: string | null,
): Promise<FornitoreScanRow | null | 'ambiguous'> {
  const dom = extractEmailDomainLower(senderEmailNormalized)
  if (!dom || isGenericSupplierEmailDomain(dom)) return null

  const pattern = `%@${dom}`
  const byId = new Map<string, FornitoreScanRow>()

  const aliasQuery = supabase
    .from('fornitore_emails')
    .select(
      'fornitore_id, fornitori!inner(id, nome, sede_id, language, rekki_link, rekki_supplier_id, email)',
    )
    .ilike('email', pattern)
    .limit(80)
  if (sedeFilter) aliasQuery.eq('fornitori.sede_id', sedeFilter)
  const { data: aliasRows } = await aliasQuery
  for (const r of aliasRows ?? []) {
    const row = r as unknown as { fornitori: FornitoreScanRow }
    const f = row.fornitori
    if (f?.id) byId.set(f.id, f)
  }

  let fq = supabase
    .from('fornitori')
    .select('id, nome, sede_id, language, rekki_link, rekki_supplier_id, email')
    .ilike('email', pattern)
    .limit(80)
  if (sedeFilter) fq = fq.eq('sede_id', sedeFilter) as typeof fq
  const { data: forRows } = await fq
  for (const f of forRows ?? []) {
    const fr = f as FornitoreScanRow
    if (fr.id) byId.set(fr.id, fr)
  }

  if (byId.size === 0) return null
  if (byId.size > 1) return 'ambiguous'
  return [...byId.values()][0] ?? null
}
