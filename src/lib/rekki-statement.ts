/**
 * Persistenza ordini Rekki su `statements` / `statement_rows` + triple-check.
 * La discrepanza prezzo Rekki vs fattura usa `REKKI_VS_FATTURA_TOLERANCE` in `runTripleCheck`.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { runTripleCheck, type CheckResult, type StatementLine } from '@/lib/triple-check'
import { REKKI_BOLLE_JSON_NOTE, rekkiLinesToStatementLines, type RekkiLine } from '@/lib/rekki-parser'

type BollaJsonRow = {
  id: string
  numero_bolla: string | null
  importo: number | null
  data: string
  rekki_meta?: {
    origin: true
    prezzo_da_verificare: true
    note: string
    prezzo_unitario: number
    quantita: number
    prodotto: string
  }
}

function enrichBolleJsonFromCheck(
  r: CheckResult,
  line: StatementLine,
): unknown {
  const base = (r.bolle.length ? r.bolle : null) as BollaJsonRow[] | null
  if (!line.rekki) return base

  const rekki_meta = {
    origin: true as const,
    prezzo_da_verificare: true as const,
    note: REKKI_BOLLE_JSON_NOTE,
    prezzo_unitario: line.rekki.prezzo_unitario,
    quantita: line.rekki.quantita,
    prodotto: line.rekki.prodotto,
  }

  if (base?.length) {
    return base.map((b) => ({ ...b, rekki_meta }))
  }

  return [
    {
      id: `rekki-synthetic-${line.numero}`,
      numero_bolla: `${line.rekki.prodotto} (${line.rekki.quantita} × ${line.rekki.prezzo_unitario})`,
      importo: line.importo,
      data: line.data ?? new Date().toISOString().slice(0, 10),
      rekki_meta,
    },
  ]
}

export async function persistRekkiOrderStatement(
  supabase: SupabaseClient,
  opts: {
    fornitoreId: string
    sedeId: string | null
    rekkiLines: RekkiLine[]
    emailSubject?: string | null
    fileUrl?: string | null
  },
): Promise<{ statementId: string } | { error: string }> {
  const { fornitoreId, sedeId, rekkiLines, emailSubject, fileUrl } = opts
  if (!rekkiLines.length) return { error: 'Nessuna riga Rekki da salvare.' }

  const statementLines = rekkiLinesToStatementLines(rekkiLines)

  const { data: stmtRow, error: stmtErr } = await supabase
    .from('statements')
    .insert([
      {
        sede_id: sedeId,
        fornitore_id: fornitoreId,
        email_subject: emailSubject ?? 'Ordine Rekki (prezzo da verificare)',
        file_url: fileUrl ?? null,
        status: 'processing',
        total_rows: 0,
        missing_rows: 0,
        received_at: new Date().toISOString(),
      },
    ])
    .select('id')
    .single()

  if (stmtErr || !stmtRow) {
    console.error('[REKKI] statements insert:', stmtErr?.message)
    return { error: stmtErr?.message ?? 'Errore creazione statement Rekki.' }
  }

  const statementId = stmtRow.id as string
  const { results } = await runTripleCheck(supabase, statementLines, sedeId, fornitoreId)

  const rowInserts = results.map((r, i) => {
    const line = statementLines[i]
    return {
      statement_id: statementId,
      numero_doc: r.numero,
      importo: r.importoStatement,
      data_doc: line?.data ?? null,
      check_status: r.status,
      delta_importo: r.deltaImporto,
      fattura_id: r.fattura?.id ?? null,
      fattura_numero: r.fattura?.numero_fattura ?? null,
      fornitore_id: r.fornitore?.id ?? fornitoreId,
      bolle_json: enrichBolleJsonFromCheck(r, line),
    }
  })

  const { error: rowsErr } = await supabase.from('statement_rows').insert(rowInserts)
  if (rowsErr) {
    console.error('[REKKI] statement_rows insert:', rowsErr.message)
    await supabase.from('statements').update({ status: 'error' }).eq('id', statementId)
    return { error: rowsErr.message }
  }

  const missingRows = results.filter((x) => x.status !== 'ok').length
  await supabase
    .from('statements')
    .update({
      status: 'done',
      total_rows: results.length,
      missing_rows: missingRows,
    })
    .eq('id', statementId)

  return { statementId }
}
