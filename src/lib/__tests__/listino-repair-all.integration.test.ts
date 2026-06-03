/**
 * Ripara prezzi listino (totale riga → unitario) per tutti i fornitori.
 *
 *   npm run repair:listino-prices          # report
 *   npm run repair:listino-prices:apply    # aggiorna DB
 */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { findListinoPriceRepairs } from '@/lib/listino-price-repair'

const enabled = process.env.LISTINO_PRICE_REPAIR === '1'
const apply = process.env.LISTINO_PRICE_REPAIR_APPLY === '1'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

describe.skipIf(!enabled)('listino-repair-all', () => {
  it(
    'corregge prezzi listino salvati come totale riga',
    async () => {
      if (!url || !key) {
        throw new Error('Mancano NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
      }

      const sb = createClient(url, key)
      const rows: {
        id: string
        fornitore_id: string
        prodotto: string
        prezzo: number
        data_prezzo: string
        note: string | null
      }[] = []
      const pageSize = 1000
      let from = 0
      while (true) {
        const { data: page, error } = await sb
          .from('listino_prezzi')
          .select('id, fornitore_id, prodotto, prezzo, data_prezzo, note')
          .order('id')
          .range(from, from + pageSize - 1)
        expect(error).toBeNull()
        if (!page?.length) break
        rows.push(...page)
        if (page.length < pageSize) break
        from += pageSize
      }

      if (!rows.length) {
        console.log('Nessuna riga listino.')
        return
      }

      const repairs = findListinoPriceRepairs(rows)
      const fornitoreIds = [...new Set(repairs.map((r) => r.fornitore_id))]
      const { data: fornitori } = await sb.from('fornitori').select('id, nome').in('id', fornitoreIds)
      const nomeById = new Map((fornitori ?? []).map((f) => [f.id, f.nome]))

      const report = {
        scanned: rows.length,
        repairs: repairs.length,
        apply,
        rows: repairs.map((r) => ({
          id: r.id,
          fornitore: nomeById.get(r.fornitore_id) ?? r.fornitore_id,
          prodotto: r.prodotto,
          prezzo: r.prezzo,
          correctedPrezzo: r.correctedPrezzo,
          data_prezzo: r.data_prezzo,
          reason: r.reason,
        })),
      }
      writeFileSync(
        resolve(process.cwd(), 'repair-listino-prices-report.json'),
        JSON.stringify(report, null, 2),
      )
      console.log(
        `\nListino: ${rows.length} righe, ${repairs.length} da correggere → repair-listino-prices-report.json\n`,
      )

      if (!apply) {
        console.log('Dry-run. Per applicare: npm run repair:listino-prices:apply\n')
        return
      }

      let updated = 0
      for (const r of repairs) {
        const { error: upErr } = await sb
          .from('listino_prezzi')
          .update({ prezzo: r.correctedPrezzo })
          .eq('id', r.id)
        if (upErr) throw upErr
        updated++
      }
      console.log(`\nAggiornate ${updated} righe listino.\n`)
      expect(updated).toBe(repairs.length)
    },
    120_000,
  )
})
