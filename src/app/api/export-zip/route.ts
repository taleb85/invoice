import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import JSZip from 'jszip'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))

  const monthStr = String(month).padStart(2, '0')
  const startDate = `${year}-${monthStr}-01`
  const endDate = new Date(year, month, 1).toISOString().split('T')[0] // primo del mese successivo

  // Carica bolle e fatture del mese con fornitore
  const [{ data: bolle }, { data: fatture }] = await Promise.all([
    supabase
      .from('bolle')
      .select('id, data, file_url, fornitore_id, fornitori(nome)')
      .gte('data', startDate)
      .lt('data', endDate)
      .not('file_url', 'is', null),
    supabase
      .from('fatture')
      .select('id, data, file_url, fornitore_id, fornitori(nome)')
      .gte('data', startDate)
      .lt('data', endDate)
      .not('file_url', 'is', null),
  ])

  const zip = new JSZip()
  const folderName = `FLUXO_${year}-${monthStr}`
  const root = zip.folder(folderName)!

  const sanitize = (s: string) => s.replace(/[/\\?%*:|"<>]/g, '-').trim()

  const downloadFile = async (url: string): Promise<Uint8Array | null> => {
    try {
      const res = await fetch(url)
      if (!res.ok) return null
      const ab = await res.arrayBuffer()
      return new Uint8Array(ab)
    } catch {
      return null
    }
  }

  const getExt = (url: string) => {
    const parts = url.split('?')[0].split('.')
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'pdf'
  }

  // Bolle
  for (const bolla of bolle ?? []) {
    const fornitoreNome = sanitize(
      (Array.isArray(bolla.fornitori) ? bolla.fornitori[0] : bolla.fornitori as { nome: string } | null)?.nome ?? 'Sconosciuto'
    )
    const cartella = root.folder(fornitoreNome)!.folder('Bolle')!
    const data = bolla.data ?? startDate
    const ext = getExt(bolla.file_url!)
    const nomeFile = `Bolla_${data}_${bolla.id.slice(0, 8)}.${ext}`
    const buf = await downloadFile(bolla.file_url!)
    if (buf) cartella.file(nomeFile, buf)
  }

  // Fatture
  for (const fattura of fatture ?? []) {
    const fornitoreNome = sanitize(
      (Array.isArray(fattura.fornitori) ? fattura.fornitori[0] : fattura.fornitori as { nome: string } | null)?.nome ?? 'Sconosciuto'
    )
    const cartella = root.folder(fornitoreNome)!.folder('Fatture')!
    const data = fattura.data ?? startDate
    const ext = getExt(fattura.file_url!)
    const nomeFile = `Fattura_${data}_${fattura.id.slice(0, 8)}.${ext}`
    const buf = await downloadFile(fattura.file_url!)
    if (buf) cartella.file(nomeFile, buf)
  }

  const zipArrayBuffer = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' })

  return new Response(zipArrayBuffer, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${folderName}.zip"`,
      'Content-Length': String(zipArrayBuffer.byteLength),
    },
  })
}
