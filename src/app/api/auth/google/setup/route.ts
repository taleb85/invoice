import { NextResponse } from 'next/server'
import { createServiceClient, getRequestAuth } from '@/utils/supabase/server'
import { gmailService } from '@/lib/gmail-service'

/**
 * GET /api/auth/google/setup
 * 
 * Returns Google OAuth2 authorization URL for Gmail access.
 * User will be redirected to Google to grant permissions.
 */
export async function GET() {
  const { user } = await getRequestAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check if Gmail API is configured
  if (!gmailService.isConfigured()) {
    return NextResponse.json({
      error: 'Gmail API non configurato',
      hint: 'Aggiungi GMAIL_CLIENT_ID e GMAIL_CLIENT_SECRET a .env.local',
      instructions: '/INSTRUCTIONS_GOOGLE_API.md'
    }, { status: 500 })
  }
  
  try {
    const service = createServiceClient()
    // Initialize service with supabase
    await gmailService.init(service)
    
    // Generate authorization URL
    const authUrl = gmailService.getAuthUrl()
    
    // Store user ID in session for callback
    // Using URL parameter as simple state management
    const stateParam = Buffer.from(JSON.stringify({
      user_id: user.id,
      timestamp: Date.now(),
    })).toString('base64')
    
    const urlWithState = `${authUrl}&state=${encodeURIComponent(stateParam)}`
    
    return NextResponse.json({
      authUrl: urlWithState,
      message: 'Redirect user to this URL to authorize Gmail access',
    })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Errore sconosciuto'
    console.error('[GMAIL-SETUP] Error:', err)
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
