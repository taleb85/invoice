import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Lista gli operatori associati a una sede, per il dropdown di cambio operatore.
 */
export async function GET(req: NextRequest) {
  const sedeId = req.nextUrl.searchParams.get('sedeId')
  if (!sedeId) {
    return NextResponse.json({ error: 'sedeId obbligatorio.' }, { status: 400 })
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await adminClient
    .from('profiles')
    .select('id, full_name, role')
    .eq('sede_id', sedeId)
    .in('role', ['operatore', 'admin_sede'])
    .order('full_name')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ operators: data ?? [] })
}
