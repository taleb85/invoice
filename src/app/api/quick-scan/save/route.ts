import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { safeDate } from '@/lib/safe-date'
import { documentiPublicRefUrl } from '@/lib/documenti-storage-url'

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'FormData non valido' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  const tipo = (formData.get('tipo') as string | null) ?? 'unknown'
  const fornitoreId = (formData.get('fornitore_id') as string | null) || null
  const importoRaw = formData.get('importo') as string | null
  const dataRaw = (formData.get('data') as string | null) || null
  const oggi = new Date().toISOString().slice(0, 10)
  const dataDoc = safeDate(dataRaw) ?? oggi
  const numero = (formData.get('numero') as string | null) || null
  const sedeId = (formData.get('sede_id') as string | null) || null

  if (!file) {
    return NextResponse.json({ error: 'Nessun file ricevuto' }, { status: 400 })
  }

  const importo = importoRaw ? parseFloat(importoRaw) : null
  const importoVal = Number.isFinite(importo) && importo !== null && importo > 0 ? importo : null

  // Upload file to Supabase Storage
  const ext = file.name.split('.').pop() ?? 'jpg'
  const timestamp = Date.now()
  const uniqueName = `quick-scan/${sedeId ?? 'nosede'}/${timestamp}-${user.id.slice(0, 8)}.${ext}`

  const buffer = await file.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from('documenti')
    .upload(uniqueName, buffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    return NextResponse.json(
      { error: `Errore upload: ${uploadError.message}` },
      { status: 500 },
    )
  }

  const fileUrl = documentiPublicRefUrl(uniqueName)

  // Insert into the correct table based on tipo
  if (tipo === 'fattura') {
    const { data: row, error: insErr } = await supabase
      .from('fatture')
      .insert([
        {
          fornitore_id: fornitoreId,
          bolla_id: null,
          sede_id: sedeId,
          data: dataDoc,
          file_url: fileUrl,
          importo: importoVal,
          numero_fattura: numero,
          verificata_estratto_conto: false,
        },
      ])
      .select('id')
      .single()

    if (insErr) {
      await supabase.storage.from('documenti').remove([uniqueName])
      return NextResponse.json(
        { error: `Errore inserimento fattura: ${insErr.message}` },
        { status: 500 },
      )
    }

    return NextResponse.json({ ok: true, id: (row as { id: string }).id, tipo: 'fattura' })
  }

  // Default: insert as bolla (for tipo === 'bolla' or 'unknown')
  const { data: row, error: insErr } = await supabase
    .from('bolle')
    .insert([
      {
        fornitore_id: fornitoreId,
        sede_id: sedeId,
        data: dataDoc,
        file_url: fileUrl,
        importo: importoVal,
        numero_bolla: numero,
        stato: 'in attesa',
      },
    ])
    .select('id')
    .single()

  if (insErr) {
    await supabase.storage.from('documenti').remove([uniqueName])
    return NextResponse.json(
      { error: `Errore inserimento bolla: ${insErr.message}` },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, id: (row as { id: string }).id, tipo: 'bolla' })
}
