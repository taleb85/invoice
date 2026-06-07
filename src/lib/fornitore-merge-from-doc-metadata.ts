import type { SupabaseClient } from '@supabase/supabase-js'
import {
  extractContactEmailsFromText,
  extractPhoneNumbersFromText,
} from '@/lib/fornitore-cross-check'
import { extractDocumentText } from '@/lib/document-extractors'
import { downloadStorageObjectByFileUrl } from '@/lib/documenti-storage-url'
import { isSharedBillingPlatformSenderEmail } from '@/lib/fornitore-resolve-scan-email'

function isBlank(s: string | null | undefined): boolean {
  return !s?.trim()
}

function trimStr(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function emailFromMittente(mittente: string | null | undefined): string | null {
  const t = mittente?.trim().toLowerCase()
  if (!t?.includes('@')) return null
  return t
}

function phoneDigitsKey(phone: string | null | undefined): string {
  return (phone ?? '').replace(/\D/g, '')
}

function emailKey(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase()
}

type ContactCandidate = {
  nome: string
  telefono: string | null
  email: string | null
}

function contactsFromMetadata(meta: Record<string, unknown>): ContactCandidate | null {
  const telefono = trimStr(meta.telefono)
  const email = trimStr(meta.email_contatto)
  if (!telefono && !email) return null
  const nome = trimStr(meta.ragione_sociale) || 'Contatto aziendale'
  return { nome, telefono: telefono || null, email: email || null }
}

async function contactsFromPdfUrl(
  supabase: SupabaseClient,
  fileUrl: string,
): Promise<{ telefonos: string[]; emails: string[] }> {
  try {
    const dl = await downloadStorageObjectByFileUrl(supabase, fileUrl)
    if ('error' in dl) return { telefonos: [], emails: [] }
    const { text } = await extractDocumentText(dl.data, dl.contentType)
    const body = text ?? ''
    const emails = extractContactEmailsFromText(body).filter(
      (e) => !isSharedBillingPlatformSenderEmail(e),
    )
    return { telefonos: extractPhoneNumbersFromText(body), emails }
  } catch (e) {
    console.warn('[contactsFromPdfUrl]', e)
    return { telefonos: [], emails: [] }
  }
}

async function buildContactCandidate(
  supabase: SupabaseClient,
  meta: Record<string, unknown>,
  opts?: { fileUrl?: string | null; fornitoreNome?: string | null },
): Promise<ContactCandidate | null> {
  const fromMeta = contactsFromMetadata(meta)
  if (fromMeta?.telefono || fromMeta?.email) return fromMeta

  const fileUrl = opts?.fileUrl?.trim()
  if (!fileUrl) return null

  const pdf = await contactsFromPdfUrl(supabase, fileUrl)
  if (!pdf.telefonos.length && !pdf.emails.length) return null

  const nome =
    trimStr(meta.ragione_sociale) ||
    opts?.fornitoreNome?.trim() ||
    'Contatto aziendale'

  return {
    nome,
    telefono: pdf.telefonos.length ? pdf.telefonos.join(' / ') : null,
    email: pdf.emails[0] ?? null,
  }
}

function contattoAlreadyCovers(
  existing: { telefono: string | null; email: string | null }[],
  candidate: ContactCandidate,
): boolean {
  const candPhone = phoneDigitsKey(candidate.telefono)
  const candEmail = emailKey(candidate.email)

  for (const row of existing) {
    if (candPhone && phoneDigitsKey(row.telefono) === candPhone) return true
    if (candEmail && emailKey(row.email) === candEmail) return true
  }
  return false
}

/**
 * Crea un contatto in `fornitore_contatti` da metadata OCR o testo PDF (intestazione),
 * solo se non esiste già un contatto con lo stesso telefono/email.
 */
export async function mergeFornitoreContattiFromDocMetadata(
  supabase: SupabaseClient,
  fornitoreId: string,
  metadata: unknown,
  opts?: { fileUrl?: string | null; fornitoreNome?: string | null },
): Promise<{ inserted: boolean }> {
  const meta =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {}

  const candidate = await buildContactCandidate(supabase, meta, opts)
  if (!candidate || (!candidate.telefono && !candidate.email)) {
    return { inserted: false }
  }

  try {
    const { data: existing, error: readErr } = await supabase
      .from('fornitore_contatti')
      .select('id, telefono, email')
      .eq('fornitore_id', fornitoreId)

    if (readErr) {
      if (readErr.message.includes('fornitore_contatti') || readErr.code === '42P01') {
        return { inserted: false }
      }
      console.warn('[mergeFornitoreContattiFromDocMetadata]', readErr.message)
      return { inserted: false }
    }

    if (contattoAlreadyCovers(existing ?? [], candidate)) {
      return { inserted: false }
    }

    const { error: insErr } = await supabase.from('fornitore_contatti').insert([
      {
        fornitore_id: fornitoreId,
        nome: candidate.nome,
        ruolo: 'Da documento',
        telefono: candidate.telefono,
        email: candidate.email,
      },
    ])

    if (insErr) {
      console.warn('[mergeFornitoreContattiFromDocMetadata]', insErr.message)
      return { inserted: false }
    }

    return { inserted: true }
  } catch (e) {
    console.warn('[mergeFornitoreContattiFromDocMetadata]', e)
    return { inserted: false }
  }
}

/** Compila contatti da documenti già collegati (metadata + PDF). */
export async function backfillFornitoreContattiFromDocuments(
  supabase: SupabaseClient,
  fornitoreId: string,
): Promise<{ inserted: boolean }> {
  const { data: fornitore } = await supabase
    .from('fornitori')
    .select('nome')
    .eq('id', fornitoreId)
    .maybeSingle()

  const { data: docs } = await supabase
    .from('documenti_da_processare')
    .select('metadata, file_url')
    .eq('fornitore_id', fornitoreId)
    .order('created_at', { ascending: false })
    .limit(25)

  for (const doc of docs ?? []) {
    const r = await mergeFornitoreContattiFromDocMetadata(
      supabase,
      fornitoreId,
      doc.metadata,
      { fileUrl: doc.file_url, fornitoreNome: fornitore?.nome },
    )
    if (r.inserted) return r
  }

  return { inserted: false }
}

/**
 * Dopo associazione bolla/fattura dalla coda documenti: compila su `fornitori` solo campi ancora vuoti,
 * usando metadata OCR del documento (e email mittente se utile). Non sovrascrive mai valori esistenti.
 */
export async function mergeFornitoreMissingFromDocMetadata(
  supabase: SupabaseClient,
  fornitoreId: string,
  metadata: unknown,
  mittente?: string | null,
): Promise<{ updated: boolean; fields: string[] }> {
  const meta =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {}

  const ragioneSociale = trimStr(meta.ragione_sociale)
  const pivaRaw = trimStr(meta.p_iva)
  const indirizzo = trimStr(meta.indirizzo)
  const mittEmail = emailFromMittente(mittente)

  if (!ragioneSociale && !pivaRaw && !indirizzo && !mittEmail) {
    return { updated: false, fields: [] }
  }

  try {
    const { data: f, error: readErr } = await supabase
      .from('fornitori')
      .select('id, nome, piva, email, indirizzo')
      .eq('id', fornitoreId)
      .maybeSingle()

    if (readErr || !f) return { updated: false, fields: [] }

    const patch: Record<string, string> = {}
    const fields: string[] = []

    if (isBlank(f.nome) && ragioneSociale) {
      patch.nome = ragioneSociale
      fields.push('nome')
    }
    if (isBlank(f.piva) && pivaRaw) {
      patch.piva = pivaRaw
      fields.push('piva')
    }
    if (isBlank(f.indirizzo) && indirizzo) {
      patch.indirizzo = indirizzo
      fields.push('indirizzo')
    }
    if (isBlank(f.email) && mittEmail && !isSharedBillingPlatformSenderEmail(mittEmail)) {
      patch.email = mittEmail
      fields.push('email')
    }

    if (!Object.keys(patch).length) return { updated: false, fields: [] }

    const { error: upErr } = await supabase.from('fornitori').update(patch).eq('id', fornitoreId)
    if (upErr) {
      console.warn('[mergeFornitoreMissingFromDocMetadata]', upErr.message)
      return { updated: false, fields: [] }
    }

    return { updated: true, fields }
  } catch (e) {
    console.warn('[mergeFornitoreMissingFromDocMetadata]', e)
    return { updated: false, fields: [] }
  }
}

/** Compila campi vuoti in anagrafica usando metadata OCR dei documenti già collegati al fornitore. */
export async function backfillFornitoreAnagraficaFromDocuments(
  supabase: SupabaseClient,
  fornitoreId: string,
): Promise<{ updated: boolean; fields: string[] }> {
  const { data: docs } = await supabase
    .from('documenti_da_processare')
    .select('metadata, mittente')
    .eq('fornitore_id', fornitoreId)
    .not('metadata', 'is', null)
    .order('created_at', { ascending: false })
    .limit(25)

  const merged = new Set<string>()
  for (const doc of docs ?? []) {
    const r = await mergeFornitoreMissingFromDocMetadata(
      supabase,
      fornitoreId,
      doc.metadata,
      doc.mittente,
    )
    for (const f of r.fields) merged.add(f)
    if (merged.has('piva') && merged.has('indirizzo')) break
  }

  return { updated: merged.size > 0, fields: [...merged] }
}
