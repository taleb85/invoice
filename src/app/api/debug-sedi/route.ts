import { NextResponse } from 'next/server'
import { createServiceClient, getRequestAuth } from '@/utils/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export async function GET() {
  const { user } = await getRequestAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  // Query sedi con client normale (rispetta RLS)
  const { data: sediRLS, error: errRLS } = await service.from('sedi').select('id, nome')

  // Query is_admin() via RPC
  const { data: adminCheck, error: errAdmin } = await service.rpc('is_admin')

  // Query profilo utente
  const { data: profile } = await service.from('profiles').select('id, role, sede_id').eq('id', user.id).single()

  // Query sedi con service role (bypass RLS)
  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: sediAdmin } = await admin.from('sedi').select('id, nome')

  return NextResponse.json({
    user_id: user.id,
    user_email: user.email,
    profile,
    is_admin_rpc: adminCheck,
    is_admin_error: errAdmin?.message,
    sedi_with_rls: sediRLS,
    sedi_rls_error: errRLS?.message,
    sedi_bypass_rls: sediAdmin,
  })
}
