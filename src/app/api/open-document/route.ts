import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient, getProfile, getRequestAuth } from '@/utils/supabase/server'
import { parseSupabasePublicStorageUrl } from '@/lib/open-document-url'
import type { Profile } from '@/types'

const SIGNED_TTL_SEC = 600

function isAdminProfile(profile: Profile): boolean {
  return String(profile.role ?? '').toLowerCase() === 'admin'
}

async function fornitoreBelongsToSede(
  service: SupabaseClient,
  fornitoreId: string | null,
  sedeId: string
): Promise<boolean> {
  if (!fornitoreId) return false
  const { data } = await service.from('fornitori').select('sede_id').eq('id', fornitoreId).maybeSingle()
  return data?.sede_id === sedeId
}

/** Come policy SQL su fatture/bolle (sede riga, null legacy, fornitore della sede). */
async function operatoreCanAccessBollaFattura(
  service: SupabaseClient,
  row: { sede_id: string | null; fornitore_id: string },
  userSedeId: string | null
): Promise<boolean> {
  if (!userSedeId) return false
  if (row.sede_id === userSedeId) return true
  if (row.sede_id === null) return true
  return fornitoreBelongsToSede(service, row.fornitore_id, userSedeId)
}

function operatoreCanAccessDocumento(
  row: { sede_id: string | null },
  userSedeId: string | null
): boolean {
  if (!userSedeId) return false
  return row.sede_id === userSedeId
}

async function operatoreCanAccessLog(
  service: SupabaseClient,
  row: { fornitore_id: string | null },
  userSedeId: string | null
): Promise<boolean> {
  if (!userSedeId) return false
  if (row.fornitore_id === null) return true
  return fornitoreBelongsToSede(service, row.fornitore_id, userSedeId)
}

async function operatoreCanAccessStatement(
  service: SupabaseClient,
  row: { sede_id: string | null; fornitore_id: string | null },
  userSedeId: string | null
): Promise<boolean> {
  if (!userSedeId) return false
  if (row.sede_id === userSedeId) return true
  if (row.fornitore_id) {
    return fornitoreBelongsToSede(service, row.fornitore_id, userSedeId)
  }
  return false
}

/**
 * GET ?bolla_id= | ?fattura_id= | ?log_id= | ?documento_id= | ?statement_id=
 * Sessione obbligatoria. Admin: lettura metadati con service role (nessun blocco RLS).
 * Operatore: client utente; se la riga non torna, fallback autorizzato con service + sede.
 */
export async function GET(req: NextRequest) {
  const bollaId = req.nextUrl.searchParams.get('bolla_id')
  const fatturaId = req.nextUrl.searchParams.get('fattura_id')
  const logId = req.nextUrl.searchParams.get('log_id')
  const documentoId = req.nextUrl.searchParams.get('documento_id')
  const statementId = req.nextUrl.searchParams.get('statement_id')
  const confermaOrdineId = req.nextUrl.searchParams.get('conferma_ordine_id')
  const set = [bollaId, fatturaId, logId, documentoId, statementId, confermaOrdineId].filter(Boolean)
  if (set.length !== 1) {
    return NextResponse.json(
      {
        error:
          'Specify exactly one of bolla_id, fattura_id, log_id, documento_id, statement_id, conferma_ordine_id',
      },
      { status: 400 }
    )
  }

  const { user } = await getRequestAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getProfile()
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = isAdminProfile(profile)
  const service = createServiceClient()
  const userSedeId = profile.sede_id

  let file_url: string | null = null

  if (bollaId) {
    if (admin) {
      const { data } = await service.from('bolle').select('file_url').eq('id', bollaId).maybeSingle()
      file_url = data?.file_url ?? null
    } else {
      const { data } = await service.from('bolle').select('file_url').eq('id', bollaId).maybeSingle()
      file_url = data?.file_url ?? null
      if (!file_url?.trim() && userSedeId) {
        const { data: row } = await service
          .from('bolle')
          .select('file_url, sede_id, fornitore_id')
          .eq('id', bollaId)
          .maybeSingle()
        if (row?.file_url?.trim() && (await operatoreCanAccessBollaFattura(service, row, userSedeId))) {
          file_url = row.file_url
        }
      }
    }
  } else if (fatturaId) {
    if (admin) {
      const { data } = await service.from('fatture').select('file_url').eq('id', fatturaId).maybeSingle()
      file_url = data?.file_url ?? null
    } else {
      const { data } = await service.from('fatture').select('file_url').eq('id', fatturaId).maybeSingle()
      file_url = data?.file_url ?? null
      if (!file_url?.trim() && userSedeId) {
        const { data: row } = await service
          .from('fatture')
          .select('file_url, sede_id, fornitore_id')
          .eq('id', fatturaId)
          .maybeSingle()
        if (row?.file_url?.trim() && (await operatoreCanAccessBollaFattura(service, row, userSedeId))) {
          file_url = row.file_url
        }
      }
    }
  } else if (logId) {
    if (admin) {
      const { data } = await service.from('log_sincronizzazione').select('file_url').eq('id', logId).maybeSingle()
      file_url = data?.file_url ?? null
    } else {
      const { data } = await service.from('log_sincronizzazione').select('file_url').eq('id', logId).maybeSingle()
      file_url = data?.file_url ?? null
      if (!file_url?.trim() && userSedeId) {
        const { data: row } = await service
          .from('log_sincronizzazione')
          .select('file_url, fornitore_id')
          .eq('id', logId)
          .maybeSingle()
        if (row?.file_url?.trim() && (await operatoreCanAccessLog(service, row, userSedeId))) {
          file_url = row.file_url
        }
      }
    }
  } else if (documentoId) {
    if (admin) {
      const { data } = await service.from('documenti_da_processare').select('file_url').eq('id', documentoId).maybeSingle()
      file_url = data?.file_url ?? null
    } else {
      const { data } = await service.from('documenti_da_processare').select('file_url').eq('id', documentoId).maybeSingle()
      file_url = data?.file_url ?? null
      if (!file_url?.trim() && userSedeId) {
        const { data: row } = await service
          .from('documenti_da_processare')
          .select('file_url, sede_id')
          .eq('id', documentoId)
          .maybeSingle()
        if (row?.file_url?.trim() && operatoreCanAccessDocumento(row, userSedeId)) {
          file_url = row.file_url
        }
      }
    }
  } else if (statementId) {
    if (admin) {
      const { data } = await service.from('statements').select('file_url').eq('id', statementId).maybeSingle()
      file_url = data?.file_url ?? null
    } else {
      const { data } = await service.from('statements').select('file_url').eq('id', statementId).maybeSingle()
      file_url = data?.file_url ?? null
      if (!file_url?.trim() && userSedeId) {
        const { data: row } = await service
          .from('statements')
          .select('file_url, sede_id, fornitore_id')
          .eq('id', statementId)
          .maybeSingle()
        if (row?.file_url?.trim() && (await operatoreCanAccessStatement(service, row, userSedeId))) {
          file_url = row.file_url
        }
      }
    }
  } else if (confermaOrdineId) {
    if (admin) {
      const { data } = await service
        .from('conferme_ordine')
        .select('file_url')
        .eq('id', confermaOrdineId)
        .maybeSingle()
      file_url = data?.file_url ?? null
    } else {
      const { data } = await service
        .from('conferme_ordine')
        .select('file_url')
        .eq('id', confermaOrdineId)
        .maybeSingle()
      file_url = data?.file_url ?? null
      if (!file_url?.trim() && userSedeId) {
        const { data: row } = await service
          .from('conferme_ordine')
          .select('file_url, fornitore_id')
          .eq('id', confermaOrdineId)
          .maybeSingle()
        if (
          row?.file_url?.trim() &&
          row.fornitore_id &&
          (await fornitoreBelongsToSede(service, row.fornitore_id, userSedeId))
        ) {
          file_url = row.file_url
        }
      }
    }
  }

  if (!file_url?.trim()) {
    return NextResponse.json({ error: 'Not found or no attachment' }, { status: 404 })
  }

  const trimmed = file_url.trim()
  const wantsJson = req.nextUrl.searchParams.get('json') === '1'

  const parsed = parseSupabasePublicStorageUrl(trimmed)
  if (!parsed) {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      if (wantsJson) return NextResponse.json({ url: trimmed })
      return NextResponse.redirect(trimmed)
    }
    return NextResponse.json({ error: 'Unsupported file URL' }, { status: 400 })
  }

  const { data: signed, error } = await service.storage
    .from(parsed.bucket)
    .createSignedUrl(parsed.objectPath, SIGNED_TTL_SEC)

  if (error || !signed?.signedUrl) {
    return NextResponse.json({ error: 'Could not create signed URL' }, { status: 502 })
  }

  if (wantsJson) return NextResponse.json({ url: signed.signedUrl })
  return NextResponse.redirect(signed.signedUrl)
}
