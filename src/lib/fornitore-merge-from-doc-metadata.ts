import type { SupabaseClient } from '@supabase/supabase-js'

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
    if (isBlank(f.email) && mittEmail) {
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
