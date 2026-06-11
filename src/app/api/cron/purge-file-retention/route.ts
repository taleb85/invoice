import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/utils/supabase/server'
import { purgeColdDocumentFiles } from '@/lib/document-file-retention'

export const maxDuration = 300

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dryRun = req.nextUrl.searchParams.get('dry_run') === '1'
  const force = req.nextUrl.searchParams.get('force') === '1'
  const sedeId = req.nextUrl.searchParams.get('sede_id') ?? undefined

  const service = createServiceClient()
  const result = await purgeColdDocumentFiles(service, { dryRun, force, sedeId })

  return NextResponse.json({
    ok: result.errors.length === 0,
    dryRun,
    force,
    ...result,
  })
}
