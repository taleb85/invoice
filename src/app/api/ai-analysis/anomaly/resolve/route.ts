import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile } from '@/utils/supabase/server'
import { safeDate } from '@/lib/safe-date'

export const dynamic = 'force-dynamic'

function parseYmd(iso: string): { y: number; m: number; d: number } | null {
  const m2 = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m2) return null
  const y = parseInt(m2[1]!, 10)
  const m = parseInt(m2[2]!, 10)
  const d = parseInt(m2[3]!, 10)
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  return { y, m, d }
}

function isInFuture(iso: string): boolean {
  const parsed = parseYmd(iso)
  if (!parsed) return false
  const today = new Date()
  const d = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d))
  return d > today
}

function swapDayMonth(iso: string): string | null {
  const parsed = parseYmd(iso)
  if (!parsed) return null
  const { y, m, d } = parsed
  return `${y}-${String(d).padStart(2, '0')}-${String(m).padStart(2, '0')}`
}

function parseItalianAmount(input: string): number | null {
  if (!input) return null
  const trimmed = input.trim()
  if (!trimmed) return null
  const cleaned = trimmed.replace(/\./g, '').replace(',', '.')
  const num = parseFloat(cleaned)
  if (isNaN(num)) return null
  return Math.round(num * 100) / 100
}

function extractFirstDate(desc: string): string | null {
  const m = desc.match(/(\d{1,2}\/\d{1,2}\/\d{4})/)
  if (!m) return null
  return safeDate(m[1])
}

function extractFirstAmount(desc: string): string | null {
  const segments = desc.split('(')
  for (const seg of segments) {
    const close = seg.indexOf(')')
    if (close === -1) continue
    const inner = seg.slice(0, close)
    if (/[\d.,]/.test(inner) && inner.includes(',')) {
      const m = inner.match(/[\d]{1,3}(?:[.\d]*,\d+)?/)
      if (m) return m[0]
    }
  }
  return null
}

export async function POST(req: NextRequest) {
  const profile = await getProfile()
  if (!profile) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  let body: {
    entityType?: string
    entityId?: string
    label?: string
    description?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON non valido' }, { status: 400 })
  }

  const { entityType, entityId, label, description } = body
  if (!entityType || !entityId) {
    return NextResponse.json({ error: 'entityType e entityId richiesti' }, { status: 400 })
  }
  if (entityType !== 'bolla' && entityType !== 'fattura') {
    return NextResponse.json({ error: 'entityType deve essere "bolla" o "fattura"' }, { status: 400 })
  }

  const service = createServiceClient()
  const table = entityType === 'bolla' ? 'bolle' : 'fatture'

  const { data: row, error: rowErr } = await service
    .from(table)
    .select('id, data, importo')
    .eq('id', entityId)
    .maybeSingle()

  if (rowErr || !row) {
    return NextResponse.json({ error: 'Documento non trovato' }, { status: 404 })
  }

  const fixes: string[] = []
  const updates: Record<string, unknown> = {}

  if (label && description) {
    const labelLower = label.toLowerCase()

    if (labelLower.includes('data') && description) {
      const correctedDate = extractFirstDate(description)
      if (correctedDate && correctedDate !== row.data) {
        updates.data = correctedDate
        fixes.push('data')
      }
    }

    if (labelLower.includes('importo') && description) {
      const correctedAmount = extractFirstAmount(description)
      if (correctedAmount !== null) {
        const num = parseItalianAmount(correctedAmount)
        if (num !== null) {
          const currentNum = row.importo != null ? Number(row.importo) : null
          if (currentNum === null || Math.abs(num - currentNum) > 0.001) {
            updates.importo = num
            fixes.push('importo')
          }
        }
      }
    }
  }

  if (fixes.length === 0 && row.data && isInFuture(row.data)) {
    const swapped = swapDayMonth(row.data)
    if (swapped) {
      updates.data = swapped
      fixes.push('data')
    }
  }

  if (fixes.length === 0) {
    const msg =
      label?.toLowerCase().includes('importo') && description?.includes(',')
        ? 'Nessuna correzione necessaria: i valori sono equivalenti (differenza solo di formato).'
        : 'Nessuna anomalia automaticamente correggibile rilevata. Verifica i dati manualmente.'
    return NextResponse.json({ ok: true, applied: [], message: msg })
  }

  const { error: updErr } = await service.from(table).update(updates).eq('id', entityId)
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }

  const parts: string[] = []
  if (fixes.includes('data')) parts.push('data')
  if (fixes.includes('importo')) parts.push('importo')
  const msg = `Corretto: ${parts.join(' e ')} aggiornat${parts.includes('importo') ? 'o' : 'a'} con i valori del documento.`

  return NextResponse.json({
    ok: true,
    applied: fixes,
    updates,
    message: msg,
  })
}
