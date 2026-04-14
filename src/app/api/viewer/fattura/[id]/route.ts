import { NextResponse } from 'next/server'
import { getRequestAuth } from '@/utils/supabase/server'
import { getFatturaForViewer } from '@/lib/supabase-detail-for-viewer'

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const { user } = await getRequestAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const fattura = await getFatturaForViewer(id)
  if (!fattura) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ fattura })
}
