/**
 * Audit globale listino: trova prezzi OCR (quantità al posto del prezzo) per tutti i fornitori.
 *
 *   npm run audit:listino-qty          # solo report
 *   npm run audit:listino-qty:apply    # elimina righe sospette
 */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { findSuspiciousListinoRows } from '@/lib/listino-price-audit'

const enabled = process.env.LISTINO_QTY_AUDIT === '1'
const apply = process.env.LISTINO_QTY_AUDIT_APPLY === '1'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

describe.skipIf(!enabled)('listino-qty-audit-all', () => {
  it(
    'scansiona listino_prezzi e opzionalmente elimina righe qty/prezzo OCR',
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

      const suspicious = findSuspiciousListinoRows(rows)
      const { data: fornitori } = await sb.from('fornitori').select('id, nome').in(
        'id',
        [...new Set(suspicious.map((s) => s.fornitore_id))],
      )
      const nomeById = new Map((fornitori ?? []).map((f) => [f.id, f.nome]))
      const report = {
        scanned: rows.length,
        suspicious: suspicious.length,
        apply,
        rows: suspicious.map((s) => ({
          id: s.id,
          fornitore: nomeById.get(s.fornitore_id) ?? s.fornitore_id,
          prodotto: s.prodotto,
          prezzo: s.prezzo,
          data_prezzo: s.data_prezzo,
        })),
      }
      writeFileSync(
        resolve(process.cwd(), 'audit-listino-qty-report.json'),
        JSON.stringify(report, null, 2),
      )
      console.log(`\nListino: ${rows.length} righe, ${suspicious.length} sospette → audit-listino-qty-report.json\n`)

      if (!apply) {
        console.log('Dry-run. Per eliminare: npm run audit:listino-qty:apply\n')
        return
      }

      const ids = suspicious.map((s) => s.id)
      let deleted = 0
      for (const part of chunk(ids, 100)) {
        const { error: delErr, count } = await sb
          .from('listino_prezzi')
          .delete({ count: 'exact' })
          .in('id', part)
        if (delErr) throw delErr
        deleted += count ?? part.length
      }
      console.log(`\nEliminate ${deleted} righe sospette.\n`)
      expect(deleted).toBe(suspicious.length)
    },
    120_000,
  )
})
