import type { SupabaseClient } from '@supabase/supabase-js'

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
  'tiscali.it',
  'alice.it',
  'tim.it',
  'poste.it',
  'email.it',
])

export function isGenericSupplierEmailDomain(domain: string): boolean {
  return GENERIC_EMAIL_DOMAINS.has(domain.trim().toLowerCase())
}

/**
 * Estrae il dominio normalizzato da un indirizzo email.
 * Rimuove eventuali subdomain generici (es. `mail.`, `smtp.`).
 */
export function extractEmailDomainLower(email: string): string | null {
  const e = email.trim().toLowerCase()
  const at = e.lastIndexOf('@')
  if (at < 1 || at === e.length - 1) return null
  return e.slice(at + 1) || null
}

/**
 * Rimuove il `+alias` dalla parte locale di un indirizzo email.
 * Es. `fornitore+ordini@domain.com` -> `fornitore@domain.com`.
 */
export function stripEmailPlusAlias(email: string): string {
  const at = email.lastIndexOf('@')
  if (at < 1) return email
  const local = email.slice(0, at)
  const domain = email.slice(at)
  const plusIdx = local.indexOf('+')
  if (plusIdx < 1) return email
  return local.slice(0, plusIdx) + domain
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
 * Risolve un fornitore dall'email mittente.
 * Livelli di ricerca (dal più specifico al più ampio):
 *   1. Match esatto su `fornitore_emails` (alias)
 *   2. Match esatto su `fornitori.email` (email primaria)
 *   3. Match con `+alias` rimosso (es. `fornitore+shop@dom.it` -> `fornitore@dom.it`)
 *   4. Match per dominio email (se dominio non generico)
 */
export async function resolveFornitoreFromScanEmail(
  supabase: SupabaseClient,
  senderEmailRaw: string,
  sedeFilter?: string | null,
): Promise<FornitoreScanRow | null> {
  const senderEmail = (senderEmailRaw ?? '').trim().toLowerCase()
  if (!senderEmail.includes('@')) return null

  const found = await resolveEmailExact(supabase, senderEmail, sedeFilter)
  if (found) return found

  const stripped = stripEmailPlusAlias(senderEmail)
  if (stripped !== senderEmail) {
    const foundStripped = await resolveEmailExact(supabase, stripped, sedeFilter)
    if (foundStripped) return foundStripped
  }

  const byDomain = await resolveFornitoreByEmailDomain(supabase, senderEmail, sedeFilter)
  if (byDomain && byDomain !== 'ambiguous') return byDomain

  return null
}

/**
 * Match esatto su alias (`fornitore_emails`) o email primaria (`fornitori.email`).
 * Supporta anche il match case-insensitive via ILIKE.
 */
async function resolveEmailExact(
  supabase: SupabaseClient,
  email: string,
  sedeFilter?: string | null,
): Promise<FornitoreScanRow | null> {
  const aliasQuery = supabase
    .from('fornitore_emails')
    .select(
      'fornitore_id, fornitori!inner(id, nome, sede_id, language, rekki_link, rekki_supplier_id, email)',
    )
    .ilike('email', email)
    .limit(1)
  if (sedeFilter) aliasQuery.eq('fornitori.sede_id', sedeFilter)
  const { data: aliasRows } = await aliasQuery.returns<{ fornitore_id: string; fornitori: FornitoreScanRow }[]>()
  if (aliasRows?.length) return aliasRows[0].fornitori

  const fornitoriQuery = supabase
    .from('fornitori')
    .select('id, nome, sede_id, language, rekki_link, rekki_supplier_id, email')
    .ilike('email', email)
    .limit(1)
  if (sedeFilter) fornitoriQuery.eq('sede_id', sedeFilter)
  const { data: fornitori } = await fornitoriQuery.returns<FornitoreScanRow[]>()
  if (fornitori?.length) return fornitori[0]

  return null
}

/**
 * Match fornitore per dominio email mittente.
 * Es. `ordini@stellacoffee.com` -> trova fornitori con email `%@stellacoffee.com`.
 * Più fornitori distinti con stesso dominio -> `'ambiguous'`.
 * Ignora domini generici (Gmail, PEC, Libero, etc.).
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
  const { data: aliasRows } = await aliasQuery.returns<{ fornitore_id: string; fornitori: FornitoreScanRow }[]>()
  for (const r of aliasRows ?? []) {
    const f = r.fornitori
    if (f?.id) byId.set(f.id, f)
  }

  let fq = supabase
    .from('fornitori')
    .select('id, nome, sede_id, language, rekki_link, rekki_supplier_id, email')
    .ilike('email', pattern)
    .limit(80)
  if (sedeFilter) fq = fq.eq('sede_id', sedeFilter)
  const { data: forRows } = await fq.returns<FornitoreScanRow[]>()
  for (const f of forRows ?? []) {
    if (f.id) byId.set(f.id, f)
  }

  if (byId.size === 0) return null
  if (byId.size > 1) return 'ambiguous'
  return [...byId.values()][0] ?? null
}
