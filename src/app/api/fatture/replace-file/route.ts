import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { documentiPublicRefUrl } from '@/lib/documenti-storage-url'

/** Estrae il percorso del file nel bucket da un URL pubblico di Supabase Storage */
function storagePathFromUrl(url: string): string | null {
  try {
    // URL format: https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
    const match = url.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)$/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const formData = await req.formData()
  const fatturaId = formData.get('fattura_id') as string | null
  const file = formData.get('file') as File | null
  const dataFattura = formData.get('data') as string | null

  if (!fatturaId || !file) {
    return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 })
  }

  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Carica solo un PDF.' }, { status: 400 })
  }

  // Recupera il vecchio file_url prima di sovrascrivere
  const { data: fatturaCorrente } = await supabase
    .from('fatture')
    .select('file_url')
    .eq('id', fatturaId)
    .single()
  const oldFileUrl = fatturaCorrente?.file_url ?? null

  // Upload nuovo file
  const ext = file.name.split('.').pop() ?? 'bin'
  const uniqueName = `fattura_replace_${crypto.randomUUID()}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const buffer = new Uint8Array(arrayBuffer)

  const { error: uploadError } = await supabase.storage
    .from('documenti')
    .upload(uniqueName, buffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: `Errore upload: ${uploadError.message}` }, { status: 500 })
  }

  const file_url = documentiPublicRefUrl(uniqueName)

  // Aggiorna la fattura
  const updatePayload: Record<string, string> = { file_url }
  if (dataFattura) updatePayload.data = dataFattura

  const { error: updateError } = await supabase
    .from('fatture')
    .update(updatePayload)
    .eq('id', fatturaId)

  if (updateError) {
    // Rollback: rimuovi il file appena caricato
    await supabase.storage.from('documenti').remove([uniqueName])
    return NextResponse.json({ error: `Errore aggiornamento: ${updateError.message}` }, { status: 500 })
  }

  // Elimina il vecchio file dallo storage (best-effort, non blocca la risposta)
  if (oldFileUrl) {
    const oldPath = storagePathFromUrl(oldFileUrl)
    if (oldPath) {
      await supabase.storage.from('documenti').remove([oldPath])
    }
  }

  return NextResponse.json({ file_url })
}
