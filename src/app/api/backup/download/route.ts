import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient, getProfile } from '@/utils/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const profile = await getProfile()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
  }

  const path = req.nextUrl.searchParams.get('path')
  if (!path || !path.startsWith('backups/')) {
    return NextResponse.json({ error: 'Percorso non valido' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data, error } = await service.storage
    .from('documenti')
    .createSignedUrl(path, 60 * 60) // 1 hour expiry

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ url: data.signedUrl })
}
