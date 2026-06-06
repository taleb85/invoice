import type { SupabaseClient } from '@supabase/supabase-js'
import { findUniqueFornitoreForPendingDoc } from '@/lib/auto-resolve-pending-doc'
import {
  extractStatementFromSupplierName,
  statementEmailSubjectMatchesFornitore,
} from '@/lib/statement-supplier-subject'
import { tryBootstrapFornitoreFromOcrRagione } from '@/lib/scan-email-ocr-bootstrap-fornitore'

/**
 * Inoltri da cliente: oggetto «Statement from …» indica il fornitore reale anche se
 * `mittente` / `matched_by: email` punta al cliente (es. orders@trueterroir.co.uk).
 */
export async function resolveFornitoreFromStatementSubject(
  service: SupabaseClient,
  opts: {
    sedeId: string | null | undefined
    oggetto_mail: string | null | undefined
    metadata?: Record<string, unknown> | null
    mittente?: string | null
  },
): Promise<{ id: string; nome: string } | null> {
  if (!extractStatementFromSupplierName(opts.oggetto_mail)) return null
  return findUniqueFornitoreForPendingDoc(service, {
    docSedeId: opts.sedeId,
    metadata: opts.metadata ?? null,
    mittente: opts.mittente,
    oggetto_mail: opts.oggetto_mail,
  })
}

export async function propagateFornitoreFromPendingDoc(
  service: SupabaseClient,
  opts: {
    fornitoreId: string
    fattura_id: string | null
    bolla_id: string | null
    file_url: string | null
  },
): Promise<void> {
  if (opts.fattura_id) {
    const { error } = await service
      .from('fatture')
      .update({ fornitore_id: opts.fornitoreId })
      .eq('id', opts.fattura_id)
    if (error) console.error('[audit-statement-fornitore] fattura', opts.fattura_id, error.message)
  }
  if (opts.bolla_id) {
    const { error } = await service
      .from('bolle')
      .update({ fornitore_id: opts.fornitoreId })
      .eq('id', opts.bolla_id)
    if (error) console.error('[audit-statement-fornitore] bolla', opts.bolla_id, error.message)
  }

  const fileUrl = opts.file_url?.trim()
  if (!fileUrl) return

  const fileUrlVariants = new Set<string>([
    fileUrl,
    fileUrl.replace('supabase.co/storage', 'supabase.co\n/storage'),
  ])

  const { data: stmts } = await service
    .from('statements')
    .select('id')
    .in('file_url', [...fileUrlVariants])
    .neq('fornitore_id', opts.fornitoreId)

  const stmtIds = (stmts ?? []).map((s) => s.id as string)
  if (!stmtIds.length) return

  await service
    .from('statements')
    .update({ fornitore_id: opts.fornitoreId, status: 'processing' })
    .in('id', stmtIds)

  await service
    .from('statement_rows')
    .update({ fornitore_id: opts.fornitoreId })
    .in('statement_id', stmtIds)
}

export type StatementFornitoreDriftFix = {
  statement_id: string
  fornitore_id_before: string
  fornitore_id_after: string
  email_subject: string | null
}

/**
 * Corregge `statements` già in archivio il cui `email_subject` non coincide col fornitore assegnato.
 * Utile quando i documenti in coda sono già `associato` / `audit_completo_at` e la passata veloce li salta.
 */
export async function fixStatementFornitoreDriftBatch(
  service: SupabaseClient,
  opts: {
    sedeId?: string | null
    batchSize?: number
    afterId?: string | null
  },
): Promise<{ fixes: StatementFornitoreDriftFix[]; has_more: boolean; next_after_id: string | null }> {
  const batchSize = Math.min(Math.max(opts.batchSize ?? 15, 1), 50)
  let q = service
    .from('statements')
    .select('id, email_subject, fornitore_id, file_url, sede_id, fornitori(nome, display_name)')
    .ilike('email_subject', 'Statement from%')
    .order('id', { ascending: true })

  if (opts.sedeId) q = q.eq('sede_id', opts.sedeId) as typeof q
  if (opts.afterId) q = q.gt('id', opts.afterId) as typeof q

  const { data, error } = await q.limit(batchSize)
  if (error) throw new Error(error.message)

  const fixes: StatementFornitoreDriftFix[] = []
  const rows = data ?? []

  for (const raw of rows) {
    const row = raw as {
      id: string
      email_subject: string | null
      fornitore_id: string | null
      file_url: string | null
      sede_id: string | null
      fornitori:
        | { nome: string; display_name: string | null }
        | { nome: string; display_name: string | null }[]
        | null
    }
    if (!row.fornitore_id) continue

    const fn = Array.isArray(row.fornitori) ? row.fornitori[0] : row.fornitori
    const nome = fn?.nome ?? ''
    if (
      statementEmailSubjectMatchesFornitore(
        row.email_subject,
        nome,
        fn?.display_name,
      )
    ) {
      continue
    }

    const target =
      (await resolveFornitoreFromStatementSubject(service, {
        sedeId: row.sede_id,
        oggetto_mail: row.email_subject,
        metadata: null,
        mittente: null,
      })) ??
      (await bootstrapFornitoreFromStatementSubject(service, {
        sedeId: row.sede_id,
        oggetto_mail: row.email_subject,
      }))
    if (!target || target.id === row.fornitore_id) continue

    const { error: updErr } = await service
      .from('statements')
      .update({ fornitore_id: target.id, status: 'processing' })
      .eq('id', row.id)
    if (updErr) {
      console.error('[audit-statement-fornitore] statement', row.id, updErr.message)
      continue
    }

    await service
      .from('statement_rows')
      .update({ fornitore_id: target.id })
      .eq('statement_id', row.id)

    const { data: rowFatture } = await service
      .from('statement_rows')
      .select('fattura_id')
      .eq('statement_id', row.id)
      .not('fattura_id', 'is', null)
    const fatturaIds = [
      ...new Set(
        (rowFatture ?? [])
          .map((r) => (r as { fattura_id: string | null }).fattura_id)
          .filter((id): id is string => !!id),
      ),
    ]
    if (fatturaIds.length) {
      await service
        .from('fatture')
        .update({ fornitore_id: target.id })
        .in('id', fatturaIds)
        .eq('fornitore_id', row.fornitore_id)
    }

    if (row.file_url?.trim()) {
      await service
        .from('documenti_da_processare')
        .update({ fornitore_id: target.id })
        .eq('file_url', row.file_url.trim())
    }

    fixes.push({
      statement_id: row.id,
      fornitore_id_before: row.fornitore_id,
      fornitore_id_after: target.id,
      email_subject: row.email_subject,
    })
  }

  const last = rows[rows.length - 1]
  return {
    fixes,
    has_more: rows.length === batchSize,
    next_after_id: last?.id ?? null,
  }
}

async function bootstrapFornitoreFromStatementSubject(
  service: SupabaseClient,
  opts: {
    sedeId: string | null | undefined
    oggetto_mail: string | null | undefined
  },
): Promise<{ id: string; nome: string } | null> {
  const name = extractStatementFromSupplierName(opts.oggetto_mail)
  if (!name?.trim() || !opts.sedeId?.trim()) return null
  const bootstrap = await tryBootstrapFornitoreFromOcrRagione(
    service,
    { ragione_sociale: name.trim() },
    opts.sedeId.trim(),
    null,
  )
  if (bootstrap.kind !== 'resolved') return null
  return { id: bootstrap.fornitore.id, nome: bootstrap.fornitore.nome }
}
