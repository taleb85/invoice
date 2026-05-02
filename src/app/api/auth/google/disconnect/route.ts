import { NextResponse } from 'next/server'
import { createServiceClient, getRequestAuth } from '@/utils/supabase/server'
import { gmailService } from '@/lib/gmail-service'

/**
 * POST /api/auth/google/disconnect
 * 
 * Revokes Gmail access for the authenticated user.
 */
export async function POST() {
  const { user } = await getRequestAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const service = createServiceClient()
    await gmailService.init(service)
    
    // Delete tokens from database
    await gmailService.disconnect(user.id)
    
    console.log(`[GMAIL-DISCONNECT] User ${user.id} disconnected Gmail`)
    
    return NextResponse.json({
      success: true,
      message: 'Gmail disconnesso con successo',
    })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Errore sconosciuto'
    console.error('[GMAIL-DISCONNECT] Error:', err)
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
