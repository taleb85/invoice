/**
 * Riesegue il triple-check su tutti gli statement con anomalie (tutte le sedi).
 *
 *   REPROCESS_STMT_ALL=1 npx vitest run src/lib/__tests__/reprocess-statement-checks-all.integration.test.ts
 */
import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { runTripleCheck } from '@/lib/triple-check'

const enabled = process.env.REPROCESS_STMT_ALL === '1'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const limit = Number(process.env.REPROCESS_STMT_LIMIT ?? 2000)

describe.skipIf(!enabled)('reprocess-statement-checks-all', () => {
  it(
    'aggiorna righe e conteggi con triple-check corrente',
    async () => {
      if (!url || !key) {
        throw new Error('Mancano NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
      }

      const sb = createClient(url, key)
      const { data: statements, error } = await sb
        .from('statements')
        .select('id, sede_id, fornitore_id, missing_rows')
        .gt('missing_rows', 0)
        .order('received_at', { ascending: false })
        .limit(limit)

      expect(error).toBeNull()
      if (!statements?.length) {
        console.log('Nessuno statement con anomalie.')
        return
      }

      let processed = 0
      let righe = 0
      let fixedRows = 0

      for (const stmt of statements) {
        const { data: rows } = await sb
          .from('statement_rows')
          .select('id, numero_doc, importo, data_doc, check_status')
          .eq('statement_id', stmt.id)

        if (!rows?.length) continue

        const lines = rows.map((r) => ({
          numero: r.numero_doc ?? '',
          importo: r.importo ?? 0,
          data: r.data_doc ?? null,
        }))

        const { results } = await runTripleCheck(sb, lines, stmt.sede_id, stmt.fornitore_id)

        for (const r of results) {
          const existing = rows.find((row) => row.numero_doc === r.numero)
          if (!existing) continue
          if (existing.check_status !== r.status) fixedRows++

          const bolle_json =
            r.bolle.length > 0
              ? r.bolle.map((b) => ({
                  id: b.id,
                  numero_bolla: b.numero_bolla,
                  importo: b.importo,
                  data: b.data,
                }))
              : null

          await sb
            .from('statement_rows')
            .update({
              check_status: r.status,
              delta_importo: r.deltaImporto,
              fattura_id: r.fattura?.id ?? null,
              fattura_numero: r.fattura?.numero_fattura ?? null,
              fornitore_id: r.fornitore?.id ?? stmt.fornitore_id,
              bolle_json,
            })
            .eq('id', existing.id)
        }

        const missingRows = results.filter((r) => r.status !== 'ok').length
        await sb
          .from('statements')
          .update({ total_rows: results.length, missing_rows: missingRows })
          .eq('id', stmt.id)

        processed++
        righe += results.length
      }

      console.log(
        `Riprocessati ${processed} statement (${righe} righe); ${fixedRows} righe con stato aggiornato.`,
      )
      expect(processed).toBeGreaterThanOrEqual(0)
    },
    600_000,
  )
})
