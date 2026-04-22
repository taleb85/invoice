import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/utils/supabase/server'

export const maxDuration = 300

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createServiceClient()
  const date = new Date().toISOString().split('T')[0]
  const results: Record<string, { rows: number; path: string }> = {}
  const errors: string[] = []

  async function exportTable(tableName: string, selectQuery: string) {
    try {
      const { data, error } = await service
        .from(tableName)
        .select(selectQuery)
        .order('created_at', { ascending: false })

      if (error) throw error
      if (!data || data.length === 0) return

      const rows = data as unknown as Record<string, unknown>[]
      const headers = Object.keys(rows[0])
      const csvRows = [
        headers.join(','),
        ...rows.map((row) =>
          headers
            .map((h) => {
              const val = row[h]
              if (val === null || val === undefined) return ''
              const str =
                typeof val === 'object' ? JSON.stringify(val) : String(val)
              return str.includes(',') || str.includes('"') || str.includes('\n')
                ? `"${str.replace(/"/g, '""')}"`
                : str
            })
            .join(','),
        ),
      ]
      const csv = csvRows.join('\n')
      const buffer = Buffer.from(csv, 'utf-8')
      const path = `backups/${date}/${tableName}.csv`

      const { error: uploadError } = await service.storage
        .from('documenti')
        .upload(path, buffer, { contentType: 'text/csv', upsert: true })

      if (uploadError) throw uploadError
      results[tableName] = { rows: data.length, path }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${tableName}: ${msg}`)
    }
  }

  await exportTable(
    'fatture',
    'id, data, numero_fattura, importo, fornitore_id, sede_id, approval_status, created_at',
  )
  await exportTable(
    'bolle',
    'id, data, numero_bolla, importo, stato, fornitore_id, sede_id, created_at',
  )
  await exportTable('fornitori', 'id, nome, email, piva, sede_id, created_at')
  await exportTable(
    'sedi',
    'id, nome, country_code, currency, timezone, created_at',
  )
  await exportTable(
    'price_anomalies',
    'id, fattura_id, fornitore_id, prodotto, prezzo_pagato, prezzo_listino, differenza_percent, resolved, created_at',
  )

  // Log backup completion to activity_log (best-effort)
  try {
    await service.from('activity_log').insert([
      {
        user_id: null,
        sede_id: null,
        action: 'backup.completed',
        entity_type: 'system',
        entity_label: `Backup ${date}`,
        metadata: {
          results,
          errors,
          tablesExported: Object.keys(results).length,
        },
      },
    ])
  } catch {
    // non-critical
  }

  return NextResponse.json({
    date,
    exported: results,
    errors,
    totalTables: Object.keys(results).length,
  })
}
