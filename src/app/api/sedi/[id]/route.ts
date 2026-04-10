import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const { country_code } = body as { country_code?: string }

  const ALLOWED = ['UK', 'IT', 'FR', 'DE', 'ES']
  if (!country_code || !ALLOWED.includes(country_code)) {
    return NextResponse.json({ error: 'Codice paese non valido' }, { status: 400 })
  }

  const service = createServiceClient()
  const { error } = await service
    .from('sedi')
    .update({ country_code })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, country_code })
}
