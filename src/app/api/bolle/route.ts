import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getRequestAuth } from '@/utils/supabase/server'
import { documentiPublicRefUrl } from '@/lib/documenti-storage-url'

/**
 * POST /api/bolle
 * Accepts multipart/form-data from the offline sync queue.
 * Fields: file (File), fornitore_id, sede_id, data, numero_bolla?, importo?, registrato_da?
 */
export async function POST(req: NextRequest) {
  const { user } = await getRequestAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })


  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  const fornitore_id = formData.get('fornitore_id') as string | null
  const sede_id = formData.get('sede_id') as string | null
  const data = formData.get('data') as string | null
  const numero_bolla = formData.get('numero_bolla') as string | null
  const importo_raw = formData.get('importo') as string | null
  const registrato_da = formData.get('registrato_da') as string | null

  if (!fornitore_id) return NextResponse.json({ error: 'fornitore_id obbligatorio' }, { status: 400 })
  if (!file) return NextResponse.json({ error: 'File obbligatorio' }, { status: 400 })

  const importo = importo_raw ? parseFloat(importo_raw) : null

  // Upload file to Supabase Storage
  const svc = createServiceClient()
  const ext = file.name.split('.').pop() ?? 'jpg'
  const uniqueName = `${crypto.randomUUID()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await svc.storage
    .from('documenti')
    .upload(uniqueName, buffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: `Upload error: ${uploadError.message}` }, { status: 500 })
  }

  const file_url = documentiPublicRefUrl(uniqueName)

  const { data: bolla, error: insertError } = await svc
    .from('bolle')
    .insert([{
      fornitore_id,
      sede_id: sede_id || null,
      data: data || new Date().toISOString().slice(0, 10),
      file_url,
      stato: 'in attesa',
      numero_bolla: numero_bolla?.trim() || null,
      importo: importo != null && !Number.isNaN(importo) ? importo : null,
      registrato_da: registrato_da?.trim().toUpperCase() || null,
    }])
    .select('id')
    .single()

  if (insertError) {
    // Attempt to clean up the uploaded file
    await svc.storage.from('documenti').remove([uniqueName]).catch(() => {})
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: bolla?.id })
}
