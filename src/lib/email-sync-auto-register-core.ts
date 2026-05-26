import type { SupabaseClient } from '@supabase/supabase-js'
import {
  findDuplicateFatturaId,
  findDuplicateFatturaSansNumeroByImporto,
  normalizeNumeroFattura,
} from '@/lib/fattura-duplicate-check'
import { normalizeNumeroBolla } from '@/lib/fix-ocr-dates-helpers'

const AUTO_SAVED_AT = () => new Date().toISOString()

type DocMeta = {
  totale_iva_inclusa?: number | null
  numero_fattura?: string | null
}

/**
 * Inserisce una fattura da scansione email OCR: stessa logica approval di finalizza (sede + soglia),
 * con tracciamento salvataggio automatico.
 */
export async function insertEmailAutoFattura(
  supabase: SupabaseClient,
  opts: {
    fornitoreId: string
    sedeId: string | null
    dataDoc: string
    fileUrl: string
    meta: DocMeta
  }
): Promise<{ id: string } | { duplicateId: string } | { error: string }> {
  const numeroNorm =
    typeof opts.meta.numero_fattura === 'string' && opts.meta.numero_fattura.trim()
      ? normalizeNumeroFattura(opts.meta.numero_fattura)
      : null

  if (numeroNorm && opts.sedeId) {
    const dupId = await findDuplicateFatturaId(supabase, {
      sedeId: opts.sedeId,
      fornitoreId: opts.fornitoreId,
      data: opts.dataDoc,
      numeroFattura: numeroNorm,
    })
    if (dupId) return { duplicateId: dupId }
  } else if (opts.meta.totale_iva_inclusa != null && opts.sedeId) {
    const imp = Number(opts.meta.totale_iva_inclusa)
    if (Number.isFinite(imp)) {
      const dupSans = await findDuplicateFatturaSansNumeroByImporto(supabase, {
        sedeId: opts.sedeId,
        fornitoreId: opts.fornitoreId,
        data: opts.dataDoc,
        importo: imp,
      })
      if (dupSans) return { duplicateId: dupSans }
    }
  }

  const fatturaImporto = opts.meta.totale_iva_inclusa != null ? Number(opts.meta.totale_iva_inclusa) : null

  let approvalStatus = 'pending'
  if (opts.sedeId && fatturaImporto != null) {
    const { data: approvalSettings } = await supabase
      .from('approval_settings')
      .select('threshold, require_approval')
      .eq('sede_id', opts.sedeId)
      .maybeSingle()
    const requireApproval = approvalSettings?.require_approval !== false
    const threshold = Number(approvalSettings?.threshold ?? 500)
    if (!requireApproval || fatturaImporto < threshold) {
      approvalStatus = 'approved'
    }
  } else {
    approvalStatus = 'approved'
  }

  const autoAt = AUTO_SAVED_AT()

  const { data: fattura, error: insErr } = await supabase
    .from('fatture')
    .insert([
      {
        fornitore_id: opts.fornitoreId,
        bolla_id: null,
        sede_id: opts.sedeId,
        data: opts.dataDoc,
        numero_fattura: numeroNorm || null,
        importo: opts.meta.totale_iva_inclusa ?? null,
        verificata_estratto_conto: false,
        file_url: opts.fileUrl,
        approval_status: approvalStatus,
        ...(approvalStatus === 'approved' ? { approved_at: autoAt } : {}),
        email_sync_auto_saved_at: autoAt,
      },
    ])
    .select('id')
    .single()

  if (insErr || !fattura) return { error: insErr?.message ?? 'insert failed' }
  return { id: fattura.id }
}

/** Bolla da email OCR: stato attesa fattura, tracciamento auto-save. */
export async function insertEmailAutoBolla(
  supabase: SupabaseClient,
  opts: {
    fornitoreId: string
    sedeId: string | null
    dataDoc: string
    fileUrl: string
    numeroBolla: string | null
    importo: number | null
  }
): Promise<{ id: string } | { duplicateId: string } | { error: string }> {
  // Prevent duplicate import of the same PDF attachment.
  const { data: existingByUrl } = await supabase
    .from('bolle')
    .select('id')
    .eq('fornitore_id', opts.fornitoreId)
    .eq('file_url', opts.fileUrl)
    .limit(1)
    .maybeSingle()
  if (existingByUrl) return { duplicateId: existingByUrl.id }

  /**
   * Stesso fornitore + data + numero bolla normalizzato (sede inclusa) ⇒ duplicato.
   * Allineato al check delle fatture: evita di re-importare la stessa bolla
   * quando lo scan email rilegge la stessa mail con un nuovo `file_url` (rescan,
   * reset stato IMAP, fallback corpo email ↦ sintetico, ecc.).
   */
  const numeroNormBolla =
    typeof opts.numeroBolla === 'string' && opts.numeroBolla.trim()
      ? normalizeNumeroBolla(opts.numeroBolla)
      : null
  if (numeroNormBolla && opts.dataDoc) {
    const { data: rows } = await supabase
      .from('bolle')
      .select('id, numero_bolla, sede_id')
      .eq('fornitore_id', opts.fornitoreId)
      .eq('data', opts.dataDoc)
    const ctxSede = opts.sedeId ?? null
    const wantLower = numeroNormBolla.toLowerCase()
    const dupByKey = (rows ?? []).find((row) => {
      const dbNum = normalizeNumeroBolla(row.numero_bolla as string | null)
      if (!dbNum) return false
      if (dbNum.toLowerCase() !== wantLower) return false
      const rowSede = (row.sede_id as string | null) ?? null
      return rowSede === ctxSede
    })
    if (dupByKey?.id) return { duplicateId: dupByKey.id as string }
  }

  const autoAt = AUTO_SAVED_AT()
  const { data: bolla, error: insErr } = await supabase
    .from('bolle')
    .insert([
      {
        fornitore_id: opts.fornitoreId,
        sede_id: opts.sedeId,
        data: opts.dataDoc,
        file_url: opts.fileUrl,
        stato: 'in attesa',
        numero_bolla: opts.numeroBolla,
        importo: opts.importo,
        email_sync_auto_saved_at: autoAt,
      },
    ])
    .select('id')
    .single()

  if (insErr || !bolla) return { error: insErr?.message ?? 'insert failed' }
  return { id: bolla.id }
}
