import { NextRequest } from 'next/server'
import { runEmailSyncForAllSedi } from '@/lib/email-sync-core'

export const maxDuration = 300

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const result = await runEmailSyncForAllSedi()
  return Response.json({ success: true, ...result })
}
