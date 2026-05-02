import { NextResponse } from 'next/server'
import { createServiceClient, getRequestAuth } from '@/utils/supabase/server'
import { gmailService } from '@/lib/gmail-service'

/**
 * GET /api/auth/google/status
 * 
 * Returns current Gmail connection status for the authenticated user.
 */
export async function GET() {
  const { user } = await getRequestAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const service = createServiceClient()
    await gmailService.init(service)
    
    const configured = gmailService.isConfigured()
    const connected = await gmailService.isConnected(user.id)
    
    let emailAddress: string | null = null
    if (connected) {
      emailAddress = await gmailService.getUserEmail(user.id)
    }
    
    return NextResponse.json({
      configured,
      connected,
      emailAddress,
    })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Errore sconosciuto'
    console.error('[GMAIL-STATUS] Error:', err)
    return NextResponse.json({
      configured: gmailService.isConfigured(),
      connected: false,
      emailAddress: null,
      error: errMsg,
    })
  }
}
